import crypto from 'crypto';
import { snap, coreApi } from '../config/midtrans.js';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { recordAuditEvent } from './auditLogger.js';

/**
 * Create a Midtrans Snap transaction for loan disbursement / escrow
 */
export const createSnapTransaction = async ({ loanCode, amount, borrowerName, purpose }) => {
  const parameter = {
    transaction_details: {
      order_id: loanCode,
      gross_amount: Math.round(Number(amount)),
    },
    item_details: [
      {
        id: loanCode,
        price: Math.round(Number(amount)),
        quantity: 1,
        name: `Disbursement: ${purpose || 'Student Loan'}`.slice(0, 50),
      },
    ],
    customer_details: {
      first_name: borrowerName || 'Borrower',
    },
  };

  try {
    const transaction = await snap.createTransaction(parameter);
    return {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    };
  } catch (error) {
    console.error('Midtrans Snap Transaction Error:', error.message);
    // If Midtrans credentials are test/unconfigured, return graceful fallback object
    return {
      token: `MOCK_SNAP_${Date.now()}`,
      redirect_url: `https://app.sandbox.midtrans.com/snap/v2/vtweb/mock-${loanCode}`,
      isMock: true,
      error: error.message,
    };
  }
};

/**
 * Verify SHA-512 Signature Key from Midtrans Notification
 * Formula: SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export const verifyMidtransSignature = (notification) => {
  const { order_id, status_code, gross_amount, signature_key } = notification;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return false;
  }

  const payload = `${order_id}${status_code}${gross_amount}${env.midtrans.serverKey}`;
  const computedHash = crypto.createHash('sha512').update(payload).digest('hex');

  return computedHash === signature_key;
};

/**
 * Handle Midtrans Webhook Notification
 * Updates loans and loan_installments tables in Supabase
 */
export const handleMidtransNotification = async (notification) => {
  const {
    order_id,
    transaction_status,
    fraud_status,
    payment_type,
    transaction_id,
    settlement_time,
  } = notification;

  const isSuccess =
    (transaction_status === 'settlement' || transaction_status === 'capture') &&
    (fraud_status === 'accept' || !fraud_status);

  const statusMapped = isSuccess
    ? 'disbursed'
    : transaction_status === 'pending'
      ? 'processing'
      : transaction_status === 'expire' || transaction_status === 'cancel'
        ? 'cancelled'
        : 'failed';

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(order_id || '').trim()
  );

  // 1. Try to find matching loan by loan_code (or id only if order_id is a valid UUID)
  let loanQuery = supabase
    .from('loans')
    .select('id, loan_code, borrower_name, status, amount');

  if (isUuid) {
    loanQuery = loanQuery.or(`loan_code.eq.${order_id},id.eq.${order_id}`);
  } else {
    loanQuery = loanQuery.eq('loan_code', order_id);
  }

  const { data: loan, error: loanErr } = await loanQuery.maybeSingle();

  if (loan) {
    const updatedStatus = isSuccess ? 'disbursed' : statusMapped;
    const { error: updateErr } = await supabase
      .from('loans')
      .update({
        status: updatedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loan.id);

    if (updateErr) {
      console.error('Failed to update loan status from webhook:', updateErr);
    }

    await recordAuditEvent({
      action: 'MIDTRANS_WEBHOOK_LOAN_STATUS',
      targetType: 'loan',
      targetId: loan.id,
      actor: 'system:midtrans',
      reason: `Midtrans transaction_status=${transaction_status}, fraud_status=${fraud_status || 'N/A'}`,
      metadata: {
        order_id,
        transaction_id,
        status: updatedStatus,
        payment_type,
      },
    });

    return { type: 'loan', id: loan.id, status: updatedStatus };
  }

  // 2. Try to find matching installment by transaction_id or va_number (or id only if order_id is a valid UUID)
  let installmentQuery = supabase
    .from('loan_installments')
    .select('id, loan_id, installment_number, status');

  if (isUuid) {
    installmentQuery = installmentQuery.or(`transaction_id.eq.${order_id},id.eq.${order_id}`);
  } else {
    installmentQuery = installmentQuery.or(`transaction_id.eq.${order_id},va_number.eq.${order_id}`);
  }

  const { data: installment } = await installmentQuery.maybeSingle();

  if (installment) {
    const installmentStatus = isSuccess ? 'paid' : statusMapped;
    const paidDate = isSuccess
      ? settlement_time
        ? new Date(settlement_time).toISOString()
        : new Date().toISOString()
      : null;

    const { error: instErr } = await supabase
      .from('loan_installments')
      .update({
        status: installmentStatus,
        paid_date: paidDate,
        transaction_id: transaction_id || order_id,
        payment_method: payment_type || 'midtrans',
        updated_at: new Date().toISOString(),
      })
      .eq('id', installment.id);

    if (instErr) {
      console.error('Failed to update installment status from webhook:', instErr);
    }

    await recordAuditEvent({
      action: 'MIDTRANS_WEBHOOK_INSTALLMENT_PAID',
      targetType: 'loan_installment',
      targetId: installment.id,
      actor: 'system:midtrans',
      reason: `Installment payment ${installmentStatus}`,
      metadata: {
        order_id,
        transaction_id,
        status: installmentStatus,
        payment_type,
      },
    });

    return { type: 'installment', id: installment.id, status: installmentStatus };
  }

  return { type: 'unmatched', order_id, status: transaction_status };
};

