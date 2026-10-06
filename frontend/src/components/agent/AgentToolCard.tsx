"use client";

import { AGENT_TOOLS } from "@/types";
import type { AgentAction } from "@/types";
import { CheckCircle, XCircle, Clock, Loader2, SkipForward, RefreshCw } from "lucide-react";

interface Props {
  action: AgentAction;
  onRetry?: (actionId: number) => void;
  onInspect?: (action: AgentAction) => void;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  pending:  { icon: <Clock className="h-3 w-3" />,         color: "text-fg-muted",   bgColor: "border-border bg-canvas" },
  running:  { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: "text-amber", bgColor: "border-amber/40 bg-amber/5" },
  completed:{ icon: <CheckCircle className="h-3 w-3" />,   color: "text-healthy",   bgColor: "border-healthy/40 bg-healthy/5" },
  failed:   { icon: <XCircle className="h-3 w-3" />,       color: "text-critical",  bgColor: "border-critical/40 bg-critical/5" },
  skipped:  { icon: <SkipForward className="h-3 w-3" />,   color: "text-fg-muted",  bgColor: "border-border bg-canvas opacity-50" },
};

export function AgentToolCard({ action, onRetry, onInspect }: Props) {
  const toolInfo = AGENT_TOOLS[action.type as keyof typeof AGENT_TOOLS];
  const cfg = statusConfig[action.status] || statusConfig.pending;
  const colorClass = toolInfo ? `text-${toolInfo.color}` : "text-fg-muted";

  return (
    <div
      className={`rounded border p-3 ${cfg.bgColor} ${onInspect ? "cursor-pointer transition-colors hover:ring-1 hover:ring-amber/40" : ""}`}
      onClick={() => onInspect?.(action)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cfg.color}>{cfg.icon}</span>
          <span className="text-[11px] font-bold text-fg-primary">{action.label}</span>
          {toolInfo && (
            <span className={`text-[8px] uppercase tracking-wider ${colorClass}`}>
              {toolInfo.color}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.color}`}>
            {action.status}
          </span>
          {action.status === "failed" && onRetry && (
            <button
              onClick={() => onRetry(action.id)}
              className="rounded p-0.5 text-fg-muted transition-colors hover:text-amber"
              title="Retry"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {action.input && Object.keys(action.input).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(action.input).map(([key, val]) => (
            <span key={key} className="rounded bg-elevated px-1.5 py-0.5 text-[8px] text-fg-muted">
              {key}: <span className="text-fg-secondary">{String(val)}</span>
            </span>
          ))}
        </div>
      )}

      {action.output && (
        <div className="mt-2 rounded bg-healthy/5 px-2 py-1.5 text-[9px] text-healthy">
          {typeof action.output === "object"
            ? Object.entries(action.output as Record<string, unknown>)
                .filter(([k]) => k !== "services" && k !== "report")
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(" | ")
            : String(action.output)}
        </div>
      )}

      {action.error && (
        <div className="mt-2 rounded bg-critical/5 px-2 py-1.5 text-[9px] text-critical">
          {action.error}
        </div>
      )}
    </div>
  );
}
