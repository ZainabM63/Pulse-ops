"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { ServiceHealthGrid } from "@/components/dashboard/ServiceHealthGrid";
import { LiveTerminal } from "@/components/dashboard/LiveTerminal";
import { AlertTriangle, Shield, AlertOctagon, Activity } from "lucide-react";

interface DashboardData {
  active_incidents: number;
  critical_count: number;
  major_count: number;
  services_degraded: number;
  services_total: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/dashboard").then(setData).catch(console.error);
  }, []);

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-sm font-bold uppercase tracking-wider">System Overview</h1>
        <p className="mt-0.5 text-[10px] text-fg-muted">Real-time operational status</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active Incidents"
          value={data?.active_incidents ?? "—"}
          color="text-fg-primary"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Critical"
          value={data?.critical_count ?? "—"}
          color="text-critical"
          icon={<AlertOctagon className="h-4 w-4" />}
        />
        <StatCard
          label="Major"
          value={data?.major_count ?? "—"}
          color="text-amber"
          icon={<Shield className="h-4 w-4" />}
        />
        <StatCard
          label="Services Healthy"
          value={data ? `${data.services_total - data.services_degraded}/${data.services_total}` : "—"}
          color="text-healthy"
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <ServiceHealthGrid />
      <LiveTerminal />
    </div>
  );
}
