# Sodalis Micro-Finance — Admin Front-End
## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` to the backend API base URL supplied by your backend teammate.

## Build

```bash
npm run build
```

## Backend integration contract

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/admin/login` | Admin authentication |
| GET | `/admin/me` | Current admin session |
| GET | `/admin/dashboard` | KPI cards, chart series, recent users |
| GET | `/admin/users` | User registration list |
| GET | `/admin/users/:id` | User details |
| PATCH | `/admin/users/:id/verification` | Approve/reject KYC |
| GET | `/admin/loans` | Loan application list |
| GET | `/admin/loans/:id` | Loan details |
| PATCH | `/admin/loans/:id/status` | Update loan status |
| GET | `/admin/audit-logs` | Audit log list |

