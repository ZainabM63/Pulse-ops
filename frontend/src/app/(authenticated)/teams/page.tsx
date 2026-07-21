"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import type { Team, PaginatedResponse, TeamCardData } from "@/types";
import { TeamCard } from "@/components/teams/TeamCard";
import { HandoffModal } from "@/components/teams/HandoffModal";
import { CreateTeamModal } from "@/components/teams/CreateTeamModal";
import { YourTeamsModal } from "@/components/teams/YourTeamsModal";
import {
  Users, Plus, Download, Shield, Clock, Activity, ChevronDown, FileText, Calendar, List
} from "lucide-react";

const MOCK_TEAMS: TeamCardData[] = [
  {
    id: 1, name: "Platform Infrastructure", slug: "platform-infra", serviceTag: "#platform-infra",
    metrics: { healthStatus: "high_load", incidentCount: 2, avgMtta: "1m 12s", engineersOnCall: 3 },
    onCall: [
      { user: { id: 1, name: "Sarah Chen", email: "sarah@acme.com" }, role: "primary", sla: "< 5 mins", shiftStart: "08:00", shiftEnd: "20:00" },
      { user: { id: 2, name: "Alex Rivers", email: "alex@acme.com" }, role: "backup", sla: "< 15 mins", shiftStart: "08:00", shiftEnd: "20:00" },
    ],
    escalationSteps: [
      { delay: "[0m]", target: "Slack #infra-alerts", channel: "Notification" },
      { delay: "[5m]", target: "Ping Sarah C.", channel: "Primary" },
      { delay: "[15m]", target: "Auto-Call VP Eng", channel: "Phone" },
    ],
    handover: { author: "sarah_c", message: "Clean shift, memory leak on Redis cache node fixed at 14:00. API gateway still showing elevated 5xx — monitoring.", timestamp: "2h ago", unresolvedFlags: ["API gateway 5xx rate above threshold"] },
    shiftProgress: 75, shiftRemaining: "02h 15m",
  },
  {
    id: 2, name: "Core Billing", slug: "core-billing", serviceTag: "#billing",
    metrics: { healthStatus: "operational", incidentCount: 0, avgMtta: "0m 48s", engineersOnCall: 2 },
    onCall: [
      { user: { id: 3, name: "Marcus Rivera", email: "marcus@acme.com" }, role: "primary", sla: "< 3 mins", shiftStart: "06:00", shiftEnd: "18:00" },
      { user: { id: 4, name: "Priya Sharma", email: "priya@acme.com" }, role: "backup", sla: "< 10 mins", shiftStart: "06:00", shiftEnd: "18:00" },
    ],
    escalationSteps: [
      { delay: "[0m]", target: "Slack #billing-alerts", channel: "Notification" },
      { delay: "[5m]", target: "Page Marcus R.", channel: "PagerDuty" },
      { delay: "[20m]", target: "Escalate to CTO", channel: "Phone" },
    ],
    handover: { author: "marcus_r", message: "All billing pipelines nominal. Stripe webhook retries resolved — queue cleared at 13:45 UTC.", timestamp: "4h ago", unresolvedFlags: [] },
    shiftProgress: 50, shiftRemaining: "04h 00m",
  },
  {
    id: 3, name: "Security Ops", slug: "security-ops", serviceTag: "#security",
    metrics: { healthStatus: "operational", incidentCount: 0, avgMtta: "1m 05s", engineersOnCall: 2 },
    onCall: [
      { user: { id: 5, name: "Jordan Lee", email: "jordan@acme.com" }, role: "primary", sla: "< 5 mins", shiftStart: "00:00", shiftEnd: "12:00" },
      { user: { id: 6, name: "Fatima Al-Rashid", email: "fatima@acme.com" }, role: "backup", sla: "< 10 mins", shiftStart: "00:00", shiftEnd: "12:00" },
    ],
    escalationSteps: [
      { delay: "[0m]", target: "Slack #security-incidents", channel: "Notification" },
      { delay: "[3m]", target: "Page Jordan L.", channel: "PagerDuty" },
      { delay: "[10m]", target: "Auto-Call CISO", channel: "Phone" },
    ],
    handover: { author: "jordan_l", message: "No security incidents overnight. Vulnerability scan completed — 2 medium findings triaged for next sprint.", timestamp: "1h ago", unresolvedFlags: [] },
    shiftProgress: 90, shiftRemaining: "01h 00m",
  },
  {
    id: 4, name: "Data Pipeline", slug: "data-pipeline", serviceTag: "#data-pipeline",
    metrics: { healthStatus: "operational", incidentCount: 1, avgMtta: "2m 30s", engineersOnCall: 2 },
    onCall: [
      { user: { id: 7, name: "Wei Zhang", email: "wei@acme.com" }, role: "primary", sla: "< 5 mins", shiftStart: "10:00", shiftEnd: "22:00" },
      { user: { id: 8, name: "Aisha Patel", email: "aisha@acme.com" }, role: "backup", sla: "< 15 mins", shiftStart: "10:00", shiftEnd: "22:00" },
    ],
    escalationSteps: [
      { delay: "[0m]", target: "Slack #data-alerts", channel: "Notification" },
      { delay: "[10m]", target: "Ping Wei Z.", channel: "Slack DM" },
      { delay: "[25m]", target: "Auto-Call Dir. Eng", channel: "Phone" },
    ],
    handover: { author: "wei_z", message: "Spark job backlog cleared. One slow query on analytics replica — optimizing index. ETA fix by 16:00.", timestamp: "3h ago", unresolvedFlags: ["Analytics replica slow query"] },
    shiftProgress: 33, shiftRemaining: "06h 00m",
  },
  {
    id: 5, name: "Frontend Experience", slug: "frontend-experience", serviceTag: "#frontend",
    metrics: { healthStatus: "operational", incidentCount: 0, avgMtta: "0m 55s", engineersOnCall: 2 },
    onCall: [
      { user: { id: 9, name: "Emily Nakamura", email: "emily@acme.com" }, role: "primary", sla: "< 5 mins", shiftStart: "09:00", shiftEnd: "21:00" },
      { user: { id: 10, name: "Carlos Mendez", email: "carlos@acme.com" }, role: "backup", sla: "< 15 mins", shiftStart: "09:00", shiftEnd: "21:00" },
    ],
    escalationSteps: [
      { delay: "[0m]", target: "Slack #frontend-alerts", channel: "Notification" },
      { delay: "[5m]", target: "Ping Emily N.", channel: "Slack DM" },
      { delay: "[15m]", target: "Escalate to Staff Eng", channel: "Phone" },
    ],
    handover: { author: "emily_n", message: "Dashboard redesign deployed to canary. No regressions detected. CDN cache hit ratio at 97%.", timestamp: "5h ago", unresolvedFlags: [] },
    shiftProgress: 60, shiftRemaining: "03h 00m",
  },
  {
    id: 6, name: "DevOps Tooling", slug: "devops-tooling", serviceTag: "#devops",
    metrics: { healthStatus: "operational", incidentCount: 0, avgMtta: "1m 18s", engineersOnCall: 2 },
    onCall: [
      { user: { id: 11, name: "Raj Patel", email: "raj@acme.com" }, role: "primary", sla: "< 5 mins", shiftStart: "07:00", shiftEnd: "19:00" },
      { user: { id: 12, name: "Nina Volkov", email: "nina@acme.com" }, role: "backup", sla: "< 10 mins", shiftStart: "07:00", shiftEnd: "19:00" },
    ],
    escalationSteps: [
      { delay: "[0m]", target: "Slack #devops-alerts", channel: "Notification" },
      { delay: "[5m]", target: "Ping Raj P.", channel: "Slack DM" },
      { delay: "[15m]", target: "Auto-Call VP Platform", channel: "Phone" },
    ],
    handover: { author: "raj_p", message: "CI/CD pipeline stable. Kubernetes cluster autoscaler tuned — node spin-up time reduced by 40%.", timestamp: "6h ago", unresolvedFlags: [] },
    shiftProgress: 42, shiftRemaining: "05h 00m",
  },
];

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const headers = ["Team Name", "Slug", "Primary On-Call", "Backup On-Call", "Shift Start", "Shift End", "SLA (Primary)", "Escalation Policy", "Handover Note"];
  const rows = MOCK_TEAMS.map((t) => {
    const primary = t.onCall.find((o) => o.role === "primary");
    const backup = t.onCall.find((o) => o.role === "backup");
    const escalation = t.escalationSteps.map((s) => `${s.delay} -> ${s.target} (${s.channel})`).join(" | ");
    return [
      t.name,
      t.slug,
      primary?.user.name ?? "",
      backup?.user.name ?? "",
      primary?.shiftStart ?? "",
      primary?.shiftEnd ?? "",
      primary?.sla ?? "",
      escalation,
      t.handover.message,
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadBlob(csv, "shift-schedule.csv", "text/csv;charset=utf-8;");
}

function exportICS() {
  const now = new Date();
  const today = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const events = MOCK_TEAMS.map((t) => {
    const primary = t.onCall.find((o) => o.role === "primary");
    const backup = t.onCall.find((o) => o.role === "backup");

    const [startH, startM] = (primary?.shiftStart ?? "09:00").split(":").map(Number);
    const [endH, endM] = (primary?.shiftEnd ?? "21:00").split(":").map(Number);

    const dtStart = new Date(now);
    dtStart.setHours(startH, startM, 0, 0);
    const dtEnd = new Date(now);
    dtEnd.setHours(endH, endM, 0, 0);
    if (dtEnd <= dtStart) dtEnd.setDate(dtEnd.getDate() + 1);

    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const escalation = t.escalationSteps.map((s) => `${s.delay} -> ${s.target} (${s.channel})`).join("\\n");
    const description = `Primary: ${primary?.user.name ?? "N/A"}\\nBackup: ${backup?.user.name ?? "N/A"}\\nSLA: ${primary?.sla ?? "N/A"}\\nEscalation:\\n${escalation}`;

    return [
      "BEGIN:VEVENT",
      `DTSTART:${fmt(dtStart)}`,
      `DTEND:${fmt(dtEnd)}`,
      `SUMMARY:${t.name} — On-Call (${primary?.user.name ?? "TBD"})`,
      `DESCRIPTION:${description}`,
      `UID:${t.slug}-${today}@pulseops`,
      `DTSTAMP:${today}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PulseOps//Shift Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  downloadBlob(ics, "shift-schedule.ics", "text/calendar;charset=utf-8;");
}

export default function TeamsPage() {
  const [apiTeams, setApiTeams] = useState<Team[]>([]);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamCardData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const fetchTeams = () => {
    api.get<PaginatedResponse<Team>>("/teams").then((res) => setApiTeams(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [exportOpen]);

  const handleHandoff = (teamId: number) => {
    const team = MOCK_TEAMS.find((t) => t.id === teamId);
    if (team) {
      setSelectedTeam(team);
      setHandoffOpen(true);
    }
  };

  const handleHandoffSubmit = (note: string, flags: string[], transferTo: number | null) => {
    const msg = transferTo
      ? `Handoff submitted and pager token transferred.`
      : `Handoff submitted for ${selectedTeam?.name}.`;
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleTeamCreated = () => {
    setCreateModalOpen(false);
    fetchTeams();
    setToast("Team created successfully.");
    setTimeout(() => setToast(null), 3000);
  };

  const totalOnCall = MOCK_TEAMS.reduce((acc, t) => acc + t.metrics.engineersOnCall, 0);
  const avgMtta = "1m 18s";
  const fatigueIndex = "LOW (2 off-hours pings today)";

  return (
    <div className="p-6">
      {/* Header & Metrics Ribbon */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-amber" />
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider">Engineering Teams & On-Call Rotations</h1>
            <p className="mt-0.5 text-[10px] text-fg-muted">Real-time team operations and shift management</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Export Dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary"
            >
              <Download className="h-3 w-3" />
              Export Shift Schedule
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded border border-border bg-card shadow-lg shadow-black/20">
                <button
                  onClick={() => { exportCSV(); setExportOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[10px] text-fg-primary transition-colors hover:bg-hover-row"
                >
                  <FileText className="h-3 w-3 text-healthy" />
                  Export as CSV
                </button>
                <button
                  onClick={() => { exportICS(); setExportOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[10px] text-fg-primary transition-colors hover:bg-hover-row"
                >
                  <Calendar className="h-3 w-3 text-info" />
                  Export as ICS Calendar
                </button>
              </div>
            )}
          </div>

          {/* Show Teams Button */}
          <button
            onClick={() => setTeamsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary"
          >
            <List className="h-3 w-3" />
            Show Teams
            {apiTeams.length > 0 && (
              <span className="ml-0.5 rounded-full bg-amber/20 px-1.5 py-0.5 text-[8px] font-bold text-amber">
                {apiTeams.length}
              </span>
            )}
          </button>

          {/* Create Team Button */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded bg-amber px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-fg transition-colors hover:bg-amber-hover"
          >
            <Plus className="h-3 w-3" />
            Create Team
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        <div className="rounded border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-fg-muted">Active Teams</span>
            <Users className="h-3.5 w-3.5 text-fg-muted" />
          </div>
          <p className="mt-1 text-2xl font-bold text-fg-primary">{MOCK_TEAMS.length + apiTeams.length}</p>
        </div>
        <div className="rounded border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-fg-muted">Engineers On-Call</span>
            <Shield className="h-3.5 w-3.5 text-fg-muted" />
          </div>
          <p className="mt-1 text-2xl font-bold text-amber">{totalOnCall}</p>
        </div>
        <div className="rounded border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-fg-muted">Avg Team MTTA</span>
            <Clock className="h-3.5 w-3.5 text-fg-muted" />
          </div>
          <p className="mt-1 text-2xl font-bold text-healthy">{avgMtta}</p>
        </div>
        <div className="rounded border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-fg-muted">Fatigue Index</span>
            <Activity className="h-3.5 w-3.5 text-fg-muted" />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-healthy">LOW</span>
            <span className="text-[9px] text-fg-muted">{fatigueIndex}</span>
          </div>
        </div>
      </div>

      {/* Team Cards Grid */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {MOCK_TEAMS.map((team) => (
          <TeamCard key={team.id} team={team} onHandoff={handleHandoff} />
        ))}
      </div>

      {/* Create Team Modal */}
      <CreateTeamModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleTeamCreated}
      />

      {/* Your Teams Modal */}
      <YourTeamsModal
        open={teamsModalOpen}
        teams={apiTeams}
        onClose={() => setTeamsModalOpen(false)}
      />

      {/* Handoff Modal */}
      {selectedTeam && (
        <HandoffModal
          open={handoffOpen}
          teamName={selectedTeam.name}
          teamMembers={selectedTeam.onCall.map((o) => ({ id: o.user.id, name: o.user.name }))}
          onClose={() => { setHandoffOpen(false); setSelectedTeam(null); }}
          onSubmit={handleHandoffSubmit}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded border border-healthy/30 bg-surface px-4 py-2 text-[11px] text-healthy shadow-lg shadow-black/20">
          {toast}
        </div>
      )}
    </div>
  );
}
