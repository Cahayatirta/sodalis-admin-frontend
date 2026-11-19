import { apiRequest } from "./api";
import { endpoints } from "./endpoints";
import type { AdminUser, ApiList, AuditLog, DashboardResponse, LoanApplication, UserRegistration } from "../types";

type BackendPage<T> = { items: T[]; pagination?: { page: number; limit: number; total: number; totalPages: number }; kpi?: Record<string, number> };
const toAdmin = (a: any): AdminUser => ({ id: a.id || a.username || a.email, fullName: a.fullName || a.username || "Administrator", email: a.email || "", role: a.role || "admin" });
const toUser = (u: any): UserRegistration => ({ id: u.id, fullName: u.full_name || u.fullName || "—", email: u.email || "", registeredAt: u.created_at || u.registeredAt || "", role: u.role || "borrower", verificationStatus: u.is_verified ? "verified" : "pending", accountStatus: u.is_verified ? "active" : "pending" });
const toLoan = (l: any): LoanApplication => ({ id: l.id, applicantName: l.borrower_name || l.applicantName || "—", studentId: l.borrower_id, requestedAmount: Number(l.amount ?? l.requestedAmount ?? 0), purpose: l.purpose || "—", submittedAt: l.created_at || l.submittedAt || "", status: l.status === "approved_disburse" ? "approved" : l.status === "docs_requested" ? "under_review" : l.status === "disbursed" ? "disbursed" : l.status || "pending" });
const toPage = <T, U>(r: BackendPage<T>, map: (v:T)=>U): ApiList<U> => ({ items: (r.items || []).map(map), total: r.pagination?.total ?? r.items?.length ?? 0, page: r.pagination?.page ?? 1, pageSize: r.pagination?.limit ?? 10 });

export const adminService = {
  async login(identifier: string, password: string, totpCode: string) {
    const result = await apiRequest<{ token: string; admin: any }>(endpoints.login, { method: "POST", body: { identifier, password, totpCode } });
    return { accessToken: result.token, admin: toAdmin(result.admin) };
  },
  async me() { return toAdmin(await apiRequest<any>(endpoints.me)); },
  async dashboard(): Promise<DashboardResponse> {
    const d = await apiRequest<any>(`${endpoints.dashboard}?range=30d`); const m = d.metrics || {};
    return { totalDisbursedCapital: Number(m.totalDisbursedCapital || 0), pendingActions: Number(m.pendingActionQueue || 0), pendingKyc: Number(m.pendingUsersCount || 0), pendingUnderwriting: Number(m.pendingLoansCount || 0), activeCapitalLiquidity: Number(m.activeCapitalLiquidity || 0), disbursementSeries: (d.velocityChart?.timeSeries || []).map((v:any)=>({ label: v.date, disbursed: Number(v.totalDisbursed || 0), repayments: 0 })), recentUsers: (d.recentRegistrations || []).map(toUser) };
  },
  async users(params: URLSearchParams) { const q = new URLSearchParams(); for (const k of ["search","page"]) if(params.has(k)) q.set(k, params.get(k)!); q.set("limit", params.get("limit") || params.get("pageSize") || "10"); if(params.has("verificationStatus")) q.set("isVerified", params.get("verificationStatus") === "verified" ? "true" : "false"); if(params.has("role")) q.set("role", params.get("role")!); return toPage(await apiRequest<BackendPage<any>>(`${endpoints.users}?${q}`), toUser); },
  async user(id: string) { return toUser(await apiRequest<any>(endpoints.user(id))); },
  async verifyUser(id: string, status: "verified"|"rejected", note?: string) { return apiRequest(endpoints.userVerification(id), { method:"PATCH", body:{ action: status === "verified" ? "APPROVE" : "REJECT", reason: note || `KYC ${status} by admin` } }); },
  async loans(params: URLSearchParams) { const q = new URLSearchParams(); for (const k of ["search","status","page"]) if(params.has(k)) q.set(k, params.get(k)!); q.set("limit", params.get("limit") || params.get("pageSize") || "10"); const r = await apiRequest<BackendPage<any>>(`${endpoints.loans}?${q}`); return toPage(r, toLoan); },
  async loan(id: string) { return toLoan(await apiRequest<any>(endpoints.loan(id))); },
  async updateLoanStatus(id: string, status: "approved"|"rejected"|"under_review", note?: string) { const action = status === "approved" ? "APPROVE_DISBURSE" : status === "rejected" ? "REJECT" : "REQUEST_DOCS"; return apiRequest(endpoints.loanStatus(id), { method:"PATCH", body:{ action, reason: note || `Loan decision: ${action}` } }); },
  async auditLogs(params: URLSearchParams) { const q = new URLSearchParams(); for(const k of ["search","page"]) if(params.has(k)) q.set(k,params.get(k)!); q.set("limit", params.get("limit") || params.get("pageSize") || "15"); const r = await apiRequest<BackendPage<any>>(`${endpoints.auditLogs}?${q}`); return toPage(r, (a):AuditLog=>({ id:a.id, actor:a.actor || "system", action:a.action || "—", resource:`${a.targetType || "event"}${a.targetId ? ` · ${a.targetId}` : ""}`, createdAt:a.timestamp || "", severity:/REJECT|FAIL|ERROR/i.test(a.action || "") ? "critical" : /REQUEST|PENDING/i.test(a.action || "") ? "warning" : "info" })); },
};
