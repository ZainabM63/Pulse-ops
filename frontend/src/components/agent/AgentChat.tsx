"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useVoiceOutput } from "@/hooks/useVoiceOutput";
import type { AgentRun, AgentAction } from "@/types";
import { AgentToolCard } from "./AgentToolCard";
import { AgentActionModal } from "./AgentActionModal";
import { Send, XCircle, Play, Loader2, Bot, User, Mic, MicOff, Volume2, VolumeX, Plus, ArrowLeft } from "lucide-react";

interface Props {
  run: AgentRun;
  onRunUpdate: (run: AgentRun) => void;
  onCancel: () => void;
  onNewRun?: () => void;
  compact?: boolean;
}

interface ChatBubble {
  id: number;
  role: "user" | "agent";
  message: string;
  actions?: AgentAction[];
}

export function AgentChat({ run, onRunUpdate, onCancel, onNewRun, compact }: Props) {
  const [input, setInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatBubble[]>([]);
  const [executing, setExecuting] = useState(false);
  const [inspectedAction, setInspectedAction] = useState<AgentAction | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastActionsRef = useRef("");

  const voiceInput = useVoiceInput({
    onResult: (text) => setInput((prev) => prev ? `${prev} ${text}` : text),
  });
  const voiceOutput = useVoiceOutput();

  useEffect(() => {
    if (run.status === "pending" && run.actions.length > 0 && chatMessages.length === 0) {
      const pendingActions = run.actions.filter((a) => a.status === "pending");
      setChatMessages([
        {
          id: Date.now(),
          role: "agent",
          message: `I've analyzed the situation and identified ${pendingActions.length} action(s) to take:${compact ? "" : "\n\n" + pendingActions.map((a) => `• ${a.label}`).join("\n")}${run.mode === "autonomous" ? "\n\nExecuting automatically..." : "\n\nReady to execute. Click 'Run Next' to proceed."}`,
          actions: run.actions,
        },
      ]);
    }
  }, [run.actions, run.mode, run.status, chatMessages.length, compact]);

  useEffect(() => {
    if (run.status === "running") {
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get<{ data: AgentRun }>(`/agent/runs/${run.id}`);
          onRunUpdate(res.data);
        } catch { /* silent */ }
      }, 2000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [run.status, run.id, onRunUpdate]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages, run.actions]);

  useEffect(() => {
    const actionsJson = JSON.stringify(run.actions);
    if (lastActionsRef.current !== actionsJson) {
      lastActionsRef.current = actionsJson;
      setChatMessages((prev) => prev.map((msg) =>
        msg.actions && msg.actions.length > 0 ? { ...msg, actions: run.actions } : msg
      ));
    }
  }, [run.actions, chatMessages]);

  useEffect(() => {
    if (run.status === "completed" || run.status === "failed") {
      const metadata = run.metadata as Record<string, unknown> | null;
      const summary = metadata?.summary;

      if (chatMessages.length === 0) {
        const bubbles: ChatBubble[] = [];
        if (run.actions.length > 0) {
          bubbles.push({
            id: Date.now(),
            role: "agent",
            message: `I've completed ${run.actions.length} action(s) for this run.`,
            actions: run.actions,
          });
        }
        if (summary) {
          bubbles.push({ id: Date.now() + 1, role: "agent", message: String(summary) });
        }
        if (bubbles.length > 0) setChatMessages(bubbles);
        if (summary && typeof window !== "undefined" && "speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(String(summary));
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      } else if (summary && !chatMessages.find((m) => m.message === String(summary))) {
        setChatMessages((prev) => [...prev, {
          id: Date.now(),
          role: "agent",
          message: String(summary),
        }]);
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(String(summary));
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      }
    }
  }, [run.status, run.metadata, chatMessages, run.actions]);

  const handleExecute = useCallback(async () => {
    if (executing) return;
    setExecuting(true);
    try {
      const res = await api.post<{ run: AgentRun; summary?: string }>(`/agent/runs/${run.id}/execute`);
      onRunUpdate(res.run);
    } catch (err) {
      setChatMessages((prev) => [...prev, {
        id: Date.now(),
        role: "agent",
        message: `Execution failed: ${(err as Error).message}`,
      }]);
    } finally {
      setExecuting(false);
    }
  }, [run.id, executing, onRunUpdate]);

  const handleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setChatMessages((prev) => [...prev, { id: Date.now(), role: "user", message: userMsg }]);

    try {
      const res = await api.post<{ run: AgentRun }>(`/agent/runs/${run.id}/chat`, { message: userMsg });
      onRunUpdate(res.run);
      const pending = res.run.actions.filter((a) => a.status === "pending");
      if (pending.length > 0) {
        setChatMessages((prev) => [...prev, {
          id: Date.now(),
          role: "agent",
          message: `I'll add ${pending.length} more action(s): ${pending.map((a) => a.label).join(", ")}`,
          actions: res.run.actions,
        }]);
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, {
        id: Date.now(),
        role: "agent",
        message: `Error: ${(err as Error).message}`,
      }]);
    }
  };

  const handleNewRun = useCallback(() => {
    setChatMessages([]);
    onNewRun?.();
  }, [onNewRun]);

  const isRunning = run.status === "running";
  const isPending = run.status === "pending";
  const isFinished = run.status === "completed" || run.status === "failed" || run.status === "cancelled";
  const isFailed = run.status === "failed" || run.status === "cancelled";
  const nextPending = run.actions.find((a) => a.status === "pending");

  return (
    <div className={`flex flex-col ${compact ? "h-80" : "h-[500px]"} rounded border border-border bg-surface`}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-amber" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-fg-primary">
            {run.status === "completed" ? "Agent Complete" : run.status === "failed" ? "Agent Failed" : "PulseOps Agent"}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${
            isRunning ? "bg-amber/10 text-amber" : isFailed ? "bg-critical/10 text-critical" : isFinished ? "bg-healthy/10 text-healthy" : "bg-elevated text-fg-muted"
          }`}>
            {run.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onNewRun && (
            <button onClick={handleNewRun} className="text-fg-muted transition-colors hover:text-amber" title="Back to launcher">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {!isFinished && (
            <button onClick={onCancel} className="text-fg-muted transition-colors hover:text-critical">
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "agent" && (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber/10">
                <Bot className="h-3 w-3 text-amber" />
              </div>
            )}
            <div className={`max-w-[80%] rounded px-3 py-2 text-[11px] ${
              msg.role === "user"
                ? "bg-amber/10 text-fg-primary"
                : "bg-elevated text-fg-secondary"
            }`}>
              <p className="whitespace-pre-line">{msg.message}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 max-w-full overflow-hidden space-y-1.5">
                  {msg.actions.map((a) => (
                    <AgentToolCard key={a.id} action={a} onRetry={() => handleExecute()} onInspect={setInspectedAction} />
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-elevated">
                <User className="h-3 w-3 text-fg-muted" />
              </div>
            )}
          </div>
        ))}

        {isRunning && (
          <div className="flex items-center gap-2 text-[10px] text-amber">
            <Loader2 className="h-3 w-3 animate-spin" />
            Agent executing...
          </div>
        )}
      </div>

      <div className="border-t border-border p-2">
        <div className="mb-1.5 flex items-center justify-end gap-1.5">
          {voiceInput.isSupported && (
            <button
              type="button"
              onClick={voiceInput.isListening ? voiceInput.stopListening : voiceInput.startListening}
              className={`rounded p-1 transition-colors ${
                voiceInput.isListening ? "text-critical animate-pulse" : "text-fg-muted hover:text-amber"
              }`}
              title={voiceInput.isListening ? "Stop listening" : "Voice to text"}
            >
              {voiceInput.isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            </button>
          )}
          {voiceOutput.isSupported && (
            <button
              type="button"
              onClick={voiceOutput.toggle}
              className={`rounded p-1 transition-colors ${
                voiceOutput.enabled ? "text-amber" : "text-fg-muted hover:text-amber"
              }`}
              title={voiceOutput.enabled ? "Voice output on" : "Voice output off"}
            >
              {voiceOutput.enabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            </button>
          )}
        </div>

        {!isFinished && isPending && nextPending && (
          <div className="mb-2 flex gap-1.5">
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex items-center gap-1.5 rounded bg-amber px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-fg transition-colors hover:bg-amber-hover disabled:opacity-50"
            >
              {executing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {run.mode === "autonomous" ? "Run All" : `Run All Pending (${run.actions.filter(a => a.status === "pending").length})`}
            </button>
          </div>
        )}

        <form onSubmit={handleFollowUp} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={voiceInput.isListening ? "Listening..." : isFinished ? "Ask about this run..." : "Follow-up instruction..."}
            className="flex-1 rounded border border-border bg-canvas px-2 py-1.5 text-[10px] text-fg-primary placeholder-fg-muted/40 outline-none"
            disabled={isRunning}
          />
          <button type="submit" disabled={isRunning || !input.trim()} className="rounded p-1.5 text-amber transition-colors hover:text-amber-hover disabled:opacity-30">
            <Send className="h-3 w-3" />
          </button>
          {isFinished && onNewRun && (
            <button
              type="button"
              onClick={handleNewRun}
              className="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-amber hover:text-amber"
            >
              <Plus className="h-3 w-3" />
              New Run
            </button>
          )}
        </form>
      </div>

      <AgentActionModal action={inspectedAction} onClose={() => setInspectedAction(null)} />
    </div>
  );
}
