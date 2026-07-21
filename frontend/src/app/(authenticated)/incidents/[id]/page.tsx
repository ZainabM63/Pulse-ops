"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { StatusStepper } from "@/components/incidents/StatusStepper";
import { ActivityFeed } from "@/components/incidents/ActivityFeed";
import { EscalationTimer } from "@/components/incidents/EscalationTimer";
import { QuickActions } from "@/components/incidents/QuickActions";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { getDuration, getEscalationLevel } from "@/types";
import type { Incident } from "@/types";
import { ArrowLeft, Swords } from "lucide-react";

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchIncident = () => {
    api.get<{ data: Incident }>(`/incidents/${params.id}`)
      .then((res) => setIncident(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIncident();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-amber" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="p-6">
        <p className="text-sm text-critical">{error || "Incident not found"}</p>
        <button onClick={() => router.push("/incidents")} className="mt-2 text-xs text-amber hover:underline">
          ← Back to incidents
        </button>
      </div>
    );
  }

  const escalation = getEscalationLevel(incident.created_at);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/incidents")}
          className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted transition-colors hover:text-fg-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to incidents
        </button>
        <div className="h-4 w-px bg-border" />
        <button
          onClick={() => router.push(`/incidents/${incident.id}/war-room`)}
          className="inline-flex items-center gap-1.5 rounded border border-amber/30 bg-amber/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber transition-colors hover:bg-amber/20"
        >
          <Swords className="h-3 w-3" />
          Open War Room
        </button>
      </div>

      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-fg-muted">INC-{String(incident.id).padStart(4, "0")}</span>
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] text-fg-muted">Elapsed: {getDuration(incident.created_at)}</p>
          <p className="font-mono text-[10px] text-fg-muted">
            Escalation: {escalation.replace("level_", "L")}
          </p>
        </div>
      </div>

      <h1 className="mb-1 text-lg font-bold text-fg-primary">{incident.title}</h1>
      {incident.description && (
        <p className="mb-4 text-xs text-fg-secondary">{incident.description}</p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {incident.services?.map((s) => (
          <span key={s.id} className="rounded border border-border bg-surface px-2 py-0.5 text-[10px] text-fg-muted">
            {s.name}
          </span>
        ))}
        {incident.team && (
          <span className="rounded border border-amber/20 bg-amber/5 px-2 py-0.5 text-[10px] text-amber">
            {incident.team.name}
          </span>
        )}
      </div>

      <StatusStepper
        currentStatus={incident.status}
        incidentId={incident.id}
        onStatusChange={fetchIncident}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-fg-muted">Activity & Log Feed</h2>
          <ActivityFeed activities={incident.activities || []} incidentId={incident.id} onCommentAdded={fetchIncident} />
        </div>

        <div className="space-y-4">
          <EscalationTimer createdAt={incident.created_at} severity={incident.severity} />

          <QuickActions incident={incident} />

          <div className="rounded border border-border bg-surface p-4">
            <h3 className="mb-2 text-[10px] uppercase tracking-widest text-fg-muted">Incident Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[10px] text-fg-muted">Reporter</span>
                <span className="text-[11px] text-fg-primary">{incident.reporter?.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-fg-muted">Assignee</span>
                <span className="text-[11px] text-fg-primary">{incident.assignee?.name || "Unassigned"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-fg-muted">Created</span>
                <span className="font-mono text-[10px] text-fg-primary">
                  {new Date(incident.created_at).toLocaleString()}
                </span>
              </div>
              {incident.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-[10px] text-fg-muted">Resolved</span>
                  <span className="font-mono text-[10px] text-healthy">
                    {new Date(incident.resolved_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
