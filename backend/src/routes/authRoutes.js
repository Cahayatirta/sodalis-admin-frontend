// authRoutes.js – Refactored to use Supabase admin_accounts table
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { supabase } from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { recordAuditEvent } from '../services/auditLogger.js';

const router = express.Router();

/**
 * GET /api/v1/auth/totp-setup
 * Returns QR Code Data URL for the admin's stored TOTP secret.
 * Optional query param ?email= to select a specific admin; otherwise picks the first record.
 */
// GET /api/v1/auth/totp-setup
router.get('/totp-setup', async (req, res, next) => {
  try {
    const emailQuery = req.query.email?.toString();
    let query = supabase.from('admin_accounts').select('email, totp_secret');
    if (emailQuery) {
      query = query.eq('email', emailQuery);
    }
    const { data: admin, error } = await query.limit(1).maybeSingle();
    if (error || !admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    const serviceName = 'Sodalis Micro-Finance Admin';
    const otpauth = authenticator.keyuri(admin.email, serviceName, admin.totp_secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    res.json({
      success: true,
      data: {
        issuer: serviceName,
        account: admin.email,
        totpSecret: admin.totp_secret,
        qrCodeUrl: qrDataUrl,
        otpauthUri: otpauth,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/login
 * Validates identifier (email or username), password, and 6‑digit TOTP code.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password, totpCode } = req.body;
    if (!identifier || !password || !totpCode) {
      return res.status(400).json({
        success: false,
        message: 'Identifier, password, and TOTP code are required.',
      });
    }
    // Fetch admin by username or email
    const { data: admin, error } = await supabase
      .from('admin_accounts')
      .select('id, username, email, password_hash, totp_secret, role, full_name')
      .or(`username.eq.${identifier},email.eq.${identifier}`)
      .maybeSingle();
    if (error || !admin) {
      await recordAuditEvent({
        action: 'ADMIN_LOGIN_FAILED',
        targetType: 'auth',
        targetId: identifier,
        actor: identifier,
        reason: 'Admin not found',
      });
      return res.status(401).json({ success: false, message: 'Invalid administrative credentials.' });
    }
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      await recordAuditEvent({
        action: 'ADMIN_LOGIN_FAILED',
        targetType: 'auth',
        targetId: identifier,
        actor: identifier,
        reason: 'Invalid password',
      });
      return res.status(401).json({ success: false, message: 'Invalid administrative credentials.' });
    }
    // TOTP verification (dev bypass allowed)
    const isDevBypass = env.nodeEnv === 'development' && String(totpCode).trim() === '000000';
    let isTotpValid = false;
    if (isDevBypass) {
      isTotpValid = true;
    } else {
      try {
        isTotpValid = authenticator.check(String(totpCode).trim(), admin.totp_secret);
      } catch (e) {
        console.error('TOTP verification error:', e.message);
        isTotpValid = false;
      }
    }
    if (!isTotpValid) {
      await recordAuditEvent({
        action: 'ADMIN_LOGIN_MFA_FAILED',
        targetType: 'auth',
        targetId: identifier,
        actor: identifier,
        reason: 'Invalid 2FA TOTP code.',
      });
      return res.status(401).json({ success: false, message: 'Invalid 6-digit TOTP authentication code.' });
    }
    // Update last_login_at
    await supabase.from('admin_accounts').update({ last_login_at: new Date().toISOString() }).eq('id', admin.id);
    // Sign JWT
    const tokenPayload = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      full_name: admin.full_name,
      role: admin.role,
    };
    const token = jwt.sign(tokenPayload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
    await recordAuditEvent({
      action: 'ADMIN_LOGIN_SUCCESS',
      targetType: 'auth',
      targetId: admin.email,
      actor: admin.username,
      reason: 'Successful 2FA login.',
      metadata: { isDevBypass },
    });
    res.json({
      success: true,
      message: 'Admin authentication successful.',
      data: { token, admin: tokenPayload },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/me
 * Returns the authenticated admin's profile (excluding secret fields).
 */
router.get('/me', authenticateAdmin, async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { data: admin, error } = await supabase
      .from('admin_accounts')
      .select('id, username, email, full_name, role, created_at, updated_at, last_login_at')
      .eq('id', adminId)
      .maybeSingle();
    if (error || !admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    res.json({
      success: true,
      data: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
        authTime: req.user.iat ? new Date(req.user.iat * 1000).toISOString() : new Date().toISOString(),
        createdAt: admin.created_at,
        updatedAt: admin.updated_at,
        lastLoginAt: admin.last_login_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/auth/change-password
 * Allows an authenticated admin to change their password.
 */
router.patch('/change-password', authenticateAdmin, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both currentPassword and newPassword are required.' });
    }
    const adminId = req.user.id;
    const { data: admin, error } = await supabase
      .from('admin_accounts')
      .select('password_hash')
      .eq('id', adminId)
      .maybeSingle();
    if (error || !admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    const passwordMatches = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await supabase
      .from('admin_accounts')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', adminId);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
