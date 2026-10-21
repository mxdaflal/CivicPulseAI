"use client";

import { NotificationInbox } from "@/components/notification-inbox";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Menu,
  X,
  Activity,
  LayoutDashboard,
  BarChart3,
  FileText,
  LogOut,
  Plus,
  User,
  Sun,
  Moon,
  Shield,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home", icon: Activity },
  { href: "/report", label: "Report", icon: Plus },
  { href: "/citizen/dashboard", label: "My reports", icon: FileText },
  { href: "/map", label: "Map", icon: Activity },
  { href: "/track", label: "Track", icon: FileText },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, profile, signOut, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const isStaff =
    profile &&
    ["verifier", "operator", "manager", "admin"].includes(profile.role);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-white">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-navy">
              CIVIC PULSE<span className="text-accent"> AI</span>
            </span>
          </Link>

          <nav className="hidden xl:flex items-center gap-1">
            {navLinks.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              // Dashboard is staff-only
              if (link.href === "/dashboard" && !isStaff) return null;
              if (link.href === "/admin" && profile?.role !== "admin")
                return null;
              if (link.href === "/citizen/dashboard" && !user) return null;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-navy"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden xl:flex items-center gap-2">
          <NotificationInbox />
          {/* Dark mode toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}

          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="max-w-[100px] truncate">
                    {profile?.full_name || "Account"}
                  </span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href="/citizen/login">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <User className="h-3.5 w-3.5" />
                  Citizen
                </Button>
              </Link>
              <Link href="/staff/login">
                <Button
                  size="sm"
                  className="gap-1.5 bg-red-600 hover:bg-red-700"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Staff
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="xl:hidden flex items-center gap-1">
          {mounted && (
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="xl:hidden border-t border-border bg-background animate-fade-in">
          <nav className="flex flex-col px-4 py-3 gap-1">
            <NotificationInbox />
            {navLinks.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              if (link.href === "/dashboard" && !isStaff) return null;
              if (link.href === "/admin" && profile?.role !== "admin")
                return null;
              if (link.href === "/citizen/dashboard" && !user) return null;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-navy"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
            <div className="border-t border-border mt-2 pt-2">
              {loading ? null : user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
                  >
                    <User className="h-4 w-4" />
                    {profile?.full_name || "Account"}
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setMobileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-3 py-2">
                  <Link
                    href="/citizen/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                  >
                    <User className="h-4 w-4" />
                    Citizen
                  </Link>
                  <Link
                    href="/staff/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
                  >
                    <Shield className="h-4 w-4" />
                    Staff
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
