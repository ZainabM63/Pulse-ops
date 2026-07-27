"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, setToken, clearToken, getToken } from "@/lib/api";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, password_confirmation: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
// hooks/useAuth.ts

useEffect(() => {
  setMounted(true);
  const token = getToken();
  if (token) {
    api.get<{ data: User }>("/v1/user") // <-- Add /v1
      .then((res) => setUser(res.data))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  } else {
    setLoading(false);
  }
}, []);

const login = async (email: string, password: string) => {
  // Add /v1 to login
  const res = await api.post<{ user: User; token: string }>("/v1/login", { email, password });
  setToken(res.token);
  setUser(res.user);
};

const register = async (name: string, email: string, password: string, password_confirmation: string) => {
  // Add /v1 to register
  const res = await api.post<{ user: User; token: string }>("/v1/register", {
    name, email, password, password_confirmation,
  });
  setToken(res.token);
  setUser(res.user);
};

const logout = async () => {
  await api.post("/v1/logout"); // <-- Add /v1
  clearToken();
  setUser(null);
};

  if (!mounted) return null;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
