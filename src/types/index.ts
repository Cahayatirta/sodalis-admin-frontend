export type ApiList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export type DashboardStats = {
  totalDisbursedCapital: number;
  pendingActions: number;
  pendingKyc: number;
  pendingUnderwriting: number;
  activeCapitalLiquidity: number;
  disbursementSeries: Array<{ label: string; disbursed: number; repayments: number }>;
  recentUsers: UserRegistration[];
};

export type UserRegistration = {
  id: string;
  fullName: string;
  email: string;
  registeredAt: string;
  role: string;
  verificationStatus: "pending" | "verified" | "rejected";
  accountStatus: "active" | "pending" | "suspended";
};

export type LoanApplication = {
  id: string;
  applicantName: string;
  studentId?: string;
  requestedAmount: number;
  purpose: string;
  submittedAt: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "disbursed";
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  resource: string;
  ipAddress?: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
};

export type DashboardResponse = DashboardStats;
