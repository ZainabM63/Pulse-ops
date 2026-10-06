"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import type { TelemetryLog } from "@/types";
import { Terminal, Activity, Zap } from "lucide-react";

interface Props {
  incidentId?: number;
  limit?: number;
}

const levelConfig = {
  info: { color: "text-info", prefix: "[INF]", bg: "bg-info-bg border-info/30" },
  warn: { color: "text-amber", prefix: "[WRN]", bg: "bg-amber/10 border-amber/30" },
  error: { color: "text-critical font-bold", prefix: "[ERR]", bg: "bg-critical-bg border-critical/30" },
  cmd: { color: "text-healthy font-mono", prefix: "[CMD]", bg: "bg-healthy/10 border-healthy/30" },
};

export function TelemetryStream({ incidentId, limit = 50 }: Props) {
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());

  const fetchLogs = useCallback(async () => {
    try {
      const url = incidentId
        ? `/telemetry?incident_id=${incidentId}&limit=${limit}`
        : `/telemetry?limit=${limit}`;
      const res = await api.get<{ data: TelemetryLog[] }>(url);
      if (res.data) {
        setLogs(res.data);
        res.data.forEach((l) => seenIdsRef.current.add(l.id));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [incidentId, limit]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-lg border border-border bg-canvas/80 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/80 px-3.5 py-2.5 bg-surface/60">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-healthy opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-healthy"></span>
          </span>
          <Terminal className="h-3.5 w-3.5 text-healthy" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-fg-secondary">
            Telemetry Feed Stream
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-fg-muted">
          <Zap className="h-3 w-3 text-amber" />
          <span>{logs.length} EVENTS</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {loading && logs.length === 0 ? (
          <div className="flex items-center gap-2 text-fg-muted py-8 justify-center text-[10px]">
            <Activity className="h-4 w-4 animate-spin text-healthy" />
            <span>CONNECTING TO TELEMETRY BUS...</span>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-fg-muted text-[10px] italic py-6 text-center">
            Awaiting infrastructure telemetry events...
          </p>
        ) : (
          logs.map((log) => {
            const cfg = levelConfig[log.level] || levelConfig.info;
            const timeStr = new Date(log.logged_at || log.created_at).toLocaleTimeString();
            return (
              <div
                key={log.id}
                className={`flex items-start gap-2.5 rounded px-2 py-1 transition-all border ${cfg.bg} hover:bg-surface/90`}
              >
                <span className="shrink-0 text-[10px] text-fg-muted select-none">
                  [{timeStr}]
                </span>
                <span className={`shrink-0 font-bold ${cfg.color} select-none`}>
                  {cfg.prefix}
                </span>
                <span className="text-fg-secondary break-all">{log.message}</span>
                {log.source && (
                  <span className="ml-auto shrink-0 rounded bg-surface px-1.5 py-0.5 text-[8px] font-semibold text-fg-muted border border-border">
                    {log.source.toUpperCase()}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
