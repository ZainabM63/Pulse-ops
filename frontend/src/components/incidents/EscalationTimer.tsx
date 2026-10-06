"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  createdAt: string;
  severity: string;
  status?: string;
}

export function EscalationTimer({ createdAt, severity, status }: Props) {
  const [remaining, setRemaining] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [targetLabel, setTargetLabel] = useState("");

  useEffect(() => {
    if (status === "resolved") {
      setRemaining("RESOLVED");
      setTargetLabel("");
      setUrgent(false);
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - new Date(createdAt).getTime();
      const elapsedMin = elapsed / 60000;

      let targetMin: number;
      let label: string;
      if (elapsedMin < 15) {
        targetMin = 15;
        label = "VP of Eng";
      } else if (elapsedMin < 30) {
        targetMin = 30;
        label = "VP of Eng";
      } else if (elapsedMin < 60) {
        targetMin = 60;
        label = "CTO";
      } else {
        setRemaining("ESCALATED");
        setTargetLabel("CTO");
        setUrgent(true);
        return;
      }

      const targetMs = new Date(createdAt).getTime() + targetMin * 60000;
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setRemaining("ESCALATED");
        setTargetLabel(label);
        setUrgent(true);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
      setTargetLabel(label);
      setUrgent(diff < 60000);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [createdAt, severity, status]);

  return (
    <div className={`rounded border p-4 ${
      remaining === "RESOLVED" ? "border-healthy/40 bg-healthy/5"
      : urgent ? "border-critical/40 bg-critical/5" : "border-border bg-surface"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {remaining === "RESOLVED" ? <CheckCircle className="h-4 w-4 text-healthy" /> :
         urgent ? <AlertTriangle className="h-4 w-4 text-critical animate-pulse" /> : null}
        <h3 className="text-[10px] uppercase tracking-widest text-fg-muted">
          {remaining === "RESOLVED" ? "Incident Resolved" : "Escalation Policy"}
        </h3>
      </div>

      {remaining === "RESOLVED" ? (
        <p className="text-[11px] text-healthy">This incident has been resolved. No escalation needed.</p>
      ) : (
        <p className="text-[11px] text-fg-secondary">
          Auto-Escalating to{" "}
          <span className={`font-bold ${urgent ? "text-critical" : "text-amber"}`}>
            {targetLabel}
          </span>
        </p>
      )}

      <div className={`mt-2 font-mono text-2xl font-bold ${
        remaining === "RESOLVED" ? "text-healthy"
        : urgent ? "text-critical glow-crimson" : "text-healthy"
      }`}>
        {remaining === "RESOLVED" ? (
          <span className="text-sm uppercase tracking-wider">RESOLVED</span>
        ) : remaining === "ESCALATED" ? (
          <span className="text-sm uppercase tracking-wider">ESCALATED</span>
        ) : (
          remaining
        )}
      </div>

      {remaining !== "RESOLVED" && remaining !== "ESCALATED" && (
        <p className="mt-1 text-[9px] text-fg-muted">until next escalation level</p>
      )}
    </div>
  );
}
