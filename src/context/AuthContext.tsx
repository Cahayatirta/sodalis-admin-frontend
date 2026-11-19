import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminService } from "../services/adminService";
import type { AdminUser } from "../types";

type AuthContextValue = {
  admin: AdminUser | null;
  loading: boolean;
  signIn: (identifier: string, password: string, totpCode: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionStorage.getItem("sodalis_access_token")) {
      setLoading(false);
      return;
    }
    adminService.me()
      .then(setAdmin)
      .catch(() => {
        sessionStorage.removeItem("sodalis_access_token");
        setAdmin(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    admin,
    loading,
    async signIn(identifier, password, totpCode) {
      const result = await adminService.login(identifier, password, totpCode);
      sessionStorage.setItem("sodalis_access_token", result.accessToken);
      setAdmin(result.admin);
    },
    signOut() {
      sessionStorage.removeItem("sodalis_access_token");
      setAdmin(null);
    },
  }), [admin, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth harus digunakan di dalam AuthProvider");
  return value;
}
