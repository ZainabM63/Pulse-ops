"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Service, PaginatedResponse } from "@/types";
import { Activity } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  operational: { label: "HEALTHY", color: "text-healthy", bg: "bg-healthy/10 border-healthy/30" },
  degraded: { label: "DEGRADED", color: "text-critical", bg: "bg-critical/10 border-critical/30" },
  partial_outage: { label: "ELEVATED", color: "text-amber", bg: "bg-amber/10 border-amber/30" },
  major_outage: { label: "OUTAGE", color: "text-critical", bg: "bg-critical/10 border-critical/30" },
};

const mockMetrics: Record<string, { uptime: string; latency: string }> = {
  "auth-service": { uptime: "99.99%", latency: "12ms" },
  "api-gateway": { uptime: "94.20%", latency: "1,420ms" },
  "payment-processor": { uptime: "98.50%", latency: "89ms" },
  "notification-service": { uptime: "99.90%", latency: "8ms" },
};

function getMetrics(slug: string, status: string) {
  if (mockMetrics[slug]) return mockMetrics[slug];
  if (status === "operational") return { uptime: "99.95%", latency: `${Math.floor(Math.random() * 50 + 5)}ms` };
  return { uptime: "96.00%", latency: `${Math.floor(Math.random() * 500 + 200)}ms` };
}

export function ServiceHealthGrid() {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    api.get<PaginatedResponse<Service>>("/services?per_page=100")
      .then((res) => setServices(res.data))
      .catch(() => {});
  }, []);

  if (services.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-fg-muted" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-fg-primary">Service Health Topology</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {services.map((service) => {
          const cfg = statusConfig[service.status] || statusConfig.operational;
          const metrics = getMetrics(service.slug, service.status);
          return (
            <div
              key={service.id}
              className="rounded border border-border bg-surface px-3 py-2.5 transition-colors hover:border-amber/20"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-fg-primary truncate">{service.name}</h3>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px]">
                <div>
                  <span className="text-fg-muted">Uptime </span>
                  <span className={`font-bold ${service.status === "operational" ? "text-healthy" : "text-amber"}`}>
                    {metrics.uptime}
                  </span>
                </div>
                <div>
                  <span className="text-fg-muted">Latency </span>
                  <span className="font-bold text-fg-primary">{metrics.latency}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
