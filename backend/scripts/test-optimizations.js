import app from '../src/app.js';
import { env } from '../src/config/env.js';
import crypto from 'crypto';

const TEST_PORT = 8002;

const runVerification = async () => {
  const server = app.listen(TEST_PORT, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;
  console.log(`Verification server running on ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  const assert = (condition, name) => {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  };

  try {
    // 1. Login to obtain JWT
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: env.admin.username,
        password: env.admin.password,
        totpCode: '000000',
      }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;
    assert(loginRes.status === 200 && !!token, 'Admin Auth for verification');

    // 2. Test Midtrans Webhook with Non-UUID String order_id (verify no 22P02 Postgres syntax error)
    const testOrderId = 'LN-20261111-66290';
    const statusCode = '200';
    const grossAmount = '7500000.00';
    const sig = crypto
      .createHash('sha512')
      .update(`${testOrderId}${statusCode}${grossAmount}${env.midtrans.serverKey}`)
      .digest('hex');

    const webhookRes = await fetch(`${baseUrl}/api/v1/webhooks/midtrans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: testOrderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: sig,
        transaction_status: 'settlement',
        fraud_status: 'accept',
        payment_type: 'bank_transfer',
        transaction_id: 'TRX_TEST_' + Date.now(),
      }),
    });
    const webhookJson = await webhookRes.json();
    assert(
      webhookRes.status === 200 && webhookJson.success,
      'Midtrans Webhook: Non-UUID order_id (LN-20261111-66290) handles cleanly with NO 22P02 syntax error'
    );

    // 3. Test Bulk KYC with empty userIds (Early Return Guard)
    const emptyBulkKycRes = await fetch(`${baseUrl}/api/v1/users/bulk-kyc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIds: [],
        action: 'APPROVE',
      }),
    });
    const emptyBulkKycJson = await emptyBulkKycRes.json();
    assert(
      emptyBulkKycRes.status === 400 && emptyBulkKycJson.message?.includes('required'),
      'Bulk KYC: Empty userIds array intercepted by early return guard (prevents in.() error)'
    );

    // 4. Test Bulk Loans with empty loanIds (Early Return Guard)
    const emptyBulkLoansRes = await fetch(`${baseUrl}/api/v1/loans/bulk-decision`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        loanIds: [],
        action: 'APPROVE_DISBURSE',
      }),
    });
    const emptyBulkLoansJson = await emptyBulkLoansRes.json();
    assert(
      emptyBulkLoansRes.status === 400 && emptyBulkLoansJson.message?.includes('required'),
      'Bulk Loans: Empty loanIds array intercepted by early return guard (prevents in.() error)'
    );

    // 5. Test Dashboard Summary (Promise.all parallel queries)
    const dashboardRes = await fetch(`${baseUrl}/api/v1/dashboard/summary?range=30d`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dashboardJson = await dashboardRes.json();
    assert(
      dashboardRes.status === 200 &&
        dashboardJson.data?.metrics !== undefined &&
        dashboardJson.data?.velocityChart !== undefined,
      'Dashboard Summary: Parallel Promise.all() queries succeed with complete metrics'
    );

    // 6. Test Loans listing (Promise.all parallel queries)
    const loansRes = await fetch(`${baseUrl}/api/v1/loans?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const loansJson = await loansRes.json();
    assert(
      loansRes.status === 200 && loansJson.data?.kpi !== undefined,
      'Loans Listing: Parallel Promise.all() for KPI and pagination succeeds'
    );

    console.log(`\nOptimization Verification Results: ${passed} Passed, ${failed} Failed.`);
  } catch (err) {
    console.error('Optimization verification failed:', err);
    failed++;
  } finally {
    server.close();
  }
};

runVerification();

