'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  Clock,
  MapPin,
  Tag,
  CheckCircle2,
  XCircle,
  Brain,
  Link2,
  FileText,
  AlertCircle,
  User,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase, Incident, IncidentEvent, Report, Department, AIAnalysis } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  STATUS_TRANSITIONS,
} from '@/lib/constants';

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [linkedReports, setLinkedReports] = useState<Report[]>([]);
  const [aiAnalyses, setAiAnalyses] = useState<AIAnalysis[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [assignDept, setAssignDept] = useState<string>('');

  const isStaff = profile && profile.role !== 'citizen';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: incData, error: incError } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (incError) throw incError;
      if (!incData) {
        toast.error('Incident not found.');
        router.push('/dashboard');
        return;
      }
      setIncident(incData as Incident);

      const [eventsRes, linksRes, deptsRes] = await Promise.all([
        supabase.from('incident_events').select('*').eq('incident_id', id).order('created_at', { ascending: true }),
        supabase.from('report_incident_links').select('report_id').eq('incident_id', id),
        supabase.from('departments').select('*'),
      ]);

      setEvents((eventsRes.data as IncidentEvent[]) || []);
      setDepartments((deptsRes.data as Department[]) || []);

      const linkIds = (linksRes.data || []).map((l: any) => l.report_id);
      if (linkIds.length > 0) {
        const { data: reportsData } = await supabase
          .from('reports')
          .select('*')
          .in('id', linkIds);
        setLinkedReports((reportsData as Report[]) || []);

        const { data: analysesData } = await supabase
          .from('ai_analyses')
          .select('*')
          .in('report_id', linkIds)
          .order('created_at', { ascending: false });
        setAiAnalyses((analysesData as AIAnalysis[]) || []);
      }
    } catch {
      toast.error('Failed to load incident.');
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    if (user && isStaff) fetchData();
  }, [user, isStaff, fetchData]);

  const handleStatusChange = async () => {
    if (!incident || !newStatus || !user) return;

    const allowed = STATUS_TRANSITIONS[incident.status] || [];
    if (!allowed.includes(newStatus)) {
      toast.error(`Cannot change from ${incident.status} to ${newStatus}.`);
      return;
    }

    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('incidents')
        .update(updateData)
        .eq('id', incident.id);

      if (updateError) throw updateError;

      await supabase.from('incident_events').insert({
        incident_id: incident.id,
        actor_id: user.id,
        actor_name: profile?.full_name || 'Staff',
        action: 'status_changed',
        old_status: incident.status,
        new_status: newStatus,
        notes: notes || undefined,
      });

      toast.success(`Status changed to ${newStatus}.`);
      setNewStatus('');
      setNotes('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  const handleAssignDepartment = async () => {
    if (!incident || !assignDept || !user) return;

    try {
      const dept = departments.find((d) => d.id === assignDept);
      const { error } = await supabase
        .from('incidents')
        .update({
          assigned_department_id: assignDept,
          status: incident.status === 'verified' ? 'assigned' : incident.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', incident.id);

      if (error) throw error;

      await supabase.from('incident_events').insert({
        incident_id: incident.id,
        actor_id: user.id,
        actor_name: profile?.full_name || 'Staff',
        action: 'department_assigned',
        new_status: incident.status === 'verified' ? 'assigned' : incident.status,
        notes: `Assigned to ${dept?.name || 'department'}`,
      });

      toast.success(`Assigned to ${dept?.name}.`);
      setAssignDept('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign department.');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-muted-foreground">Incident not found.</p>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[incident.status];
  const priorityConfig = PRIORITY_CONFIG[incident.priority_label];
  const CatIcon = CATEGORY_ICONS[incident.category_name.replace(/\s/g, '')] || AlertCircle;
  const categoryColor = CATEGORY_COLORS[incident.category_name] || '#3b82f6';
  const allowedTransitions = STATUS_TRANSITIONS[incident.status] || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${categoryColor}15` }}>
            <CatIcon className="h-6 w-6" style={{ color: categoryColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy tracking-tight">{incident.title}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{incident.category_name}</span>
              {incident.location_text && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{incident.location_text}</span>
              )}
              <span>{new Date(incident.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {statusConfig && (
            <span
              className="rounded-full px-3 py-1 text-sm font-semibold"
              style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
            >
              {statusConfig.label}
            </span>
          )}
          {priorityConfig && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
            >
              {priorityConfig.label} priority
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Details + Reports + AI */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {incident.description && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base text-navy">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground leading-relaxed">{incident.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Linked Reports */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base text-navy flex items-center gap-2">
                <Link2 className="h-4 w-4 text-accent" />
                Linked Reports ({linkedReports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {linkedReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked reports.</p>
              ) : (
                <div className="space-y-3">
                  {linkedReports.map((report) => (
                    <div key={report.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-navy text-sm">{report.title}</span>
                        <span className="text-xs font-mono text-muted-foreground">{report.tracking_id}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{report.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{report.category_name}</span>
                        <span>·</span>
                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                        {report.photo_url && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1"><FileText className="h-3 w-3" />Photo</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis */}
          {aiAnalyses.length > 0 && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base text-navy flex items-center gap-2">
                  <Brain className="h-4 w-4 text-accent" />
                  AI Analysis ({aiAnalyses.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiAnalyses.map((analysis) => (
                  <div key={analysis.id} className="rounded-lg bg-accent/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-accent">AI Analysis · {analysis.analysis_type}</span>
                      <span className="text-xs text-muted-foreground">{analysis.model_version}</span>
                    </div>
                    {analysis.explanation && (
                      <p className="text-sm text-foreground leading-relaxed">{analysis.explanation}</p>
                    )}
                    {analysis.confidence != null && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Confidence: {Math.round(analysis.confidence * 100)}%
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base text-navy flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                Incident Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event, i) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                          event.new_status === 'resolved' ? 'bg-success/10' :
                          event.new_status === 'rejected' ? 'bg-destructive/10' :
                          'bg-accent/10'
                        }`}>
                          {event.new_status === 'resolved' ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : event.new_status === 'rejected' ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Clock className="h-4 w-4 text-accent" />
                          )}
                        </div>
                        {i < events.length - 1 && <div className="w-px h-6 bg-border mt-1" />}
                      </div>
                      <div className="pb-3">
                        <div className="text-sm font-medium text-navy capitalize">
                          {event.action.replace(/_/g, ' ')}
                        </div>
                        {event.notes && (
                          <div className="text-sm text-muted-foreground mt-0.5">{event.notes}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {event.actor_name || 'System'} · {new Date(event.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Actions */}
        <div className="space-y-6">
          {/* Status Change */}
          {isStaff && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base text-navy">Update Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {allowedTransitions.length > 0 ? (
                  <>
                    <div>
                      <Label className="text-xs">New Status</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedTransitions.map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Notes (optional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add context for this change..."
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                    <Button
                      onClick={handleStatusChange}
                      disabled={!newStatus}
                      className="w-full bg-navy hover:bg-navy-light"
                    >
                      Update Status
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No status transitions available from current state ({statusConfig?.label}).
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assign Department */}
          {isStaff && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base text-navy flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Assign Department
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {incident.assigned_department_id && (
                  <div className="text-sm text-muted-foreground">
                    Currently: {departments.find((d) => d.id === incident.assigned_department_id)?.name || 'Unassigned'}
                  </div>
                )}
                <Select value={assignDept} onValueChange={setAssignDept}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssignDepartment}
                  disabled={!assignDept}
                  variant="outline"
                  className="w-full"
                >
                  Assign
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Meta Info */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base text-navy">Incident Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Reports</span>
                <span className="font-medium">{incident.report_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Created</span>
                <span className="font-medium">{new Date(incident.created_at).toLocaleDateString()}</span>
              </div>
              {incident.sla_deadline && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />SLA Deadline</span>
                  <span className={`font-medium ${new Date(incident.sla_deadline) < new Date() && incident.status !== 'resolved' ? 'text-destructive' : ''}`}>
                    {new Date(incident.sla_deadline).toLocaleDateString()}
                  </span>
                </div>
              )}
              {incident.resolved_at && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Resolved</span>
                  <span className="font-medium">{new Date(incident.resolved_at).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
