'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, KeyRound, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.push(searchParams.get('redirect') || '/');
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/profile')}`,
      });
      if (error) throw error;
      setSent(true);
      toast.success('Password reset link sent. Check your email inbox.');
    } catch (err: any) {
      toast.error('If that email is registered, a reset link has been sent.');
      setSent(true);
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <div className="text-center mb-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-white mb-4 shadow-lg shadow-navy/20">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-navy">Reset Your Password</h1>
        <p className="mt-2 text-muted-foreground">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-accent" />
            Password Reset
          </CardTitle>
          <CardDescription>We'll send a secure reset link to your email.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-navy">Check Your Email</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>,
                  you'll receive a password reset link shortly. The link expires in 1 hour.
                </p>
              </div>
              <Button variant="outline" onClick={() => router.back()} className="gap-2">
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2 bg-navy hover:bg-navy-light">
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  <>Send Reset Link <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link href="/citizen/login" className="font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}