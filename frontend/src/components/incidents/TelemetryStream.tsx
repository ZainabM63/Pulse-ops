"use client";

import { useEffect, useState, useRef } from "react";

interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

const mockLogs: Omit<LogEntry, "id">[] = [
  { timestamp: "14:22:01", level: "error", message: "Datadog Alert -> 504 Gateway Timeout on auth-node-01" },
  { timestamp: "14:22:04", level: "warn", message: "Health check failed: payment-processor-03 (latency > 5000ms)" },
  { timestamp: "14:22:07", level: "info", message: "Auto-scaling: api-gateway cluster scaling to 8 replicas" },
  { timestamp: "14:22:11", level: "error", message: "PagerDuty escalation: P0 incident INC-0001 assigned to on-call SRE" },
  { timestamp: "14:22:15", level: "info", message: "Runbook triggered: graceful degradation for auth-service" },
  { timestamp: "14:22:18", level: "warn", message: "Circuit breaker OPEN: notification-service (error rate > 50%)" },
  { timestamp: "14:22:22", level: "info", message: "Slack webhook delivered: #incidents channel notified" },
  { timestamp: "14:22:25", level: "error", message: "Database connection pool exhausted: primary-replica lag > 30s" },
  { timestamp: "14:22:29", level: "info", message: "Failover initiated: auth-node-02 promoted to primary" },
  { timestamp: "14:22:33", level: "warn", message: "Disk usage critical: log-volume-07 at 94% capacity" },
];

const levelConfig = {
  info: { color: "text-fg-muted", prefix: "[INF]" },
  warn: { color: "text-amber", prefix: "[WRN]" },
  error: { color: "text-critical", prefix: "[ERR]" },
};

export function TelemetryStream() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const mock = mockLogs[Math.floor(Math.random() * mockLogs.length)];
      const now = new Date();
      const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      const entry: LogEntry = {
        id: counterRef.current++,
        timestamp,
        level: mock.level,
        message: mock.message,
      };

      setLogs((prev) => [...prev.slice(-50), entry]);
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-glow" />
          <span className="text-[10px] uppercase tracking-widest text-fg-muted">Live Telemetry Stream</span>
        </div>
        <span className="font-mono text-[10px] text-fg-muted">{logs.length} events</span>
      </div>
      <div ref={scrollRef} className="h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
        {logs.length === 0 && (
          <p className="text-fg-muted/50">Awaiting telemetry data...</p>
        )}
        {logs.map((log) => {
          const cfg = levelConfig[log.level];
          return (
            <div key={log.id} className="flex gap-3">
              <span className="shrink-0 text-healthy">[{log.timestamp}]</span>
              <span className={`shrink-0 font-bold ${cfg.color}`}>{cfg.prefix}</span>
              <span className="text-fg-secondary">{log.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
