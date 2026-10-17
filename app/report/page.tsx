'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Droplets,
  Trash2,
  Construction,
  Waves,
  Lightbulb,
  Bus,
  AlertCircle,
  MapPin,
  Upload,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Brain,
  Zap,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase, Category } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { generateTrackingId, analyzeReport, type AIAnalysisResult } from '@/lib/ai-analysis';
import { CATEGORY_ICONS, CATEGORY_COLORS, PRIORITY_CONFIG } from '@/lib/constants';
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

export default function ReportPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data as Category[]);
    })();
  }, []);

  // No auth redirect — anonymous reports are allowed

  const runAIAnalysis = async () => {
    if (!title || !description || !selectedCategory) return;
    setAnalyzing(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          title,
          description,
          locationText,
          categoryName: selectedCategory,
        }),
      });
      if (!response.ok) throw new Error('AI analysis unavailable');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAiResult(data as AIAnalysisResult);
    } catch {
      const fallback = analyzeReport(title, description, locationText, selectedCategory);
      setAiResult(fallback);
      toast.info('AI analysis unavailable. Showing basic analysis instead.');
    }
    setAnalyzing(false);
  };

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
            toast.error('Could not determine street address. Please enter the location manually below.');
          }
        } catch {
          setLocationText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          toast.error('Address lookup failed. Please enter the location manually below.');
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please allow location access in your browser settings, or enter the location manually below.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast.error('Your location could not be determined. Please enter the location manually below.');
        } else if (err.code === err.TIMEOUT) {
          toast.error('Location request timed out. Please try again or enter the location manually.');
        } else {
          toast.error('Could not access your location. Please enter it manually below.');
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
      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(fileName, file);

      if (uploadError) {
        setPhotoUrl(null);
        toast.error('Could not upload photo. Report will continue without it.');
      } else {
        const { data: urlData } = supabase.storage.from('evidence').getPublicUrl(fileName);
        setPhotoUrl(urlData.publicUrl);
        toast.success('Photo attached.');
      }
    } catch {
      toast.error('Photo upload failed. You can still submit without a photo.');
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !title || !description) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);

    try {
      const trackingId = generateTrackingId();
      let analysis = aiResult;
      if (!analysis) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-analyze`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              title,
              description,
              locationText,
              categoryName: selectedCategory,
            }),
          });
          if (aiResponse.ok) {
            analysis = (await aiResponse.json()) as AIAnalysisResult;
            setAiResult(analysis);
          } else {
            throw new Error('AI unavailable');
          }
        } catch {
          analysis = analyzeReport(title, description, locationText, selectedCategory);
          setAiResult(analysis);
        }
      }

      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .insert({
          tracking_id: trackingId,
          user_id: user?.id || null,
          category_name: selectedCategory,
          title,
          description,
          location_text: locationText,
          latitude,
          longitude,
          photo_url: photoUrl,
          priority_score: analysis.priority_score,
          priority_label: analysis.priority_label,
          ai_processed: true,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Save AI analysis
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

      setSubmitted(trackingId);
      toast.success('Report submitted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report. Please try again.');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Card className="border-border/60">
          <CardContent className="pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-6">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-2xl font-bold text-navy">Report Submitted</h2>
            <p className="mt-3 text-muted-foreground">
              Your report has been received and analysed by our AI system.
            </p>

            <div className="mt-6 rounded-xl bg-secondary p-6">
              <div className="text-sm text-muted-foreground mb-1">Your Tracking ID</div>
              <div className="text-2xl font-bold text-navy font-mono tracking-wider">{submitted}</div>
              <p className="mt-3 text-sm text-muted-foreground">
                Save this ID to track your report's status anytime.
              </p>
            </div>

            {aiResult && (
              <div className="mt-6 rounded-xl border border-border p-5 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-4 w-4 text-accent" />
                  <span className="font-semibold text-navy">AI Analysis Result</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Suggested Category</span>
                    <span className="font-medium">{aiResult.suggested_category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-medium">{Math.round(aiResult.confidence * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Priority</span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        color: PRIORITY_CONFIG[aiResult.priority_label]?.color,
                        backgroundColor: PRIORITY_CONFIG[aiResult.priority_label]?.bg,
                      }}
                    >
                      {PRIORITY_CONFIG[aiResult.priority_label]?.label || aiResult.priority_label}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Button onClick={() => router.push(`/track?id=${submitted}`)} className="gap-2">
                Track This Report
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => {
                setSubmitted(null);
                setSelectedCategory('');
                setTitle('');
                setDescription('');
                setLocationText('');
                setAiResult(null);
                setPhotoUrl(null);
              }}>
                File Another Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy tracking-tight">Report a Public Problem</h1>
        <p className="mt-2 text-muted-foreground text-lg">
          Help your community by reporting infrastructure issues. Every report is AI-analysed for category, priority, and duplicates.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Selection */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg text-navy">1. Choose the problem type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                      selected
                        ? 'border-accent bg-accent/5 shadow-sm'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                    style={selected ? { borderColor: color } : {}}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <span className="text-sm font-medium text-center">{cat.name}</span>
                  </button>
                );
              })}
            </div>
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Loading categories...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg text-navy">2. Describe the problem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setAiResult(null); }}
                placeholder="e.g., Water pipe burst near Main Street"
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setAiResult(null); }}
                placeholder="Explain what happened, when it started, and how it affects the area..."
                required
                className="mt-1.5 min-h-[120px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg text-navy">3. Where is it?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="location">Location description</Label>
              <Input
                id="location"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g., Near the park on 5th Avenue, or street name and area"
                className="mt-1.5"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={locating} className="gap-2">
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                {locating ? 'Getting location...' : 'Use my GPS location'}
              </Button>
              {latitude && longitude && (
                <span className="text-sm text-muted-foreground self-center">
                  Pinned: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Photo Upload */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg text-navy">4. Add a photo (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-muted-foreground/40 cursor-pointer p-6 transition-colors flex-1">
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : photoUrl ? (
                  <img src={photoUrl} alt="Evidence" className="max-h-32 rounded-lg object-cover" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload (max 5MB)</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* AI Analysis Preview */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg text-navy flex items-center gap-2">
              <Brain className="h-5 w-5 text-accent" />
              5. AI Analysis Preview
            </CardTitle>
            <CardDescription>
              Powered by Civic Pulse AI for intelligent classification and prioritisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!aiResult && !analyzing && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Run an AI analysis to see how your report will be classified and prioritised.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={runAIAnalysis}
                  disabled={!title || !description || !selectedCategory}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Run AI Analysis
                </Button>
              </div>
            )}
            {analyzing && (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-sm text-muted-foreground">AI is analysing your report...</span>
              </div>
            )}
            {aiResult && !analyzing && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
                  {aiResult.ai_powered ? (
                    <>
                      <Sparkles className="h-4 w-4 text-accent" />
                      <span className="text-xs font-semibold text-accent">Powered by Civic Pulse AI</span>
                      <span className="text-xs text-muted-foreground">— intelligent analysis</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">Basic analysis</span>
                      <span className="text-xs text-muted-foreground">— upgrade for full AI</span>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-secondary p-3">
                    <div className="text-xs text-muted-foreground">Suggested Category</div>
                    <div className="font-semibold text-navy mt-0.5">{aiResult.suggested_category}</div>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <div className="text-xs text-muted-foreground">Confidence</div>
                    <div className="font-semibold text-navy mt-0.5">{Math.round(aiResult.confidence * 100)}%</div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-navy">Priority Score</span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        color: PRIORITY_CONFIG[aiResult.priority_label]?.color,
                        backgroundColor: PRIORITY_CONFIG[aiResult.priority_label]?.bg,
                      }}
                    >
                      {PRIORITY_CONFIG[aiResult.priority_label]?.label} ({aiResult.priority_score}/100)
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {Object.entries(aiResult.priority_factors).map(([key, val]) => (
                      <div key={key}>
                        <div className="text-xs text-muted-foreground capitalize">{key}</div>
                        <div className="font-semibold text-navy">{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-accent/5 p-3">
                  <div className="text-xs font-semibold text-accent mb-1">AI Explanation</div>
                  <p className="text-sm text-foreground leading-relaxed">{aiResult.explanation}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !selectedCategory || !title || !description} className="gap-2 bg-navy hover:bg-navy-light">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit Report
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
