import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "CIVIC PULSE AI — Intelligent Civic Incident Platform",
  description:
    "An AI-powered early-warning and resolution network for everyday public-service failures. Report, track, and resolve community issues with intelligent prioritization.",
  openGraph: {
    title: "CIVIC PULSE AI",
    description:
      "Transform community observations into actionable civic intelligence.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return (
      <html lang="en">
        <body className="font-sans">
          <main className="mx-auto max-w-2xl p-8 py-20">
            <p className="text-teal font-semibold">CIVIC PULSE AI</p>
            <h1 className="text-3xl font-bold mt-4">
              Connect your development database
            </h1>
            <p className="mt-5 text-muted-foreground">
              The application needs its Supabase project configuration before
              reporting, authentication and tracking can run. No reports or
              statistics are simulated.
            </p>
            <ul className="font-mono text-sm mt-5 space-y-2">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            </ul>
            <p className="mt-5">
              Set these values in environment settings or the local .env.local
              file, apply the reviewed migration to a development project, and
              rebuild.
            </p>
          </main>
        </body>
      </html>
    );
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main id="main" className="flex-1">
                <Suspense fallback={<p className="p-8">Loading…</p>}>
                  {children}
                </Suspense>
              </main>
            </div>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
