/**
 * AdminUserDetailPage.tsx
 * Admin view of a student's dashboard — mirrors StudentDashboardPage layout
 * with admin action buttons overlaid on each section.
 *
 * Tabs: Profile/Settings | Content | Subscriptions | Certificates
 * Actions: enroll, unenroll, grant/revoke membership, cancel sub, refund, issue/remove cert, change role
 */

import { useState, useEffect } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  User, BookOpen, CreditCard, Award, ExternalLink, Download, Play,
  FileText, Package, AlertCircle, CheckCircle2, Clock, XCircle,
  RefreshCw, Loader2, ChevronRight, ChevronLeft, ShoppingCart,
  UserCog, PlusCircle, Trash2, Shield, ShieldOff, BadgeCheck,
  ClipboardCheck, RotateCcw, DollarSign, Edit3, GitMerge, Mail, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Layout from "@/components/Layout";

// ─── Brand config ─────────────────────────────────────────────────────────────
const BRAND_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  aaus:       { label: "All About Ultrasound - UltrasoundAssist", color: "#189aa1", bg: "bg-teal-50",  border: "border-teal-200" },
  iheartecho: { label: "iHeartEcho - EchoAssist",                  color: "#e05c8a", bg: "bg-pink-50",  border: "border-pink-200" },
};

