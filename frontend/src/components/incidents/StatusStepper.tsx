"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Check } from "lucide-react";

const steps = ["investigating", "identified", "monitoring", "resolved"] as const;

const stepLabels: Record<string, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

interface Props {
  currentStatus: string;
  incidentId: number;
  onStatusChange: () => void;
}

export function StatusStepper({ currentStatus, incidentId, onStatusChange }: Props) {
  const [updating, setUpdating] = useState(false);
  const currentIndex = steps.indexOf(currentStatus as typeof steps[number]);

  const advanceTo = async (targetStatus: string) => {
    if (steps.indexOf(targetStatus as typeof steps[number]) <= currentIndex) return;
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

  return (
    <div className="rounded border border-border bg-surface p-4">
      <h3 className="mb-3 text-[10px] uppercase tracking-widest text-fg-muted">Status Progression</h3>
      <div className="flex items-center">
        {steps.map((step, idx) => {
          const isCompleted = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => isFuture && advanceTo(step)}
                  disabled={updating || isCompleted}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-all ${
                    isCurrent
                      ? "border-amber bg-amber text-amber-fg glow-amber"
                      : isCompleted
                      ? "border-healthy bg-healthy/10 text-healthy"
                      : "border-border bg-canvas text-fg-muted hover:border-amber/40"
                  } ${isFuture && !updating ? "cursor-pointer" : "cursor-default"}`}
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
    </div>
  );
}
