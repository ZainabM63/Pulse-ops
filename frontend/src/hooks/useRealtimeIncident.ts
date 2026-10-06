"use client";

import { useEffect, useCallback, useRef } from "react";
import { getEcho } from "@/lib/echo";
import { getToken } from "@/lib/api";

interface RealtimeEvent {
  type: "chat.message" | "incident.updated";
  data: Record<string, unknown>;
}

type EventHandler = (event: RealtimeEvent) => void;

export function useRealtimeIncident(companyId: number | null | undefined, onEvent: EventHandler) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!companyId || !getToken()) return;

    let echo: ReturnType<typeof getEcho> | null = null;

    try {
      echo = getEcho();
      const channel = echo.private(`company.${companyId}`) as ReturnType<typeof echo.private> & { listen: (event: string, callback: (data: Record<string, unknown>) => void) => void };

      channel.listen(".chat.message", (data: Record<string, unknown>) => {
        onEventRef.current({ type: "chat.message", data });
      });

      channel.listen(".incident.updated", (data: Record<string, unknown>) => {
        onEventRef.current({ type: "incident.updated", data });
      });
    } catch {
      // Echo not available (no Reverb running) — silently fall back to polling
    }

    return () => {
      if (echo) {
        try {
          echo.leave(`company.${companyId}`);
        } catch {
          // cleanup best effort
        }
      }
    };
  }, [companyId]);
}

export function useRealtimeChat(
  companyId: number | null | undefined,
  onNewMessage: (activity: Record<string, unknown>) => void
) {
  const callbackRef = useRef(onNewMessage);
  callbackRef.current = onNewMessage;

  useRealtimeIncident(companyId, useCallback((event: RealtimeEvent) => {
    if (event.type === "chat.message") {
      callbackRef.current(event.data);
    }
  }, []));
}