function BrandBadge({ brand }: { brand?: string | null }) {
  if (!brand) return null;
  const cfg = BRAND_CONFIG[brand] ?? { label: brand, color: "#6b7280", bg: "bg-gray-50", border: "border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.border}`}
      style={{ color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active:     { label: "Active",     color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    cancelled:  { label: "Cancelled",  color: "bg-red-100 text-red-700 border-red-200" },
    canceled:   { label: "Cancelled",  color: "bg-red-100 text-red-700 border-red-200" },
    expired:    { label: "Expired",    color: "bg-gray-100 text-gray-500 border-gray-200" },
    pending:    { label: "Pending",    color: "bg-amber-100 text-amber-700 border-amber-200" },
    refunded:   { label: "Refunded",   color: "bg-teal-100 text-teal-700 border-teal-200" },
    trialing:   { label: "Trial",      color: "bg-blue-100 text-blue-700 border-blue-200" },
    past_due:   { label: "Past Due",   color: "bg-red-100 text-red-700 border-red-200" },
    free:       { label: "Free",       color: "bg-gray-100 text-gray-600 border-gray-200" },
    premium:    { label: "Premium",    color: "bg-teal-100 text-teal-700 border-teal-200" },
  };
  const cfg = map[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
      {action}
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = "profile" | "content" | "transactions" | "subscriptions" | "certificates" | "communications" | "activity" | "logins";
const VALID_TABS: Tab[] = ["profile", "content", "transactions", "subscriptions", "certificates", "communications", "activity", "logins"];

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ userId, data, refetch }: { userId: number; data: any; refetch: () => void }) {
  const updateRole = trpc.adminUser.updateUserRole.useMutation({
    onSuccess: () => { toast.success("Role updated."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const grantMembership = trpc.adminUser.grantBrandMembership.useMutation({
    onSuccess: () => { toast.success("Membership granted."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateProfile = trpc.adminUser.updateUserProfile.useMutation({
    onSuccess: () => { toast.success("Profile updated."); refetch(); setEditOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantBrand, setGrantBrand] = useState<"aaus" | "iheartecho">("aaus");
  const [grantTier, setGrantTier] = useState<"free" | "premium">("premium");
  const [grantExpiry, setGrantExpiry] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const user = data.user;

  const [editForm, setEditForm] = useState({
    displayName: "", firstName: "", lastName: "", email: "",
    bio: "", specialty: "", credentials: "", location: "", website: "", timezone: "",
    isDemo: false, isPremium: false,
  });

  const handleEditOpen = () => {
    setEditForm({
      displayName: user.displayName ?? "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email ?? "",
      bio: user.bio ?? "",
      specialty: user.specialty ?? "",
      credentials: user.credentials ?? "",
      location: user.location ?? "",
      website: user.website ?? "",
      timezone: user.timezone ?? "",
      isDemo: user.isDemo ?? false,
      isPremium: user.isPremium ?? false,
    });
    setEditOpen(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Avatar + info card with Edit button */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-5">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-4 border-[#189aa1]/20 shadow flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
              {(user.displayName ?? user.name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{user.displayName ?? user.name ?? "—"}</h2>
                <p className="text-sm text-gray-500">{user.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">Member since {formatDate(user.createdAt)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleEditOpen} className="flex-shrink-0 gap-1.5 text-teal-700 border-teal-200 hover:bg-teal-50">
                <Edit3 className="w-3.5 h-3.5" /> Edit Profile
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge status={user.role} />
              {user.isPremium && <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">★ Premium</span>}
              {user.isDemo && <span className="text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Demo</span>}
              {user.specialty && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{user.specialty}</span>}
              {user.credentials && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{user.credentials}</span>}
            </div>
          </div>
        </div>
        {/* Profile detail grid */}
        <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {user.firstName && <div><span className="text-xs text-gray-400 uppercase tracking-wide">First Name</span><p className="text-gray-800 font-medium">{user.firstName}</p></div>}
          {user.lastName && <div><span className="text-xs text-gray-400 uppercase tracking-wide">Last Name</span><p className="text-gray-800 font-medium">{user.lastName}</p></div>}
          {user.location && <div><span className="text-xs text-gray-400 uppercase tracking-wide">Location</span><p className="text-gray-800">{user.location}</p></div>}
          {user.timezone && <div><span className="text-xs text-gray-400 uppercase tracking-wide">Timezone</span><p className="text-gray-800">{user.timezone}</p></div>}
          {user.website && <div className="sm:col-span-2"><span className="text-xs text-gray-400 uppercase tracking-wide">Website</span><a href={user.website} target="_blank" rel="noopener noreferrer" className="block text-[#189aa1] hover:underline truncate">{user.website}</a></div>}
          {user.bio && <div className="sm:col-span-2"><span className="text-xs text-gray-400 uppercase tracking-wide">Bio</span><p className="text-gray-700 mt-0.5 leading-relaxed">{user.bio}</p></div>}
        </div>
        {/* Quick stats */}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
          <div className="text-center"><div className="text-lg font-bold text-gray-900">{data.enrollments?.length ?? 0}</div><div className="text-xs text-gray-500">Enrollments</div></div>
          <div className="text-center"><div className="text-lg font-bold text-gray-900">{data.certificates?.length ?? 0}</div><div className="text-xs text-gray-500">Certificates</div></div>
          <div className="text-center"><div className="text-lg font-bold text-gray-900">{data.memberships?.length ?? 0}</div><div className="text-xs text-gray-500">Memberships</div></div>
        </div>
      </div>

      {/* Role management */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <SectionHeader title="Role & Access" />
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600">Current role: <strong>{user.role}</strong></span>
          <Button size="sm" variant="outline" disabled={updateRole.isPending || user.role === "admin"} onClick={() => updateRole.mutate({ userId, role: "admin" })} className="text-teal-700 border-teal-200 hover:bg-teal-50">
            <Shield className="w-3.5 h-3.5 mr-1.5" /> Promote to Admin
          </Button>
          <Button size="sm" variant="outline" disabled={updateRole.isPending || user.role === "user"} onClick={() => updateRole.mutate({ userId, role: "user" })} className="text-gray-600 border-gray-200 hover:bg-gray-50">
            <ShieldOff className="w-3.5 h-3.5 mr-1.5" /> Demote to User
          </Button>
        </div>
      </div>

      {/* Brand memberships */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <SectionHeader title="Brand Memberships" action={
          <Button size="sm" onClick={() => setGrantOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Grant Access
          </Button>
        } />
        {data.memberships && data.memberships.length > 0 ? (
          <div className="space-y-2">
            {data.memberships.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div><BrandBadge brand={m.brand} /><p className="text-xs text-gray-500 mt-1">{m.tier === "premium" ? "★ Premium" : "Free"}{m.expiresAt ? ` • Expires ${formatDate(m.expiresAt)}` : " • No expiry"}</p></div>
                <StatusBadge status={m.status ?? "active"} />
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">No brand memberships yet.</p>}
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update this member's profile information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First Name</Label><Input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" /></div>
              <div className="space-y-1.5"><Label>Last Name</Label><Input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" /></div>
            </div>
            <div className="space-y-1.5"><Label>Display Name</Label><Input value={editForm.displayName} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Display name" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Specialty</Label><Input value={editForm.specialty} onChange={e => setEditForm(f => ({ ...f, specialty: e.target.value }))} placeholder="e.g. Cardiac Sonographer" /></div>
            <div className="space-y-1.5"><Label>Credentials</Label><Input value={editForm.credentials} onChange={e => setEditForm(f => ({ ...f, credentials: e.target.value }))} placeholder="e.g. RDCS, RVT" /></div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="City, State" /></div>
            <div className="space-y-1.5"><Label>Website</Label><Input value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." /></div>
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <textarea value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} placeholder="Short bio..." rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none" />
            </div>
            <div className="space-y-1.5"><Label>Timezone</Label><Input value={editForm.timezone} onChange={e => setEditForm(f => ({ ...f, timezone: e.target.value }))} placeholder="e.g. America/New_York" /></div>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editForm.isPremium} onChange={e => setEditForm(f => ({ ...f, isPremium: e.target.checked }))} className="rounded" /><span className="text-sm text-gray-700">Premium member</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editForm.isDemo} onChange={e => setEditForm(f => ({ ...f, isDemo: e.target.checked }))} className="rounded" /><span className="text-sm text-gray-700">Demo/test account</span></label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => updateProfile.mutate({ userId, ...editForm })} disabled={updateProfile.isPending} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
              {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Aliases Panel */}
      <EmailAliasesPanel userId={userId} />

      {/* Grant dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant Brand Membership</DialogTitle><DialogDescription>Manually grant access to a brand app for this user.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Brand</Label><Select value={grantBrand} onValueChange={(v) => setGrantBrand(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aaus">All About Ultrasound - UltrasoundAssist</SelectItem><SelectItem value="iheartecho">iHeartEcho - EchoAssist</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Tier</Label><Select value={grantTier} onValueChange={(v) => setGrantTier(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="premium">Premium</SelectItem><SelectItem value="free">Free</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Expiry Date (optional)</Label><Input type="date" value={grantExpiry} onChange={e => setGrantExpiry(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button onClick={() => { grantMembership.mutate({ userId, brand: grantBrand, tier: grantTier, expiresAt: grantExpiry || undefined }); setGrantOpen(false); }} disabled={grantMembership.isPending} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
              {grantMembership.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Content Tab ──────────────────────────────────────────────────────────────
type ContentSubTab = "courses" | "quizzes" | "downloads" | "products" | "purchases";

function ContentTab({ userId, data, refetch }: { userId: number; data: any; refetch: () => void }) {
  const [contentTab, setContentTab] = useState<ContentSubTab>("courses");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [unenrollConfirm, setUnenrollConfirm] = useState<number | null>(null);
  const [refundOpen, setRefundOpen] = useState<{ piId: string; purchaseId?: number } | null>(null);

  const { data: allCourses } = trpc.adminUser.listAllCourses.useQuery();

  const enroll = trpc.adminUser.enrollInCourse.useMutation({
    onSuccess: (res) => {
      if (res.alreadyEnrolled) toast.info("User is already enrolled in this course.");
      else toast.success("Enrolled successfully.");
      refetch();
      setEnrollOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const unenroll = trpc.adminUser.unenrollFromCourse.useMutation({
    onSuccess: () => { toast.success("Unenrolled."); refetch(); setUnenrollConfirm(null); },
    onError: (e) => toast.error(e.message),
  });

  const refundPayment = trpc.adminUser.refundPayment.useMutation({
    onSuccess: (res) => { toast.success(`Refund issued (${res.refundId}).`); refetch(); setRefundOpen(null); },
    onError: (e) => toast.error(e.message),
  });

  const enrollments = data.enrollments ?? [];
  const courses   = enrollments.filter((e: any) => !e.isQuiz && !e.isDownload);
  const quizzes   = enrollments.filter((e: any) => e.isQuiz);
  const downloads = enrollments.filter((e: any) => e.isDownload);
  const physOrders = data.physicalOrders ?? [];
  const funnelPurchases = data.funnelPurchases ?? [];

  const subTabs: { key: ContentSubTab; label: string; icon: React.ElementType; count: number }[] = [
    { key: "courses",   label: "Courses",   icon: BookOpen,       count: enrollments.length },
    { key: "quizzes",   label: "Quizzes",   icon: ClipboardCheck, count: quizzes.length },
    { key: "downloads", label: "Downloads", icon: Download,       count: downloads.length },
    { key: "products",  label: "Products",  icon: Package,        count: physOrders.length },
    { key: "purchases", label: "Purchases", icon: ShoppingCart,   count: funnelPurchases.length },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setContentTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              contentTab === t.key ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                contentTab === t.key ? "bg-[#189aa1]/10 text-[#189aa1]" : "bg-gray-200 text-gray-500"
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Courses */}
      {contentTab === "courses" && (
        <div className="space-y-3">
          <SectionHeader
            title={`Enrollments (${enrollments.length})`}
            action={
              <Button size="sm" onClick={() => setEnrollOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Enroll
              </Button>
            }
          />
          {enrollments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No enrollments yet.</p>
          ) : (
            enrollments.map((e: any) => (
              <div key={e.enrollmentId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 items-start">
                {e.thumbnailUrl ? (
                  <img src={e.thumbnailUrl} alt={e.courseTitle} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                ) : (
                  <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center bg-teal-50">
                    <BookOpen className="w-6 h-6 text-[#189aa1]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-800 text-sm">{e.courseTitle}</h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${
                      e.completedAt ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-teal-100 text-teal-700 border-teal-200"
                    }`}>
                      {e.completedAt ? "Completed" : `${e.progressPct ?? 0}% complete`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Enrolled {formatDate(e.enrolledAt)}</p>
                  {(e.videosCompleted > 0 || e.quizAttempts > 0) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {e.videosCompleted} videos completed · {e.quizAttempts} quiz attempts
                      {e.avgQuizScore != null && ` · Avg score: ${e.avgQuizScore}%`}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <a href={`/courses/${e.courseSlug}/overview`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                      <ExternalLink className="w-3 h-3" /> View Course
                    </a>
                    <button
                      onClick={() => setUnenrollConfirm(e.enrollmentId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    >
                      <Trash2 className="w-3 h-3" /> Unenroll
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Quizzes */}
      {contentTab === "quizzes" && (
        <div className="space-y-3">
          <SectionHeader title={`Quizzes (${quizzes.length})`} />
          {quizzes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No quiz enrollments.</p>
          ) : (
            quizzes.map((e: any) => (
              <div key={e.enrollmentId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{e.courseTitle}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Enrolled {formatDate(e.enrolledAt)}</p>
                  </div>
                  <button
                    onClick={() => setUnenrollConfirm(e.enrollmentId)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Downloads */}
      {contentTab === "downloads" && (
        <div className="space-y-3">
          <SectionHeader title={`Downloads (${data.digitalPurchases?.length ?? 0})`} />
          {(data.digitalPurchases?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No digital purchases.</p>
          ) : (
            data.digitalPurchases.map((d: any) => (
              <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">{d.productTitle}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Purchased {formatDate(d.purchasedAt)}</p>
                </div>
                <a href={`/downloads/${d.productSlug}/files`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">
                  <Download className="w-3 h-3" /> Files
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {/* Physical Products */}
      {contentTab === "products" && (
        <div className="space-y-3">
          <SectionHeader title={`Physical Orders (${physOrders.length})`} />
          {physOrders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No physical product orders.</p>
          ) : (
            physOrders.map((o: any) => (
              <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{o.productTitle}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ordered {formatDate(o.createdAt)} · {formatCurrency(o.amountPaid, o.currency)}
                    </p>
                    {o.shippingAddress && (
                      <p className="text-xs text-gray-400 mt-0.5">Ship to: {o.shippingAddress}</p>
                    )}
                  </div>
                  <StatusBadge status={o.fulfillmentStatus} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Funnel Purchases */}
      {contentTab === "purchases" && (
        <div className="space-y-3">
          <SectionHeader title={`Checkout Purchases (${funnelPurchases.length})`} />
          {funnelPurchases.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No checkout purchases.</p>
          ) : (
            funnelPurchases.map((p: any) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{p.productName}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(p.purchasedAt ?? p.createdAt)} · {formatCurrency(p.amountPaid ?? 0, p.currency ?? "usd")}
                    </p>
                    {p.stripePaymentIntentId && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{p.stripePaymentIntentId}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={p.status ?? "completed"} />
                    {p.stripePaymentIntentId && p.status !== "refunded" && (
                      <button
                        onClick={() => setRefundOpen({ piId: p.stripePaymentIntentId, purchaseId: p.id })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      >
                        <DollarSign className="w-3 h-3" /> Refund
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll in Course</DialogTitle>
            <DialogDescription>Manually enroll this user in an LMS course.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Select Course</Label>
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger><SelectValue placeholder="Choose a course..." /></SelectTrigger>
              <SelectContent>
                {(allCourses ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedCourseId) return;
                enroll.mutate({ userId, courseId: Number(selectedCourseId) });
              }}
              disabled={enroll.isPending || !selectedCourseId}
              className="bg-[#189aa1] hover:bg-[#157f85] text-white"
            >
              {enroll.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Enroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unenroll confirm */}
      <AlertDialog open={unenrollConfirm !== null} onOpenChange={open => !open && setUnenrollConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Enrollment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user's access to this course and delete their progress record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unenrollConfirm !== null && unenroll.mutate({ enrollmentId: unenrollConfirm })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Refund confirm */}
      <AlertDialog open={refundOpen !== null} onOpenChange={open => !open && setRefundOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue Full Refund?</AlertDialogTitle>
            <AlertDialogDescription>
              This will issue a full refund via Stripe. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => refundOpen && refundPayment.mutate({ stripePaymentIntentId: refundOpen.piId, purchaseId: refundOpen.purchaseId })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {refundPayment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────
function SubscriptionsTab({ userId, data, refetch }: { userId: number; data: any; refetch: () => void }) {
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantBrand, setGrantBrand] = useState<"aaus" | "iheartecho">("aaus");
  const [grantTier, setGrantTier] = useState<"free" | "premium">("premium");
  const [grantExpiry, setGrantExpiry] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState<{ membershipId: number; stripeSubId: string } | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<number | null>(null);

  const grantMembership = trpc.adminUser.grantBrandMembership.useMutation({
    onSuccess: () => { toast.success("Membership granted."); refetch(); setGrantOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMembership = trpc.adminUser.revokeBrandMembership.useMutation({
    onSuccess: () => { toast.success("Membership revoked."); refetch(); setRevokeConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancelSub = trpc.adminUser.cancelStripeSubscription.useMutation({
    onSuccess: () => { toast.success("Subscription cancelled."); refetch(); setCancelConfirm(null); },
    onError: (e) => toast.error(e.message),
  });

  const memberships = data.memberships ?? [];

  // Group by brand
  const byBrand: Record<string, typeof memberships> = {};
  for (const m of memberships) {
    const b = m.brand ?? "other";
    if (!byBrand[b]) byBrand[b] = [];
    byBrand[b].push(m);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Brand Memberships (${memberships.length})`}
        action={
          <Button size="sm" onClick={() => setGrantOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Grant
          </Button>
        }
      />

      {memberships.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No memberships found.</p>
      ) : (
        Object.entries(byBrand).map(([brand, subs]) => {
          const brandCfg = BRAND_CONFIG[brand] ?? { label: brand, color: "#6b7280", bg: "bg-gray-50", border: "border-gray-200" };
          return (
            <div key={brand}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border"
                  style={{ color: brandCfg.color, background: brandCfg.bg, borderColor: brandCfg.color + "40" }}>
                  {brandCfg.label}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="space-y-3">
                {(subs as any[]).map((m: any) => (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800 capitalize">{m.tier} Membership</span>
                          <StatusBadge status={m.status} />
                          {m.source === "admin" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">Admin granted</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <p>Granted: {formatDate(m.grantedAt ?? m.createdAt)}</p>
                          {m.expiresAt && <p>Expires: {formatDate(m.expiresAt)}</p>}
                          {m.stripeSubscriptionId && (
                            <p className="font-mono text-gray-400">{m.stripeSubscriptionId}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        {m.stripeSubscriptionId && m.status === "active" && (
                          <button
                            onClick={() => setCancelConfirm({ membershipId: m.id, stripeSubId: m.stripeSubscriptionId })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                          >
                            <XCircle className="w-3 h-3" /> Cancel Sub
                          </button>
                        )}
                        {m.status !== "cancelled" && (
                          <button
                            onClick={() => setRevokeConfirm(m.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                          >
                            <ShieldOff className="w-3 h-3" /> Revoke
                          </button>
                        )}
                        {m.status === "cancelled" && (
                          <button
                            onClick={() => grantMembership.mutate({ userId, brand: m.brand, tier: "premium" })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                          >
                            <RefreshCw className="w-3 h-3" /> Reinstate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Grant dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Brand Membership</DialogTitle>
            <DialogDescription>Manually grant or upgrade access for this user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={grantBrand} onValueChange={(v) => setGrantBrand(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aaus">All About Ultrasound - UltrasoundAssist</SelectItem>
                  <SelectItem value="iheartecho">iHeartEcho - EchoAssist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tier</Label>
              <Select value={grantTier} onValueChange={(v) => setGrantTier(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date (optional)</Label>
              <Input type="date" value={grantExpiry} onChange={e => setGrantExpiry(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button
              onClick={() => grantMembership.mutate({ userId, brand: grantBrand, tier: grantTier, expiresAt: grantExpiry || undefined })}
              disabled={grantMembership.isPending}
              className="bg-[#189aa1] hover:bg-[#157f85] text-white"
            >
              {grantMembership.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel sub confirm */}
      <AlertDialog open={cancelConfirm !== null} onOpenChange={open => !open && setCancelConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Stripe Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              The subscription will be cancelled at the end of the current billing period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelConfirm && cancelSub.mutate({ membershipId: cancelConfirm.membershipId, stripeSubscriptionId: cancelConfirm.stripeSubId })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke confirm */}
      <AlertDialog open={revokeConfirm !== null} onOpenChange={open => !open && setRevokeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Membership?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately remove the user's access to this brand app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeConfirm !== null && revokeMembership.mutate({ membershipId: revokeConfirm })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab({ userId }: { userId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.productAnalytics.getUserTransactions.useQuery({ userId, page, pageSize: 50 });

  const fmtCurrency = (cents: number, currency = "usd") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const STATUS_COLORS: Record<string, string> = {
    paid: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700",
    refunded: "bg-gray-100 text-gray-600", failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{fmtCurrency(data?.totalSpent ?? 0)}</div>
            <div className="text-xs text-gray-500">Total Spent</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{data?.total ?? 0}</div>
            <div className="text-xs text-gray-500">Total Transactions</div>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Product</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Date</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Amount</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
              ) : (data?.transactions ?? []).length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No transactions found</td></tr>
              ) : (data?.transactions ?? []).map((t: any, i: number) => (
                <tr key={`${t.sourceTable}-${t.transactionId}-${i}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900 text-sm">{t.productName}</div>
                    <div className="text-xs text-gray-400 capitalize">{t.productType}</div>
                    {t.stripePaymentIntentId && (
                      <div className="text-xs text-gray-300 font-mono mt-0.5 truncate max-w-[200px]">{t.stripePaymentIntentId}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(t.purchasedAt)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 text-sm whitespace-nowrap">
                    {fmtCurrency(t.amountPaid, t.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button disabled={page * 50 >= data.total} onClick={() => setPage(p => p + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Certificates Tab ─────────────────────────────────────────────────────────
function CertificatesTab({ userId, data, refetch }: { userId: number; data: any; refetch: () => void }) {
  const [issueOpen, setIssueOpen] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>("");
  const [removeConfirm, setRemoveConfirm] = useState<number | null>(null);

  const issueCert = trpc.adminUser.issueCertificate.useMutation({
    onSuccess: (res) => {
      if (res.alreadyIssued) toast.info("Certificate already issued for this course.");
      else toast.success("Certificate issued and emailed to student.");
      refetch();
      setIssueOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const removeCert = trpc.adminUser.removeCertificate.useMutation({
    onSuccess: () => { toast.success("Certificate removed."); refetch(); setRemoveConfirm(null); },
    onError: (e) => toast.error(e.message),
  });

  const certs = data.certificates ?? [];
  const enrollments = data.enrollments ?? [];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={`Certificates (${certs.length})`}
        action={
          <Button size="sm" onClick={() => setIssueOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
            <BadgeCheck className="w-3.5 h-3.5 mr-1.5" /> Issue Certificate
          </Button>
        }
      />

      {certs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No certificates issued yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {certs.map((cert: any) => (
            <div key={cert.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
                <Award className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-800 text-sm leading-tight">{cert.courseTitle}</h4>
                <p className="text-xs text-gray-500 mt-1">Issued {formatDate(cert.issuedAt)}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <a
                    href={cert.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#189aa1] text-white hover:bg-[#157f85] transition-colors"
                  >
                    <Download className="w-3 h-3" /> Download
                  </a>
                  <button
                    onClick={() => setRemoveConfirm(cert.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issue dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Certificate</DialogTitle>
            <DialogDescription>Select an enrollment to issue a certificate for. A PDF will be generated and emailed to the student.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Select Enrollment</Label>
            <Select value={selectedEnrollmentId} onValueChange={setSelectedEnrollmentId}>
              <SelectTrigger><SelectValue placeholder="Choose a course..." /></SelectTrigger>
              <SelectContent>
                {enrollments.map((e: any) => (
                  <SelectItem key={e.enrollmentId} value={String(e.enrollmentId)}>
                    {e.courseTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedEnrollmentId) return;
                const enrollment = enrollments.find((e: any) => String(e.enrollmentId) === selectedEnrollmentId);
                if (!enrollment) return;
                issueCert.mutate({ userId, courseId: enrollment.courseId, enrollmentId: enrollment.enrollmentId });
              }}
              disabled={issueCert.isPending || !selectedEnrollmentId}
              className="bg-[#189aa1] hover:bg-[#157f85] text-white"
            >
              {issueCert.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Issue Certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog open={removeConfirm !== null} onOpenChange={open => !open && setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Certificate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently revoke this certificate. The student will no longer be able to access it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeConfirm !== null && removeCert.mutate({ certificateId: removeConfirm })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Communications Tab ────────────────────────────────────────────────────────
const COMM_TYPE_LABELS: Record<string, string> = {
  magic_link: "Magic Link", welcome: "Welcome", certificate: "Certificate",
  enrollment: "Enrollment", campaign: "Campaign", password_reset: "Password Reset",
  invite: "Invite", purchase_confirmation: "Purchase", other: "Other",
};
const COMM_TYPE_COLORS: Record<string, string> = {
  magic_link: "bg-purple-100 text-purple-700", welcome: "bg-teal-100 text-teal-700",
  certificate: "bg-amber-100 text-amber-700", enrollment: "bg-blue-100 text-blue-700",
  campaign: "bg-pink-100 text-pink-700", password_reset: "bg-orange-100 text-orange-700",
  invite: "bg-indigo-100 text-indigo-700", purchase_confirmation: "bg-green-100 text-green-700",
  other: "bg-slate-100 text-slate-600",
};
function CommunicationsTab({ userId }: { userId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.adminUser.getUserEmailHistory.useQuery({ userId, page, pageSize: 25 });
  const emails = data?.emails ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Email History</h3>
        <span className="text-xs text-slate-400">{(data?.total ?? 0).toLocaleString()} total emails sent</span>
      </div>
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-2"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
              ))
            ) : emails.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-sm">
                No emails sent to this user yet. Emails will appear here automatically as they are sent.
              </td></tr>
            ) : emails.map((e: any) => (
              <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-slate-700 truncate max-w-sm">{e.subject}</p>
                  {e.campaignSubject && <p className="text-xs text-slate-400">Campaign: {e.campaignSubject}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COMM_TYPE_COLORS[e.emailType] ?? COMM_TYPE_COLORS.other}`}>
                    {COMM_TYPE_LABELS[e.emailType] ?? e.emailType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    e.status === "sent" ? "bg-green-100 text-green-700" :
                    e.status === "failed" ? "bg-red-100 text-red-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>{e.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {e.sentAt ? new Date(e.sentAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data?.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">Page {page} of {data?.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                className="text-xs px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= (data?.totalPages ?? 1)}
                className="text-xs px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Activity Tab ─────────────────────────────────────────────────────────────
function ActivityTab({ userId }: { userId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.adminUser.getUserActivityLog.useQuery({ userId, page, pageSize: 50 });
  const events = data?.events ?? [];

  const EVENT_COLORS: Record<string, string> = {
    login: "bg-blue-100 text-blue-700",
    page_view: "bg-gray-100 text-gray-600",
    video_play: "bg-purple-100 text-purple-700",
    video_complete: "bg-green-100 text-green-700",
    quiz_attempt: "bg-amber-100 text-amber-700",
    quiz_pass: "bg-emerald-100 text-emerald-700",
    quiz_fail: "bg-red-100 text-red-700",
    course_enroll: "bg-teal-100 text-teal-700",
    course_complete: "bg-teal-100 text-teal-800",
    download: "bg-indigo-100 text-indigo-700",
    module_complete: "bg-cyan-100 text-cyan-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Activity Log</h3>
        <span className="text-xs text-gray-400">{(data?.total ?? 0).toLocaleString()} total events</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Event</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Description</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Path</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">IP</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No activity recorded yet.</td></tr>
              ) : events.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[e.eventType] ?? "bg-gray-100 text-gray-600"}`}>
                      {e.eventType.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 max-w-xs">
                    <p className="truncate">{e.description}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 font-mono max-w-[160px]">
                    <p className="truncate">{e.path ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap">{e.ipAddress ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {data?.totalPages} ({data?.total} events)</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                className="text-xs px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= (data?.totalPages ?? 1)}
                className="text-xs px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Logins Tab ───────────────────────────────────────────────────────────────
function LoginsTab({ userId }: { userId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.adminUser.getUserLoginHistory.useQuery({ userId, page, pageSize: 25 });
  const logins = data?.logins ?? [];

  const parseUA = (ua: string | null) => {
    if (!ua) return "Unknown";
    if (/iPhone|iPad|iOS/i.test(ua)) return "iOS";
    if (/Android/i.test(ua)) return "Android";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Mac OS X/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";
    return ua.slice(0, 40);
  };

  const parseBrowser = (ua: string | null) => {
    if (!ua) return "";
    if (/Chrome/i.test(ua) && !/Chromium|Edge/i.test(ua)) return "Chrome";
    if (/Firefox/i.test(ua)) return "Firefox";
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
    if (/Edge/i.test(ua)) return "Edge";
    return "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Login History</h3>
        <span className="text-xs text-gray-400">{(data?.total ?? 0).toLocaleString()} total logins</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Date & Time</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">IP Address</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Country</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Device / Browser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
              ) : logins.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No login history recorded yet.</td></tr>
              ) : logins.map((l: any) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{l.ipAddress ?? "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{l.country ?? "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    <span>{parseUA(l.userAgent)}</span>
                    {parseBrowser(l.userAgent) && <span className="ml-1 text-gray-400">/ {parseBrowser(l.userAgent)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {data?.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                className="text-xs px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= (data?.totalPages ?? 1)}
                className="text-xs px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Email Aliases Panel ─────────────────────────────────────────────────────
function EmailAliasesPanel({ userId }: { userId: number }) {
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const utils = trpc.useUtils();

  const { data: aliases, isLoading } = trpc.adminUser.listEmailAliases.useQuery({ userId });

  const addAlias = trpc.adminUser.addEmailAlias.useMutation({
    onSuccess: () => {
      toast.success("Email alias added.");
      utils.adminUser.listEmailAliases.invalidate({ userId });
      setAddOpen(false);
      setNewEmail("");
      setNewLabel("");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeAlias = trpc.adminUser.removeEmailAlias.useMutation({
    onSuccess: () => {
      toast.success("Alias removed.");
      utils.adminUser.listEmailAliases.invalidate({ userId });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
      <SectionHeader title="Email Aliases" action={
        <Button size="sm" onClick={() => setAddOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
          <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Add Alias
        </Button>
      } />
      <p className="text-xs text-gray-500">Aliases allow this user to log in with multiple email addresses. Magic links are always sent to the primary email above.</p>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading aliases...</div>
      ) : aliases && aliases.length > 0 ? (
        <div className="space-y-2">
          {aliases.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{a.email}</p>
                  <p className="text-xs text-gray-400">
                    {a.label ? `${a.label} · ` : ""}
                    {a.source === "account_merge" ? "From account merge" : "Admin added"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeAlias.mutate({ aliasId: a.id })}
                disabled={removeAlias.isPending}
                className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="Remove alias"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No email aliases. Add one to let this user log in with an additional email address.</p>
      )}

      {/* Add Alias Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Email Alias</DialogTitle>
            <DialogDescription>This email will work for login but magic links always go to the primary email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="alias@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Label (optional)</Label>
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Work email, Old account" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addAlias.mutate({ userId, email: newEmail, label: newLabel || undefined })}
              disabled={addAlias.isPending || !newEmail}
              className="bg-[#189aa1] hover:bg-[#157f85] text-white"
            >
              {addAlias.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Add Alias
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Merge Users Dialog ───────────────────────────────────────────────────────
function MergeUsersDialog({ userId, userName, onClose }: { userId: number; userName: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: searchResults, isLoading: searching } = trpc.adminUser.searchUsersForMerge.useQuery(
    { query, excludeUserId: userId },
    { enabled: query.length >= 2 }
  );

  const merge = trpc.adminUser.mergeUsers.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      utils.adminUser.getUserDetail.invalidate({ userId });
      utils.adminUser.listEmailAliases.invalidate({ userId });
      setConfirmOpen(false);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={!confirmOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GitMerge className="w-5 h-5 text-[#189aa1]" /> Merge Duplicate Accounts</DialogTitle>
            <DialogDescription>
              Search for the duplicate account to merge into <strong>{userName}</strong>.
              All data (enrollments, purchases, activity) will be moved to this account.
              The duplicate's email will become a login alias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Search for duplicate account</Label>
              <Input
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedUser(null); }}
                placeholder="Search by name or email..."
              />
            </div>
            {searching && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>}
            {searchResults && searchResults.length > 0 && !selectedUser && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {searchResults.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-teal-50 transition-colors text-left border-b border-gray-100 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
                      {(u.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.name ?? "—"}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <span className="text-xs text-gray-400 ml-auto flex-shrink-0">#{u.id}</span>
                  </button>
                ))}
              </div>
            )}
            {searchResults && searchResults.length === 0 && query.length >= 2 && !searching && (
              <p className="text-sm text-gray-400">No matching accounts found.</p>
            )}
            {selectedUser && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800">Selected duplicate account:</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)" }}>
                    {(selectedUser.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{selectedUser.name ?? "—"}</p>
                    <p className="text-sm text-gray-500">{selectedUser.email}</p>
                    <p className="text-xs text-gray-400">Account #{selectedUser.id}</p>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="ml-auto text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-amber-700 bg-amber-100 rounded p-2">
                  <strong>What will happen:</strong> All enrollments, purchases, certificates, activity, and login history from account #{selectedUser.id} will be moved to <strong>{userName}</strong>. The email <em>{selectedUser.email}</em> will be added as a login alias. Account #{selectedUser.id} will be deactivated.
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!selectedUser}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <GitMerge className="w-4 h-4 mr-1.5" /> Merge Accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Account Merge</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently merge account #{selectedUser?.id} ({selectedUser?.email}) into {userName}.
              This action cannot be undone. The duplicate account will be deactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => merge.mutate({ targetUserId: userId, sourceUserId: selectedUser.id })}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {merge.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Yes, Merge Accounts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profile",        label: "Profile",        icon: User },
  { key: "content",        label: "Content",         icon: BookOpen },
  { key: "transactions",   label: "Transactions",    icon: DollarSign },
  { key: "subscriptions",  label: "Subscriptions",   icon: CreditCard },
  { key: "certificates",   label: "Certificates",    icon: Award },
  { key: "communications", label: "Emails",          icon: FileText },
  { key: "activity",       label: "Activity",        icon: ClipboardCheck },
  { key: "logins",         label: "Logins",          icon: Shield },
];

export default function AdminUserDetailPage() {
  const { user: adminUser, loading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [, params] = useRoute("/admin/users/:userId");
  const userId = params?.userId ? Number(params.userId) : null;

  const urlTab = new URLSearchParams(search).get("tab") as Tab | null;
  const initialTab: Tab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : "profile";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const p = new URLSearchParams(search);
    p.set("tab", tab);
    navigate(`/admin/users/${userId}?${p.toString()}`, { replace: true });
  };

  useEffect(() => {
    const t = new URLSearchParams(search).get("tab") as Tab | null;
    if (t && VALID_TABS.includes(t) && t !== activeTab) setActiveTab(t);
  }, [search]);

  const [mergeOpen, setMergeOpen] = useState(false);

  const { data, isLoading, refetch } = trpc.adminUser.getUserDetail.useQuery(
    { userId: userId! },
    { enabled: !!userId }
  );

  if (loading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
        </div>
      </Layout>
    );
  }

  if (!adminUser || adminUser.role !== "admin") {
    navigate("/");
    return null;
  }

  if (!data) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-500">User not found.</p>
        </div>
      </Layout>
    );
  }

  const studentName = data.user.displayName ?? data.user.name ?? "Student";

  return (
    <Layout>
      <div className="min-h-screen bg-[#f0fbfc]">
        {/* Header */}
        <div className="bg-white border-b border-[#189aa1]/15 px-4 sm:px-8 py-5">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => navigate("/admin/users")}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#189aa1] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> All Users
              </button>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {data.user.avatarUrl ? (
                <img src={data.user.avatarUrl} alt={studentName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#189aa1]/20 shadow-sm" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-sm"
                  style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
                  {studentName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    {studentName}
                  </h1>
                  <StatusBadge status={data.user.role} />
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    <UserCog className="w-3 h-3" /> Admin View
                  </span>
                </div>
                <p className="text-sm text-gray-500">{data.user.email}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMergeOpen(true)}
                className="flex-shrink-0 gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50 ml-auto"
              >
                <GitMerge className="w-3.5 h-3.5" /> Merge Accounts
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
          {/* Tab Navigation */}
          <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1 mb-8 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
                  activeTab === t.key
                    ? "bg-[#189aa1] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <t.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "profile"       && <ProfileTab       userId={userId!} data={data} refetch={refetch} />}
          {activeTab === "content"       && <ContentTab       userId={userId!} data={data} refetch={refetch} />}
          {activeTab === "transactions"  && <TransactionsTab  userId={userId!} />}
          {activeTab === "subscriptions" && <SubscriptionsTab userId={userId!} data={data} refetch={refetch} />}
          {activeTab === "certificates"   && <CertificatesTab   userId={userId!} data={data} refetch={refetch} />}
          {activeTab === "communications"  && <CommunicationsTab userId={userId!} />}
          {activeTab === "activity"      && <ActivityTab      userId={userId!} />}
          {activeTab === "logins"        && <LoginsTab        userId={userId!} />}
        </div>
      </div>

      {/* Merge Users Dialog */}
      {mergeOpen && (
        <MergeUsersDialog
          userId={userId!}
          userName={studentName}
          onClose={() => setMergeOpen(false)}
        />
      )}
    </Layout>
  );
}
