'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  LayoutDashboard,
  ArrowRight,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase, Incident, Department, Report } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { STATUS_CONFIG, PRIORITY_CONFIG, CATEGORY_ICONS, CATEGORY_COLORS, INCIDENT_STATUSES } from '@/lib/constants';
import { analyzeReport, calculateSimilarity } from '@/lib/ai-analysis';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [stats, setStats] = useState({ open: 0, verified: 0, inProgress: 0, resolved: 0, overdue: 0 });

  const isStaff = profile && profile.role !== 'citizen';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard');
    }
    if (!authLoading && user && profile && !isStaff) {
      toast.error('Dashboard access requires a staff account.');
      router.push('/');
    }
  }, [authLoading, user, profile, isStaff, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [incidentsRes, reportsRes, deptsRes] = await Promise.all([
        supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('departments').select('*'),
      ]);

      setIncidents((incidentsRes.data as Incident[]) || []);
      setReports((reportsRes.data as Report[]) || []);
      setDepartments((deptsRes.data as Department[]) || []);

      const incData = (incidentsRes.data as Incident[]) || [];
      const now = new Date();
      setStats({
        open: incData.filter((i) => i.status === 'open').length,
        verified: incData.filter((i) => i.status === 'verified').length,
        inProgress: incData.filter((i) => i.status === 'in_progress' || i.status === 'assigned').length,
        resolved: incData.filter((i) => i.status === 'resolved').length,
        overdue: incData.filter((i) => i.sla_deadline && new Date(i.sla_deadline) < now && i.status !== 'resolved').length,
      });
    } catch {
      toast.error('Failed to load dashboard data.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isStaff) fetchData();
  }, [isStaff, fetchData]);

  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && inc.category_name !== categoryFilter) return false;
    if (priorityFilter !== 'all' && inc.priority_label !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!inc.title.toLowerCase().includes(q) && !inc.location_text.toLowerCase().includes(q) && !inc.category_name.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const unverifiedReports = reports.filter((r) => r.status === 'submitted');

  const handleVerifyReport = async (report: Report) => {
    if (!user) return;
    try {
      const analysis = analyzeReport(report.title, report.description, report.location_text, report.category_name);

      // Create incident from report
      const { data: incidentData, error: incidentError } = await supabase
        .from('incidents')
        .insert({
          title: report.title,
          description: report.description,
          category_name: report.category_name,
          location_text: report.location_text,
          latitude: report.latitude,
          longitude: report.longitude,
          status: 'verified',
          priority_score: analysis.priority_score,
          priority_label: analysis.priority_label,
          report_count: 1,
        })
        .select()
        .single();

      if (incidentError) throw incidentError;

      // Link report to incident
      await supabase.from('report_incident_links').insert({
        report_id: report.id,
        incident_id: incidentData.id,
        reviewed_by: user.id,
        decision: 'confirmed',
      });

      // Update report status
      await supabase.from('reports').update({ status: 'linked' }).eq('id', report.id);

      // Create event
      await supabase.from('incident_events').insert({
        incident_id: incidentData.id,
        actor_id: user.id,
        actor_name: profile?.full_name || 'Staff',
        action: 'incident_created',
        new_status: 'verified',
        notes: `Verified from report ${report.tracking_id}`,
      });

      toast.success('Report verified and incident created.');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify report.');
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categories = Array.from(new Set(incidents.map((i) => i.category_name)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          Operations Dashboard
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Manage incidents, verify reports, and track resolution progress.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Open', value: stats.open, icon: AlertCircle, color: '#1e40af', bg: '#dbeafe' },
          { label: 'Verified', value: stats.verified, icon: CheckCircle2, color: '#0e7490', bg: '#cffafe' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: '#b45309', bg: '#fef3c7' },
          { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: '#15803d', bg: '#dcfce7' },
          { label: 'Overdue', value: stats.overdue, icon: TrendingUp, color: '#b91c1c', bg: '#fee2e2' },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: stat.bg }}>
                  <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                </div>
                <span className="text-2xl font-bold text-navy">{stat.value}</span>
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Reports */}
      {unverifiedReports.length > 0 && (
        <Card className="border-border/60 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-navy flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Pending Verification ({unverifiedReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unverifiedReports.slice(0, 5).map((report) => {
                const CatIcon = CATEGORY_ICONS[report.category_name.replace(/\s/g, '')] || AlertCircle;
                const color = CATEGORY_COLORS[report.category_name] || '#3b82f6';
                return (
                  <div key={report.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${color}15` }}>
                        <CatIcon className="h-4 w-4" style={{ color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-navy truncate">{report.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {report.tracking_id} · {report.category_name} · {new Date(report.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {PRIORITY_CONFIG[report.priority_label] && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0"
                        style={{
                          color: PRIORITY_CONFIG[report.priority_label].color,
                          backgroundColor: PRIORITY_CONFIG[report.priority_label].bg,
                        }}
                      >
                        {PRIORITY_CONFIG[report.priority_label].label}
                      </span>
                    )}
                    <Button size="sm" onClick={() => handleVerifyReport(report)} className="shrink-0 gap-2">
                      Verify
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incidents..."
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {INCIDENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Incidents Table */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg text-navy">
            Incidents ({filteredIncidents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No incidents match your filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredIncidents.map((inc) => {
                const CatIcon = CATEGORY_ICONS[inc.category_name.replace(/\s/g, '')] || AlertCircle;
                const color = CATEGORY_COLORS[inc.category_name] || '#3b82f6';
                const statusConfig = STATUS_CONFIG[inc.status];
                const priorityConfig = PRIORITY_CONFIG[inc.priority_label];
                const isOverdue = inc.sla_deadline && new Date(inc.sla_deadline) < new Date() && inc.status !== 'resolved';

                return (
                  <div
                    key={inc.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/incidents/${inc.id}`)}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${color}15` }}>
                      <CatIcon className="h-5 w-5" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-navy truncate">{inc.title}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{inc.category_name}</span>
                        <span>·</span>
                        {inc.location_text && (
                          <>
                            <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{inc.location_text}</span>
                            <span>·</span>
                          </>
                        )}
                        <span>{inc.report_count} report{inc.report_count !== 1 ? 's' : ''}</span>
                        {isOverdue && (
                          <>
                            <span>·</span>
                            <span className="text-destructive font-medium">OVERDUE</span>
                          </>
                        )}
                      </div>
                    </div>
                    {priorityConfig && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0"
                        style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
                      >
                        {priorityConfig.label}
                      </span>
                    )}
                    {statusConfig && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0"
                        style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
                      >
                        {statusConfig.label}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
