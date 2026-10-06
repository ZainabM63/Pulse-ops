"use client";

import { useEffect } from "react";
import type { AgentAction } from "@/types";
import { X, Clock, CheckCircle, XCircle, Loader2, SkipForward } from "lucide-react";

interface Props {
  action: AgentAction | null;
  onClose: () => void;
}

const statusIcon: Record<string, React.ReactNode> = {
  pending:   <Clock className="h-3.5 w-3.5 text-fg-muted" />,
  running:   <Loader2 className="h-3.5 w-3.5 animate-spin text-amber" />,
  completed: <CheckCircle className="h-3.5 w-3.5 text-healthy" />,
  failed:    <XCircle className="h-3.5 w-3.5 text-critical" />,
  skipped:   <SkipForward className="h-3.5 w-3.5 text-fg-muted" />,
};

const statusColor: Record<string, string> = {
  pending: "text-fg-muted",
  running: "text-amber",
  completed: "text-healthy",
  failed: "text-critical",
  skipped: "text-fg-muted",
};

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function ValueView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const indent = depth * 12;

  if (value === null || value === undefined) {
    return <span className="text-fg-muted italic">null</span>;
  }

  if (typeof value === "string") {
    const isLong = value.length > 120;
    return (
      <span className="text-fg-primary break-words" style={{ maxHeight: isLong ? 120 : undefined }}>
        {isLong ? (
          <span className="block max-h-32 overflow-y-auto text-[10px] leading-relaxed">{value}</span>
        ) : (
          `"${value}"`
        )}
      </span>
    );
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-info">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-fg-muted italic">[empty]</span>;
    return (
      <div className="space-y-0.5">
        {value.map((item, i) => (
          <div key={i} className="flex gap-1.5" style={{ paddingLeft: indent + 12 }}>
            <span className="text-fg-muted shrink-0">-</span>
            <ValueView value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-fg-muted italic">[empty]</span>;
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2" style={{ paddingLeft: indent }}>
            <span className="text-fg-muted shrink-0 font-mono text-[10px]">{k}:</span>
            <div className="min-w-0 flex-1">
              <ValueView value={v} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-fg-primary">{String(value)}</span>;
}

export function AgentActionModal({ action, onClose }: Props) {
  useEffect(() => {
    if (!action) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [action, onClose]);

  if (!action) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg mx-4 max-h-[80vh] flex flex-col rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span>{statusIcon[action.status]}</span>
            <span className="text-[11px] font-bold text-fg-primary truncate">{action.label}</span>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${statusColor[action.status]}`}>
              {action.status}
            </span>
          </div>
          <button onClick={onClose} className="shrink-0 rounded p-1 text-fg-muted transition-colors hover:text-fg-primary hover:bg-hover-row">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[10px]">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-fg-muted">
            <span>Type: <span className="text-fg-secondary">{action.type}</span></span>
            <span>Created: <span className="text-fg-secondary">{formatTime(action.created_at)}</span></span>
            {action.executed_at && (
              <span>Executed: <span className="text-fg-secondary">{formatTime(action.executed_at)}</span></span>
            )}
          </div>

          {action.input && Object.keys(action.input).length > 0 && (
            <div>
              <h4 className="mb-1 text-[9px] font-bold uppercase tracking-wider text-fg-muted">Input</h4>
              <div className="rounded border border-border bg-canvas p-2">
                <ValueView value={action.input} />
              </div>
            </div>
          )}

          {action.output && (
            <div>
              <h4 className="mb-1 text-[9px] font-bold uppercase tracking-wider text-healthy">Output</h4>
              <div className="rounded border border-healthy/20 bg-healthy/5 p-2">
                <ValueView value={action.output} />
              </div>
            </div>
          )}

          {action.error && (
            <div>
              <h4 className="mb-1 text-[9px] font-bold uppercase tracking-wider text-critical">Error</h4>
              <div className="rounded border border-critical/20 bg-critical/5 p-2 text-critical break-words">
                {action.error}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-2.5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-elevated px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-primary transition-colors hover:bg-hover-row"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
