/**
 * MembersHub.tsx — Unified Members Administration (LearnPro-style)
 *
 * Left sidebar navigation with sections:
 *   Members: Overview, All Members, Enrollments, Invitations, Import
 *   Engagement: Activity, Communications, Certificates
 *   Analytics: Sales, Product Analytics, Memberships, Contacts
 *   Settings
 */
import { useState, useEffect, lazy, Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Users, BookOpen, DollarSign, Crown, Mail, Activity,
  Search, Download, CheckCircle, Clock, TrendingUp,
  ExternalLink, GraduationCap, Shield, BarChart3,
  UserPlus, Settings, Award, ChevronRight, ChevronLeft,
  LayoutDashboard, UserCheck, Upload,
  MessageSquare, ArrowUpRight, ArrowDownRight,
  RefreshCw, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { getAdminUrl } from "@/hooks/useSubdomain";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import AdminSalesDashboard from "./AdminSalesDashboard";
import MembershipAdmin from "./MembershipAdmin";
import ContactsAdmin from "./ContactsAdmin";
import ProductAnalytics from "./ProductAnalytics";
import SharingMonitor from "./SharingMonitor";
const SdmsCmeExportPageLazy = lazy(() => import("./SdmsCmeExportPage"));
function SdmsCmeExportInline() {
  return <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading SDMS CME Export…</div>}><SdmsCmeExportPageLazy /></Suspense>;
}

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
  { id: "sdms-cme",          label: "SDMS CME Export",   icon: <ExternalLink size={16} /> },
  { id: "settings",          label: "Settings",          icon: <Settings size={16} />, section: "Settings" },
];

