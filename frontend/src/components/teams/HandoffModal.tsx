"use client";

import { useState } from "react";
import { X, AlertTriangle, ArrowRight, Send } from "lucide-react";

interface Props {
  open: boolean;
  teamName: string;
  teamMembers: { id: number; name: string }[];
  onClose: () => void;
  onSubmit: (note: string, flags: string[], transferTo: number | null) => void;
}

const MOCK_FLAGS = [
  "Redis cache memory leak not resolved",
  "Auth service connection pool at 85%",
  "Pending canary deployment rollback",
];

export function HandoffModal({ open, teamName, teamMembers, onClose, onSubmit }: Props) {
  const [note, setNote] = useState("");
  const [selectedFlags, setSelectedFlags] = useState<Set<number>>(new Set());
  const [transferTo, setTransferTo] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const toggleFlag = (idx: number) => {
    setSelectedFlags((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmitting(true);
    const flags = [...selectedFlags].map((i) => MOCK_FLAGS[i]);
    onSubmit(note, flags, transferTo ? Number(transferTo) : null);
    setTimeout(() => {
      setNote("");
      setSelectedFlags(new Set());
      setTransferTo("");
      setSubmitting(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded border border-border bg-surface shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber">Shift Handoff</h2>
            <p className="text-[10px] text-fg-muted">Transfer pager token for {teamName}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-fg-muted transition-colors hover:text-fg-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Handover Note */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-fg-muted">Handover Note *</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30 resize-none"
              placeholder="Describe the current state, actions taken, and any open items..."
              required
            />
          </div>

          {/* Unresolved Warning Flags */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-fg-muted">
              <AlertTriangle className="h-3 w-3 text-degraded" />
              Unresolved Warning Flags
            </label>
            <div className="space-y-1.5 rounded border border-border bg-canvas p-2.5">
              {MOCK_FLAGS.map((flag, idx) => (
                <label
                  key={idx}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-[10px] transition-colors cursor-pointer ${
                    selectedFlags.has(idx) ? "bg-degraded/5 text-degraded" : "text-fg-secondary hover:bg-hover-row"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFlags.has(idx)}
                    onChange={() => toggleFlag(idx)}
                    className="h-3 w-3 rounded border-border accent-degraded"
                  />
                  {flag}
                </label>
              ))}
            </div>
          </div>

          {/* Transfer Pager Token */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-fg-muted">
              <ArrowRight className="h-3 w-3 text-amber" />
              Transfer Pager Token To
            </label>
            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary outline-none focus:border-amber"
            >
              <option value="">Keep current on-call</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition-colors hover:text-fg-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !note.trim()}
              className="inline-flex items-center gap-1.5 rounded bg-amber px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-fg transition-colors hover:bg-amber-hover disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
              {submitting ? "Submitting..." : "Submit Handoff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
