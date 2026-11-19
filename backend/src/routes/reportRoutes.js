import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { exportToExcel, exportToPdf } from '../services/reportService.js';
import { getLocalAuditLogs } from '../services/auditLogger.js';

const router = express.Router();

/**
 * GET /api/v1/reports/export?module=loans|users|audit_logs&format=xlsx|pdf
 * Direct Supabase export streaming .xlsx or .pdf files
 */
router.get('/export', authenticateAdmin, async (req, res, next) => {
  try {
    const { module = 'loans', format = 'xlsx' } = req.query;

    const validModules = ['loans', 'users', 'audit_logs'];
    const validFormats = ['xlsx', 'pdf'];

    if (!validModules.includes(module.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid module. Supported modules: ${validModules.join(', ')}`,
      });
    }

    if (!validFormats.includes(format.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid format. Supported formats: ${validFormats.join(', ')}`,
      });
    }

    let reportData = [];

    if (module === 'loans') {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      reportData = data || [];
    } else if (module === 'users') {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      reportData = data || [];
    } else if (module === 'audit_logs') {
      const [localLogs, { data: users }, { data: loans }] = await Promise.all([
        getLocalAuditLogs(),
        supabase
          .from('users')
          .select('id, full_name, role, is_verified, created_at'),
        supabase
          .from('loans')
          .select('id, loan_code, borrower_name, status, amount, updated_at'),
      ]);

      const synthetic = [];
      (users || []).forEach((u) => {
        if (u.is_verified) {
          synthetic.push({
            id: `usr-${u.id.slice(0, 8)}`,
            timestamp: u.created_at,
            actor: 'system:onboarding',
            action: 'KYC_APPROVED',
            targetType: 'user',
            reason: `User ${u.full_name} (${u.role}) verified`,
            integrityHash: 'SYNTHETIC_SUPABASE_EVENT',
          });
        }
      });

      (loans || []).forEach((l) => {
        synthetic.push({
          id: `loan-${l.id.slice(0, 8)}`,
          timestamp: l.updated_at,
          actor: 'system:underwriting',
          action: `LOAN_STATUS_${l.status?.toUpperCase()}`,
          targetType: 'loan',
          reason: `Loan ${l.loan_code} for ${l.borrower_name} updated to ${l.status}`,
          integrityHash: 'SYNTHETIC_SUPABASE_EVENT',
        });
      });

      reportData = [...localLogs, ...synthetic].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    if (format === 'xlsx') {
      await exportToExcel(module, reportData, res);
    } else {
      exportToPdf(module, reportData, res);
    }
  } catch (error) {
    next(error);
  }
});

export default router;

