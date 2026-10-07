"use client";

import { useState, useEffect } from "react";
import { getEcho } from "@/lib/echo";

export type WebSocketStatus = "online" | "connecting" | "offline" | "polling";

const ECHO_STATES: Record<string, WebSocketStatus> = {
  connected: "online",
  connecting: "connecting",
  reconnecting: "connecting",
  failed: "offline",
  disconnected: "offline",
};

export function useWebSocketStatus(): WebSocketStatus {
  const [status, setStatus] = useState<WebSocketStatus>(() =>
    process.env.NEXT_PUBLIC_REVERB_APP_KEY ? "connecting" : "polling"
  );

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_REVERB_APP_KEY) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const apply = (s: string) => {
      if (!cancelled) setStatus(ECHO_STATES[s] ?? "offline");
    };

    try {
      const echo = getEcho();
      queueMicrotask(() => apply(echo.connector.connectionStatus()));
      unsubscribe = echo.connector.onConnectionChange(apply);
    } catch {
      queueMicrotask(() => apply("disconnected"));
      return;
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return status;
}
