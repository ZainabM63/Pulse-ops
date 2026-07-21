"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Service, PaginatedResponse } from "@/types";
import { Box, Shield, Activity, Zap, AlertTriangle } from "lucide-react";

type CircuitBreakerState = "closed" | "open" | "half_open";

interface ServiceMetrics {
  uptime: string;
  latency: string;
  errorRate: string;
  sloBudget: number;
  tier: number;
  circuitBreaker: CircuitBreakerState;
}

const tierConfig: Record<number, { label: string; color: string; bg: string; border: string }> = {
  0: { label: "Tier 0 - Critical", color: "text-critical", bg: "bg-critical/10", border: "border-critical/30" },
  1: { label: "Tier 1 - Essential", color: "text-amber", bg: "bg-amber/10", border: "border-amber/30" },
  2: { label: "Tier 2 - Important", color: "text-info", bg: "bg-info/10", border: "border-info/30" },
  3: { label: "Tier 3 - Low", color: "text-fg-muted", bg: "bg-fg-muted/10", border: "border-fg-muted/30" },
};

const circuitConfig: Record<CircuitBreakerState, { label: string; color: string; bg: string; dot: string }> = {
  closed: { label: "CLOSED", color: "text-healthy", bg: "bg-healthy/10 border-healthy/30", dot: "bg-healthy" },
  open: { label: "OPEN", color: "text-critical", bg: "bg-critical/10 border-critical/30", dot: "bg-critical" },
  half_open: { label: "HALF-OPEN", color: "text-degraded", bg: "bg-degraded/10 border-degraded/30", dot: "bg-degraded" },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  operational: { label: "HEALTHY", color: "text-healthy", bg: "bg-healthy/10", border: "border-healthy/30" },
  degraded: { label: "DEGRADED", color: "text-critical", bg: "bg-critical/10", border: "border-critical/30" },
  partial_outage: { label: "ELEVATED", color: "text-amber", bg: "bg-amber/10", border: "border-amber/30" },
  major_outage: { label: "OUTAGE", color: "text-critical", bg: "bg-critical/10", border: "border-critical/30" },
};

const mockMetrics: Record<string, ServiceMetrics> = {
  "auth-service": { uptime: "99.99%", latency: "12ms", errorRate: "0.01%", sloBudget: 95, tier: 0, circuitBreaker: "closed" },
  "api-gateway": { uptime: "94.20%", latency: "1,420ms", errorRate: "5.80%", sloBudget: 23, tier: 0, circuitBreaker: "half_open" },
  "payment-processor": { uptime: "98.50%", latency: "89ms", errorRate: "1.50%", sloBudget: 62, tier: 0, circuitBreaker: "closed" },
  "notification-service": { uptime: "99.90%", latency: "8ms", errorRate: "0.10%", sloBudget: 88, tier: 1, circuitBreaker: "open" },
  "user-service": { uptime: "99.95%", latency: "24ms", errorRate: "0.05%", sloBudget: 92, tier: 1, circuitBreaker: "closed" },
  "analytics-engine": { uptime: "99.80%", latency: "156ms", errorRate: "0.20%", sloBudget: 78, tier: 2, circuitBreaker: "closed" },
  "log-collector": { uptime: "99.70%", latency: "45ms", errorRate: "0.30%", sloBudget: 71, tier: 3, circuitBreaker: "closed" },
};

function getMetrics(slug: string, status: string): ServiceMetrics {
  if (mockMetrics[slug]) return mockMetrics[slug];
  if (status === "operational") {
    return {
      uptime: "99.95%",
      latency: `${Math.floor(Math.random() * 50 + 5)}ms`,
      errorRate: "0.05%",
      sloBudget: Math.floor(Math.random() * 20 + 75),
      tier: 2,
      circuitBreaker: "closed",
    };
  }
  return {
    uptime: "96.00%",
    latency: `${Math.floor(Math.random() * 500 + 200)}ms`,
    errorRate: `${(Math.random() * 5 + 1).toFixed(2)}%`,
    sloBudget: Math.floor(Math.random() * 30 + 10),
    tier: 1,
    circuitBreaker: Math.random() > 0.5 ? "half_open" : "open",
  };
}

