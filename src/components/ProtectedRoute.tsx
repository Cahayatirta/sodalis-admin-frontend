import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "./Feedback";

export function ProtectedRoute() {
  const { admin, loading } = useAuth();
  if (loading) return <LoadingState label="Memeriksa sesi admin..." />;
  return admin ? <Outlet /> : <Navigate to="/login" replace />;
}