const STATUS_COLORS = ["#14b8a6", "#94a3b8", "#f59e0b"];

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, trend, trendLabel, color = "teal",
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; trend?: "up" | "down" | "neutral"; trendLabel?: string;
  color?: "teal" | "blue" | "teal2" | "amber";
}) {
  const colorMap: Record<string, string> = {
    teal:   "bg-teal-50 text-teal-600",
    blue:   "bg-blue-50 text-blue-600",
    teal2: "bg-teal-50 text-teal-500",
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
          label="Verified Members"
          value={(stats?.totalMembers ?? 0).toLocaleString()}
          sub={`${(stats?.migratedRecords ?? 0).toLocaleString()} migrated or unverified records`}
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
          label="New Verified This Month"
          value={(stats?.newThisMonth ?? 0).toLocaleString()}
          icon={<TrendingUp size={18} />}
          trend={newTrend}
          trendLabel={newTrendLabel}
          color="teal2"
        />
        <StatCard
          label="Recorded Revenue"
          value={`$${((stats?.totalRevenueCents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`Paid LMS orders + checkout purchases · ${(stats?.totalCompletions ?? 0).toLocaleString()} completed enrollments`}
          icon={<DollarSign size={18} />}
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Member Growth Chart */}
        <Card className="xl:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Verified Account Growth (6 months)</CardTitle>
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
                    formatter={(v: number) => [v, "New Verified Members"]}
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
            <CardTitle className="text-sm font-semibold text-slate-700">Member Records by Status</CardTitle>
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
            <a href={getAdminUrl("/admin/members?tab=all-members")}>
              <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 text-xs h-7 px-2">
                View all <ChevronRight size={13} className="ml-1" />
              </Button>
            </a>
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
                        <a href={getAdminUrl(`/admin/users/${m.id}`)}>
                          <span className="text-sm font-medium text-slate-800 hover:text-teal-600 cursor-pointer truncate">
                            {m.name}
                          </span>
                        </a>
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
            <a href={getAdminUrl("/admin/members?tab=all-members")}>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 border-slate-200">
                <Users size={13} /> View All Members
              </Button>
            </a>
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
function AllMembersPanel({ openCreateSignal, onCreateConsumed }: { openCreateSignal?: number; onCreateConsumed?: () => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<{ id: number; type: "download" | "bundle"; title: string }[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);

  useEffect(() => {
    if (openCreateSignal) { setCreateOpen(true); onCreateConsumed?.(); }
  }, [openCreateSignal, onCreateConsumed]);

  const { data, isLoading } = trpc.adminUser.listMembers.useQuery(
    { search: search || undefined, status, page, pageSize: 25 },
    { keepPreviousData: true } as any
  );

  const members = data?.members ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const coursesQuery = trpc.lmsAdmin.listCourses.useQuery({ status: "all", type: "all", page: 1, pageSize: 200 }, { enabled: createOpen });
  const productsQuery = trpc.productAnalytics.listAllProductsWithStats.useQuery({ type: "all" }, { enabled: createOpen });
  const membershipsQuery = trpc.membership.listAll.useQuery(undefined, { enabled: createOpen });
  const utils = trpc.useUtils();
  const createMember = trpc.lmsAdmin.createMember.useMutation();
  const createAndEnroll = trpc.lmsAdmin.createAndEnrollUser.useMutation();
  const grantAccess = trpc.productAnalytics.grantProductAccess.useMutation();
  const grantMembership = trpc.lmsAdmin.grantMembershipAccess.useMutation();
  const isCreating = createMember.isPending || createAndEnroll.isPending || grantAccess.isPending || grantMembership.isPending;
  const toggleCourse = (courseId: number) => setSelectedCourseIds(ids => ids.includes(courseId) ? ids.filter(id => id !== courseId) : [...ids, courseId]);
  const toggleProduct = (product: { id: number; type: "download" | "bundle"; title: string }) => setSelectedProducts(items => items.some(item => item.id === product.id && item.type === product.type) ? items.filter(item => item.id !== product.id || item.type !== product.type) : [...items, product]);
  const togglePlan = (planId: number) => setSelectedPlanIds(ids => ids.includes(planId) ? ids.filter(id => id !== planId) : [...ids, planId]);
  const closeCreate = () => { setCreateOpen(false); setNewName(""); setNewEmail(""); setSelectedCourseIds([]); setSelectedProducts([]); setSelectedPlanIds([]); };
  const submitCreate = async () => {
    if (!newName.trim() || !newEmail.trim()) { toast.error("Enter the member's name and email address."); return; }
    try {
      const member = await createMember.mutateAsync({ name: newName.trim(), email: newEmail.trim() });
      for (const courseId of selectedCourseIds) await createAndEnroll.mutateAsync({ name: newName.trim(), email: newEmail.trim(), courseId });
      for (const product of selectedProducts) await grantAccess.mutateAsync({ userEmail: newEmail.trim(), productType: product.type, productId: product.id });
      for (const planId of selectedPlanIds) await grantMembership.mutateAsync({ userId: member.userId, planId });
      await utils.adminUser.listMembers.invalidate();
      const assignmentCount = selectedCourseIds.length + selectedProducts.length + selectedPlanIds.length;
      toast.success(`${member.isNewUser ? "Member created" : "Existing member updated"} with ${assignmentCount} access assignment${assignmentCount === 1 ? "" : "s"}.`);
      closeCreate();
    } catch (error: any) { toast.error(error?.message ?? "Unable to create the member and assign access."); }
  };

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
        <Button size="sm" className="h-9 gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={() => setCreateOpen(true)}>
          <UserPlus size={15} /> New Member & Access
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => open ? setCreateOpen(true) : closeCreate()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Member & Assign Access</DialogTitle>
            <DialogDescription>Create or reuse a member, then grant selected courses and product access in one workflow.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label htmlFor="member-name">Name</Label><Input id="member-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="First Last" className="mt-1" /></div>
              <div><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@example.com" className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <Label className="text-sm font-semibold">Courses and content</Label>
                <p className="text-xs text-slate-500 mt-1">Choose every course, cohort, or quiz course to enroll immediately.</p>
                <div className="mt-3 max-h-56 overflow-y-auto space-y-2 pr-1">
                  {(coursesQuery.data?.courses ?? []).map((course: any) => <label key={course.id} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedCourseIds.includes(course.id)} onChange={() => toggleCourse(course.id)} className="mt-1 accent-teal-600" />
                    <span><span className="font-medium text-slate-700">{course.title}</span><span className="block text-xs text-slate-400">{course.type}</span></span>
                  </label>)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <Label className="text-sm font-semibold">Products and downloads</Label>
                <p className="text-xs text-slate-500 mt-1">Choose products to grant at no charge.</p>
                <div className="mt-3 max-h-56 overflow-y-auto space-y-2 pr-1">
                  {(productsQuery.data?.products ?? []).filter((product: any) => ["download", "bundle"].includes(product.type)).map((product: any) => {
                    const typed = { id: product.id, type: product.type as "download" | "bundle", title: product.title };
                    const checked = selectedProducts.some(item => item.id === typed.id && item.type === typed.type);
                    return <label key={`${product.type}-${product.id}`} className="flex items-start gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => toggleProduct(typed)} className="mt-1 accent-teal-600" />
                      <span><span className="font-medium text-slate-700">{product.title}</span><span className="block text-xs text-slate-400 capitalize">{product.type}</span></span>
                    </label>;
                  })}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <Label className="text-sm font-semibold">Memberships</Label>
                <p className="text-xs text-slate-500 mt-1">Grant complimentary active membership access.</p>
                <div className="mt-3 max-h-56 overflow-y-auto space-y-2 pr-1">
                  {(membershipsQuery.data ?? []).map((plan: any) => <label key={plan.id} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedPlanIds.includes(plan.id)} onChange={() => togglePlan(plan.id)} className="mt-1 accent-teal-600" />
                    <span><span className="font-medium text-slate-700">{plan.name}</span><span className="block text-xs text-slate-400">{plan.interval ?? "Membership"}</span></span>
                  </label>)}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreate} disabled={isCreating}>Cancel</Button>
            <Button onClick={submitCreate} disabled={isCreating}>{isCreating ? "Creating…" : "Create Member & Assign Access"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <tr key={m.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { window.location.href = getAdminUrl(`/admin/users/${m.id}`); }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={m.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-semibold">
                          {initials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-teal-700 hover:text-teal-900 truncate">{m.name}</p>
                        <p className="text-xs text-slate-400 truncate">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`text-xs ${m.role === "admin" ? "border-teal-200 text-teal-700 bg-teal-50" : "border-slate-200 text-slate-600"}`}
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
                    <a href={getAdminUrl(`/admin/users/${m.id}`)}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-teal-600">
                        <ExternalLink size={13} />
                      </Button>
                    </a>
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

// ─── Certificates Panel ──────────────────────────────────────────────────────
function CertificatesPanel() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.adminUser.getCertificateList.useQuery(
    { search: search || undefined, page, pageSize: 25 },
    { keepPreviousData: true } as any
  );
  const certs = data?.certificates ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm border-slate-200"
          />
        </div>
        <span className="text-xs text-slate-500">{total.toLocaleString()} total</span>
      </div>
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Course</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Issued</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
                ))
              ) : certs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-sm">
                    {total === 0 ? "No certificates have been issued yet" : "No results found"}
                  </td>
                </tr>
              ) : certs.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={c.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-semibold">{initials(c.userName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{c.userName}</p>
                        <p className="text-xs text-slate-400 truncate">{c.userEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700 truncate max-w-48">{c.courseTitle}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(c.issuedAt)}</td>
                  <td className="px-4 py-3">
                    {c.certificateUrl && (
                      <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-teal-600">
                          <ExternalLink size={13} />
                        </Button>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-slate-200" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-slate-200" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invitations Panel ────────────────────────────────────────────────────────
function InvitationsPanel() {
  const { data, isLoading } = trpc.adminUser.getInvitationStats.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const summary = data?.summary ?? { total: 0, pending: 0, active: 0, revoked: 0 };
  const groups = data?.groups ?? [];
  const recentInvites = data?.recentInvites ?? [];

  const statusColor: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    revoked: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Invites" value={summary.total.toLocaleString()} icon={<UserPlus size={18} />} color="teal" />
        <StatCard label="Pending" value={summary.pending.toLocaleString()} icon={<Clock size={18} />} color="amber" />
        <StatCard label="Accepted" value={summary.active.toLocaleString()} icon={<CheckCircle size={18} />} color="blue" />
        <StatCard label="Revoked" value={summary.revoked.toLocaleString()} icon={<Shield size={18} />} color="teal2" />
      </div>

      {/* Groups Table */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Groups / Teams</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Group</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Course</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Seats</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Active</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">No groups yet</td></tr>
              ) : groups.map((g: any) => (
                <tr key={g.groupId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{g.groupName}</td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-40">{g.courseTitle}</td>
                  <td className="px-4 py-3 text-slate-600">{g.totalSeats}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700 bg-emerald-50">{g.activeSeats}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50">{g.pendingSeats}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(g.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Invites */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Recent Invitations</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Group</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invited</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Accepted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentInvites.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">No invitations yet</td></tr>
              ) : recentInvites.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 truncate">{inv.memberName || inv.email}</p>
                    {inv.memberName && <p className="text-xs text-slate-400">{inv.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-36">{inv.groupName}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${statusColor[inv.status] ?? "border-slate-200 text-slate-600"}`}>
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(inv.assignedAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{inv.acceptedAt ? fmtDate(inv.acceptedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Activity Panel ───────────────────────────────────────────────────────────
function ActivityPanel() {
  const [typeFilter, setTypeFilter] = useState<"all" | "enrollment" | "completion" | "certificate" | "login">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, refetch } = trpc.adminUser.getActivityFeed.useQuery(
    { limit: 200, type: typeFilter, search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { keepPreviousData: true } as any
  );
  const activities = data ?? [];

  const iconMap: Record<string, React.ReactNode> = {
    enrollment:  <BookOpen size={13} className="text-teal-500" />,
    completion:  <CheckCircle size={13} className="text-emerald-500" />,
    certificate: <Award size={13} className="text-amber-500" />,
    login:       <Activity size={13} className="text-blue-500" />,
  };
  const labelMap: Record<string, string> = {
    enrollment:  "enrolled in",
    completion:  "completed",
    certificate: "earned certificate for",
    login:       "logged in",
  };

  return (
    <div className="space-y-4">
      {/* Filters — always at top */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Event type */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500 font-medium">Event type</span>
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger className="w-44 h-9 text-sm border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activity</SelectItem>
              <SelectItem value="enrollment">Enrollments</SelectItem>
              <SelectItem value="completion">Completions</SelectItem>
              <SelectItem value="certificate">Certificates</SelectItem>
              <SelectItem value="login">Logins</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Date from */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500 font-medium">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-2 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        {/* Date to */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500 font-medium">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-9 px-2 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        {/* User search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-xs text-slate-500 font-medium">Search user</span>
          <div className="flex gap-2">
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && setSearch(searchInput)}
              placeholder="Name or email…"
              className="h-9 text-sm border-slate-200"
            />
            <Button size="sm" className="h-9 text-xs" onClick={() => setSearch(searchInput)}>
              <Search size={13} />
            </Button>
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-end gap-2">
          {(search || dateFrom || dateTo) && (
            <Button variant="outline" size="sm" className="h-9 text-xs border-slate-200" onClick={() => { setSearch(""); setSearchInput(""); setDateFrom(""); setDateTo(""); }}>
              Clear
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 border-slate-200" onClick={() => refetch()}>
            <RefreshCw size={13} /> Refresh
          </Button>
          <span className="text-xs text-slate-500 self-center">{activities.length} events</span>
        </div>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : activities.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No activity found</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {activities.map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="mt-0.5 p-1.5 bg-slate-100 rounded-full flex-shrink-0">
                  {iconMap[a.type] ?? <Activity size={13} className="text-slate-500" />}
                </div>
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarImage src={a.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-teal-100 text-teal-700 text-xs">{initials(a.userName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 leading-snug">
                    <span className="font-medium">{a.userName}</span>{" "}
                    <span className="text-slate-500">{labelMap[a.type] ?? a.type}</span>{" "}
                    {a.subject && <span className="font-medium">{a.subject}</span>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtRelative(a.occurredAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Enrollments Panel ────────────────────────────────────────────────────────
function EnrollmentsPanel() {
  const { data, isLoading } = trpc.adminUser.getEnrollmentAnalytics.useQuery({});

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const courses = data?.courses ?? [];
  const monthlyTrend = data?.monthlyTrend ?? [];
  const totals = data?.totals ?? { total: 0, completed: 0, avgProgress: 0, completionRate: 0 };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Enrollments" value={totals.total.toLocaleString()} icon={<BookOpen size={18} />} color="teal" />
        <StatCard label="Completions" value={totals.completed.toLocaleString()} icon={<CheckCircle size={18} />} color="blue" />
        <StatCard label="Completion Rate" value={`${totals.completionRate}%`} icon={<GraduationCap size={18} />} color="teal2" />
        <StatCard label="Avg Progress" value={`${totals.avgProgress}%`} icon={<TrendingUp size={18} />} color="amber" />
      </div>

      {/* Monthly Trend */}
      {monthlyTrend.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Enrollment Trend (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Line type="monotone" dataKey="enrollments" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 3, fill: "#14b8a6" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-Course Table */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Per-Course Breakdown</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Course</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Enrollments</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Completions</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">No published courses yet</td></tr>
              ) : courses.map((c: any) => (
                <tr key={c.courseId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 truncate max-w-64">{c.courseTitle}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.enrollments.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{c.completions.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${c.completionRate}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{c.completionRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${c.avgProgress}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{c.avgProgress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Communications Panel ───────────────────────────────────────────────────
const EMAIL_TYPE_LABELS: Record<string, string> = {
  magic_link: "Magic Link",
  welcome: "Welcome",
  certificate: "Certificate",
  enrollment: "Enrollment",
  campaign: "Campaign",
  password_reset: "Password Reset",
  invite: "Invite",
  purchase_confirmation: "Purchase",
  other: "Other",
};
const EMAIL_TYPE_COLORS: Record<string, string> = {
  magic_link: "bg-purple-100 text-purple-700",
  welcome: "bg-teal-100 text-teal-700",
  certificate: "bg-amber-100 text-amber-700",
  enrollment: "bg-blue-100 text-blue-700",
  campaign: "bg-pink-100 text-pink-700",
  password_reset: "bg-orange-100 text-orange-700",
  invite: "bg-indigo-100 text-indigo-700",
  purchase_confirmation: "bg-green-100 text-green-700",
  other: "bg-slate-100 text-slate-600",
};
function CommunicationsPanel() {
  const [search, setSearch] = useState("");
  const [emailType, setEmailType] = useState("all");
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.adminUser.listEmailSendLog.useQuery({ search, emailType, page, pageSize: 25 });
  const stats = data?.stats;
  const emails = data?.emails ?? [];
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Sent" value={(stats?.totalSent ?? 0).toLocaleString()} icon={<Mail size={18} />} color="teal" />
        <StatCard label="Campaign Emails" value={(stats?.campaignCount ?? 0).toLocaleString()} icon={<MessageSquare size={18} />} color="blue" />
        <StatCard label="Transactional" value={(stats?.transactionalCount ?? 0).toLocaleString()} icon={<CheckCircle size={18} />} color="teal2" />
        <StatCard label="Failed" value={(stats?.failedCount ?? 0).toLocaleString()} icon={<Activity size={18} />} color="amber" />
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search email, subject, name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={emailType} onValueChange={v => { setEmailType(v); setPage(1); }}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(EMAIL_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {/* Table */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Recipient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-2"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : emails.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  {search || emailType !== 'all' ? 'No emails match your filters.' : 'No emails logged yet. Emails will appear here as they are sent.'}
                </td></tr>
              ) : emails.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    {e.userId ? (
                      <a href={getAdminUrl(`/admin/users/${e.userId}`)} className="text-teal-600 hover:underline font-medium">
                        {e.recipientName || e.recipientEmail}
                      </a>
                    ) : (
                      <span className="text-slate-700">{e.recipientName || e.recipientEmail}</span>
                    )}
                    <p className="text-xs text-slate-400 truncate max-w-48">{e.recipientEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700 truncate max-w-72">{e.subject}</p>
                    {e.campaignSubject && <p className="text-xs text-slate-400">Campaign: {e.campaignSubject}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EMAIL_TYPE_COLORS[e.emailType] ?? EMAIL_TYPE_COLORS.other}`}>
                      {EMAIL_TYPE_LABELS[e.emailType] ?? e.emailType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.status === 'sent' ? 'bg-green-100 text-green-700' :
                      e.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtRelative(e.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {(data?.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">Page {page} of {data?.totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs">Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage(p => p + 1)} className="h-7 text-xs">Next</Button>
            </div>
          </div>
        )}
      </Card>
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
  const [activeNav, setActiveNav] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return tab && NAV_ITEMS.some(n => n.id === tab) ? tab : "overview";
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && NAV_ITEMS.some(n => n.id === tab)) setActiveNav(tab);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newMemberRequest, setNewMemberRequest] = useState(0);

  const pageTitle = NAV_ITEMS.find(n => n.id === activeNav)?.label ?? "Members";

  function renderContent() {
    switch (activeNav) {
      case "overview":          return <OverviewPanel />;
      case "all-members":       return <AllMembersPanel openCreateSignal={newMemberRequest} onCreateConsumed={() => setNewMemberRequest(0)} />;
      case "enrollments":       return <EnrollmentsPanel />;
      case "invitations":       return <InvitationsPanel />;
      case "import":            return <PlaceholderPanel title="Import Members" description="Bulk import members from CSV or connect your existing platform." />;
      case "activity":          return <ActivityPanel />;
      case "communications":    return <CommunicationsPanel />;
      case "certificates":      return <CertificatesPanel />;
      case "sales":             return <AdminSalesDashboard />;
      case "product-analytics": return <ProductAnalytics />;
      case "memberships":       return <MembershipAdmin />;
      case "contacts":          return <ContactsAdmin />;
      case "sharing-monitor":   return <SharingMonitor />;
      case "sdms-cme":           return <SdmsCmeExportInline />;
      case "settings":          return <PlaceholderPanel title="Member Settings" description="Configure member registration, approval workflows, and access rules." />;
      default:                  return <OverviewPanel />;
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50">
      {/* Platform Admin breadcrumb bar */}
      <div className="flex-shrink-0 bg-[#0e1e2e] border-b border-white/10 px-4 py-2 flex items-center gap-3">
        <a
          href={getAdminUrl("/platform-admin")}
          className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Platform Admin
        </a>
        <span className="text-white/20 text-xs">/</span>
        <span className="text-xs text-white/80 font-medium">Members Hub</span>
      </div>
      <div className="flex flex-1 min-h-0">
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
              <Button size="sm" className="text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 h-8" onClick={() => { setActiveNav("all-members"); setNewMemberRequest(Date.now()); }}>
                <UserPlus size={13} /> New Member & Access
              </Button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>
      </div>
      </div>
    </div>
  );
}
