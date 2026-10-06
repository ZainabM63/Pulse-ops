import Echo from "laravel-echo";
import Pusher from "pusher-js";

let echoInstance: Echo<"pusher"> | null = null;

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

  echoInstance = new Echo({
    broadcaster: "pusher",
    key: appKey,
    wsHost,
    wsPort,
    wssPort: wsPort,
    forceTLS: wsScheme === "https",
    enabledTransports: ["ws", "wss"],
    disableStats: true,
  });

  return echoInstance;
}

export function leaveChannel(channel: string) {
  if (echoInstance) {
    echoInstance.leave(channel);
  }
}
