import { useEffect, useState } from "react";
import { Search, Eye } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable, type Column } from "../components/DataTable";
import { Pagination } from "../components/Pagination";
import { LoadingState, EmptyState, ErrorState } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { adminService } from "../services/adminService";
import type { ApiList, LoanApplication } from "../types";

const money=(n:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
export function LoanApplications() {
  const [result,setResult]=useState<ApiList<LoanApplication>|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const [page,setPage]=useState(1);const [search,setSearch]=useState("");const [status,setStatus]=useState("");
  const [selected,setSelected]=useState<LoanApplication|null>(null);const [busy,setBusy]=useState(false);
  async function load(){setLoading(true);setError("");const p=new URLSearchParams({page:String(page),pageSize:"10"});if(search.trim())p.set("search",search.trim());if(status)p.set("status",status);try{setResult(await adminService.loans(p));}catch(e){setError(e instanceof Error?e.message:"Gagal memuat pengajuan pinjaman.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[page,status]);
  async function update(next:"approved"|"rejected"|"under_review"){if(!selected)return;setBusy(true);try{await adminService.updateLoanStatus(selected.id,next);setSelected(null);await load();}catch(e){setError(e instanceof Error?e.message:"Status pinjaman gagal diperbarui.");}finally{setBusy(false);}}
  const columns:Column<LoanApplication>[]=[
    {header:"APPLICATION ID",render:r=><b className="mono">{r.id}</b>},
    {header:"APPLICANT",render:r=><div className="person-cell"><div className="mini-avatar">{r.applicantName.slice(0,1).toUpperCase()}</div><div><b>{r.applicantName}</b><span>{r.studentId??"Student applicant"}</span></div></div>},
    {header:"REQUESTED AMOUNT",render:r=><b>{money(r.requestedAmount)}</b>},
    {header:"PURPOSE",render:r=><span className="truncate-cell">{r.purpose}</span>},
    {header:"SUBMITTED",render:r=>new Date(r.submittedAt).toLocaleDateString("id-ID")},
    {header:"STATUS",render:r=><StatusBadge status={r.status}/>},
    {header:"DETAIL",render:r=><button className="view-button" onClick={()=>setSelected(r)}><Eye size={15}/> View</button>},
  ];
  return <><PageHeader title="Loan applications" description="Review student financing requests and manage underwriting decisions."/>
    <section className="panel"><div className="toolbar"><label className="search-field"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void load()} placeholder="Search applicant or application ID"/></label>
      <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}}><option value="">All application statuses</option>{["pending","under_review","approved","rejected","disbursed"].map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}</select><button className="secondary-button" onClick={()=>void load()}>Search</button></div>
      {loading?<LoadingState/>:error?<ErrorState message={error} onRetry={load}/>:result?.items.length?<><DataTable rows={result.items} columns={columns}/><Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage}/></>:<EmptyState label="Belum ada pengajuan pinjaman yang sesuai."/>}
    </section>
    {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">APPLICATION DETAILS</span><h3>{selected.id}</h3></div><button className="close-button" onClick={()=>setSelected(null)}>×</button></div>
      <div className="detail-grid"><div><span>Applicant</span><b>{selected.applicantName}</b></div><div><span>Student ID</span><b>{selected.studentId??"—"}</b></div><div><span>Requested amount</span><b>{money(selected.requestedAmount)}</b></div><div><span>Submitted</span><b>{new Date(selected.submittedAt).toLocaleString("id-ID")}</b></div><div className="detail-wide"><span>Purpose</span><b>{selected.purpose}</b></div><div><span>Current status</span><StatusBadge status={selected.status}/></div></div>
      {selected.status==="pending"||selected.status==="under_review"?<div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={()=>void update("under_review")}>Mark under review</button><button className="danger-button" disabled={busy} onClick={()=>void update("rejected")}>Reject</button><button className="primary-button" disabled={busy} onClick={()=>void update("approved")}>Approve application</button></div>:null}
    </div></div>}
  </>;
}
