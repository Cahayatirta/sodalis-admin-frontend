import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { getLocalAuditLogs, generateIntegrityHash } from '../services/auditLogger.js';

const router = express.Router();

/**
 * GET /api/v1/audit-logs
 * Unified immutable compliance audit feed merging local audit.jsonl and Supabase historical events
 */
router.get('/', authenticateAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));

    // Concurrently fetch local audit records and Supabase lifecycle entities in parallel
    const [localLogs, { data: users }, { data: loans }, { data: installments }] =
      await Promise.all([
        getLocalAuditLogs(),
        supabase.from('users').select('id, full_name, email, role, is_verified, created_at'),
        supabase
          .from('loans')
          .select('id, loan_code, borrower_name, status, amount, created_at, updated_at'),
        supabase
          .from('loan_installments')
          .select(
            'id, loan_id, installment_number, amount, status, paid_date, transaction_id, created_at'
          )
          .not('paid_date', 'is', null),
      ]);

    // KPI Metrics calculation
    const userList = users || [];
    const loanList = loans || [];
    const installmentList = installments || [];

    const approvedRegistrations = userList.filter((u) => u.is_verified === true).length;
    const acceptedStatuses = ['approved', 'approved_disburse', 'disbursed', 'funded', 'active'];
    const acceptedLoans = loanList.filter((l) =>
      acceptedStatuses.includes(String(l.status || '').toLowerCase())
    ).length;
    const rejectedLoans = loanList.filter((l) =>
      String(l.status || '').toLowerCase() === 'rejected'
    ).length;

    // Track existing targetIds & actions in local logs to avoid duplicate entries
    const existingKeys = new Set(
      localLogs.map((log) => `${log.targetType}_${log.targetId}_${log.action}`)
    );

    const syntheticEvents = [];

    // Synthesize user verification events
    userList.forEach((u) => {
      if (u.is_verified) {
        const key = `user_${u.id}_KYC_APPROVED`;
        if (!existingKeys.has(key)) {
          const payload = {
            id: `usr-audit-${u.id.slice(0, 8)}`,
            timestamp: u.created_at,
            actor: 'system:onboarding',
            action: 'KYC_APPROVED',
            targetType: 'user',
            targetId: u.id,
            reason: 'User registration verified for financial underwriting.',
            metadata: {
              fullName: u.full_name,
              email: u.email,
              role: u.role,
            },
          };
          syntheticEvents.push({
            ...payload,
            integrityHash: generateIntegrityHash(payload),
          });
        }
      }
    });

    // Synthesize loan status events
    loanList.forEach((l) => {
      const statusLower = String(l.status || '').toLowerCase();
      let actionName = null;

      if (acceptedStatuses.includes(statusLower)) {
        actionName = 'LOAN_APPROVED_DISBURSE';
      } else if (statusLower === 'rejected') {
        actionName = 'LOAN_REJECTED';
      } else if (statusLower.includes('review') || statusLower === 'pending') {
        actionName = 'LOAN_SUBMITTED_FOR_REVIEW';
      }

      if (actionName) {
        const key = `loan_${l.id}_${actionName}`;
        if (!existingKeys.has(key)) {
          const payload = {
            id: `loan-audit-${l.id.slice(0, 8)}`,
            timestamp: l.updated_at || l.created_at,
            actor: 'system:underwriting',
            action: actionName,
            targetType: 'loan',
            targetId: l.id,
            reason: `Loan recorded with status: ${l.status}`,
            metadata: {
              loanCode: l.loan_code,
              borrowerName: l.borrower_name,
              amount: l.amount,
              status: l.status,
            },
          };
          syntheticEvents.push({
            ...payload,
            integrityHash: generateIntegrityHash(payload),
          });
        }
      }
    });

    // Synthesize installment settlement events
    installmentList.forEach((inst) => {
      if (inst.paid_date) {
        const key = `loan_installment_${inst.id}_INSTALLMENT_PAID`;
        if (!existingKeys.has(key)) {
          const payload = {
            id: `inst-audit-${inst.id.slice(0, 8)}`,
            timestamp: inst.paid_date,
            actor: 'system:repayment',
            action: 'INSTALLMENT_PAID',
            targetType: 'loan_installment',
            targetId: inst.id,
            reason: `Installment #${inst.installment_number} settled.`,
            metadata: {
              installmentNumber: inst.installment_number,
              amount: inst.amount,
              transactionId: inst.transaction_id,
              status: inst.status,
            },
          };
          syntheticEvents.push({
            ...payload,
            integrityHash: generateIntegrityHash(payload),
          });
        }
      }
    });

    // Merge and sort in reverse chronological order
    let unified = [...localLogs, ...syntheticEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply search filter if provided
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      unified = unified.filter(
        (item) =>
          item.action?.toLowerCase().includes(term) ||
          item.actor?.toLowerCase().includes(term) ||
          item.targetType?.toLowerCase().includes(term) ||
          item.reason?.toLowerCase().includes(term) ||
          item.integrityHash?.toLowerCase().includes(term) ||
          JSON.stringify(item.metadata || {}).toLowerCase().includes(term)
      );
    }

    // Pagination
    const total = unified.length;
    const offset = (pageNum - 1) * limitNum;
    const items = unified.slice(offset, offset + limitNum);

    res.json({
      success: true,
      data: {
        kpi: {
          approvedRegistrations,
          acceptedLoans,
          rejectedLoans,
          totalAuditEntries: total,
        },
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

