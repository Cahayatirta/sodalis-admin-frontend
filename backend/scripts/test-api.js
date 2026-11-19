import app from '../src/app.js';
import { env } from '../src/config/env.js';
import crypto from 'crypto';

const TEST_PORT = 8001;

const runTests = async () => {
  const server = app.listen(TEST_PORT, '127.0.0.1', () => {
    console.log(`Test server running on http://127.0.0.1:${TEST_PORT}`);
  });
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

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
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === 'healthy', 'GET /api/v1/health');

    // 2. TOTP Setup
    const totpRes = await fetch(`${baseUrl}/api/v1/auth/totp-setup`);
    const totpData = await totpRes.json();
    assert(
      totpRes.status === 200 && totpData.data?.qrCodeUrl?.startsWith('data:image/png;base64,'),
      'GET /api/v1/auth/totp-setup'
    );

    // 3. Login Failed (Wrong password)
    const failLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: env.admin.username,
        password: 'WrongPassword123',
        totpCode: '000000',
      }),
    });
    assert(failLoginRes.status === 401, 'POST /api/v1/auth/login - Reject invalid credentials');

    // 4. Login Success with Dev Bypass 000000
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: env.admin.username,
        password: env.admin.password,
        totpCode: '000000',
      }),
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.token;
    assert(loginRes.status === 200 && !!token, 'POST /api/v1/auth/login - Admin Login + Dev TOTP Bypass');

    // 5. Auth Me with Token
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.data?.email === env.admin.email, 'GET /api/v1/auth/me');

    // 6. Midtrans Webhook with Signature Verification
    const orderId = 'TEST_LOAN_' + Date.now();
    const statusCode = '200';
    const grossAmount = '5000000.00';
    const serverKey = env.midtrans.serverKey;
    const signature = crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest('hex');

    const webhookRes = await fetch(`${baseUrl}/api/v1/webhooks/midtrans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'settlement',
        fraud_status: 'accept',
        payment_type: 'bank_transfer',
        transaction_id: 'TRX_' + Date.now(),
      }),
    });
    const webhookData = await webhookRes.json();
    assert(webhookRes.status === 200 && webhookData.success, 'POST /api/v1/webhooks/midtrans');

    // 7. Audit Logs Endpoint
    const auditRes = await fetch(`${baseUrl}/api/v1/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200 && auditData.data?.items !== undefined, 'GET /api/v1/audit-logs');

    // 8. Report Export Excel
    const xlsxRes = await fetch(`${baseUrl}/api/v1/reports/export?module=audit_logs&format=xlsx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(
      xlsxRes.status === 200 &&
        xlsxRes.headers.get('content-type')?.includes('spreadsheetml'),
      'GET /api/v1/reports/export (xlsx)'
    );

    // 9. Report Export PDF
    const pdfRes = await fetch(`${baseUrl}/api/v1/reports/export?module=audit_logs&format=pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(
      pdfRes.status === 200 &&
        pdfRes.headers.get('content-type')?.includes('application/pdf'),
      'GET /api/v1/reports/export (pdf)'
    );

    console.log(`\nTests Summary: ${passed} Passed, ${failed} Failed.`);
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
  }
};

runTests();

