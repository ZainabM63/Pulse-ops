"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { IncidentActivity } from "@/types";
import { Send } from "lucide-react";

const typeConfig: Record<string, { color: string; label: string }> = {
  comment: { color: "text-fg-muted", label: "Comment" },
  status_change: { color: "text-amber", label: "Status Change" },
  severity_change: { color: "text-amber", label: "Severity Change" },
  assignment: { color: "text-healthy", label: "Assignment" },
};

interface Props {
  activities: IncidentActivity[];
  incidentId: number;
  onCommentAdded: () => void;
}

export function ActivityFeed({ activities, incidentId, onCommentAdded }: Props) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try {
      await api.put(`/incidents/${incidentId}`, {
        comment: comment.trim(),
      });
      setComment("");
      onCommentAdded();
    } catch {
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  return (
    <div className="rounded border border-border bg-surface">
      <div className="max-h-[400px] overflow-y-auto p-4">
        {activities.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-fg-muted">No activity recorded yet</p>
        ) : (
          <div className="space-y-3">
            {[...activities].reverse().map((activity) => {
              const cfg = typeConfig[activity.type] || typeConfig.comment;
              return (
                <div key={activity.id} className="flex gap-3">
                  <span className="shrink-0 font-mono text-[11px] text-healthy">
                    [{formatTime(activity.created_at)}]
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-fg-primary">
                        {activity.user?.name || "System"}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {activity.body && (
                      <p className="mt-0.5 text-[11px] text-fg-secondary">{activity.body}</p>
                    )}
                    {activity.metadata && (
                      <div className="mt-1 flex gap-2">
                        {"old" in activity.metadata && activity.metadata.old != null && (
                          <span className="rounded bg-critical/10 px-1.5 py-0.5 text-[9px] text-critical line-through">
                            {String(activity.metadata.old)}
                          </span>
                        )}
                        {"new" in activity.metadata && activity.metadata.new != null && (
                          <span className="rounded bg-healthy/10 px-1.5 py-0.5 text-[9px] text-healthy">
                            {String(activity.metadata.new)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 rounded border border-border bg-canvas px-3 py-1.5 text-[11px] text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber"
          />
          <button
            type="submit"
            disabled={sending || !comment.trim()}
            className="rounded bg-amber px-3 py-1.5 text-[11px] font-bold text-amber-fg transition-colors hover:bg-amber-hover disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
