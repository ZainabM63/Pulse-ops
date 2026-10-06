"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Incident, IncidentHypothesis, TelemetryLog } from "@/types";
import { getEscalationLevel, getDuration } from "@/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { VoiceNotePlayer } from "@/components/warroom/VoiceNotePlayer";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useVoiceOutput } from "@/hooks/useVoiceOutput";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeIncident } from "@/hooks/useRealtimeIncident";
import {
  ArrowLeft, AlertTriangle, Users, Clock, Terminal, Zap,
  Volume2, VolumeX, Send, Mic, MicOff, AudioLines, Lightbulb,
  CheckCircle, Paperclip, Plus, Trash2, Check, X, ShieldAlert, Cpu
} from "lucide-react";

interface ChatMessage {
  id: number;
  timestamp: string;
  user: string;
  message: string;
  type: "chat" | "system" | "voice" | "command";
  audioUrl?: string;
}

interface ApiActivity {
  id: number;
  type: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  user: { id: number; name: string } | null;
  created_at: string;
}

function activityToMessage(activity: ApiActivity): ChatMessage | null {
  const userName = activity.user?.name ?? "System";
  const ts = new Date(activity.created_at);
  const timestamp = `${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}:${String(ts.getSeconds()).padStart(2, "0")}`;

  if (activity.type === "chat") {
    const hasAudio = activity.metadata && typeof activity.metadata === "object" && "audio_base64" in activity.metadata;
    if (hasAudio) {
      return { id: activity.id, timestamp, user: userName, message: "Voice note", type: "voice", audioUrl: (activity.metadata as Record<string, string>).audio_base64 };
    }
    return { id: activity.id, timestamp, user: userName, message: activity.body ?? "", type: "chat" };
  }

  if (activity.type === "comment") {
    return { id: activity.id, timestamp, user: userName, message: activity.body ?? "", type: "chat" };
  }

  if (["status_change", "severity_change", "assignment"].includes(activity.type)) {
    const label = activity.type === "status_change" ? "Status changed"
      : activity.type === "severity_change" ? "Severity changed"
      : "Assignment updated";
    return { id: activity.id, timestamp, user: "System", message: `${label}: ${activity.body}`, type: "system" };
  }

  if (activity.type === "command") {
    return { id: activity.id, timestamp, user: userName, message: activity.body ?? "", type: "command" };
  }

  return null;
}

