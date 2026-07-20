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
  Users2, Users, Building2, Star, Layers, KeyRound, Eye, EyeOff, Calendar,
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
import { Checkbox } from "@/components/ui/checkbox";
import Layout from "@/components/Layout";
import { SdmsCmeUserTab } from "@/components/admin/SdmsCmeUserTab";

// ─── Brand config ─────────────────────────────────────────────────────────────
const BRAND_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  aaus:       { label: "All About Ultrasound™", color: "#189aa1", bg: "bg-teal-50",  border: "border-teal-200" },
  iheartecho: { label: "iHeartEcho™",           color: "#e05c8a", bg: "bg-pink-50",  border: "border-pink-200" },
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

// ─── Role definitions ────────────────────────────────────────────────────────
const ALL_ROLES = [
  { value: "user",                label: "User",               color: "#6b7280", additive: false, removable: false },
  { value: "premium_user",        label: "Premium User",        color: "#189aa1", additive: false, removable: true },
  { value: "platform_owner",      label: "Platform Owner",      color: "#7c3aed", additive: false, removable: true },
  { value: "platform_admin",      label: "Platform Admin",      color: "#dc2626", additive: false, removable: true },
  { value: "platform_moderator",  label: "Platform Moderator",  color: "#0891b2", additive: false, removable: true },
  { value: "accreditation_manager", label: "Accreditation Manager", color: "#d97706", additive: false, removable: true },
  { value: "education_manager",   label: "Education Manager",   color: "#059669", additive: false, removable: true },
  { value: "education_admin",     label: "Education Admin",     color: "#0d9488", additive: false, removable: true },
  { value: "education_student",   label: "Education Student",   color: "#6366f1", additive: false, removable: true },
  { value: "diy_admin",           label: "DIY Admin",           color: "#f97316", additive: false, removable: true },
  { value: "diy_user",            label: "DIY User",            color: "#f59e0b", additive: false, removable: true },
  // Additive roles — can be stacked on any account type
  { value: "instructor",          label: "Instructor",          color: "#059669", additive: true,  removable: true },
  { value: "team_admin",          label: "Team Admin",          color: "#d97706", additive: true,  removable: true },
  { value: "affiliate",           label: "Affiliate",           color: "#9333ea", additive: true,  removable: true },
] as const;

type AppRoleValue = typeof ALL_ROLES[number]["value"];

