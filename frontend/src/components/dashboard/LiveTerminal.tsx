"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRealtimeIncident } from "@/hooks/useRealtimeIncident";
import type { TelemetryLog } from "@/types";
import { Terminal, Send, ShieldAlert, CheckCircle2, CornerDownLeft } from "lucide-react";

const levelConfig = {
  info: { color: "text-info", prefix: "[INF]" },
  warn: { color: "text-amber", prefix: "[WRN]" },
  error: { color: "text-critical font-bold", prefix: "[ERR]" },
  cmd: { color: "text-healthy font-bold", prefix: "[CMD]" },
};

export function LiveTerminal() {
  const { user } = useAuth();
  const { refresh } = useDashboardData();
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get<{ data: TelemetryLog[] }>("/telemetry?limit=40");
      if (res.data) {
        setLogs(res.data);
        res.data.forEach((l) => seenIdsRef.current.add(l.id));
        setError(false);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Real-time updates via WebSocket
  useRealtimeIncident(user?.company?.id ?? null, (event) => {
    if (event.type === "chat.message" || event.type === "incident.updated") {
      fetchLogs();
    }
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const addTelemetryLog = async (level: TelemetryLog["level"], message: string, source = "terminal") => {
    try {
      const res = await api.post<{ data: TelemetryLog }>("/telemetry", {
        level,
        message,
        source,
      });
      if (res.data) {
        setLogs((prev) => [...prev, res.data]);
      }
    } catch {
      // local fallback
      const fallbackLog: TelemetryLog = {
        id: Date.now(),
        company_id: user?.company?.id ?? 1,
        incident_id: null,
        service_id: null,
        level,
        message,
        source,
        logged_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setLogs((prev) => [...prev, fallbackLog]);
    }
  };

  const parseIncidentId = (input: string): number | null => {
    const parts = input.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const idStr = parts[1];
    if (/^\d+$/.test(idStr)) return parseInt(idStr, 10);
    const match = idStr.match(/INC-?(\d+)/i);
    if (match) return parseInt(match[1], 10);
    return null;
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw || executing) return;
    setExecuting(true);

    await addTelemetryLog("cmd", `> ${raw}`, "user");
    const parts = raw.toLowerCase().split(/\s+/);
    const cmd = parts[0];

    if (cmd === "/help") {
      await addTelemetryLog("info", "Available Commands: /ack <ID>, /escalate <ID>, /status <ID>, /clear, /help", "system");
      setInput("");
      setExecuting(false);
      return;
    }

    if (cmd === "/clear") {
      setLogs([]);
      setInput("");
      setExecuting(false);
      return;
    }

    const incidentId = parseIncidentId(raw);

    if (cmd === "/ack") {
      if (!incidentId) {
        await addTelemetryLog("error", "Usage: /ack <incident_id> (e.g., /ack 1 or /ack INC-0001)", "system");
        setInput("");
        setExecuting(false);
        return;
      }
      try {
        await api.post(`/incidents/${incidentId}/activity`, {
          type: "command",
          body: "Incident acknowledged via Live Terminal prompt.",
        });
        await api.put(`/incidents/${incidentId}`, { status: "investigating" });
        await addTelemetryLog("info", `[SUCCESS] INC-${String(incidentId).padStart(4, "0")} acknowledged. Responder notified.`, "system");
        refresh();
      } catch (err) {
        await addTelemetryLog("error", `[FAILED] Acknowledge INC-${String(incidentId).padStart(4, "0")}: ${(err as Error).message}`, "system");
      }
      setInput("");
      setExecuting(false);
      return;
    }

    if (cmd === "/escalate") {
      if (!incidentId) {
        await addTelemetryLog("error", "Usage: /escalate <incident_id> (e.g., /escalate 1)", "system");
        setInput("");
        setExecuting(false);
        return;
      }
      try {
        const res = await api.get<{ data: { severity: string } }>(`/incidents/${incidentId}`);
        const severityOrder = ["info", "minor", "major", "critical"];
        const currentIdx = severityOrder.indexOf(res.data.severity);
        const nextSeverity = severityOrder[Math.min(currentIdx + 1, severityOrder.length - 1)];
        await api.put(`/incidents/${incidentId}`, { severity: nextSeverity });
        await addTelemetryLog("warn", `[ESCALATED] INC-${String(incidentId).padStart(4, "0")} severity updated to ${nextSeverity.toUpperCase()}.`, "system");
        refresh();
      } catch (err) {
        await addTelemetryLog("error", `[FAILED] Escalate INC-${String(incidentId).padStart(4, "0")}: ${(err as Error).message}`, "system");
      }
      setInput("");
      setExecuting(false);
      return;
    }

    if (cmd === "/status") {
      if (!incidentId) {
        await addTelemetryLog("error", "Usage: /status <incident_id> (e.g., /status 1)", "system");
        setInput("");
        setExecuting(false);
        return;
      }
      try {
        const res = await api.get<{ data: { status: string; severity: string; title: string } }>(`/incidents/${incidentId}`);
        const d = res.data;
        await addTelemetryLog("info", `INC-${String(incidentId).padStart(4, "0")} | Title: "${d.title}" | Status: ${d.status.toUpperCase()} | Severity: ${d.severity.toUpperCase()}`, "system");
      } catch (err) {
        await addTelemetryLog("error", `[FAILED] Fetch INC-${String(incidentId).padStart(4, "0")}: ${(err as Error).message}`, "system");
      }
      setInput("");
      setExecuting(false);
      return;
    }

    await addTelemetryLog("error", `Unknown command: "${cmd}". Type /help for assistance.`, "system");
    setInput("");
    setExecuting(false);
  };

  return (
    <div className="mt-4 rounded-lg border border-border bg-canvas/90 shadow-2xl backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-2.5 bg-surface/80">
        <div className="flex items-center gap-2.5">
          <Terminal className="h-4 w-4 text-healthy" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-fg-primary">
            Live Command & Telemetry Terminal
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-fg-muted">
          <span className={`flex items-center gap-1 ${error && logs.length === 0 ? "text-critical" : "text-healthy"}`}>
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${error && logs.length === 0 ? "bg-critical" : "bg-emerald-400"}`} />
            {error && logs.length === 0 ? "STREAM ERROR" : "CONNECTED"}
          </span>
          <span>{loading ? "…" : `${logs.length} EVENTS`}</span>
        </div>
      </div>

      {/* Log Feed */}
      <div
        ref={scrollRef}
        className="h-56 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1.5 bg-card border-border-subtle"
      >
        {loading ? (
          <p className="text-fg-muted italic">Loading telemetry activity stream...</p>
        ) : error && logs.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-critical italic">Telemetry stream unavailable — check connection.</p>
            <button
              onClick={fetchLogs}
              className="rounded border border-border bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-fg-primary hover:bg-hover-row transition-all"
            >
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-fg-muted italic">Awaiting telemetry activity stream...</p>
        ) : (
          logs.map((log) => {
            const cfg = levelConfig[log.level] || levelConfig.info;
            const timeStr = new Date(log.logged_at || log.created_at).toLocaleTimeString();
            return (
              <div key={log.id} className="flex items-start gap-2.5 hover:bg-surface/40 rounded px-1.5 py-0.5">
                <span className="shrink-0 text-fg-muted">[{timeStr}]</span>
                <span className={`shrink-0 font-bold ${cfg.color}`}>{cfg.prefix}</span>
                <span className={log.level === "cmd" ? "text-healthy font-semibold" : "text-fg-secondary"}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Command Input */}
      <form onSubmit={handleCommand} className="border-t border-border bg-surface/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-healthy">&gt;_</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={executing}
            placeholder="Enter command (/ack 1, /escalate 1, /status 1, /help)..."
            className="flex-1 bg-transparent font-mono text-xs text-fg-primary placeholder-fg-muted outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || executing}
            className="inline-flex items-center gap-1 rounded bg-healthy/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-healthy border border-healthy/40 hover:bg-healthy/30 transition-all disabled:opacity-40"
          >
            <CornerDownLeft className="h-3 w-3" />
            Exec
          </button>
        </div>
      </form>
    </div>
  );
}
