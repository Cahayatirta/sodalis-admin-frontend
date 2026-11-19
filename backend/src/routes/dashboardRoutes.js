import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * Calculate Date range filter
 */
const getDateRangeFilter = (range = '30d') => {
  const now = new Date();
  const startDate = new Date();

  switch (range) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case 'ytd':
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '30d':
    default:
      startDate.setDate(now.getDate() - 30);
      break;
  }

  return startDate.toISOString();
};

/**
 * GET /api/v1/dashboard/summary?range=7d|30d|90d|ytd
 */
router.get('/summary', authenticateAdmin, async (req, res, next) => {
  try {
    const { range = '30d' } = req.query;
    const startDate = getDateRangeFilter(range);

    // Concurrently fetch independent entities using Promise.all for optimal latency
    const [
      { data: allLoans, error: loansErr },
      { data: unverifiedUsers, count: unverifiedCount, error: userErr },
      { data: investors, error: invErr },
      { data: recentUsers, error: recUserErr },
    ] = await Promise.all([
      // 1. All loans for metrics & velocity calculations
      supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false }),

      // 2. Unverified users count for action queue
      supabase
        .from('users')
        .select('id, is_verified', { count: 'exact' })
        .eq('is_verified', false),

      // 3. Investor capital for liquidity calculation
      supabase
        .from('investor_profiles')
        .select('total_invested, total_return'),

      // 4. Recent registrations
      supabase
        .from('users')
        .select('id, email, role, full_name, is_verified, created_at, phone, kyc_document_path')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (loansErr) throw loansErr;
    if (userErr) throw userErr;
    if (invErr) throw invErr;
    if (recUserErr) throw recUserErr;

    const loansList = allLoans || [];

    // Filter loans by range for velocity metrics
    const rangeLoans = loansList.filter((l) => new Date(l.created_at) >= new Date(startDate));

    // Total Disbursed Capital (loans with status: disbursed, funded, or active)
    const disbursedStatuses = ['disbursed', 'funded', 'active'];
    const disbursedLoans = loansList.filter((l) =>
      disbursedStatuses.includes(String(l.status || '').toLowerCase())
    );
    const totalDisbursedCapital = disbursedLoans.reduce(
      (sum, l) => sum + Number(l.funded_amount || l.amount || 0),
      0
    );

    // Pending Loans count (pending, submitted, under review)
    const pendingStatuses = ['pending', 'submitted', 'under_review', 'under review', 'pending_underwriting'];
    const pendingLoansCount = loansList.filter((l) =>
      pendingStatuses.includes(String(l.status || '').toLowerCase())
    ).length;

    const pendingUsersCount = unverifiedCount || (unverifiedUsers ? unverifiedUsers.length : 0);
    const pendingActionQueue = pendingUsersCount + pendingLoansCount;

    // Capital liquidity calculation
    const totalInvestedCapital = (investors || []).reduce(
      (sum, inv) => sum + Number(inv.total_invested || 0),
      0
    );
    const activeCapitalLiquidity = Math.max(0, totalInvestedCapital - totalDisbursedCapital);

    // Velocity Chart & Purpose Breakdown
    const purposeMap = {};
    const timeSeriesMap = {};

    rangeLoans.forEach((l) => {
      // Purpose breakdown
      const purposeKey = l.purpose || 'Other';
      if (!purposeMap[purposeKey]) {
        purposeMap[purposeKey] = { purpose: purposeKey, count: 0, totalAmount: 0 };
      }
      purposeMap[purposeKey].count += 1;
      purposeMap[purposeKey].totalAmount += Number(l.amount || 0);

      // Time-series (grouped by YYYY-MM-DD)
      const dayKey = l.created_at ? l.created_at.split('T')[0] : 'Unknown';
      if (!timeSeriesMap[dayKey]) {
        timeSeriesMap[dayKey] = { date: dayKey, loanCount: 0, totalDisbursed: 0, totalRequested: 0 };
      }
      timeSeriesMap[dayKey].loanCount += 1;
      timeSeriesMap[dayKey].totalRequested += Number(l.amount || 0);
      if (disbursedStatuses.includes(String(l.status || '').toLowerCase())) {
        timeSeriesMap[dayKey].totalDisbursed += Number(l.funded_amount || l.amount || 0);
      }
    });

    const purposeBreakdown = Object.values(purposeMap);
    const timeSeries = Object.values(timeSeriesMap).sort((a, b) => a.date.localeCompare(b.date));

    // Fetch matching profiles for recent users with early return guard on empty array
    const userIds = (recentUsers || []).map((u) => u.id).filter(Boolean);
    const borrowerMap = new Map();
    const investorMap = new Map();

    if (userIds && userIds.length > 0) {
      const [{ data: borrowers }, { data: invProfiles }] = await Promise.all([
        supabase
          .from('borrower_profiles')
          .select('user_id, university, major, nim, semester, gpa, ai_trust_score, credit_limit')
          .in('user_id', userIds),
        supabase
          .from('investor_profiles')
          .select('user_id, investor_type, bank_name, total_invested')
          .in('user_id', userIds),
      ]);

      (borrowers || []).forEach((b) => borrowerMap.set(b.user_id, b));
      (invProfiles || []).forEach((i) => investorMap.set(i.user_id, i));
    }

    const recentRegistrations = (recentUsers || []).map((u) => ({
      ...u,
      profile: u.role === 'borrower' ? borrowerMap.get(u.id) || null : investorMap.get(u.id) || null,
    }));

    res.json({
      success: true,
      data: {
        range,
        metrics: {
          totalDisbursedCapital,
          totalInvestedCapital,
          activeCapitalLiquidity,
          pendingActionQueue,
          pendingUsersCount,
          pendingLoansCount,
          totalLoansCount: loansList.length,
        },
        velocityChart: {
          timeSeries,
          purposeBreakdown,
        },
        recentRegistrations,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

