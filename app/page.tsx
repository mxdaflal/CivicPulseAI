'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity,
  Droplets,
  Trash2,
  Construction,
  Waves,
  Lightbulb,
  Bus,
  ArrowRight,
  ShieldCheck,
  Brain,
  MapPin,
  TrendingUp,
  Eye,
  Zap,
  CheckCircle2,
  Users,
  Clock,
  Globe,
  User,
  Shield,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase-client';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/lib/constants';
import { LocationCard } from '@/components/LocationCard';
import { useAuth } from '@/components/auth-provider';

const categoryList = [
  { name: 'Water Supply', desc: 'Supply interruptions, contamination, low pressure' },
  { name: 'Garbage Overflow', desc: 'Overflowing bins, uncollected waste, illegal dumping' },
  { name: 'Damaged Road', desc: 'Potholes, cracks, subsidence, missing signage' },
  { name: 'Drainage Problem', desc: 'Blocked drains, flooding, waterlogging' },
  { name: 'Streetlight Failure', desc: 'Non-functional lights, flickering, damaged poles' },
  { name: 'Public Transport', desc: 'Unreliable service, broken shelters, safety' },
];

const lifecycleSteps = [
  { icon: Eye, title: 'Observe', desc: 'Citizens report problems via text, photo, or location.' },
  { icon: ShieldCheck, title: 'Verify', desc: 'AI classifies reports and flags potential duplicates for review.' },
  { icon: Brain, title: 'Predict', desc: 'The system identifies patterns and emerging risk hotspots.' },
  { icon: Zap, title: 'Prioritise', desc: 'Explainable priority scores rank incidents by urgency and impact.' },
  { icon: CheckCircle2, title: 'Resolve & Learn', desc: 'Staff resolve with evidence. The system learns from outcomes.' },
];

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Classification',
    desc: 'Every report is automatically categorised and analysed for duplicates using keyword matching and similarity scoring.',
  },
  {
    icon: TrendingUp,
    title: 'Explainable Priority Scoring',
    desc: 'A transparent formula (Urgency 40%, Impact 30%, Recurrence 20%, Vulnerability 10%) ensures fair, auditable prioritisation.',
  },
  {
    icon: MapPin,
    title: 'Location Intelligence',
    desc: 'Reports are geocoded and mapped. Hotspots and recurrence patterns surface emerging community risks.',
  },
  {
    icon: ShieldCheck,
    title: 'Human-Verified Resolution',
    desc: 'AI recommends, humans decide. Every status change is audit-logged with actor, action, and timestamp.',
  },
  {
    icon: Users,
    title: 'Citizen Transparency',
    desc: 'Track any report by ID. See real status updates, timelines, and resolution evidence — not black-box promises.',
  },
  {
    icon: Globe,
    title: 'Privacy-First Design',
    desc: 'Personal data stays separate from public incident summaries. No precise locations or evidence exposed by default.',
  },
];

