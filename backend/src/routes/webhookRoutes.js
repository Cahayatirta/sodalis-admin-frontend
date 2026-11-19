import express from 'express';
import { verifyMidtransSignature, handleMidtransNotification } from '../services/midtransService.js';
import { env } from '../config/env.js';

const router = express.Router();

/**
 * POST /api/v1/webhooks/midtrans
 * Midtrans HTTP Notification Webhook with SHA-512 Signature Verification
 */
router.post('/midtrans', async (req, res, next) => {
  try {
    const notification = req.body;

    // Check if notification payload is valid
    if (!notification || !notification.order_id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Midtrans notification payload.',
      });
    }

    // Verify SHA-512 Signature (allow bypass in development when server key is placeholder)
    const isMockServerKey =
      env.nodeEnv === 'development' &&
      (!env.midtrans.serverKey || env.midtrans.serverKey.includes('demo') || env.midtrans.serverKey.includes('your-server-key'));

    const isValidSignature = verifyMidtransSignature(notification);

    if (!isValidSignature && !isMockServerKey) {
      console.warn('[Midtrans Webhook Warning] SHA-512 Signature verification failed for order:', notification.order_id);
      return res.status(403).json({
        success: false,
        message: 'Midtrans signature verification failed.',
      });
    }

    const result = await handleMidtransNotification(notification);

    res.status(200).json({
      success: true,
      message: 'Midtrans notification processed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

