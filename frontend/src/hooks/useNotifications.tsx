"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { api, getToken } from "@/lib/api";
import { getEcho } from "@/lib/echo";
import { useAuth } from "./useAuth";
import type { AppNotification } from "@/types";

interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  alertsEnabled: boolean;
  requestAlertsPermission: () => Promise<void>;
  setAlertsEnabled: (enabled: boolean) => void;
  markRead: (id: number) => void;
  markAllRead: () => void;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (localStorage.getItem("pulseops_voice_output") !== "true") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

function fireBrowserAlert(notif: AppNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(`PulseOps — ${notif.incident_number}`, {
      body: `${notif.actor ? `${notif.actor}: ` : ""}${notif.body ?? ""}`,
      tag: `incident-${notif.incident_id}`,
    });
    n.onclick = () => {
      window.focus();
      window.location.href = `/incidents/${notif.incident_id}/war-room`;
      n.close();
    };
  } catch {
    // ignore
  }
}

const initialAlertsEnabled =
  typeof window !== "undefined" && localStorage.getItem("pulseops_browser_alerts") === "true";

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertsEnabled, setAlertsEnabledState] = useState(initialAlertsEnabled);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);
  const lastSeenIdRef = useRef(0);
  const alertsEnabledRef = useRef(initialAlertsEnabled);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ data: AppNotification[]; meta: { unread_count: number } }>("/notifications?per_page=30");
      if (!mountedRef.current) return;
      setItems(res.data || []);
      setUnreadCount(res.meta?.unread_count ?? 0);

      const maxId = (res.data || []).reduce((m, n) => Math.max(m, n.id), 0);
      if (!initializedRef.current) {
        initializedRef.current = true;
        lastSeenIdRef.current = maxId;
        return;
      }
      const fresh = (res.data || []).filter((n) => n.id > lastSeenIdRef.current && !n.read_at);
      lastSeenIdRef.current = maxId;
      for (const n of fresh) {
        if (alertsEnabledRef.current) fireBrowserAlert(n);
        speak(`${n.incident_number}: ${n.body ?? n.type}`);
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    const initial = setTimeout(() => {
      void refresh();
    }, 0);
    const interval = setInterval(() => {
      void refresh();
    }, 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (!user || !getToken()) return;

    let echo: ReturnType<typeof getEcho> | null = null;
    try {
      echo = getEcho();
      const channel = echo.private(`notifications.${user.id}`) as ReturnType<typeof echo.private> & {
        listen: (event: string, callback: (data: AppNotification) => void) => void;
      };
      channel.listen(".notification.created", (data: AppNotification) => {
        if (!mountedRef.current || !data || !data.id) return;
        lastSeenIdRef.current = Math.max(lastSeenIdRef.current, data.id);
        setItems((prev) => [data, ...prev.filter((n) => n.id !== data.id)]);
        setUnreadCount((c) => c + 1);
        if (alertsEnabledRef.current) fireBrowserAlert(data);
        speak(`${data.incident_number}: ${data.body ?? data.type}`);
      });
    } catch {
      // Reverb not available — fall back to polling
    }

    return () => {
      if (echo) {
        try {
          echo.leave(`notifications.${user.id}`);
        } catch {
          // cleanup best effort
        }
      }
    };
  }, [user]);

  const requestAlertsPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    alertsEnabledRef.current = enabled;
    setAlertsEnabledState(enabled);
    localStorage.setItem("pulseops_browser_alerts", String(enabled));
  };

  const setAlertsEnabled = (enabled: boolean) => {
    alertsEnabledRef.current = enabled;
    setAlertsEnabledState(enabled);
    localStorage.setItem("pulseops_browser_alerts", String(enabled));
  };

  const markRead = (id: number) => {
    const target = items.find((n) => n.id === id && !n.read_at);
    if (target) setUnreadCount((c) => Math.max(0, c - 1));
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    api.post("/notifications/read", { ids: [id] }).catch(() => {
      // ignore
    });
  };

  const markAllRead = () => {
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    api.post("/notifications/read", { all: true }).catch(() => {
      // ignore
    });
  };

  return (
    <NotificationsContext.Provider
      value={{
        items,
        unreadCount,
        alertsEnabled,
        requestAlertsPermission,
        setAlertsEnabled,
        markRead,
        markAllRead,
        refresh,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}