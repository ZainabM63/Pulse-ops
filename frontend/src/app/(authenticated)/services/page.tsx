"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Service, Team, PaginatedResponse, CircuitBreakerState } from "@/types";
import { Box, Shield, Trash2, Plus, X, Activity, Zap, RefreshCw } from "lucide-react";

const tierConfig: Record<number, { label: string; color: string; bg: string; border: string }> = {
  0: { label: "TIER 0 - CRITICAL", color: "text-critical", bg: "bg-critical-bg", border: "border-critical/40" },
  1: { label: "TIER 1 - ESSENTIAL", color: "text-amber", bg: "bg-amber/10", border: "border-amber/40" },
  2: { label: "TIER 2 - IMPORTANT", color: "text-info", bg: "bg-info-bg", border: "border-info/40" },
  3: { label: "TIER 3 - LOW", color: "text-fg-muted", bg: "bg-surface/60", border: "border-border" },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  operational: { label: "HEALTHY", color: "text-healthy", bg: "bg-healthy/10", border: "border-healthy/40" },
  degraded: { label: "DEGRADED", color: "text-amber", bg: "bg-amber/10", border: "border-amber/40" },
  partial_outage: { label: "ELEVATED", color: "text-major", bg: "bg-major-bg", border: "border-major/40" },
  major_outage: { label: "OUTAGE", color: "text-critical", bg: "bg-critical-bg", border: "border-critical/40" },
};

