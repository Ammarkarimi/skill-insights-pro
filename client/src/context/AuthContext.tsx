import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, CREDITS_EVENT, Pricing, UNAUTHORIZED_EVENT, User } from "@/lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  pricing: Pricing | null;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  cost: (action: string) => number;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<Pricing | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<User>("/api/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      refresh(),
      api
        .get<Pricing>("/api/billing/packs")
        .then((r) => setPricing(r.data))
        .catch(() => setPricing(null)),
    ]).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const onCredits = (e: Event) => {
      const credits = (e as CustomEvent<number>).detail;
      if (Number.isFinite(credits)) setUser((u) => (u ? { ...u, credits } : u));
    };
    const onUnauthorized = () => setUser(null);
    window.addEventListener(CREDITS_EVENT, onCredits);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener(CREDITS_EVENT, onCredits);
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<User>("/api/auth/login", { email, password });
    setUser(data);
    return data;
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { data } = await api.post<User>("/api/auth/register", { email, password, name });
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout").catch(() => undefined);
    setUser(null);
  }, []);

  const cost = useCallback((action: string) => pricing?.costs[action] ?? 0, [pricing]);

  const value = useMemo(
    () => ({ user, loading, pricing, login, register, logout, refresh, cost }),
    [user, loading, pricing, login, register, logout, refresh, cost],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
