'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  FileText,
  Brain,
  Clock,
  MapPin,
  Tag,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase, Report, AIAnalysis, Incident, IncidentEvent } from '@/lib/supabase-client';
import { STATUS_CONFIG, PRIORITY_CONFIG, CATEGORY_ICONS, CATEGORY_COLORS } from '@/lib/constants';

export default function TrackPage() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id') || '';

  const [trackingId, setTrackingId] = useState(initialId);
  const [searching, setSearching] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [linkedIncident, setLinkedIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [searched, setSearched] = useState(false);

  const search = async (id?: string) => {
    const query = (id || trackingId).trim();
    if (!query) {
      toast.error('Please enter a tracking ID.');
      return;
    }
    setSearching(true);
    setSearched(false);

    try {
      const { data: reportData, error } = await supabase
        .from('reports')
        .select('*')
        .eq('tracking_id', query.toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!reportData) {
        setReport(null);
        setAiAnalysis(null);
        setLinkedIncident(null);
        setEvents([]);
        setSearched(true);
        setSearching(false);
        toast.error('No report found with that tracking ID.');
        return;
      }

      setReport(reportData as Report);

      // Fetch AI analysis
      const { data: analysisData } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('report_id', reportData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setAiAnalysis(analysisData as AIAnalysis | null);

      // Fetch linked incident
      const { data: linkData } = await supabase
        .from('report_incident_links')
        .select('incident_id')
        .eq('report_id', reportData.id)
        .limit(1)
        .maybeSingle();

      if (linkData) {
        const { data: incidentData } = await supabase
          .from('incidents')
          .select('*')
          .eq('id', linkData.incident_id)
          .maybeSingle();
        setLinkedIncident(incidentData as Incident | null);

        if (incidentData) {
          const { data: eventData } = await supabase
            .from('incident_events')
            .select('*')
            .eq('incident_id', incidentData.id)
            .order('created_at', { ascending: true });
          setEvents((eventData as IncidentEvent[]) || []);
        }
      } else {
        setLinkedIncident(null);
        setEvents([]);
      }

      setSearched(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to search for report.');
      setReport(null);
      setSearched(true);
    }
    setSearching(false);
  };

  useEffect(() => {
    if (initialId) {
      search(initialId);
    }
  }, []);

  const statusConfig = report ? STATUS_CONFIG[report.status] : null;
  const priorityConfig = report ? PRIORITY_CONFIG[report.priority_label] : null;
  const CategoryIcon = report ? CATEGORY_ICONS[report.category_name.replace(/\s/g, '')] || AlertCircle : null;
  const categoryColor = report ? CATEGORY_COLORS[report.category_name] || '#3b82f6' : '#3b82f6';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy tracking-tight">Track a Report</h1>
        <p className="mt-2 text-muted-foreground text-lg">
          Enter your tracking ID to see the status, AI analysis, and resolution timeline.
        </p>
      </div>

      {/* Search Bar */}
      <Card className="border-border/60 mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="trackingId" className="sr-only">Tracking ID</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="trackingId"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  placeholder="e.g., CP-AB123X"
                  className="pl-10 font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
                />
              </div>
            </div>
            <Button onClick={() => search()} disabled={searching} className="gap-2 bg-navy hover:bg-navy-light">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Track
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && !report && !searching && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <XCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-navy">No report found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn't find a report with that tracking ID. Please check and try again.
            </p>
          </CardContent>
        </Card>
      )}

      {report && (
        <div className="space-y-6 animate-fade-in">
          {/* Report Summary */}
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                    style={{ backgroundColor: `${categoryColor}15` }}
                  >
                    {CategoryIcon && <CategoryIcon className="h-5 w-5" style={{ color: categoryColor }} />}
                  </div>
                  <div>
                    <CardTitle className="text-lg text-navy">{report.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-muted-foreground">{report.tracking_id}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                {statusConfig && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold shrink-0"
                    style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
                  >
                    {statusConfig.label}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{report.category_name}</span>
                </div>
                {priorityConfig && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Priority:</span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
                    >
                      {priorityConfig.label}
                    </span>
                  </div>
                )}
                {report.location_text && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">{report.location_text}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Description</div>
                <p className="text-sm text-foreground leading-relaxed">{report.description}</p>
              </div>

              {report.photo_url && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Photo Evidence</div>
                  <img
                    src={report.photo_url}
                    alt="Report evidence"
                    className="rounded-lg max-h-64 object-cover border border-border"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis */}
          {aiAnalysis && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg text-navy flex items-center gap-2">
                  <Brain className="h-5 w-5 text-accent" />
                  AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-secondary p-3">
                    <div className="text-xs text-muted-foreground">Suggested Category</div>
                    <div className="font-semibold text-navy mt-0.5">{aiAnalysis.suggested_category || report.category_name}</div>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <div className="text-xs text-muted-foreground">Confidence</div>
                    <div className="font-semibold text-navy mt-0.5">
                      {aiAnalysis.confidence ? `${Math.round(aiAnalysis.confidence * 100)}%` : 'N/A'}
                    </div>
                  </div>
                </div>
                {aiAnalysis.explanation && (
                  <div className="rounded-lg bg-accent/5 p-3">
                    <div className="text-xs font-semibold text-accent mb-1">Explanation</div>
                    <p className="text-sm text-foreground leading-relaxed">{aiAnalysis.explanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Linked Incident & Timeline */}
          {linkedIncident ? (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg text-navy">Resolution Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-lg bg-secondary p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Linked Incident</div>
                      <div className="font-semibold text-navy">{linkedIncident.title}</div>
                    </div>
                    {STATUS_CONFIG[linkedIncident.status] && (
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          color: STATUS_CONFIG[linkedIncident.status].color,
                          backgroundColor: STATUS_CONFIG[linkedIncident.status].bg,
                        }}
                      >
                        {STATUS_CONFIG[linkedIncident.status].label}
                      </span>
                    )}
                  </div>
                </div>

                {events.length > 0 && (
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
          ) : (
            <Card className="border-border/60">
              <CardContent className="py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-navy">Awaiting Verification</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  Your report has been submitted and AI-analysed. It is awaiting review by civic staff
                  who will verify it and link it to an incident for resolution.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center">
            <Link href="/report">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                File a new report
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!searched && !searching && !report && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary mb-4">
              <Search className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-navy">Enter a tracking ID</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your tracking ID was given to you when you submitted a report. It looks like CP-AB123X.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
