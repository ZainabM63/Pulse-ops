"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Team, PaginatedResponse } from "@/types";
import { CreateTeamModal } from "@/components/teams/CreateTeamModal";
import { EditTeamModal } from "@/components/teams/EditTeamModal";
import { Users, Plus, Trash2, ShieldCheck, Clock, Activity, Edit3 } from "lucide-react";

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
      .then((res) => setTeams(res.data || []))
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
      setToast("Team deleted successfully.");
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
    <div className="p-4 sm:p-6 bg-canvas min-h-full text-fg-primary font-sans space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber" />
            <h1 className="text-sm font-extrabold uppercase tracking-widest text-fg-primary">
              Engineering Teams & On-Call Shift Hub
            </h1>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            Escalation policies, active primary/secondary on-call responders, and engineer fatigue analytics.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber hover:bg-amber-500/20 transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Team
        </button>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-healthy font-mono text-xs">
            <Activity className="h-5 w-5 animate-spin text-amber" />
            <span>FETCHING TEAM ROTATIONS...</span>
          </div>
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface/40 p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-fg-muted" />
          <p className="text-xs font-mono text-fg-muted">NO ENGINEERING TEAMS CONFIGURED</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="mt-4 text-xs font-bold text-amber hover:underline"
          >
            + Create initial team
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-xl border border-border bg-surface/60 p-5 shadow-xl transition-all hover:border-amber/40 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <Users className="h-4 w-4 text-amber" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-fg-primary">{team.name}</h3>
                      <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[9px] text-amber border border-border">
                        #{team.slug}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditTeam(team)}
                      className="rounded-md p-1.5 text-fg-muted hover:bg-hover-row hover:text-amber transition-colors"
                      title="Edit team"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    {confirmDeleteId === team.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded border border-border px-1.5 py-0.5 text-[9px] text-fg-muted hover:bg-hover-row"
                        >
                          No
                        </button>
                        <button
                          onClick={() => handleDelete(team.id)}
                          disabled={deleting}
                          className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-critical hover:bg-rose-500/20"
                        >
                          {deleting ? "..." : "Yes"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(team.id)}
                        className="rounded-md p-1.5 text-fg-muted hover:bg-hover-row hover:text-critical transition-colors"
                        title="Delete team"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {team.description && (
                  <p className="mt-3 text-xs text-fg-muted leading-relaxed">{team.description}</p>
                )}

                {/* On-call Rotation HUD */}
                <div className="mt-4 rounded-lg border border-border bg-canvas p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-fg-muted">
                    <span className="flex items-center gap-1 text-healthy">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      PRIMARY ON-CALL
                    </span>
                    <span>12h SHIFT REMAINING</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-fg-primary">
                      {team.users && team.users[0] ? team.users[0].name : "Primary Responder"}
                    </span>
                    <span className="text-[9px] font-mono text-fg-muted">SLA: 5m ACK</span>
                  </div>
                </div>
              </div>

              {/* Members roster footer */}
              <div className="pt-3 border-t border-border/80 flex items-center justify-between">
                <span className="text-xs text-fg-muted">
                  {team.users?.length ?? 0} {(team.users?.length ?? 0) === 1 ? "engineer" : "engineers"}
                </span>
                {team.users && team.users.length > 0 && (
                  <div className="flex -space-x-1.5">
                    {team.users.slice(0, 5).map((m) => (
                      <div
                        key={m.id}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-amber/20 text-[9px] font-bold text-amber"
                        title={m.name}
                      >
                        {m.name.charAt(0)}
                      </div>
                    ))}
                    {team.users.length > 5 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-elevated text-[9px] text-fg-muted">
                        +{team.users.length - 5}
                      </div>
                    )}
                  </div>
                )}
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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-emerald-500/40 bg-surface/90 px-4 py-2.5 text-xs font-bold text-healthy shadow-2xl backdrop-blur-md">
          {toast}
        </div>
      )}
    </div>
  );
}
