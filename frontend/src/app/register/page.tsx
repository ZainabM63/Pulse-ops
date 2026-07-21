"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
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
    if (password !== passwordConfirmation) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password, passwordConfirmation);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
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
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded border border-border bg-surface p-5">
          {error && (
            <div className="rounded border border-critical/30 bg-critical/10 px-3 py-2 text-[11px] text-critical">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30"
              placeholder="Your full name"
              required
            />
          </div>

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
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Confirm Password</label>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30"
              placeholder="Repeat your password"
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-amber px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-fg transition-colors hover:bg-amber-hover disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-fg-muted">
          <Link href="/login" className="text-amber transition-colors hover:text-amber-hover">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
