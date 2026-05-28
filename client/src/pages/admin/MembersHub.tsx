/**
 * MembersHub.tsx — Unified Members Administration
 *
 * Consolidates Users, Enrollments, Sales, Memberships, Contacts, and Activity
 * into a single hub, replacing the scattered admin pages.
 *
 * Tabs:
 *   Members     — full user list with analytics, drill-down to user profile
 *   Enrollments — all LMS enrollments across all courses, filterable + CSV export
 *   Sales       — revenue, transactions, refunds (embeds AdminSalesDashboard)
 *   Memberships — premium membership grants/revokes (embeds MembershipAdmin)
 *   Contacts    — leads/contacts (embeds ContactsAdmin)
 *   Activity    — global activity log across all users
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, BookOpen, DollarSign, Crown, Mail, Activity,
  ChevronLeft, ChevronRight, Search, Download,
  CheckCircle, Clock, ArrowUpDown, ArrowUp, ArrowDown,
  X, ExternalLink, GraduationCap, FileDown, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

// Lazy-load the heavy sub-pages to keep initial bundle small
import AdminSalesDashboard from "./AdminSalesDashboard";
import MembershipAdmin from "./MembershipAdmin";
import ContactsAdmin from "./ContactsAdmin";
import UserAnalytics from "./UserAnalytics";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  page_view: "bg-purple-100 text-purple-700",
  login: "bg-blue-100 text-blue-700",
  video_play: "bg-orange-100 text-orange-700",
  video_complete: "bg-green-100 text-green-700",
  quiz_attempt: "bg-pink-100 text-pink-700",
  quiz_pass: "bg-emerald-100 text-emerald-700",
  quiz_fail: "bg-red-100 text-red-700",
  course_enroll: "bg-teal-100 text-teal-700",
  course_complete: "bg-green-100 text-green-700",
  download: "bg-indigo-100 text-indigo-700",
  module_complete: "bg-cyan-100 text-cyan-700",
};

// Content type icon helper
const CONTENT_TYPE_ICON: Record<string, React.ReactNode> = {
  course: <GraduationCap className="w-3.5 h-3.5 text-teal-600" />,
  quiz: <HelpCircle className="w-3.5 h-3.5 text-purple-600" />,
  download: <FileDown className="w-3.5 h-3.5 text-indigo-600" />,
};
const CONTENT_TYPE_BADGE: Record<string, string> = {
  course: "bg-teal-50 text-teal-700 border-teal-200",
  quiz: "bg-purple-50 text-purple-700 border-purple-200",
  download: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

// ─── Enrollment Drill-Down Panel ──────────────────────────────────────────────
function EnrollmentDrillDown({ userId, userEmail, onClose }: { userId: number | null; userEmail: string; onClose: () => void }) {
  const { data, isLoading } = trpc.analyticsAdmin.userEnrollmentDetail.useQuery(
    userId ? { userId } : { userEmail },
    { enabled: !!(userId || userEmail) }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            {isLoading ? (
              <Skeleton className="h-5 w-40 mb-1" />
            ) : data ? (
              <>
                <div className="font-semibold text-gray-900 text-base">{data.userName}</div>
                <div className="text-xs text-gray-500">{data.userEmail}</div>
              </>
            ) : (
              <div className="text-sm text-gray-500">User not found</div>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Stats row */}
        {data && (
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-200">
            <div className="px-4 py-3 text-center">
              <div className="text-xl font-bold text-gray-900">{data.totalEnrollments}</div>
              <div className="text-xs text-gray-500">Enrollments</div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-xl font-bold text-green-600">{data.completedCount}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-xl font-bold text-teal-600">{data.isPremium ? "Premium" : "Free"}</div>
              <div className="text-xs text-gray-500">Membership</div>
            </div>
          </div>
        )}
        {data && (
          <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
            <span>Joined: <span className="text-gray-700">{fmtDate(data.userCreatedAt)}</span></span>
            <span>Last seen: <span className="text-gray-700">{fmtDate(data.lastSignedIn)}</span></span>
            {data.userId && (
              <a href={`/admin/user/${data.userId}`} className="ml-auto flex items-center gap-1 text-teal-600 hover:underline">
                Full Profile <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Enrollments list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : !data?.enrollments.length ? (
            <div className="p-8 text-center text-gray-400 text-sm">No enrollments found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.enrollments.map(e => (
                <div key={e.enrollmentId} className="px-5 py-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {CONTENT_TYPE_ICON[e.courseType] ?? CONTENT_TYPE_ICON.course}
                      <span className="text-sm font-medium text-gray-900 truncate" title={e.courseTitle}>
                        {e.courseTitle}
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-xs shrink-0 ${CONTENT_TYPE_BADGE[e.courseType] ?? ''}` }>
                      {e.courseType}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    {/* Progress bar */}
                    <div className="flex items-center gap-1.5 flex-1">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${e.progressPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{e.progressPct}%</span>
                    </div>
                    {e.completedAt ? (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        {fmtDate(e.completedAt)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        In progress
                      </div>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">Enrolled {fmtDate(e.enrolledAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Source badge config
const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  purchase:         { label: 'Purchase',  className: 'bg-green-50 text-green-700 border-green-200' },
  group:            { label: 'Group',     className: 'bg-blue-50 text-blue-700 border-blue-200' },
  thinkific_import: { label: 'Thinkific', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  admin_grant:      { label: 'Admin',     className: 'bg-gray-100 text-gray-600 border-gray-300' },
};

// ─── Enrollments Tab ──────────────────────────────────────────────────────────
type SortKey = 'enrolledAt' | 'userName' | 'courseTitle' | 'progressPct' | 'completedAt';

function EnrollmentsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "active" | "completed">("all");
  const [contentType, setContentType] = useState<"all" | "course" | "quiz" | "download">("all");
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortKey>("enrolledAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drillDown, setDrillDown] = useState<{ userId: number | null; userEmail: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<'grant' | 'revoke' | null>(null);
  const [grantCourseId, setGrantCourseId] = useState<number | undefined>(undefined);
  const PAGE_SIZE = 50;

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._enrollSearchTimer);
    (window as any)._enrollSearchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  };

  const handleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const { data, isLoading } = trpc.analyticsAdmin.enrollmentsList.useQuery({
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
    status,
    contentType,
    sortBy,
    sortDir,
  });

  const { isFetching: csvLoading, refetch: fetchCsv } = trpc.analyticsAdmin.exportEnrollmentsCsv.useQuery(
    { search: debouncedSearch || undefined, status },
    { enabled: false }
  );

  const handleExportCsv = async () => {
    const result = await fetchCsv();
    if (result.data?.csv) {
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `enrollments-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.data.totalRows} enrollment records`);
    }
  };

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  // Sort indicator helper
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-teal-600 ml-1 inline" />
      : <ArrowDown className="w-3 h-3 text-teal-600 ml-1 inline" />;
  };

  const SortTh = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`text-xs font-semibold text-gray-600 cursor-pointer select-none hover:text-teal-700 transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      {label}<SortIcon col={col} />
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search name, email, or course…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Content type filter */}
        <Select value={contentType} onValueChange={v => { setContentType(v as any); setPage(1); }}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="course">Courses</SelectItem>
            <SelectItem value="quiz">Quizzes</SelectItem>
            <SelectItem value="download">Downloads</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={status} onValueChange={v => { setStatus(v as any); setPage(1); }}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        {/* Active filter chips */}
        {(contentType !== 'all' || status !== 'all' || debouncedSearch) && (
          <button
            onClick={() => { setContentType('all'); setStatus('all'); setSearch(''); setDebouncedSearch(''); setPage(1); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}

        {data && (
          <span className="text-sm text-gray-400 ml-auto">{data.total.toLocaleString()} enrollments</span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={handleExportCsv}
          disabled={csvLoading}
        >
          <Download className="w-3.5 h-3.5" />
          {csvLoading ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {/* Table */}
      <Card className="border border-gray-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortTh col="userName" label="User" className="text-left px-4 py-2.5" />
                  <SortTh col="courseTitle" label="Course" className="text-left px-3 py-2.5" />
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Type</th>
                  <SortTh col="progressPct" label="Progress" className="text-right px-3 py-2.5" />
                  <SortTh col="enrolledAt" label="Enrolled" className="text-right px-3 py-2.5" />
                  <SortTh col="completedAt" label="Completed" className="text-right px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-2.5">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !data?.enrollments.length ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                      No enrollments found
                    </td>
                  </tr>
                ) : (
                  data.enrollments.map(e => (
                    <tr
                      key={e.enrollmentId}
                      className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                      onClick={() => setDrillDown({ userId: e.userId, userEmail: e.userEmail })}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900 text-sm">{e.userName || "—"}</div>
                        <div className="text-xs text-gray-400">{e.userEmail}</div>
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <span className="text-sm text-gray-700 truncate block" title={e.courseTitle}>
                          {e.courseTitle}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={`text-xs ${CONTENT_TYPE_BADGE[e.courseType] ?? ''}` }>
                          <span className="flex items-center gap-1">
                            {CONTENT_TYPE_ICON[e.courseType]}
                            {e.courseType}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${e.progressPct}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-8 text-right">{e.progressPct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(e.enrolledAt)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {e.completedAt ? (
                          <div className="flex items-center justify-end gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs text-gray-400">{fmtDate(e.completedAt)}</span>
                          </div>
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data?.total ?? 0)} of{" "}
                {data?.total ?? 0}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm" variant="outline" className="h-7 px-3 text-xs gap-1"
                  disabled={page <= 1}
                  onClick={ev => { ev.stopPropagation(); setPage(p => p - 1); }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <span className="text-xs text-gray-500 px-2">{page} / {totalPages}</span>
                <Button
                  size="sm" variant="outline" className="h-7 px-3 text-xs gap-1"
                  disabled={page >= totalPages}
                  onClick={ev => { ev.stopPropagation(); setPage(p => p + 1); }}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drill-down panel */}
      {drillDown && (
        <EnrollmentDrillDown
          userId={drillDown.userId}
          userEmail={drillDown.userEmail}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
}

// ─── Global Activity Tab ──────────────────────────────────────────────────────
function GlobalActivityTab() {
  const [page, setPage] = useState(1);
  const [eventFilter, setEventFilter] = useState<string>("all_events");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const PAGE_SIZE = 50;

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._activitySearchTimer);
    (window as any)._activitySearchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  };

  const activeFilter = eventFilter === "all_events" ? undefined : eventFilter;

  const { data, isLoading } = trpc.analyticsAdmin.globalActivityLog.useQuery({
    page,
    pageSize: PAGE_SIZE,
    eventType: activeFilter,
    search: debouncedSearch || undefined,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  const eventTypes = [
    { value: "all_events", label: "All Events" },
    { value: "page_view", label: "Page Views" },
    { value: "login", label: "Logins" },
    { value: "video_play", label: "Video Plays" },
    { value: "video_complete", label: "Video Completes" },
    { value: "quiz_attempt", label: "Quiz Attempts" },
    { value: "course_enroll", label: "Enrollments" },
    { value: "course_complete", label: "Completions" },
    { value: "download", label: "Downloads" },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by user name or email…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={eventFilter} onValueChange={v => { setEventFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map(et => (
              <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-gray-400">{data.total.toLocaleString()} events</span>
        )}
      </div>

      <Card className="border border-gray-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Timestamp</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">User</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Event</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Description</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Path</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-2.5">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !data?.logs.length ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                      No activity logged yet
                    </td>
                  </tr>
                ) : (
                  data.logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDateTime(log.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium text-gray-900">{log.userName || "—"}</div>
                        <div className="text-xs text-gray-400">{log.userEmail}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={`text-xs ${EVENT_TYPE_COLORS[log.eventType ?? ""] || "bg-gray-100 text-gray-700"}`}>
                          {(log.eventType ?? "unknown").replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[200px] truncate" title={log.description}>
                        {log.description}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono max-w-[120px] truncate" title={log.path || ""}>
                        {log.path || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {log.ipAddress || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages} ({data?.total ?? 0} total)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Members Hub ─────────────────────────────────────────────────────────
export default function MembersHub() {
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") ?? "members";
  });

  const tabs = [
    { value: "members",     label: "Members",     icon: Users,      count: null },
    { value: "enrollments", label: "Enrollments", icon: BookOpen,   count: null },
    { value: "sales",       label: "Sales",       icon: DollarSign, count: null },
    { value: "memberships", label: "Memberships", icon: Crown,      count: null },
    { value: "contacts",    label: "Contacts",    icon: Mail,       count: null },
    { value: "activity",    label: "Activity",    icon: Activity,   count: null },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
            <a href="/platform-admin" className="hover:text-teal-600 transition-colors">Platform Admin</a>
            <span>/</span>
            <span className="text-gray-600 font-medium">Members</span>
          </nav>
          <h2 className="text-xl font-bold text-gray-900">Members</h2>
          <p className="text-sm text-gray-500">
            Unified view of users, enrollments, sales, memberships, contacts, and activity
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 flex-wrap h-auto gap-1 p-1">
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-sm gap-1.5 h-8">
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Members — full UserAnalytics embedded (hide its inner breadcrumb/header) */}
        <TabsContent value="members" className="mt-4">
          <div className="[&>div>div:first-child]:hidden">
            <UserAnalytics />
          </div>
        </TabsContent>

        {/* Enrollments */}
        <TabsContent value="enrollments" className="mt-4">
          <EnrollmentsTab />
        </TabsContent>

        {/* Sales — hide inner breadcrumb/header from AdminSalesDashboard */}
        <TabsContent value="sales" className="mt-4">
          <div className="[&_.max-w-7xl]:max-w-none [&_.max-w-7xl]:px-0 [&_.max-w-7xl]:py-0">
            <AdminSalesDashboard />
          </div>
        </TabsContent>

        {/* Memberships */}
        <TabsContent value="memberships" className="mt-4">
          <MembershipAdmin />
        </TabsContent>

        {/* Contacts */}
        <TabsContent value="contacts" className="mt-4">
          <ContactsAdmin />
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity" className="mt-4">
          <GlobalActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
