"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Team, PaginatedResponse } from "@/types";
import { X } from "lucide-react";

interface TeamMember {
  id: number;
  name: string;
}

interface Props {
  team: Team;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditTeamModal({ team, onClose, onUpdated }: Props) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || "");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(
    team.users?.map((u) => u.id) || []
  );
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<PaginatedResponse<TeamMember>>("/teams/users?per_page=100")
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, []);

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
      await api.put(`/teams/${team.id}`, {
        name,
        description: description || undefined,
        user_ids: selectedUserIds,
      });
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded border border-border bg-surface shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber">Edit Team</h2>
            <p className="text-[10px] text-fg-muted">#{team.slug}</p>
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
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Team Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-xs text-fg-primary placeholder-fg-muted outline-none transition-colors focus:border-amber focus:ring-1 focus:ring-amber/30"
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
            <label className="text-[10px] uppercase tracking-widest text-fg-muted">Members ({selectedUserIds.length})</label>
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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
