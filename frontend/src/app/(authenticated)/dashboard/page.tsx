"use client";

import { useDashboardData } from "@/hooks/useDashboardData";
import { useWebSocketStatus, type WebSocketStatus } from "@/hooks/useWebSocketStatus";
import { ServiceHealthGrid } from "@/components/dashboard/ServiceHealthGrid";
import { LiveTerminal } from "@/components/dashboard/LiveTerminal";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { AlertTriangle, Shield, AlertOctagon, Activity, Radio } from "lucide-react";

const WS_LABELS: Record<WebSocketStatus, { text: string; dot: string; pulse: boolean }> = {
  online: { text: "REVERB WEBSOCKET BUS: ONLINE", dot: "bg-emerald-500", pulse: true },
  connecting: { text: "REVERB WEBSOCKET BUS: CONNECTING", dot: "bg-amber-400", pulse: true },
  offline: { text: "REVERB WEBSOCKET BUS: OFFLINE", dot: "bg-rose-500", pulse: false },
  polling: { text: "REALTIME: POLLING FALLBACK", dot: "bg-slate-400", pulse: false },
};

export default function DashboardPage() {
  const { stats, incidents } = useDashboardData();
  const wsStatus = useWebSocketStatus();
  const ws = WS_LABELS[wsStatus];

  return (
    <div className="p-4 sm:p-6 bg-canvas min-h-full text-fg-primary font-sans space-y-6">
      {/* HUD Mission Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h1 className="text-sm font-extrabold uppercase tracking-widest text-fg-primary">
              PULSE // OPS Mission Control Center
            </h1>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            Real-time infrastructure telemetry broadcast, SLA metrics, and incident triage matrix.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-fg-muted bg-surface px-3 py-1.5 rounded-lg border border-border">
          <Radio className={`h-3.5 w-3.5 text-fg-muted ${ws.pulse ? "animate-pulse" : ""}`} />
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${ws.dot} ${ws.pulse ? "animate-pulse" : ""}`} />
            {ws.text}
          </span>
        </div>
      </div>

      {/* Cyber Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface/80 backdrop-blur-md p-4 shadow-xl backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-mono uppercase text-fg-muted">Active Incidents</span>
            <span className="text-2xl font-extrabold font-mono text-fg-primary mt-1 block">
              {stats?.active_incidents ?? "0"}
            </span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-critical/30 bg-critical-bg p-4 shadow-xl backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-mono uppercase text-critical">Critical P0 Outages</span>
            <span className="text-2xl font-extrabold font-mono text-critical mt-1 block">
              {stats?.critical_count ?? "0"}
            </span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-500/40 text-critical">
            <AlertOctagon className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-amber/30 bg-amber/5 p-4 shadow-xl backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-mono uppercase text-amber">Major P1 Incidents</span>
            <span className="text-2xl font-extrabold font-mono text-amber mt-1 block">
              {stats?.major_count ?? "0"}
            </span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber">
            <Shield className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-healthy/30 bg-healthy/5 p-4 shadow-xl backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-mono uppercase text-healthy">Services Healthy</span>
            <span className="text-2xl font-extrabold font-mono text-healthy mt-1 block">
              {stats ? `${stats.services_total - stats.services_degraded}/${stats.services_total}` : "—"}
            </span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-healthy">
            <Activity className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Services Health Matrix */}
      <ServiceHealthGrid />

      {/* Live Cyber Command Terminal */}
      <LiveTerminal />

      {/* Remediation Agent Panel */}
      <div className="mt-6">
        <AgentPanel incidents={incidents} />
      </div>
    </div>
  );
}
