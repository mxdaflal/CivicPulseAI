'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  Loader2,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase, Incident, Report } from '@/lib/supabase-client';
import { CATEGORY_COLORS, CATEGORY_ICONS, STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function AnalyticsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [incRes, repRes] = await Promise.all([
          supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(200),
          supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200),
        ]);
        setIncidents((incRes.data as Incident[]) || []);
        setReports((repRes.data as Report[]) || []);
      } catch {
        // use empty data
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categoryCounts = incidents.reduce((acc, inc) => {
    acc[inc.category_name] = (acc[inc.category_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(categoryCounts).map(([name, count]) => ({
    name,
    count,
    fill: CATEGORY_COLORS[name] || '#3b82f6',
  }));

  const statusCounts = incidents.reduce((acc, inc) => {
    acc[inc.status] = (acc[inc.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_CONFIG[status]?.label || status,
    value: count,
    fill: STATUS_CONFIG[status]?.color || '#64748b',
  }));

  const priorityCounts = incidents.reduce((acc, inc) => {
    acc[inc.priority_label] = (acc[inc.priority_label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const priorityData = Object.entries(priorityCounts).map(([priority, count]) => ({
    name: PRIORITY_CONFIG[priority]?.label || priority,
    value: count,
    fill: PRIORITY_CONFIG[priority]?.color || '#64748b',
  }));

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const trendData = last7Days.map((d) => {
    const dayStr = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    const dayIncidents = incidents.filter((inc) => {
      const incDate = new Date(inc.created_at);
      return incDate.toDateString() === d.toDateString();
    });
    const dayReports = reports.filter((r) => {
      const rDate = new Date(r.created_at);
      return rDate.toDateString() === d.toDateString();
    });
    return {
      day: dayStr,
      reports: dayReports.length,
      incidents: dayIncidents.length,
    };
  });

  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved' && i.resolved_at);
  const avgResolutionDays = resolvedIncidents.length > 0
    ? Math.round(
        resolvedIncidents.reduce((sum, inc) => {
          const created = new Date(inc.created_at).getTime();
          const resolved = new Date(inc.resolved_at!).getTime();
          return sum + (resolved - created) / (1000 * 60 * 60 * 24);
        }, 0) / resolvedIncidents.length
      )
    : 0;

  const topLocations = incidents.reduce((acc, inc) => {
    if (inc.location_text) {
      acc[inc.location_text] = (acc[inc.location_text] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const hotspotData = Object.entries(topLocations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const totalIncidents = incidents.length;
  const totalReports = reports.length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;
  const resolutionRate = totalIncidents > 0 ? Math.round((resolvedCount / totalIncidents) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Civic Intelligence Lab
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Historical trends, category breakdowns, resolution analysis, and emerging hotspots.
        </p>
      </div>

      {totalIncidents === 0 && totalReports === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary mb-4">
              <BarChart3 className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-navy">No data available yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Once reports are filed and incidents are created, analytics will appear here with real charts and insights.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Reports', value: totalReports, icon: AlertCircle, color: '#1e40af' },
              { label: 'Total Incidents', value: totalIncidents, icon: TrendingUp, color: '#0e7490' },
              { label: 'Resolution Rate', value: `${resolutionRate}%`, icon: CheckCircle2, color: '#15803d' },
              { label: 'Avg Resolution', value: `${avgResolutionDays}d`, icon: Clock, color: '#b45309' },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${stat.color}15` }}>
                      <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                    </div>
                    <span className="text-2xl font-bold text-navy">{stat.value}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Trend Chart */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent" />
                7-Day Activity Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="reports" stroke="#0ea5e9" strokeWidth={2} name="Reports" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="incidents" stroke="#16a34a" strokeWidth={2} name="Incidents" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg text-navy">Incidents by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No category data yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg text-navy">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}
                        labelLine={{ stroke: 'hsl(var(--border))' }}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No status data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Priority Breakdown */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg text-navy">Priority Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {priorityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={priorityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No priority data yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Hotspots */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg text-navy flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-accent" />
                  Top Hotspot Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hotspotData.length > 0 ? (
                  <div className="space-y-3">
                    {hotspotData.map(([location, count], i) => (
                      <div key={location} className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-navy truncate">{location}</div>
                          <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${(count / hotspotData[0][1]) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No location data available.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Data Disclaimer */}
          <Card className="border-border/60 bg-secondary/30">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground text-center">
                Data shown reflects incidents and reports in the current database. Historical trends require
                sufficient data for meaningful analysis. Forecasting features will be enabled when enough
                quality historical data exists.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
