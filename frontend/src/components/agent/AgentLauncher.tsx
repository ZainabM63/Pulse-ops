"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AgentRun, Incident } from "@/types";
import { Zap, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  incidentId?: number | null;
  incidents?: Incident[];
  onRunCreated: (run: AgentRun) => void;
}

export function AgentLauncher({ incidentId, incidents, onRunCreated }: Props) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"sequential" | "autonomous">("sequential");
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(incidentId ?? null);
  const [launching, setLaunching] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const handleLaunch = async () => {
    if (!message.trim() || launching) return;
    setLaunching(true);
    try {
      const res = await api.post<{ run: AgentRun }>("/agent/runs", {
        incident_id: selectedIncidentId,
        message: message.trim(),
        mode,
      });
      onRunCreated(res.run);
      setMessage("");
    } catch (err) {
      console.error("Failed to launch agent:", err);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber" />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-fg-primary">PulseOps Agent</h3>
        <span className="rounded bg-amber/10 px-1.5 py-0.5 text-[8px] font-bold text-amber">AI</span>
      </div>

      <p className="mb-3 text-[10px] text-fg-muted">
        Describe what you need. The agent will analyze the situation and execute remediation actions.
      </p>

      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("sequential")}
            className={`rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              mode === "sequential"
                ? "border-amber/40 bg-amber/10 text-amber"
                : "border-border bg-canvas text-fg-muted hover:text-fg-primary"
            }`}
          >
            Sequential
          </button>
          <button
            onClick={() => setMode("autonomous")}
            className={`rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              mode === "autonomous"
                ? "border-healthy/40 bg-healthy/10 text-healthy"
                : "border-border bg-canvas text-fg-muted hover:text-fg-primary"
            }`}
          >
            Autonomous
          </button>
        </div>
        <p className="text-[8px] text-fg-muted">
          {mode === "sequential"
            ? "Step-by-step: agent proposes actions, you approve each one"
            : "Autonomous: agent executes all actions automatically"}
        </p>
      </div>

      {incidents && incidents.length > 0 && !incidentId && (
        <div className="mb-3">
          <button
            onClick={() => setOptionsOpen(!optionsOpen)}
            className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-fg-muted hover:text-fg-secondary"
          >
            {selectedIncidentId ? `Linked to INC-${String(selectedIncidentId).padStart(4, "0")}` : "Link to incident (optional)"}
            {optionsOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          </button>
          {optionsOpen && (
            <div className="mt-1 max-h-32 overflow-y-auto rounded border border-border bg-canvas">
              <button
                onClick={() => { setSelectedIncidentId(null); setOptionsOpen(false); }}
                className={`w-full px-2 py-1 text-left text-[10px] hover:bg-hover-row ${
                  !selectedIncidentId ? "text-amber" : "text-fg-primary"
                }`}
              >
                None (global)
              </button>
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => { setSelectedIncidentId(inc.id); setOptionsOpen(false); }}
                  className={`w-full px-2 py-1 text-left text-[10px] hover:bg-hover-row ${
                    selectedIncidentId === inc.id ? "text-amber" : "text-fg-primary"
                  }`}
                >
                  INC-{String(inc.id).padStart(4, "0")} — {inc.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleLaunch(); }} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g., Check what's wrong with payments and fix it"
          className="flex-1 rounded border border-border bg-canvas px-3 py-2 text-[11px] text-fg-primary placeholder-fg-muted/50 outline-none transition-colors focus:border-amber"
          disabled={launching}
        />
        <button
          type="submit"
          disabled={launching || !message.trim()}
          className="rounded bg-amber px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-fg transition-colors hover:bg-amber-hover disabled:opacity-50"
        >
          {launching ? "..." : "Launch"}
        </button>
      </form>
    </div>
  );
}
