"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Team, PaginatedResponse } from "@/types";
import { CreateTeamModal } from "@/components/teams/CreateTeamModal";
import { EditTeamModal } from "@/components/teams/EditTeamModal";
import { Users, Plus, Trash2 } from "lucide-react";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTeams = () => {
    setLoading(true);
    api.get<PaginatedResponse<Team>>("/teams?per_page=100")
      .then((res) => setTeams(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleDelete = async (id: number) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/teams/${id}`);
      setTeams((prev) => prev.filter((t) => t.id !== id));
      setToast("Team deleted.");
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Failed to delete team.");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const handleTeamCreated = () => {
    setCreateModalOpen(false);
    fetchTeams();
    setToast("Team created successfully.");
    setTimeout(() => setToast(null), 3000);
  };

  const handleTeamUpdated = () => {
    setEditTeam(null);
    fetchTeams();
    setToast("Team updated successfully.");
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-amber" />
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider">Engineering Teams</h1>
            <p className="mt-0.5 text-[10px] text-fg-muted">
              {teams.length} {teams.length === 1 ? "team" : "teams"} total
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded bg-amber px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-fg transition-colors hover:bg-amber-hover"
        >
          <Plus className="h-3 w-3" />
          Create Team
        </button>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-amber" />
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded border border-border bg-surface py-12 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-fg-muted/30" />
          <p className="text-[11px] text-fg-muted">No teams created yet</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="mt-3 text-[10px] text-amber hover:underline"
          >
            Create your first team
          </button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded border border-border bg-surface transition-colors hover:border-amber/20"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-amber/10">
                    <Users className="h-4 w-4 text-amber" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-fg-primary">{team.name}</h3>
                    <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[8px] text-fg-muted">
                      #{team.slug}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditTeam(team)}
                    className="rounded p-1.5 text-fg-muted transition-colors hover:bg-hover-row hover:text-amber"
                    title="Edit team"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {confirmDeleteId === team.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded border border-border px-1.5 py-0.5 text-[8px] text-fg-muted hover:bg-hover-row"
                      >
                        No
                      </button>
                      <button
                        onClick={() => handleDelete(team.id)}
                        disabled={deleting}
                        className="rounded border border-critical/30 bg-critical/10 px-1.5 py-0.5 text-[8px] text-critical hover:bg-critical/20"
                      >
                        {deleting ? "..." : "Yes"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(team.id)}
                      className="rounded p-1.5 text-fg-muted transition-colors hover:bg-hover-row hover:text-critical"
                      title="Delete team"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="px-4 py-3">
                {team.description && (
                  <p className="mb-2 text-[10px] text-fg-muted">{team.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-fg-muted">
                    {team.users?.length ?? 0} {(team.users?.length ?? 0) === 1 ? "member" : "members"}
                  </span>
                  {team.users && team.users.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {team.users.slice(0, 5).map((m) => (
                        <div
                          key={m.id}
                          className="flex h-5 w-5 items-center justify-center rounded-full border border-surface bg-amber/20 text-[8px] font-bold text-amber"
                          title={m.name}
                        >
                          {m.name.charAt(0)}
                        </div>
                      ))}
                      {team.users.length > 5 && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-surface bg-elevated text-[8px] text-fg-muted">
                          +{team.users.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateTeamModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleTeamCreated}
      />

      {editTeam && (
        <EditTeamModal
          team={editTeam}
          onClose={() => setEditTeam(null)}
          onUpdated={handleTeamUpdated}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded border border-healthy/30 bg-surface px-4 py-2 text-[11px] text-healthy shadow-lg shadow-black/20">
          {toast}
        </div>
      )}
    </div>
  );
}
