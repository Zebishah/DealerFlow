import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, setCsrfToken } from "../lib/api";
import type { SessionUser } from "../types/domain";

interface AuthValue {
  user: SessionUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<SessionUser>;
  demoLogin(): Promise<SessionUser>;
  logout(): Promise<void>;
  refresh(): Promise<SessionUser>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const principalRef = useRef<string | null>(null);

  useEffect(() => {
    const principal = user ? `${user.id}:${user.workspaceId ?? "platform"}` : null;
    if (principalRef.current !== null && principalRef.current !== principal) {
      queryClient.clear();
    }
    principalRef.current = principal;
  }, [queryClient, user]);

  useEffect(() => {
    let active = true;
    api<{ data: { user: SessionUser; csrfToken: string } }>("/auth/session")
      .then((result) => { if (active) { setCsrfToken(result.data.csrfToken); setUser(result.data.user); } })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    async login(email, password) {
      const result = await api<{ data: { user: SessionUser; csrfToken: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      queryClient.clear();
      setCsrfToken(result.data.csrfToken);
      setUser(result.data.user);
      return result.data.user;
    },
    async demoLogin() {
      const result = await api<{ data: { user: SessionUser; csrfToken: string } }>("/auth/demo-login", { method: "POST" });
      queryClient.clear();
      setCsrfToken(result.data.csrfToken);
      setUser(result.data.user);
      return result.data.user;
    },
    async refresh() {
      const result = await api<{ data: { user: SessionUser; csrfToken: string } }>("/auth/session");
      setCsrfToken(result.data.csrfToken);
      setUser(result.data.user);
      return result.data.user;
    },
    async logout() {
      await api<void>("/auth/logout", { method: "POST" });
      queryClient.clear();
      setCsrfToken(null);
      setUser(null);
    },
  }), [loading, queryClient, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
