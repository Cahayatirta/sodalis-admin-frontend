import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config();

const adminEmail = process.env.ADMIN_EMAIL || 'admin@sodalis.id';
const serviceName = 'Sodalis Micro-Finance Admin';
const secret = authenticator.generateSecret();
const otpauth = authenticator.keyuri(adminEmail, serviceName, secret);

console.log('================================================================');
console.log('  Sodalis Micro-Finance — Admin Underwriting Terminal');
console.log('  TOTP 2FA Secret Generator');
console.log('================================================================\n');

console.log(`Admin Email: ${adminEmail}`);
console.log(`New Secret : ${secret}\n`);
console.log('Add or update this line in your .env file:');
console.log(`ADMIN_TOTP_SECRET=${secret}\n`);

try {
  const terminalQR = await QRCode.toString(otpauth, { type: 'terminal', small: true });
  console.log('Scan this QR code in Google Authenticator / Authy:\n');
  console.log(terminalQR);
  
  const dataUrl = await QRCode.toDataURL(otpauth);
  console.log('QR Code Data URL (for browser preview):');
  console.log(dataUrl);
} catch (error) {
  console.error('Failed to generate visual QR Code:', error.message);
  console.log(`Manual Key URI: ${otpauth}`);
}

