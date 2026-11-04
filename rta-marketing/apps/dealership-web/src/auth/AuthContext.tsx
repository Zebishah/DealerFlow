import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, setCsrfToken } from "../lib/api";
import { startSession } from "./start-session";
import type { SessionUser } from "../types/domain";

interface AuthValue {
  user: SessionUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<SessionUser>;
  demoLogin(role?: "recruiter" | "employee" | "virtual_assistant"): Promise<SessionUser>;
  logout(): Promise<void>;
  refresh(): Promise<SessionUser>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const principalRef = useRef<string | null>(null);
  const authVersion = useRef(0);

  useEffect(() => {
    const principal = user ? `${user.id}:${user.workspaceId ?? "platform"}` : null;
    if (principalRef.current !== null && principalRef.current !== principal) {
      queryClient.clear();
    }
    principalRef.current = principal;
  }, [queryClient, user]);

  useEffect(() => {
    let active = true;
    const version = authVersion.current;
    api<{ data: { user: SessionUser; csrfToken: string } }>("/auth/session")
      .then((result) => { if (active && version === authVersion.current) { setCsrfToken(result.data.csrfToken); setUser(result.data.user); } })
      .catch(() => { if (active && version === authVersion.current) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    async login(email, password) {
      authVersion.current += 1;
      const session = await startSession("/auth/login", { email, password });
      queryClient.clear();
      setCsrfToken(session.csrfToken);
      setUser(session.user);
      setLoading(false);
      return session.user;
    },
    async demoLogin(role = "recruiter") {
      authVersion.current += 1;
      const session = await startSession("/auth/demo-login", { role });
      queryClient.clear();
      setCsrfToken(session.csrfToken);
      setUser(session.user);
      setLoading(false);
      return session.user;
    },
    async refresh() {
      const version = authVersion.current;
      const result = await api<{ data: { user: SessionUser; csrfToken: string } }>("/auth/session");
      if (version === authVersion.current) {
        setCsrfToken(result.data.csrfToken);
        setUser(result.data.user);
      }
      return result.data.user;
    },
    async logout() {
      authVersion.current += 1;
      try {
        await api<void>("/auth/logout", { method: "POST" });
      } catch (error) {
        // An expired session is already signed out on the server.
        if (!(error instanceof ApiError && error.status === 401 && error.code === "AUTH_REQUIRED")) throw error;
      }
      await queryClient.cancelQueries();
      queryClient.clear();
      setCsrfToken(null);
      setUser(null);
      setLoading(false);
    },
  }), [loading, queryClient, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