export default function WarRoomPage() {
  const params = useParams();
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [hypotheses, setHypotheses] = useState<IncidentHypothesis[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "logs">("chat");

  // Add hypothesis state
  const [showAddHypothesis, setShowAddHypothesis] = useState(false);
  const [newHypothesisTitle, setNewHypothesisTitle] = useState("");
  const [newHypothesisConfidence, setNewHypothesisConfidence] = useState(50);
  const [newHypothesisEvidence, setNewHypothesisEvidence] = useState("");
  const [submittingHypothesis, setSubmittingHypothesis] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const lastActivityIdRef = useRef(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [logsAttached, setLogsAttached] = useState(false);

  const voiceInput = useVoiceInput({
    onResult: (text) => setChatInput((prev) => prev ? `${prev} ${text}` : text),
  });
  const voiceOutput = useVoiceOutput();
  const { user: me } = useAuth();
  const incidentId = incident?.id;
  const speakRef = useRef<(text: string) => void>(() => {});
  const announcedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    speakRef.current = voiceOutput.speak;
  }, [voiceOutput.speak]);

  const announce = useCallback((text: string) => {
    speakRef.current(text);
  }, []);

  const fetchIncident = useCallback(async (id: string) => {
    try {
      const res = await api.get<{ data: Incident }>(`/incidents/${id}`);
      setIncident(res.data);
      if (res.data.status === "investigating" || res.data.acknowledged_at) {
        setAcknowledged(true);
      }
    } catch {
      setIncident(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHypotheses = useCallback(async (id: string) => {
    try {
      const res = await api.get<{ data: IncidentHypothesis[] }>(`/incidents/${id}/hypotheses`);
      setHypotheses(res.data || []);
    } catch {
      // ignore
    }
  }, []);

  const fetchLogs = useCallback(async (id: string) => {
    try {
      const res = await api.get<{ data: TelemetryLog[] }>(`/telemetry?incident_id=${id}&limit=50`);
      setLogs(res.data || []);
    } catch {
      // ignore
    }
  }, []);

  const fetchChat = useCallback(async (id: number, append = true) => {
    try {
      const res = await api.get<{ data: ApiActivity[] }>(`/incidents/${id}/chat`);
      const activities = res.data || [];
      const parsed: ChatMessage[] = [];
      for (const act of activities) {
        if (act.id > lastActivityIdRef.current) {
          lastActivityIdRef.current = act.id;
          const msg = activityToMessage(act);
          if (msg) parsed.push(msg);
        }
      }
      if (parsed.length > 0) {
        if (append) {
          for (const m of parsed) {
            if (m.type === "system") announce(m.message);
          }
        }
        setMessages((prev) => (append ? [...prev, ...parsed] : parsed));
      }
    } catch {
      // ignore
    }
  }, [announce]);

  useEffect(() => {
    if (params.id) {
      const idStr = String(params.id);
      fetchIncident(idStr);
      fetchHypotheses(idStr);
      fetchLogs(idStr);
    }
  }, [params.id, fetchIncident, fetchHypotheses, fetchLogs]);

  useEffect(() => {
    if (!incidentId) return;
    fetchChat(incidentId, false);
    pollRef.current = setInterval(() => {
      fetchChat(incidentId, true);
      fetchLogs(String(incidentId));
    }, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [incidentId, fetchChat, fetchLogs]);

  useEffect(() => {
    if (!incidentId) return;
    const idStr = String(incidentId);
    const interval = setInterval(() => fetchIncident(idStr), 10000);
    return () => clearInterval(interval);
  }, [incidentId, fetchIncident]);

  useRealtimeIncident(
    me?.company?.id,
    useCallback(
      (event) => {
        if (incidentId && event.type === "incident.updated") {
          const updatedId = (event.data as { id?: number })?.id;
          if (updatedId === incidentId) fetchIncident(String(updatedId));
        }
        if (event.type === "chat.message") {
          const msg = activityToMessage(event.data as unknown as ApiActivity);
          if (!msg) return;
          const actorId = (event.data?.user as { id?: number } | null)?.id;
          if (typeof actorId === "number" && me?.id === actorId) return;
          if (msg.id <= lastActivityIdRef.current) return;
          lastActivityIdRef.current = msg.id;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.type === "system") announce(msg.message);
        }
      },
      [incidentId, me?.id, announce, fetchIncident]
    )
  );

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (incident && !announcedRef.current.has(incident.id)) {
      announcedRef.current.add(incident.id);
      announce(`Auto dispatch: incident INC-${String(incident.id).padStart(4, "0")}, severity ${incident.severity}, status ${incident.status}. ${incident.title}`);
    }
  }, [incident, announce]);

  const addMessage = (user: string, message: string, type: ChatMessage["type"] = "chat") => {
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), timestamp, user, message, type }]);
  };

  const startRecording = useCallback(async () => {
    if (isRecording || !incident) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = String(reader.result);
          try {
            const res = await api.post<{ message: ApiActivity }>(`/incidents/${incident.id}/chat`, {
              body: "Voice note",
              metadata: { audio_base64: dataUrl },
            });
            if (res.message) {
              lastActivityIdRef.current = Math.max(lastActivityIdRef.current, res.message.id);
              const msg = activityToMessage(res.message);
              if (msg) setMessages((prev) => [...prev, msg]);
            }
            await fetchChat(incident.id, true);
          } catch {
            addMessage("System", "Failed to send voice note.", "system");
          }
        };
        reader.readAsDataURL(blob);
        setIsRecording(false);
        setRecordingTime(0);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setRecordingTime(0);
        addMessage("System", "Voice recording failed.", "system");
      };
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      addMessage("System", "Microphone access denied.", "system");
    }
  }, [isRecording, incident, fetchChat, addMessage]);

  const stopRecording = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleCreateHypothesis = async () => {
    if (!newHypothesisTitle.trim() || !incident || submittingHypothesis) return;
    setSubmittingHypothesis(true);
    try {
      const evidenceArr = newHypothesisEvidence.trim()
        ? newHypothesisEvidence.split("\n").map((s) => s.trim()).filter(Boolean)
        : [];

      const res = await api.post<{ data: IncidentHypothesis }>(`/incidents/${incident.id}/hypotheses`, {
        title: newHypothesisTitle.trim(),
        confidence: newHypothesisConfidence,
        status: "hypothesis",
        evidence: evidenceArr,
      });

      setHypotheses((prev) => [res.data, ...prev]);
      setNewHypothesisTitle("");
      setNewHypothesisConfidence(50);
      setNewHypothesisEvidence("");
      setShowAddHypothesis(false);
      addMessage("System", `New Root Cause Hypothesis added: "${res.data.title}"`, "system");
      announce(`New root cause hypothesis added: ${res.data.title}`);
    } catch {
      // ignore
    } finally {
      setSubmittingHypothesis(false);
    }
  };

  const handleUpdateHypothesisStatus = async (hypothesisId: number, status: IncidentHypothesis["status"]) => {
    if (!incident) return;
    try {
      const res = await api.put<{ data: IncidentHypothesis }>(`/incidents/${incident.id}/hypotheses/${hypothesisId}`, {
        status,
      });
      setHypotheses((prev) => prev.map((h) => (h.id === hypothesisId ? res.data : h)));
      addMessage("System", `Hypothesis "${res.data.title}" status updated to ${status.toUpperCase()}`, "system");
      announce(`Hypothesis ${res.data.title} status updated to ${status.toUpperCase()}`);
    } catch {
      // ignore
    }
  };

  const handleDeleteHypothesis = async (hypothesisId: number) => {
    if (!incident) return;
    try {
      await api.delete(`/incidents/${incident.id}/hypotheses/${hypothesisId}`);
      setHypotheses((prev) => prev.filter((h) => h.id !== hypothesisId));
    } catch {
      // ignore
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !incident) return;

    if (text.startsWith("/")) {
      setChatInput("");
      addMessage("You", text, "command");

      if (text.startsWith("/ack")) {
        await handleAcknowledge();
        return;
      }
      if (text.startsWith("/escalate")) {
        await handleEscalate();
        return;
      }
      if (text.startsWith("/status")) {
        addMessage("System", `INC-${String(incident.id).padStart(4, "0")} | Title: "${incident.title}" | Status: ${incident.status.toUpperCase()} | Severity: ${incident.severity.toUpperCase()}`, "system");
        return;
      }
      if (text.startsWith("/help")) {
        addMessage("System", "War Room Slash Commands: /ack, /escalate, /status, /help", "system");
        return;
      }
    }

    setChatInput("");
    try {
      await api.post(`/incidents/${incident.id}/chat`, { body: text });
      fetchChat(incident.id, true);
    } catch {
      addMessage("You", text, "chat");
    }
  };

  const handleAcknowledge = async () => {
    if (acknowledged || acknowledging || !incident) return;
    setAcknowledging(true);
    try {
      await api.post(`/incidents/${incident.id}/activity`, {
        type: "command",
        body: "Incident acknowledged by on-call responder.",
      });
      await api.put(`/incidents/${incident.id}`, { status: "investigating" });
      setAcknowledged(true);
      addMessage("System", "Incident acknowledged. Responders notified.", "system");
      announce("Incident acknowledged. Responders notified.");
      fetchIncident(String(incident.id));
    } catch {
      addMessage("System", "Failed to acknowledge incident.", "system");
    } finally {
      setAcknowledging(false);
    }
  };

  const handleEscalate = async () => {
    if (escalated || escalating || !incident) return;
    setEscalating(true);
    try {
      const severityOrder = ["info", "minor", "major", "critical"];
      const currentIdx = severityOrder.indexOf(incident.severity);
      const nextSeverity = severityOrder[Math.min(currentIdx + 1, severityOrder.length - 1)];
      await api.put(`/incidents/${incident.id}`, { severity: nextSeverity });
      setEscalated(true);
      addMessage("System", `Incident escalated to ${nextSeverity.toUpperCase()}.`, "system");
      announce(`Incident escalated to ${nextSeverity.toUpperCase()}.`);
      fetchIncident(String(incident.id));
    } catch {
      addMessage("System", "Failed to escalate incident.", "system");
    } finally {
      setEscalating(false);
    }
  };

  const handleAttachLogs = async () => {
    if (logsAttached || !incident) return;
    setLogsAttached(true);
    try {
      await api.post(`/telemetry`, {
        incident_id: incident.id,
        level: "info",
        message: "Live server log stream attached to incident timeline",
        source: "warroom",
      });
      addMessage("System", "Live log stream attached to incident timeline.", "system");
      fetchLogs(String(incident.id));
    } catch {
      setLogsAttached(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 bg-canvas">
        <div className="flex items-center gap-3 text-healthy font-mono text-xs">
          <Cpu className="h-5 w-5 animate-spin" />
          <span>LOADING WAR ROOM MISSION MATRIX...</span>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-8 bg-canvas h-full text-fg-primary">
        <p className="text-sm font-mono text-rose-500">ERROR 404: INCIDENT NOT FOUND</p>
        <button onClick={() => router.push("/incidents")} className="mt-4 text-xs font-mono text-amber hover:underline">
          &larr; Return to Incident Matrix
        </button>
      </div>
    );
  }

  const escalation = getEscalationLevel(incident.created_at);
  const mediaSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  return (
    <div className="flex h-full flex-col bg-canvas text-fg-primary font-sans">
      {/* Cyber-Ops Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface/90 px-4 sm:px-5 py-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <button
            onClick={() => router.push(`/incidents/${incident.id}`)}
            className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-critical opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <span className="font-mono text-xs font-extrabold uppercase tracking-widest text-fg-primary">
              DIGITAL WAR ROOM
            </span>
          </div>
          <span className="font-mono text-xs text-fg-muted">INC-{String(incident.id).padStart(4, "0")}</span>
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <button
            onClick={voiceOutput.toggle}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
              voiceOutput.enabled
                ? "border-amber/50 bg-amber/10 text-amber shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                : "border-border bg-surface text-fg-muted hover:border-border"
            }`}
          >
            {voiceOutput.enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            Audio Dispatch {voiceOutput.enabled ? "ON" : "OFF"}
          </button>

          <div className="flex items-center gap-2 font-mono text-xs text-fg-muted border-l border-border pl-4">
            <Clock className="h-3.5 w-3.5 text-healthy" />
            <span>ELAPSED: {getDuration(incident.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Main Command Workspace */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Left Pane: Chat Stream & Telemetry Feed */}
        <div className="flex h-[65vh] shrink-0 flex-col border-b border-border bg-canvas lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink lg:border-b-0 lg:border-r">
          <div className="flex items-center border-b border-border bg-surface/60 px-2">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === "chat"
                  ? "border-healthy text-healthy"
                  : "border-transparent text-fg-muted hover:text-fg-primary"
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              War Room Terminal Chat
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === "logs"
                  ? "border-healthy text-healthy"
                  : "border-transparent text-fg-muted hover:text-fg-primary"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber" />
              Telemetry Feed ({logs.length})
            </button>
          </div>

          <div className="flex-1 overflow-hidden p-4">
            {activeTab === "chat" ? (
              <div className="flex h-full flex-col">
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-3 font-mono text-xs pr-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2 ${msg.type === "system" ? "justify-center" : ""}`}>
                      {msg.type === "system" ? (
                        <span className="rounded bg-surface/80 border border-border px-3 py-1 text-[11px] text-fg-muted shadow-inner">
                          [{msg.timestamp}] {msg.message}
                        </span>
                      ) : msg.type === "command" ? (
                        <div className="flex gap-2 items-start bg-surface/40 p-2 rounded border border-border">
                          <span className="text-fg-muted shrink-0">[{msg.timestamp}]</span>
                          <span className="font-bold text-amber shrink-0">&gt; {msg.user}:</span>
                          <span className="text-emerald-300 font-semibold">{msg.message}</span>
                        </div>
                      ) : msg.type === "voice" ? (
                        <div className="flex gap-2 items-start bg-surface/30 p-2 rounded border border-border">
                          <span className="text-fg-muted shrink-0">[{msg.timestamp}]</span>
                          <span className="font-bold text-healthy shrink-0">{msg.user}:</span>
                          <VoiceNotePlayer user={msg.user} audioUrl={msg.audioUrl ?? ""} timestamp={msg.timestamp} />
                        </div>
                      ) : (
                        <div className="flex gap-2 items-start bg-surface/30 p-2 rounded border border-border">
                          <span className="text-fg-muted shrink-0">[{msg.timestamp}]</span>
                          <span className="font-bold text-healthy shrink-0">{msg.user}:</span>
                          <span className="text-fg-primary">{msg.message}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSend} className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/80 px-3 py-2 shadow-inner">
                    <span className="font-mono text-xs font-bold text-healthy">&gt;_</span>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type message or command (/ack, /escalate, /status, /help)..."
                      className="flex-1 bg-transparent font-mono text-xs text-fg-primary placeholder-fg-muted outline-none"
                    />
                    {voiceInput.isSupported && (
                      <button
                        type="button"
                        onClick={voiceInput.isListening ? voiceInput.stopListening : voiceInput.startListening}
                        className={`rounded p-1.5 transition-all ${
                          voiceInput.isListening
                            ? "text-critical animate-pulse"
                            : "text-fg-muted hover:text-amber"
                        }`}
                        title={voiceInput.isListening ? "Stop dictation" : "Dictate message"}
                      >
                        {voiceInput.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </button>
                    )}
                    {isRecording ? (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="flex items-center gap-1.5 rounded px-2 py-1 border border-critical/40 bg-critical/10 text-[10px] font-bold font-mono text-critical animate-pulse"
                        title="Stop and send recording"
                      >
                        <span className="h-2 w-2 rounded-full bg-critical" />
                        {String(Math.floor(recordingTime / 60)).padStart(2, "0")}:{String(recordingTime % 60).padStart(2, "0")}
                      </button>
                    ) : (
                      mediaSupported && (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="rounded p-1.5 text-fg-muted hover:text-critical transition-all"
                          title="Record voice note"
                        >
                          <AudioLines className="h-4 w-4" />
                        </button>
                      )
                    )}
                    <button type="submit" className="rounded p-1.5 text-healthy hover:bg-emerald-500/20 transition-all">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div ref={logScrollRef} className="h-full overflow-y-auto space-y-1.5 font-mono text-xs">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-3 bg-surface/40 p-2 rounded border border-border/60">
                    <span className="text-fg-muted shrink-0">[{new Date(log.logged_at).toLocaleTimeString()}]</span>
                    <span className={`font-bold shrink-0 ${log.level === "error" ? "text-rose-500" : log.level === "warn" ? "text-amber" : "text-blue-400"}`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="text-fg-secondary">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

          {/* Right Pane: Root Cause Hypotheses + Quick Controls */}
          <div className="flex w-full shrink-0 flex-col bg-surface/40 border-t border-border p-4 space-y-5 lg:w-96 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:p-5">
          {/* Incident Info Card */}
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-fg-primary mb-1">{incident.title}</h2>
            <p className="text-[11px] text-fg-muted leading-relaxed mb-3">{incident.description || "No details provided."}</p>
            <div className="flex flex-wrap gap-1.5">
              {incident.services?.map((s) => (
                <span key={s.id} className="rounded bg-elevated border border-border px-2 py-0.5 text-[9px] font-mono text-healthy">
                  {s.name}
                </span>
              ))}
            </div>
          </div>

          {/* Root Cause Hypotheses Panel */}
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="flex items-center justify-between mb-3">
          <div className="flex flex-wrap items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-fg-primary">
                  Root Cause Hypotheses ({hypotheses.length})
                </h3>
              </div>
              <button
                onClick={() => setShowAddHypothesis(!showAddHypothesis)}
                className="rounded border border-amber-500/40 bg-amber-500/10 p-1 text-amber hover:bg-amber-500/20 transition-all"
                title="Add Root Cause Hypothesis"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Create Hypothesis Form */}
            {showAddHypothesis && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-canvas p-3 space-y-2">
                <input
                  type="text"
                  placeholder="Hypothesis Title (e.g. DB Connection Exhaustion)"
                  value={newHypothesisTitle}
                  onChange={(e) => setNewHypothesisTitle(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-2.5 py-1 text-xs text-fg-primary outline-none focus:border-amber"
                />
                <div>
                  <div className="flex justify-between text-[10px] text-fg-muted mb-1">
                    <span>Confidence Score</span>
                    <span className="font-mono text-amber">{newHypothesisConfidence}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={newHypothesisConfidence}
                    onChange={(e) => setNewHypothesisConfidence(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
                <textarea
                  placeholder="Evidence list (1 per line)..."
                  value={newHypothesisEvidence}
                  onChange={(e) => setNewHypothesisEvidence(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-border bg-surface px-2.5 py-1 text-xs text-fg-primary outline-none focus:border-amber resize-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowAddHypothesis(false)}
                    className="rounded border border-border px-2.5 py-1 text-[10px] text-fg-muted hover:bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateHypothesis}
                    disabled={!newHypothesisTitle.trim() || submittingHypothesis}
                    className="rounded bg-amber-500 px-3 py-1 text-[10px] font-bold text-black hover:bg-amber disabled:opacity-50"
                  >
                    Save Hypothesis
                  </button>
                </div>
              </div>
            )}

            {/* Hypotheses List */}
            <div className="space-y-2.5">
              {hypotheses.map((h) => (
                <div
                  key={h.id}
                  className={`rounded-lg border p-3 transition-all ${
                    h.status === "ruled_out"
                      ? "border-border bg-canvas/40 opacity-60"
                      : h.status === "confirmed"
                      ? "border-healthy/40 bg-healthy/10"
                      : h.status === "investigating"
                      ? "border-amber/40 bg-amber/10"
                      : "border-border bg-canvas/80"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs font-bold ${h.status === "ruled_out" ? "line-through text-fg-muted" : "text-fg-primary"}`}>
                      {h.title}
                    </span>
                    <button
                      onClick={() => handleDeleteHypothesis(h.id)}
                      className="text-fg-muted hover:text-critical transition-colors"
                      title="Delete hypothesis"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Confidence meter */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[10px] text-fg-muted mb-0.5">
                      <span>CONFIDENCE</span>
                      <span className="font-mono text-amber font-bold">{h.confidence}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber rounded-full transition-all"
                        style={{ width: `${h.confidence}%` }}
                      />
                    </div>
                  </div>

                  {/* Evidence List */}
                  {h.evidence && h.evidence.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {h.evidence.map((ev, i) => (
                        <p key={i} className="text-[10px] text-fg-muted flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-amber" />
                          {ev}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons for Hypothesis Status */}
                  <div className="flex items-center gap-1 pt-1 border-t border-border/80">
                    <button
                      onClick={() => handleUpdateHypothesisStatus(h.id, "investigating")}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        h.status === "investigating" ? "bg-amber-500 text-black" : "bg-elevated text-fg-muted hover:bg-hover-row"
                      }`}
                    >
                      INVESTIGATING
                    </button>
                    <button
                      onClick={() => handleUpdateHypothesisStatus(h.id, "confirmed")}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        h.status === "confirmed" ? "bg-healthy text-black" : "bg-elevated text-fg-muted hover:bg-hover-row"
                      }`}
                    >
                      CONFIRMED
                    </button>
                    <button
                      onClick={() => handleUpdateHypothesisStatus(h.id, "ruled_out")}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        h.status === "ruled_out" ? "bg-critical text-white" : "bg-elevated text-fg-muted hover:bg-hover-row"
                      }`}
                    >
                      RULED OUT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Command Actions */}
          <div className="rounded-lg border border-border bg-surface/60 p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-fg-primary mb-2">Command Remediation</h3>
            <button
              onClick={handleAcknowledge}
              disabled={acknowledged || acknowledging}
              className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-xs font-bold transition-all ${
                acknowledged
                  ? "border-emerald-500/40 bg-emerald-500/10 text-healthy"
                  : "border-border bg-surface text-fg-primary hover:border-emerald-500/50"
              }`}
            >
              <span>{acknowledged ? "ACKNOWLEDGED ✓" : "ACKNOWLEDGE INCIDENT"}</span>
              <CheckCircle className="h-4 w-4 text-healthy" />
            </button>
            <button
              onClick={handleEscalate}
              disabled={escalated || escalating}
              className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-xs font-bold transition-all ${
                escalated
                  ? "border-rose-500/40 bg-critical/10 text-critical"
                  : "border-border bg-surface text-fg-primary hover:border-rose-500/50"
              }`}
            >
              <span>{escalated ? "ESCALATED ✓" : "ESCALATE SEVERITY"}</span>
              <AlertTriangle className="h-4 w-4 text-amber" />
            </button>
            <button
              onClick={handleAttachLogs}
              disabled={logsAttached}
              className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-xs font-bold transition-all ${
                logsAttached
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                  : "border-border bg-surface text-fg-primary hover:border-blue-500/50"
              }`}
            >
              <span>{logsAttached ? "LOGS ATTACHED ✓" : "ATTACH TELEMETRY BUS"}</span>
              <Paperclip className="h-4 w-4 text-blue-400" />
            </button>
          </div>

          <AgentPanel incidentId={incident.id} embedded />
        </div>
      </div>
    </div>
  );
}
