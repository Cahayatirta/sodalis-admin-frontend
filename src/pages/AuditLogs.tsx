import { useEffect,useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable,type Column } from "../components/DataTable";
import { Pagination } from "../components/Pagination";
import { LoadingState,EmptyState,ErrorState } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { adminService } from "../services/adminService";
import type { ApiList,AuditLog } from "../types";

export function AuditLogs(){
  const [result,setResult]=useState<ApiList<AuditLog>|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const [page,setPage]=useState(1);const [search,setSearch]=useState("");const [severity,setSeverity]=useState("");
  async function load(){setLoading(true);setError("");const p=new URLSearchParams({page:String(page),pageSize:"15"});if(search.trim())p.set("search",search.trim());if(severity)p.set("severity",severity);try{setResult(await adminService.auditLogs(p));}catch(e){setError(e instanceof Error?e.message:"Gagal memuat audit logs.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[page,severity]);
  const columns:Column<AuditLog>[]=[
    {header:"TIMESTAMP",render:r=><span className="mono">{new Date(r.createdAt).toLocaleString("id-ID")}</span>},
    {header:"ACTOR",render:r=><b>{r.actor}</b>},
    {header:"ACTION",render:r=><span className="action-text">{r.action}</span>},
    {header:"RESOURCE",render:r=>r.resource},
    {header:"IP ADDRESS",render:r=><span className="mono">{r.ipAddress??"—"}</span>},
    {header:"SEVERITY",render:r=><StatusBadge status={r.severity}/>},
  ];
  return <><PageHeader title="System & compliance audit logs" description="Track administrative actions and monitor important system events."/>
    <section className="panel"><div className="toolbar"><label className="search-field"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void load()} placeholder="Search actor, action, or resource"/></label>
      <select value={severity} onChange={e=>{setPage(1);setSeverity(e.target.value);}}><option value="">All severity levels</option><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select><button className="secondary-button" onClick={()=>void load()}>Search</button></div>
      {loading?<LoadingState/>:error?<ErrorState message={error} onRetry={load}/>:result?.items.length?<><DataTable rows={result.items} columns={columns}/><Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage}/></>:<EmptyState label="Belum ada catatan audit yang sesuai."/>}
    </section>
  </>;
}
