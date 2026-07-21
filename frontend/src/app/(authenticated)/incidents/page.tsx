"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { IncidentRow } from "@/components/IncidentRow";
import { DeclareIncidentModal } from "@/components/incidents/DeclareIncidentModal";
import type { Incident, PaginatedResponse } from "@/types";
import { Plus, Play, AlertTriangle, Search, Zap, Radio } from "lucide-react";

type FilterKey = "critical" | "major" | "my_services" | "unassigned";

const filterPills: { key: FilterKey; label: string; color: string }[] = [
  { key: "critical", label: "P0 Critical", color: "text-critical border-critical/30 bg-critical/5 hover:bg-critical/10" },
  { key: "major", label: "P1 Major", color: "text-amber border-amber/30 bg-amber/5 hover:bg-amber/10" },
  { key: "my_services", label: "My Services", color: "text-amber border-amber/30 bg-amber/5 hover:bg-amber/10" },
  { key: "unassigned", label: "Unassigned", color: "text-fg-muted border-border bg-surface hover:bg-hover-row" },
];

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchIncidents = (p: number) => {
    setLoading(true);
    api.get<PaginatedResponse<Incident>>(`/incidents?page=${p}&per_page=15`)
      .then((res) => {
        setIncidents(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIncidents(page);
    api.get<PaginatedResponse<Incident>>("/incidents?per_page=100")
      .then((res) => setAllIncidents(res.data))
      .catch(() => {});
  }, [page]);

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPage(1);
  };

  const filteredIncidents = useMemo(() => {
    let result = allIncidents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.assignee?.name?.toLowerCase().includes(q) ||
        i.services?.some((s) => s.name.toLowerCase().includes(q))
      );
    }
    if (activeFilters.has("critical")) result = result.filter((i) => i.severity === "critical");
    if (activeFilters.has("major")) result = result.filter((i) => i.severity === "major");
    if (activeFilters.has("unassigned")) result = result.filter((i) => !i.assignee);
    return result;
  }, [allIncidents, search, activeFilters]);

  const computeMttr = (): string => {
    const resolved = filteredIncidents.filter((i) => i.status === "resolved" && i.resolved_at);
    if (resolved.length === 0) return "—";
    const totalMin = resolved.reduce((acc, i) => {
      return acc + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime()) / 60000;
    }, 0);
    const avg = totalMin / resolved.length;
    const m = Math.floor(avg);
    const s = Math.round((avg - m) * 60);
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-critical" />
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider">Active Incident Command</h1>
            <p className="mt-0.5 text-[10px] text-fg-muted">Real-time incident response matrix</p>
          </div>
          <div className="ml-3 flex items-center gap-1.5 rounded border border-border bg-surface px-2 py-0.5">
            <span className="text-[9px] uppercase tracking-widest text-fg-muted">MTTR:</span>
            <span className="font-mono text-[11px] font-bold text-healthy">{computeMttr()}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => showToast("Simulate Outage: Synthetic P0 alert dispatched to test channel")}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary"
          >
            <Radio className="h-3 w-3" />
            Simulate Outage Alert
          </button>
          <button
            onClick={() => showToast("Runbook execution initiated for active incidents")}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary"
          >
            <Play className="h-3 w-3" />
            Execute Runbook
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded bg-amber px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-fg transition-colors hover:bg-amber-hover"
          >
            <Plus className="h-3 w-3" />
            Declare Emergency
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by service, hash, or responder..."
            className="w-full rounded border border-border bg-surface py-1.5 pl-7 pr-3 font-mono text-[11px] text-fg-primary placeholder-fg-muted/60 outline-none transition-colors focus:border-amber"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {filterPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => toggleFilter(pill.key)}
              className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeFilters.has(pill.key)
                  ? pill.color
                  : "border-border bg-surface text-fg-muted hover:bg-hover-row"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] text-fg-muted">{filteredIncidents.length} shown</span>
      </div>

      <div className="rounded border border-border bg-surface">
        <div className="grid grid-cols-[70px_1fr_90px_70px_150px_180px] gap-3 border-b border-border px-4 py-2">
          <span className="text-[9px] uppercase tracking-widest text-fg-muted">Severity</span>
          <span className="text-[9px] uppercase tracking-widest text-fg-muted">Incident</span>
          <span className="text-[9px] uppercase tracking-widest text-fg-muted">Blast</span>
          <span className="text-[9px] uppercase tracking-widest text-fg-muted">Elapsed</span>
          <span className="text-[9px] uppercase tracking-widest text-fg-muted">Responder</span>
          <span className="text-[9px] uppercase tracking-widest text-fg-muted text-right">Actions</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-amber" />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="py-12 text-center text-[11px] text-fg-muted">No incidents match your filters</div>
        ) : (
          filteredIncidents.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} onRefresh={() => fetchIncidents(page)} />
          ))
        )}
      </div>

      {lastPage > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border border-border bg-surface px-3 py-1.5 text-[11px] text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary disabled:opacity-30"
          >
            ← Previous
          </button>
          <span className="font-mono text-[10px] text-fg-muted">Page {page} of {lastPage}</span>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            className="rounded border border-border bg-surface px-3 py-1.5 text-[11px] text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded border border-healthy/30 bg-surface px-4 py-2 text-[11px] text-healthy shadow-lg shadow-black/20">
          {toast}
        </div>
      )}

      <DeclareIncidentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => { setModalOpen(false); fetchIncidents(page); }}
      />
    </div>
  );
}
