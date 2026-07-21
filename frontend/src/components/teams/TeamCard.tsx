"use client";

import { useState } from "react";
import type { TeamCardData } from "@/types";
import {
  Users, ChevronDown, ChevronUp, Clock, AlertTriangle,
  Shield, ArrowRight, MessageSquare
} from "lucide-react";

interface Props {
  team: TeamCardData;
  onHandoff: (teamId: number) => void;
}

export function TeamCard({ team, onHandoff }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);

  const primary = team.onCall.find((o) => o.role === "primary");
  const backup = team.onCall.find((o) => o.role === "backup");

  return (
    <div className="rounded border border-border bg-surface transition-colors hover:border-amber/20">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-amber/10">
            <Users className="h-4 w-4 text-amber" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-fg-primary">{team.name}</h3>
              <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[8px] text-fg-muted">
                {team.serviceTag}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                team.metrics.healthStatus === "operational"
                  ? "bg-healthy/10 text-healthy border border-healthy/30"
                  : "bg-critical/10 text-critical border border-critical/30"
              }`}>
                <span className={`h-1 w-1 rounded-full ${
                  team.metrics.healthStatus === "operational" ? "bg-healthy" : "bg-critical"
                }`} />
                {team.metrics.healthStatus === "operational" ? "OPERATIONAL" : "HIGH INCIDENT LOAD"}
              </span>
              {team.metrics.incidentCount > 0 && (
                <span className="text-[9px] text-fg-muted">
                  {team.metrics.incidentCount} active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="rounded p-1.5 text-fg-muted transition-colors hover:bg-hover-row hover:text-fg-primary"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded border border-border bg-card shadow-lg shadow-black/20">
              <button
                onClick={() => { setDropdownOpen(false); onHandoff(team.id); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[10px] text-fg-primary transition-colors hover:bg-hover-row"
              >
                <ArrowRight className="h-3 w-3 text-amber" />
                Swap Shift
              </button>
              <button
                onClick={() => setDropdownOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-[10px] text-fg-primary transition-colors hover:bg-hover-row"
              >
                <Shield className="h-3 w-3 text-info" />
                Edit Policy
              </button>
              <button
                onClick={() => { setDropdownOpen(false); setHandoverOpen(!handoverOpen); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[10px] text-fg-primary transition-colors hover:bg-hover-row"
              >
                <MessageSquare className="h-3 w-3 text-healthy" />
                View Handover Log
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live On-Call Section */}
      <div className="border-b border-border px-4 py-3 space-y-2">
        {/* Primary On-Call */}
        {primary && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber/20 text-[10px] font-bold text-amber">
                {primary.user.name.charAt(0)}
              </div>
              <div>
                <p className="text-[11px] font-medium text-fg-primary">{primary.user.name}</p>
                <p className="text-[8px] uppercase text-amber">Primary On-Call</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-fg-muted">SLA {primary.sla}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-glow" />
            </div>
          </div>
        )}

        {/* Backup */}
        {backup && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-elevated text-[10px] font-bold text-fg-muted">
                {backup.user.name.charAt(0)}
              </div>
              <div>
                <p className="text-[11px] font-medium text-fg-secondary">{backup.user.name}</p>
                <p className="text-[8px] uppercase text-fg-muted">Backup</p>
              </div>
            </div>
          </div>
        )}

        {/* Shift Countdown Bar */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5 text-fg-muted" />
              <span className="text-[9px] text-fg-muted">Shift {team.shiftProgress}% complete</span>
            </div>
            <span className="font-mono text-[9px] text-healthy">{team.shiftRemaining} remaining</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                team.shiftProgress >= 80 ? "bg-healthy" : team.shiftProgress >= 50 ? "bg-amber" : "bg-fg-muted"
              }`}
              style={{ width: `${team.shiftProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Escalation Policy Flow */}
      <div className="border-b border-border px-4 py-3">
        <p className="mb-2 text-[8px] uppercase tracking-widest font-bold text-fg-muted">Escalation Policy</p>
        <div className="flex items-center gap-1">
          {team.escalationSteps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center flex-1">
                <span className="font-mono text-[8px] font-bold text-amber">{step.delay}</span>
                <span className="text-[8px] text-fg-muted text-center leading-tight mt-0.5">{step.target}</span>
                <span className="text-[7px] text-fg-muted/60 text-center">{step.channel}</span>
              </div>
              {idx < team.escalationSteps.length - 1 && (
                <ArrowRight className="h-2.5 w-2.5 shrink-0 text-fg-muted/40" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Handover Note */}
      <div className="px-4 py-2.5">
        <button
          onClick={() => setHandoverOpen(!handoverOpen)}
          className="flex w-full items-center justify-between text-[9px] uppercase tracking-wider text-fg-muted hover:text-fg-primary transition-colors"
        >
          <span className="flex items-center gap-1">
            <MessageSquare className="h-2.5 w-2.5" />
            Latest Handover
          </span>
          {handoverOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        </button>
        {handoverOpen && (
          <div className="mt-2 rounded border border-border bg-canvas p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-fg-primary">@{team.handover.author}</span>
              <span className="text-[8px] text-fg-muted">{team.handover.timestamp}</span>
            </div>
            <p className="text-[10px] text-fg-secondary leading-relaxed">{team.handover.message}</p>
            {team.handover.unresolvedFlags.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {team.handover.unresolvedFlags.map((flag, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <AlertTriangle className="h-2 w-2 text-degraded" />
                    <span className="text-[8px] text-degraded">{flag}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
