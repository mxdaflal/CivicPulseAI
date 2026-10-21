"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Clock, LockKeyhole, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_CONFIG } from "@/lib/constants";
type Tracking = {
  tracking_id: string;
  title: string;
  category_name: string;
  status: string;
  created_at: string;
  incident_status: string | null;
  department: string | null;
  resolved_at: string | null;
  events: {
    action: string;
    old_status: string | null;
    new_status: string | null;
    created_at: string;
  }[];
};
export default function TrackPage() {
  const params = useSearchParams();
  const [reference, setReference] = useState(params.get("id") ?? ""),
    [secret, setSecret] = useState(""),
    [result, setResult] = useState<Tracking | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [updated, setUpdated] = useState<Date | null>(null);
  const active = useRef<{ reference: string; secret: string } | null>(null),
    request = useRef<AbortController | null>(null);
  const load = useCallback(
    async (query: { reference: string; secret: string }, quiet = false) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      if (!quiet) {
        setBusy(true);
        setResult(null);
        setError("");
      }
      try {
        const response = await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(query),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setResult(data);
        setError("");
        setUpdated(new Date());
        active.current = query;
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Tracking unavailable");
          if (!quiet) active.current = null;
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    },
    [],
  );
  useEffect(() => {
    const id = params.get("id");
    const initial = setTimeout(() => {
      if (id) void load({ reference: id, secret: "" });
    }, 0);
    const tick = () => {
      if (active.current && document.visibilityState === "visible")
        void load(active.current, true);
    };
    const timer = setInterval(tick, 15000);
    window.addEventListener("online", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      request.current?.abort();
      window.removeEventListener("online", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [params, load]);
  const status = result?.incident_status ?? result?.status;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-teal text-sm font-semibold uppercase tracking-widest">
        Private progress, clear accountability
      </p>
      <h1 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">
        Track your complaint
      </h1>
      <p className="text-muted-foreground mb-8">
        Sign in as the report owner, or enter the private access key issued when
        you submitted it. A reference alone never unlocks a private complaint.
      </p>
      <Card>
        <CardContent className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load({ reference: reference.trim(), secret: secret.trim() });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="reference">Tracking reference</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="CP-…"
                maxLength={64}
                required
              />
            </div>
            <div>
              <Label htmlFor="secret">
                Private access key (not needed when signed in as owner)
              </Label>
              <Input
                id="secret"
                type="password"
                autoComplete="off"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                maxLength={64}
              />
            </div>
            <Button disabled={busy} type="submit">
              <Search className="mr-2 h-4 w-4" />
              {busy ? "Checking…" : "Track progress"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {error && (
        <p
          role="alert"
          className="mt-5 p-4 rounded-xl bg-destructive/10 text-destructive"
        >
          {error}
        </p>
      )}
      {result && (
        <section className="mt-7 space-y-5" aria-live="polite">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {result.tracking_id}
                  </p>
                  <h2 className="text-2xl font-bold mt-2">{result.title}</h2>
                  <p className="text-muted-foreground mt-2">
                    {result.category_name}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm">
                  {STATUS_CONFIG[status ?? ""]?.label ?? status}
                </span>
              </div>
              <p className="mt-4 text-sm">
                Reported {new Date(result.created_at).toLocaleString()}
              </p>
              {result.department && (
                <p className="mt-2">
                  Assigned pilot department: {result.department}
                </p>
              )}
              <p className="mt-5 text-xs text-muted-foreground">
                Refreshes every 15 seconds while this page is visible.{" "}
                {updated && `Last checked ${updated.toLocaleTimeString()}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold text-xl mb-5 flex gap-2">
                <Clock />
                Progress timeline
              </h2>
              <ol className="border-l-2 ml-2 space-y-6">
                <li className="pl-5">
                  <p className="font-semibold">Submitted for review</p>
                  <time className="text-sm text-muted-foreground">
                    {new Date(result.created_at).toLocaleString()}
                  </time>
                </li>
                {result.events.map((e, i) => (
                  <li key={`${e.created_at}-${i}`} className="pl-5">
                    <p className="font-semibold">
                      {e.new_status
                        ? (STATUS_CONFIG[e.new_status]?.label ?? e.new_status)
                        : e.action.replaceAll("_", " ")}
                    </p>
                    <time className="text-sm text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ol>
              {result.status === "rejected" && (
                <p className="mt-5">The report was reviewed and rejected.</p>
              )}
            </CardContent>
          </Card>
        </section>
      )}
      <p className="mt-8 text-xs text-muted-foreground flex gap-2">
        <LockKeyhole className="h-4 w-4" />
        Tracking excludes internal notes, contact information, evidence and
        precise location.
      </p>
    </div>
  );
}
