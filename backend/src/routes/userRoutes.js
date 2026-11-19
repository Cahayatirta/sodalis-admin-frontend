import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { kycUpload } from '../middleware/upload.js';
import { recordAuditEvent } from '../services/auditLogger.js';

const router = express.Router();

/**
 * GET /api/v1/users
 * Search, filter, and paginate users with linked borrower or investor profiles
 */
router.get('/', authenticateAdmin, async (req, res, next) => {
  try {
    const {
      search,
      role,
      isVerified,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase.from('users').select('*', { count: 'exact' });

    if (role && (role === 'borrower' || role === 'investor')) {
      query = query.eq('role', role);
    }

    if (isVerified !== undefined && isVerified !== '') {
      const boolVal = isVerified === 'true' || isVerified === true;
      query = query.eq('is_verified', boolVal);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data: users, count, error } = await query;
    if (error) throw error;

    const userList = users || [];
    const userIds = userList.map((u) => u.id).filter(Boolean);

    // Fetch related borrower profiles and investor profiles in batch with early return guard
    let borrowerMap = new Map();
    let investorMap = new Map();

    if (userIds && userIds.length > 0) {
      const [{ data: borrowers }, { data: investors }] = await Promise.all([
        supabase.from('borrower_profiles').select('*').in('user_id', userIds),
        supabase.from('investor_profiles').select('*').in('user_id', userIds),
      ]);

      (borrowers || []).forEach((b) => borrowerMap.set(b.user_id, b));
      (investors || []).forEach((i) => investorMap.set(i.user_id, i));
    }

    const items = userList.map((user) => ({
      ...user,
      profile:
        user.role === 'borrower'
          ? borrowerMap.get(user.id) || null
          : investorMap.get(user.id) || null,
    }));

    res.json({
      success: true,
      data: {
        items,
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
 * GET /api/v1/users/:id
 * Retrieve single user by UUID with full role profile
 */
router.get('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${id} not found.`,
      });
    }

    let profile = null;
    if (user.role === 'borrower') {
      const { data: bProfile } = await supabase
        .from('borrower_profiles')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      profile = bProfile;
    } else if (user.role === 'investor') {
      const { data: iProfile } = await supabase
        .from('investor_profiles')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      profile = iProfile;
    }

    res.json({
      success: true,
      data: {
        ...user,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/users/:id/documents
 * Upload KYC document via multer and store local path in users.kyc_document_path
 */
router.post(
  '/:id/documents',
  authenticateAdmin,
  kycUpload.single('document'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No document file uploaded. Use form-data field "document".',
        });
      }

      // Check user existence
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('id', id)
        .maybeSingle();

      if (userErr) throw userErr;
      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User with ID ${id} not found.`,
        });
      }

      const relativePath = `/uploads/kyc/${req.file.filename}`;

      const { data: updatedUser, error: updateErr } = await supabase
        .from('users')
        .update({ kyc_document_path: relativePath })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      await recordAuditEvent({
        action: 'KYC_DOCUMENT_UPLOADED',
        targetType: 'user',
        targetId: id,
        actor: req.user?.username || 'admin',
        reason: 'KYC document uploaded and attached to user profile.',
        metadata: {
          originalName: req.file.originalname,
          sizeBytes: req.file.size,
          mimetype: req.file.mimetype,
          kycDocumentPath: relativePath,
        },
      });

      res.json({
        success: true,
        message: 'KYC document uploaded successfully.',
        data: {
          user: updatedUser,
          filePath: relativePath,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/users/:id/kyc-decision
 * Approve or Reject KYC verification
 */
router.patch('/:id/kyc-decision', authenticateAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "APPROVE" or "REJECT".',
      });
    }

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, full_name, role, is_verified')
      .eq('id', id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${id} not found.`,
      });
    }

    const isVerified = action === 'APPROVE';
    const nowIso = new Date().toISOString();

    // 1. Update users table and role-specific profile concurrently with Promise.all
    const updatePromises = [
      supabase
        .from('users')
        .update({ is_verified: isVerified })
        .eq('id', id)
        .select()
        .single(),
    ];

    if (user.role === 'borrower') {
      updatePromises.push(
        supabase
          .from('borrower_profiles')
          .update({
            is_verified: isVerified,
            updated_at: nowIso,
          })
          .eq('user_id', id)
      );
    } else if (user.role === 'investor') {
      updatePromises.push(
        supabase
          .from('investor_profiles')
          .update({
            is_verified: isVerified,
            updated_at: nowIso,
          })
          .eq('user_id', id)
      );
    }

    const [userUpdateRes, profileUpdateRes] = await Promise.all(updatePromises);
    if (userUpdateRes.error) throw userUpdateRes.error;
    if (profileUpdateRes && profileUpdateRes.error) throw profileUpdateRes.error;

    const updatedUser = userUpdateRes.data;

    // 2. Append to audit log
    const auditEntry = await recordAuditEvent({
      action: action === 'APPROVE' ? 'KYC_APPROVED' : 'KYC_REJECTED',
      targetType: 'user',
      targetId: id,
      actor: req.user?.username || 'admin',
      reason: reason || `Admin underwriting decision: ${action}`,
      metadata: {
        role: user.role,
        fullName: user.full_name,
        newVerifiedStatus: isVerified,
      },
    });

    res.json({
      success: true,
      message: `User KYC status updated to ${action}D successfully.`,
      data: {
        user: updatedUser,
        auditLog: auditEntry,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/users/bulk-kyc
 * Bulk update KYC verification for multiple users
 */
router.post('/bulk-kyc', authenticateAdmin, async (req, res, next) => {
  try {
    const { userIds, action, reason } = req.body;

    const sanitizedUserIds = Array.isArray(userIds)
      ? userIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
      : [];

    // Early return guard: prevent empty .in() queries to Supabase
    if (!sanitizedUserIds || sanitizedUserIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required and must contain at least one valid ID.',
      });
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "APPROVE" or "REJECT".',
      });
    }

    const isVerified = action === 'APPROVE';
    const nowIso = new Date().toISOString();

    // Parallelize all 3 table updates concurrently using Promise.all
    const [userRes, borrowerRes, investorRes] = await Promise.all([
      supabase
        .from('users')
        .update({ is_verified: isVerified })
        .in('id', sanitizedUserIds),
      supabase
        .from('borrower_profiles')
        .update({ is_verified: isVerified, updated_at: nowIso })
        .in('user_id', sanitizedUserIds),
      supabase
        .from('investor_profiles')
        .update({ is_verified: isVerified, updated_at: nowIso })
        .in('user_id', sanitizedUserIds),
    ]);

    if (userRes.error) throw userRes.error;
    if (borrowerRes.error) throw borrowerRes.error;
    if (investorRes.error) throw investorRes.error;

    // Record audit event
    const auditRecord = await recordAuditEvent({
      action: action === 'APPROVE' ? 'BULK_KYC_APPROVED' : 'BULK_KYC_REJECTED',
      targetType: 'users',
      targetId: sanitizedUserIds.join(','),
      actor: req.user?.username || 'admin',
      reason: reason || `Bulk ${action} applied to ${sanitizedUserIds.length} users`,
      metadata: { count: sanitizedUserIds.length, userIds: sanitizedUserIds, isVerified },
    });

    res.json({
      success: true,
      message: `Bulk KYC ${action} applied to ${sanitizedUserIds.length} user(s).`,
      data: {
        affectedCount: sanitizedUserIds.length,
        isVerified,
        auditRecord,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

