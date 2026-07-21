"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SeverityBadge } from "./SeverityBadge";
import { StatusBadge } from "./StatusBadge";
import { getDuration } from "@/types";
import type { Incident } from "@/types";
import { ExternalLink, CheckCircle, UserPlus, Check } from "lucide-react";

const blastRadiusMock: Record<string, string> = {
  critical: "~18,400",
  major: "~8,200",
  minor: "~1,100",
  info: "~200",
};

const mockUsers = [
  { id: 1, name: "Sarah Chen" },
  { id: 2, name: "Marcus Rivera" },
  { id: 3, name: "Aisha Patel" },
];

interface Props {
  incident: Incident;
  onRefresh: () => void;
}

export function IncidentRow({ incident, onRefresh }: Props) {
  const router = useRouter();
  const isCritical = incident.severity === "critical";
  const blastRadius = blastRadiusMock[incident.severity] || "~0";
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const reassignRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (reassignRef.current && !reassignRef.current.contains(e.target as Node)) {
        setReassignOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAcknowledge = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (acknowledging || acknowledged) return;
    setAcknowledging(true);
    try {
      await api.put(`/incidents/${incident.id}`, {
        comment: "Incident acknowledged by responder",
      });
      setAcknowledged(true);
      onRefresh();
    } catch {
      // silently fail
    } finally {
      setAcknowledging(false);
    }
  };

  const handleReassign = async (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    setReassigning(true);
    try {
      await api.put(`/incidents/${incident.id}`, {
        assignee_id: userId,
      });
      setReassignOpen(false);
      onRefresh();
    } catch {
      // silently fail
    } finally {
      setReassigning(false);
    }
  };

  return (
    <div
      onClick={() => router.push(`/incidents/${incident.id}`)}
      className={`grid grid-cols-[70px_1fr_90px_70px_150px_180px] gap-3 border-b border-border bg-surface px-4 py-2.5 transition-colors cursor-pointer hover:bg-hover-row ${
        isCritical ? "border-l-2 border-l-critical glow-crimson" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <SeverityBadge severity={incident.severity} />
      </div>

      <div className="min-w-0 flex items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-fg-muted">INC-{String(incident.id).padStart(4, "0")}</span>
          </div>
          <p className="truncate text-[11px] font-medium text-fg-primary">{incident.title}</p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {incident.services?.map((s) => (
              <span key={s.id} className="rounded bg-elevated px-1.5 py-0.5 text-[8px] font-medium text-fg-muted">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center">
        <span className="font-mono text-[11px] text-amber">{blastRadius}</span>
        <span className="ml-1 text-[9px] text-fg-muted">users</span>
      </div>

      <div className="flex items-center">
        <span className="font-mono text-[11px] text-fg-muted">{getDuration(incident.created_at)}</span>
      </div>

      <div className="flex items-center min-w-0">
        {incident.assignee ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/20 text-[9px] font-bold text-amber">
              {incident.assignee.name?.charAt(0)}
            </div>
            <span className="truncate text-[10px] text-fg-secondary">{incident.assignee.name}</span>
          </div>
        ) : (
          <span className="text-[10px] italic text-fg-muted">Unassigned</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-1">
        <StatusBadge status={incident.status} />
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/incidents/${incident.id}`); }}
          className="ml-1 rounded p-0.5 text-fg-muted transition-colors hover:text-amber"
          title="View detail"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
        <button
          onClick={handleAcknowledge}
          className={`rounded p-0.5 transition-colors ${
            acknowledged ? "text-healthy" : "text-fg-muted hover:text-healthy"
          }`}
          title={acknowledged ? "Acknowledged" : "Acknowledge"}
          disabled={acknowledging}
        >
          {acknowledged ? <Check className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
        </button>
        <div className="relative" ref={reassignRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setReassignOpen(!reassignOpen); }}
            className="rounded p-0.5 text-fg-muted transition-colors hover:text-amber"
            title="Reassign"
            disabled={reassigning}
          >
            <UserPlus className="h-3 w-3" />
          </button>
          {reassignOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded border border-border bg-surface shadow-lg shadow-black/30">
              <div className="px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-widest text-fg-muted">Reassign to</p>
              </div>
              {mockUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={(e) => handleReassign(e, u.id)}
                  disabled={reassigning || incident.assignee?.id === u.id}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-[10px] transition-colors ${
                    incident.assignee?.id === u.id
                      ? "text-amber bg-amber/5"
                      : "text-fg-primary hover:bg-hover-row"
                  } disabled:opacity-50`}
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-amber/20 text-[8px] font-bold text-amber">
                    {u.name.charAt(0)}
                  </div>
                  {u.name}
                  {incident.assignee?.id === u.id && (
                    <span className="ml-auto text-[8px] text-amber">current</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
