/**
 * MyTeamPage.tsx
 * Group Management Dashboard — matches the Group Enrollments reference design.
 * Dark sidebar nav · Group Overview stat cards · Activity line chart · Completion donut
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users, UserPlus, UserX, LayoutDashboard, BookOpen,
  Activity, BarChart2, RefreshCw, CheckCircle2, Clock,
  ChevronRight, Mail, TrendingUp, Award,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
  PieChart, Pie, Cell,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-xs">Active</Badge>;
  if (status === "pending") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Pending</Badge>;
  return <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Revoked</Badge>;
}

// ─── Assign Seat Dialog ───────────────────────────────────────────────────────
function AssignSeatDialog({ groupId, open, onClose, onAssigned }: {
  groupId: number; open: boolean; onClose: () => void; onAssigned: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const assign = trpc.lmsTeamManager.assignSeat.useMutation({
    onSuccess: () => { toast.success("Seat assigned — invite sent"); setEmail(""); setName(""); onAssigned(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign a Seat</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email address *</label>
            <Input type="email" placeholder="member@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Name (optional)</label>
            <Input placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!email || assign.isPending}
            onClick={() => assign.mutate({ groupId, email, memberName: name || undefined })}>
            {assign.isPending ? "Assigning…" : "Assign Seat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────
function CompletionDonut({ pct }: { pct: number }) {
  const data = [{ value: pct }, { value: 100 - pct }];
  return (
    <div className="relative w-28 h-28">
      <PieChart width={112} height={112}>
        <Pie data={data} cx={52} cy={52} innerRadius={36} outerRadius={52} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
          <Cell fill="#189aa1" />
          <Cell fill="#e5f7f8" />
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-800">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

// ─── Group Dashboard ──────────────────────────────────────────────────────────
type NavSection = "dashboard" | "members" | "activity" | "reports";

function GroupDashboard({ group }: { group: any }) {
  const [nav, setNav] = useState<NavSection>("dashboard");
  const [assignOpen, setAssignOpen] = useState(false);
  const utils = trpc.useUtils();
  const refresh = () => utils.lmsTeamManager.getMyManagedGroups.invalidate();

  const { data: analytics, isLoading: analyticsLoading } = trpc.lmsTeamManager.getGroupAnalytics.useQuery(
    { groupId: group.id },
    { staleTime: 30_000 }
  );

  const activeSeats = (group.seatList ?? []).filter((s: any) => s.status === "active").length;
  const pendingSeats = (group.seatList ?? []).filter((s: any) => s.status === "pending").length;
  const totalAllocated = (group.courses ?? []).reduce((sum: number, c: any) => sum + (c.seats || 0), 0) || group.seats;
  const usedSeats = (group.seatList ?? []).filter((s: any) => s.status !== "revoked").length;
  const availableSeats = Math.max(0, totalAllocated - usedSeats);

  // Compute completion stats from analytics
  const completionPct = useMemo(() => {
    if (!analytics?.memberProgress?.length) return 0;
    const allEnrollments = analytics.memberProgress.flatMap((m: any) => m.enrollments);
    if (!allEnrollments.length) return 0;
    const completed = allEnrollments.filter((e: any) => e.completedAt || e.progress >= 100).length;
    return (completed / allEnrollments.length) * 100;
  }, [analytics]);

  const inProgressCount = useMemo(() => {
    if (!analytics?.memberProgress?.length) return 0;
    return analytics.memberProgress.flatMap((m: any) => m.enrollments)
      .filter((e: any) => e.progress > 0 && e.progress < 100 && !e.completedAt).length;
  }, [analytics]);

  const completedCount = useMemo(() => {
    if (!analytics?.memberProgress?.length) return 0;
    return analytics.memberProgress.flatMap((m: any) => m.enrollments)
      .filter((e: any) => e.completedAt || e.progress >= 100).length;
  }, [analytics]);

  // Real daily activity from analytics (last 30 days, condensed to last 14 for chart readability)
  const activityData = useMemo(() => {
    if (!analytics?.dailyActivity?.length) return [];
    // Show last 14 days for the dashboard chart, all 30 for the full Activity tab
    return analytics.dailyActivity.slice(-14).map((d: any) => ({
      day: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      date: d.date,
      activeUsers: d.activeUsers,
      lessonsCompleted: d.lessonsCompleted,
    }));
  }, [analytics]);

  const fullActivityData = useMemo(() => {
    if (!analytics?.dailyActivity?.length) return [];
    return analytics.dailyActivity.map((d: any) => ({
      day: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      date: d.date,
      activeUsers: d.activeUsers,
      lessonsCompleted: d.lessonsCompleted,
    }));
  }, [analytics]);

  const navItems: { id: NavSection; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "members", label: "Members", icon: Users },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "reports", label: "Reports", icon: BarChart2 },
  ];

  return (
    <div className="flex rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-white min-h-[480px]">
      {/* Dark Sidebar */}
      <div className="w-48 bg-[#0f2a35] flex flex-col shrink-0">
        {/* Group name header */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center mb-2">
            <Users className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-white text-sm font-semibold leading-tight truncate">{group.name}</p>
          {group.orgName && <p className="text-white/40 text-xs mt-0.5 truncate">{group.orgName}</p>}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setNav(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                nav === item.id
                  ? "bg-teal-500 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Seat usage footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-white/40 text-xs mb-1.5">Seat Usage</p>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-400 rounded-full transition-all"
              style={{ width: totalAllocated > 0 ? `${Math.min(100, (usedSeats / totalAllocated) * 100)}%` : "0%" }}
            />
          </div>
          <p className="text-white/50 text-xs mt-1">{usedSeats} / {totalAllocated} seats</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* ── Dashboard ── */}
        {nav === "dashboard" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Group Overview</h2>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8 px-3 text-xs"
                onClick={() => setAssignOpen(true)}>
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Assign Seat
              </Button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Active Users", value: activeSeats, icon: Users, ring: "ring-teal-200", iconBg: "bg-teal-50 text-teal-600" },
                { label: "In Progress", value: inProgressCount, icon: Clock, ring: "ring-amber-200", iconBg: "bg-amber-50 text-amber-600" },
                { label: "Completed", value: completedCount, icon: CheckCircle2, ring: "ring-green-200", iconBg: "bg-green-50 text-green-600" },
              ].map((s) => (
                <div key={s.label} className={`bg-white rounded-xl p-4 ring-1 ${s.ring} shadow-sm`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                      <s.icon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-5 gap-4">
              {/* Activity line chart */}
              <div className="col-span-3 bg-white rounded-xl p-4 ring-1 ring-gray-100 shadow-sm">
                <p className="text-sm font-semibold text-gray-700 mb-3">User Activity</p>
<ResponsiveContainer width="100%" height={140}>
                  {activityData.length > 0 ? (
                    <AreaChart data={activityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#189aa1" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#189aa1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={3} />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                        formatter={(val: any, name: string) => [val, name === 'activeUsers' ? 'Active Users' : 'Lessons Completed']} />
                      <Area type="monotone" dataKey="activeUsers" stroke="#189aa1" strokeWidth={2} fill="url(#actGrad)" dot={{ r: 3, fill: "#189aa1" }} activeDot={{ r: 5 }} />
                      <Area type="monotone" dataKey="lessonsCompleted" stroke="#4ad9e0" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
                    </AreaChart>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">No activity data yet</div>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Completion donut */}
              <div className="col-span-2 bg-white rounded-xl p-4 ring-1 ring-gray-100 shadow-sm flex flex-col items-center justify-center">
                <p className="text-sm font-semibold text-gray-700 mb-3 self-start">Completion</p>
                <CompletionDonut pct={completionPct} />
                <p className="text-xs text-gray-400 mt-2">{completedCount} of {completedCount + inProgressCount} enrolled</p>
              </div>
            </div>

            {/* Courses enrolled */}
            {analytics?.courses && analytics.courses.length > 0 && (
              <div className="bg-white rounded-xl p-4 ring-1 ring-gray-100 shadow-sm">
                <p className="text-sm font-semibold text-gray-700 mb-3">Enrolled Courses</p>
                <div className="space-y-2">
                  {analytics.courses.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                        <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                      </div>
                      <span className="flex-1 text-sm text-gray-800 truncate">{c.courseTitle ?? "Untitled"}</span>
                      <span className="text-xs text-gray-400 shrink-0">{c.seats} seat{c.seats !== 1 ? "s" : ""}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Members ── */}
        {nav === "members" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Members</h2>
              {availableSeats > 0 && (
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8 px-3 text-xs"
                  onClick={() => setAssignOpen(true)}>
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Assign Seat
                </Button>
              )}
            </div>

            {/* Seat summary pills */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "Active", count: activeSeats, color: "bg-teal-50 text-teal-700 ring-teal-200" },
                { label: "Pending", count: pendingSeats, color: "bg-amber-50 text-amber-700 ring-amber-200" },
                { label: "Available", count: availableSeats, color: "bg-blue-50 text-blue-700 ring-blue-200" },
              ].map((p) => (
                <div key={p.label} className={`flex items-center gap-1.5 px-3 py-1 rounded-full ring-1 text-xs font-medium ${p.color}`}>
                  <span>{p.count}</span>
                  <span>{p.label}</span>
                </div>
              ))}
            </div>

            {/* Member list */}
            {(group.seatList ?? []).length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No members yet.</p>
                <Button size="sm" variant="outline" className="mt-3 text-teal-600 border-teal-200 hover:bg-teal-50"
                  onClick={() => setAssignOpen(true)}>
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Assign First Seat
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {(group.seatList ?? [])
                  .filter((s: any) => s.status !== "revoked")
                  .map((seat: any) => (
                    <MemberRow key={seat.id} seat={seat} groupId={group.id} onRefresh={refresh} />
                  ))}
                {(group.seatList ?? []).filter((s: any) => s.status === "revoked").length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                      Show revoked ({(group.seatList ?? []).filter((s: any) => s.status === "revoked").length})
                    </summary>
                    <div className="mt-1 space-y-1 opacity-60">
                      {(group.seatList ?? []).filter((s: any) => s.status === "revoked")
                        .map((seat: any) => (
                          <MemberRow key={seat.id} seat={seat} groupId={group.id} onRefresh={refresh} />
                        ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Activity ── */}
        {nav === "activity" && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-gray-900">User Activity</h2>
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
<div className="bg-white rounded-xl p-5 ring-1 ring-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-gray-700">30-Day Engagement</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#189aa1] inline-block rounded" /> Active Users</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#4ad9e0] inline-block rounded border-dashed border-t border-[#4ad9e0]" /> Lessons Completed</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    {fullActivityData.length > 0 ? (
                      <AreaChart data={fullActivityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="actGrad2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#189aa1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#189aa1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={4} />
                        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                          formatter={(val: any, name: string) => [val, name === 'activeUsers' ? 'Active Users' : 'Lessons Completed']} />
                        <Area type="monotone" dataKey="activeUsers" stroke="#189aa1" strokeWidth={2.5} fill="url(#actGrad2)" dot={{ r: 3, fill: "#189aa1" }} activeDot={{ r: 6 }} />
                        <Area type="monotone" dataKey="lessonsCompleted" stroke="#4ad9e0" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
                      </AreaChart>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">No activity data yet — members haven't started their courses.</div>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Per-member progress */}
                {analytics?.memberProgress && analytics.memberProgress.length > 0 && (
                  <div className="bg-white rounded-xl p-5 ring-1 ring-gray-100 shadow-sm">
                    <p className="text-sm font-semibold text-gray-700 mb-4">Member Progress</p>
                    <div className="space-y-4">
                      {analytics.memberProgress.map((m: any) => (
                        <div key={m.userId}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-teal-700">
                                {(m.name || m.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-800 truncate">{m.name || m.email}</span>
                          </div>
                          {m.enrollments.map((e: any) => {
                            const course = analytics.courses?.find((c: any) => c.courseId === e.courseId);
                            return (
                              <div key={e.courseId} className="ml-9 mb-2">
                                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                  <span className="truncate">{course?.courseTitle ?? `Course #${e.courseId}`}</span>
                                  <span className="shrink-0 ml-2 font-semibold text-teal-700">{Math.round(e.progress)}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-teal-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, e.progress)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {m.enrollments.length === 0 && (
                            <p className="ml-9 text-xs text-gray-400 italic">Not yet enrolled</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Reports ── */}
        {nav === "reports" && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-gray-900">Reports</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Total Seats", value: totalAllocated, icon: Users, color: "text-teal-600 bg-teal-50 ring-teal-200" },
                { label: "Active Members", value: activeSeats, icon: CheckCircle2, color: "text-green-600 bg-green-50 ring-green-200" },
                { label: "Completion Rate", value: `${Math.round(completionPct)}%`, icon: Award, color: "text-purple-600 bg-purple-50 ring-purple-200" },
                { label: "In Progress", value: inProgressCount, icon: TrendingUp, color: "text-amber-600 bg-amber-50 ring-amber-200" },
              ].map((s) => (
                <div key={s.label} className={`bg-white rounded-xl p-5 ring-1 shadow-sm ${s.color.split(" ")[2]}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color.split(" ").slice(1).join(" ")}`}>
                    <s.icon className={`w-5 h-5 ${s.color.split(" ")[0]}`} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Completion donut centered */}
            <div className="bg-white rounded-xl p-6 ring-1 ring-gray-100 shadow-sm flex flex-col items-center">
              <p className="text-sm font-semibold text-gray-700 mb-4 self-start">Overall Completion</p>
              <CompletionDonut pct={completionPct} />
<p className="text-xs text-gray-400 mt-3">
                {completedCount} completed · {inProgressCount} in progress
                {analytics?.memberProgress?.length ? ` · ${Math.max(0, analytics.memberProgress.length - completedCount - inProgressCount)} not started` : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      <AssignSeatDialog groupId={group.id} open={assignOpen} onClose={() => setAssignOpen(false)} onAssigned={refresh} />
    </div>
  );
}

// ─── Member Row ───────────────────────────────────────────────────────────────
function MemberRow({ seat, groupId, onRefresh }: { seat: any; groupId: number; onRefresh: () => void }) {
  const revoke = trpc.lmsTeamManager.revokeSeat.useMutation({
    onSuccess: () => { toast.success("Seat revoked"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const resend = trpc.lmsTeamManager.resendInvite.useMutation({
    onSuccess: () => { toast.success("Invite resent"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-teal-700">
          {(seat.memberName || seat.email).charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{seat.memberName || seat.email}</p>
        {seat.memberName && <p className="text-xs text-gray-500 truncate">{seat.email}</p>}
      </div>
      <div className="shrink-0">{statusBadge(seat.status)}</div>
      <div className="flex items-center gap-1 shrink-0">
        {seat.status === "pending" && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            disabled={resend.isPending} onClick={() => resend.mutate({ seatId: seat.id })}>
            <RefreshCw className="w-3 h-3 mr-1" />Resend
          </Button>
        )}
        {seat.status !== "revoked" && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
            disabled={revoke.isPending}
            onClick={() => { if (confirm(`Revoke seat for ${seat.email}?`)) revoke.mutate({ seatId: seat.id }); }}>
            <UserX className="w-3 h-3 mr-1" />Revoke
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyTeamPage() {
  const { user } = useAuth();
  const { data: groups = [], isLoading } = trpc.lmsTeamManager.getMyManagedGroups.useQuery();
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <p>Please sign in to view your team.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" />
            Group Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage member access and track progress for your enrolled groups.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium text-gray-500">No teams assigned</p>
          <p className="text-sm mt-1">Contact your administrator to be added as a team manager.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Group selector tabs when multiple groups */}
          {groups.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {groups.map((g: any, i: number) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupIdx(i)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedGroupIdx === i
                      ? "bg-teal-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
          <GroupDashboard group={groups[selectedGroupIdx] ?? groups[0]} />
        </div>
      )}
    </div>
  );
}
