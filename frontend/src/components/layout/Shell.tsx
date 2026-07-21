"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { ChevronDown, LogOut, Sun, Moon, Monitor, Zap, Clock, Users } from "lucide-react";
import type { PaginatedResponse, Incident, Environment } from "@/types";

interface DashboardData {
  active_incidents: number;
  critical_count: number;
  major_count: number;
}

const ENVIRONMENTS: { name: Environment; label: string; color: string }[] = [
  { name: "prod", label: "PROD", color: "bg-healthy text-white" },
  { name: "staging", label: "STAGING", color: "bg-amber text-black" },
  { name: "dev", label: "DEV", color: "bg-fg-muted text-white" },
];

export default function Shell() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [env, setEnv] = useState<Environment>("prod");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [mttr, setMttr] = useState("—");
  const [mtta] = useState("1m 24s");
  const [shiftRemaining, setShiftRemaining] = useState("04h 12m");
  const [resolved, setResolved] = useState(0);

  useEffect(() => {
    api.get<DashboardData>("/dashboard").then(setDashboard).catch(() => {});
    api.get<PaginatedResponse<Incident>>("/incidents?per_page=50").then((res) => {
      setResolved(res.total);
      const resolvedIncidents = res.data.filter((i) => i.status === "resolved" && i.resolved_at);
      if (resolvedIncidents.length > 0) {
        const totalMin = resolvedIncidents.reduce((acc, i) => {
          return acc + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime()) / 60000;
        }, 0);
        const avg = totalMin / resolvedIncidents.length;
        const m = Math.floor(avg);
        const s = Math.round((avg - m) * 60);
        setMttr(`${m}m ${String(s).padStart(2, "0")}s`);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const shiftStart = new Date(now);
      shiftStart.setHours(8, 0, 0, 0);
      if (now.getHours() < 8) shiftStart.setDate(shiftStart.getDate() - 1);
      const shiftEnd = new Date(shiftStart.getTime() + 12 * 3600000);
      const diff = Math.max(0, shiftEnd.getTime() - now.getTime());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setShiftRemaining(`${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`);
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) setWorkspaceOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeCount = dashboard?.active_incidents ?? 0;
  const critCount = dashboard?.critical_count ?? 0;
  const currentEnv = ENVIRONMENTS.find((e) => e.name === env)!;

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-surface px-3 gap-3">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber/10">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12h2l3-8 4 16 4-12 3 6h4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm font-bold tracking-wider text-fg-primary">PULSE</span>
          <span className="text-sm font-bold tracking-wider text-amber">OPS</span>
        </div>
        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${currentEnv.color}`}>
          {currentEnv.label}
        </span>
      </div>

      <div className="h-5 w-px bg-border" />

      {/* Metrics */}
      <div className="flex items-center gap-3 text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-wider text-fg-muted">Active:</span>
          <span className="font-bold text-fg-primary">{activeCount}</span>
          {critCount > 0 && (
            <span className="text-critical">({critCount} crit)</span>
          )}
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-wider text-fg-muted">MTTA:</span>
          <span className="font-bold text-healthy">{mtta}</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-wider text-fg-muted">MTTR:</span>
          <span className="font-bold text-healthy">{mttr}</span>
        </div>
      </div>

      <div className="h-5 w-px bg-border" />

      {/* On-Call */}
      <div className="flex items-center gap-2 shrink-0 rounded border border-border bg-card px-2.5 py-1">
        <Users className="h-3 w-3 text-amber" />
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-glow" />
          <span className="text-[10px] font-medium text-fg-primary">Sarah Chen</span>
          <span className="text-[9px] uppercase text-amber">Primary</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-fg-muted">Alex R.</span>
          <span className="text-[9px] uppercase text-fg-muted">Backup</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-fg-muted" />
          <span className="font-mono text-[10px] text-healthy">{shiftRemaining}</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Theme Switcher */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
        className="flex h-7 w-7 items-center justify-center rounded border border-border bg-card text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary"
        title={`Theme: ${theme}`}
      >
        <ThemeIcon className="h-3.5 w-3.5" />
      </button>

      {/* Workspace */}
      <div className="relative" ref={workspaceRef}>
        <button
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[10px] uppercase tracking-wider text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary"
        >
          <Zap className="h-3 w-3 text-amber" />
          <span>Workspace</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {workspaceOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded border border-border bg-card shadow-lg shadow-black/20">
            <div className="border-b border-border px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-fg-muted">Active API Key</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-glow" />
                <span className="font-mono text-[11px] text-healthy">X-PulseOps-Key Active</span>
              </div>
            </div>
            <div className="px-3 py-2">
              <p className="text-[10px] text-fg-muted">Company</p>
              <p className="text-xs text-fg-primary">{user?.company?.name || "—"}</p>
            </div>
          </div>
        )}
      </div>

      {/* User Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-xs transition-colors hover:border-amber/40"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber/20 text-[10px] font-bold text-amber">
            {user?.name?.charAt(0) || "?"}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-[11px] font-medium text-fg-primary leading-tight">{user?.name}</p>
            <p className="text-[9px] capitalize text-fg-muted leading-tight">{user?.role}</p>
          </div>
          <ChevronDown className="h-3 w-3 text-fg-muted" />
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded border border-border bg-card shadow-lg shadow-black/20">
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-medium text-fg-primary">{user?.name}</p>
              <p className="text-[10px] text-fg-muted">{user?.email}</p>
            </div>
            <button
              onClick={() => { setDropdownOpen(false); logout(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-fg-muted transition-colors hover:bg-hover-row hover:text-critical"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
