'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  User,
  Bell,
  Settings,
  FileText,
  Mail,
  Phone,
  Globe,
  Save,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase, Report, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { STATUS_CONFIG, PRIORITY_CONFIG, CATEGORY_COLORS } from '@/lib/constants';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emailPref, setEmailPref] = useState(true);
  const [pushPref, setPushPref] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/profile');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone || '');
      setEmailPref(profile.notification_prefs?.email ?? true);
      setPushPref(profile.notification_prefs?.push ?? true);
    }
  }, [profile]);

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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          notification_prefs: { email: emailPref, push: pushPref },
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.');
    }
    setSaving(false);
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

  if (!user || !profile) {
    return null;
  }

  const roleLabel = profile.role.charAt(0).toUpperCase() + profile.role.slice(1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy tracking-tight flex items-center gap-2">
          <User className="h-6 w-6" />
          My Profile
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Manage your account, notification preferences, and view your report history.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-1">
          <Card className="border-border/60">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-navy text-white text-2xl font-bold mb-4">
                {fullName.charAt(0).toUpperCase() || 'U'}
              </div>
              <h2 className="font-semibold text-navy text-lg">{fullName || 'User'}</h2>
              <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
              <div className="mt-3">
                <Badge variant="secondary">{roleLabel}</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="mt-4 gap-2 w-full"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Settings + Reports */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Profile */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy flex items-center gap-2">
                <Settings className="h-4 w-4 text-accent" />
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 890"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="emailPref" className="cursor-pointer">Email notifications</Label>
                  </div>
                  <Switch
                    id="emailPref"
                    checked={emailPref}
                    onCheckedChange={setEmailPref}
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="pushPref" className="cursor-pointer">Push notifications</Label>
                  </div>
                  <Switch
                    id="pushPref"
                    checked={pushPref}
                    onCheckedChange={setPushPref}
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full gap-2 bg-navy hover:bg-navy-light">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* My Reports */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                My Reports ({reports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : reports.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">You haven't filed any reports yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => router.push('/report')}
                  >
                    File a Report
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => {
                    const statusConfig = STATUS_CONFIG[report.status];
                    const priorityConfig = PRIORITY_CONFIG[report.priority_label];
                    const color = CATEGORY_COLORS[report.category_name] || '#3b82f6';
                    return (
                      <div
                        key={report.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => router.push(`/track?id=${report.tracking_id}`)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-navy text-sm truncate">{report.title}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-mono">{report.tracking_id}</span>
                            <span>·</span>
                            <span>{new Date(report.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {priorityConfig && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold"
                              style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
                            >
                              {priorityConfig.label}
                            </span>
                          )}
                          {statusConfig && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold"
                              style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
                            >
                              {statusConfig.label}
                            </span>
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
      </div>
    </div>
  );
}