function AppRolesPanel({ userId, refetch }: { userId: number; refetch: () => void }) {
  const { data: rolesData, refetch: refetchRoles } = trpc.adminUser.getUserAppRoles.useQuery({ userId });
  const grantRole = trpc.adminUser.grantAppRole.useMutation({
    onSuccess: () => { toast.success("Role granted."); refetchRoles(); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const revokeRole = trpc.adminUser.revokeAppRole.useMutation({
    onSuccess: () => { toast.success("Role removed."); refetchRoles(); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [addRole, setAddRole] = useState<AppRoleValue | "">("");

  const assignedRoles = (rolesData ?? []).map((r: any) => r.role as AppRoleValue);
  const availableToAdd = ALL_ROLES.filter(r => !assignedRoles.includes(r.value));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
      <SectionHeader title="Platform Roles" />
      {/* Current roles as chips */}
      <div className="flex flex-wrap gap-2">
        {assignedRoles.length === 0 && <p className="text-sm text-gray-400">No roles assigned yet.</p>}
        {ALL_ROLES.filter(r => assignedRoles.includes(r.value)).map(role => (
          <span key={role.value}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
            style={{ background: role.color + "18", color: role.color, borderColor: role.color + "40" }}>
            {role.additive && <span className="text-[9px] font-bold opacity-60">+</span>}
            {role.label}
            {role.removable && (
              <button
                onClick={() => revokeRole.mutate({ userId, role: role.value })}
                disabled={revokeRole.isPending}
                className="ml-0.5 hover:opacity-70 transition-opacity"
                title={`Remove ${role.label}`}>
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {/* Add role row */}
      {availableToAdd.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <Select value={addRole} onValueChange={(v) => setAddRole(v as AppRoleValue)}>
            <SelectTrigger className="h-8 text-xs w-52">
              <SelectValue placeholder="Add a role…" />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Standard Roles</div>
              {availableToAdd.filter(r => !r.additive).map(r => (
                <SelectItem key={r.value} value={r.value}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: r.color }} />
                    {r.label}
                  </span>
                </SelectItem>
              ))}
              {availableToAdd.some(r => r.additive) && (
                <>
                  <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Additive Roles</div>
                  {availableToAdd.filter(r => r.additive).map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: r.color }} />
                        {r.label} <span className="text-[10px] text-gray-400">(additive)</span>
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!addRole || grantRole.isPending}
            onClick={() => { if (addRole) { grantRole.mutate({ userId, role: addRole }); setAddRole(""); } }}
            className="h-8 text-xs bg-[#189aa1] hover:bg-[#157f85] text-white">
            <PlusCircle className="w-3.5 h-3.5 mr-1" /> Grant
          </Button>
        </div>
      )}
      <p className="text-[11px] text-gray-400">Roles marked with <strong>+</strong> are additive — they can be stacked on any account type. The base <em>user</em> role cannot be removed.</p>
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = "profile" | "content" | "transactions" | "subscriptions" | "certificates" | "cme" | "communications" | "activity" | "logins" | "teams";
const VALID_TABS: Tab[] = ["profile", "content", "transactions", "subscriptions", "certificates", "cme", "communications", "activity", "logins", "teams"];

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
  const sendPasswordReset = trpc.adminUser.sendPasswordReset.useMutation({
    onSuccess: (res) => toast.success(`Password reset email sent to ${res.email}`),
    onError: (e) => toast.error(e.message),
  });
  const setPasswordMutation = trpc.adminUser.setPassword.useMutation({
    onSuccess: (res) => { toast.success(`Password updated for ${res.email}`); setSetPwOpen(false); setNewPassword(""); },
    onError: (e) => toast.error(e.message),
  });

  const [setPwOpen, setSetPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantBrand, setGrantBrand] = useState<"aaus" | "iheartecho">("aaus");
  const [grantTier, setGrantTier] = useState<"free" | "premium">("premium");
  const [grantExpiry, setGrantExpiry] = useState("");
  const [grantNotify, setGrantNotify] = useState(true);
  const [revokeNotify, setRevokeNotify] = useState(true);
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
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={handleEditOpen} className="gap-1.5 text-teal-700 border-teal-200 hover:bg-teal-50">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendPasswordReset.mutate({ userId })}
                  disabled={sendPasswordReset.isPending}
                  className="gap-1.5 text-orange-700 border-orange-200 hover:bg-orange-50"
                  title="Send password reset email to student"
                >
                  {sendPasswordReset.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Mail className="w-3.5 h-3.5" />}
                  Send Reset Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSetPwOpen(true)}
                  className="gap-1.5 text-violet-700 border-violet-200 hover:bg-violet-50"
                  title="Directly set a new password for this student"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Set Password
                </Button>
              </div>
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

      {/* Platform Roles panel */}
      <AppRolesPanel userId={userId} refetch={refetch} />

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

      {/* Set Password Dialog */}
      <Dialog open={setPwOpen} onOpenChange={(o) => { setSetPwOpen(o); if (!o) { setNewPassword(""); setShowNewPw(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>Directly set a new password for this member. They will be able to log in immediately with the new password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="admin-new-pw">New Password</Label>
              <div className="relative mt-1">
                <Input
                  id="admin-new-pw"
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="pr-10"
                  onKeyDown={(e) => { if (e.key === "Enter" && newPassword.length >= 8) setPasswordMutation.mutate({ userId, newPassword }); }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetPwOpen(false)}>Cancel</Button>
            <Button
              onClick={() => setPasswordMutation.mutate({ userId, newPassword })}
              disabled={newPassword.length < 8 || setPasswordMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {setPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="space-y-1.5"><Label>Brand</Label><Select value={grantBrand} onValueChange={(v) => setGrantBrand(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aaus">All About Ultrasound™</SelectItem><SelectItem value="iheartecho">iHeartEcho™</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Tier</Label><Select value={grantTier} onValueChange={(v) => setGrantTier(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="premium">Premium</SelectItem><SelectItem value="free">Free</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Expiry Date (optional)</Label><Input type="date" value={grantExpiry} onChange={e => setGrantExpiry(e.target.value)} /></div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox id="grant-notify" checked={grantNotify} onCheckedChange={(v) => setGrantNotify(!!v)} />
              <Label htmlFor="grant-notify" className="text-sm font-normal cursor-pointer">Send email notification to student</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button onClick={() => { grantMembership.mutate({ userId, brand: grantBrand, tier: grantTier, expiresAt: grantExpiry || undefined, sendNotification: grantNotify }); setGrantOpen(false); }} disabled={grantMembership.isPending} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
              {grantMembership.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Content Tab ──────────────────────────────────────────────────────────────
type ContentSubTab = "courses" | "cohorts" | "quizzes" | "downloads" | "workshops" | "webinars" | "products" | "bundles" | "memberships" | "communities";

function ContentTab({ userId, data, refetch }: { userId: number; data: any; refetch: () => void }) {
  const [contentTab, setContentTab] = useState<ContentSubTab>("courses");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseSearch, setCourseSearch] = useState("");
  const [enrollPaymentMode, setEnrollPaymentMode] = useState<"free" | "link" | "charge">("free");
  const [enrollStripePI, setEnrollStripePI] = useState("");
  const [enrollCardToken, setEnrollCardToken] = useState("");
  const [enrollAmountCents, setEnrollAmountCents] = useState("");
  const [enrollNote, setEnrollNote] = useState("");
  const [enrollExpiresAt, setEnrollExpiresAt] = useState("");
  const [unenrollConfirm, setUnenrollConfirm] = useState<number | null>(null);
  const [cancelEnrollSubConfirm, setCancelEnrollSubConfirm] = useState<{ enrollmentId: number; title: string } | null>(null);
  const [refundOpen, setRefundOpen] = useState<{ piId: string; purchaseId?: number } | null>(null);
  const [cancelNativeConfirm, setCancelNativeConfirm] = useState<{ id: number; stripeSubId: string | null } | null>(null);
  const [revokeNativeConfirm, setRevokeNativeConfirm] = useState<number | null>(null);
  const [revokeNativeNotify, setRevokeNativeNotify] = useState(true);
  const [expiryEditId, setExpiryEditId] = useState<number | null>(null);
  const [expiryEditValue, setExpiryEditValue] = useState("");

  const { data: allCourses } = trpc.adminUser.listAllCourses.useQuery();

  const enroll = trpc.adminUser.enrollInCourse.useMutation({
    onSuccess: (res) => {
      if (res.alreadyEnrolled) toast.info("User is already enrolled in this course.");
      else {
        const paymentNote = res.stripePaymentIntentId ? ` (PI: ${res.stripePaymentIntentId})` : "";
        toast.success(`Enrolled successfully${paymentNote}.`);
      }
      refetch();
      setEnrollOpen(false);
      setSelectedCourseId("");
      setEnrollPaymentMode("free");
      setEnrollStripePI("");
      setEnrollCardToken("");
      setEnrollAmountCents("");
      setEnrollNote("");
      setEnrollExpiresAt("");
    },
    onError: (e) => toast.error(e.message),
  });

  const unenroll = trpc.adminUser.unenrollFromCourse.useMutation({
    onSuccess: () => { toast.success("Unenrolled."); refetch(); setUnenrollConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancelEnrollSub = trpc.adminUser.cancelLmsEnrollmentSubscription.useMutation({
    onSuccess: () => { toast.success("Subscription cancelled at period end. Access expiry set to billing period end."); refetch(); setCancelEnrollSubConfirm(null); },
    onError: (e) => { toast.error(e.message); setCancelEnrollSubConfirm(null); },
  });

  const refundPayment = trpc.adminUser.refundPayment.useMutation({
    onSuccess: (res) => { toast.success(`Refund issued (${res.refundId}).`); refetch(); setRefundOpen(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancelNativeMembership = trpc.adminUser.cancelNativeMembership.useMutation({
    onSuccess: () => { toast.success("Membership subscription cancelled."); refetch(); setCancelNativeConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const revokeNativeMembership = trpc.adminUser.revokeNativeMembership.useMutation({
    onSuccess: () => { toast.success("Membership revoked."); refetch(); setRevokeNativeConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const updateExpiry = trpc.adminUser.updateEnrollmentExpiry.useMutation({
    onSuccess: () => { toast.success("Access expiry updated."); refetch(); setExpiryEditId(null); setExpiryEditValue(""); },
    onError: (e) => toast.error(e.message),
  });
  const resendEnrollmentEmail = trpc.adminUser.resendEnrollmentEmail.useMutation({
    onSuccess: (res) => toast.success(`Access email resent to ${res.sentTo}`),
    onError: (e) => toast.error(e.message),
  });
  const resendMembershipConfirmation = trpc.adminUser.resendMembershipConfirmation.useMutation({
    onSuccess: (res) => toast.success(`Membership confirmation resent to ${res.sentTo}`),
    onError: (e) => toast.error(e.message),
  });
  const syncSub = trpc.adminUser.syncStripeSubscription.useMutation({
    onSuccess: (res) => { toast.success(`Synced from Stripe (${res.stripeStatus}). Updated: ${res.updated?.join("; ") || "none"}`); refetch(); },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });
  // Cohort group assignment
  const [cohortGroupAssignId, setCohortGroupAssignId] = useState<number | null>(null); // courseId being assigned
  const { data: cohortGroups } = trpc.adminUser.listCohortGroups.useQuery(
    { courseId: cohortGroupAssignId! },
    { enabled: cohortGroupAssignId !== null }
  );
  const assignCohortGroup = trpc.adminUser.assignCohortGroup.useMutation({
    onSuccess: (res) => { toast.success(`Assigned to group: ${res.groupName}`); refetch(); setCohortGroupAssignId(null); },
    onError: (e) => toast.error(e.message),
  });
  // Workshop instance assignment
  const [workshopAssignEnrollId, setWorkshopAssignEnrollId] = useState<number | null>(null); // enrollmentId being assigned
  const [workshopAssignWorkshopId, setWorkshopAssignWorkshopId] = useState<number | null>(null);
  const { data: workshopInstances } = trpc.adminUser.listWorkshopInstances.useQuery(
    { workshopId: workshopAssignWorkshopId! },
    { enabled: workshopAssignWorkshopId !== null }
  );
  const assignWorkshopInstance = trpc.adminUser.assignWorkshopInstance.useMutation({
    onSuccess: (res) => { toast.success(`Assigned to instance: ${res.instanceTitle}`); refetch(); setWorkshopAssignEnrollId(null); setWorkshopAssignWorkshopId(null); },
    onError: (e) => toast.error(e.message),
  });

  const enrollments = data.enrollments ?? [];
  const courses   = enrollments.filter((e: any) => !e.isQuiz && !e.isDownload && e.courseType !== 'cohort');
  const cohorts   = enrollments.filter((e: any) => e.courseType === 'cohort');
  const quizzes   = enrollments.filter((e: any) => e.isQuiz);
  const downloads = enrollments.filter((e: any) => e.isDownload);
  const workshopEnrollmentsList = data.workshopEnrollments ?? [];
  const physOrders = data.physicalOrders ?? [];
  const bundleEnrollments = data.bundleEnrollments ?? [];
  const nativeMemberships = data.nativeMemberships ?? [];
  const brandMemberships = data.memberships ?? [];
  const communityMemberships = data.communityMemberships ?? [];
  const webinarRegistrations = data.webinarRegistrations ?? [];

  const subTabs: { key: ContentSubTab; label: string; icon: React.ElementType; count: number }[] = [
    { key: "courses",      label: "Courses",      icon: BookOpen,       count: courses.length },
    { key: "cohorts",      label: "Cohorts",      icon: Users,          count: cohorts.length },
    { key: "quizzes",      label: "Quizzes",      icon: ClipboardCheck, count: quizzes.length },
    { key: "downloads",    label: "Downloads",    icon: Download,       count: downloads.length },
    { key: "workshops",    label: "Workshops",    icon: Calendar,       count: workshopEnrollmentsList.length },
    { key: "webinars",     label: "Webinars",     icon: Play,           count: webinarRegistrations.length },
    { key: "products",     label: "Products",     icon: Package,        count: physOrders.length },
    { key: "bundles",      label: "Bundles",      icon: Layers,         count: bundleEnrollments.length },
    { key: "memberships",  label: "Memberships",  icon: Star,           count: brandMemberships.length + nativeMemberships.length },
    { key: "communities",  label: "Communities",  icon: Users2,         count: communityMemberships.length },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 w-full flex-nowrap overflow-x-auto">
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setContentTab(t.key)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              contentTab === t.key ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <t.icon className="w-3 h-3 flex-shrink-0" />
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] px-1 py-0.5 rounded-full font-semibold ${
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
            title={`Enrollments (${courses.length})`}
            action={
              <Button size="sm" onClick={() => setEnrollOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Grant Access
              </Button>
            }
          />
          {courses.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No course enrollments yet.</p>
          ) : (
            courses.map((e: any) => (
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
                  {e.accessExpiresAt && (() => {
                    const exp = new Date(e.accessExpiresAt);
                    const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
                    return (
                      <p className={`text-xs mt-0.5 flex items-center gap-1 font-medium ${
                        daysLeft <= 0 ? "text-red-500" : daysLeft <= 30 ? "text-amber-600" : "text-gray-400"
                      }`}>
                        <Clock className="w-3 h-3" />
                        {daysLeft <= 0 ? `Expired ${formatDate(exp)}` : daysLeft <= 30 ? `Expires ${formatDate(exp)} (${daysLeft}d left)` : `Access until ${formatDate(exp)}`}
                      </p>
                    );
                  })()}
                  {(e.videosCompleted > 0 || e.quizAttempts > 0) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {e.videosCompleted} videos completed · {e.quizAttempts} quiz attempts
                      {e.avgQuizScore != null && ` · Avg score: ${e.avgQuizScore}%`}
                    </p>
                  )}
                  {expiryEditId === e.enrollmentId ? (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Input
                        type="date"
                        value={expiryEditValue}
                        onChange={ev => setExpiryEditValue(ev.target.value)}
                        className="h-7 text-xs w-36"
                      />
                      <button
                        onClick={() => updateExpiry.mutate({ enrollmentId: e.enrollmentId, accessExpiresAt: expiryEditValue || null })}
                        disabled={updateExpiry.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        {updateExpiry.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Save
                      </button>
                      <button
                        onClick={() => { setExpiryEditId(null); setExpiryEditValue(""); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      {e.accessExpiresAt && (
                        <button
                          onClick={() => updateExpiry.mutate({ enrollmentId: e.enrollmentId, accessExpiresAt: null })}
                          disabled={updateExpiry.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200"
                        >
                          <XCircle className="w-3 h-3" /> Remove Expiry
                        </button>
                      )}
                    </div>
                  ) : (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <a href={`/courses/${e.courseSlug}/overview`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                      <ExternalLink className="w-3 h-3" /> View Course
                    </a>
                    <button
                      onClick={() => { setExpiryEditId(e.enrollmentId); setExpiryEditValue(e.accessExpiresAt ? new Date(e.accessExpiresAt).toISOString().slice(0,10) : ""); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                    >
                      <Calendar className="w-3 h-3" /> Edit Expiry
                    </button>
                    <button
                      onClick={() => resendEnrollmentEmail.mutate({ enrollmentId: e.enrollmentId })}
                      disabled={resendEnrollmentEmail.isPending}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                    >
                      {resendEnrollmentEmail.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Resend Email
                    </button>
                    {e.stripeSubscriptionId && (() => {
                      const isCancelledAtPeriodEnd = !!(e.stripeSubscriptionId && e.accessExpiresAt);
                      return (
                        <button
                          disabled={isCancelledAtPeriodEnd}
                          onClick={() => !isCancelledAtPeriodEnd && setCancelEnrollSubConfirm({ enrollmentId: e.enrollmentId, title: e.courseTitle })}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            isCancelledAtPeriodEnd
                              ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                              : "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
                          }`}
                        >
                          <XCircle className="w-3 h-3" /> Cancel Subscription
                        </button>
                      );
                    })()}
                    <button
                      onClick={() => setUnenrollConfirm(e.enrollmentId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    >
                      <Trash2 className="w-3 h-3" /> Unenroll
                    </button>
                    {e.stripeSubscriptionId && (
                      <button
                        onClick={() => syncSub.mutate({ stripeSubscriptionId: e.stripeSubscriptionId })}
                        disabled={syncSub.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" /> Sync from Stripe
                      </button>
                    )}
                    {e.stripeSubscriptionId && e.accessExpiresAt && new Date(e.accessExpiresAt) < new Date() && (
                      <p className="w-full text-xs text-orange-600 mt-1 flex items-center gap-1 font-medium">
                        <XCircle className="w-3 h-3 flex-shrink-0" />
                        Subscription cancelled{" — "}access ends {new Date(e.accessExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  )
                  }
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Cohorts */}
      {contentTab === "cohorts" && (
        <div className="space-y-3">
          <SectionHeader
            title={`Cohort Enrollments (${cohorts.length})`}
            action={
              <Button size="sm" onClick={() => setEnrollOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Grant Access
              </Button>
            }
          />
          {cohorts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No cohort enrollments yet.</p>
          ) : (
            cohorts.map((e: any) => (
              <div key={e.enrollmentId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 items-start">
                {e.thumbnailUrl ? (
                  <img src={e.thumbnailUrl} alt={e.courseTitle} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                ) : (
                  <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center bg-teal-50">
                    <Users className="w-6 h-6 text-[#189aa1]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-800 text-sm">{e.courseTitle}</h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-teal-100 text-teal-700 border-teal-200">
                      {e.completedAt ? "Completed" : `${e.progressPct ?? 0}% complete`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Enrolled {formatDate(e.enrolledAt)}</p>
                  {/* Cohort group assignment */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {cohortGroupAssignId === e.courseId ? (
                      <>
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700"
                          defaultValue=""
                          onChange={ev => {
                            if (ev.target.value) {
                              assignCohortGroup.mutate({ userId, courseId: e.courseId, cohortGroupId: Number(ev.target.value) });
                            }
                          }}
                        >
                          <option value="">Select group...</option>
                          {(cohortGroups ?? []).map((g: any) => (
                            <option key={g.id} value={g.id}>
                              {g.name}{g.isFeaturedOnLanding ? " ★" : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setCohortGroupAssignId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setCohortGroupAssignId(e.courseId)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          e.cohortGroupId
                            ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                            : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                        }`}
                      >
                        <Users className="w-3 h-3" />
                        {e.cohortGroupName ? `Group: ${e.cohortGroupName}` : "Unassigned — Assign Group"}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <a href={`/courses/${e.courseSlug}/overview`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                      <ExternalLink className="w-3 h-3" /> View Course
                    </a>
                    <button
                      onClick={() => { setExpiryEditId(e.enrollmentId); setExpiryEditValue(e.accessExpiresAt ? new Date(e.accessExpiresAt).toISOString().slice(0,10) : ""); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                    >
                      <Calendar className="w-3 h-3" /> Edit Expiry
                    </button>
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
          <SectionHeader
            title={`Quizzes (${quizzes.length})`}
            action={
              <Button size="sm" onClick={() => setEnrollOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Grant Access
              </Button>
            }
          />
          {quizzes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No quiz enrollments.</p>
          ) : (
            quizzes.map((e: any) => (
              <div key={e.enrollmentId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 items-start">
                {e.thumbnailUrl ? (
                  <img src={e.thumbnailUrl} alt={e.courseTitle} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                ) : (
                  <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center bg-amber-50">
                    <ClipboardCheck className="w-6 h-6 text-amber-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-800 text-sm">{e.courseTitle}</h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${
                      e.completedAt ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"
                    }`}>
                      {e.completedAt ? "Completed" : `${e.progressPct ?? 0}% complete`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Enrolled {formatDate(e.enrolledAt)}</p>
                  {e.accessExpiresAt && (() => {
                    const exp = new Date(e.accessExpiresAt);
                    const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
                    return (
                      <p className={`text-xs mt-0.5 flex items-center gap-1 font-medium ${
                        daysLeft <= 0 ? "text-red-500" : daysLeft <= 30 ? "text-amber-600" : "text-gray-400"
                      }`}>
                        <Clock className="w-3 h-3" />
                        {daysLeft <= 0 ? `Expired ${formatDate(exp)}` : daysLeft <= 30 ? `Expires ${formatDate(exp)} (${daysLeft}d left)` : `Access until ${formatDate(exp)}`}
                      </p>
                    );
                  })()}
                  {e.quizAttempts > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {e.quizAttempts} attempt{e.quizAttempts !== 1 ? "s" : ""}
                      {e.avgQuizScore != null && ` · Avg score: ${e.avgQuizScore}%`}
                    </p>
                  )}
                  {expiryEditId === e.enrollmentId ? (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Input
                        type="date"
                        value={expiryEditValue}
                        onChange={ev => setExpiryEditValue(ev.target.value)}
                        className="h-7 text-xs w-36"
                      />
                      <button
                        onClick={() => updateExpiry.mutate({ enrollmentId: e.enrollmentId, accessExpiresAt: expiryEditValue || null })}
                        disabled={updateExpiry.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        {updateExpiry.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Save
                      </button>
                      <button
                        onClick={() => { setExpiryEditId(null); setExpiryEditValue(""); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      {e.accessExpiresAt && (
                        <button
                          onClick={() => updateExpiry.mutate({ enrollmentId: e.enrollmentId, accessExpiresAt: null })}
                          disabled={updateExpiry.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200"
                        >
                          <XCircle className="w-3 h-3" /> Remove Expiry
                        </button>
                      )}
                    </div>
                  ) : (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <a href={`/courses/${e.courseSlug}/overview`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                      <ExternalLink className="w-3 h-3" /> View Quiz
                    </a>
                    <button
                      onClick={() => { setExpiryEditId(e.enrollmentId); setExpiryEditValue(e.accessExpiresAt ? new Date(e.accessExpiresAt).toISOString().slice(0,10) : ""); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                    >
                      <Calendar className="w-3 h-3" /> Edit Expiry
                    </button>
                    <button
                      onClick={() => resendEnrollmentEmail.mutate({ enrollmentId: e.enrollmentId })}
                      disabled={resendEnrollmentEmail.isPending}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                    >
                      {resendEnrollmentEmail.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Resend Email
                    </button>
                    {e.stripeSubscriptionId && (() => {
                      const isCancelledAtPeriodEnd = !!(e.stripeSubscriptionId && e.accessExpiresAt);
                      return (
                        <button
                          disabled={isCancelledAtPeriodEnd}
                          onClick={() => !isCancelledAtPeriodEnd && setCancelEnrollSubConfirm({ enrollmentId: e.enrollmentId, title: e.courseTitle })}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            isCancelledAtPeriodEnd
                              ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                              : "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
                          }`}
                        >
                          <XCircle className="w-3 h-3" /> Cancel Subscription
                        </button>
                      );
                    })()}
                    <button
                      onClick={() => setUnenrollConfirm(e.enrollmentId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                    {e.stripeSubscriptionId && (
                      <button
                        onClick={() => syncSub.mutate({ stripeSubscriptionId: e.stripeSubscriptionId })}
                        disabled={syncSub.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" /> Sync from Stripe
                      </button>
                    )}
                    {e.stripeSubscriptionId && e.accessExpiresAt && new Date(e.accessExpiresAt) < new Date() && (
                      <p className="w-full text-xs text-orange-600 mt-1 flex items-center gap-1 font-medium">
                        <XCircle className="w-3 h-3 flex-shrink-0" />
                        Subscription cancelled{" — "}access ends {new Date(e.accessExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  )
                  }
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

      {/* Workshops */}
      {contentTab === "workshops" && (
        <div className="space-y-3">
          <SectionHeader title={`Workshop Enrollments (${workshopEnrollmentsList.length})`} />
          {workshopEnrollmentsList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No workshop enrollments.</p>
          ) : (
            workshopEnrollmentsList.map((we: any) => (
              <div key={we.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 items-start">
                {we.thumbnailUrl ? (
                  <img src={we.thumbnailUrl} alt={we.workshopTitle} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                ) : (
                  <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center bg-purple-50">
                    <Calendar className="w-6 h-6 text-purple-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-800 text-sm">{we.workshopTitle}</h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${
                      we.attended ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-purple-100 text-purple-700 border-purple-200"
                    }`}>
                      {we.attended ? "Attended" : "Registered"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Enrolled {formatDate(we.accessGrantedAt)}</p>
                  {/* Instance assignment */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {workshopAssignEnrollId === we.id ? (
                      <>
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700"
                          defaultValue=""
                          onChange={ev => {
                            if (ev.target.value) {
                              assignWorkshopInstance.mutate({ enrollmentId: we.id, instanceId: Number(ev.target.value) });
                            }
                          }}
                        >
                          <option value="">Select instance...</option>
                          {(workshopInstances ?? []).map((inst: any) => (
                            <option key={inst.id} value={inst.id}>
                              {inst.title || (inst.startDate ? new Date(inst.startDate).toLocaleDateString() : `Instance #${inst.id}`)}
                              {inst.venueCity ? ` — ${inst.venueCity}` : ""}
                              {inst.locationType === "virtual" ? " (Virtual)" : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setWorkshopAssignEnrollId(null); setWorkshopAssignWorkshopId(null); }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setWorkshopAssignEnrollId(we.id); setWorkshopAssignWorkshopId(we.workshopId); }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          we.instanceId
                            ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                            : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        {we.instanceTitle
                          ? `Instance: ${we.instanceTitle}${we.instanceCity ? ` — ${we.instanceCity}` : ""}`
                          : "Unassigned — Assign Instance"}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <a href={`/workshops/${we.workshopSlug}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                      <ExternalLink className="w-3 h-3" /> View Workshop
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Webinars */}
      {contentTab === "webinars" && (
        <div className="space-y-3">
          <SectionHeader title={`Webinar Registrations (${webinarRegistrations.length})`} />
          {webinarRegistrations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No webinar registrations.</p>
          ) : (
            webinarRegistrations.map((w: any) => (
              <div key={w.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">{w.webinarTitle ?? "Webinar"}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Registered {formatDate(w.registeredAt ?? w.createdAt)}</p>
                  {w.attendedAt && <p className="text-xs text-gray-400 mt-0.5">Attended: {formatDate(w.attendedAt)}</p>}
                </div>
                <StatusBadge status={w.attended ? "attended" : "registered"} />
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

      {/* Bundles */}
      {contentTab === "bundles" && (
        <div className="space-y-3">
          <SectionHeader title={`Bundle Enrollments (${bundleEnrollments.length})`} />
          {bundleEnrollments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No bundle enrollments.</p>
          ) : (
            bundleEnrollments.map((b: any) => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {b.bundleCover && (
                    <img src={b.bundleCover} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{b.bundleTitle}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Enrolled {formatDate(b.enrolledAt)}</p>
                  </div>
                </div>
                <StatusBadge status="enrolled" />
              </div>
            ))
          )}
        </div>
      )}

      {/* Memberships */}
      {contentTab === "memberships" && (
        <div className="space-y-6">
          {/* Native membership plan subscriptions */}
          <div className="space-y-3">
            <SectionHeader title={`Membership Plan Subscriptions (${nativeMemberships.length})`} />
            {nativeMemberships.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No membership plan subscriptions.</p>
            ) : (
              nativeMemberships.map((m: any) => (
                <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{m.planTitle ?? "Membership"}</p>
                        <StatusBadge status={m.status ?? "active"} />
                        {m.cancelAtPeriodEnd && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                            <XCircle className="w-3 h-3" /> Cancels at period end
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.price > 0 ? `${formatCurrency(m.price, m.currency)} / ${m.billingInterval}` : "Free / Comp"}
                        {m.currentPeriodEnd ? ` · ${m.cancelAtPeriodEnd ? "Access until" : "Expires"} ${formatDate(new Date(m.currentPeriodEnd))}` : " · No expiry"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Granted {formatDate(m.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Brand memberships */}
          <div className="space-y-3">
            <SectionHeader title={`Brand Memberships (${brandMemberships.length})`} />
            {brandMemberships.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No brand memberships found.</p>
            ) : (
              brandMemberships.map((m: any) => (
                <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <BrandBadge brand={m.brand} />
                      <p className="text-xs text-gray-500 mt-1">
                        {m.tier === "lifetime" ? "★ Lifetime Premium" : m.tier === "premium" ? "★ Premium" : "Free"}{m.expiresAt ? ` · Expires ${formatDate(m.expiresAt)}` : " · No expiry"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Granted {formatDate(m.createdAt ?? m.grantedAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={m.status ?? "active"} />
                      {(m.tier === "premium" || m.tier === "lifetime") && (
                        <button
                          onClick={() => resendMembershipConfirmation.mutate({ userId: data.user.id, brand: m.brand })}
                          disabled={resendMembershipConfirmation.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                        >
                          {resendMembershipConfirmation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Resend Confirmation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Communities */}
      {contentTab === "communities" && (
        <div className="space-y-3">
          <SectionHeader title={`Community Memberships (${communityMemberships.length})`} />
          {communityMemberships.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No community memberships.</p>
          ) : (
            communityMemberships.map((c: any) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">{c.communityTitle ?? "Community"}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Joined {formatDate(c.joinedAt ?? c.createdAt)}</p>
                  {c.role && <p className="text-xs text-gray-400 mt-0.5 capitalize">{c.role}</p>}
                </div>
                <StatusBadge status={c.memberStatus ?? "active"} />
              </div>
            ))
          )}
        </div>
      )}

      {/* Cancel native membership confirm */}
      <AlertDialog open={cancelNativeConfirm !== null} onOpenChange={open => !open && setCancelNativeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Membership Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              The membership will be cancelled at the end of the current billing period. The user will retain access until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelNativeConfirm && cancelNativeMembership.mutate({ membershipSubscriptionId: cancelNativeConfirm.id, stripeSubscriptionId: cancelNativeConfirm.stripeSubId ?? undefined })}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke native membership confirm */}
      <AlertDialog open={revokeNativeConfirm !== null} onOpenChange={open => { if (!open) setRevokeNativeConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Membership?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately remove the user's membership access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 px-1 pb-2">
            <Checkbox id="revoke-native-notify" checked={revokeNativeNotify} onCheckedChange={(v) => setRevokeNativeNotify(!!v)} />
            <Label htmlFor="revoke-native-notify" className="text-sm font-normal cursor-pointer">Send email notification to student</Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeNativeConfirm !== null && revokeNativeMembership.mutate({ membershipSubscriptionId: revokeNativeConfirm, sendNotification: revokeNativeNotify })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={(open) => {
        setEnrollOpen(open);
        if (!open) {
          setSelectedCourseId(""); setCourseSearch(""); setEnrollPaymentMode("free");
          setEnrollStripePI(""); setEnrollCardToken(""); setEnrollAmountCents(""); setEnrollNote(""); setEnrollExpiresAt("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Grant Access / Enroll</DialogTitle>
            <DialogDescription>Manually grant access to any product — courses, downloads, digital products, bundles, memberships, or webinars.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Product selector with search */}
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Input
                placeholder="Search courses, downloads, memberships..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="mb-1"
              />
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product...">
                    {selectedCourseId
                      ? (() => {
                          const [selType, selId] = selectedCourseId.split(":");
                          return (allCourses ?? []).find((c: any) => String(c.id) === selId && (c.productType ?? c.type) === selType)?.title ?? "Selected";
                        })()
                      : "Choose a product..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[480px]">
                  {(() => {
                    const filtered = (allCourses ?? []).filter((c: any) =>
                      !courseSearch || c.title.toLowerCase().includes(courseSearch.toLowerCase())
                    );
                    if (filtered.length === 0) return <div className="px-3 py-2 text-sm text-gray-400">No products found</div>;
                    const typeOrder = ["course", "cohort", "workshop", "quiz", "download", "digital_product", "digital_bundle", "bundle", "membership", "webinar", "community"];
                    const typeLabels: Record<string, string> = {
                      course: "Courses", cohort: "Live Cohorts", workshop: "Workshops",
                      quiz: "Quizzes", download: "LMS Downloads",
                      digital_product: "Digital Products", digital_bundle: "Digital Bundles",
                      bundle: "Bundles", membership: "Memberships", webinar: "Webinars",
                      community: "Communities",
                    };
                    const grouped: Record<string, any[]> = {};
                    for (const c of filtered) {
                      const t = c.productType ?? c.type ?? "course";
                      if (!grouped[t]) grouped[t] = [];
                      grouped[t].push(c);
                    }
                    return typeOrder.filter(t => grouped[t]?.length).flatMap(t => [
                      <div key={`hdr-${t}`} className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                        {typeLabels[t] ?? t}
                      </div>,
                      ...grouped[t].map((c: any) => (
                        <SelectItem key={`${t}-${c.id}`} value={`${t}:${c.id}`}>
                          <span className={c.status === "draft" ? "text-gray-400" : ""}>
                            {c.title}{c.status === "draft" ? " (draft)" : ""}
                          </span>
                        </SelectItem>
                      ))
                    ]);
                  })()}
                </SelectContent>
              </Select>
            </div>

            {/* Payment mode */}
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["free", "link", "charge"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setEnrollPaymentMode(mode)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      enrollPaymentMode === mode
                        ? "bg-[#189aa1] text-white border-[#189aa1]"
                        : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"
                    }`}
                  >
                    {mode === "free" ? "Free / Comp" : mode === "link" ? "Link Stripe PI" : "Charge Card"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                {enrollPaymentMode === "free" && "No payment — enrollment granted at no charge."}
                {enrollPaymentMode === "link" && "Link this enrollment to an existing Stripe PaymentIntent."}
                {enrollPaymentMode === "charge" && "Charge a card manually using a Stripe card token."}
              </p>
            </div>

            {/* Link mode: PI ID */}
            {enrollPaymentMode === "link" && (
              <div className="space-y-1.5">
                <Label>Stripe PaymentIntent ID</Label>
                <Input
                  placeholder="pi_3abc..."
                  value={enrollStripePI}
                  onChange={(e) => setEnrollStripePI(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-400">Find this in your Stripe Dashboard → Payments.</p>
              </div>
            )}

            {/* Charge mode: card token + amount */}
            {enrollPaymentMode === "charge" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Stripe Card Token</Label>
                  <Input
                    placeholder="tok_visa (from Stripe.js)"
                    value={enrollCardToken}
                    onChange={(e) => setEnrollCardToken(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400">Use Stripe.js on the client to tokenize the card, then paste the token here.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <Input
                      placeholder="0.00"
                      value={enrollAmountCents}
                      onChange={(e) => setEnrollAmountCents(e.target.value)}
                      className="pl-7"
                      type="number"
                      min="0.50"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Optional expiry date */}
            <div className="space-y-1.5">
              <Label>Access Expiry Date <span className="text-gray-400 font-normal">(optional — leave blank for no expiry)</span></Label>
              <Input
                type="date"
                value={enrollExpiresAt}
                onChange={(e) => setEnrollExpiresAt(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              {enrollExpiresAt && (
                <p className="text-xs text-amber-600">Access will expire on {new Date(enrollExpiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.</p>
              )}
            </div>

            {/* Optional note */}
            <div className="space-y-1.5">
              <Label>Internal Note <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. Scholarship, promo, manual override..."
                value={enrollNote}
                onChange={(e) => setEnrollNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedCourseId) return;
                const amountCents = enrollPaymentMode === "charge" ? Math.round(parseFloat(enrollAmountCents) * 100) : undefined;
                const [selType, selId] = selectedCourseId.split(":");
                const selectedProduct = (allCourses ?? []).find((c: any) => String(c.id) === selId && (c.productType ?? c.type) === selType);
                enroll.mutate({
                  userId,
                  courseId: Number(selId),
                  productType: (selectedProduct?.productType ?? selectedProduct?.type ?? "course") as any,
                  paymentMode: enrollPaymentMode,
                  stripePaymentIntentId: enrollPaymentMode === "link" ? enrollStripePI || undefined : undefined,
                  stripeCardToken: enrollPaymentMode === "charge" ? enrollCardToken || undefined : undefined,
                  amountCents: enrollPaymentMode === "charge" ? amountCents : undefined,
                  note: enrollNote || undefined,
                  expiresAt: enrollExpiresAt ? new Date(enrollExpiresAt).toISOString() : null,
                });
              }}
              disabled={enroll.isPending || !selectedCourseId ||
                (enrollPaymentMode === "link" && !enrollStripePI) ||
                (enrollPaymentMode === "charge" && (!enrollCardToken || !enrollAmountCents))
              }
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

      {/* Cancel enrollment subscription confirm */}
      <AlertDialog open={cancelEnrollSubConfirm !== null} onOpenChange={open => !open && setCancelEnrollSubConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the Stripe renewal for <strong>{cancelEnrollSubConfirm?.title}</strong> and set the access expiry to the end of the current billing period. The student will keep access until then and will not be charged again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelEnrollSubConfirm && cancelEnrollSub.mutate({ enrollmentId: cancelEnrollSubConfirm.enrollmentId })}
              disabled={cancelEnrollSub.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {cancelEnrollSub.isPending ? "Cancelling..." : "Cancel Subscription"}
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
  const [cancelNativeSubConfirm, setCancelNativeSubConfirm] = useState<{ id: number; stripeSubId: string | null } | null>(null);
  const [revokeNativeSubConfirm, setRevokeNativeSubConfirm] = useState<number | null>(null);
  const [cancelLmsOrderConfirm, setCancelLmsOrderConfirm] = useState<{ id: number; stripeSubId: string | null } | null>(null);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [addSubStripeId, setAddSubStripeId] = useState("");
  const [addSubEmail, setAddSubEmail] = useState("");
  const [addSubPlanId, setAddSubPlanId] = useState<string>("auto");
  const [grantSubNotify, setGrantSubNotify] = useState(true);
  const [revokeSubNotify, setRevokeSubNotify] = useState(true);
  const [revokeNativeSubNotify, setRevokeNativeSubNotify] = useState(true);

  const grantMembership = trpc.adminUser.grantBrandMembership.useMutation({
    onSuccess: () => { toast.success("App access granted."); refetch(); setGrantOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMembership = trpc.adminUser.revokeBrandMembership.useMutation({
    onSuccess: () => { toast.success("App access revoked."); refetch(); setRevokeConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancelSub = trpc.adminUser.cancelStripeSubscription.useMutation({
    onSuccess: () => { toast.success("Subscription cancelled."); refetch(); setCancelConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancelNativeSub = trpc.adminUser.cancelNativeMembership.useMutation({
    onSuccess: () => { toast.success("Membership subscription cancelled."); refetch(); setCancelNativeSubConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const revokeNativeSub = trpc.adminUser.revokeNativeMembership.useMutation({
    onSuccess: () => { toast.success("Membership revoked."); refetch(); setRevokeNativeSubConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancelLmsOrderSub = trpc.adminUser.cancelLmsOrderSubscription.useMutation({
    onSuccess: () => { toast.success("Course subscription cancelled at period end."); refetch(); setCancelLmsOrderConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const syncSub = trpc.adminUser.syncStripeSubscription.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Synced from Stripe (${res.stripeStatus}). Updated: ${res.updated?.join("; ") || "none"}`);
      } else {
        toast.warning(res.message ?? "No records updated.");
      }
      refetch();
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });
  const addSubscription = trpc.membership.reconcileStripeMembership.useMutation({
    onSuccess: (res) => {
      toast.success(`Subscription synced. Notes: ${res.notes?.join(", ") || "done"}.`);
      refetch();
      setAddSubOpen(false);
      setAddSubStripeId("");
      setAddSubEmail("");
      setAddSubPlanId("auto");
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });
  const { data: allPlansData, isLoading: plansLoading } = trpc.membership.listAll.useQuery(undefined, { staleTime: 60_000 });

  const memberships = data.memberships ?? [];
  const nativeMemberships = data.nativeMemberships ?? [];
  // Only show subscription-type orders here; one-time purchases appear in Transactions
  const lmsCourseOrders = (data.lmsCourseOrders ?? []).filter((o: any) => !!o.stripeSubscriptionId);

  // Group app memberships by brand
  const byBrand: Record<string, typeof memberships> = {};
  for (const m of memberships) {
    const b = m.brand ?? "other";
    if (!byBrand[b]) byBrand[b] = [];
    byBrand[b].push(m);
  }

  return (
    <div className="space-y-8">
      {/* ── Apps Section ── */}
      <div>
        <SectionHeader
          title={`Apps (${memberships.length})`}
          action={
            <Button size="sm" onClick={() => setGrantOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Grant App Access
            </Button>
          }
        />
        <p className="text-xs text-gray-400 mb-3">UltrasoundAssist™ and EchoAssist™ app subscriptions</p>

      {memberships.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No app subscriptions found.</p>
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
                          {m.cancelAtPeriodEnd && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                              <XCircle className="w-3 h-3" /> Cancels at period end
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <p>Granted: {formatDate(m.grantedAt ?? m.createdAt)}</p>
                          {m.expiresAt && <p>{m.cancelAtPeriodEnd ? "Access until" : "Expires"}: {formatDate(m.expiresAt)}</p>}
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
                            <XCircle className="w-3 h-3" /> Cancel
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
                        {m.stripeSubscriptionId && (
                          <button
                            onClick={() => syncSub.mutate({ stripeSubscriptionId: m.stripeSubscriptionId })}
                            disabled={syncSub.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                          >
                            <RefreshCw className="w-3 h-3" /> Sync from Stripe
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

      </div>

      {/* ── LMS Content Subscriptions Section ── */}
      <div>
        <SectionHeader title={`Content Subscriptions (${lmsCourseOrders.length})`} />
        <p className="text-xs text-gray-400 mb-3">Active LMS course and quiz subscriptions (one-time purchases appear in Transactions)</p>
        {lmsCourseOrders.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No course orders found.</p>
        ) : (
          <div className="space-y-3">
            {lmsCourseOrders.map((o: any) => (
              <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{o.courseTitle ?? "Course"}</span>
                      <StatusBadge status={o.stripeSubscriptionId ? "subscription" : o.status} />
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p>Order #{o.id} &mdash; {formatDate(o.createdAt)}</p>
                      {o.amount != null && <p>{formatCurrency(o.amount, o.currency)}</p>}
                      {o.stripeSubscriptionId && <p className="font-mono text-gray-400">{o.stripeSubscriptionId}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {o.stripeSubscriptionId && (
                      <button
                        onClick={() => setCancelLmsOrderConfirm({ id: o.id, stripeSubId: o.stripeSubscriptionId })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                      >
                        <XCircle className="w-3 h-3" /> Cancel
                      </button>
                    )}
                    {o.stripeSubscriptionId && (
                      <button
                        onClick={() => syncSub.mutate({ stripeSubscriptionId: o.stripeSubscriptionId })}
                        disabled={syncSub.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" /> Sync from Stripe
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Learn Subscriptions Section ── */}
      <div>
        <SectionHeader
          title={`Learn Subscriptions (${nativeMemberships.length})`}
          action={
            <Button
              size="sm"
              onClick={() => { setAddSubEmail(data.user?.email ?? ""); setAddSubOpen(true); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Add Subscription from Stripe
            </Button>
          }
        />
        <p className="text-xs text-gray-400 mb-3">Ongoing LMS membership subscriptions from the Learn platform</p>
        {nativeMemberships.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No active learn subscriptions.</p>
        ) : (
          <div className="space-y-3">
            {nativeMemberships.map((m: any) => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{m.planTitle ?? "Membership"}</span>
                      <StatusBadge status={m.status ?? "active"} />
                      {m.cancelAtPeriodEnd && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                          <XCircle className="w-3 h-3" /> Cancels at period end
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p>Since: {formatDate(m.createdAt)}</p>
                      {m.currentPeriodEnd && <p>{m.cancelAtPeriodEnd ? "Access until" : "Renews"}: {formatDate(new Date(m.currentPeriodEnd * 1000))}</p>}
                      {m.price > 0 && <p>{formatCurrency(m.price, m.currency)} / {m.billingInterval}</p>}
                      {m.stripeSubscriptionId && <p className="font-mono text-gray-400">{m.stripeSubscriptionId}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {m.status === "active" && (
                      <button
                        onClick={() => setCancelNativeSubConfirm({ id: m.id, stripeSubId: m.stripeSubscriptionId ?? null })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                      >
                        <XCircle className="w-3 h-3" /> Cancel
                      </button>
                    )}
                    {m.status !== "cancelled" && (
                      <button
                        onClick={() => setRevokeNativeSubConfirm(m.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      >
                        <ShieldOff className="w-3 h-3" /> Revoke
                      </button>
                    )}
                    {m.stripeSubscriptionId && (
                      <button
                        onClick={() => syncSub.mutate({ stripeSubscriptionId: m.stripeSubscriptionId })}
                        disabled={syncSub.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" /> Sync from Stripe
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Subscription from Stripe dialog */}
      <Dialog open={addSubOpen} onOpenChange={(open) => { if (!open) { setAddSubOpen(false); setAddSubStripeId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subscription from Stripe</DialogTitle>
            <DialogDescription>
              Fetch a Stripe subscription and grant all plan access items to this user.
              The subscription must be linked to a membership plan via its Stripe price ID.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Stripe Subscription ID</Label>
              <Input
                placeholder="sub_1Tg4osBj9HgnkZLKAf9B84xu"
                value={addSubStripeId}
                onChange={e => setAddSubStripeId(e.target.value.trim())}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-400">Find this in Stripe Dashboard → Customers → Subscriptions</p>
            </div>
            <div className="space-y-1.5">
              <Label>User Email (for matching)</Label>
              <Input
                placeholder="user@example.com"
                value={addSubEmail}
                onChange={e => setAddSubEmail(e.target.value.trim())}
              />
              <p className="text-xs text-gray-400">Pre-filled from user profile. Used if Stripe metadata doesn&apos;t include email.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Membership Plan <span className="text-gray-400 font-normal">(optional — override if auto-detect fails)</span></Label>
              <Select value={addSubPlanId} onValueChange={setAddSubPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect from Stripe price ID" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect from Stripe price ID</SelectItem>
                  {(allPlansData ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Use this if you see &quot;Could not resolve membership plan&quot; — manually select the correct plan.</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              <strong>Note:</strong> This runs full membership fulfillment — granting all courses, downloads, bundles, and app access linked to the plan. Idempotent: safe to run multiple times.
            </div>
            {addSubscription.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                <strong>Error:</strong> {addSubscription.error.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSubOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addSubscription.mutate({
                stripeSubscriptionId: addSubStripeId,
                email: addSubEmail || undefined,
                userId,
                planId: addSubPlanId && addSubPlanId !== "auto" ? parseInt(addSubPlanId, 10) : undefined,
              })}
              disabled={!addSubStripeId || addSubscription.isPending || plansLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {addSubscription.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sync &amp; Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant App Access</DialogTitle>
            <DialogDescription>Manually grant or upgrade app access for this user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={grantBrand} onValueChange={(v) => setGrantBrand(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aaus">All About Ultrasound™</SelectItem>
                  <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
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
            <div className="flex items-center gap-2 pt-1">
              <Checkbox id="grant-sub-notify" checked={grantSubNotify} onCheckedChange={(v) => setGrantSubNotify(!!v)} />
              <Label htmlFor="grant-sub-notify" className="text-sm font-normal cursor-pointer">Send email notification to student</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button
              onClick={() => grantMembership.mutate({ userId, brand: grantBrand, tier: grantTier, expiresAt: grantExpiry || undefined, sendNotification: grantSubNotify })}
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

      {/* Revoke app confirm */}
      <AlertDialog open={revokeConfirm !== null} onOpenChange={open => { if (!open) setRevokeConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke App Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately remove the user's access to this app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 px-1 pb-2">
            <Checkbox id="revoke-sub-notify" checked={revokeSubNotify} onCheckedChange={(v) => setRevokeSubNotify(!!v)} />
            <Label htmlFor="revoke-sub-notify" className="text-sm font-normal cursor-pointer">Send email notification to student</Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeConfirm !== null && revokeMembership.mutate({ membershipId: revokeConfirm, sendNotification: revokeSubNotify })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel native subscription confirm */}
      <AlertDialog open={cancelNativeSubConfirm !== null} onOpenChange={open => !open && setCancelNativeSubConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Learn Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              The subscription will be cancelled at the end of the current billing period. The user retains access until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelNativeSubConfirm && cancelNativeSub.mutate({ membershipSubscriptionId: cancelNativeSubConfirm.id, stripeSubscriptionId: cancelNativeSubConfirm.stripeSubId ?? undefined })}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke native subscription confirm */}
      <AlertDialog open={revokeNativeSubConfirm !== null} onOpenChange={open => { if (!open) setRevokeNativeSubConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Learn Membership?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately remove the user's membership access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 px-1 pb-2">
            <Checkbox id="revoke-native-sub-notify" checked={revokeNativeSubNotify} onCheckedChange={(v) => setRevokeNativeSubNotify(!!v)} />
            <Label htmlFor="revoke-native-sub-notify" className="text-sm font-normal cursor-pointer">Send email notification to student</Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeNativeSubConfirm !== null && revokeNativeSub.mutate({ membershipSubscriptionId: revokeNativeSubConfirm, sendNotification: revokeNativeSubNotify })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel LMS order subscription confirm */}
      <AlertDialog open={cancelLmsOrderConfirm !== null} onOpenChange={open => !open && setCancelLmsOrderConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Course Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              The subscription will be cancelled at the end of the current billing period. The student retains access until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelLmsOrderConfirm && cancelLmsOrderSub.mutate({ orderId: cancelLmsOrderConfirm.id })}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Admin Invoice View Component ───────────────────────────────────────────
function AdminInvoiceView({ t, fmtCurrency, fmtDate }: { t: any; fmtCurrency: (c: number, cur?: string) => string; fmtDate: (d: Date | string) => string }) {
  const lineItems: Array<{ name: string; amount: number; qty: number }> = (() => {
    if (Array.isArray(t.lineItems) && t.lineItems.length > 0) return t.lineItems;
    return [{ name: t.productName || 'Purchase', amount: t.amountPaid, qty: 1 }];
  })();
  const sourceLabel = {
    funnel: 'Funnel Purchase', course: 'Course', download: 'Digital Download',
    bundle: 'Bundle', physical: 'Physical Product', workshop: 'Workshop',
    webinar: 'Webinar', manual_invoice: 'Manual Invoice',
  }[t.sourceTable as string] ?? 'Purchase';
  return (
    <div id="admin-invoice-print-area" className="rounded-xl border border-gray-200 overflow-hidden text-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0e4a50] to-[#189aa1] px-5 py-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-bold tracking-tight">All About Ultrasound, Inc.</p>
            <p className="text-xs text-teal-100 mt-0.5">dba iHeartEcho</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-teal-100">Receipt / Invoice</p>
            {t.invoiceNumber && <p className="font-mono text-xs mt-0.5">{t.invoiceNumber}</p>}
          </div>
        </div>
      </div>
      {/* Bill To */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Bill To</p>
        <p className="font-semibold text-gray-800">{t.studentName}</p>
        {t.studentEmail && <p className="text-xs text-gray-500">{t.studentEmail}</p>}
      </div>
      {/* Meta */}
      <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Date</p>
          <p className="text-gray-700">{fmtDate(t.purchasedAt)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Type</p>
          <p className="text-gray-700">{sourceLabel}</p>
        </div>
        {t.paymentSource && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Payment Method</p>
            <p className="text-gray-700 capitalize">{t.paymentSource}</p>
          </div>
        )}
        {t.stripePaymentIntentId && (
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Transaction ID</p>
            <p className="font-mono text-xs text-gray-500 truncate">{t.stripePaymentIntentId}</p>
          </div>
        )}
      </div>
      {/* Line Items */}
      <div className="px-5 py-3 border-b border-gray-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left pb-1.5 font-semibold text-gray-500">Description</th>
              <th className="text-center pb-1.5 font-semibold text-gray-500 w-10">Qty</th>
              <th className="text-right pb-1.5 font-semibold text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-1.5 text-gray-700">{li.name}</td>
                <td className="py-1.5 text-center text-gray-500">{li.qty ?? 1}</td>
                <td className="py-1.5 text-right text-gray-700">{fmtCurrency(li.amount * (li.qty ?? 1), t.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Total */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <span className="font-bold text-gray-700">Total Paid</span>
        <span className="text-base font-bold text-[#0e4a50]">{fmtCurrency(t.amountPaid, t.currency)}</span>
      </div>
      {/* Status + Notes */}
      <div className="px-5 py-3 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Status</span>
          <span className="font-medium text-green-600 capitalize">{t.status}</span>
        </div>
        {t.notes && (
          <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800 border border-amber-100">
            <span className="font-semibold">Note: </span>{t.notes}
          </div>
        )}
      </div>
      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
        <p className="text-[10px] text-gray-400">All About Ultrasound, Inc. dba iHeartEcho &bull; allaboutultrasound.com</p>
        <p className="text-[10px] text-gray-400 mt-0.5">For support, contact hello@allaboutultrasound.com</p>
      </div>
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab({ userId, data: userData, refetch }: { userId: number; data: any; refetch: () => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch: refetchTxns } = trpc.productAnalytics.getUserTransactions.useQuery({ userId, page, pageSize: 50 });
  const [refundOpen, setRefundOpen] = useState<{ piId: string; purchaseId?: number } | null>(null);
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    description: '',
    lineItems: [{ name: '', amount: '', qty: '1' }],
    paidAt: new Date().toISOString().slice(0, 10),
    paymentSource: 'thinkific',
    notes: '',
    sendEmail: false,
  });
  const createInvoice = trpc.productAnalytics.createManualInvoice.useMutation({
    onSuccess: (res) => {
      toast.success(`Invoice ${res.invoiceNumber} created.`);
      setAddInvoiceOpen(false);
      setInvoiceForm({ description: '', lineItems: [{ name: '', amount: '', qty: '1' }], paidAt: new Date().toISOString().slice(0, 10), paymentSource: 'thinkific', notes: '', sendEmail: false });
      refetchTxns();
    },
    onError: (e) => toast.error(e.message),
  });

  const fmtCurrency = (cents: number, currency = "usd") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const STATUS_COLORS: Record<string, string> = {
    paid: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700",
    refunded: "bg-gray-100 text-gray-600", failed: "bg-red-100 text-red-700",
    completed: "bg-green-100 text-green-700", fulfilled: "bg-green-100 text-green-700",
    open: "bg-blue-50 text-blue-600",
  };
  const SOURCE_LABELS: Record<string, { label: string; cls: string }> = {
    funnel: { label: 'Funnel', cls: 'bg-purple-50 text-purple-600 border-purple-100' },
    course: { label: 'Course', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
    download: { label: 'Download', cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    bundle: { label: 'Bundle', cls: 'bg-violet-50 text-violet-600 border-violet-100' },
    physical: { label: 'Physical', cls: 'bg-orange-50 text-orange-600 border-orange-100' },
    workshop: { label: 'Workshop', cls: 'bg-rose-50 text-rose-600 border-rose-100' },
    webinar: { label: 'Webinar', cls: 'bg-sky-50 text-sky-600 border-sky-100' },
    manual_invoice: { label: 'Manual Invoice', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  };

  const refundPayment = trpc.adminUser.refundPayment.useMutation({
    onSuccess: (res) => { toast.success(`Refund issued (${res.refundId}).`); refetch(); setRefundOpen(null); },
    onError: (e) => toast.error(e.message),
  });

  const totalLineItemsCents = invoiceForm.lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0) * 100 * (parseInt(li.qty) || 1), 0);

  return (
    <div className="space-y-4">
      {/* Unified transactions list */}
      {(<>
      {/* Summary + Add Transaction button */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-700">Transaction History</span>
        <button
          onClick={() => setAddInvoiceOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Add Transaction
        </button>
      </div>
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
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
              ) : (data?.transactions ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No transactions found</td></tr>
              ) : (data?.transactions ?? []).map((t: any, i: number) => (
                <tr key={`${t.sourceTable}-${t.transactionId}-${i}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900 text-sm">{t.productName}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {SOURCE_LABELS[t.sourceTable] && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${SOURCE_LABELS[t.sourceTable].cls}`}>
                          {SOURCE_LABELS[t.sourceTable].label}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 capitalize">{t.productType}</span>
                      {t.orderType === "subscription" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-600 border border-purple-100">subscription</span>
                      )}
                    </div>
                    {t.stripePaymentIntentId && (
                      <div className="text-xs text-gray-300 font-mono mt-0.5 truncate max-w-[200px]">{t.stripePaymentIntentId}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(t.purchasedAt)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 text-sm whitespace-nowrap">
                    {fmtCurrency(t.amountPaid, t.currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <button
                        onClick={() => setViewInvoice({ ...t, studentName: userData?.user?.displayName ?? userData?.user?.name ?? 'Student', studentEmail: userData?.user?.email ?? '' })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                      >
                        <FileText className="w-3 h-3" /> Invoice
                      </button>
                      {t.stripePaymentIntentId && t.status !== "refunded" && (
                        <button
                          onClick={() => setRefundOpen({ piId: t.stripePaymentIntentId })}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                        >
                          Refund
                        </button>
                      )}
                    </div>
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
      </>)}

      {/* Add Invoice dialog */}
      {addInvoiceOpen && (
        <Dialog open onOpenChange={() => setAddInvoiceOpen(false)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Manual Transaction</DialogTitle>
              <DialogDescription>Create a manual invoice record for this student. No Stripe payment is processed.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">Description *</Label>
                <input
                  value={invoiceForm.description}
                  onChange={e => setInvoiceForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. iHeartEcho Lifetime Premium Access"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">Line Items *</Label>
                <div className="space-y-2">
                  {invoiceForm.lineItems.map((li, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={li.name}
                        onChange={e => setInvoiceForm(f => ({ ...f, lineItems: f.lineItems.map((l, i) => i === idx ? { ...l, name: e.target.value } : l) }))}
                        placeholder="Item name"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <input
                        value={li.amount}
                        onChange={e => setInvoiceForm(f => ({ ...f, lineItems: f.lineItems.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l) }))}
                        placeholder="$0.00"
                        type="number" step="0.01" min="0"
                        className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {invoiceForm.lineItems.length > 1 && (
                        <button onClick={() => setInvoiceForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setInvoiceForm(f => ({ ...f, lineItems: [...f.lineItems, { name: '', amount: '', qty: '1' }] }))}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                  >+ Add line item</button>
                </div>
                <div className="text-right text-sm font-semibold text-gray-800 mt-2">
                  Total: {fmtCurrency(totalLineItemsCents)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-700 mb-1 block">Payment Date *</Label>
                  <input
                    type="date"
                    value={invoiceForm.paidAt}
                    onChange={e => setInvoiceForm(f => ({ ...f, paidAt: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-700 mb-1 block">Payment Source</Label>
                  <Select value={invoiceForm.paymentSource} onValueChange={v => setInvoiceForm(f => ({ ...f, paymentSource: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thinkific">Thinkific</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="wire">Wire Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">Notes (optional)</Label>
                <textarea
                  value={invoiceForm.notes}
                  onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal notes about this transaction..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sendEmail"
                  checked={invoiceForm.sendEmail}
                  onCheckedChange={v => setInvoiceForm(f => ({ ...f, sendEmail: !!v }))}
                />
                <label htmlFor="sendEmail" className="text-sm text-gray-700 cursor-pointer">Send receipt email to student</label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddInvoiceOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const validItems = invoiceForm.lineItems.filter(li => li.name.trim() && parseFloat(li.amount) > 0);
                  if (!invoiceForm.description.trim() || validItems.length === 0 || !invoiceForm.paidAt) {
                    toast.error('Please fill in description, at least one line item with amount, and payment date.');
                    return;
                  }
                  createInvoice.mutate({
                    userId,
                    description: invoiceForm.description,
                    lineItems: validItems.map(li => ({ name: li.name, amount: Math.round(parseFloat(li.amount) * 100), qty: parseInt(li.qty) || 1 })),
                    amountPaid: Math.round(totalLineItemsCents),
                    currency: 'usd',
                    paidAt: invoiceForm.paidAt,
                    paymentSource: invoiceForm.paymentSource || undefined,
                    notes: invoiceForm.notes || undefined,
                    sendEmail: invoiceForm.sendEmail,
                  });
                }}
                disabled={createInvoice.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {createInvoice.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* View Invoice Modal */}
      {viewInvoice && (
        <Dialog open onOpenChange={() => setViewInvoice(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Invoice / Receipt</DialogTitle>
              <DialogDescription>Official payment record</DialogDescription>
            </DialogHeader>
            <AdminInvoiceView t={viewInvoice} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => {
                const el = document.getElementById('admin-invoice-print-area');
                if (!el) return;
                const win = window.open('', '_blank');
                if (!win) return;
                win.document.write(`<!DOCTYPE html><html><head><title>Invoice</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:32px;color:#1e293b}*{box-sizing:border-box}@media print{body{padding:0}}</style></head><body>${el.innerHTML}</body></html>`);
                win.document.close();
                win.focus();
                setTimeout(() => { win.print(); win.close(); }, 400);
              }} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Print / Save PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewInvoice(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Refund dialog */}
      {refundOpen && (
        <Dialog open onOpenChange={() => setRefundOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue Refund</DialogTitle>
              <DialogDescription>This will refund the full amount for payment intent {refundOpen.piId}.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundOpen(null)}>Cancel</Button>
              <Button
                onClick={() => refundPayment.mutate({ paymentIntentId: refundOpen.piId, purchaseId: refundOpen.purchaseId })}
                disabled={refundPayment.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {refundPayment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirm Refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
const toET = (ts: any) => {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "numeric", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }) + " ET";
  } catch { return String(ts); }
};

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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data, isLoading } = trpc.adminUser.getUserEmailHistory.useQuery({ userId, page, pageSize: 25 });
  const emails = data?.emails ?? [];

  const resendEmail = trpc.adminUser.resendEmailFromLog.useMutation({
    onSuccess: () => toast.success("Email resent successfully."),
    onError: (e) => toast.error(e.message),
  });

  const parseMetadata = (raw: string | null) => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

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
              <th className="px-4 py-3" />
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
            ) : emails.map((e: any) => {
              const meta = parseMetadata(e.metadata);
              const isExpanded = expandedId === e.id;
              return (
                <>
                  <tr key={e.id} onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer">
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
                      {toET(e.sentAt)}
                    </td>
                    <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                      <button
                        onClick={() => resendEmail.mutate({ emailLogId: e.id })}
                        disabled={resendEmail.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 whitespace-nowrap"
                      >
                        <RefreshCw className="w-3 h-3" /> Resend
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${e.id}-expand`} className="bg-slate-50">
                      <td colSpan={4} className="px-6 py-3">
                        <div className="text-xs text-slate-600 space-y-1">
                          <p className="font-semibold text-slate-700 mb-1">Email Details</p>
                          <p><span className="text-slate-400">Subject:</span> {e.subject}</p>
                          <p><span className="text-slate-400">Type:</span> {COMM_TYPE_LABELS[e.emailType] ?? e.emailType}</p>
                          <p><span className="text-slate-400">Status:</span> {e.status}</p>
                          <p><span className="text-slate-400">Sent:</span> {toET(e.sentAt)}</p>
                          {e.campaignSubject && <p><span className="text-slate-400">Campaign:</span> {e.campaignSubject}</p>}
                          {meta && Object.keys(meta).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="font-semibold text-slate-700 mb-1">Metadata</p>
                              {Object.entries(meta).map(([k, v]) => (
                                <p key={k}><span className="text-slate-400">{k}:</span> {String(v)}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
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
// ─── Course Progress Drill-Down Panel ────────────────────────────────────────
function CourseProgressPanel({ userId, enrollmentId, courseTitle, onClose }: {
  userId: number; enrollmentId: number; courseTitle: string; onClose: () => void;
}) {
  const { data, isLoading } = trpc.adminUser.getUserCourseProgress.useQuery({ userId, enrollmentId });

  const LESSON_TYPE_COLORS: Record<string, string> = {
    video: "bg-purple-100 text-purple-700",
    text: "bg-gray-100 text-gray-600",
    quiz: "bg-amber-100 text-amber-700",
    download: "bg-indigo-100 text-indigo-700",
    embed: "bg-blue-100 text-blue-700",
    video_text: "bg-violet-100 text-violet-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">{courseTitle}</h4>
          {data && (
            <p className="text-xs text-gray-500 mt-0.5">
              {data.completedLessons} / {data.totalLessons} lessons completed
              {data.enrollment.completedAt ? " · Course completed " + toET(data.enrollment.completedAt) : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#189aa1] rounded-full transition-all"
                  style={{ width: `${data.progressPct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600">{data.progressPct}%</span>
            </div>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading lesson progress…
          </div>
        ) : !data?.lessonProgress.length ? (
          <div className="text-center py-8 text-gray-400 text-sm">No lessons found for this course.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">#</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Lesson</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Completed</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Quiz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.lessonProgress.map((l: any, idx: number) => (
                <tr key={l.id} className={l.completed ? "bg-emerald-50/40" : "hover:bg-gray-50"}>
                  <td className="px-4 py-2 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs">
                    <p className="truncate text-xs font-medium">{l.title}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${LESSON_TYPE_COLORS[l.type] ?? "bg-gray-100 text-gray-600"}`}>
                      {l.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {l.completed ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {l.completedAt ? toET(l.completedAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {l.type === "quiz" && l.attempts > 0 ? (
                      <span className={`font-medium ${l.quizPassed ? "text-emerald-600" : "text-red-500"}`}>
                        {l.quizScore ?? "??"}% {l.quizPassed ? "✓" : "✗"}
                        {l.attempts > 1 ? <span className="text-gray-400 ml-1">({l.attempts}x)</span> : null}
                      </span>
                    ) : l.type === "quiz" ? (
                      <span className="text-gray-400">Not attempted</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ActivityTab({ userId, enrollments }: { userId: number; enrollments?: any[] }) {
  const [page, setPage] = useState(1);
  const [progressPanel, setProgressPanel] = useState<{ enrollmentId: number; courseTitle: string } | null>(null);
  const { data, isLoading } = trpc.adminUser.getUserActivityLog.useQuery({ userId, page, pageSize: 50 });
  const events = data?.events ?? [];

  const exportCSV = () => {
    if (!events.length) return;
    const header = ["Event", "Description", "Path", "IP", "Time (ET)"];
    const csvRows = events.map((e: any) => [
      e.eventType,
      `"${(e.description ?? "").replace(/"/g, '""')}"`,
      e.path ?? "",
      e.ipAddress ?? "",
      toET(e.createdAt),
    ]);
    const csv = [header, ...csvRows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `activity-log-user-${userId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

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
    <div className="space-y-6">
      {/* Course Progress Drill-Down */}
      {(enrollments ?? []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Course Progress</h3>
            <span className="text-xs text-gray-400">{(enrollments ?? []).length} enrollment{(enrollments ?? []).length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {(enrollments ?? []).map((enr: any) => (
              <div key={enr.enrollmentId ?? enr.id}>
                <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <BookOpen className="w-4 h-4 text-[#189aa1] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{enr.courseTitle ?? enr.title ?? "Course"}</p>
                      <p className="text-xs text-gray-400">Enrolled {toET(enr.enrolledAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#189aa1] rounded-full" style={{ width: `${enr.progressPct ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{enr.progressPct ?? 0}%</span>
                    </div>
                    <button
                      onClick={() => setProgressPanel(
                        progressPanel?.enrollmentId === (enr.enrollmentId ?? enr.id)
                          ? null
                          : { enrollmentId: enr.enrollmentId ?? enr.id, courseTitle: enr.courseTitle ?? enr.title ?? "Course" }
                      )}
                      className="text-xs px-2.5 py-1 border border-[#189aa1] text-[#189aa1] rounded-lg hover:bg-teal-50 transition-colors"
                    >
                      {progressPanel?.enrollmentId === (enr.enrollmentId ?? enr.id) ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>
                {progressPanel?.enrollmentId === (enr.enrollmentId ?? enr.id) && (
                  <div className="mt-1">
                    <CourseProgressPanel
                      userId={userId}
                      enrollmentId={enr.enrollmentId ?? enr.id}
                      courseTitle={progressPanel.courseTitle}
                      onClose={() => setProgressPanel(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Activity Log</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{(data?.total ?? 0).toLocaleString()} total events</span>
          <button onClick={exportCSV} disabled={events.length === 0}
            className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1">
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>
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
                    {toET(e.createdAt)}
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

  const exportCSV = () => {
    if (!logins.length) return;
    const header = ["Date & Time (ET)", "IP Address", "Country", "Device / Browser"];
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
    const csvRows = logins.map((l: any) => [
      toET(l.createdAt),
      l.ipAddress ?? "",
      l.country ?? "",
      [parseUA(l.userAgent), parseBrowser(l.userAgent)].filter(Boolean).join(" / "),
    ]);
    const csv = [header, ...csvRows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `login-history-user-${userId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

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
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{(data?.total ?? 0).toLocaleString()} total logins</span>
          <button onClick={exportCSV} disabled={logins.length === 0}
            className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1">
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>
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
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{toET(l.createdAt)}</td>
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

// ─── Teams Tab ───────────────────────────────────────────────────────────────
function TeamsTab({ userId, data }: { userId: number; data: any }) {
  const teamSeats: any[] = data?.teamSeats ?? [];
  const nativeMemberships: any[] = data?.nativeMemberships ?? [];

  // Group seats by groupId
  const groupsMap = new Map<number, { groupId: number; groupName: string; orgName: string | null; adminEmail: string | null; adminPhone: string | null; orgWebsite: string | null; groupNotes: string | null; groupCreatedAt: any; seats: any[] }>();
  for (const seat of teamSeats) {
    if (!groupsMap.has(seat.groupId)) {
      groupsMap.set(seat.groupId, {
        groupId: seat.groupId,
        groupName: seat.groupName,
        orgName: seat.orgName,
        adminEmail: seat.adminEmail,
        adminPhone: seat.adminPhone,
        orgWebsite: seat.orgWebsite,
        groupNotes: seat.groupNotes,
        groupCreatedAt: seat.groupCreatedAt,
        seats: [],
      });
    }
    groupsMap.get(seat.groupId)!.seats.push(seat);
  }
  const groups = Array.from(groupsMap.values());

  const seatStatusColor = (s: string) =>
    s === "active" ? "bg-green-100 text-green-700" :
    s === "pending" ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";

  const membershipStatusColor = (s: string) =>
    s === "active" ? "bg-green-100 text-green-700" :
    s === "trialing" ? "bg-blue-100 text-blue-700" :
    s === "canceled" ? "bg-red-100 text-red-700" :
    "bg-gray-100 text-gray-600";

  const billingLabel: Record<string, string> = {
    monthly: "/month", annual: "/year", lifetime: " (lifetime)", one_time: "",
  };

  return (
    <div className="space-y-8">
      {/* Team Organizations */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users2 className="w-5 h-5 text-[#189aa1]" />
          <h2 className="text-lg font-semibold text-gray-800">Team Organizations</h2>
          <span className="ml-auto text-xs text-gray-400">{groups.length} organization{groups.length !== 1 ? "s" : ""}</span>
        </div>

        {groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
            <Users2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">This student is not part of any team organization.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <div key={group.groupId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-start gap-3 p-4 border-b border-gray-50 bg-[#f0fbfc]/60">
                  <div className="w-9 h-9 rounded-lg bg-[#189aa1]/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-[#189aa1]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{group.groupName}</p>
                    {group.orgName && <p className="text-xs text-gray-500">{group.orgName}</p>}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {group.adminEmail && (
                        <a href={`mailto:${group.adminEmail}`} className="text-xs text-[#189aa1] hover:underline flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {group.adminEmail}
                        </a>
                      )}
                      {group.orgWebsite && (
                        <a href={group.orgWebsite} target="_blank" rel="noreferrer" className="text-xs text-[#189aa1] hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> {group.orgWebsite}
                        </a>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/admin/lms?tab=groups&groupId=${group.groupId}`}
                    className="text-xs text-gray-400 hover:text-[#189aa1] flex items-center gap-1 shrink-0"
                  >
                    <ChevronRight className="w-3.5 h-3.5" /> View Team
                  </a>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Seat Assignments</p>
                  <div className="space-y-2">
                    {group.seats.map((seat: any) => (
                      <div key={seat.seatId} className="flex items-center gap-3 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${seatStatusColor(seat.seatStatus)}`}>
                          {seat.seatStatus}
                        </span>
                        {seat.courseTitle ? (
                          <span className="text-gray-700 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-gray-400" /> {seat.courseTitle}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-xs">No course linked</span>
                        )}
                        <span className="ml-auto text-xs text-gray-400">
                          {seat.acceptedAt
                            ? `Accepted ${new Date(seat.acceptedAt).toLocaleDateString()}`
                            : `Assigned ${new Date(seat.assignedAt).toLocaleDateString()}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Native Membership Subscriptions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-[#189aa1]" />
          <h2 className="text-lg font-semibold text-gray-800">Membership Subscriptions</h2>
          <span className="ml-auto text-xs text-gray-400">{nativeMemberships.length} membership{nativeMemberships.length !== 1 ? "s" : ""}</span>
        </div>

        {nativeMemberships.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
            <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No membership subscriptions found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nativeMemberships.map((ms: any) => (
              <div key={ms.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-[#189aa1]/10 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-[#189aa1]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{ms.planTitle}</p>
                  <p className="text-xs text-gray-500">
                    {ms.brand && <span className="mr-2 capitalize">{ms.brand}</span>}
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: ms.currency }).format(ms.price / 100)}
                    {billingLabel[ms.billingInterval] ?? ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${membershipStatusColor(ms.status)}`}>
                    {ms.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    Since {new Date(ms.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profile",        label: "Profile",        icon: User },
  { key: "content",        label: "Content",         icon: BookOpen },
  { key: "transactions",   label: "Transactions",    icon: DollarSign },
  { key: "subscriptions",  label: "Subscriptions",   icon: CreditCard },
  { key: "teams",          label: "Teams",           icon: Users2 },
  { key: "certificates",   label: "Certificates",    icon: Award },
  { key: "cme",            label: "CME",             icon: Award },
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

  const isAdmin = !loading && !!adminUser && adminUser.role === "admin";
  const { data, isLoading, error, refetch } = trpc.adminUser.getUserDetail.useQuery(
    { userId: userId! },
    { enabled: !!userId && isAdmin, retry: false }
  );

  if (loading || (isAdmin && isLoading)) {
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

  if (error || !data) {
    const errMsg = (error as any)?.message ?? "User not found.";
    const isForbidden = (error as any)?.data?.code === "FORBIDDEN";
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <p className="text-gray-500">{isForbidden ? "Access denied. Please ensure you are logged in as an admin." : errMsg}</p>
          <button onClick={() => refetch()} className="text-sm text-teal-600 hover:underline">Try again</button>
          <button onClick={() => navigate("/admin/members")} className="text-sm text-gray-400 hover:underline">← Back to Members</button>
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
                onClick={() => { window.location.href = "https://app.allaboutultrasound.com/admin/members?tab=all-members"; }}
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
          {activeTab === "transactions"  && <TransactionsTab  userId={userId!} data={data} refetch={refetch} />}
          {activeTab === "subscriptions" && <SubscriptionsTab userId={userId!} data={data} refetch={refetch} />}
          {activeTab === "certificates"   && <CertificatesTab   userId={userId!} data={data} refetch={refetch} />}
          {activeTab === "cme"            && userId && <SdmsCmeUserTab userId={userId} />}
          {activeTab === "communications"  && <CommunicationsTab userId={userId!} />}
          {activeTab === "activity"      && <ActivityTab      userId={userId!} enrollments={data?.enrollments} />}
          {activeTab === "logins"        && <LoginsTab        userId={userId!} />}
          {activeTab === "teams"         && <TeamsTab         userId={userId!} data={data} />}
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
