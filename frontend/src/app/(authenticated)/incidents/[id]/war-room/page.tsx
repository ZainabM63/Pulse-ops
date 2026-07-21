"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { VoiceNotePlayer } from "@/components/warroom/VoiceNotePlayer";
import { getDuration, getEscalationLevel } from "@/types";
import type { Incident } from "@/types";
import {
  ArrowLeft, Send, AlertTriangle, Paperclip,
  Zap, Clock, Users, Terminal, Lightbulb,
  CheckCircle, XCircle, Mic, MicOff, Volume2, VolumeX
} from "lucide-react";

interface ChatMessage {
  id: number;
  timestamp: string;
  user: string;
  message: string;
  type: "chat" | "system" | "command" | "voice";
  audioUrl?: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

const mockWarLogs: Omit<LogEntry, "id">[] = [
  { timestamp: "", level: "error", message: "P0 Alert: 5xx error rate > 15% on api-gateway" },
  { timestamp: "", level: "info", message: "Auto-escalation triggered: VP Eng notified" },
  { timestamp: "", level: "warn", message: "Circuit breaker state change: notification-service OPEN" },
  { timestamp: "", level: "info", message: "Failover complete: auth-node-02 promoted to primary" },
  { timestamp: "", level: "error", message: "Payment processing latency > 2000ms threshold" },
  { timestamp: "", level: "info", message: "Runbook deployed: graceful degradation for non-critical paths" },
  { timestamp: "", level: "warn", message: "Memory utilization critical: redis-cluster-01 at 92%" },
  { timestamp: "", level: "info", message: "Canary deployment rolled back: auth-service v2.3.1" },
];

const rootCauseHypotheses = [
  {
    id: 1,
    title: "Connection Pool Exhaustion",
    confidence: 78,
    status: "investigating",
    evidence: ["DB replica lag > 30s", "Connection pool at 100%", "Primary DB CPU at 98%"],
    owner: "Sarah Chen",
  },
  {
    id: 2,
    title: "Memory Leak in Auth Service",
    confidence: 45,
    status: "hypothesis",
    evidence: ["RSS growing 2MB/min", "GC pause time increasing"],
    owner: "Alex R.",
  },
  {
    id: 3,
    title: "Network Partition Between AZs",
    confidence: 12,
    status: "ruled_out",
    evidence: ["Cross-AZ latency nominal", "No packet loss detected"],
    owner: "—",
  },
];

const warCommands: Record<string, string> = {
  "/ack": "Incident acknowledged. On-call responder notified.",
  "/escalate": "Escalating to next on-call tier.",
  "/attach-log": "Live log stream attached to incident timeline.",
  "/status": "Current status: Investigating. 3 services affected.",
  "/mute": "Notification silencing enabled for 15 minutes.",
  "/help": "Commands: /ack, /escalate, /attach-log, /status, /mute, /help",
};

export default function WarRoomPage() {
  const params = useParams();
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "logs">("chat");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const msgCounter = useRef(0);
  const logCounter = useRef(0);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dispatch announcer state
  const [dispatchEnabled, setDispatchEnabled] = useState(false);

  // Quick action states
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [logsAttached, setLogsAttached] = useState(false);

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  const addMessage = useCallback((user: string, message: string, type: ChatMessage["type"] = "chat", audioUrl?: string) => {
    setMessages((prev) => [...prev, { id: msgCounter.current++, timestamp: now(), user, message, type, audioUrl }]);
  }, []);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((prev) => [...prev.slice(-100), { id: logCounter.current++, timestamp: now(), level, message }]);
  }, []);

  useEffect(() => {
    api.get<{ data: Incident }>(`/incidents/${params.id}`)
      .then((res) => {
        setIncident(res.data);
        addMessage("System", `War room activated for INC-${String(res.data.id).padStart(4, "0")}`, "system");
        addMessage("System", `Severity: ${res.data.severity.toUpperCase()} | Status: ${res.data.status.toUpperCase()}`, "system");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id, addMessage]);

  useEffect(() => {
    const interval = setInterval(() => {
      const mock = mockWarLogs[Math.floor(Math.random() * mockWarLogs.length)];
      addLog(mock.level, mock.message);

      // Dispatch announcer: speak P0 critical alerts
      if (dispatchEnabled && mock.level === "error" && typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(`Critical alert. ${mock.message}`);
          utterance.rate = 1.1;
          utterance.pitch = 0.9;
          window.speechSynthesis.speak(utterance);
        } catch { /* speech synthesis not available */ }
      }
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, [dispatchEnabled, addLog]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [logs]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const input = chatInput.trim();
    if (!input) return;

    if (input.startsWith("/")) {
      addMessage("You", input, "command");
      const response = warCommands[input.toLowerCase()];
      if (response) {
        setTimeout(() => addMessage("System", response, "system"), 300);
      } else {
        setTimeout(() => addMessage("System", `Unknown command: ${input}. Type /help for available commands.`, "system"), 300);
      }
    } else {
      addMessage("You", input, "chat");
    }
    setChatInput("");
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        addMessage("You", "Voice note", "voice", url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      addMessage("System", "Microphone access denied. Please enable microphone permissions.", "system");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const formatRecordingTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const handleAcknowledge = async () => {
    if (acknowledging || acknowledged || !incident) return;
    setAcknowledging(true);
    try {
      await api.put(`/incidents/${incident.id}`, { comment: "Incident acknowledged in War Room" });
      setAcknowledged(true);
      addMessage("System", "Incident acknowledged. All responders notified.", "system");
    } catch {
      addMessage("System", "Failed to acknowledge incident.", "system");
    } finally {
      setAcknowledging(false);
    }
  };

  const handleEscalate = async () => {
    if (escalating || escalated || !incident) return;
    setEscalating(true);
    try {
      await api.put(`/incidents/${incident.id}`, { comment: "Escalating to CTO" });
      setEscalated(true);
      addMessage("System", "Incident escalated to CTO. Emergency notification dispatched.", "system");
      addLog("error", "ESCALATION: Incident escalated to CTO level");
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          const utterance = new SpeechSynthesisUtterance("Warning. Incident escalated to CTO. Emergency notification dispatched.");
          utterance.rate = 1.1;
          utterance.pitch = 0.9;
          window.speechSynthesis.speak(utterance);
        } catch { /* speech synthesis not available */ }
      }
    } catch {
      addMessage("System", "Failed to escalate incident.", "system");
    } finally {
      setEscalating(false);
    }
  };

  const handleAttachLogs = () => {
    if (logsAttached) return;
    setLogsAttached(true);
    addMessage("System", "Live log stream attached to incident timeline.", "system");
    addLog("info", "Log stream attached: api-gateway-access.log");
    addLog("info", "Log stream attached: auth-service-trace.log");
    addLog("info", "Log stream attached: payment-processor-audit.log");
    const extraLogs = [
      { level: "warn" as const, message: "Elevated latency detected on payment-processor: p99=450ms" },
      { level: "info" as const, message: "Auto-scaling triggered: auth-service replicas 3→5" },
      { level: "error" as const, message: "Connection pool warning: api-gateway at 85% capacity" },
    ];
    extraLogs.forEach((log, i) => {
      setTimeout(() => addLog(log.level, log.message), 1500 * (i + 1));
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-amber" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-6">
        <p className="text-sm text-critical">Incident not found</p>
        <button onClick={() => router.push("/incidents")} className="mt-2 text-xs text-amber hover:underline">
          ← Back to incidents
        </button>
      </div>
    );
  }

  const escalation = getEscalationLevel(incident.created_at);

  return (
    <div className="flex h-full flex-col">
      {/* War Room Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/incidents/${incident.id}`)}
            className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted transition-colors hover:text-fg-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-critical animate-pulse" />
            <span className="font-mono text-xs font-bold text-fg-primary">WAR ROOM</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="font-mono text-[10px] text-fg-muted">INC-{String(incident.id).padStart(4, "0")}</span>
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
        </div>
        <div className="flex items-center gap-3">
          {/* Dispatch Audio Toggle */}
          <button
            onClick={() => setDispatchEnabled(!dispatchEnabled)}
            className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              dispatchEnabled
                ? "border-amber/40 bg-amber/10 text-amber"
                : "border-border bg-surface text-fg-muted hover:border-amber/40"
            }`}
          >
            {dispatchEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            Dispatch {dispatchEnabled ? "On" : "Off"}
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-amber" />
            <span className="text-[10px] text-fg-muted">3 responders</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-fg-muted" />
            <span className="font-mono text-[10px] text-fg-muted">{getDuration(incident.created_at)}</span>
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${escalation === "level_3" ? "text-critical" : escalation === "level_2" ? "text-degraded" : "text-amber"}`}>
            {escalation.replace("level_", "L")}
          </span>
        </div>
      </div>

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Chat + Logs */}
        <div className="flex flex-1 flex-col border-r border-border">
          {/* Tab Bar */}
          <div className="flex items-center border-b border-border bg-surface">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === "chat"
                  ? "border-amber text-amber"
                  : "border-transparent text-fg-muted hover:text-fg-primary"
              }`}
            >
              <Terminal className="h-3 w-3" />
              Chat & Commands
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === "logs"
                  ? "border-amber text-amber"
                  : "border-transparent text-fg-muted hover:text-fg-primary"
              }`}
            >
              <Zap className="h-3 w-3" />
              Live Logs ({logs.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "chat" ? (
              <div className="flex h-full flex-col">
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2 ${msg.type === "system" ? "justify-center" : ""}`}>
                      {msg.type === "system" ? (
                        <span className="rounded bg-elevated px-2 py-1 text-[10px] text-fg-muted">
                          [{msg.timestamp}] {msg.message}
                        </span>
                      ) : msg.type === "voice" ? (
                        <div className="flex flex-col gap-1 max-w-xs">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 font-mono text-[10px] text-healthy">[{msg.timestamp}]</span>
                            <span className="shrink-0 text-[10px] font-bold text-fg-primary">{msg.user}</span>
                          </div>
                          {msg.audioUrl && (
                            <VoiceNotePlayer user={msg.user} audioUrl={msg.audioUrl} timestamp={msg.timestamp} />
                          )}
                        </div>
                      ) : msg.type === "command" ? (
                        <div className="flex gap-2">
                          <span className="shrink-0 font-mono text-[10px] text-healthy">[{msg.timestamp}]</span>
                          <span className="shrink-0 font-mono text-[10px] font-bold text-amber">&gt; {msg.user}</span>
                          <span className="font-mono text-[10px] text-amber">{msg.message}</span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <span className="shrink-0 font-mono text-[10px] text-healthy">[{msg.timestamp}]</span>
                          <span className="shrink-0 text-[10px] font-bold text-fg-primary">{msg.user}:</span>
                          <span className="text-[10px] text-fg-secondary">{msg.message}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Recording Indicator */}
                {isRecording && (
                  <div className="flex items-center gap-2 border-t border-critical/30 bg-critical/5 px-3 py-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-critical" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-critical">Recording Audio...</span>
                    <span className="font-mono text-[10px] text-critical">{formatRecordingTime(recordingTime)}</span>
                  </div>
                )}

                <form onSubmit={handleSend} className="border-t border-border p-2">
                  <div className="flex items-center gap-2 rounded border border-border bg-canvas px-2 py-1.5">
                    <span className="font-mono text-[10px] font-bold text-amber">&gt;_</span>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type message or command (/ack, /escalate, /attach-log)..."
                      className="flex-1 bg-transparent font-mono text-[11px] text-fg-primary placeholder-fg-muted/40 outline-none"
                      disabled={isRecording}
                    />
                    {/* Mic Button */}
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`rounded p-1 transition-colors ${
                        isRecording
                          ? "text-critical animate-pulse"
                          : "text-fg-muted hover:text-amber"
                      }`}
                    >
                      {isRecording ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    </button>
                    <button type="submit" className="rounded p-1 text-amber transition-colors hover:text-amber-hover" disabled={isRecording}>
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div ref={logScrollRef} className="h-full overflow-y-auto p-3 font-mono text-[10px] leading-relaxed">
                {logs.length === 0 ? (
                  <p className="text-fg-muted/40">Awaiting telemetry data...</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <span className="shrink-0 text-healthy">[{log.timestamp}]</span>
                      <span className={`shrink-0 font-bold ${
                        log.level === "error" ? "text-critical" : log.level === "warn" ? "text-amber" : "text-fg-muted"
                      }`}>
                        {log.level === "error" ? "[ERR]" : log.level === "warn" ? "[WRN]" : "[INF]"}
                      </span>
                      <span className="text-fg-secondary">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Root Cause + Actions */}
        <div className="flex w-80 flex-col overflow-y-auto bg-surface">
          {/* Incident Summary */}
          <div className="border-b border-border p-4">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-primary">{incident.title}</h2>
            <p className="text-[10px] text-fg-muted">{incident.description || "No description provided."}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {incident.services?.map((s) => (
                <span key={s.id} className="rounded border border-border bg-canvas px-1.5 py-0.5 text-[8px] text-fg-muted">
                  {s.name}
                </span>
              ))}
            </div>
          </div>

          {/* Root Cause Hypotheses */}
          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber" />
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-fg-primary">Root Cause Analysis</h3>
            </div>
            <div className="space-y-2">
              {rootCauseHypotheses.map((h) => (
                <div
                  key={h.id}
                  className={`rounded border p-2.5 ${
                    h.status === "ruled_out"
                      ? "border-border bg-canvas opacity-50"
                      : h.status === "investigating"
                      ? "border-amber/40 bg-amber/5"
                      : "border-border bg-canvas"
                  }`}
                >
                  <div className="mb-1.5 flex items-start justify-between">
                    <span className={`text-[10px] font-bold ${h.status === "ruled_out" ? "text-fg-muted line-through" : "text-fg-primary"}`}>
                      {h.title}
                    </span>
                    {h.status === "investigating" ? (
                      <span className="shrink-0 rounded bg-amber/10 px-1.5 py-0.5 text-[8px] font-bold text-amber">ACTIVE</span>
                    ) : h.status === "ruled_out" ? (
                      <XCircle className="h-3 w-3 shrink-0 text-fg-muted" />
                    ) : null}
                  </div>
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] uppercase tracking-wider text-fg-muted">Confidence</span>
                      <span className={`font-mono text-[9px] font-bold ${
                        h.confidence >= 70 ? "text-amber" : h.confidence >= 40 ? "text-degraded" : "text-fg-muted"
                      }`}>
                        {h.confidence}%
                      </span>
                    </div>
                    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-elevated">
                      <div
                        className={`h-full rounded-full ${
                          h.confidence >= 70 ? "bg-amber" : h.confidence >= 40 ? "bg-degraded" : "bg-fg-muted"
                        }`}
                        style={{ width: `${h.confidence}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {h.evidence.map((e, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="h-0.5 w-0.5 rounded-full bg-fg-muted" />
                        <span className="text-[8px] text-fg-muted">{e}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-[8px] text-fg-muted">Owner: {h.owner}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber" />
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-fg-primary">Quick Actions</h3>
            </div>
            <div className="space-y-1.5">
              <button
                onClick={handleAcknowledge}
                disabled={acknowledging || acknowledged}
                className={`flex w-full items-center gap-2 rounded border px-2.5 py-1.5 text-[10px] transition-colors ${
                  acknowledged
                    ? "border-healthy/40 bg-healthy/10 text-healthy"
                    : "border-border bg-canvas text-fg-primary hover:border-amber/40 hover:bg-hover-row"
                } disabled:opacity-60`}
              >
                <CheckCircle className={`h-3 w-3 ${acknowledged ? "text-healthy" : "text-healthy"}`} />
                {acknowledged ? "Acknowledged ✓" : acknowledging ? "Acknowledging..." : "Acknowledge Incident"}
              </button>
              <button
                onClick={handleEscalate}
                disabled={escalating || escalated}
                className={`flex w-full items-center gap-2 rounded border px-2.5 py-1.5 text-[10px] transition-colors ${
                  escalated
                    ? "border-critical/40 bg-critical/10 text-critical"
                    : "border-border bg-canvas text-fg-primary hover:border-amber/40 hover:bg-hover-row"
                } disabled:opacity-60`}
              >
                <AlertTriangle className={`h-3 w-3 ${escalated ? "text-critical" : "text-amber"}`} />
                {escalated ? "Escalated ✓" : escalating ? "Escalating..." : "Escalate to CTO"}
              </button>
              <button
                onClick={handleAttachLogs}
                disabled={logsAttached}
                className={`flex w-full items-center gap-2 rounded border px-2.5 py-1.5 text-[10px] transition-colors ${
                  logsAttached
                    ? "border-info/40 bg-info/10 text-info"
                    : "border-border bg-canvas text-fg-primary hover:border-amber/40 hover:bg-hover-row"
                } disabled:opacity-60`}
              >
                <Paperclip className={`h-3 w-3 ${logsAttached ? "text-info" : "text-info"}`} />
                {logsAttached ? "Logs Attached ✓" : "Attach Log Stream"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
