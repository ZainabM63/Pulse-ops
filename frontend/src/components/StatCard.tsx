export function StatCard({ label, value, color = "text-fg-primary", icon }: { label: string; value: string | number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-surface p-4 transition-colors hover:border-amber/20">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-fg-muted">{label}</p>
        {icon && <div className="text-fg-muted">{icon}</div>}
      </div>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
