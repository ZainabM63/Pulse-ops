"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12h2l3-8 4 16 4-12 3 6h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-bold tracking-wider text-fg-primary">PULSE</span>
              <span className="text-2xl font-bold tracking-wider text-amber">OPS</span>
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-fg-muted">
            Enterprise Incident Response
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded border border-border bg-surface p-5">
          {error && (
            <div className="rounded border border-critical/30 bg-critical/10 px-3 py-2 text-[11px] text-critical">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30"
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-amber px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-fg transition-colors hover:bg-amber-hover disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Access Grid"}
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-fg-muted">
          <p>Demo: sarah@acme.com / password</p>
          <Link href="/register" className="text-amber transition-colors hover:text-amber-hover">
            Register →
          </Link>
        </div>
      </div>
    </div>
  );
}
