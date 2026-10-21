"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { supabase, type Report } from "@/lib/supabase-client";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS_CONFIG } from "@/lib/constants";
export default function CitizenDashboard() {
  const { user, loading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [fetching, setFetching] = useState(true);
  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * 20, page * 20 + 19);
    if (error) setError("Your reports could not be loaded. Please retry.");
    else {
      setReports(data ?? []);
      setError("");
    }
    setFetching(false);
  }, [user, page]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const live = useLiveRefresh(["reports", "notifications"], refresh, !!user);
  if (loading) return <p className="p-8">Loading your account…</p>;
  if (!user)
    return (
      <p className="p-8">
        <Link href="/citizen/login">Sign in to view your reports.</Link>
      </p>
    );
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-teal">Your civic workspace · {live}</p>
          <h1 className="text-3xl font-bold mt-2">My reports</h1>
        </div>
        <Button asChild>
          <Link href="/report">
            <Plus className="mr-2 h-4 w-4" />
            Report an issue
          </Link>
        </Button>
      </div>
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => void refresh()} className="underline">
            Retry
          </button>
        </p>
      )}
      {fetching ? (
        <p>Loading reports…</p>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FileText className="h-10 w-10 mx-auto text-teal mb-4" />
            <h2 className="font-semibold text-xl">
              Your observations can make a difference
            </h2>
            <p className="mt-2 text-muted-foreground">
              No reports on this page. Submit an issue to start tracking it
              here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {r.tracking_id}
                  </p>
                  <h2 className="text-lg font-semibold mt-1">{r.title}</h2>
                  <p className="text-sm mt-1 text-muted-foreground">
                    {r.category_name} ·{" "}
                    {new Date(r.created_at).toLocaleDateString()} ·{" "}
                    {STATUS_CONFIG[r.status]?.label}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/track?id=${r.tracking_id}`}>View progress</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span className="p-2 text-sm">Page {page + 1}</span>
        <Button
          variant="outline"
          disabled={reports.length < 20}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
