# Sodalis Micro-Finance — Admin Underwriting Terminal (Backend API)

Production-ready, highly secure **Express.js REST API Backend** architected for the **"Sodalis Micro-Finance — Admin Underwriting Terminal"**. This backend integrates seamlessly with an **existing Supabase PostgreSQL database** without modifying any schemas, providing real-time credit underwriting, 2FA MFA administrative authentication, Midtrans Snap payment gateway integration, local KYC file uploads, and compliance reporting (Excel & PDF).

---

## 🏛️ Architecture Overview

- **Runtime & Engine**: Node.js (v18+) with native ES Modules (`"type": "module"`).
- **Web Framework**: Express.js with custom middleware pipeline, strict JSON payload size limits, and security headers.
- **Database Client**: `@supabase/supabase-js` configured with `SUPABASE_SERVICE_ROLE_KEY` to securely bypass Row Level Security (RLS) policies for administrative operations.
- **Admin Authentication**: Environment-based single-admin credentials (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`) backed by RFC 6238 TOTP Two-Factor Authentication (`otplib`, `qrcode`) and signed JWT session tokens (`jsonwebtoken`).
- **Payment & Disbursal Gateway**: `midtrans-client` (Snap Sandbox & Webhooks) for loan disbursement triggers and SHA-512 cryptographically verified callbacks.
- **Document Pipeline**: `multer` storing KYC documents locally in `./public/uploads/kyc/` and served statically at `/uploads/kyc/`.
- **Compliance & Audit**: Dual-layer immutable audit trail merging local `./logs/audit.jsonl` with real-time Supabase lifecycle events, each stamped with a deterministic SHA-256 integrity hash.
- **Report Generation**: Direct Supabase streaming exports supporting Excel (`exceljs`) and PDF (`pdfkit`).

---

## 🔒 100% Existing Supabase Schema Rule

This backend **does not** create, alter, or migrate any database tables. It interfaces directly with the 7 existing PostgreSQL tables in Supabase:

1. `users`: `id` (uuid), `email` (text), `role` (text), `full_name` (text), `is_verified` (bool), `created_at` (timestamptz), `phone` (text), `kyc_document_path` (text).
2. `borrower_profiles`: `id` (uuid), `user_id` (uuid -> users.id), `full_name` (text), `email` (text), `phone` (text), `university` (text), `major` (text), `nim` (text), `semester` (int4), `gpa` (numeric), `sks` (int4), `attendance_rate` (numeric), `ai_trust_score` (int4), `score_tier` (text), `credit_limit` (int8), `used_limit` (int8), `is_verified` (bool), `bank_account` (text), `created_at` (timestamptz), `updated_at` (timestamptz).
3. `investor_profiles`: `id` (uuid), `user_id` (uuid -> users.id), `full_name` (text), `email` (text), `phone` (text), `investor_type` (text), `bank_name` (text), `bank_account` (text), `total_invested` (int8), `total_return` (int8), `is_verified` (bool), `created_at` (timestamptz), `updated_at` (timestamptz).
4. `loans`: `id` (uuid), `borrower_id` (uuid -> borrower_profiles.id), `loan_code` (text), `borrower_name` (text), `major` (text), `amount` (int8), `tenor_months` (int4), `monthly_interest_rate` (numeric), `interest_amount` (int8), `total_amount` (int8), `monthly_installment` (int8), `purpose` (text), `home_ownership` (text), `parent_job` (text), `residence_type` (text), `previous_loan` (bool), `working_student` (bool), `payment_history_months` (int4), `parental_income` (int8), `sks` (int4), `attendance` (numeric), `gpa` (numeric), `dependents` (int4), `ai_score` (int4), `risk_tier` (text), `status` (text), `funded_amount` (int8), `repaid_amount` (int8), `repaid_installments` (int4), `created_at` (timestamptz), `updated_at` (timestamptz).
5. `loan_installments`: `id` (uuid), `loan_id` (uuid -> loans.id), `installment_number` (int4), `total_installments` (int4), `amount` (int8), `principal_amount` (int8), `service_fee` (int8), `due_date` (date), `paid_date` (timestamptz), `status` (text), `note` (text), `tag` (text), `payment_method` (text), `va_number` (text), `transaction_id` (text), `created_at` (timestamptz), `updated_at` (timestamptz).
6. `investments`: `id` (uuid), `investor_id` (uuid), `loan_id` (uuid), `investment_code` (text), `amount` (int8), `investor_share` (numeric), `annual_yield_rate` (numeric), `status` (text), `returned_amount` (int8), `created_at` (timestamptz), `updated_at` (timestamptz).
7. `investor_returns`: `id` (uuid), `investment_id` (uuid), `investor_id` (uuid), `loan_id` (uuid), `installment_id` (uuid), `installment_number` (int4), `amount` (int8), `principal_amount` (int8), `yield_amount` (int8), `status` (text), `received_at` (timestamptz), `created_at` (timestamptz).

---

## 📂 Project Directory Structure

```
.
├── .env.example                  # Environment template
├── .env                          # Local environment variables
├── package.json                  # Dependencies & execution scripts
├── README.md                     # Architecture documentation
├── docs/
│   └── API_Contract_Sodalis.txt  # Comprehensive plain-text API Contract for frontend
├── postman/
│   ├── Sodalis_Local.postman_environment.json # Postman Environment (port 8000)
│   └── Sodalis_Admin_API.postman_collection.json # Automated Postman test collection
├── logs/
│   └── audit.jsonl               # Immutable audit trail file
├── public/
│   └── uploads/
│       └── kyc/                  # Local KYC files uploaded via Multer
├── scripts/
│   ├── generate-totp.js          # CLI helper generating TOTP secret & QR code
│   └── test-api.js               # Comprehensive test suite
└── src/
    ├── app.js                    # Express app initialization & route assembly
    ├── index.js                  # Server entry point
    ├── config/
    │   ├── env.js                # Type-safe environment variables loader
    │   ├── midtrans.js           # Midtrans Snap & CoreApi client configuration
    │   └── supabase.js           # Supabase client using Service Role Key
    ├── middleware/
    │   ├── auth.js               # JWT bearer token verification
    │   ├── errorHandler.js       # Centralized HTTP & Multer error handler
    │   └── upload.js             # Multer diskStorage with mime-type filter
    ├── routes/
    │   ├── authRoutes.js         # TOTP setup, 2FA login, profile
    │   ├── dashboardRoutes.js    # Liquidity, velocity, queue KPIs
    │   ├── userRoutes.js         # KYC review, document attachment, bulk actions
    │   ├── loanRoutes.js         # Credit underwriting, decisions & Midtrans trigger
    │   ├── auditRoutes.js        # Immutable compliance audit log feed
    │   ├── reportRoutes.js       # Excel & PDF streaming exports
    │   └── webhookRoutes.js      # Midtrans webhook SHA-512 verification
    └── services/
        ├── auditLogger.js        # SHA-256 hash generator & append logger
        ├── midtransService.js    # Snap order generator & webhook parser
        └── reportService.js      # ExcelJS & PDFKit report styling engines
```

---

## 🚀 Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase and Midtrans credentials:
```bash
cp .env.example .env
```

| Key | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP Server port | `8000` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `FRONTEND_URL` | React Vite frontend origin | `http://localhost:5173` |
| `ADMIN_USERNAME` | Single Admin identifier | `admin` |
| `ADMIN_EMAIL` | Single Admin email address | `admin@sodalis.id` |
| `ADMIN_PASSWORD` | Single Admin password | `SodalisSecure2026!` |
| `ADMIN_TOTP_SECRET` | 16-char Base32 TOTP secret | `BIXSEKSFIUECCJK6` |
| `JWT_SECRET` | Secret key for JWT signing | `super-secret-key` |
| `JWT_EXPIRES_IN` | Token expiration duration | `24h` |
| `SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (bypasses RLS) | `ey...` |
| `MIDTRANS_SERVER_KEY` | Midtrans Snap Server Key | `SB-Mid-server-...` |
| `MIDTRANS_CLIENT_KEY` | Midtrans Client Key | `SB-Mid-client-...` |
| `MIDTRANS_IS_PRODUCTION` | Production environment flag | `false` |

### 3. Generate TOTP Secret (Google Authenticator Setup)
Run the built-in generator script to print a fresh Base32 secret and terminal QR code:
```bash
npm run generate-totp
```
1. Scan the displayed QR code with **Google Authenticator** or **Authy**.
2. Copy the printed `ADMIN_TOTP_SECRET` value into your `.env` file.

### 4. Start the Server
- **Development (with hot reload)**:
  ```bash
  npm run dev
  ```
- **Production**:
  ```bash
  npm start
  ```

---

## 📡 API Specification & Reference

### 🔐 1. Authentication & 2FA (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/auth/totp-setup` | None | Returns Base32 secret and QR Code Data URL |
| `POST` | `/api/v1/auth/login` | None | Validates `identifier`, `password`, and 6-digit `totpCode` (supports `000000` dev bypass) |
| `GET` | `/api/v1/auth/me` | Bearer | Returns the authenticated admin identity |

#### Login Request Body:
```json
{
  "identifier": "admin@sodalis.id",
  "password": "SodalisSecure2026!",
  "totpCode": "123456"
}
```

---

### 📊 2. Dashboard Analytics (`/api/v1/dashboard`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/summary` | Bearer | Underwriting KPIs (`totalDisbursedCapital`, `activeCapitalLiquidity`, `pendingActionQueue`), velocity breakdown, recent registrations |

- **Query Parameters**:
  - `range`: `7d` \| `30d` (default) \| `90d` \| `ytd`

---

### 👥 3. User Management & KYC (`/api/v1/users`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users` | Bearer | List users with pagination and search (`?role=borrower\|investor&isVerified=true\|false&search=&page=1&limit=10`) |
| `GET` | `/api/v1/users/:id` | Bearer | Fetch single user joined with `borrower_profiles` or `investor_profiles` |
| `POST` | `/api/v1/users/:id/documents` | Bearer | Multer upload for KYC document (field: `document`), updates `users.kyc_document_path` |
| `PATCH` | `/api/v1/users/:id/kyc-decision` | Bearer | Approve or reject user KYC. Updates `users.is_verified` and role profile |
| `POST` | `/api/v1/users/bulk-kyc` | Bearer | Bulk approve/reject verification for an array of `userIds` |

#### KYC Decision Body:
```json
{
  "action": "APPROVE",
  "reason": "Identity card and academic transcript verified."
}
```

---

### 💳 4. Loan Underwriting (`/api/v1/loans`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/loans` | Bearer | Filtered loans list with underwriting KPIs (`pendingUnderwriting`, `approvedForDisbursal`, `flaggedHighRisk`) |
| `GET` | `/api/v1/loans/:id` | Bearer | Loan record joined with borrower profile, installments, and investments |
| `PATCH` | `/api/v1/loans/:id/decision` | Bearer | Underwriting decision (`APPROVE_DISBURSE`, `REQUEST_DOCS`, `REJECT`). Triggers Midtrans Snap on approval |
| `POST` | `/api/v1/loans/bulk-decision` | Bearer | Bulk decision update across multiple `loanIds` |

#### Loan Decision Body:
```json
{
  "action": "APPROVE_DISBURSE",
  "reason": "Academic record and parental income validated by underwriter."
}
```

---

### 📜 5. Audit Compliance Feed (`/api/v1/audit-logs`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/audit-logs` | Bearer | Unified immutable audit log combining local `audit.jsonl` with Supabase historical events |

- Each audit log entry is accompanied by:
  - `integrityHash`: Deterministic SHA-256 string for compliance proof.
  - Overall KPIs: `approvedRegistrations`, `acceptedLoans`, `rejectedLoans`.

---

### 📥 6. Report Export (`/api/v1/reports`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/reports/export` | Bearer | Downloadable `.xlsx` (`exceljs`) or `.pdf` (`pdfkit`) stream directly from Supabase |

- **Query Parameters**:
  - `module`: `loans` \| `users` \| `audit_logs`
  - `format`: `xlsx` \| `pdf`

---

### 🔔 7. Midtrans Webhook (`/api/v1/webhooks`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/webhooks/midtrans` | Public | Midtrans HTTP notification callback with SHA-512 signature verification |

- Calculates: `SHA512(order_id + status_code + gross_amount + ServerKey)`
- Automatically transitions `loans.status` and settles `loan_installments` in Supabase.

---

## 🧪 Testing

Run the included automated integration suite:
```bash
node scripts/test-api.js
```

All 9 integration tests cover:
1. Health check verification
2. TOTP 2FA URI & QR Code generation
3. Credential rejection on invalid passwords
4. Administrative login with 2FA TOTP dev bypass
5. Protected `/api/v1/auth/me` profile resolution
6. Midtrans Webhook SHA-512 signature validation
7. Unified compliance audit log generation
8. Streaming Excel report export
9. Streaming PDF report export

---

## 📮 Postman Collection & Environment Setup

This project includes ready-to-use Postman files located in the [`postman/`](./postman/) directory:

1. **`postman/Sodalis_Local.postman_environment.json`**:
   - Pre-configured with `baseUrl`: `http://localhost:8000/api/v1`
   - Dev credentials: `admin@sodalis.id` / `000000` bypass
   - Dynamic placeholders: `jwtToken`, `sampleUserId`, `sampleLoanId`, `midtransOrderId`

2. **`postman/Sodalis_Admin_API.postman_collection.json`**:
   - Structured into 5 functional folders:
     - `1. Auth & TOTP MFA` (Health, TOTP Setup, Login, Profile)
     - `2. Operations Dashboard` (KPIs, 30d/7d/YTD summaries)
     - `3. Users & KYC Management` (List, Detail Dossier, Document upload, KYC Decisions, Bulk KYC)
     - `4. Loans & Midtrans Webhook` (List, Underwriting Dossier, Snap Disbursal Decisions, Webhook)
     - `5. Audit Logs & Report Exports` (Unified compliance logs, Excel & PDF exports)
   - Contains built-in `pm.test(...)` assertion scripts that **automatically capture and set** `jwtToken`, `sampleUserId`, and `sampleLoanId` so the entire suite runs end-to-end via **Postman Collection Runner** with 100% green assertions.

3. **`docs/API_Contract_Sodalis.txt`**:
   - Comprehensive plain-text specification for frontend React Vite developers, documenting exact request/response envelopes, field mappings, and ready-to-paste Axios client interceptors.


