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
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, BookOpen, DollarSign, Crown, Mail, Activity,
  ChevronLeft, ChevronRight, Search, Download, RefreshCw,
  CheckCircle, Clock, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

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

// ─── Enrollments Tab ──────────────────────────────────────────────────────────
function EnrollmentsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "active" | "completed">("all");
  const PAGE_SIZE = 50;

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._enrollSearchTimer);
    (window as any)._enrollSearchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  };

  const { data, isLoading } = trpc.analyticsAdmin.enrollmentsList.useQuery({
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
    status,
  });

  const { data: csvData, isFetching: csvLoading, refetch: fetchCsv } = trpc.analyticsAdmin.exportEnrollmentsCsv.useQuery(
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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or course…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
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
        {data && (
          <span className="text-sm text-gray-400">{data.total.toLocaleString()} enrollments</span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs ml-auto"
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
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">User</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Course</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Progress</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Enrolled</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Completed</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Type</th>
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
                    <tr key={e.enrollmentId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900 text-sm">{e.userName || "—"}</div>
                        <div className="text-xs text-gray-400">{e.userEmail}</div>
                      </td>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <span className="text-sm text-gray-700 truncate block" title={e.courseTitle}>
                          {e.courseTitle}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full"
                              style={{ width: `${e.progressPct}%` }}
                            />
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
                      <td className="px-3 py-2.5 text-right">
                        {e.enrollmentType && (
                          <Badge variant="outline" className="text-xs">
                            {e.enrollmentType}
                          </Badge>
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
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <span className="text-xs text-gray-500 px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm" variant="outline" className="h-7 px-3 text-xs gap-1"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
                        <Badge className={`text-xs ${EVENT_TYPE_COLORS[log.eventType] || "bg-gray-100 text-gray-700"}`}>
                          {log.eventType.replace(/_/g, " ")}
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

        {/* Members — full UserAnalytics embedded */}
        <TabsContent value="members" className="mt-4">
          <UserAnalytics />
        </TabsContent>

        {/* Enrollments */}
        <TabsContent value="enrollments" className="mt-4">
          <EnrollmentsTab />
        </TabsContent>

        {/* Sales */}
        <TabsContent value="sales" className="mt-4">
          <AdminSalesDashboard />
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
