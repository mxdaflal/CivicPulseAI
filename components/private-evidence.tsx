"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
export function PrivateEvidence({ path }: { path: string }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      // Historical public URLs identify objects, but are never rendered as public URLs after hardening.
      let objectPath = path;
      if (path.startsWith("http")) {
        try {
          const u = new URL(path);
          const prefix = "/storage/v1/object/public/evidence/";
          if (
            u.origin !==
              new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin ||
            !u.pathname.startsWith(prefix)
          )
            throw new Error();
          objectPath = decodeURIComponent(u.pathname.slice(prefix.length));
        } catch {
          setError("Legacy evidence needs administrator review.");
          return;
        }
      }
      const { data, error } = await supabase.storage
        .from("evidence")
        .createSignedUrl(objectPath, 60);
      if (!active) return;
      if (error)
        setError("Private evidence is unavailable or access was denied.");
      else setUrl(data.signedUrl);
    }
    void load();
    const timer = setInterval(() => void load(), 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [path]);
  return error ? (
    <p className="text-sm text-destructive">{error}</p>
  ) : url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <Image
        unoptimized
        width={640}
        height={480}
        src={url}
        alt="Private report evidence"
        className="rounded-xl max-h-72 object-contain"
        referrerPolicy="no-referrer"
      />
    </a>
  ) : (
    <p>Loading private evidence…</p>
  );
}
