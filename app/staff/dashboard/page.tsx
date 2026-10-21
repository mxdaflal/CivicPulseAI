"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  LogOut,
  FileText,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  MapPin,
  ChevronRight,
  Eye,
  Droplets,
  Trash2,
  Construction,
  Waves,
  Lightbulb,
  Bus,
  AlertTriangle,
  Calendar,
  Building2,
  Timer,
  X,
  Image as ImageIcon,
  Brain,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  supabase,
  Report,
  Incident,
  Department,
  Profile,
  AIAnalysis,
} from "@/lib/supabase-client";
import { useAuth } from "@/components/auth-provider";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  INCIDENT_STATUSES,
  STATUS_TRANSITIONS,
} from "@/lib/constants";
import { PrivateEvidence } from "@/components/private-evidence";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { duplicateCandidates, analyzeReport } from "@/lib/ai-analysis";

const STAFF_ROLES = ["verifier", "operator", "manager", "admin"];

const categoryIcons: Record<string, any> = {
  "Water Supply": Droplets,
  "Garbage Overflow": Trash2,
  "Damaged Road": Construction,
  "Drainage Problem": Waves,
  "Streetlight Failure": Lightbulb,
  "Public Transport": Bus,
};

export default function StaffDashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  const requestVersion = useRef(0);
  const [categoryFilter, setCategoryFilter] = useState("all"),
    [departmentFilter, setDepartmentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stats, setStats] = useState({
    open: 0,
    verified: 0,
    inProgress: 0,
    resolved: 0,
    pending: 0,
    overdue: 0,
  });
  const [detailReport, setDetailReport] = useState<Report | null>(null);
  const [detailAiAnalysis, setDetailAiAnalysis] = useState<AIAnalysis | null>(
    null,
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isStaff = profile && STAFF_ROLES.includes(profile.role);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/staff/login");
      return;
    }
    if (!authLoading && user && profile && !isStaff) {
      toast.error("Access denied. Staff account required.");
      router.push("/staff/login");
    }
  }, [authLoading, user, profile, isStaff, router]);

  const fetchData = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      let incidentQuery = supabase
        .from("incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * 25, page * 25 + 24);
      if (statusFilter !== "all")
        incidentQuery = incidentQuery.eq("status", statusFilter);
      if (priorityFilter !== "all")
        incidentQuery = incidentQuery.eq("priority_label", priorityFilter);
      if (categoryFilter !== "all")
        incidentQuery = incidentQuery.eq("category_name", categoryFilter);
      if (departmentFilter !== "all")
        incidentQuery = incidentQuery.eq(
          "assigned_department_id",
          departmentFilter,
        );
      if (dateFrom)
        incidentQuery = incidentQuery.gte(
          "created_at",
          dateFrom + "T00:00:00Z",
        );
      if (dateTo)
        incidentQuery = incidentQuery.lte(
          "created_at",
          dateTo + "T23:59:59.999Z",
        );
      const search = searchQuery
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .trim()
        .slice(0, 150);
      if (search)
        incidentQuery = incidentQuery.or(
          `title.ilike.%${search}%,location_text.ilike.%${search}%`,
        );
      const [reportsRes, incidentsRes, deptsRes] = await Promise.all([
        supabase
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false })
          .range(page * 25, page * 25 + 24),
        incidentQuery,
        supabase.from("departments").select("*"),
      ]);

      if (version !== requestVersion.current) return;
      for (const result of [reportsRes, incidentsRes, deptsRes])
        if (result.error) throw result.error;
      setReports((reportsRes.data as Report[]) || []);
      setIncidents((incidentsRes.data as Incident[]) || []);
      setDepartments((deptsRes.data as Department[]) || []);

      const { data: counts, error: countsError } =
        await supabase.rpc("civic_staff_stats");
      if (countsError) throw countsError;
      if (version === requestVersion.current) setStats(counts);
    } catch {
      toast.error("Failed to load dashboard data.");
    }
    setLoading(false);
  }, [
    page,
    statusFilter,
    priorityFilter,
    categoryFilter,
    departmentFilter,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  const live = useLiveRefresh(["reports", "incidents"], fetchData, !!isStaff);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isStaff) void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [isStaff, fetchData]);

  const openReportDetail = async (report: Report) => {
    setDetailReport(report);
    setDetailAiAnalysis(null);
    setLoadingDetail(true);
    try {
      const { data } = await supabase
        .from("ai_analyses")
        .select("*")
        .eq("report_id", report.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setDetailAiAnalysis(data as AIAnalysis);
    } catch {
      // AI analysis is optional
    }
    setLoadingDetail(false);
  };

  const reviewReport = async (
    report: Report,
    decision: string,
    existing?: string,
  ) => {
    if (actionLoading) return;
    const reason =
      decision === "rejected"
        ? window.prompt(
            "Reason for rejecting this report (at least 5 characters)",
          )
        : "";
    if (reason === null) return;
    setActionLoading(true);
    const { error } = await supabase.rpc("review_civic_report", {
      report_id: report.id,
      decision,
      existing_incident: existing ?? null,
      reason: reason ?? "",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Review saved with its audit record.");
      setDetailReport(null);
      void fetchData();
    }
    setActionLoading(false);
  };
  const handleVerifyReport = (report: Report) =>
    reviewReport(report, "verified");
  const handleStatusChange = async (incident: Incident, newStatus: string) => {
    const note = window.prompt(
      "Record a progress note (required for resolution, rejection or reopening)",
    );
    if (note === null) return;
    const { error } = await supabase.rpc("update_civic_incident", {
      target: incident.id,
      next_status: newStatus,
      note,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Status and audit event saved.");
      void fetchData();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleAssignDepartment = async (incident: Incident, deptId: string) => {
    const { error } = await supabase.rpc("update_civic_incident", {
      target: incident.id,
      department: deptId,
      next_status: incident.status === "verified" ? "assigned" : null,
      note: "Department assigned by authorised manager",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Assignment saved.");
      void fetchData();
    }
  };
  const handleDeleteIncident = async (_incident: Incident) => {
    toast.info(
      "Incident history is retained. Use a documented status transition.",
    );
  };
  const handleRejectReport = (report: Report) =>
    reviewReport(report, "rejected");

  const isAdmin = false; // Audit history is append-only, including for administrators.
  const canReview = ["verifier", "manager", "admin"].includes(
    profile?.role ?? "",
  );

  const filteredIncidents = incidents;

  const unverifiedReports = reports.filter((r) => r.status === "submitted");

  if (authLoading || (!profile && authLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isStaff) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-600" />
            Staff Operations Dashboard
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {profile?.full_name} · {live} ·{" "}
            <Badge variant="secondary" className="capitalize">
              {profile?.role}
            </Badge>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="gap-2 shrink-0"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          {
            label: "Pending Review",
            value: stats.pending,
            icon: AlertCircle,
            color: "#b45309",
            bg: "#fef3c7",
          },
          {
            label: "Open",
            value: stats.open,
            icon: AlertCircle,
            color: "#1e40af",
            bg: "#dbeafe",
          },
          {
            label: "Verified",
            value: stats.verified,
            icon: CheckCircle2,
            color: "#0e7490",
            bg: "#cffafe",
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            icon: Clock,
            color: "#b45309",
            bg: "#fef3c7",
          },
          {
            label: "Resolved",
            value: stats.resolved,
            icon: TrendingUp,
            color: "#15803d",
            bg: "#dcfce7",
          },
          {
            label: "Overdue",
            value: stats.overdue,
            icon: AlertTriangle,
            color: "#b91c1c",
            bg: "#fee2e2",
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: stat.bg }}
                >
                  <stat.icon
                    className="h-4 w-4"
                    style={{ color: stat.color }}
                  />
                </div>
                <span className="text-2xl font-bold text-navy">
                  {stat.value}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Pending reports + incidents table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Verification */}
          {unverifiedReports.length > 0 && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg text-navy flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Pending Verification ({unverifiedReports.length})
                </CardTitle>
                <CardDescription>
                  Review and verify citizen submissions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {unverifiedReports.map((report) => {
                    const color =
                      CATEGORY_COLORS[report.category_name] || "#3b82f6";
                    const CatIcon =
                      categoryIcons[report.category_name] || AlertCircle;
                    const priorityConfig =
                      PRIORITY_CONFIG[report.priority_label];
                    return (
                      <div
                        key={report.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:border-blue-300 transition-colors cursor-pointer"
                        onClick={() => openReportDetail(report)}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                            style={{ backgroundColor: `${color}15` }}
                          >
                            <CatIcon className="h-4 w-4" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-navy truncate text-sm">
                              {report.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {report.tracking_id} · {report.category_name} ·{" "}
                              {new Date(report.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {priorityConfig && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
                            style={{
                              color: priorityConfig.color,
                              backgroundColor: priorityConfig.bg,
                            }}
                          >
                            {priorityConfig.label}
                          </span>
                        )}
                        {report.photo_url && (
                          <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReportDetail(report);
                          }}
                          className="shrink-0 gap-1.5"
                        >
                          Review <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                maxLength={150}
                placeholder="Search incidents..."
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {INCIDENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_CONFIG[s]?.label || s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter}
              onValueChange={(value) => {
                setPriorityFilter(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-3 my-4">
            <label className="text-xs">
              Category{" "}
              <select
                className="border bg-background rounded p-2"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All categories</option>
                {Object.keys(CATEGORY_COLORS).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Department{" "}
              <select
                className="border bg-background rounded p-2"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              From (UTC)
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label className="text-xs">
              To (UTC)
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          </div>
          {/* Incidents Table */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy">
                Incidents ({filteredIncidents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredIncidents.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No incidents match your filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
                  {filteredIncidents.map((inc) => {
                    const CatIcon =
                      categoryIcons[inc.category_name] || AlertCircle;
                    const color =
                      CATEGORY_COLORS[inc.category_name] || "#3b82f6";
                    const statusConfig = STATUS_CONFIG[inc.status];
                    const priorityConfig = PRIORITY_CONFIG[inc.priority_label];
                    const transitions = STATUS_TRANSITIONS[inc.status] || [];
                    const now = new Date();
                    const isOverdue =
                      inc.sla_deadline &&
                      inc.status !== "resolved" &&
                      inc.status !== "rejected" &&
                      new Date(inc.sla_deadline) < now;
                    const assignedDept = departments.find(
                      (d) =>
                        d.id ===
                        (inc.assigned_department_id || inc.department_id),
                    );
                    const daysSinceCreated = Math.floor(
                      (now.getTime() - new Date(inc.created_at).getTime()) /
                        (1000 * 60 * 60 * 24),
                    );

                    return (
                      <div
                        key={inc.id}
                        className={`rounded-lg border p-3 hover:bg-secondary/50 transition-colors ${isOverdue ? "border-red-300 bg-red-50/30" : "border-border"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0 cursor-pointer"
                            style={{ backgroundColor: `${color}15` }}
                            onClick={() => router.push(`/incidents/${inc.id}`)}
                          >
                            <CatIcon className="h-4 w-4" style={{ color }} />
                          </div>
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => router.push(`/incidents/${inc.id}`)}
                          >
                            <div className="font-medium text-navy truncate text-sm">
                              {inc.title}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span>{inc.category_name}</span>
                              {inc.location_text && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-0.5">
                                    <MapPin className="h-3 w-3" />
                                    {inc.location_text}
                                  </span>
                                </>
                              )}
                              <span>·</span>
                              <span>
                                {inc.report_count} report
                                {inc.report_count !== 1 ? "s" : ""}
                              </span>
                              {assignedDept && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-0.5">
                                    <Building2 className="h-3 w-3" />
                                    {assignedDept.name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {isOverdue && (
                            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 bg-red-100 text-red-700">
                              <Timer className="h-3 w-3" /> Overdue
                            </span>
                          )}
                          {priorityConfig && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
                              style={{
                                color: priorityConfig.color,
                                backgroundColor: priorityConfig.bg,
                              }}
                            >
                              {priorityConfig.label}
                            </span>
                          )}
                          {statusConfig && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
                              style={{
                                color: statusConfig.color,
                                backgroundColor: statusConfig.bg,
                              }}
                            >
                              {statusConfig.label}
                            </span>
                          )}
                        </div>

                        {/* Meta info: dates, SLA */}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            Created{" "}
                            {new Date(inc.created_at).toLocaleDateString()}
                            {daysSinceCreated > 0 &&
                              ` (${daysSinceCreated}d ago)`}
                          </span>
                          {inc.sla_deadline &&
                            inc.status !== "resolved" &&
                            inc.status !== "rejected" && (
                              <span
                                className={`flex items-center gap-0.5 ${isOverdue ? "text-red-600 font-medium" : ""}`}
                              >
                                <Clock className="h-3 w-3" />
                                SLA:{" "}
                                {new Date(
                                  inc.sla_deadline,
                                ).toLocaleDateString()}
                              </span>
                            )}
                          {inc.resolved_at && (
                            <span className="flex items-center gap-0.5 text-green-600 font-medium">
                              <CheckCircle2 className="h-3 w-3" />
                              Resolved{" "}
                              {new Date(inc.resolved_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Status Actions + Department Assignment */}
                        <div className="flex items-center flex-wrap gap-2 mt-2 pt-2 border-t border-border/60">
                          {transitions.length > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground">
                                Update:
                              </span>
                              {transitions.map((s) => (
                                <button
                                  key={s}
                                  disabled={
                                    profile?.role === "verifier" ||
                                    (profile?.role === "operator" &&
                                      !["in_progress", "resolved"].includes(s))
                                  }
                                  onClick={() => handleStatusChange(inc, s)}
                                  className={`text-xs font-medium px-2 py-0.5 rounded-md transition-colors ${
                                    s === "resolved"
                                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                                      : s === "rejected"
                                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                                        : "bg-secondary hover:bg-secondary/80 text-foreground"
                                  }`}
                                >
                                  {STATUS_CONFIG[s]?.label || s}
                                </button>
                              ))}
                            </>
                          )}

                          {/* Department assignment */}
                          {departments.length > 0 &&
                            inc.status !== "resolved" &&
                            inc.status !== "rejected" && (
                              <Select
                                disabled={
                                  !["manager", "admin"].includes(
                                    profile?.role ?? "",
                                  )
                                }
                                value={
                                  inc.assigned_department_id ||
                                  inc.department_id ||
                                  "none"
                                }
                                onValueChange={(val) =>
                                  val !== "none" &&
                                  handleAssignDepartment(inc, val)
                                }
                              >
                                <SelectTrigger className="h-7 w-[140px] text-xs gap-1">
                                  <Building2 className="h-3 w-3" />
                                  <SelectValue placeholder="Assign dept" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    Unassigned
                                  </SelectItem>
                                  {departments.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                          <button
                            onClick={() => router.push(`/incidents/${inc.id}`)}
                            className="text-xs font-medium px-2 py-0.5 rounded-md text-blue-600 hover:underline ml-auto"
                          >
                            Details
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteIncident(inc)}
                              className="text-xs font-medium px-2 py-0.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
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

        {/* Right: Quick Stats + Recent Reports */}
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-red-600" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Incidents</span>
                <span className="font-bold text-navy">{incidents.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Reports</span>
                <span className="font-bold text-navy">{reports.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Review</span>
                <span className="font-bold text-amber-600">
                  {stats.pending}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overdue</span>
                <span className="font-bold text-red-600">{stats.overdue}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Departments</span>
                <span className="font-bold text-navy">
                  {departments.length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg text-navy flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-600" />
                Recent Reports ({reports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No reports submitted.
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {reports.slice(0, 15).map((report) => {
                    const statusConfig = STATUS_CONFIG[report.status];
                    const CatIcon =
                      categoryIcons[report.category_name] || AlertCircle;
                    const color =
                      CATEGORY_COLORS[report.category_name] || "#3b82f6";
                    return (
                      <div
                        key={report.id}
                        className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => openReportDetail(report)}
                      >
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-md shrink-0"
                          style={{ backgroundColor: `${color}15` }}
                        >
                          <CatIcon className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-navy text-xs truncate">
                            {report.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {report.tracking_id}
                          </div>
                        </div>
                        {statusConfig && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
                            style={{
                              color: statusConfig.color,
                              backgroundColor: statusConfig.bg,
                            }}
                          >
                            {statusConfig.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex gap-3 my-6">
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          Previous page
        </Button>
        <span className="p-2">Page {page + 1}</span>
        <Button
          variant="outline"
          disabled={reports.length < 25 && incidents.length < 25}
          onClick={() => setPage(page + 1)}
        >
          Next page
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Search and filters query permitted incidents across pages. Summary
        counts cover all records available to your role.
      </p>
      {/* Report Detail Modal */}
      <Dialog
        open={!!detailReport}
        onOpenChange={(open) => {
          if (!open) setDetailReport(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
          {detailReport && (
            <>
              <DialogHeader className="px-6 pt-6 pb-2 border-b border-border">
                <DialogTitle className="text-lg text-navy flex items-center gap-2">
                  {(() => {
                    const CatIcon =
                      categoryIcons[detailReport.category_name] || AlertCircle;
                    const color =
                      CATEGORY_COLORS[detailReport.category_name] || "#3b82f6";
                    return (
                      <>
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                          style={{ backgroundColor: `${color}15` }}
                        >
                          <CatIcon className="h-4 w-4" style={{ color }} />
                        </div>
                        {detailReport.title}
                      </>
                    );
                  })()}
                </DialogTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span className="font-mono">{detailReport.tracking_id}</span>
                  <span>·</span>
                  <span>{detailReport.category_name}</span>
                  <span>·</span>
                  <span>
                    {new Date(detailReport.created_at).toLocaleString()}
                  </span>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[55vh] px-6 py-4">
                <div className="space-y-4">
                  {/* Priority + Status badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const priorityConfig =
                        PRIORITY_CONFIG[detailReport.priority_label];
                      const statusConfig = STATUS_CONFIG[detailReport.status];
                      return (
                        <>
                          {priorityConfig && (
                            <span
                              className="rounded-full px-2.5 py-1 text-xs font-semibold"
                              style={{
                                color: priorityConfig.color,
                                backgroundColor: priorityConfig.bg,
                              }}
                            >
                              {priorityConfig.label} Priority
                            </span>
                          )}
                          {statusConfig && (
                            <span
                              className="rounded-full px-2.5 py-1 text-xs font-semibold"
                              style={{
                                color: statusConfig.color,
                                backgroundColor: statusConfig.bg,
                              }}
                            >
                              {statusConfig.label}
                            </span>
                          )}
                          {detailReport.ai_processed && (
                            <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-700">
                              AI Processed
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="text-sm font-semibold text-navy mb-1">
                      Description
                    </h4>
                    <p className="text-sm text-foreground leading-relaxed">
                      {detailReport.description || "No description provided."}
                    </p>
                  </div>

                  {/* Location */}
                  <div>
                    <h4 className="text-sm font-semibold text-navy mb-1 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Location
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {detailReport.location_text || "No location specified."}
                    </p>
                    {detailReport.latitude && detailReport.longitude && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${detailReport.latitude}&mlon=${detailReport.longitude}#map=18/${detailReport.latitude}/${detailReport.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        View on map ({detailReport.latitude.toFixed(5)},{" "}
                        {detailReport.longitude.toFixed(5)})
                      </a>
                    )}
                  </div>

                  {/* Photo */}
                  {detailReport.photo_url && (
                    <div>
                      <h4 className="text-sm font-semibold text-navy mb-1 flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" /> Evidence Photo
                      </h4>
                      <PrivateEvidence path={detailReport.photo_url} />
                    </div>
                  )}

                  {/* AI Analysis */}
                  <div>
                    <h4 className="text-sm font-semibold text-navy mb-1 flex items-center gap-1.5">
                      <Brain className="h-3.5 w-3.5" /> AI Analysis
                    </h4>
                    {loadingDetail ? (
                      <div className="flex items-center gap-2 py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Loading analysis...
                        </span>
                      </div>
                    ) : detailAiAnalysis ? (
                      <div className="rounded-lg border border-border bg-blue-50/30 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          {detailAiAnalysis.model_version?.includes(
                            "openai",
                          ) ? (
                            <>
                              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                              <span className="text-xs font-semibold text-blue-600">
                                AI-Powered Analysis
                              </span>
                            </>
                          ) : (
                            <>
                              <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold text-muted-foreground">
                                Basic Analysis
                              </span>
                            </>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {detailAiAnalysis.model_version}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {detailAiAnalysis.explanation ||
                            "No explanation available."}
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="text-xs">
                            <span className="text-muted-foreground">
                              Suggested Category:{" "}
                            </span>
                            <span className="font-medium">
                              {detailAiAnalysis.suggested_category || "N/A"}
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted-foreground">
                              Confidence:{" "}
                            </span>
                            <span className="font-medium">
                              {detailAiAnalysis.confidence != null
                                ? `${Math.round(detailAiAnalysis.confidence * 100)}%`
                                : "N/A"}
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted-foreground">
                              Priority Score:{" "}
                            </span>
                            <span className="font-medium">
                              {detailAiAnalysis.priority_score}
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted-foreground">
                              Priority Label:{" "}
                            </span>
                            <span className="font-medium capitalize">
                              {detailAiAnalysis.priority_label || "N/A"}
                            </span>
                          </div>
                        </div>
                        {detailAiAnalysis.priority_factors && (
                          <div className="flex gap-3 mt-2 text-xs">
                            {(
                              Object.entries(
                                detailAiAnalysis.priority_factors,
                              ) as [string, number][]
                            ).map(([key, val]) => (
                              <span key={key} className="text-muted-foreground">
                                {key.charAt(0).toUpperCase() + key.slice(1)}:{" "}
                                <span className="font-medium text-navy">
                                  {val}/100
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No AI analysis available for this report.
                      </p>
                    )}
                  </div>
                </div>
              </ScrollArea>

              {/* Action Footer */}
              {canReview &&
                detailReport.status === "submitted" &&
                duplicateCandidates(detailReport, incidents).length > 0 && (
                  <div className="px-6 py-3 border-t">
                    <p className="text-sm font-semibold">
                      Possible duplicates — same category, within 1 km and 30
                      days
                    </p>
                    {duplicateCandidates(detailReport, incidents).map((i) => (
                      <Button
                        key={i.id}
                        variant="outline"
                        size="sm"
                        disabled={
                          actionLoading ||
                          !canReview ||
                          detailReport.status !== "submitted"
                        }
                        onClick={() =>
                          void reviewReport(detailReport, "linked", i.id)
                        }
                      >
                        Link to {i.title}
                      </Button>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Candidates are drawn from this incident page. Review
                      before linking.
                    </p>
                  </div>
                )}
              <DialogFooter className="px-6 py-4 border-t border-border gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleRejectReport(detailReport)}
                  disabled={
                    actionLoading ||
                    !canReview ||
                    detailReport.status !== "submitted"
                  }
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Reject Report
                </Button>
                <Button
                  onClick={() => handleVerifyReport(detailReport)}
                  disabled={
                    actionLoading ||
                    !canReview ||
                    detailReport.status !== "submitted"
                  }
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Verify & Create
                      Incident
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
