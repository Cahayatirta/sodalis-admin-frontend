// Routes defined by Code-fix-main/docs/API_Contract_Sodalis.txt
export const endpoints = {
  login: "/auth/login",
  me: "/auth/me",
  totpSetup: "/auth/totp-setup",
  dashboard: "/dashboard/summary",
  users: "/users",
  user: (id: string) => `/users/${encodeURIComponent(id)}`,
  userVerification: (id: string) => `/users/${encodeURIComponent(id)}/kyc-decision`,
  loans: "/loans",
  loan: (id: string) => `/loans/${encodeURIComponent(id)}`,
  loanStatus: (id: string) => `/loans/${encodeURIComponent(id)}/decision`,
  auditLogs: "/audit-logs",
};
