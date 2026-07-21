"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Team, Service, PaginatedResponse } from "@/types";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function DeclareIncidentModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string>("critical");
  const [teamId, setTeamId] = useState<string>("");
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      api.get<PaginatedResponse<Team>>("/teams?per_page=100").then((res) => setTeams(res.data)).catch(() => {});
      api.get<PaginatedResponse<Service>>("/services?per_page=100").then((res) => setServices(res.data)).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const toggleService = (id: number) => {
    setServiceIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/incidents", {
        title,
        description: description || undefined,
        severity,
        team_id: teamId ? Number(teamId) : undefined,
        assignee_id: assigneeId ? Number(assigneeId) : undefined,
        service_ids: serviceIds.length > 0 ? serviceIds : undefined,
      });
      setTitle("");
      setDescription("");
      setSeverity("critical");
      setTeamId("");
      setServiceIds([]);
      setAssigneeId("");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create incident");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded border border-border bg-surface shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-critical">Declare Incident</h2>
            <p className="text-[10px] text-fg-muted">Create a new incident and notify responders</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-fg-muted transition-colors hover:text-fg-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="rounded border border-critical/30 bg-critical/10 px-3 py-2 text-[11px] text-critical">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30"
              placeholder="e.g. Elevated 5xx rates on API Gateway"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30 resize-none"
              placeholder="Describe the impact and current state..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-fg-muted">Severity *</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary outline-none focus:border-amber"
              >
                <option value="critical">P0 — Critical</option>
                <option value="major">P1 — Major</option>
                <option value="minor">P2 — Minor</option>
                <option value="info">P3 — Info</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-fg-muted">Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary outline-none focus:border-amber"
              >
                <option value="">Unassigned</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Affected Services</label>
            <div className="flex flex-wrap gap-2 rounded border border-border bg-canvas p-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    serviceIds.includes(s.id)
                      ? "border-amber bg-amber/10 text-amber"
                      : "border-border text-fg-muted hover:border-amber/30"
                  }`}
                >
                  {s.name}
                </button>
              ))}
              {services.length === 0 && <span className="text-[10px] text-fg-muted">No services available</span>}
            </div>
          </div>

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
              disabled={loading || !title}
              className="rounded bg-critical px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-critical/90 disabled:opacity-50"
            >
              {loading ? "Declaring..." : "Declare Incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
