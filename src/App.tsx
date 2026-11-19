import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/AdminLayout";
import { AdminLogin } from "./pages/AdminLogin";
import { Dashboard } from "./pages/Dashboard";
import { UserRegistrations } from "./pages/UserRegistrations";
import { LoanApplications } from "./pages/LoanApplications";
import { AuditLogs } from "./pages/AuditLogs";

export default function App() {
  return <AuthProvider><Routes>
    <Route path="/login" element={<AdminLogin/>}/>
    <Route element={<ProtectedRoute/>}><Route element={<AdminLayout/>}>
      <Route index element={<Dashboard/>}/>
      <Route path="users" element={<UserRegistrations/>}/>
      <Route path="loans" element={<LoanApplications/>}/>
      <Route path="audit-logs" element={<AuditLogs/>}/>
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></AuthProvider>;
}
