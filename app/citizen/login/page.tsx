"use client";

import { useState, useEffect } from "react";
import { safeRedirect } from "@/lib/security";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2,
  LogIn,
  Activity,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  UserPlus,
  Phone,
  MessageCircle,
  KeyRound,
} from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/components/auth-provider";
import {
  citizenLoginSchema,
  citizenSignupSchema,
  type CitizenLoginValues,
  type CitizenSignupValues,
} from "@/lib/validations";
import {
  useLoginAttemptGuard,
  LockoutBanner,
  AttemptCounter,
} from "@/components/LoginAttemptGuard";

type LoginMode = "email" | "phone";

export default function CitizenLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const redirect = safeRedirect(
    searchParams.get("redirect"),
    "/citizen/dashboard",
  );
  const guard = useLoginAttemptGuard();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginMode, setLoginMode] = useState<LoginMode>("email");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CitizenLoginValues>({
    resolver: zodResolver(citizenLoginSchema),
  });

  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    formState: { errors: signupErrors },
    reset: resetSignup,
  } = useForm<CitizenSignupValues>({
    resolver: zodResolver(citizenSignupSchema),
  });

  useEffect(() => {
    if (!authLoading && user) {
      router.push(redirect);
    }
  }, [authLoading, user, router, redirect]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/confirm?redirect=${encodeURIComponent(redirect)}`,
        },
      });
      if (error) throw error;
    } catch {
      toast.error("Google sign in failed. Please try again.");
      setLoading(false);
    }
  };

  const onLogin = async (values: CitizenLoginValues) => {
    if (!guard.canSubmit) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        guard.recordFailedAttempt();
        throw error;
      }
      guard.resetAttempts();
      toast.success("Welcome back! Signed in successfully.");
      router.push(redirect);
    } catch (err: any) {
      toast.error("Invalid email or password. Please try again.");
    }
    setLoading(false);
  };

  const onSignup = async (values: CitizenSignupValues) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { full_name: values.fullName } },
      });
      if (error) throw error;
      if (data.session) {
        toast.success("Account created.");
        router.push(redirect);
      } else
        toast.success(
          "Check your email to confirm your account before signing in.",
        );
    } catch (err: any) {
      toast.error("Could not create your account. Please try again.");
    }
    setLoading(false);
  };

  const handleSendOtp = async () => {
    if (!phone || phone.length < 8) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    setOtpSending(true);
    try {
      const fullPhone = phone.startsWith("+") ? phone : `+${phone}`;
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });
      if (error) throw error;
      setOtpSent(true);
      toast.success(
        "A login code was requested through the configured SMS provider.",
      );
    } catch (err: any) {
      toast.error(
        "Could not send the login code. Please check your phone number and try again.",
      );
    }
    setOtpSending(false);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const fullPhone = phone.startsWith("+") ? phone : `+${phone}`;
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otpCode,
        type: "sms",
      });
      if (error) throw error;
      toast.success("Signed in successfully.");
      router.push(redirect);
    } catch (err: any) {
      toast.error("Invalid or expired code. Please try again.");
    }
    setLoading(false);
  };

  const switchMode = (m: "login" | "signup") => {
    setMode(m);
    if (m === "signup") resetSignup();
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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white mb-4 shadow-lg shadow-blue-600/20">
          <Activity className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-navy">Citizen Portal</h1>
        <p className="mt-2 text-muted-foreground">
          {mode === "login"
            ? "Sign in to report and track community issues."
            : "Create an account to get started."}
        </p>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex gap-2">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-blue-600 text-white"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode("signup")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-blue-600 text-white"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              Create Account
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <div className="space-y-4">
              {/* Login method toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setLoginMode("email")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                    loginMode === "email"
                      ? "bg-blue-600 text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button
                  onClick={() => setLoginMode("phone")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                    loginMode === "phone"
                      ? "bg-green-600 text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  <MessageCircle className="h-4 w-4" /> Phone (provider
                  required)
                </button>
              </div>

              {loginMode === "email" ? (
                <form onSubmit={handleSubmit(onLogin)} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                        disabled={loading || guard.locked}
                        {...register("email")}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                        disabled={loading || guard.locked}
                        {...register("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Link
                      href="/forgot-password"
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  {guard.locked && (
                    <LockoutBanner remaining={guard.lockoutRemaining} />
                  )}
                  {!guard.locked && (
                    <AttemptCounter attempts={guard.attempts} />
                  )}

                  <Button
                    type="submit"
                    disabled={loading || guard.locked}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Signing
                        in...
                      </>
                    ) : (
                      <>
                        Sign In <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone">
                      Phone Number (Phone (provider required))
                    </Label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="pl-10"
                        disabled={otpSending || loading}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Include your country code (e.g. +91 for India, +1 for US).
                    </p>
                  </div>

                  {otpSent && (
                    <div>
                      <Label htmlFor="otp">
                        Enter the code sent to your Phone (provider required)
                      </Label>
                      <div className="relative mt-1.5">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="otp"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) =>
                            setOtpCode(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="6-digit code"
                          className="pl-10 tracking-widest"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  )}

                  {!otpSent ? (
                    <Button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpSending}
                      className="w-full gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {otpSending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Sending
                          code...
                        </>
                      ) : (
                        <>
                          <MessageCircle className="h-4 w-4" /> Send Code via
                          Phone (provider required)
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={loading || otpCode.length < 6}
                        className="w-full gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />{" "}
                            Verifying...
                          </>
                        ) : (
                          <>
                            Verify & Sign In <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode("");
                        }}
                        className="w-full"
                      >
                        Use a different number
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">
                    or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={loading || guard.locked}
                className="w-full gap-2 font-medium"
              >
                <GoogleIcon className="h-5 w-5" />
                Continue with Google
              </Button>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Are you a staff member?{" "}
                <Link
                  href="/staff/login"
                  className="font-medium text-red-600 hover:underline"
                >
                  Staff Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignupSubmit(onSignup)} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative mt-1.5">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="Your name"
                    className={`pl-10 ${signupErrors.fullName ? "border-destructive" : ""}`}
                    disabled={loading}
                    {...registerSignup("fullName")}
                  />
                </div>
                {signupErrors.fullName && (
                  <p className="mt-1 text-xs text-destructive">
                    {signupErrors.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className={`pl-10 ${signupErrors.email ? "border-destructive" : ""}`}
                    disabled={loading}
                    {...registerSignup("email")}
                  />
                </div>
                {signupErrors.email && (
                  <p className="mt-1 text-xs text-destructive">
                    {signupErrors.email.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    className={`pl-10 pr-10 ${signupErrors.password ? "border-destructive" : ""}`}
                    disabled={loading}
                    {...registerSignup("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {signupErrors.password && (
                  <p className="mt-1 text-xs text-destructive">
                    {signupErrors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating
                    account...
                  </>
                ) : (
                  <>
                    Create Account <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
