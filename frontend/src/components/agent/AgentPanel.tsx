"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { AgentRun, Incident } from "@/types";
import { AgentLauncher } from "./AgentLauncher";
import { AgentChat } from "./AgentChat";
import { Zap, History, X } from "lucide-react";

interface Props {
  incidentId?: number | null;
  incidents?: Incident[];
  embedded?: boolean;
}

export function AgentPanel({ incidentId, incidents, embedded }: Props) {
  const [activeRun, setActiveRun] = useState<AgentRun | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AgentRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleRunCreated = useCallback((run: AgentRun) => {
    setActiveRun(run);
  }, []);

  const handleRunUpdate = useCallback((run: AgentRun) => {
    setActiveRun(run);
  }, []);

  const handleCancel = useCallback(async () => {
    if (!activeRun) return;
    try {
      const res = await api.post<{ run: AgentRun }>(`/agent/runs/${activeRun.id}/cancel`);
      setActiveRun(res.run);
    } catch { /* silent */ }
  }, [activeRun]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const url = incidentId ? `/agent/runs?incident_id=${incidentId}` : "/agent/runs";
      const res = await api.get<{ data: AgentRun[] }>(url);
      setHistory(res.data || []);
    } catch { /* silent */ }
    setLoadingHistory(false);
  }, [incidentId]);

  const toggleHistory = useCallback(() => {
    if (!showHistory) loadHistory();
    setShowHistory(!showHistory);
  }, [showHistory, loadHistory]);

  return (
    <div className={embedded ? "" : "rounded border border-border bg-surface p-4"}>
      {!embedded && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber" />
            <h3 className="text-[10px] uppercase tracking-widest text-fg-muted">Agent</h3>
          </div>
          <button
            onClick={toggleHistory}
            className="text-fg-muted transition-colors hover:text-fg-primary"
            title="Run history"
          >
            <History className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {showHistory && (
        <div className="mb-3 max-h-48 overflow-y-auto rounded border border-border bg-canvas">
          <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
            <span className="text-[9px] uppercase tracking-wider text-fg-muted">Run History</span>
            <button onClick={() => setShowHistory(false)} className="text-fg-muted hover:text-fg-primary">
              <X className="h-3 w-3" />
            </button>
          </div>
          {loadingHistory ? (
            <p className="p-3 text-center text-[10px] text-fg-muted">Loading...</p>
          ) : history.length === 0 ? (
            <p className="p-3 text-center text-[10px] text-fg-muted">No runs yet</p>
          ) : (
            history.map((r) => (
              <button
                key={r.id}
                onClick={() => { setActiveRun(r); setShowHistory(false); }}
                className="flex w-full items-center justify-between border-b border-border px-2 py-1.5 text-left hover:bg-hover-row last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] text-fg-primary">{r.title}</p>
                  <p className="text-[8px] text-fg-muted">
                    {r.actions.length} actions • {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                  r.status === "completed" ? "bg-healthy/10 text-healthy"
                  : r.status === "failed" ? "bg-critical/10 text-critical"
                  : "bg-elevated text-fg-muted"
                }`}>
                  {r.status}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {activeRun ? (
        <AgentChat
          run={activeRun}
          onRunUpdate={handleRunUpdate}
          onCancel={handleCancel}
          onNewRun={() => setActiveRun(null)}
          compact={embedded}
        />
      ) : (
        <AgentLauncher
          incidentId={incidentId}
          incidents={incidents}
          onRunCreated={handleRunCreated}
        />
      )}
    </div>
  );
}
