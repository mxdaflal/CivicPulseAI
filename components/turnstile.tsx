"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const element = useRef<HTMLDivElement>(null),
    callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);
  const [ready, setReady] = useState(false);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!ready || !sitekey || !element.current || !window.turnstile) return;
    const id = window.turnstile.render(element.current, {
      sitekey,
      action: "report",
      callback: (token: string) => callback.current(token),
      "expired-callback": () => callback.current(""),
      "error-callback": () => callback.current(""),
    });
    return () => window.turnstile?.remove(id);
  }, [ready, sitekey]);
  if (!sitekey)
    return (
      <p className="rounded-xl bg-secondary p-4 text-sm">
        Anonymous reporting is awaiting anti-abuse configuration. Please sign in
        to submit a report.
      </p>
    );
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
      />
      <div ref={element} />
    </>
  );
}
