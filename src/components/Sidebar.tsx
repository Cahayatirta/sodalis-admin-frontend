import { NavLink } from "react-router-dom";
import { Activity, LayoutDashboard, LogOut, ShieldCheck, Users, WalletCards } from "lucide-react";
import { Brand } from "./Brand";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/users", label: "User Registrations", icon: Users },
  { to: "/loans", label: "Loan Applications", icon: WalletCards },
  { to: "/audit-logs", label: "Audit Logs", icon: Activity },
];

export function Sidebar() {
  const { signOut } = useAuth();
  return <aside className="sidebar">
    <Brand />
    <div className="nav-caption">OPERATIONS NAVIGATION</div>
    <nav className="side-nav">
      {links.map(({ to, label, icon: Icon, end }) =>
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
        </NavLink>
      )}
    </nav>
    <div className="sidebar-bottom">
      <div className="security-note"><ShieldCheck size={17} /><div><b>Secure workspace</b><span>Admin access only</span></div></div>
      <button className="nav-link logout" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
    </div>
  </aside>;
}
