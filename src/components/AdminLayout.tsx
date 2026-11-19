import { Bell, ChevronDown, Search } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../context/AuthContext";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/users": "User Registrations",
  "/loans": "Loan Applications Management",
  "/audit-logs": "System & Compliance Audit Logs",
};

export function AdminLayout() {
  const location = useLocation();
  const { admin } = useAuth();
  const title = titles[location.pathname] ?? "Admin";
  return <div className="app-shell">
    <Sidebar />
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-title"><span>Admin Workspace</span><h1>{title}</h1></div>
        <div className="topbar-actions">
          <label className="global-search"><Search size={16} /><input placeholder="Search workspace" aria-label="Search workspace" /></label>
          <button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button>
          <div className="admin-profile"><div className="avatar">{admin?.fullName?.slice(0, 1).toUpperCase() ?? "A"}</div><div><b>{admin?.fullName ?? "Administrator"}</b><span>{admin?.role ?? "Admin"}</span></div><ChevronDown size={15} /></div>
        </div>
      </header>
      <div className="page-content"><Outlet /></div>
      <footer className="footer">© {new Date().getFullYear()} Sodalis Micro-Finance <span>Admin Operations</span></footer>
    </main>
  </div>;
}
