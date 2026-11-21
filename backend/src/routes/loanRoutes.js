import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createSnapTransaction } from '../services/midtransService.js';
import { recordAuditEvent } from '../services/auditLogger.js';

const router = express.Router();

/**
 * GET /api/v1/loans
 * Query loans with filters, pagination, and underwriting KPI summaries
 */
router.get('/', authenticateAdmin, async (req, res, next) => {
  try {
    const {
      search,
      status,
      riskTier,
      tenor,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // 1. Build filtered query
    let query = supabase.from('loans').select('*', { count: 'exact' });

    if (status && status !== 'ALL') {
      query = query.ilike('status', `%${status}%`);
    }

    if (riskTier && riskTier !== 'ALL') {
      query = query.ilike('risk_tier', `%${riskTier}%`);
    }

    if (tenor && tenor !== 'ALL') {
      query = query.eq('tenor_months', parseInt(tenor, 10));
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `loan_code.ilike.${term},borrower_name.ilike.${term},major.ilike.${term},purpose.ilike.${term}`
      );
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // 2. Concurrently fetch all loans KPI metrics and filtered paginated items using Promise.all
    const [
      { data: allLoansSummary, error: kpiErr },
      { data: items, count, error },
    ] = await Promise.all([
      supabase.from('loans').select('status, risk_tier, ai_score, amount'),
      query,
    ]);

    if (kpiErr) throw kpiErr;
    if (error) throw error;

    const summaryList = allLoansSummary || [];
    const pendingStatuses = ['pending', 'submitted', 'under_review', 'under review', 'pending_underwriting'];
    const approvedStatuses = ['approved', 'approved_disburse', 'ready_for_disbursal', 'disbursed'];

    const pendingUnderwriting = summaryList.filter((l) =>
      pendingStatuses.includes(String(l.status || '').toLowerCase())
    ).length;

    const approvedForDisbursal = summaryList.filter((l) =>
      approvedStatuses.includes(String(l.status || '').toLowerCase())
    ).length;

    const flaggedHighRisk = summaryList.filter((l) => {
      const tier = String(l.risk_tier || '').toLowerCase();
      const score = Number(l.ai_score || 0);
      return tier.includes('high') || tier.includes('tier c') || (score > 0 && score < 600);
    }).length;

    res.json({
      success: true,
      data: {
        kpi: {
          pendingUnderwriting,
          approvedForDisbursal,
          flaggedHighRisk,
          totalLoans: summaryList.length,
        },
        items: items || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/loans/:id
 * Retrieve single loan with full underwriting details, borrower profile, installments, and investments
 */
router.get('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch loan
    const { data: loan, error: loanErr } = await supabase
      .from('loans')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (loanErr) throw loanErr;
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: `Loan with ID ${id} not found.`,
      });
    }

    // Parallel fetch related data
    const [borrowerRes, installmentsRes, investmentsRes] = await Promise.all([
      loan.borrower_id
        ? supabase.from('borrower_profiles').select('*').eq('id', loan.borrower_id).maybeSingle()
        : { data: null },
      supabase
        .from('loan_installments')
        .select('*')
        .eq('loan_id', id)
        .order('installment_number', { ascending: true }),
      supabase.from('investments').select('*').eq('loan_id', id),
    ]);

    res.json({
      success: true,
      data: {
        ...loan,
        borrowerProfile: borrowerRes.data || null,
        installments: installmentsRes.data || [],
        investments: investmentsRes.data || [],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/loans/:id/decision
 * Underwriting decision: APPROVE_DISBURSE | REQUEST_DOCS | REJECT
 */
router.patch('/:id/decision', authenticateAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    const validActions = ['APPROVE_DISBURSE', 'REQUEST_DOCS', 'REJECT'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    // Fetch target loan
    const { data: loan, error: loanErr } = await supabase
      .from('loans')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (loanErr) throw loanErr;
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: `Loan with ID ${id} not found.`,
      });
    }

    let updatedStatus = '';
    let midtransTransaction = null;

    if (action === 'APPROVE_DISBURSE') {
      updatedStatus = 'approved_disburse';

      // Trigger Midtrans Snap transaction for disbursal / payment escrow
      midtransTransaction = await createSnapTransaction({
        loanCode: loan.loan_code,
        amount: loan.amount,
        borrowerName: loan.borrower_name,
        purpose: loan.purpose,
      });
    } else if (action === 'REQUEST_DOCS') {
      updatedStatus = 'docs_requested';
    } else if (action === 'REJECT') {
      updatedStatus = 'rejected';
    }

    const { data: updatedLoan, error: updateErr } = await supabase
      .from('loans')
      .update({
        status: updatedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;

    // Append to audit log
    const auditRecord = await recordAuditEvent({
      action: `LOAN_${action}`,
      targetType: 'loan',
      targetId: id,
      actor: req.user?.username || 'admin',
      reason: reason || `Loan underwriting decision: ${action}`,
      metadata: {
        loanCode: loan.loan_code,
        borrowerName: loan.borrower_name,
        amount: loan.amount,
        previousStatus: loan.status,
        newStatus: updatedStatus,
        midtrans: midtransTransaction,
      },
    });

    res.json({
      success: true,
      message: `Loan decision ${action} applied successfully.`,
      data: {
        loan: updatedLoan,
        midtrans: midtransTransaction,
        auditRecord,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/loans/bulk-decision
 * Bulk update decision for multiple loan IDs
 */
router.post('/bulk-decision', authenticateAdmin, async (req, res, next) => {
  try {
    const { loanIds, action, reason } = req.body;

    const sanitizedLoanIds = Array.isArray(loanIds)
      ? loanIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
      : [];

    // Early return guard: prevent empty .in() queries to Supabase
    if (!sanitizedLoanIds || sanitizedLoanIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'loanIds array is required and must contain at least one valid ID.',
      });
    }

    const validActions = ['APPROVE_DISBURSE', 'REJECT'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    const newStatus = action === 'APPROVE_DISBURSE' ? 'approved_disburse' : 'rejected';
    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('loans')
      .update({
        status: newStatus,
        updated_at: nowIso,
      })
      .in('id', sanitizedLoanIds);

    if (updateErr) throw updateErr;

    const auditRecord = await recordAuditEvent({
      action: `BULK_LOAN_${action}`,
      targetType: 'loans',
      targetId: sanitizedLoanIds.join(','),
      actor: req.user?.username || 'admin',
      reason: reason || `Bulk ${action} applied to ${sanitizedLoanIds.length} loans`,
      metadata: { count: sanitizedLoanIds.length, loanIds: sanitizedLoanIds, newStatus },
    });

    res.json({
      success: true,
      message: `Bulk decision ${action} applied to ${sanitizedLoanIds.length} loan(s).`,
      data: {
        affectedCount: sanitizedLoanIds.length,
        status: newStatus,
        auditRecord,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

