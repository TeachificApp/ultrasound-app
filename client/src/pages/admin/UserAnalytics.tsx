/**
 * UserAnalytics.tsx
 * Admin reporting dashboard — logins, page views, course progress,
 * videos watched, quizzes, and downloads — per user.
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, LogIn, Eye, PlayCircle, HelpCircle, Download, ArrowLeft,
  ChevronLeft, ChevronRight, TrendingUp, BookOpen, CheckCircle, Clock,
  Search, SortAsc, SortDesc, Trash2, AlertTriangle, Mail, RefreshCw,
  ShoppingCart, GraduationCap,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Date helpers ────────────────────────────────────────────────────────────
function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function daysAgo(n: number) {
  return isoDate(new Date(Date.now() - n * 86400_000));
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{label}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────
function OverviewTab({ from, to }: { from: string; to: string }) {
  const [metric, setMetric] = useState<"logins" | "pageViews" | "videoPlays" | "quizAttempts" | "downloads">("logins");

  const { data: overview, isLoading: ovLoading } = trpc.analyticsAdmin.overview.useQuery({ from, to });
  const { data: series, isLoading: serLoading } = trpc.analyticsAdmin.dailySeries.useQuery({ from, to, metric });
  const { data: topPages, isLoading: tpLoading } = trpc.analyticsAdmin.topPages.useQuery({ from, to, limit: 15 });
  const { data: topCourses, isLoading: tcLoading } = trpc.analyticsAdmin.topCourses.useQuery({ from, to, limit: 8 });

  const METRIC_LABELS: Record<string, string> = {
    logins: "Logins", pageViews: "Page Views", videoPlays: "Video Plays",
    quizAttempts: "Quiz Attempts", downloads: "Downloads",
  };

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ovLoading ? (
          Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : overview ? (
          <>
            <StatCard icon={<Users className="w-5 h-5 text-teal-600" />} label="Active Users" value={overview.activeUsers} color="bg-teal-50" />
            <StatCard icon={<LogIn className="w-5 h-5 text-blue-600" />} label="Logins" value={overview.logins} color="bg-blue-50" />
            <StatCard icon={<Eye className="w-5 h-5 text-teal-600" />} label="Page Views" value={overview.pageViews} color="bg-teal-50" />
            <StatCard icon={<PlayCircle className="w-5 h-5 text-orange-600" />} label="Video Plays" value={overview.videoPlays} sub={`${overview.videoCompletes} completed`} color="bg-orange-50" />
            <StatCard icon={<HelpCircle className="w-5 h-5 text-pink-600" />} label="Quiz Attempts" value={overview.quizAttempts} color="bg-pink-50" />
            <StatCard icon={<Download className="w-5 h-5 text-green-600" />} label="Downloads" value={overview.downloads} color="bg-green-50" />
            <StatCard icon={<ShoppingCart className="w-5 h-5 text-emerald-600" />} label="Purchases" value={(overview as any).purchases ?? 0} color="bg-emerald-50" />
            <StatCard icon={<GraduationCap className="w-5 h-5 text-indigo-600" />} label="Enrollments" value={(overview as any).enrollments ?? 0} color="bg-indigo-50" />
          </>
        ) : null}
      </div>

      {/* Daily trend chart */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">Daily Trend</CardTitle>
          <Select value={metric} onValueChange={v => setMetric(v as any)}>
            <SelectTrigger className="w-40 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(METRIC_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {serLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, METRIC_LABELS[metric]]} labelFormatter={l => `Date: ${l}`} />
                <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} dot={false} name={METRIC_LABELS[metric]} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top pages */}
        <Card className="border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Top Pages</CardTitle>
          </CardHeader>
          <CardContent>
            {tpLoading ? <Skeleton className="h-48 w-full" /> : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {(topPages ?? []).map((p, i) => (
                  <div key={p.path} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-400 w-5 text-right">{i + 1}</span>
                    <span className="flex-1 text-gray-700 truncate font-mono">{p.path}</span>
                    <span className="text-gray-500">{p.views.toLocaleString()} views</span>
                    <span className="text-gray-400">{p.uniqueUsers} users</span>
                  </div>
                ))}
                {!topPages?.length && <p className="text-gray-400 text-xs text-center py-4">No data yet</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top courses */}
        <Card className="border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Top Courses</CardTitle>
          </CardHeader>
          <CardContent>
            {tcLoading ? <Skeleton className="h-48 w-full" /> : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {(topCourses ?? []).map((c, i) => (
                  <div key={c.courseId} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-400 w-5 text-right">{i + 1}</span>
                    <span className="flex-1 text-gray-700 truncate">{c.courseTitle}</span>
                    <span className="text-teal-600">{c.videoPlays} plays</span>
                    <span className="text-orange-500">{c.videoCompletes} done</span>
                    {c.avgQuizScore != null && <span className="text-pink-500">{c.avgQuizScore}% avg</span>}
                  </div>
                ))}
                {!topCourses?.length && <p className="text-gray-400 text-xs text-center py-4">No data yet</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── User List Tab ────────────────────────────────────────────────────────────
type SortKey = "lastLogin" | "logins" | "pageViews" | "videoPlays" | "quizAttempts" | "downloads" | "name";

function UserListTab({ onSelectUser, initialSearch = "" }: { onSelectUser: (id: number) => void; initialSearch?: string }) {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>("lastLogin");
  const PAGE_SIZE = 25;

  // Debounce search
  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._searchTimer);
    (window as any)._searchTimer = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 400);
  };

  const { data, isLoading } = trpc.analyticsAdmin.userList.useQuery({
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
    sortBy,
  });

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "lastLogin", label: "Last Login" },
    { value: "logins", label: "Login Count" },
    { value: "pageViews", label: "Page Views" },
    { value: "videoPlays", label: "Video Plays" },
    { value: "quizAttempts", label: "Quiz Attempts" },
    { value: "downloads", label: "Downloads" },
    { value: "name", label: "Name A–Z" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={sortBy} onValueChange={v => { setSortBy(v as SortKey); setPage(1); }}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && <span className="text-sm text-gray-400">{data.total.toLocaleString()} users</span>}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">User</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Last Login</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Logins</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Pages</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Videos</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Quizzes</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Avg Score</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Downloads</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Courses</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={10} className="px-4 py-2"><Skeleton className="h-8 w-full" /></td></tr>
                ))
              ) : (data?.users ?? []).map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onSelectUser(u.id)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-semibold flex-shrink-0">
                        {(u.name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-[160px]">{u.name || "—"}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-gray-500 whitespace-nowrap">{fmtDate(u.lastLogin)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-xs font-medium ${u.loginCount > 0 ? "text-blue-600" : "text-gray-300"}`}>{u.loginCount}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-xs font-medium ${u.pageViewCount > 0 ? "text-teal-600" : "text-gray-300"}`}>{u.pageViewCount}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-xs font-medium ${u.videoPlayCount > 0 ? "text-orange-600" : "text-gray-300"}`}>{u.videoPlayCount}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-xs font-medium ${u.quizAttemptCount > 0 ? "text-pink-600" : "text-gray-300"}`}>{u.quizAttemptCount}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {u.avgQuizScore != null ? (
                      <span className={`text-xs font-medium ${u.avgQuizScore >= 70 ? "text-green-600" : "text-red-500"}`}>{u.avgQuizScore}%</span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-xs font-medium ${u.downloadCount > 0 ? "text-green-600" : "text-gray-300"}`}>{u.downloadCount}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-xs text-gray-500">{u.completedCourseCount}/{u.enrollmentCount}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-teal-600 hover:bg-teal-50 px-2"
                        onClick={(e) => { e.stopPropagation(); onSelectUser(u.id); }}>
                        Analytics
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-teal-600 hover:bg-teal-50 px-2"
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/users/${u.id}`); }}>
                        Manage →
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.users.length && (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400 text-sm">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {(data?.total ?? 0) > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data?.total ?? 0)} of {data?.total ?? 0}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page * PAGE_SIZE >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserDetailView({ userId, onBack }: { userId: number; onBack: () => void }) {
  const { data, isLoading, refetch } = trpc.analyticsAdmin.userDetail.useQuery({ userId });
  const [tab, setTab] = useState("overview");
  const [unenrollTarget, setUnenrollTarget] = useState<{ enrollmentId: number; courseTitle: string } | null>(null);
  const removeEnrollment = trpc.lmsAdmin.removeEnrollment.useMutation({
    onSuccess: () => { toast.success("Student unenrolled successfully"); setUnenrollTarget(null); refetch(); },
    onError: e => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
  if (!data) return <p className="text-gray-400 text-sm">User not found.</p>;

  const { user, logins, pageViewsByPath, enrollments, quizAttempts, videoSummary, downloads } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-500">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold">
            {(user.name || user.email || "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.name || "—"}</p>
            <p className="text-xs text-gray-400">{user.email} · Joined {fmtDate(user.createdAt)}</p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">{user.role}</Badge>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Card className="border border-gray-200"><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{logins.length}</p>
          <p className="text-xs text-gray-500">Logins (last 50)</p>
        </CardContent></Card>
        <Card className="border border-gray-200"><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-teal-600">{pageViewsByPath.reduce((s, p) => s + p.views, 0)}</p>
          <p className="text-xs text-gray-500">Page Views</p>
        </CardContent></Card>
        <Card className="border border-gray-200"><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-orange-600">{videoSummary.reduce((s, v) => s + v.playCount, 0)}</p>
          <p className="text-xs text-gray-500">Video Plays</p>
        </CardContent></Card>
        <Card className="border border-gray-200"><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-pink-600">{quizAttempts.length}</p>
          <p className="text-xs text-gray-500">Quiz Attempts</p>
        </CardContent></Card>
        <Card className="border border-gray-200"><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-green-600">{downloads.length}</p>
          <p className="text-xs text-gray-500">Downloads</p>
        </CardContent></Card>
        <Card className="border border-gray-200"><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-teal-600">{enrollments.filter(e => e.completedAt).length}/{enrollments.length}</p>
          <p className="text-xs text-gray-500">Courses Done</p>
        </CardContent></Card>
      </div>

      {/* Detail tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="overview" className="text-xs">Courses</TabsTrigger>
          <TabsTrigger value="videos" className="text-xs">Videos</TabsTrigger>
          <TabsTrigger value="quizzes" className="text-xs">Quizzes</TabsTrigger>
          <TabsTrigger value="pages" className="text-xs">Pages</TabsTrigger>
          <TabsTrigger value="logins" className="text-xs">Logins</TabsTrigger>
          <TabsTrigger value="downloads" className="text-xs">Downloads</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">Activity Log</TabsTrigger>
        </TabsList>

        {/* Courses */}
        <TabsContent value="overview">
          <Card className="border border-gray-200">
            <CardContent className="p-0">
              {enrollments.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No course enrollments</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Course</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Enrolled</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Progress</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Videos Done</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Quizzes</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Avg Score</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Completed</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {enrollments.map(e => (
                      <tr key={e.enrollmentId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[200px] truncate">{e.courseTitle}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-500">{fmtDate(e.enrolledAt)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-teal-500 rounded-full" style={{ width: `${e.progressPct}%` }} />
                            </div>
                            <span className="text-xs text-gray-600">{e.progressPct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-orange-600">{e.videosCompleted}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-pink-600">{e.quizAttempts}</td>
                        <td className="px-3 py-2.5 text-right text-xs">
                          {e.avgQuizScore != null ? (
                            <span className={e.avgQuizScore >= 70 ? "text-green-600" : "text-red-500"}>{e.avgQuizScore}%</span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {e.completedAt ? (
                            <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-300 ml-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                            title="Unenroll from this course"
                            onClick={() => setUnenrollTarget({ enrollmentId: e.enrollmentId, courseTitle: e.courseTitle })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Videos */}
        <TabsContent value="videos">
          <Card className="border border-gray-200">
            <CardContent className="p-0">
              {videoSummary.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No video activity yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Lesson</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Course</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Plays</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Max Watched</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Completed</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Last Watched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {videoSummary.map(v => (
                      <tr key={v.lessonId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[160px] truncate">{v.lessonTitle}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[120px] truncate">{v.courseTitle}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-orange-600">{v.playCount}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-400 rounded-full" style={{ width: `${v.maxPctWatched}%` }} />
                            </div>
                            <span className="text-xs text-gray-600">{v.maxPctWatched}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {v.completed ? <CheckCircle className="w-4 h-4 text-green-500 ml-auto" /> : <Clock className="w-4 h-4 text-gray-300 ml-auto" />}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-400">{fmtDate(v.lastWatched)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quizzes */}
        <TabsContent value="quizzes">
          <Card className="border border-gray-200">
            <CardContent className="p-0">
              {quizAttempts.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No quiz attempts yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Lesson</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Course</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Score</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Result</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Correct</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Time</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quizAttempts.map(q => (
                      <tr key={q.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[160px] truncate">{q.lessonTitle}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[120px] truncate">{q.courseTitle}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`text-sm font-bold ${q.score >= 70 ? "text-green-600" : "text-red-500"}`}>{q.score}%</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {q.passed ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">Passed</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 text-xs">Failed</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-500">{q.correctAnswers}/{q.totalQuestions}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-400">
                          {q.timeTakenSec != null ? `${Math.floor(q.timeTakenSec / 60)}m ${q.timeTakenSec % 60}s` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-400">{fmtDateTime(q.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Page views */}
        <TabsContent value="pages">
          <Card className="border border-gray-200">
            <CardContent className="p-0">
              {pageViewsByPath.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No page view data yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Page Path</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Views</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Last Visited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageViewsByPath.map(p => (
                      <tr key={p.path} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{p.path}</td>
                        <td className="px-3 py-2.5 text-right text-sm font-medium text-teal-600">{p.views}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-400">{fmtDate(p.lastViewed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Login history */}
        <TabsContent value="logins">
          <Card className="border border-gray-200">
            <CardContent className="p-0">
              {logins.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No login history yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Date & Time</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logins.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm text-gray-700">{fmtDateTime(l.createdAt)}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{l.ipAddress || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Downloads */}
        <TabsContent value="downloads">
          <Card className="border border-gray-200">
            <CardContent className="p-0">
              {downloads.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No downloads yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Product</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Downloaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {downloads.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{d.productTitle}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-400">{fmtDateTime(d.downloadedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log */}
        <TabsContent value="activity">
          <ActivityLogTab userId={userId} userName={user.name || user.email || 'User'} />
        </TabsContent>

      </Tabs>

      {/* Unenroll Confirmation Dialog */}
      <Dialog open={!!unenrollTarget} onOpenChange={(v) => { if (!v) setUnenrollTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Unenroll Student?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600">
              This will remove <strong>{data?.user?.name || data?.user?.email}</strong> from
              <strong> {unenrollTarget?.courseTitle}</strong>.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Their progress data will be preserved but they will lose access to the course.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnenrollTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => unenrollTarget && removeEnrollment.mutate({ id: unenrollTarget.enrollmentId })}
              disabled={removeEnrollment.isPending}
            >
              {removeEnrollment.isPending ? "Removing..." : "Yes, Unenroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Activity Log Tab ─────────────────────────────────────────────────────────
function ActivityLogTab({ userId, userName }: { userId: number; userName: string }) {
  const [page, setPage] = useState(1);
  const [eventFilter, setEventFilter] = useState<string>("all_events");
  const pageSize = 50;

  const activeFilter = eventFilter === "all_events" ? undefined : eventFilter;

  const { data, isLoading } = trpc.analyticsAdmin.userActivityLog.useQuery({
    userId,
    page,
    pageSize,
    eventType: activeFilter,
  });

  const { data: csvData, isFetching: csvLoading, refetch: fetchCsv } = trpc.analyticsAdmin.exportUserActivityCsv.useQuery(
    { userId, eventType: activeFilter },
    { enabled: false }
  );

  const handleExportCsv = async () => {
    const result = await fetchCsv();
    if (result.data?.csv) {
      const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${userName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.data.totalRows} activity records`);
    }
  };

  const eventTypes = [
    { value: "all_events", label: "All Events" },
    { value: "page_view", label: "Page Views" },
    { value: "login", label: "Logins" },
    { value: "video_play", label: "Video Plays" },
    { value: "video_complete", label: "Video Completes" },
    { value: "quiz_attempt", label: "Quiz Attempts" },
    { value: "course_enroll", label: "Course Enrollments" },
    { value: "course_complete", label: "Course Completions" },
    { value: "download", label: "Downloads" },
    { value: "module_complete", label: "Module Completions" },
  ];

  const eventTypeColors: Record<string, string> = {
    page_view: "bg-teal-100 text-teal-700",
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

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-gray-900">Activity Log</CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              {data?.total ?? 0} total events{activeFilter ? ` (filtered: ${(activeFilter ?? '').replace(/_/g, ' ')})` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map(et => (
                  <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={handleExportCsv}
              disabled={csvLoading}
            >
              <Download className="w-3.5 h-3.5" />
              {csvLoading ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : !data?.logs.length ? (
          <p className="text-gray-400 text-sm text-center py-8">
            No activity logged yet. Activity will appear here as the user interacts with the platform.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Timestamp</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Event</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Description</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Path</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">IP Address</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                        {fmtDateTime(log.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={`text-xs ${eventTypeColors[log.eventType] || 'bg-gray-100 text-gray-700'}`}>
                          {(log.eventType ?? 'unknown').replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[200px] truncate" title={log.description}>
                        {log.description}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono max-w-[120px] truncate" title={log.path || ''}>
                        {log.path || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[150px] truncate" title={log.userAgent || ''}>
                        {log.userAgent ? log.userAgent.substring(0, 40) + (log.userAgent.length > 40 ? '...' : '') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages} ({data.total} total)
                </p>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function UserAnalytics() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const initialSearch = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") ?? "";
  }, []);
  const [mainTab, setMainTab] = useState(() => initialSearch ? "users" : "overview");
  const [dateRange, setDateRange] = useState("30d");

  const { from, to } = useMemo(() => {
    const t = new Date();
    const days = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : dateRange === "all" ? 3650 : 30;
    return { from: daysAgo(days), to: isoDate(t) };
  }, [dateRange]);

  if (selectedUserId) {
    return <UserDetailView userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
            <a href="/platform-admin" className="hover:text-teal-600 transition-colors">Platform Admin</a>
            <span>/</span>
            <span className="text-gray-600 font-medium">User Analytics</span>
          </nav>
          <h2 className="text-xl font-bold text-gray-900">User Analytics</h2>
          <p className="text-sm text-gray-500">Logins, page views, course activity, videos, quizzes, and downloads</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="overview" className="text-sm gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="text-sm gap-1.5">
            <Users className="w-3.5 h-3.5" /> Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab from={from} to={to} />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UserListTab onSelectUser={id => setSelectedUserId(id)} initialSearch={initialSearch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
