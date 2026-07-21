"use client";

import { useEffect, useState } from "react";
import { getEscalationLabel } from "@/types";
import type { EscalationLevel } from "@/types";

const levelColors: Record<EscalationLevel, { bg: string; text: string; border: string }> = {
  level_1: { bg: "bg-amber/10", text: "text-amber", border: "border-amber/30" },
  level_2: { bg: "bg-amber/15", text: "text-amber", border: "border-amber/40" },
  level_3: { bg: "bg-critical/10", text: "text-critical", border: "border-critical/30" },
};

export function EscalationBadge({ level, createdAt }: { level: EscalationLevel; createdAt: string }) {
  const [currentLevel, setCurrentLevel] = useState(level);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - new Date(createdAt).getTime();
      const minutes = elapsed / 60000;
      if (minutes > 60) setCurrentLevel("level_3");
      else if (minutes > 30) setCurrentLevel("level_2");
      else setCurrentLevel("level_1");
    }, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const c = levelColors[currentLevel];
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${c.bg} ${c.text} ${c.border}`}>
      {getEscalationLabel(currentLevel)}
    </span>
  );
}
