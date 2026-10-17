'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2, MapPin, Plus, FileText, LogOut, Activity, Eye, Navigation,
  Droplets, Trash2, Construction, Waves, Lightbulb, Bus, AlertCircle,
  CheckCircle2, ArrowRight, Upload, Brain, Zap, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase, Category, Report } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { STATUS_CONFIG, PRIORITY_CONFIG, CATEGORY_COLORS } from '@/lib/constants';
import { complaintSchema, type ComplaintValues } from '@/lib/validations';
import { generateTrackingId, type AIAnalysisResult } from '@/lib/ai-analysis';
import { reverseGeocode, formatAddress } from '@/lib/geocode';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, any> = {
  'Water Supply': Droplets,
  'Garbage Overflow': Trash2,
  'Damaged Road': Construction,
  'Drainage Problem': Waves,
  'Streetlight Failure': Lightbulb,
  'Public Transport': Bus,
};

async function callAIAnalysis(title: string, description: string, locationText: string, categoryName: string): Promise<AIAnalysisResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(`${supabaseUrl}/functions/v1/ai-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` },
    body: JSON.stringify({ title, description, locationText, categoryName }),
  });
  if (!res.ok) throw new Error('AI analysis failed');
  return res.json();
}

export default function CitizenDashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submittedTrackingId, setSubmittedTrackingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ComplaintValues>({
    resolver: zodResolver(complaintSchema),
  });

  const watchTitle = watch('title');
  const watchDescription = watch('description');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/citizen/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data as Category[]);
    })();
  }, []);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoadingReports(true);
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setReports((data as Report[]) || []);
    setLoadingReports(false);
  }, [user]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);
        toast.success('Location captured. Looking up address...');
        try {
          const parts = await reverseGeocode(lat, lng);
          const addressText = formatAddress(parts);
          if (addressText && !addressText.match(/^\d+\.\d+,/)) {
            setLocationText(addressText);
            toast.success('Address found: ' + addressText);
          } else {
            setLocationText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            toast.error('Could not determine street address. Please enter the location manually.');
          }
        } catch {
          setLocationText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          toast.error('Address lookup failed. Please enter the location manually.');
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please allow access or enter manually.');
        } else {
          toast.error('Could not get your location. Please enter it manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5MB.');
      return;
    }
    setUploading(true);
    try {
      const fileName = `reports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '-')}`;
      const { error: uploadError } = await supabase.storage.from('evidence').upload(fileName, file);
      if (uploadError) {
        toast.error('Could not upload photo. Report will continue without it.');
      } else {
        const { data: urlData } = supabase.storage.from('evidence').getPublicUrl(fileName);
        setPhotoUrl(urlData.publicUrl);
        toast.success('Photo attached.');
      }
    } catch {
      toast.error('Photo upload failed.');
    }
    setUploading(false);
  };

  const runAIAnalysis = async () => {
    if (!watchTitle || !watchDescription || !selectedCategory) return;
    setAnalyzing(true);
    try {
      const result = await callAIAnalysis(watchTitle, watchDescription, locationText, selectedCategory);
      setAiResult(result);
    } catch {
      toast.error('AI analysis unavailable. You can still submit your complaint.');
    }
    setAnalyzing(false);
  };

  const onSubmit = async (values: ComplaintValues) => {
    if (!user || !selectedCategory) {
      toast.error('Please select a category.');
      return;
    }
    setSubmitting(true);
    try {
      const trackingId = generateTrackingId();
      let analysis = aiResult;
      if (!analysis) {
        try {
          analysis = await callAIAnalysis(values.title, values.description, locationText, selectedCategory);
          setAiResult(analysis);
        } catch {
          // Fallback: submit without AI analysis
        }
      }

      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .insert({
          tracking_id: trackingId,
          category_name: selectedCategory,
          title: values.title,
          description: values.description,
          location_text: locationText,
          latitude,
          longitude,
          photo_url: photoUrl,
          priority_score: analysis?.priority_score || 50,
          priority_label: analysis?.priority_label || 'medium',
          ai_processed: !!analysis,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      if (analysis) {
        await supabase.from('ai_analyses').insert({
          report_id: reportData.id,
          analysis_type: 'full',
          suggested_category: analysis.suggested_category,
          confidence: analysis.confidence,
          priority_factors: analysis.priority_factors,
          priority_score: analysis.priority_score,
          priority_label: analysis.priority_label,
          explanation: analysis.explanation,
          model_version: analysis.model_version || 'civic-pulse-v1',
        });
      }

      setSubmittedTrackingId(trackingId);
      toast.success('Complaint submitted successfully!');
      fetchReports();
      reset();
      setSelectedCategory('');
      setLocationText('');
      setPhotoUrl(null);
      setAiResult(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit complaint.');
    }
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  if (submittedTrackingId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Card className="border-border/60">
          <CardContent className="pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-navy">Complaint Submitted</h2>
            <p className="mt-3 text-muted-foreground">
              Your complaint has been received and analyzed by Civic Pulse AI.
            </p>
            <div className="mt-6 rounded-xl bg-secondary p-6">
              <div className="text-sm text-muted-foreground mb-1">Your Tracking ID</div>
              <div className="text-2xl font-bold text-navy font-mono tracking-wider">{submittedTrackingId}</div>
              <p className="mt-3 text-sm text-muted-foreground">Save this ID to track your complaint's status.</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Button onClick={() => router.push(`/track?id=${submittedTrackingId}`)} className="gap-2">
                Track This Complaint <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSubmittedTrackingId(null);
                }}
              >
                Submit Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            Citizen Dashboard
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Welcome, {profile?.full_name || 'Citizen'}. Report issues and track your submissions.
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut} className="gap-2 shrink-0">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column: Submit form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submit Complaint Form */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Submit a New Complaint
              </CardTitle>
              <CardDescription>Report a public-service issue in your area.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Category */}
                <div>
                  <Label>Category *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                    {categories.map((cat) => {
                      const Icon = categoryIcons[cat.name] || AlertCircle;
                      const color = cat.color || CATEGORY_COLORS[cat.name] || '#3b82f6';
                      const selected = selectedCategory === cat.name;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.name);
                            setAiResult(null);
                          }}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all',
                            selected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-border hover:border-muted-foreground/30'
                          )}
                          style={selected ? { borderColor: color } : {}}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
                            <Icon className="h-4 w-4" style={{ color }} />
                          </div>
                          <span className="text-xs font-medium text-center">{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Water pipe burst near Main Street"
                    className={`mt-1.5 ${errors.title ? 'border-destructive' : ''}`}
                    disabled={submitting}
                    {...register('title')}
                  />
                  {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Explain what happened, when it started, and how it affects the area..."
                    className={`mt-1.5 min-h-[100px] ${errors.description ? 'border-destructive' : ''}`}
                    disabled={submitting}
                    {...register('description')}
                  />
                  {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>}
                </div>

                {/* Location */}
                <div>
                  <Label htmlFor="locationText">Location</Label>
                  <Input
                    id="locationText"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    placeholder="e.g., Near the park on 5th Avenue"
                    className="mt-1.5"
                    disabled={submitting}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={locating || submitting} className="mt-2 gap-2">
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                    {locating ? 'Detecting...' : 'Use GPS'}
                  </Button>
                </div>

                {/* Photo */}
                <div>
                  <Label>Photo (optional)</Label>
                  <label className="mt-1.5 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-muted-foreground/40 cursor-pointer p-4 transition-colors">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : photoUrl ? (
                      <img src={photoUrl} alt="Evidence" className="max-h-24 rounded-lg object-cover" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Click to upload (max 5MB)</span>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={submitting} />
                  </label>
                </div>

                {/* AI Analysis Preview */}
                {watchTitle && watchDescription && selectedCategory && !aiResult && !analyzing && (
                  <Button type="button" variant="outline" size="sm" onClick={runAIAnalysis} className="w-full gap-2">
                    <Zap className="h-4 w-4" /> Run AI Analysis Preview
                  </Button>
                )}
                {analyzing && (
                  <div className="flex items-center justify-center py-3 gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm text-muted-foreground">AI is analyzing your complaint...</span>
                  </div>
                )}
                {aiResult && (
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {aiResult.ai_powered ? (
                        <><Sparkles className="h-3.5 w-3.5 text-blue-600" /><span className="text-xs font-semibold text-blue-600">Powered by Civic Pulse AI</span></>
                      ) : (
                        <><Brain className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs font-semibold text-muted-foreground">Basic analysis</span></>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">Priority:</span>
                      <span
                        className="rounded-full px-2 py-0.5 font-semibold"
                        style={{
                          color: PRIORITY_CONFIG[aiResult.priority_label]?.color,
                          backgroundColor: PRIORITY_CONFIG[aiResult.priority_label]?.bg,
                        }}
                      >
                        {PRIORITY_CONFIG[aiResult.priority_label]?.label} ({aiResult.priority_score})
                      </span>
                      <span className="text-muted-foreground">Confidence: {Math.round(aiResult.confidence * 100)}%</span>
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={submitting || !selectedCategory} className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                  ) : (
                    <>Submit Complaint <ArrowRight className="h-4 w-4" /></>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right column: My Reports */}
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                My Complaints ({reports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : reports.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No complaints yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Submit your first complaint using the form.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin">
                  {reports.map((report) => {
                    const statusConfig = STATUS_CONFIG[report.status];
                    const priorityConfig = PRIORITY_CONFIG[report.priority_label];
                    const color = CATEGORY_COLORS[report.category_name] || '#3b82f6';
                    const CatIcon = categoryIcons[report.category_name] || AlertCircle;
                    return (
                      <div
                        key={report.id}
                        className="rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => router.push(`/track?id=${report.tracking_id}`)}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0" style={{ backgroundColor: `${color}15` }}>
                            <CatIcon className="h-3.5 w-3.5" style={{ color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-navy text-sm truncate">{report.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 font-mono">{report.tracking_id}</div>
                            <div className="flex items-center gap-1.5 mt-2">
                              {priorityConfig && (
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
                                >
                                  {priorityConfig.label}
                                </span>
                              )}
                              {statusConfig && (
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
                                >
                                  {statusConfig.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
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
