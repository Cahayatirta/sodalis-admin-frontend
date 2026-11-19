import { useEffect, useState } from "react";
import { Search, Check, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable, type Column } from "../components/DataTable";
import { Pagination } from "../components/Pagination";
import { LoadingState, EmptyState, ErrorState } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { adminService } from "../services/adminService";
import type { ApiList, UserRegistration } from "../types";

export function UserRegistrations() {
  const [result,setResult] = useState<ApiList<UserRegistration> | null>(null);
  const [loading,setLoading] = useState(true); const [error,setError] = useState("");
  const [page,setPage] = useState(1); const [search,setSearch] = useState(""); const [status,setStatus] = useState("");
  const [busyId,setBusyId] = useState("");
  async function load() {
    setLoading(true);setError("");
    const params = new URLSearchParams({page:String(page),pageSize:"10"});
    if(search.trim()) params.set("search",search.trim()); if(status) params.set("verificationStatus",status);
    try { setResult(await adminService.users(params)); } catch(e) { setError(e instanceof Error?e.message:"Gagal memuat data pengguna."); } finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[page,status]);
  async function verify(id:string, next:"verified"|"rejected") {
    setBusyId(id);
    try { await adminService.verifyUser(id,next); await load(); }
    catch(e) { setError(e instanceof Error?e.message:"Aksi verifikasi gagal."); }
    finally {setBusyId("");}
  }
  const columns:Column<UserRegistration>[]=[
    {header:"USER",render:r=><div className="person-cell"><div className="mini-avatar">{r.fullName.slice(0,1).toUpperCase()}</div><div><b>{r.fullName}</b><span>{r.email}</span></div></div>},
    {header:"REGISTERED",render:r=>new Date(r.registeredAt).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"})},
    {header:"ROLE",render:r=>r.role},
    {header:"DOCUMENT VERIFICATION",render:r=><StatusBadge status={r.verificationStatus}/>},
    {header:"ACCOUNT STATUS",render:r=><StatusBadge status={r.accountStatus}/>},
    {header:"ACTION",render:r=><div className="table-actions"><button title="Approve" disabled={r.verificationStatus!=="pending"||busyId===r.id} onClick={e=>{e.stopPropagation();void verify(r.id,"verified");}}><Check size={16}/></button><button title="Reject" className="danger-action" disabled={r.verificationStatus!=="pending"||busyId===r.id} onClick={e=>{e.stopPropagation();void verify(r.id,"rejected");}}><X size={16}/></button></div>},
  ];
  return <><PageHeader title="User registrations" description="Review newly registered users and manage identity verification."/>
    <section className="panel">
      <div className="toolbar"><label className="search-field"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void load()} placeholder="Search name or email"/></label>
        <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}}><option value="">All verification statuses</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select>
        <button className="secondary-button" onClick={()=>void load()}>Search</button>
      </div>
      {loading?<LoadingState/>:error?<ErrorState message={error} onRetry={load}/>:result?.items.length?<><DataTable rows={result.items} columns={columns}/><Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage}/></>:<EmptyState label="Tidak ada data pengguna yang sesuai."/>}
    </section>
  </>;
}
