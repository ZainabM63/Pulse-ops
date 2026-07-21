const config: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: "bg-critical/10", text: "text-critical", dot: "bg-critical" },
  major: { bg: "bg-amber/10", text: "text-amber", dot: "bg-amber" },
  minor: { bg: "bg-degraded/10", text: "text-degraded", dot: "bg-degraded" },
  info: { bg: "bg-fg-muted/10", text: "text-fg-muted", dot: "bg-fg-muted" },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const c = config[severity] || config.info;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {severity}
    </span>
  );
}
