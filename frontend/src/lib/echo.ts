import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { getToken } from "@/lib/api";

let echoInstance: Echo<"pusher"> | null = null;

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/api\/v1\/?$/, "");

export function getEcho(): Echo<"pusher"> {
  if (echoInstance) return echoInstance;

  if (typeof window === "undefined") {
    throw new Error("Echo can only be initialized in the browser");
  }

  const appKey = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const wsHost = process.env.NEXT_PUBLIC_REVERB_HOST || "localhost";
  const wsPort = Number(process.env.NEXT_PUBLIC_REVERB_PORT) || 8080;
  const wsScheme = process.env.NEXT_PUBLIC_REVERB_SCHEME || "http";

  if (!appKey) {
    throw new Error("NEXT_PUBLIC_REVERB_APP_KEY is not set");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Pusher = Pusher;
  const token = getToken();

  echoInstance = new Echo({
    broadcaster: "pusher",
    key: appKey,
    wsHost,
    wsPort,
    wssPort: wsPort,
    forceTLS: wsScheme === "https",
    enabledTransports: ["ws", "wss"],
    disableStats: true,
    authEndpoint: `${API_BASE}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token ?? ""}`,
        Accept: "application/json",
      },
    },
  });

  return echoInstance;
}

export function leaveChannel(channel: string) {
  if (echoInstance) {
    echoInstance.leave(channel);
  }
}
