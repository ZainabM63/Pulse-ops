"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Check, ChevronDown } from "lucide-react";

const steps = ["investigating", "identified", "monitoring", "resolved", "postmortem"] as const;

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
  const [severityOpen, setSeverityOpen] = useState(false);
  const currentIndex = steps.indexOf(currentStatus as typeof steps[number]);

  const changeStatus = async (targetStatus: string) => {
    if (targetStatus === currentStatus) return;
    setUpdating(true);
    try {
      await api.put(`/incidents/${incidentId}`, { status: targetStatus });
      onStatusChange();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
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
      <h3 className="mb-3 text-[10px] uppercase tracking-widest text-fg-muted">Status Progression</h3>

      {/* Visual Pipeline */}
      <div className="flex items-center">
        {steps.map((step, idx) => {
          const isCompleted = idx <= currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => changeStatus(step)}
                  disabled={updating}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-all ${
                    isCurrent
                      ? "border-amber bg-amber text-amber-fg glow-amber"
                      : isCompleted
                      ? "border-healthy bg-healthy/10 text-healthy"
                      : "border-border bg-canvas text-fg-muted hover:border-amber/40"
                  } ${!updating ? "cursor-pointer" : "cursor-default"}`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </button>
                <span className={`mt-1.5 text-[9px] uppercase tracking-wider ${
                  isCurrent ? "text-amber" : isCompleted ? "text-healthy" : "text-fg-muted"
                }`}>
                  {stepLabels[step]}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`mx-2 mb-5 h-px flex-1 ${
                  idx < currentIndex ? "bg-healthy/40" : "bg-border"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Severity Selector */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-widest text-fg-muted">Severity</span>
        <div className="relative">
          <button
            onClick={() => setSeverityOpen(!severityOpen)}
            disabled={updating}
            className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors hover:opacity-80 disabled:opacity-50 ${severityColors[currentSeverity] || severityColors.info}`}
          >
            {severityLabels[currentSeverity] || currentSeverity}
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
