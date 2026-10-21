"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase-client";
import { categories } from "@/lib/report-schema";
import { STATUS_CONFIG } from "@/lib/constants";
const Map = dynamic(
  () => import("@/components/issue-map").then((m) => m.IssueMap),
  { ssr: false },
);
type Summary = {
  id: string;
  title: string;
  category_name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
};
export default function PublicMap() {
  const [items, setItems] = useState<Summary[]>([]),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("all"),
    [error, setError] = useState(""),
    [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    let q = supabase
      .from("public_incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * 100, page * 100 + 99);
    if (category !== "all") q = q.eq("category_name", category);
    if (status !== "all") q = q.eq("status", status);
    void q.then(({ data, error }) => {
      if (!active) return;
      if (error) setError("Public incidents are temporarily unavailable.");
      else {
        setItems(data ?? []);
        setError("");
      }
    });
    return () => {
      active = false;
    };
  }, [category, status, page]);
  const points = useMemo(
    () =>
      items.filter(
        (i): i is Summary & { latitude: number; longitude: number } =>
          i.latitude !== null && i.longitude !== null,
      ),
    [items],
  );
  return (
    <div className="max-w-6xl mx-auto p-4 py-10">
      <h1 className="text-3xl font-bold">Community incident map</h1>
      <p className="text-muted-foreground my-4">
        Verified incident summaries only. Coordinates are rounded to
        approximately a kilometre. Private complaint text, evidence and reporter
        identity are excluded.
      </p>
      <div className="flex flex-wrap gap-4 mb-5">
        <label className="text-sm">
          Category{" "}
          <select
            className="border rounded p-2 bg-background"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Status{" "}
          <select
            className="border rounded p-2 bg-background"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All statuses</option>
            {[
              "verified",
              "assigned",
              "in_progress",
              "resolved",
              "reopened",
            ].map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <Map points={points} />
      {items.length === 0 && !error && (
        <p className="py-8">No verified incidents match these filters.</p>
      )}
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
        {items.map((i) => (
          <li className="border rounded-xl p-4" key={i.id}>
            <h2 className="font-semibold">{i.title}</h2>
            <p className="text-sm mt-2">{STATUS_CONFIG[i.status]?.label}</p>
            <p className="text-xs mt-2 text-muted-foreground">
              {i.latitude === null
                ? "Area not published"
                : "Approximate location on map"}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex gap-4">
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button disabled={items.length < 100} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
