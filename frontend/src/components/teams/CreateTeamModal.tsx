"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { PaginatedResponse } from "@/types";
import { X } from "lucide-react";

interface TeamMember {
  id: number;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTeamModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      api.get<PaginatedResponse<TeamMember>>("/teams/users?per_page=100")
        .then((res) => setUsers(res.data))
        .catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/teams", {
        name,
        slug,
        description: description || undefined,
        user_ids: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      });
      setName("");
      setSlug("");
      setSlugEdited(false);
      setDescription("");
      setSelectedUserIds([]);
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded border border-border bg-surface shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber">Create Team</h2>
            <p className="text-[10px] text-fg-muted">Add a new engineering team to your workspace</p>
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
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Team Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onInput={() => {
                if (!slugEdited) {
                  setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                }
              }}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30"
              placeholder="e.g. Platform Infrastructure"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Slug *</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
              className="w-full rounded border border-border bg-canvas px-3 py-2 font-mono text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30"
              placeholder="platform-infra"
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
              placeholder="Describe the team's responsibilities..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Assign Members</label>
            <div className="max-h-36 space-y-1 rounded border border-border bg-canvas p-2 overflow-y-auto">
              {users.map((user) => (
                <label
                  key={user.id}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-[10px] transition-colors cursor-pointer ${
                    selectedUserIds.includes(user.id) ? "bg-amber/5 text-amber" : "text-fg-secondary hover:bg-hover-row"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(user.id)}
                    onChange={() => toggleUser(user.id)}
                    className="h-3 w-3 rounded border-border accent-amber"
                  />
                  {user.name}
                </label>
              ))}
              {users.length === 0 && <span className="text-[10px] text-fg-muted">No users available</span>}
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
              disabled={loading || !name}
              className="rounded bg-amber px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-fg transition-colors hover:bg-amber-hover disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