function SloBudgetBar({ budget }: { budget: number }) {
  const color = budget >= 80 ? "bg-healthy" : budget >= 50 ? "bg-degraded" : "bg-critical";
  const textColor = budget >= 80 ? "text-healthy" : budget >= 50 ? "text-degraded" : "text-critical";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-fg-muted">SLO Budget</span>
        <span className={`font-mono text-[10px] font-bold ${textColor}`}>{budget}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${budget}%` }}
        />
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  useEffect(() => {
    api.get<PaginatedResponse<Service>>("/services").then((res) => setServices(res.data)).catch(console.error);
  }, []);

  const filteredServices = selectedTier !== null
    ? services.filter((s) => getMetrics(s.slug, s.status).tier === selectedTier)
    : services;

  const tierCounts = services.reduce((acc, s) => {
    const tier = getMetrics(s.slug, s.status).tier;
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold uppercase tracking-wider">Service Health Grid</h1>
          <p className="mt-0.5 text-[10px] text-fg-muted">Status of all monitored infrastructure services</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedTier(null)}
            className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              selectedTier === null
                ? "border-amber bg-amber/10 text-amber"
                : "border-border bg-surface text-fg-muted hover:bg-hover-row"
            }`}
          >
            All ({services.length})
          </button>
          {Object.entries(tierConfig).map(([tier, cfg]) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(selectedTier === Number(tier) ? null : Number(tier))}
              className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                selectedTier === Number(tier)
                  ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                  : "border-border bg-surface text-fg-muted hover:bg-hover-row"
              }`}
            >
              T{tier} ({tierCounts[Number(tier)] || 0})
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredServices.map((service) => {
          const cfg = statusConfig[service.status] || statusConfig.operational;
          const metrics = getMetrics(service.slug, service.status);
          const tier = tierConfig[metrics.tier] || tierConfig[3];
          const circuit = circuitConfig[metrics.circuitBreaker];

          return (
            <div
              key={service.id}
              className="rounded border border-border bg-surface p-4 transition-colors hover:border-amber/20"
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-fg-muted" />
                  <h3 className="text-xs font-medium text-fg-primary">{service.name}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>
              </div>

              {/* Description */}
              {service.description && (
                <p className="mb-3 text-[10px] text-fg-muted line-clamp-2">{service.description}</p>
              )}

              {/* Tier Badge */}
              <div className="mb-3">
                <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tier.bg} ${tier.color} ${tier.border}`}>
                  <Shield className="h-2.5 w-2.5" />
                  {tier.label}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="mb-3 grid grid-cols-3 gap-2 rounded border border-border bg-canvas p-2">
                <div className="text-center">
                  <span className="block text-[8px] uppercase tracking-wider text-fg-muted">Uptime</span>
                  <span className={`font-mono text-[11px] font-bold ${service.status === "operational" ? "text-healthy" : "text-degraded"}`}>
                    {metrics.uptime}
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-[8px] uppercase tracking-wider text-fg-muted">Latency</span>
                  <span className="font-mono text-[11px] font-bold text-fg-primary">{metrics.latency}</span>
                </div>
                <div className="text-center">
                  <span className="block text-[8px] uppercase tracking-wider text-fg-muted">Errors</span>
                  <span className={`font-mono text-[11px] font-bold ${Number.parseFloat(metrics.errorRate) < 1 ? "text-healthy" : "text-critical"}`}>
                    {metrics.errorRate}
                  </span>
                </div>
              </div>

              {/* SLO Budget Bar */}
              <div className="mb-3">
                <SloBudgetBar budget={metrics.sloBudget} />
              </div>

              {/* Circuit Breaker + Team */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${circuit.bg} ${circuit.color}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${circuit.dot}`} />
                  CB: {circuit.label}
                </span>
                {service.team && (
                  <span className="text-[10px] text-fg-muted">{service.team.name}</span>
                )}
              </div>
            </div>
          );
        })}
        {filteredServices.length === 0 && (
          <p className="text-[11px] text-fg-muted">No services found</p>
        )}
      </div>
    </div>
  );
}
