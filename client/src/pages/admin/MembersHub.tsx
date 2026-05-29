/**
 * MembersHub.tsx — Unified Members Administration (LearnPro-style)
 *
 * Left sidebar navigation with sections:
 *   Members: Overview, All Members, Enrollments, Invitations, Import
 *   Engagement: Activity, Communications, Certificates
 *   Analytics: Sales, Product Analytics, Memberships, Contacts
 *   Settings
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, BookOpen, DollarSign, Crown, Mail, Activity,
  Search, Download, CheckCircle, Clock, TrendingUp,
  ExternalLink, GraduationCap, Shield, BarChart3,
  UserPlus, Settings, Award, ChevronRight, ChevronLeft,
  LayoutDashboard, UserCheck, Upload,
  MessageSquare, ArrowUpRight, ArrowDownRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import AdminSalesDashboard from "./AdminSalesDashboard";
import MembershipAdmin from "./MembershipAdmin";
import ContactsAdmin from "./ContactsAdmin";
import UserAnalytics from "./UserAnalytics";
import ProductAnalytics from "./ProductAnalytics";
import SharingMonitor from "./SharingMonitor";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtRelative(d: Date | null | undefined) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return fmtDate(d);
}
function initials(name: string) {
  return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Sidebar Nav Config ───────────────────────────────────────────────────────
type NavItem = { id: string; label: string; icon: React.ReactNode; section?: string };
const NAV_ITEMS: NavItem[] = [
  { id: "overview",          label: "Overview",          icon: <LayoutDashboard size={16} />, section: "Members" },
  { id: "all-members",       label: "All Members",       icon: <Users size={16} /> },
  { id: "enrollments",       label: "Enrollments",       icon: <BookOpen size={16} /> },
  { id: "invitations",       label: "Invitations",       icon: <UserPlus size={16} /> },
  { id: "import",            label: "Import",            icon: <Upload size={16} /> },
  { id: "activity",          label: "Activity",          icon: <Activity size={16} />, section: "Engagement" },
  { id: "communications",    label: "Communications",    icon: <MessageSquare size={16} /> },
  { id: "certificates",      label: "Certificates",      icon: <Award size={16} /> },
  { id: "sales",             label: "Sales",             icon: <DollarSign size={16} />, section: "Analytics" },
  { id: "product-analytics", label: "Product Analytics", icon: <BarChart3 size={16} /> },
  { id: "memberships",       label: "Memberships",       icon: <Crown size={16} /> },
  { id: "contacts",          label: "Contacts",          icon: <Mail size={16} /> },
  { id: "sharing-monitor",   label: "Sharing Monitor",   icon: <Shield size={16} /> },
  { id: "settings",          label: "Settings",          icon: <Settings size={16} />, section: "Settings" },
];

const STATUS_COLORS = ["#14b8a6", "#94a3b8", "#f59e0b"];

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, trend, trendLabel, color = "teal",
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; trend?: "up" | "down" | "neutral"; trendLabel?: string;
  color?: "teal" | "blue" | "purple" | "amber";
}) {
  const colorMap: Record<string, string> = {
    teal:   "bg-teal-50 text-teal-600",
    blue:   "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    amber:  "bg-amber-50 text-amber-600",
  };
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>{icon}</div>
        </div>
        {trendLabel && (
          <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${
            trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-500"
          }`}>
            {trend === "up" ? <ArrowUpRight size={13} /> : trend === "down" ? <ArrowDownRight size={13} /> : null}
            {trendLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{value}%</span>
    </div>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────
function OverviewPanel() {
  const { data, isLoading, refetch } = trpc.adminUser.getMemberOverview.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const stats = data?.stats;
  const growth = data?.memberGrowth ?? [];
  const statusBreakdown = data?.statusBreakdown ?? [];
  const recentMembers = data?.recentMembers ?? [];
  const recentActivity = data?.recentActivity ?? [];

  const newDelta = (stats?.newThisMonth ?? 0) - (stats?.newLastMonth ?? 0);
  const newTrend: "up" | "down" | "neutral" = newDelta > 0 ? "up" : newDelta < 0 ? "down" : "neutral";
  const newTrendLabel = newDelta === 0
    ? "Same as last month"
    : `${Math.abs(newDelta)} ${newDelta > 0 ? "more" : "fewer"} than last month`;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Members"
          value={(stats?.totalMembers ?? 0).toLocaleString()}
          icon={<Users size={18} />}
          color="teal"
        />
        <StatCard
          label="Active (30d)"
          value={(stats?.activeMembers ?? 0).toLocaleString()}
          sub={`${stats?.engagementRate ?? 0}% engagement rate`}
          icon={<UserCheck size={18} />}
          color="blue"
        />
        <StatCard
          label="New This Month"
          value={(stats?.newThisMonth ?? 0).toLocaleString()}
          icon={<TrendingUp size={18} />}
          trend={newTrend}
          trendLabel={newTrendLabel}
          color="purple"
        />
        <StatCard
          label="Course Completions"
          value={(stats?.totalCompletions ?? 0).toLocaleString()}
          icon={<GraduationCap size={18} />}
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Member Growth Chart */}
        <Card className="xl:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Member Growth (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            {growth.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={growth} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v: number) => [v, "New Members"]}
                  />
                  <Line type="monotone" dataKey="count" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 4, fill: "#14b8a6" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Donut */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Members by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusBreakdown.every((s: any) => s.count === 0) ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="status"
                    paddingAngle={3}
                  >
                    {statusBreakdown.map((_: any, i: number) => (
                      <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Members + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent Members Table */}
        <Card className="xl:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700">Recent Members</CardTitle>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 text-xs h-7 px-2">
                View all <ChevronRight size={13} className="ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentMembers.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-400 text-sm">No members yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentMembers.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={m.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-semibold">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/users/${m.id}`}>
                          <span className="text-sm font-medium text-slate-800 hover:text-teal-600 cursor-pointer truncate">
                            {m.name}
                          </span>
                        </Link>
                        {m.enrollmentCount > 0 && (
                          <Badge variant="outline" className="text-xs h-4 px-1.5 border-slate-200 text-slate-500">
                            {m.enrollmentCount} course{m.enrollmentCount !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{m.email}</p>
                      {m.enrollmentCount > 0 && <ProgressBar value={m.progress} />}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-500">{fmtDate(m.createdAt)}</p>
                      <p className="text-xs text-slate-400">{fmtRelative(m.lastSignedIn)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-400 text-sm">No activity yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentActivity.map((a: any, i: number) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    enrollment:  <BookOpen size={13} className="text-teal-500" />,
                    completion:  <CheckCircle size={13} className="text-emerald-500" />,
                    certificate: <Award size={13} className="text-amber-500" />,
                  };
                  const labelMap: Record<string, string> = {
                    enrollment:  "enrolled in",
                    completion:  "completed",
                    certificate: "earned certificate for",
                  };
                  return (
                    <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                      <div className="mt-0.5 p-1.5 bg-slate-100 rounded-full flex-shrink-0">
                        {iconMap[a.type] ?? <Activity size={13} className="text-slate-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-snug">
                          <span className="font-medium">{a.userName}</span>{" "}
                          <span className="text-slate-500">{labelMap[a.type] ?? a.type}</span>{" "}
                          <span className="font-medium">{a.subject}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtRelative(a.occurredAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/users">
              <Button variant="outline" size="sm" className="text-xs gap-1.5 border-slate-200">
                <Users size={13} /> View All Members
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-slate-200"
              onClick={() => toast.info("Import feature coming soon")}
            >
              <Upload size={13} /> Import Members
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-slate-200"
              onClick={() => toast.info("Bulk email feature coming soon")}
            >
              <Mail size={13} /> Send Bulk Email
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-slate-200"
              onClick={() => refetch()}
            >
              <RefreshCw size={13} /> Refresh Stats
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── All Members Panel ────────────────────────────────────────────────────────
function AllMembersPanel() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.adminUser.listMembers.useQuery(
    { search: search || undefined, status, page, pageSize: 25 },
    { keepPreviousData: true } as any
  );

  const members = data?.members ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm border-slate-200"
          />
        </div>
        <Select value={status} onValueChange={(v: any) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            <SelectItem value="active">Active (30d)</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500">{total.toLocaleString()} total</span>
      </div>

      {/* Table */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Courses</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td>
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">No members found</td>
                </tr>
              ) : members.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={m.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-semibold">
                          {initials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{m.name}</p>
                        <p className="text-xs text-slate-400 truncate">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`text-xs ${m.role === "admin" ? "border-purple-200 text-purple-700 bg-purple-50" : "border-slate-200 text-slate-600"}`}
                    >
                      {m.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.enrollmentCount}</td>
                  <td className="px-4 py-3 w-32">
                    {m.enrollmentCount > 0 ? <ProgressBar value={m.progress} /> : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(m.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtRelative(m.lastSignedIn)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${m.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-teal-600">
                        <ExternalLink size={13} />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-slate-200" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-slate-200" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Placeholder Panel ────────────────────────────────────────────────────────
function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="p-4 bg-slate-100 rounded-full mb-4">
        <Clock size={24} className="text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700">{title}</h3>
      <p className="text-sm text-slate-400 mt-1 max-w-xs">{description}</p>
      <Badge variant="outline" className="mt-3 text-xs border-slate-200 text-slate-500">Coming Soon</Badge>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MembersHub() {
  const [activeNav, setActiveNav] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const pageTitle = NAV_ITEMS.find(n => n.id === activeNav)?.label ?? "Members";

  function renderContent() {
    switch (activeNav) {
      case "overview":          return <OverviewPanel />;
      case "all-members":       return <AllMembersPanel />;
      case "enrollments":       return <UserAnalytics />;
      case "invitations":       return <PlaceholderPanel title="Invitations" description="Send and manage member invitations. Track invite status and acceptance rates." />;
      case "import":            return <PlaceholderPanel title="Import Members" description="Bulk import members from CSV or connect your existing platform." />;
      case "activity":          return <UserAnalytics />;
      case "communications":    return <ContactsAdmin />;
      case "certificates":      return <PlaceholderPanel title="Certificates" description="View and manage all issued certificates across courses." />;
      case "sales":             return <AdminSalesDashboard />;
      case "product-analytics": return <ProductAnalytics />;
      case "memberships":       return <MembershipAdmin />;
      case "contacts":          return <ContactsAdmin />;
      case "sharing-monitor":   return <SharingMonitor />;
      case "settings":          return <PlaceholderPanel title="Member Settings" description="Configure member registration, approval workflows, and access rules." />;
      default:                  return <OverviewPanel />;
    }
  }

  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      {/* Sidebar */}
      <aside className={`flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ${sidebarCollapsed ? "w-14" : "w-56"}`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold text-slate-700 truncate">Members</span>
          )}
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-auto"
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item, idx) => {
            const isActive = activeNav === item.id;
            const showSection = !sidebarCollapsed && item.section && (idx === 0 || NAV_ITEMS[idx - 1].section !== item.section);
            return (
              <div key={item.id}>
                {showSection && (
                  <p className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {item.section}
                  </p>
                )}
                <button
                  onClick={() => setActiveNav(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                    ${isActive
                      ? "bg-teal-50 text-teal-700 font-medium border-r-2 border-teal-500"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    }
                    ${sidebarCollapsed ? "justify-center" : ""}
                  `}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold text-slate-800">{pageTitle}</h1>
          <div className="flex items-center gap-2">
            {activeNav === "all-members" && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 border-slate-200 h-8"
                onClick={() => toast.info("Export feature coming soon")}
              >
                <Download size={13} /> Export
              </Button>
            )}
            {activeNav === "overview" && (
              <Link href="/admin/users">
                <Button size="sm" className="text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 h-8">
                  <Users size={13} /> All Members
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
