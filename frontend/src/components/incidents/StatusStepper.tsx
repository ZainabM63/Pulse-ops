"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ChevronDown } from "lucide-react";

const allStatuses = ["investigating", "identified", "monitoring", "resolved", "postmortem"] as const;

const allSeverities = ["critical", "major", "minor", "info"] as const;

const stepLabels: Record<string, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  postmortem: "Postmortem",
};

const severityLabels: Record<string, string> = {
  critical: "P0 Critical",
  major: "P1 Major",
  minor: "P2 Minor",
  info: "P3 Info",
};

const severityColors: Record<string, string> = {
  critical: "text-critical border-critical/30 bg-critical/10",
  major: "text-amber border-amber/30 bg-amber/10",
  minor: "text-degraded border-degraded/30 bg-degraded/10",
  info: "text-fg-muted border-border bg-surface",
};

interface Props {
  currentStatus: string;
  currentSeverity: string;
  incidentId: number;
  onStatusChange: () => void;
}

export function StatusStepper({ currentStatus, currentSeverity, incidentId, onStatusChange }: Props) {
  const [updating, setUpdating] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [severityOpen, setSeverityOpen] = useState(false);

  const changeStatus = async (newStatus: string) => {
    if (newStatus === currentStatus) { setStatusOpen(false); return; }
    setUpdating(true);
    try {
      await api.put(`/incidents/${incidentId}`, { status: newStatus });
      onStatusChange();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
      setStatusOpen(false);
    }
  };

  const changeSeverity = async (newSeverity: string) => {
    if (newSeverity === currentSeverity) { setSeverityOpen(false); return; }
    setUpdating(true);
    try {
      await api.put(`/incidents/${incidentId}`, { severity: newSeverity });
      onStatusChange();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
      setSeverityOpen(false);
    }
  };

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="flex items-center gap-6">
        {/* Status Selector */}
        <div className="relative">
          <button
            onClick={() => { setStatusOpen(!statusOpen); setSeverityOpen(false); }}
            disabled={updating}
            className="inline-flex items-center gap-2 rounded border border-border bg-canvas px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-primary transition-colors hover:border-amber/40 disabled:opacity-50"
          >
            Status: {stepLabels[currentStatus] || currentStatus}
            <ChevronDown className="h-3 w-3" />
          </button>
          {statusOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded border border-border bg-surface shadow-lg shadow-black/30">
              <div className="px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-widest text-fg-muted">Change status</p>
              </div>
              {allStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={updating}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-[10px] transition-colors ${
                    s === currentStatus
                      ? "text-amber bg-amber/5 font-bold"
                      : "text-fg-primary hover:bg-hover-row"
                  } disabled:opacity-50`}
                >
                  <span className={`h-2 w-2 rounded-full ${
                    s === currentStatus ? "bg-amber" : "bg-border"
                  }`} />
                  {stepLabels[s]}
                  {s === currentStatus && (
                    <span className="ml-auto text-[8px] text-amber">current</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Severity Selector */}
        <div className="relative">
          <button
            onClick={() => { setSeverityOpen(!severityOpen); setStatusOpen(false); }}
            disabled={updating}
            className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors hover:opacity-80 disabled:opacity-50 ${severityColors[currentSeverity] || severityColors.info}`}
          >
            Severity: {severityLabels[currentSeverity] || currentSeverity}
            <ChevronDown className="h-3 w-3" />
          </button>
          {severityOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded border border-border bg-surface shadow-lg shadow-black/30">
              <div className="px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-widest text-fg-muted">Change severity</p>
              </div>
              {allSeverities.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSeverity(s)}
                  disabled={updating}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-[10px] transition-colors ${
                    s === currentSeverity
                      ? "text-amber bg-amber/5 font-bold"
                      : "text-fg-primary hover:bg-hover-row"
                  } disabled:opacity-50`}
                >
                  <span className={`h-2 w-2 rounded-full ${
                    s === "critical" ? "bg-critical" : s === "major" ? "bg-amber" : s === "minor" ? "bg-degraded" : "bg-fg-muted"
                  }`} />
                  {severityLabels[s]}
                  {s === currentSeverity && (
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
