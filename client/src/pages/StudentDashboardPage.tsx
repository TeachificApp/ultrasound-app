/**
 * StudentDashboardPage.tsx
 * Unified cross-app Student Dashboard — accessible from AAUS, iHeartEcho, and LMS.
 *
 * Four tabs (deep-linkable via ?tab=):
 *   1. profile       — edit avatar, name, email, password
 *   2. content       — all purchased/enrolled courses, quizzes, downloads, products (both brands)
 *   3. subscriptions — native Stripe subs + Thinkific memberships (both brands)
 *   4. certificates  — earned certificates (both brands)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import {
  User, BookOpen, CreditCard, Award, Camera, Save, Lock, Eye, EyeOff,
  ExternalLink, Download, Play, FileText, Package, AlertCircle, CheckCircle2,
  Clock, XCircle, RefreshCw, Loader2, ChevronRight, ClipboardCheck, ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Layout from "@/components/Layout";

// ─── Brand config ─────────────────────────────────────────────────────────────

const BRAND_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  aaus: {
    label: "All About Ultrasound",
    color: "#189aa1",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
  iheartecho: {
    label: "iHeartEcho",
    color: "#e05c8a",
    bg: "bg-pink-50",
    border: "border-pink-200",
  },
};

function BrandBadge({ brand }: { brand?: string | null }) {
  if (!brand) return null;
  const cfg = BRAND_CONFIG[brand] ?? { label: brand, color: "#6b7280", bg: "bg-gray-50", border: "border-gray-200" };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.border}`}
      style={{ color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    processing: { label: "Processing", color: "bg-blue-100 text-blue-700 border-blue-200" },
    shipped:    { label: "Shipped",    color: "bg-teal-100 text-teal-700 border-teal-200" },
    delivered:  { label: "Delivered",  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    refunded:   { label: "Refunded",   color: "bg-purple-100 text-purple-700 border-purple-200" },
    trialing:   { label: "Trial",      color: "bg-blue-100 text-blue-700 border-blue-200" },
    past_due:   { label: "Past Due",   color: "bg-red-100 text-red-700 border-red-200" },
    incomplete: { label: "Incomplete", color: "bg-amber-100 text-amber-700 border-amber-200" },
  };
  const cfg = map[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = "profile" | "content" | "subscriptions" | "certificates";
const VALID_TABS: Tab[] = ["profile", "content", "subscriptions", "certificates"];

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.dashboard.getProfile.useQuery();
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully.");
      utils.dashboard.getProfile.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadAvatar = trpc.auth.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Avatar updated.");
      utils.dashboard.getProfile.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const requestEmailChange = trpc.auth.requestEmailChange.useMutation({
    onSuccess: (data) => {
      toast.success(`Verification email sent to ${data.pendingEmail}. Please check your inbox.`);
      setEmailChangeOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully.");
      setPasswordForm({ current: "", newPw: "", confirm: "" });
      setPasswordOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [locationVal, setLocationVal] = useState("");
  const [website, setWebsite] = useState("");
  const [initialized, setInitialized] = useState(false);

  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", newPw: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  if (profile && !initialized) {
    setDisplayName(profile.displayName ?? profile.name ?? "");
    setBio(profile.bio ?? "");
    setSpecialty(profile.specialty ?? "");
    setLocationVal(profile.location ?? "");
    setWebsite(profile.website ?? "");
    setInitialized(true);
  }

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Image must be under 4 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUri = ev.target?.result as string;
      uploadAvatar.mutate({ dataUri, mimeType: file.type as any });
    };
    reader.readAsDataURL(file);
  }, [uploadAvatar]);

  if (isLoading) return <LoadingSpinner />;
  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Avatar */}
      <div className="flex items-center gap-6">
        <div className="relative">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-[#189aa1]/20 shadow" />
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow"
              style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
              {(profile.displayName ?? profile.name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#189aa1] text-white flex items-center justify-center shadow hover:bg-[#157f85] transition-colors"
          >
            {uploadAvatar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{profile.displayName ?? profile.name ?? "Your Profile"}</h2>
          <p className="text-sm text-gray-500">{profile.email}</p>
          <p className="text-xs text-gray-400 mt-1">Member since {formatDate(profile.createdAt)}</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Basic Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="specialty">Specialty</Label>
            <Input id="specialty" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="e.g. Vascular Sonographer" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={locationVal} onChange={e => setLocationVal(e.target.value)} placeholder="City, State" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} />
        </div>
        <Button
          onClick={() => updateProfile.mutate({ displayName, bio, specialty, location: locationVal, website: website || undefined })}
          disabled={updateProfile.isPending}
          className="bg-[#189aa1] hover:bg-[#157f85] text-white"
        >
          {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Email */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Email Address</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">{profile.email}</p>
            {profile.emailVerified ? (
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5"><CheckCircle2 className="w-3 h-3" /> Verified</p>
            ) : (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3" /> Not verified</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEmailChangeOpen(true)}>Change Email</Button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Password</h3>
        {profile.hasPassword ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">Your account uses email/password login.</p>
            <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Change Password
            </Button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Your account uses OAuth login (no password set).</p>
        )}
      </div>

      {/* Email Change Dialog */}
      <Dialog open={emailChangeOpen} onOpenChange={setEmailChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
            <DialogDescription>We will send a verification link to your new email address.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="newEmail">New Email Address</Label>
            <Input id="newEmail" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@example.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailChangeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => requestEmailChange.mutate({ newEmail, origin: window.location.origin })}
              disabled={requestEmailChange.isPending || !newEmail}
              className="bg-[#189aa1] hover:bg-[#157f85] text-white"
            >
              {requestEmailChange.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={passwordForm.current}
                  onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))}
                  placeholder="Current password"
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={passwordForm.newPw}
                  onChange={e => setPasswordForm(f => ({ ...f, newPw: e.target.value }))}
                  placeholder="At least 8 characters"
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={passwordForm.confirm}
                onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (passwordForm.newPw !== passwordForm.confirm) { toast.error("Passwords do not match."); return; }
                changePassword.mutate({ currentPassword: passwordForm.current, newPassword: passwordForm.newPw });
              }}
              disabled={changePassword.isPending || !passwordForm.current || !passwordForm.newPw}
              className="bg-[#189aa1] hover:bg-[#157f85] text-white"
            >
              {changePassword.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── My Content Tab ───────────────────────────────────────────────────────────

type ContentSubTab = "courses" | "quizzes" | "downloads" | "products" | "purchases";

function MyContentTab() {
  const { data, isLoading } = trpc.dashboard.getMyContent.useQuery();
  const [contentTab, setContentTab] = useState<ContentSubTab>("courses");

  if (isLoading) return <LoadingSpinner />;

  const subTabs: { key: ContentSubTab; label: string; icon: React.ElementType; count: number }[] = [
    { key: "courses",   label: "Courses",   icon: BookOpen,       count: data?.courses.length ?? 0 },
    { key: "quizzes",   label: "Quizzes",   icon: ClipboardCheck, count: data?.quizzes.length ?? 0 },
    { key: "downloads", label: "Downloads", icon: Download,       count: data?.downloads.length ?? 0 },
    { key: "products",  label: "Products",  icon: Package,        count: data?.physicalProducts.length ?? 0 },
    { key: "purchases", label: "Purchases",  icon: ShoppingCart,   count: data?.funnelPurchases?.length ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setContentTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              contentTab === t.key ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
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
          {(data?.courses.length ?? 0) === 0 ? (
            <EmptyState icon={BookOpen} title="No courses yet" description="Enroll in a course to see it here." />
          ) : (
            data?.courses.map(c => (
              <ContentCard
                key={c.enrollmentId}
                thumbnail={c.courseThumbnail}
                title={c.courseTitle}
                brand={c.courseBrand}
                subtitle={`Enrolled ${formatDate(c.enrolledAt)}`}
                badge={c.completedAt ? "Completed" : `${c.progressPct ?? 0}% complete`}
                badgeColor={c.completedAt ? "emerald" : "teal"}
                actions={[
                  { label: "Continue Learning", icon: Play, href: `/learn/${c.courseSlug}/player` },
                  { label: "Overview", icon: FileText, href: `/learn/${c.courseSlug}/overview` },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* Quizzes */}
      {contentTab === "quizzes" && (
        <div className="space-y-3">
          {(data?.quizzes.length ?? 0) === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No quizzes yet" description="Purchase or enroll in a quiz to see it here." />
          ) : (
            data?.quizzes.map(q => (
              <ContentCard
                key={q.enrollmentId}
                thumbnail={q.courseThumbnail}
                title={q.courseTitle}
                brand={q.courseBrand}
                subtitle={`Enrolled ${formatDate(q.enrolledAt)}`}
                badge={q.completedAt ? "Completed" : "In Progress"}
                badgeColor={q.completedAt ? "emerald" : "blue"}
                actions={[
                  { label: "Take Quiz", icon: Play, href: `/learn/${q.courseSlug}/player` },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* Downloads */}
      {contentTab === "downloads" && (
        <div className="space-y-3">
          {(data?.downloads.length ?? 0) === 0 ? (
            <EmptyState icon={Download} title="No downloads yet" description="Purchase a digital download to see it here." />
          ) : (
            (data?.downloads ?? []).map((d: any, i: number) => (
              <ContentCard
                key={d.enrollmentId ?? d.purchaseId ?? i}
                thumbnail={d.courseThumbnail ?? d.productThumbnail}
                title={d.courseTitle ?? d.productTitle}
                brand={d.courseBrand}
                subtitle={`Purchased ${formatDate(d.enrolledAt ?? d.purchasedAt)}`}
                badge="Download"
                badgeColor="teal"
                actions={[
                  {
                    label: "Access Files",
                    icon: Download,
                    href: d.courseSlug ? `/learn/${d.courseSlug}/player` : `/downloads/${d.productSlug}/files`,
                  },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* Physical Products */}
      {contentTab === "products" && (
        <div className="space-y-3">
          {(data?.physicalProducts.length ?? 0) === 0 ? (
            <EmptyState icon={Package} title="No product orders yet" description="Purchase a physical product to see your orders here." />
          ) : (
            data?.physicalProducts.map(p => (
              <ContentCard
                key={p.orderId}
                thumbnail={p.productThumbnail}
                title={p.productTitle}
                subtitle={`Ordered ${formatDate(p.orderedAt)} · ${formatCurrency(p.amountPaid, p.currency)}`}
                badge={p.fulfillmentStatus}
                badgeColor={p.fulfillmentStatus === "delivered" ? "emerald" : p.fulfillmentStatus === "shipped" ? "teal" : "amber"}
                trackingInfo={p.trackingNumber ? `${p.trackingCarrier ?? ""} ${p.trackingNumber}`.trim() : undefined}
                actions={[
                  { label: "View Product", icon: ExternalLink, href: `/products/${p.productSlug}` },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* Funnel / Embedded Checkout Purchases */}
      {contentTab === "purchases" && (
        <div className="space-y-3">
          {(data?.funnelPurchases?.length ?? 0) === 0 ? (
            <EmptyState icon={ShoppingCart} title="No purchases yet" description="Complete a checkout to see your purchases here." />
          ) : (
            (data?.funnelPurchases ?? []).map((p: any) => (
              <ContentCard
                key={p.id}
                title={p.productName}
                subtitle={`Purchased ${formatDate(p.purchasedAt)} · ${formatCurrency(p.amountPaid, p.currency)}`}
                badge={p.productType ?? "Purchase"}
                badgeColor="teal"
                actions={[
                  { label: "View Receipt", icon: FileText, href: `/my-dashboard?tab=content` },
                ]}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────

function SubscriptionsTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.dashboard.getMySubscriptions.useQuery();
  const cancelSub = trpc.dashboard.cancelSubscription.useMutation({
    onSuccess: (res) => { toast.success(res.message); utils.dashboard.getMySubscriptions.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const reactivateSub = trpc.dashboard.reactivateSubscription.useMutation({
    onSuccess: (res) => { toast.success(res.message); utils.dashboard.getMySubscriptions.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);

  if (isLoading) return <LoadingSpinner />;

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No active subscriptions"
        description="Subscribe to a premium plan to unlock full access."
        action={{ label: "View Plans", href: "/premium" }}
      />
    );
  }

  // Group by brand for display
  const byBrand: Record<string, typeof data> = {};
  for (const sub of data) {
    const b = sub.brand ?? "other";
    if (!byBrand[b]) byBrand[b] = [];
    byBrand[b].push(sub);
  }

  return (
    <div className="space-y-6">
      {Object.entries(byBrand).map(([brand, subs]) => {
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

            <div className="space-y-4">
              {subs.map(sub => {
                const isThinkific = sub.isThinkific;
                const isCancelPending = sub.stripe?.cancelAtPeriodEnd === true;
                const tierLabel = sub.tier === "premium" ? "Premium" : sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1);

                return (
                  <div key={sub.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{tierLabel} Membership</span>
                          <StatusBadge status={sub.stripe?.status ?? sub.status} />
                          {isCancelPending && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                              <XCircle className="w-3 h-3" /> Cancels at period end
                            </span>
                          )}
                          {isThinkific && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                              Thinkific
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 space-y-0.5">
                          {sub.stripe?.amount != null && (
                            <p>{formatCurrency(sub.stripe.amount, sub.stripe.currency ?? "usd")} / {sub.stripe.interval}</p>
                          )}
                          {sub.stripe?.currentPeriodEnd && (
                            <p className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {isCancelPending ? "Access until" : "Renews"}: {formatDate(sub.stripe.currentPeriodEnd)}
                            </p>
                          )}
                          {!sub.stripe && sub.expiresAt && (
                            <p className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Expires: {formatDate(sub.expiresAt)}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">Granted: {formatDate(sub.grantedAt)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        {isThinkific ? (
                          <a
                            href={sub.thinkificManageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200"
                          >
                            Manage on Thinkific <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : sub.stripeSubscriptionId ? (
                          isCancelPending ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reactivateSub.mutate({ membershipId: sub.id })}
                              disabled={reactivateSub.isPending}
                              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            >
                              {reactivateSub.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmCancel(sub.id)}
                              disabled={sub.stripe?.status === "cancelled" || sub.stripe?.status === "canceled"}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Cancel
                            </Button>
                          )
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Cancel confirmation */}
      <AlertDialog open={confirmCancel !== null} onOpenChange={open => !open && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of the current billing period. You will not be charged again after that.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCancel !== null) {
                  cancelSub.mutate({ membershipId: confirmCancel });
                  setConfirmCancel(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Certificates Tab ─────────────────────────────────────────────────────────

function CertificatesTab() {
  const { data, isLoading } = trpc.dashboard.getMyCertificates.useQuery();

  if (isLoading) return <LoadingSpinner />;

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title="No certificates yet"
        description="Complete a course to earn your certificate of completion."
        action={{ label: "Browse Courses", href: "/education-library" }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {data.map(cert => (
        <div key={cert.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex gap-4 items-start">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
            <Award className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-800 text-sm leading-tight">{cert.courseTitle}</h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <BrandBadge brand={cert.courseBrand} />
              <p className="text-xs text-gray-500">Issued {formatDate(cert.issuedAt)}</p>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <a
                href={cert.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#189aa1] text-white hover:bg-[#157f85] transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </a>
              <a
                href={`/learn/${cert.courseSlug}/overview`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                Course
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
    </div>
  );
}

function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg, #189aa115, #4ad9e015)" }}>
        <Icon className="w-7 h-7 text-[#189aa1]" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs">{description}</p>
      {action && (
        <button
          onClick={() => navigate(action.href)}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[#189aa1] text-white hover:bg-[#157f85] transition-colors"
        >
          {action.label} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function ContentCard({
  thumbnail, title, brand, subtitle, badge, badgeColor, trackingInfo, actions,
}: {
  thumbnail?: string | null;
  title: string;
  brand?: string | null;
  subtitle: string;
  badge: string;
  badgeColor: "emerald" | "teal" | "blue" | "amber";
  trackingInfo?: string;
  actions: { label: string; icon: React.ElementType; href: string }[];
}) {
  const colorMap = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    teal:    "bg-teal-100 text-teal-700 border-teal-200",
    blue:    "bg-blue-100 text-blue-700 border-blue-200",
    amber:   "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 items-start">
      {thumbnail ? (
        <img src={thumbnail} alt={title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
      ) : (
        <div className="w-16 h-16 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #189aa115, #4ad9e015)" }}>
          <BookOpen className="w-7 h-7 text-[#189aa1]" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h4 className="font-semibold text-gray-800 text-sm leading-tight">{title}</h4>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${colorMap[badgeColor]}`}>
            {badge}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {brand && <BrandBadge brand={brand} />}
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        {trackingInfo && (
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Package className="w-3 h-3" /> {trackingInfo}
          </p>
        )}
        <div className="flex gap-2 mt-3 flex-wrap">
          {actions.map(a => (
            <a
              key={a.label}
              href={a.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#189aa1] text-white hover:bg-[#157f85] transition-colors"
            >
              <a.icon className="w-3 h-3" />
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profile",       label: "Profile",       icon: User },
  { key: "content",       label: "My Content",    icon: BookOpen },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "certificates",  label: "Certificates",  icon: Award },
];

export default function StudentDashboardPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  // Parse ?tab= from URL
  const urlTab = new URLSearchParams(search).get("tab") as Tab | null;
  const initialTab: Tab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : "profile";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Keep URL in sync when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(search);
    params.set("tab", tab);
    navigate(`/my-dashboard?${params.toString()}`, { replace: true });
  };

  // Sync if URL changes externally (e.g. back/forward)
  useEffect(() => {
    const t = new URLSearchParams(search).get("tab") as Tab | null;
    if (t && VALID_TABS.includes(t) && t !== activeTab) setActiveTab(t);
  }, [search]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#f0fbfc]">
        {/* Header */}
        <div className="bg-white border-b border-[#189aa1]/15 px-4 sm:px-8 py-6">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              My Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your profile, content, subscriptions, and certificates across all platforms.
            </p>
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
          {activeTab === "profile"       && <ProfileTab />}
          {activeTab === "content"       && <MyContentTab />}
          {activeTab === "subscriptions" && <SubscriptionsTab />}
          {activeTab === "certificates"  && <CertificatesTab />}
        </div>
      </div>
    </Layout>
  );
}
