"use client";

import { useState } from "react";
import type { Team } from "@/types";
import { X, ArrowLeft, Users, Mail, Shield } from "lucide-react";

interface Props {
  open: boolean;
  teams: Team[];
  onClose: () => void;
}

export function YourTeamsModal({ open, teams, onClose }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded border border-border bg-surface shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            {selectedTeam && (
              <button
                onClick={() => setSelectedTeam(null)}
                className="rounded p-1 text-fg-muted transition-colors hover:text-fg-primary"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber">
                {selectedTeam ? selectedTeam.name : "Your Teams"}
              </h2>
              <p className="text-[10px] text-fg-muted">
                {selectedTeam
                  ? `${selectedTeam.users?.length ?? 0} ${(selectedTeam.users?.length ?? 0) === 1 ? "member" : "members"}`
                  : `${teams.length} ${teams.length === 1 ? "team" : "teams"} created`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-fg-muted transition-colors hover:text-fg-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto p-4">
          {!selectedTeam ? (
            teams.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-fg-muted">No teams created yet</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    className="flex items-center gap-3 rounded border border-border bg-canvas p-3 text-left transition-colors hover:border-amber/30"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-amber/10">
                      <Users className="h-4 w-4 text-amber" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[11px] font-bold text-fg-primary">{team.name}</p>
                        <span className="shrink-0 rounded bg-elevated px-1 py-0.5 font-mono text-[7px] text-fg-muted">
                          #{team.slug}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[9px] text-fg-muted">
                        {team.users?.length ?? 0} {(team.users?.length ?? 0) === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="rounded border border-border bg-canvas px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[8px] text-fg-muted">
                    #{selectedTeam.slug}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-fg-secondary">
                  {selectedTeam.description || "No description provided"}
                </p>
              </div>

              <div>
                <p className="mb-2 text-[9px] uppercase tracking-widest font-bold text-fg-muted">
                  Members ({selectedTeam.users?.length ?? 0})
                </p>
                {(!selectedTeam.users || selectedTeam.users.length === 0) ? (
                  <p className="text-[11px] text-fg-muted">No members assigned</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedTeam.users!.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded border border-border bg-canvas px-3 py-2.5"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber/15 text-[10px] font-bold text-amber">
                          {m.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[11px] font-medium text-fg-primary">{m.name}</p>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-elevated px-1.5 py-0.5 text-[8px] uppercase text-fg-muted">
                              <Shield className="h-2 w-2" />
                              {m.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Mail className="h-2.5 w-2.5 text-fg-muted/50" />
                            <p className="truncate text-[10px] text-fg-muted">{m.email}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
