"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Volume2, VolumeX } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppNotification } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  chat: "Message",
  voice_note: "Voice note",
  comment: "Comment",
  status_change: "Status change",
  severity_change: "Severity change",
  assignment: "Assignment",
  agent_action: "Agent action",
  hypothesis: "Hypothesis",
  command: "Command",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationsBell() {
  const {
    items,
    unreadCount,
    alertsEnabled,
    requestAlertsPermission,
    setAlertsEnabled,
    markRead,
    markAllRead,
  } = useNotifications();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleAlerts = () => {
    if (alertsEnabled) {
      setAlertsEnabled(false);
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted") {
      requestAlertsPermission();
    } else {
      setAlertsEnabled(true);
    }
  };

  const openItem = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    router.push(`/incidents/${n.incident_id}/war-room`);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-7 w-7 items-center justify-center rounded border border-border bg-card text-fg-muted transition-colors hover:border-amber/40 hover:text-fg-primary"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[8px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded border border-border bg-card shadow-lg shadow-black/20">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-fg-primary">Alerts</p>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-fg-muted transition-colors hover:text-healthy disabled:opacity-40"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-[10px] text-fg-muted">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`block w-full border-b border-border/60 px-3 py-2 text-left transition-colors hover:bg-hover-row ${
                    n.read_at ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber">
                      {n.incident_number}
                    </span>
                    <span className="text-[9px] text-fg-muted">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-fg-primary">{n.body ?? ""}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wider text-fg-muted">
                    {TYPE_LABELS[n.type] ?? n.type}
                    {n.actor ? ` · ${n.actor}` : ""}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-fg-muted">Browser alerts</span>
            <button
              onClick={toggleAlerts}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all ${
                alertsEnabled
                  ? "border-amber/50 bg-amber/10 text-amber"
                  : "border-border bg-surface text-fg-muted hover:border-border"
              }`}
            >
              {alertsEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              {alertsEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}