"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { LayoutDashboard, AlertTriangle, Box, Users, LogOut, ChevronDown } from "lucide-react";
import type { PaginatedResponse, Incident } from "@/types";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/services", label: "Services", icon: Box },
  { href: "/teams", label: "Teams", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  useEffect(() => {
    api.get<PaginatedResponse<Incident>>("/incidents?per_page=1")
      .then((res) => setActiveCount(res.total))
      .catch(() => {});
  }, []);

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-surface">
      {/* Workspace Selector */}
      <div className="px-3 py-3">
        <button
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="flex w-full items-center gap-2 rounded border border-border bg-card px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary"
        >
          <span className="animate-pulse-glow inline-block h-1.5 w-1.5 rounded-full bg-healthy" />
          <span className="flex-1 text-left truncate">
            {user?.company?.name || "Loading..."}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
        {workspaceOpen && (
          <div className="mt-1 rounded border border-border bg-card shadow-lg shadow-black/20">
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-fg-muted">Switch Workspace</p>
              <div className="mt-2 space-y-1">
                <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] text-fg-primary bg-hover-row">
                  <span className="h-1.5 w-1.5 rounded-full bg-healthy" />
                  {user?.company?.name || "Current"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs transition-colors ${
                active
                  ? "border-l-2 border-amber bg-amber/5 text-amber"
                  : "text-fg-muted hover:bg-hover-row hover:text-fg-primary"
              }`}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/incidents" && activeCount !== null && activeCount > 0 && (
                <span className="rounded bg-critical/10 px-1.5 py-0.5 text-[9px] font-medium text-critical">
                  {activeCount} active
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber/10 text-[10px] font-bold text-amber">
              {user?.name?.charAt(0) || "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-fg-primary">{user?.name}</p>
              <p className="truncate text-[9px] uppercase tracking-wider text-fg-muted">{user?.role}</p>
            </div>
          </div>
          <button onClick={logout} className="rounded p-1 text-fg-muted transition-colors hover:text-critical" title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
