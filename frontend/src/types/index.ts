export interface Company {
  id: number;
  name: string;
  slug: string;
  settings: Record<string, unknown> | null;
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  company: Company | null;
  team: Team | null;
  created_at: string;
}

export interface Service {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: "operational" | "degraded" | "partial_outage" | "major_outage";
  severity_level: string;
  metadata: Record<string, unknown> | null;
  team: Team | null;
  created_at: string;
}

export type EscalationLevel = "level_1" | "level_2" | "level_3";

export interface Incident {
  id: number;
  title: string;
  description: string | null;
  severity: "critical" | "major" | "minor" | "info";
  status: "investigating" | "identified" | "monitoring" | "resolved" | "postmortem";
  reporter: User | null;
  assignee: User | null;
  team: Team | null;
  services: Service[];
  activities: IncidentActivity[];
  escalation_level: EscalationLevel;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentActivity {
  id: number;
  type: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  user: User | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export function getEscalationLevel(createdAt: string): EscalationLevel {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  const minutes = elapsed / 60000;
  if (minutes > 60) return "level_3";
  if (minutes > 30) return "level_2";
  return "level_1";
}

export function getEscalationLabel(level: EscalationLevel): string {
  switch (level) {
    case "level_1": return "LEVEL 1 (On-Call)";
    case "level_2": return "LEVEL 2 (Escalated to Lead)";
    case "level_3": return "LEVEL 3 (Escalated to VP)";
  }
}

export function getDuration(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ─── On-Call & Teams ───
export interface OnCallShift {
  user: { id: number; name: string; email: string };
  role: "primary" | "backup";
  sla: string;
  shiftStart: string;
  shiftEnd: string;
}

export interface EscalationStep {
  delay: string;
  target: string;
  channel: string;
}

export interface HandoverNote {
  author: string;
  message: string;
  timestamp: string;
  unresolvedFlags: string[];
}

export interface TeamMetrics {
  healthStatus: "operational" | "high_load";
  incidentCount: number;
  avgMtta: string;
  engineersOnCall: number;
}

export interface TeamCardData {
  id: number;
  name: string;
  slug: string;
  serviceTag: string;
  metrics: TeamMetrics;
  onCall: OnCallShift[];
  escalationSteps: EscalationStep[];
  handover: HandoverNote;
  shiftProgress: number;
  shiftRemaining: string;
}

// ─── Theme Types ───
export type Theme = "light" | "dark" | "system";

export interface ThemeConfig {
  name: Theme;
  label: string;
  icon: string;
}

export const THEMES: ThemeConfig[] = [
  { name: "light", label: "Light", icon: "sun" },
  { name: "dark", label: "Dark", icon: "moon" },
  { name: "system", label: "System", icon: "monitor" },
];

// ─── Environment Badge ───
export type Environment = "prod" | "staging" | "dev";

export interface EnvironmentConfig {
  name: Environment;
  label: string;
  color: string;
}

export const ENVIRONMENTS: EnvironmentConfig[] = [
  { name: "prod", label: "PROD", color: "bg-healthy text-white" },
  { name: "staging", label: "STAGING", color: "bg-amber text-black" },
  { name: "dev", label: "DEV", color: "bg-fg-muted text-white" },
];

// ─── Service Tier ───
export type ServiceTier = "tier_0" | "tier_1" | "tier_2" | "tier_3";

export interface ServiceTierConfig {
  name: ServiceTier;
  label: string;
  description: string;
}

export const SERVICE_TIERS: ServiceTierConfig[] = [
  { name: "tier_0", label: "Tier 0 - Critical", description: "Mission-critical, zero downtime" },
  { name: "tier_1", label: "Tier 1 - Essential", description: "Core business functions" },
  { name: "tier_2", label: "Tier 2 - Important", description: "Supporting services" },
  { name: "tier_3", label: "Tier 3 - Low", description: "Non-critical, best effort" },
];

// ─── Circuit Breaker ───
export type CircuitBreakerState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  state: CircuitBreakerState;
  label: string;
  color: string;
}

export const CIRCUIT_BREAKERS: CircuitBreakerConfig[] = [
  { state: "closed", label: "CLOSED", color: "bg-healthy text-white" },
  { state: "open", label: "OPEN", color: "bg-outage text-white" },
  { state: "half_open", label: "HALF-OPEN", color: "bg-degraded text-black" },
];

// ─── War Room ───
export type WarRoomCommand = "/ack" | "/escalate" | "/attach-log" | "/status" | "/help";

export const WAR_ROOM_COMMANDS: Record<WarRoomCommand, string> = {
  "/ack": "Acknowledge the incident",
  "/escalate": "Escalate to next level",
  "/attach-log": "Attach log stream to incident",
  "/status": "Show current status",
  "/help": "Show available commands",
};
