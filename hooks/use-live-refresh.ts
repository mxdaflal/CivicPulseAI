"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-client";
export function useLiveRefresh(
  tables: string[],
  refresh: () => void | Promise<void>,
  enabled = true,
) {
  const callback = useRef(refresh);
  useEffect(() => {
    callback.current = refresh;
  }, [refresh]);
  const [state, setState] = useState("Connecting");
  const key = tables.join(",");
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const update = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        timer = setTimeout(() => void callback.current(), 250);
      }
    };
    let channel = supabase.channel(`civic-${key}-${crypto.randomUUID()}`);
    for (const table of key.split(","))
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        update,
      );
    channel.subscribe((status) => {
      if (!active) return;
      setState(
        status === "SUBSCRIBED"
          ? "Live"
          : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
            ? "Reconnecting · refreshing every 15s"
            : "Connecting",
      );
      if (status === "SUBSCRIBED") update();
    });
    const poll = setInterval(update, 15000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
      void supabase.removeChannel(channel);
    };
  }, [key, enabled]);
  return state;
}
