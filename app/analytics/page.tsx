"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
type Analytics = {
  stats: {
    reports: number;
    verified: number;
    inProgress: number;
    resolved: number;
  };
  categories: { name: string; count: number }[];
  statuses: { name: string; count: number }[];
  trends: { day: string; reports: number; incidents: number }[];
  average_resolution_hours: number | null;
  hotspots: { latitude: number; longitude: number; count: number }[];
};
export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void supabase.rpc("civic_public_analytics").then(({ data, error }) => {
      if (!active) return;
      if (error)
        setError(
          "Analytics are temporarily unavailable. No sample statistics are substituted.",
        );
      else setData(data);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="text-teal text-sm uppercase tracking-widest font-semibold">
        Evidence before prediction
      </p>
      <h1 className="text-3xl font-bold mt-2">Civic intelligence</h1>
      <p className="mt-3 mb-8 text-muted-foreground">
        Aggregates from saved records. Incident charts include reviewed
        incidents; rejected and unverified incidents are excluded. No personal
        complaint details are published.
      </p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading database aggregates…</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            {Object.entries(data.stats).map(([name, value]) => (
              <Card key={name}>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">
                    {
                      (
                        {
                          reports: "Reports received",
                          verified: "Awaiting assignment",
                          inProgress: "Assigned / in progress",
                          resolved: "Resolved",
                        } as Record<string, string>
                      )[name]
                    }
                  </p>
                  <p className="text-3xl font-bold mt-3">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {data.stats.reports === 0 && (
            <p className="rounded-xl bg-secondary p-5 mb-6">
              No reports have been recorded. Charts will populate from real
              submissions and verified incidents.
            </p>
          )}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-5">
                <h2 className="font-semibold mb-5">
                  Reports and verified incidents · 14 days (UTC)
                </h2>
                <div
                  className="h-72"
                  role="img"
                  aria-label="Fourteen-day counts of reports and reviewed incidents"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="day"
                        tickFormatter={(s) => String(s).slice(5)}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line name="Reports" dataKey="reports" stroke="#0284c7" />
                      <Line
                        name="Reviewed incidents"
                        dataKey="incidents"
                        stroke="#0d9488"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h2 className="font-semibold mb-5">
                  Reviewed incidents by category
                </h2>
                {data.categories.length ? (
                  <div
                    className="h-72"
                    role="img"
                    aria-label="Incidents by category"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.categories} layout="vertical">
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={130}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0d9488" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p>No reviewed incidents yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h2 className="font-semibold mb-4">Measured outcomes</h2>
                <p>
                  Average resolution time:{" "}
                  {data.average_resolution_hours === null
                    ? "Insufficient recorded resolutions"
                    : `${data.average_resolution_hours} hours`}
                </p>
                <ul className="mt-4 space-y-2">
                  {data.statuses.map((s) => (
                    <li key={s.name} className="capitalize">
                      {s.name.replaceAll("_", " ")}: {s.count}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h2 className="font-semibold mb-4">
                  Historical area concentrations
                </h2>
                {data.hotspots.length ? (
                  data.hotspots.map((h) => (
                    <p key={`${h.latitude},${h.longitude}`}>
                      Approximate area {h.latitude}, {h.longitude}: {h.count}{" "}
                      reviewed incidents in 90 days
                    </p>
                  ))
                ) : (
                  <p>
                    Insufficient data. At least three reviewed incidents in the
                    same rounded area are required to surface a concentration.
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  Historical counts are observations, not forecasts. No
                  predictive accuracy or causal relationship is claimed.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
