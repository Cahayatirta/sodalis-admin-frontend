import app from './app.js';
import { env } from './config/env.js';

const PORT = Number(process.env.PORT) || env.port || 8000;
const HOST = process.env.HOST || env.host || '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log('='.repeat(65));
  console.log(` SODALIS MICRO-FINANCE — ADMIN UNDERWRITING TERMINAL BACKEND`);
  console.log('='.repeat(65));
  console.log(` Server running on        : http://${HOST}:${PORT}`);
  console.log(` Environment              : ${env.nodeEnv}`);
  console.log(` Frontend URL             : ${env.frontendUrl}`);
  console.log(` Health Check Endpoint    : http://${HOST}:${PORT}/api/v1/health`);
  console.log(` TOTP Setup Endpoint      : http://${HOST}:${PORT}/api/v1/auth/totp-setup`);
  console.log(` KYC Static Uploads       : http://${HOST}:${PORT}/uploads/kyc/`);
  console.log('='.repeat(65));
});
