import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail, KeyRound, ShieldCheck } from "lucide-react";
import { Brand } from "../components/Brand";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AdminLogin() {
  const { admin, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (admin) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await signIn(email, password, totpCode); navigate("/", { replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : "Login gagal. Silakan coba kembali."); }
    finally { setBusy(false); }
  }

  return <div className="login-page">
    <header className="login-topbar"><Brand variant="login" /><span>Admin Underwriting Terminal</span></header>
    <main className="login-form-side"><form className="login-card" onSubmit={submit}>
      <div className="login-icon"><LockKeyhole size={22}/></div>
      <h2>Admin Sign In</h2>
      <p>Enter your administrative credentials to continue.</p>
      <label className="field-label">Username or Admin ID</label>
      <div className="input-with-icon"><Mail size={17}/><input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. admin or username@sodalis.finance" required autoComplete="username"/></div>
      <label className="field-label">Password</label>
      <div className="input-with-icon"><KeyRound size={17}/><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password"/></div>
      <label className="field-label">Authenticator code (6 digits)</label>
      <div className="input-with-icon"><ShieldCheck size={17}/><input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ""))} placeholder="Enter 6-digit TOTP code" required autoComplete="one-time-code"/></div>
      <div className="login-options"><label><input type="checkbox" /> Remember this device</label><span>ⓘ IT Support</span></div>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button login-submit" disabled={busy}><LockKeyhole size={16}/>{busy ? "Signing in..." : "Sign In"}</button>
      <div className="login-security"><ShieldCheck size={14}/> End-to-end encrypted administrative session</div>
    </form></main>
  </div>;
}
