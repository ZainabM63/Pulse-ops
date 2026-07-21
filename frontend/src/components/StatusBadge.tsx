const config: Record<string, { bg: string; text: string; border: string }> = {
  investigating: { bg: "bg-critical/10", text: "text-critical", border: "border-critical/30" },
  identified: { bg: "bg-amber/10", text: "text-amber", border: "border-amber/30" },
  monitoring: { bg: "bg-degraded/10", text: "text-degraded", border: "border-degraded/30" },
  resolved: { bg: "bg-healthy/10", text: "text-healthy", border: "border-healthy/30" },
  postmortem: { bg: "bg-fg-muted/10", text: "text-fg-muted", border: "border-fg-muted/30" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = config[status] || config.investigating;
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text} ${c.border}`}>
      {status}
    </span>
  );
}