export default function HomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ reports: 0, verified: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Single query to get all incident counts at once
        const { count: reportCount } = await supabase.from('reports').select('id', { count: 'exact', head: true });
        const { data: incidents } = await supabase.from('incidents').select('status').eq('status', 'resolved');
        const resolvedCount = incidents?.length || 0;
        const { data: activeIncidents } = await supabase.from('incidents').select('status').in('status', ['verified', 'open', 'assigned', 'in_progress']);

        const verified = activeIncidents?.filter(i => i.status === 'verified' || i.status === 'open').length || 0;
        const inProgress = activeIncidents?.filter(i => i.status === 'assigned' || i.status === 'in_progress').length || 0;

        setStats({
          reports: reportCount || 0,
          verified,
          inProgress,
          resolved: resolvedCount,
        });
      } catch {
        // Use defaults
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden hero-gradient text-white">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
                </span>
                Intelligent Early-Warning Network
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                Transform community observations into{' '}
                <span className="text-teal-400">actionable civic intelligence</span>
              </h1>
              <p className="mt-6 text-lg text-slate-200 leading-relaxed max-w-xl">
                CIVIC PULSE AI turns scattered citizen reports of water failures, overflowing waste,
                damaged roads and other public-service issues into verified, prioritised, and
                trackable resolutions — before minor disruptions become major crises.
              </p>

              {/* Dual Login Buttons — hidden when already logged in */}
              {!authLoading && !user && (
                <div className="mt-8 grid sm:grid-cols-2 gap-4 max-w-lg">
                  <Link href="/citizen/login">
                    <div className="group rounded-2xl bg-blue-600 hover:bg-blue-700 transition-all p-5 border border-blue-400/30 shadow-lg cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-lg">Citizen Login</div>
                          <div className="text-xs text-blue-100">Report & track issues</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/staff/login">
                    <div className="group rounded-2xl bg-red-600 hover:bg-red-700 transition-all p-5 border border-red-400/30 shadow-lg cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                          <Shield className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-lg">Staff Login</div>
                          <div className="text-xs text-red-100">Manage & resolve</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              )}

              {/* When logged in, show portal links */}
              {!authLoading && user && (
                <div className="mt-8 flex flex-wrap gap-4 max-w-lg">
                  {profile && ['verifier', 'operator', 'manager', 'admin', 'staff'].includes(profile.role) ? (
                    <Link href="/staff/dashboard">
                      <Button size="lg" className="bg-red-600 hover:bg-red-700 gap-2">
                        <Shield className="h-4 w-4" /> Go to Staff Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/citizen/dashboard">
                      <Button size="lg" className="bg-blue-600 hover:bg-blue-700 gap-2">
                        <User className="h-4 w-4" /> Go to My Dashboard
                      </Button>
                    </Link>
                  )}
                  <Link href="/report">
                    <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 gap-2">
                      <FileText className="h-4 w-4" /> File a Report
                    </Button>
                  </Link>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-300">
                <Link href="/report" className="text-teal-400 hover:underline">
                  Quick report without login
                </Link>
                <Link href="/track" className="text-teal-400 hover:underline">
                  Track a report
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-6 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-400" />
                  Privacy-conscious
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-teal-400" />
                  AI-assisted
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-400" />
                  Community-driven
                </div>
              </div>
            </div>

            {/* Right side: Location card + Stats */}
            <div className="animate-fade-in lg:justify-self-end w-full max-w-md space-y-4">
              <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                <LocationCard />
              </div>

              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-teal-400" />
                  Live Platform Status
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                    <div className="text-3xl font-bold text-white">
                      {loading ? '—' : stats.reports}
                    </div>
                    <div className="text-sm text-slate-300 mt-1">Reports</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                    <div className="text-3xl font-bold text-cyan-400">
                      {loading ? '—' : stats.verified}
                    </div>
                    <div className="text-sm text-slate-300 mt-1">Verified</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                    <div className="text-3xl font-bold text-amber-400">
                      {loading ? '—' : stats.inProgress}
                    </div>
                    <div className="text-sm text-slate-300 mt-1">In Process</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                    <div className="text-3xl font-bold text-teal-400">
                      {loading ? '—' : stats.resolved}
                    </div>
                    <div className="text-sm text-slate-300 mt-1">Resolved</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-navy tracking-tight">What you can report</h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Six categories covering the most common everyday public-service failures.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categoryList.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.name.replace(/\s/g, '')] || CATEGORY_ICONS['AlertCircle'];
              const color = CATEGORY_COLORS[cat.name];
              return (
                <Card key={cat.name} className="card-hover border-border/60 overflow-hidden">
                  <CardHeader>
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl mb-2"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="h-6 w-6" style={{ color }} />
                    </div>
                    <CardTitle className="text-lg text-navy">{cat.name}</CardTitle>
                    <CardDescription>{cat.desc}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Lifecycle Section */}
      <section className="py-20 bg-secondary/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-navy tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Every report moves through a five-stage lifecycle — from observation to resolution.
            </p>
          </div>
          <div className="grid md:grid-cols-5 gap-4">
            {lifecycleSteps.map((step, i) => (
              <div key={step.title} className="relative">
                <Card className="card-hover h-full border-border/60">
                  <CardContent className="pt-6 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-white mb-4">
                      <step.icon className="h-7 w-7" />
                    </div>
                    <div className="text-xs font-semibold text-accent mb-1">STEP {i + 1}</div>
                    <h3 className="font-semibold text-navy">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </CardContent>
                </Card>
                {i < lifecycleSteps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 z-10 text-muted-foreground/40">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-navy tracking-tight">Built for real civic impact</h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Not just a complaint box. A complete intelligence platform connecting citizens and service providers.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <Card key={feature.title} className="card-hover border-border/60">
                <CardContent className="pt-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 mb-4">
                    <feature.icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="font-semibold text-navy text-lg">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-navy text-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready to improve your community?</h2>
          <p className="mt-4 text-slate-300 text-lg max-w-xl mx-auto">
            Report a problem in minutes. Track it to resolution. Help your city respond faster and smarter.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {!authLoading && user ? (
              profile && ['verifier', 'operator', 'manager', 'admin', 'staff'].includes(profile.role) ? (
                <Link href="/staff/dashboard">
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 gap-2">
                    <Shield className="h-4 w-4" /> Staff Dashboard
                  </Button>
                </Link>
              ) : (
                <Link href="/citizen/dashboard">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 gap-2">
                    <User className="h-4 w-4" /> My Dashboard
                  </Button>
                </Link>
              )
            ) : (
              <>
                <Link href="/citizen/login">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 gap-2">
                    <User className="h-4 w-4" />
                    Citizen Portal
                  </Button>
                </Link>
                <Link href="/staff/login">
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 gap-2">
                    <Shield className="h-4 w-4" />
                    Staff Portal
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-slate-300 py-12 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                  <Activity className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white">
                  CIVIC PULSE<span className="text-accent"> AI</span>
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                An intelligent early-warning and resolution network for everyday public-service failures.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/citizen/login" className="hover:text-accent transition-colors">Citizen Portal</Link></li>
                <li><Link href="/staff/login" className="hover:text-accent transition-colors">Staff Portal</Link></li>
                <li><Link href="/report" className="hover:text-accent transition-colors">Quick Report</Link></li>
                <li><Link href="/track" className="hover:text-accent transition-colors">Track a Report</Link></li>
                <li><Link href="/analytics" className="hover:text-accent transition-colors">Civic Analytics</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">About</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Privacy-First Design</li>
                <li className="flex items-center gap-2"><Brain className="h-4 w-4" /> AI-Assisted Workflow</li>
                <li className="flex items-center gap-2"><Clock className="h-4 w-4" /> Real-Time Tracking</li>
                <li className="flex items-center gap-2"><Users className="h-4 w-4" /> Community-Driven</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10 text-center text-sm text-slate-400">
            CIVIC PULSE AI — Transforming community observations into civic intelligence.
          </div>
        </div>
      </footer>
    </div>
  );
}
