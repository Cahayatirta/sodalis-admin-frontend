import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { recordAuditEvent } from '../services/auditLogger.js';

const router = express.Router();

/**
 * GET /api/v1/auth/totp-setup
 * Generate TOTP QR Code Data URL from ADMIN_TOTP_SECRET
 */
router.get('/totp-setup', async (req, res, next) => {
  try {
    const serviceName = 'Sodalis Micro-Finance Admin';
    const otpauth = authenticator.keyuri(env.admin.email, serviceName, env.admin.totpSecret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    res.json({
      success: true,
      data: {
        issuer: serviceName,
        account: env.admin.email,
        totpSecret: env.admin.totpSecret,
        qrCodeUrl: qrDataUrl,
        otpauthUri: otpauth,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * Validates identifier (email or username), password, and 6-digit TOTP code
 */
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password, totpCode } = req.body;

    if (!identifier || !password || !totpCode) {
      return res.status(400).json({
        success: false,
        message: 'Identifier (email/username), password, and 6-digit TOTP code are required.',
      });
    }

    // Verify username or email
    const isIdentifierValid =
      identifier === env.admin.username || identifier === env.admin.email;
    const isPasswordValid = password === env.admin.password;

    if (!isIdentifierValid || !isPasswordValid) {
      await recordAuditEvent({
        action: 'ADMIN_LOGIN_FAILED',
        targetType: 'auth',
        targetId: identifier,
        actor: identifier,
        reason: 'Invalid credentials provided.',
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.',
      });
    }

    // Verify 6-digit TOTP code
    const isDevBypass = env.nodeEnv === 'development' && String(totpCode).trim() === '000000';
    let isTotpValid = false;

    if (isDevBypass) {
      isTotpValid = true;
    } else {
      try {
        isTotpValid = authenticator.check(String(totpCode).trim(), env.admin.totpSecret);
      } catch (totpErr) {
        console.error('TOTP Check Exception:', totpErr.message);
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

      return res.status(401).json({
        success: false,
        message: 'Invalid 6-digit TOTP authentication code.',
      });
    }

    // Sign JWT token
    const tokenPayload = {
      username: env.admin.username,
      email: env.admin.email,
      role: 'admin',
    };

    const token = jwt.sign(tokenPayload, env.jwt.secret, {
      expiresIn: env.jwt.expiresIn,
    });

    await recordAuditEvent({
      action: 'ADMIN_LOGIN_SUCCESS',
      targetType: 'auth',
      targetId: env.admin.email,
      actor: env.admin.username,
      reason: 'Successful 2FA Underwriting login.',
      metadata: { isDevBypass },
    });

    res.json({
      success: true,
      message: 'Admin authentication successful.',
      data: {
        token,
        admin: {
          username: env.admin.username,
          email: env.admin.email,
          role: 'admin',
          terminal: 'Sodalis Micro-Finance Underwriting Terminal',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Return current authenticated admin session
 */
router.get('/me', authenticateAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      username: env.admin.username,
      email: env.admin.email,
      role: 'admin',
      terminal: 'Sodalis Micro-Finance Underwriting Terminal',
      authTime: req.user.iat ? new Date(req.user.iat * 1000).toISOString() : new Date().toISOString(),
    },
  });
});

export default router;

