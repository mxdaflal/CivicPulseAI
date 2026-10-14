'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2, Shield, LogOut, FileText, Search, Filter, AlertCircle,
  CheckCircle2, Clock, TrendingUp, MapPin, ChevronRight, Eye,
  Droplets, Trash2, Construction, Waves, Lightbulb, Bus,
  AlertTriangle, Calendar, Building2, Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase, Report, Incident, Department, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { STATUS_CONFIG, PRIORITY_CONFIG, CATEGORY_COLORS, CATEGORY_ICONS, INCIDENT_STATUSES, STATUS_TRANSITIONS } from '@/lib/constants';
import { generateTrackingId, analyzeReport } from '@/lib/ai-analysis';

const STAFF_ROLES = ['verifier', 'operator', 'manager', 'admin', 'staff'];

const categoryIcons: Record<string, any> = {
  'Water Supply': Droplets,
  'Garbage Overflow': Trash2,
  'Damaged Road': Construction,
  'Drainage Problem': Waves,
  'Streetlight Failure': Lightbulb,
  'Public Transport': Bus,
};

export default function StaffDashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [stats, setStats] = useState({ open: 0, verified: 0, inProgress: 0, resolved: 0, pending: 0, overdue: 0 });

  const isStaff = profile && STAFF_ROLES.includes(profile.role);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/staff/login');
      return;
    }
    if (!authLoading && user && profile && !isStaff) {
      toast.error('Access denied. Staff account required.');
      router.push('/staff/login');
    }
  }, [authLoading, user, profile, isStaff, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsRes, incidentsRes, deptsRes] = await Promise.all([
        supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('departments').select('*'),
      ]);

      setReports((reportsRes.data as Report[]) || []);
      setIncidents((incidentsRes.data as Incident[]) || []);
      setDepartments((deptsRes.data as Department[]) || []);

      const incData = (incidentsRes.data as Incident[]) || [];
      const repData = (reportsRes.data as Report[]) || [];
      const now = new Date();
      const overdueCount = incData.filter((i) =>
        i.sla_deadline && i.status !== 'resolved' && i.status !== 'rejected' && new Date(i.sla_deadline) < now
      ).length;
      setStats({
        open: incData.filter((i) => i.status === 'open').length,
        verified: incData.filter((i) => i.status === 'verified').length,
        inProgress: incData.filter((i) => i.status === 'in_progress' || i.status === 'assigned').length,
        resolved: incData.filter((i) => i.status === 'resolved').length,
        pending: repData.filter((r) => r.status === 'submitted').length,
        overdue: overdueCount,
      });
    } catch {
      toast.error('Failed to load dashboard data.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isStaff) fetchData();
  }, [isStaff, fetchData]);

  const handleVerifyReport = async (report: Report) => {
    if (!user) return;
    try {
      const analysis = analyzeReport(report.title, report.description || '', report.location_text, report.category_name);

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

      await supabase.from('report_incident_links').insert({
        report_id: report.id,
        incident_id: incidentData.id,
        reviewed_by: user.id,
        decision: 'confirmed',
      });

      await supabase.from('reports').update({ status: 'linked' }).eq('id', report.id);

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

  const handleStatusChange = async (incident: Incident, newStatus: string) => {
    if (!user) return;
    try {
      const updateData: Record<string, any> = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('incidents')
        .update(updateData)
        .eq('id', incident.id);

      if (error) throw error;

      await supabase.from('incident_events').insert({
        incident_id: incident.id,
        actor_id: user.id,
        actor_name: profile?.full_name || 'Staff',
        action: 'status_change',
        old_status: incident.status,
        new_status: newStatus,
      });

      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}.`);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update status. Please try again.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleAssignDepartment = async (incident: Incident, deptId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('incidents')
        .update({ assigned_department_id: deptId, department_id: deptId, updated_at: new Date().toISOString() })
        .eq('id', incident.id);

      if (error) throw error;

      const dept = departments.find((d) => d.id === deptId);
      await supabase.from('incident_events').insert({
        incident_id: incident.id,
        actor_id: user.id,
        actor_name: profile?.full_name || 'Staff',
        action: 'department_assigned',
        notes: `Assigned to ${dept?.name || 'department'}`,
      });

      toast.success(`Incident assigned to ${dept?.name || 'department'}.`);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to assign department.');
    }
  };

  const handleDeleteIncident = async (incident: Incident) => {
    if (!user || profile?.role !== 'admin') return;
    try {
      await supabase.from('incident_events').delete().eq('incident_id', incident.id);
      await supabase.from('report_incident_links').delete().eq('incident_id', incident.id);
      const { error } = await supabase.from('incidents').delete().eq('id', incident.id);
      if (error) throw error;
      toast.success('Incident deleted.');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to delete incident.');
    }
  };

  const handleRejectReport = async (report: Report) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('reports').update({ status: 'rejected' }).eq('id', report.id);
      if (error) throw error;
      toast.success('Report rejected.');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to reject report.');
    }
  };

  const isAdmin = profile?.role === 'admin';

  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && inc.priority_label !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!inc.title.toLowerCase().includes(q) && !inc.location_text?.toLowerCase().includes(q) && !inc.category_name?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const unverifiedReports = reports.filter((r) => r.status === 'submitted');

  if (authLoading || (!profile && authLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isStaff) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-600" />
            Staff Operations Dashboard
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {profile?.full_name} · <Badge variant="secondary" className="capitalize">{profile?.role}</Badge>
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut} className="gap-2 shrink-0">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Pending Review', value: stats.pending, icon: AlertCircle, color: '#b45309', bg: '#fef3c7' },
          { label: 'Open', value: stats.open, icon: AlertCircle, color: '#1e40af', bg: '#dbeafe' },
          { label: 'Verified', value: stats.verified, icon: CheckCircle2, color: '#0e7490', bg: '#cffafe' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: '#b45309', bg: '#fef3c7' },
          { label: 'Resolved', value: stats.resolved, icon: TrendingUp, color: '#15803d', bg: '#dcfce7' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: '#b91c1c', bg: '#fee2e2' },
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Pending reports + incidents table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Verification */}
          {unverifiedReports.length > 0 && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg text-navy flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Pending Verification ({unverifiedReports.length})
                </CardTitle>
                <CardDescription>Review and verify citizen submissions.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {unverifiedReports.slice(0, 10).map((report) => {
                    const color = CATEGORY_COLORS[report.category_name] || '#3b82f6';
                    const CatIcon = categoryIcons[report.category_name] || AlertCircle;
                    const priorityConfig = PRIORITY_CONFIG[report.priority_label];
                    return (
                      <div key={report.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${color}15` }}>
                            <CatIcon className="h-4 w-4" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-navy truncate text-sm">{report.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {report.tracking_id} · {report.category_name} · {new Date(report.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {priorityConfig && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
                            style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
                          >
                            {priorityConfig.label}
                          </span>
                        )}
                        <Button size="sm" onClick={() => handleVerifyReport(report)} className="shrink-0 gap-1.5">
                          Verify <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRejectReport(report)} className="shrink-0 text-red-600 border-red-200 hover:bg-red-50">
                          Reject
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
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
                <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
                  {filteredIncidents.map((inc) => {
                    const CatIcon = categoryIcons[inc.category_name] || AlertCircle;
                    const color = CATEGORY_COLORS[inc.category_name] || '#3b82f6';
                    const statusConfig = STATUS_CONFIG[inc.status];
                    const priorityConfig = PRIORITY_CONFIG[inc.priority_label];
                    const transitions = STATUS_TRANSITIONS[inc.status] || [];
                    const now = new Date();
                    const isOverdue = inc.sla_deadline && inc.status !== 'resolved' && inc.status !== 'rejected' && new Date(inc.sla_deadline) < now;
                    const assignedDept = departments.find((d) => d.id === (inc.assigned_department_id || inc.department_id));
                    const daysSinceCreated = Math.floor((now.getTime() - new Date(inc.created_at).getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <div key={inc.id} className={`rounded-lg border p-3 hover:bg-secondary/50 transition-colors ${isOverdue ? 'border-red-300 bg-red-50/30' : 'border-border'}`}>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0 cursor-pointer"
                            style={{ backgroundColor: `${color}15` }}
                            onClick={() => router.push(`/incidents/${inc.id}`)}
                          >
                            <CatIcon className="h-4 w-4" style={{ color }} />
                          </div>
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/incidents/${inc.id}`)}>
                            <div className="font-medium text-navy truncate text-sm">{inc.title}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span>{inc.category_name}</span>
                              {inc.location_text && (
                                <><span>·</span><span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{inc.location_text}</span></>
                              )}
                              <span>·</span>
                              <span>{inc.report_count} report{inc.report_count !== 1 ? 's' : ''}</span>
                              {assignedDept && (
                                <><span>·</span><span className="flex items-center gap-0.5"><Building2 className="h-3 w-3" />{assignedDept.name}</span></>
                              )}
                            </div>
                          </div>
                          {isOverdue && (
                            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 bg-red-100 text-red-700">
                              <Timer className="h-3 w-3" /> Overdue
                            </span>
                          )}
                          {priorityConfig && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
                              style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
                            >
                              {priorityConfig.label}
                            </span>
                          )}
                          {statusConfig && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
                              style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
                            >
                              {statusConfig.label}
                            </span>
                          )}
                        </div>

                        {/* Meta info: dates, SLA */}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            Created {new Date(inc.created_at).toLocaleDateString()}
                            {daysSinceCreated > 0 && ` (${daysSinceCreated}d ago)`}
                          </span>
                          {inc.sla_deadline && inc.status !== 'resolved' && inc.status !== 'rejected' && (
                            <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                              <Clock className="h-3 w-3" />
                              SLA: {new Date(inc.sla_deadline).toLocaleDateString()}
                            </span>
                          )}
                          {inc.resolved_at && (
                            <span className="flex items-center gap-0.5 text-green-600 font-medium">
                              <CheckCircle2 className="h-3 w-3" />
                              Resolved {new Date(inc.resolved_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Status Actions + Department Assignment */}
                        <div className="flex items-center flex-wrap gap-2 mt-2 pt-2 border-t border-border/60">
                          {transitions.length > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground">Update:</span>
                              {transitions.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => handleStatusChange(inc, s)}
                                  className={`text-xs font-medium px-2 py-0.5 rounded-md transition-colors ${
                                    s === 'resolved'
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : s === 'rejected'
                                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                      : 'bg-secondary hover:bg-secondary/80 text-foreground'
                                  }`}
                                >
                                  {STATUS_CONFIG[s]?.label || s}
                                </button>
                              ))}
                            </>
                          )}

                          {/* Department assignment */}
                          {departments.length > 0 && inc.status !== 'resolved' && inc.status !== 'rejected' && (
                            <Select
                              value={inc.assigned_department_id || inc.department_id || 'none'}
                              onValueChange={(val) => val !== 'none' && handleAssignDepartment(inc, val)}
                            >
                              <SelectTrigger className="h-7 w-[140px] text-xs gap-1">
                                <Building2 className="h-3 w-3" />
                                <SelectValue placeholder="Assign dept" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Unassigned</SelectItem>
                                {departments.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          <button
                            onClick={() => router.push(`/incidents/${inc.id}`)}
                            className="text-xs font-medium px-2 py-0.5 rounded-md text-blue-600 hover:underline ml-auto"
                          >
                            Details
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteIncident(inc)}
                              className="text-xs font-medium px-2 py-0.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Quick Stats + Recent Reports */}
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-red-600" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Incidents</span>
                <span className="font-bold text-navy">{incidents.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Reports</span>
                <span className="font-bold text-navy">{reports.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Review</span>
                <span className="font-bold text-amber-600">{stats.pending}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overdue</span>
                <span className="font-bold text-red-600">{stats.overdue}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Departments</span>
                <span className="font-bold text-navy">{departments.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-600" />
                Recent Reports ({reports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No reports submitted.</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {reports.slice(0, 15).map((report) => {
                    const statusConfig = STATUS_CONFIG[report.status];
                    const CatIcon = categoryIcons[report.category_name] || AlertCircle;
                    const color = CATEGORY_COLORS[report.category_name] || '#3b82f6';
                    return (
                      <div
                        key={report.id}
                        className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => router.push(`/track?id=${report.tracking_id}`)}
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0" style={{ backgroundColor: `${color}15` }}>
                          <CatIcon className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-navy text-xs truncate">{report.title}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{report.tracking_id}</div>
                        </div>
                        {statusConfig && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
                            style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
                          >
                            {statusConfig.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
