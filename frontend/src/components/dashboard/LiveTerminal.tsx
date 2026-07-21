"use client";

import { useEffect, useState, useRef } from "react";

interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "cmd";
  message: string;
}

const mockLogs: Omit<LogEntry, "id">[] = [
  { timestamp: "", level: "error", message: "Datadog Webhook: P0 Incident #INC-0001 triggered on #api-gateway" },
  { timestamp: "", level: "info", message: "Auto-Escalation: SMS alert dispatched to On-Call Lead (Sarah C.)" },
  { timestamp: "", level: "warn", message: "Circuit breaker OPEN: notification-service (error rate > 50%)" },
  { timestamp: "", level: "info", message: "Runbook triggered: graceful degradation for auth-service" },
  { timestamp: "", level: "error", message: "Health check failed: payment-processor-03 (latency > 5000ms)" },
  { timestamp: "", level: "info", message: "Slack webhook delivered: #incidents channel notified" },
  { timestamp: "", level: "warn", message: "Disk usage critical: log-volume-07 at 94% capacity" },
  { timestamp: "", level: "info", message: "Failover initiated: auth-node-02 promoted to primary" },
  { timestamp: "", level: "error", message: "Database connection pool exhausted: primary-replica lag > 30s" },
  { timestamp: "", level: "info", message: "PagerDuty incident acknowledged by on-call responder" },
  { timestamp: "", level: "warn", message: "Memory pressure: worker-queue-redis at 87% utilization" },
  { timestamp: "", level: "info", message: "Auto-scaling: api-gateway cluster scaling to 8 replicas" },
];

const levelConfig = {
  info: { color: "text-fg-muted", prefix: "[INF]" },
  warn: { color: "text-amber", prefix: "[WRN]" },
  error: { color: "text-critical", prefix: "[ERR]" },
  cmd: { color: "text-amber", prefix: "[CMD]" },
};

const commandResponses: Record<string, string> = {
  "/ack": "Incident acknowledged. On-call responder notified via PagerDuty.",
  "/p1": "Severity escalated to P1 (Major). Blast radius recalculated.",
  "/reboot-pod": "Initiating graceful pod restart... auth-node-01 terminated, new instance spinning up.",
  "/status": "System operational. 3 active incidents, 4 services healthy.",
  "/help": "Available commands: /ack, /p1, /reboot-pod, /status, /help",
};

export function LiveTerminal() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  const addLog = (level: LogEntry["level"], message: string) => {
    setLogs((prev) => [...prev.slice(-80), { id: counterRef.current++, timestamp: now(), level, message }]);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const mock = mockLogs[Math.floor(Math.random() * mockLogs.length)];
      addLog(mock.level, mock.message);
    }, 2500 + Math.random() * 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim().toLowerCase();
    if (!cmd) return;
    addLog("cmd", `> ${input.trim()}`);
    const response = commandResponses[cmd];
    if (response) {
      setTimeout(() => addLog("info", response), 300);
    } else {
      setTimeout(() => addLog("error", `Unknown command: ${cmd}. Type /help for available commands.`), 300);
    }
    setInput("");
  };

  return (
    <div className="mt-4 rounded border border-border bg-canvas">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-glow" />
          <span className="text-[10px] uppercase tracking-widest text-fg-muted">Live Terminal</span>
        </div>
        <span className="font-mono text-[10px] text-fg-muted">{logs.length} events</span>
      </div>
      <div ref={scrollRef} className="h-48 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
        {logs.length === 0 && (
          <p className="text-fg-muted/40">Awaiting telemetry data...</p>
        )}
        {logs.map((log) => {
          const cfg = levelConfig[log.level];
          return (
            <div key={log.id} className="flex gap-2">
              <span className="shrink-0 text-healthy">[{log.timestamp}]</span>
              <span className={`shrink-0 font-bold ${cfg.color}`}>{cfg.prefix}</span>
              <span className={log.level === "cmd" ? "text-amber" : "text-fg-secondary"}>{log.message}</span>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleCommand} className="border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-amber font-bold">&gt;_</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type command (/ack, /p1, /reboot-pod)..."
            className="flex-1 bg-transparent font-mono text-[11px] text-fg-primary placeholder-fg-muted/40 outline-none"
          />
        </div>
      </form>
    </div>
  );
}
