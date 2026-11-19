import { AlertCircle, LoaderCircle, Inbox } from "lucide-react";

export function LoadingState({ label = "Memuat data..." }: { label?: string }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}
export function EmptyState({ label = "Belum ada data untuk ditampilkan." }: { label?: string }) {
  return <div className="state-panel"><Inbox size={23} /><span>{label}</span></div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="state-panel error-state"><AlertCircle size={22} /><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Coba lagi</button>}</div>;
}
