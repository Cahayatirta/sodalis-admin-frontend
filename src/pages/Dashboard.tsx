import { useEffect, useState } from "react";
import { CircleDollarSign, Clock3, Wallet, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "../components/Feedback";
import { DataTable, type Column } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { adminService } from "../services/adminService";
import type { DashboardResponse, UserRegistration } from "../types";

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try { setData(await adminService.dashboard()); }
    catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat dashboard."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const columns: Column<UserRegistration>[] = [
    { header: "USER", render: r => <div className="person-cell"><div className="mini-avatar">{r.fullName.slice(0,1).toUpperCase()}</div><div><b>{r.fullName}</b><span>{r.email}</span></div></div> },
    { header: "ROLE", render: r => r.role },
    { header: "VERIFICATION", render: r => <StatusBadge status={r.verificationStatus}/> },
    { header: "ACCOUNT STATUS", render: r => <StatusBadge status={r.accountStatus}/> },
  ];

  return <><PageHeader title="Dashboard overview" description="Monitor platform performance and review the latest operations." action={<button className="secondary-button" onClick={load}>Refresh data</button>}/>
    {loading ? <LoadingState label="Loading dashboard metrics..."/> : error ? <ErrorState message={error} onRetry={load}/> : data ? <>
      <div className="stats-grid">
        <Stat icon={<CircleDollarSign/>} label="Total Disbursed Capital" value={money(data.totalDisbursedCapital)} note="Cumulative disbursement"/>
        <Stat icon={<Clock3/>} label="Pending Action Queue" value={data.pendingActions.toLocaleString("id-ID")} note={`${data.pendingKyc} KYC · ${data.pendingUnderwriting} underwriting`} accent="amber"/>
        <Stat icon={<Wallet/>} label="Active Capital Liquidity" value={money(data.activeCapitalLiquidity)} note="Available platform capital" accent="green"/>
      </div>
      <section className="panel chart-panel"><div className="panel-heading"><div><h3>Disbursement & capital velocity</h3><p>Platform transaction activity over time</p></div><span className="chart-legend"><i/> Disbursed <i className="legend-secondary"/> Repayments</span></div>
        {data.disbursementSeries.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.disbursementSeries} margin={{top:10,right:12,left:0,bottom:0}}><defs><linearGradient id="blueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3478e5" stopOpacity={0.2}/><stop offset="100%" stopColor="#3478e5" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf0f5" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:"#8791a3",fontSize:11}}/><YAxis axisLine={false} tickLine={false} tick={{fill:"#8791a3",fontSize:11}}/><Tooltip formatter={(v) => money(Number(v))}/><Area type="monotone" dataKey="disbursed" stroke="#3478e5" strokeWidth={2.5} fill="url(#blueFill)"/><Area type="monotone" dataKey="repayments" stroke="#31b78a" strokeWidth={2} fill="transparent"/></AreaChart></ResponsiveContainer></div> : <EmptyState label="Belum ada data grafik dari server."/>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Recently registered accounts</h3><p>Latest user registrations from the platform</p></div><span className="subtle-count"><Users size={15}/> {data.recentUsers.length} records</span></div>
        {data.recentUsers.length ? <DataTable rows={data.recentUsers} columns={columns}/> : <EmptyState label="Belum ada pendaftaran pengguna."/>}
      </section>
    </> : null}
  </>;
}

function Stat({icon,label,value,note,accent="blue"}:{icon:React.ReactNode;label:string;value:string;note:string;accent?:string}) {
  return <div className="stat-card"><div className={`stat-icon ${accent}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></div>;
}