function SloBudgetBar({ budget }: { budget: number | null }) {
  if (budget == null) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="uppercase tracking-wider text-fg-muted font-mono">SLO ERROR BUDGET DRAIN</span>
          <span className="font-mono font-bold text-fg-muted">—</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface border border-border" />
      </div>
    );
  }

  const color = budget >= 80 ? "bg-healthy" : budget >= 50 ? "bg-amber" : "bg-critical";
  const textColor = budget >= 80 ? "text-healthy" : budget >= 50 ? "text-amber" : "text-critical";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="uppercase tracking-wider text-fg-muted font-mono">SLO ERROR BUDGET DRAIN</span>
        <span className={`font-mono font-bold ${textColor}`}>{budget}% REMAINING</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface border border-border">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, budget))}%` }}
        />
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingCbId, setUpdatingCbId] = useState<number | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", status: "operational", severity_level: "info", team_id: "" });

  const fetchServices = () => {
    api.get<PaginatedResponse<Service>>("/services?per_page=100")
      .then((res) => setServices(res.data || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchServices();
    api.get<PaginatedResponse<Team>>("/teams?per_page=100").then((res) => setTeams(res.data || [])).catch(() => { });
  }, []);

  const handleCircuitBreakerToggle = async (serviceId: number, newState: CircuitBreakerState) => {
    if (updatingCbId) return;
    setUpdatingCbId(serviceId);
    try {
      const res = await api.patch<{ service: Service }>(`/services/${serviceId}/circuit-breaker`, {
        circuit_breaker_state: newState,
      });
      setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, circuit_breaker_state: newState } : s)));
    } catch {
      // ignore
    } finally {
      setUpdatingCbId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/services/${id}`);
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || creating) return;
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        status: createForm.status,
        severity_level: createForm.severity_level,
      };
      if (createForm.team_id) payload.team_id = Number(createForm.team_id);
      const res = await api.post<{ service: Service }>("/services", payload);
      setServices((prev) => [res.service, ...prev]);
      setCreateForm({ name: "", description: "", status: "operational", severity_level: "info", team_id: "" });
      setShowCreate(false);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const filteredServices = selectedTier !== null
    ? services.filter((s) => s.tier === selectedTier)
    : services;

  return (
    <div className="p-4 sm:p-6 bg-canvas min-h-full text-fg-primary font-sans space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-healthy" />
            <h1 className="text-sm font-extrabold uppercase tracking-widest text-fg-primary">
              Service Infrastructure Matrix & Circuit Breakers
            </h1>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            Real-time telemetry status, SLO error budget drains, and circuit breaker controls across microservices.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber hover:bg-amber-500/20 transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Service
          </button>
          <button
            onClick={() => setSelectedTier(null)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${selectedTier === null
                ? "border-emerald-400 bg-emerald-500/20 text-healthy"
                : "border-border bg-surface text-fg-muted hover:border-amber/40"
              }`}
          >
            All ({services.length})
          </button>
        </div>
      </div>

      {/* Add Service Modal */}
      {showCreate && (
        <div className="rounded-xl border border-amber/30 bg-surface/90 p-5 shadow-2xl backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-fg-primary">Register Monitored Service</h3>
            <button onClick={() => setShowCreate(false)} className="text-fg-muted hover:text-fg-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase text-fg-muted">Service Name *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Auth Microservice"
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-fg-primary outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase text-fg-muted">Description</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Service role summary"
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-fg-primary outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase text-fg-muted">Initial Status</label>
              <select
                value={createForm.status}
                onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-fg-primary outline-none focus:border-amber-400"
              >
                <option value="operational">Operational</option>
                <option value="degraded">Degraded</option>
                <option value="partial_outage">Partial Outage</option>
                <option value="major_outage">Major Outage</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase text-fg-muted">Assigned Team</label>
              <select
                value={createForm.team_id}
                onChange={(e) => setCreateForm({ ...createForm, team_id: e.target.value })}
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-fg-primary outline-none focus:border-amber-400"
              >
                <option value="">Unassigned</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-border px-4 py-1.5 text-xs text-fg-muted hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!createForm.name.trim() || creating}
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-black hover:bg-amber disabled:opacity-50"
            >
              {creating ? "Creating..." : "Save Service"}
            </button>
          </div>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredServices.map((service) => {
          const cfg = statusConfig[service.status] || statusConfig.operational;
          const tier = tierConfig[service.tier] || tierConfig[3];
          const cbState = service.circuit_breaker_state || "closed";

          return (
            <div
              key={service.id}
              className="rounded-xl border border-border bg-surface/60 p-5 shadow-xl transition-all hover:border-amber/40 hover:shadow-2xl flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-healthy shrink-0" />
                    <h3 className="text-sm font-bold text-fg-primary">{service.name}</h3>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Description */}
                {service.description && (
                  <p className="mb-3 text-xs text-fg-muted leading-normal line-clamp-2">{service.description}</p>
                )}

                {/* Tier Badge */}
                <div className="mb-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${tier.bg} ${tier.color} ${tier.border}`}>
                    <Shield className="h-3 w-3" />
                    {tier.label}
                  </span>
                </div>

                {/* Telemetry Metrics HUD */}
                <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-canvas p-3 text-center">
                  <div>
                    <span className="block text-[9px] font-mono uppercase text-fg-muted">Uptime</span>
                    <span className="font-mono text-xs font-bold text-healthy">
                      {service.uptime != null ? `${service.uptime}%` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-mono uppercase text-fg-muted">Latency</span>
                    <span className="font-mono text-xs font-bold text-fg-primary">
                      {service.latency_ms != null ? `${service.latency_ms}ms` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-mono uppercase text-fg-muted">Error Rate</span>
                    <span className={`font-mono text-xs font-bold ${service.error_rate != null && service.error_rate > 1 ? "text-critical" : "text-healthy"}`}>
                      {service.error_rate != null ? `${service.error_rate}%` : "—"}
                    </span>
                  </div>
                </div>

                {/* SLO Budget Drain Bar */}
                <SloBudgetBar budget={service.slo_budget} />
              </div>

              {/* Circuit Breaker Interactive Switcher */}
              <div className="pt-3 border-t border-border/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono uppercase text-fg-muted">CB STATE:</span>
                  <div className="flex items-center rounded-lg border border-border bg-canvas p-0.5">
                    <button
                      onClick={() => handleCircuitBreakerToggle(service.id, "closed")}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${cbState === "closed" ? "bg-healthy text-black shadow" : "text-fg-muted hover:text-fg-primary"
                        }`}
                    >
                      CLOSED
                    </button>
                    <button
                      onClick={() => handleCircuitBreakerToggle(service.id, "half_open")}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${cbState === "half_open" ? "bg-amber text-black shadow" : "text-fg-muted hover:text-fg-primary"
                        }`}
                    >
                      HALF
                    </button>
                    <button
                      onClick={() => handleCircuitBreakerToggle(service.id, "open")}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${cbState === "open" ? "bg-rose-500 text-fg-primary shadow" : "text-fg-muted hover:text-fg-primary"
                        }`}
                    >
                      OPEN
                    </button>
                  </div>
                </div>

                {service.team && (
                  <span className="text-xs text-fg-muted font-medium">{service.team.name}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
