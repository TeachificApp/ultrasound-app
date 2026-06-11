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
  Clock, XCircle, RefreshCw, Loader2, ChevronRight, ClipboardCheck, ShoppingCart, BarChart2, Bell,
  GraduationCap, BookMarked, PenLine, ArrowRight, Video, Layers, Users, Star,
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
import { isMembersDomain, isLearnDomain, LEARN_APP_URL } from "@/hooks/useSubdomain";

// ─── Brand config ─────────────────────────────────────────────────────────────

const BRAND_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  aaus: {
    label: "All About Ultrasound™",
    color: "#189aa1",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
  iheartecho: {
    label: "iHeartEcho™",
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
    refunded:   { label: "Refunded",   color: "bg-teal-100 text-teal-700 border-teal-200" },
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
type Tab = "profile" | "content" | "subscriptions" | "purchases" | "certificates" | "instructor";
const VALID_TABS: Tab[] = ["profile", "content", "subscriptions", "purchases", "certificates", "instructor"];

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: profile, isLoading } = trpc.dashboard.getProfile.useQuery();

  // ── Notification preferences ──────────────────────────────────────────────
  const { data: notifPrefs, isLoading: notifLoading } = trpc.quickfire.getNotificationPrefs.useQuery(
    undefined,
    { enabled: !!user }
  );
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifTimezone, setNotifTimezone] = useState("America/New_York");
  useEffect(() => {
    if (notifPrefs) {
      setNotifEnabled(notifPrefs.quickfireReminder);
      setNotifTimezone(notifPrefs.timezone ?? "America/New_York");
    }
  }, [notifPrefs]);
  const updateNotifPrefsMutation = trpc.quickfire.updateNotificationPrefs.useMutation({
    onSuccess: () => toast.success("Notification preferences saved"),
    onError: () => toast.error("Failed to save preferences"),
  });

  // ── Interest preferences (normalized system) ────────────────────────────────
  const userBrand = (user as any)?.brand as string | undefined;
  const { data: availableInterests, isLoading: interestsListLoading } = trpc.interests.getInterests.useQuery(
    { brand: userBrand },
    { enabled: !!user }
  );
  const { data: myInterestsData, isLoading: myInterestsLoading } = trpc.interests.getMyInterests.useQuery(
    undefined,
    { enabled: !!user }
  );
  const [selectedInterestIds, setSelectedInterestIds] = useState<number[]>([]);
  useEffect(() => {
    if (myInterestsData) {
      setSelectedInterestIds(myInterestsData.map((i: any) => i.id));
    }
  }, [myInterestsData]);
  const interestLoading = interestsListLoading || myInterestsLoading;
  const updateInterestsMutation = trpc.interests.updateMyInterests.useMutation({
    onSuccess: () => {
      toast.success("Interests saved");
      utils.interests.getMyInterests.invalidate();
    },
    onError: () => toast.error("Failed to save interests"),
  });
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully.");
      // Reset ref so the effect re-syncs once the invalidated query returns fresh data
      syncedProfileIdRef.current = null;
      utils.dashboard.getProfile.invalidate();
      utils.auth.me.invalidate();
      // Invalidate community/cohort caches so discussion posts show updated profile
      utils.community.invalidate();
      utils.lmsCohortAdmin.invalidate();
      utils.lmsLearner.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadAvatar = trpc.auth.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Avatar updated.");
      utils.dashboard.getProfile.invalidate();
      utils.auth.me.invalidate();
      // Invalidate community/cohort caches so discussion posts show updated avatar
      utils.community.invalidate();
      utils.lmsCohortAdmin.invalidate();
      utils.lmsLearner.invalidate();
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [credentials, setCredentials] = useState("");
  const [yearsExperience, setYearsExperience] = useState<string>("");
  const [locationVal, setLocationVal] = useState("");
  const [website, setWebsite] = useState("");
  const syncedProfileIdRef = useRef<number | null>(null);

  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", newPw: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Sync form fields from server data only when the profile ID changes (initial
  // load or after a save). Using a ref guard prevents the effect from resetting
  // fields while the user is actively typing.
  useEffect(() => {
    if (!profile) return;
    const profileId = (profile as any).id ?? 0;
    if (profileId === syncedProfileIdRef.current) return;
    syncedProfileIdRef.current = profileId;
    setFirstName((profile as any).firstName ?? "");
    setLastName((profile as any).lastName ?? "");
    setDisplayName(profile.displayName ?? profile.name ?? "");
    setBio(profile.bio ?? "");
    setSpecialty(profile.specialty ?? "");
    setCredentials(profile.credentials ?? "");
    setYearsExperience(profile.yearsExperience != null ? String(profile.yearsExperience) : "");
    setLocationVal(profile.location ?? "");
    setWebsite(profile.website ?? "");
  }, [profile]);

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
            <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
            <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
            <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="specialty">Specialty</Label>
            <Input id="specialty" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="e.g. Vascular Sonographer" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credentials">Credentials</Label>
            <Input id="credentials" value={credentials} onChange={e => setCredentials(e.target.value)} placeholder="e.g. RDMS, RVT, RDCS" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yearsExperience">Years of Experience</Label>
            <Input id="yearsExperience" type="number" min={0} max={60} value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} placeholder="e.g. 5" />
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
          onClick={() => {
            if (!firstName.trim()) { toast.error("First name is required."); return; }
            if (!lastName.trim()) { toast.error("Last name is required."); return; }
            if (!displayName.trim()) { toast.error("Display name cannot be empty."); return; }
            updateProfile.mutate({ firstName: firstName.trim(), lastName: lastName.trim(), displayName: displayName.trim(), bio, specialty, credentials: credentials || undefined, yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : null, location: locationVal, website: website || undefined });
          }}
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

      {/* Notification Preferences */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Notification Preferences</h3>
          <p className="text-xs text-gray-500 mt-0.5">Control when All About Ultrasound™ sends you email reminders.</p>
        </div>
        <div className="p-6 space-y-6">
          {notifLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading preferences...
            </div>
          ) : (
            <>
              {/* Daily Challenge Reminder Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="w-4 h-4" style={{ color: "#189aa1" }} />
                    <span className="text-sm font-semibold text-gray-800">Daily Challenge Reminder</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Receive a daily email reminder if you haven't completed your Daily Challenge session.
                    Includes your current streak so you never lose momentum.
                  </p>
                </div>
                <button
                  onClick={() => setNotifEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                    notifEnabled ? "bg-[#189aa1]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      notifEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {/* Timezone Selector */}
              {notifEnabled && (
                <div className="flex items-start gap-4 pl-6">
                  <div className="flex items-center gap-2 mt-1.5">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">Your timezone</span>
                  </div>
                  <div className="flex-1">
                    <select
                      value={notifTimezone}
                      onChange={(e) => setNotifTimezone(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#189aa1] bg-white"
                    >
                      <optgroup label="North America">
                        <option value="America/New_York">Eastern Time (ET) — New York</option>
                        <option value="America/Chicago">Central Time (CT) — Chicago</option>
                        <option value="America/Denver">Mountain Time (MT) — Denver</option>
                        <option value="America/Phoenix">Mountain Time, no DST — Phoenix</option>
                        <option value="America/Los_Angeles">Pacific Time (PT) — Los Angeles</option>
                        <option value="America/Anchorage">Alaska Time — Anchorage</option>
                        <option value="Pacific/Honolulu">Hawaii Time — Honolulu</option>
                        <option value="America/Toronto">Eastern Time — Toronto</option>
                        <option value="America/Vancouver">Pacific Time — Vancouver</option>
                      </optgroup>
                      <optgroup label="Europe">
                        <option value="Europe/London">GMT/BST — London</option>
                        <option value="Europe/Paris">CET/CEST — Paris</option>
                        <option value="Europe/Berlin">CET/CEST — Berlin</option>
                        <option value="Europe/Amsterdam">CET/CEST — Amsterdam</option>
                        <option value="Europe/Stockholm">CET/CEST — Stockholm</option>
                        <option value="Europe/Helsinki">EET/EEST — Helsinki</option>
                        <option value="Europe/Athens">EET/EEST — Athens</option>
                        <option value="Europe/Istanbul">TRT — Istanbul</option>
                        <option value="Europe/Moscow">MSK — Moscow</option>
                      </optgroup>
                      <optgroup label="Asia / Pacific">
                        <option value="Asia/Dubai">GST — Dubai</option>
                        <option value="Asia/Karachi">PKT — Karachi</option>
                        <option value="Asia/Kolkata">IST — India</option>
                        <option value="Asia/Dhaka">BST — Dhaka</option>
                        <option value="Asia/Bangkok">ICT — Bangkok</option>
                        <option value="Asia/Singapore">SGT — Singapore</option>
                        <option value="Asia/Tokyo">JST — Tokyo</option>
                        <option value="Asia/Seoul">KST — Seoul</option>
                        <option value="Asia/Shanghai">CST — Shanghai</option>
                        <option value="Australia/Sydney">AEST/AEDT — Sydney</option>
                        <option value="Australia/Melbourne">AEST/AEDT — Melbourne</option>
                        <option value="Pacific/Auckland">NZST/NZDT — Auckland</option>
                      </optgroup>
                      <optgroup label="Middle East / Africa">
                        <option value="Africa/Cairo">EET — Cairo</option>
                        <option value="Africa/Johannesburg">SAST — Johannesburg</option>
                        <option value="Asia/Riyadh">AST — Riyadh</option>
                        <option value="Asia/Jerusalem">IST/IDT — Jerusalem</option>
                      </optgroup>
                      <optgroup label="Latin America">
                        <option value="America/Sao_Paulo">BRT/BRST — São Paulo</option>
                        <option value="America/Argentina/Buenos_Aires">ART — Buenos Aires</option>
                        <option value="America/Mexico_City">CST/CDT — Mexico City</option>
                        <option value="America/Bogota">COT — Bogotá</option>
                      </optgroup>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Notifications will be sent at 9:00 AM in your selected timezone.</p>
                  </div>
                </div>
              )}
              {/* Save Button */}
              <div className="pt-2 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() =>
                    updateNotifPrefsMutation.mutate({
                      quickfireReminder: notifEnabled,
                      reminderTime: "09:00",
                      timezone: notifTimezone,
                    })
                  }
                  disabled={updateNotifPrefsMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#189aa1" }}
                >
                  {updateNotifPrefsMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Preferences
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Interests */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Content Interests</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Select the clinical areas you are most interested in. This helps us send you relevant updates, resources, and announcements.
          </p>
        </div>
        <div className="p-6">
          {interestLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading interests...
            </div>
          ) : (
            <>
              {(!availableInterests || availableInterests.length === 0) ? (
                <p className="text-sm text-gray-400">No interests available for your account.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-6">
                  {availableInterests.map((interest: any) => {
                    const isSelected = selectedInterestIds.includes(interest.id);
                    return (
                      <button
                        key={interest.id}
                        type="button"
                        onClick={() => {
                          setSelectedInterestIds(prev =>
                            isSelected
                              ? prev.filter(id => id !== interest.id)
                              : [...prev, interest.id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                          isSelected
                            ? "border-[#189aa1] bg-[#189aa1] text-white"
                            : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1]"
                        }`}
                      >
                        {interest.iconEmoji && <span className="mr-1">{interest.iconEmoji}</span>}
                        {interest.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {selectedInterestIds.length} interest{selectedInterestIds.length !== 1 ? "s" : ""} selected
                </p>
                <button
                  onClick={() => updateInterestsMutation.mutate({ interestIds: selectedInterestIds })}
                  disabled={updateInterestsMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#189aa1" }}
                >
                  {updateInterestsMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Interests
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Community Profile */}
      <CommunityProfileSection userId={profile.id} />
    </div>
  );
}

// ─── Community Profile Section ───────────────────────────────────────────────

const LEARN_URL = "https://learn.allaboutultrasound.com";

function CommunityProfileSection({ userId }: { userId: number }) {
  const { user } = useAuth();
  const { data: xpData, isLoading } = trpc.community.myXP.useQuery();

  // Check if user is platform owner or admin — show special badge instead of XP level
  const isOwnerOrAdmin = (user as any)?.role === "admin" ||
    (user as any)?.appRoles?.includes("platform_admin") ||
    (user as any)?.appRoles?.includes("platform_owner");

  function getLevel(xp: number) {
    if (xp >= 5000) return { level: 5, title: "Expert", color: "#f59e0b", next: null };
    if (xp >= 2000) return { level: 4, title: "Advanced", color: "#8b5cf6", next: 5000 };
    if (xp >= 750)  return { level: 3, title: "Intermediate", color: "#3b82f6", next: 2000 };
    if (xp >= 200)  return { level: 2, title: "Member", color: "#189aa1", next: 750 };
    return { level: 1, title: "Newcomer", color: "#6b7280", next: 200 };
  }

  const totalXP = xpData?.xp?.totalXp ?? 0;
  const levelInfo = getLevel(totalXP);
  const progressPct = levelInfo.next ? Math.min(100, Math.round((totalXP / levelInfo.next) * 100)) : 100;
  // Admin/Owner override — show distinguished badge instead of XP level
  const displayLevel = isOwnerOrAdmin
    ? { level: "★", title: "Platform Owner", color: "#189aa1", next: null as number | null }
    : levelInfo;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Community Profile</h3>
        <a
          href={`${LEARN_URL}/community/members/${userId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-[#189aa1] hover:text-[#157f85] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Public Profile
        </a>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading community stats...
        </div>
      ) : (
        <>
          {/* XP + Level */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-[#189aa1]/5 to-[#4ad9e0]/5 border border-[#189aa1]/10">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${displayLevel.color}, ${displayLevel.color}99)` }}>
              {displayLevel.level}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-gray-800">{displayLevel.title}</span>
                {!isOwnerOrAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${displayLevel.color}15`, color: displayLevel.color }}>
                    {totalXP.toLocaleString()} XP
                  </span>
                )}
                {isOwnerOrAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-teal-50 text-[#189aa1] border border-teal-200">
                    All About Ultrasound™
                  </span>
                )}
              </div>
              {!isOwnerOrAdmin && displayLevel.next && (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%`, background: displayLevel.color }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{totalXP.toLocaleString()} / {displayLevel.next.toLocaleString()} XP to next level</p>
                </>
              )}
              {!isOwnerOrAdmin && !displayLevel.next && <p className="text-xs text-gray-400">Maximum level reached!</p>}
              {isOwnerOrAdmin && <p className="text-xs text-gray-400">Platform Owner &amp; Educator</p>}
            </div>
          </div>

          {/* Badges */}
          {(xpData?.badges?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Badges Earned</p>
              <div className="flex flex-wrap gap-2">
                {xpData!.badges.map((b: any) => (
                  <div key={b.badge.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-50"
                    title={b.badge.description ?? b.badge.name}>
                    <span>{b.badge.icon ?? "🏅"}</span>
                    <span className="text-gray-700">{b.badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(xpData?.badges?.length ?? 0) === 0 && (
            <p className="text-xs text-gray-400 italic">No badges earned yet. Start participating in the community to earn your first badge!</p>
          )}

          <p className="text-xs text-gray-400">
            Your profile details (name, bio, specialty, credentials) are shared with the Community. Update them above and they will reflect on your public community profile.
          </p>
        </>
      )}
    </div>
  );
}

// ─── My Content Tab ───────────────────────────────────────────────────────────

type ContentSubTab = "courses" | "quizzes" | "downloads" | "webinars" | "products" | "bundles" | "memberships" | "communities";

function MyContentTab() {
  const { data, isLoading } = trpc.dashboard.getMyContent.useQuery();
  const [contentTab, setContentTab] = useState<ContentSubTab>("courses");
  const [autoTabSet, setAutoTabSet] = useState(false);

  // Auto-select first non-empty tab once data loads
  useEffect(() => {
    if (!data || autoTabSet) return;
    const tabOrder: ContentSubTab[] = ["courses", "quizzes", "downloads", "webinars", "products", "bundles", "memberships", "communities"];
    const counts: Record<ContentSubTab, number> = {
      courses:      data.courses?.length ?? 0,
      quizzes:      data.quizzes?.length ?? 0,
      downloads:    data.downloads?.length ?? 0,
      webinars:     data.webinars?.length ?? 0,
      products:     data.physicalProducts?.length ?? 0,
      bundles:      data.bundles?.length ?? 0,
      memberships:  0, // memberships shown in Subscriptions tab
      communities:  data.communities?.length ?? 0,
    };
    const firstNonEmpty = tabOrder.find(t => counts[t] > 0);
    if (firstNonEmpty) {
      setContentTab(firstNonEmpty);
    }
    setAutoTabSet(true);
  }, [data, autoTabSet]);

  if (isLoading) return <LoadingSpinner />;

  const subTabs: { key: ContentSubTab; label: string; icon: React.ElementType; count: number }[] = [
    { key: "courses",      label: "Courses",      icon: BookOpen,       count: data?.courses.length ?? 0 },
    { key: "quizzes",      label: "Quizzes",      icon: ClipboardCheck, count: data?.quizzes.length ?? 0 },
    { key: "downloads",    label: "Downloads",    icon: Download,       count: data?.downloads.length ?? 0 },
    { key: "webinars",     label: "Webinars",     icon: Video,          count: data?.webinars?.length ?? 0 },
    { key: "products",     label: "Products",     icon: Package,        count: data?.physicalProducts.length ?? 0 },
    { key: "bundles",      label: "Bundles",      icon: Layers,         count: data?.bundles?.length ?? 0 },
    { key: "memberships",  label: "Memberships",  icon: Star,           count: 0 },
    { key: "communities",  label: "Communities",  icon: Users,          count: data?.communities?.length ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 w-full flex-nowrap overflow-x-auto">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setContentTab(t.key)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              contentTab === t.key ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
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
        <div>
          {(data?.courses.length ?? 0) === 0 ? (
            <EmptyState icon={BookOpen} title="No courses yet" description="Enroll in a course to see it here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.courses.map(c => (
                <ContentCard
                  key={c.enrollmentId}
                  thumbnail={c.courseThumbnail}
                  title={c.courseTitle}
                  brand={c.courseBrand}
                  subtitle={`Enrolled ${formatDate(c.enrolledAt)}`}
                  badge={c.completedAt ? "Completed" : "In Progress"}
                  badgeColor={c.completedAt ? "emerald" : "teal"}
                  progressPct={c.progressPct}
                  completed={!!c.completedAt}
                  expiresAt={(c as any).accessExpiresAt ?? null}
                  actions={[
                    { label: c.completedAt ? "Review Course" : "Continue Learning", icon: Play, href: `/courses/${c.courseSlug}/player` },
                    { label: "Overview", icon: FileText, href: `/courses/${c.courseSlug}/overview`, secondary: true },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quizzes */}
      {contentTab === "quizzes" && (
        <div>
          {(data?.quizzes.length ?? 0) === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No quizzes yet" description="Purchase or enroll in a quiz to see it here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.quizzes.map(q => (
                <ContentCard
                  key={q.enrollmentId}
                  thumbnail={q.courseThumbnail}
                  title={q.courseTitle}
                  brand={q.courseBrand}
                  subtitle={`Enrolled ${formatDate(q.enrolledAt)}`}
                  badge={q.completedAt ? "Completed" : "In Progress"}
                  badgeColor={q.completedAt ? "emerald" : "blue"}
                  progressPct={q.progressPct}
                  completed={!!q.completedAt}
                  expiresAt={(q as any).accessExpiresAt ?? null}
                  actions={[
                    { label: q.completedAt ? "Retake Quiz" : "Take Quiz", icon: Play, href: `/courses/${q.courseSlug}/player` },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Downloads */}
      {contentTab === "downloads" && (
        <div>
          {(data?.downloads.length ?? 0) === 0 ? (
            <EmptyState icon={Download} title="No downloads yet" description="Purchase a digital download to see it here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.downloads ?? []).map((d: any, i: number) => (
                <ContentCard
                  key={d.enrollmentId ?? d.purchaseId ?? i}
                  thumbnail={d.courseThumbnail ?? d.productThumbnail}
                  title={d.courseTitle ?? d.productTitle}
                  brand={d.courseBrand}
                  subtitle={`Purchased ${formatDate(d.enrolledAt ?? d.purchasedAt)}`}
                  badge="Digital Download"
                  badgeColor="teal"
                  actions={[
                    {
                      label: "Access Files",
                      icon: Download,
                      href: d.courseSlug ? `/courses/${d.courseSlug}/player` : `/downloads/${d.productSlug}/files`,
                    },
                    {
                      label: "View Details",
                      icon: FileText,
                      href: d.courseSlug ? `/courses/${d.courseSlug}` : `/downloads/${d.productSlug}`,
                      secondary: true,
                    },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Physical Products */}
      {contentTab === "products" && (
        <div>
          {(data?.physicalProducts.length ?? 0) === 0 ? (
            <EmptyState icon={Package} title="No product orders yet" description="Purchase a physical product to see your orders here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.physicalProducts.map(p => (
                <ContentCard
                  key={p.orderId}
                  thumbnail={p.productThumbnail}
                  title={p.productTitle}
                  subtitle={`Ordered ${formatDate(p.orderedAt)} · ${formatCurrency(p.amountPaid, p.currency)}`}
                  badge={p.fulfillmentStatus}
                  badgeColor={p.fulfillmentStatus === "delivered" ? "emerald" : p.fulfillmentStatus === "shipped" ? "teal" : "amber"}
                  trackingInfo={p.trackingNumber ? `${p.trackingCarrier ?? ""} ${p.trackingNumber}`.trim() : undefined}
                  actions={[
                    { label: "View Product", icon: ExternalLink, href: `/product/${p.productSlug}` },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Webinars */}
      {contentTab === "webinars" && (
        <div>
          {(data?.webinars?.length ?? 0) === 0 ? (
            <EmptyState icon={Video} title="No webinar registrations" description="Register for a webinar to see it here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.webinars?.map(w => (
                <ContentCard
                  key={w.registrationId}
                  thumbnail={w.webinarCover}
                  title={w.webinarTitle}
                  subtitle={`Registered ${formatDate(w.registeredAt)}${w.scheduledAt ? ` · Scheduled ${formatDate(new Date(w.scheduledAt))}` : ""}`}
                  badge={w.attended ? "Attended" : w.webinarStatus === "ended" ? "Replay Available" : "Registered"}
                  badgeColor={w.attended ? "emerald" : w.webinarStatus === "ended" ? "teal" : "blue"}
                  actions={[
                    { label: "View Webinar", icon: ExternalLink, href: `/webinar/${w.webinarSlug}` },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {/* Bundles */}
      {contentTab === "bundles" && (
        <div>
          {(data?.bundles?.length ?? 0) === 0 ? (
            <EmptyState icon={Layers} title="No bundles purchased" description="Purchase a bundle to see it here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.bundles?.map(b => (
                <ContentCard
                  key={b.enrollmentId}
                  thumbnail={b.bundleCover}
                  title={b.bundleTitle}
                  subtitle={`Enrolled ${formatDate(b.enrolledAt)}`}
                  badge="Owned"
                  badgeColor="emerald"
                  actions={[
                    { label: "View Bundle", icon: ExternalLink, href: `/bundle/${b.bundleSlug}` },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {/* Memberships */}
      {contentTab === "memberships" && (
        <div>
          <EmptyState icon={Star} title="Memberships" description="Your memberships are managed in the Subscriptions tab." />
        </div>
      )}
      {/* Communities */}
      {contentTab === "communities" && (
        <div>
          {(data?.communities?.length ?? 0) === 0 ? (
            <EmptyState icon={Users} title="No community memberships" description="Join a community to see it here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.communities?.map(c => (
                <ContentCard
                  key={c.memberId}
                  thumbnail={c.communityCover}
                  title={c.communityTitle}
                  subtitle={`Joined ${formatDate(c.joinedAt)} · ${c.role}`}
                  badge={c.role === "admin" ? "Admin" : c.role === "moderator" ? "Moderator" : "Member"}
                  badgeColor={c.role === "admin" ? "purple" : c.role === "moderator" ? "blue" : "emerald"}
                  actions={[
                    { label: "View Community", icon: ExternalLink, href: `/community/${c.communitySlug}` },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Purchases Tab (top-level) ───────────────────────────────────────────────

function PurchasesTab() {
  const { data, isLoading } = trpc.dashboard.getMyPurchases.useQuery();
  const [receiptPurchase, setReceiptPurchase] = useState<any | null>(null);

  if (isLoading) return <LoadingSpinner />;

  const purchases = data ?? [];

  return (
    <div className="space-y-6">
      {purchases.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No purchases yet" description="Your payment history will appear here." />
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {purchases.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{p.description}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatDate(p.date)}</p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-sm font-semibold text-gray-800">{formatCurrency(p.amount, p.currency)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.type === "subscription_payment" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"
                }`}>
                  {p.type === "subscription_payment" ? "Subscription" :
                    p.productType === "download" ? "Digital Download" :
                    p.productType === "course" ? "Course" :
                    p.productType === "quiz" ? "Quiz" :
                    p.productType ? p.productType.charAt(0).toUpperCase() + p.productType.slice(1) : "Purchase"}
                </span>
                {p.invoiceUrl && (
                  <a
                    href={p.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Invoice
                  </a>
                )}
                {p.type === "one_time" && (
                  <button
                    onClick={() => setReceiptPurchase(p)}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Receipt
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Receipt Modal */}
      <Dialog open={!!receiptPurchase} onOpenChange={(open) => { if (!open) setReceiptPurchase(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Purchase Receipt</DialogTitle>
            <DialogDescription>Order details for your purchase</DialogDescription>
          </DialogHeader>
          {receiptPurchase && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{receiptPurchase.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{receiptPurchase.productType === "download" ? "Digital Download" : receiptPurchase.productType === "course" ? "Course" : receiptPurchase.productType === "quiz" ? "Quiz" : receiptPurchase.productType ? receiptPurchase.productType.charAt(0).toUpperCase() + receiptPurchase.productType.slice(1) : "Purchase"}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(receiptPurchase.amount, receiptPurchase.currency)}</span>
                </div>
                {receiptPurchase.orderBumps && (() => {
                  try {
                    const bumps = typeof receiptPurchase.orderBumps === "string"
                      ? JSON.parse(receiptPurchase.orderBumps)
                      : receiptPurchase.orderBumps;
                    if (Array.isArray(bumps) && bumps.length > 0) {
                      return (
                        <div className="border-t border-gray-200 pt-3 space-y-1.5">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add-ons</p>
                          {bumps.map((b: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-700">{b.title}</span>
                              <span className="text-gray-700">{formatCurrency(b.price, "usd")}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch { /* ignore */ }
                  return null;
                })()}
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="text-sm font-semibold text-gray-700">Total Paid</span>
                  <span className="text-sm font-bold text-teal-700">{formatCurrency(receiptPurchase.amount, receiptPurchase.currency)}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Date</span>
                  <span>{formatDate(receiptPurchase.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="capitalize text-green-600 font-medium">{receiptPurchase.status ?? "paid"}</span>
                </div>
                {receiptPurchase.sourceType && (
                  <div className="flex justify-between">
                    <span>Source</span>
                    <span className="capitalize">{receiptPurchase.sourceType}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
  const cancelCourseSub = trpc.dashboard.cancelCourseSubscription.useMutation({
    onSuccess: (res) => { toast.success(res.message); utils.dashboard.getMySubscriptions.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const reactivateCourseSub = trpc.dashboard.reactivateCourseSubscription.useMutation({
    onSuccess: (res) => { toast.success(res.message); utils.dashboard.getMySubscriptions.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);
  const [confirmCancelCourse, setConfirmCancelCourse] = useState<number | null>(null);

  if (isLoading) return <LoadingSpinner />;

  const memberships = data?.memberships ?? [];
  const courseSubscriptions = data?.courseSubscriptions ?? [];
  const hasAnything = memberships.length > 0 || courseSubscriptions.length > 0;

  if (!data || !hasAnything) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No active subscriptions"
        description="Subscribe to a premium plan to unlock full access."
        action={{ label: "View Plans", href: "/premium" }}
      />
    );
  }

  // Group brand memberships by brand for display
  const byBrand: Record<string, typeof memberships> = {};
  for (const sub of memberships) {
    const b = sub.brand ?? "other";
    if (!byBrand[b]) byBrand[b] = [];
    byBrand[b].push(sub);
  }

  return (
    <div className="space-y-8">
      {/* ── App Subscriptions (UltrasoundAssist Premium / EchoAssist Premium) ── */}
      {memberships.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border bg-teal-50 text-teal-700 border-teal-200">
              App Subscriptions
            </span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>
          {Object.entries(byBrand).map(([brand, subs]) => {
            const brandCfg = BRAND_CONFIG[brand] ?? { label: brand, color: "#6b7280", bg: "bg-gray-50", border: "border-gray-200" };
            return (
              <div key={brand}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 ml-1">{brandCfg.label}</p>

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
        </div>
      )}

      {/* ── Learn Subscriptions (courses, quizzes, downloads, products, etc.) ── */}
      {courseSubscriptions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
              Learn Subscriptions
            </span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>
          <div className="space-y-4">
            {courseSubscriptions.map(sub => {
              const isCancelPending = sub.stripe?.cancelAtPeriodEnd === true;
              return (
                <div key={sub.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">{sub.courseTitle}</span>
                        <StatusBadge status={sub.stripe?.status ?? sub.status ?? "active"} />
                        {isCancelPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                            <XCircle className="w-3 h-3" /> Cancels at period end
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
                        <p className="text-xs text-gray-400">Since: {formatDate(sub.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {sub.stripeSubscriptionId && (
                        isCancelPending ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reactivateCourseSub.mutate({ orderId: sub.id })}
                            disabled={reactivateCourseSub.isPending}
                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          >
                            {reactivateCourseSub.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmCancelCourse(sub.id)}
                            disabled={sub.stripe?.status === "cancelled" || sub.stripe?.status === "canceled"}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Cancel
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel membership confirmation */}
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

      {/* Cancel course subscription confirmation */}
      <AlertDialog open={confirmCancelCourse !== null} onOpenChange={open => !open && setConfirmCancelCourse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Course Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your access will continue until the end of the current billing period. You will not be charged again after that. You can reactivate at any time before then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCancelCourse !== null) {
                  cancelCourseSub.mutate({ orderId: confirmCancelCourse });
                  setConfirmCancelCourse(null);
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
                href={`/courses/${cert.courseSlug}/overview`}
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
  thumbnail, title, brand, subtitle, badge, badgeColor, trackingInfo, actions, progressPct, completed,
}: {
  thumbnail?: string | null;
  title: string;
  brand?: string | null;
  subtitle: string;
  badge: string;
  badgeColor: "emerald" | "teal" | "blue" | "amber";
  trackingInfo?: string;
  progressPct?: number | null;
  completed?: boolean;
  actions: { label: string; icon: React.ElementType; href: string; secondary?: boolean }[];
}) {
  const colorMap = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    teal:    "bg-teal-100 text-teal-700 border-teal-200",
    blue:    "bg-blue-100 text-blue-700 border-blue-200",
    amber:   "bg-amber-100 text-amber-700 border-amber-200",
  };
  const pct = Math.min(100, Math.max(0, Number(progressPct ?? 0)));
  const showProgress = progressPct != null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-teal-200 transition-all duration-200">
      {/* Cover image */}
      <div className="relative h-36 bg-gradient-to-br from-teal-50 to-teal-100 overflow-hidden flex-shrink-0">
        {thumbnail ? (
          <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-teal-300" />
          </div>
        )}
        <span className={`absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-sm ${colorMap[badgeColor]}`}>
          {completed && <CheckCircle2 className="w-3 h-3 mr-1" />}
          {badge}
        </span>
        {brand && (
          <div className="absolute bottom-2 left-2">
            <BrandBadge brand={brand} />
          </div>
        )}
      </div>
      {/* Progress bar */}
      {showProgress && (
        <div className="h-1.5 bg-gray-100 w-full">
          <div
            className={`h-full transition-all duration-500 ${completed ? "bg-emerald-500" : "bg-[#189aa1]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h4 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2 mb-1">{title}</h4>
        <p className="text-xs text-gray-400 mb-1">{subtitle}</p>
        {showProgress && (
          <p className="text-xs font-medium text-[#189aa1] mb-1">
            {completed ? "Completed" : `${pct}% complete`}
          </p>
        )}
        {trackingInfo && (
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <Package className="w-3 h-3" /> {trackingInfo}
          </p>
        )}
        <div className="flex gap-2 mt-auto pt-3 flex-wrap">
          {actions.map(a => (
            <a
              key={a.label}
              href={a.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                a.secondary
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-[#189aa1] text-white hover:bg-[#157f85]"
              }`}
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

// ─── Analytics Tab ───────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { data, isLoading } = trpc.analyticsTrack.myActivity.useQuery();

  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const { summary, logins, pageViews, enrollments, downloads } = data;

  function fmtDateTime(d: Date | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Logins", value: summary.logins, color: "bg-blue-50 text-blue-600" },
          { label: "Page Views", value: summary.pageViews, color: "bg-teal-50 text-teal-600" },
          { label: "Video Plays", value: summary.videoPlays, color: "bg-orange-50 text-orange-600" },
          { label: "Quiz Attempts", value: summary.quizAttempts, color: "bg-pink-50 text-pink-600" },
          { label: "Downloads", value: summary.downloads, color: "bg-green-50 text-green-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-4 ${color.split(" ")[0]} flex flex-col gap-1`}>
            <span className={`text-2xl font-bold ${color.split(" ")[1]}`}>{value.toLocaleString()}</span>
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Login history */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700">Recent Logins</h3>
          <p className="text-xs text-gray-400 mt-0.5">Last 30 login events including IP and device info</p>
        </div>
        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
          {logins.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No login events recorded yet.</p>
          ) : logins.map((l: any) => (
            <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{l.userAgent ? l.userAgent.slice(0, 60) : "Unknown device"}</p>
                <p className="text-xs text-gray-400">{l.ip ?? "IP not recorded"}</p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{fmtDateTime(l.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Course progress */}
      {enrollments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">Course Progress</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {enrollments.map((e: any) => (
              <div key={e.enrollmentId} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{e.courseTitle}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[120px]">
                      <div className="bg-[#189aa1] h-1.5 rounded-full" style={{ width: `${Math.min(100, Number(e.progressPct ?? 0))}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{Number(e.progressPct ?? 0)}%</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {e.completedAt ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{Number(e.videosCompleted ?? 0)} videos done</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top pages visited */}
      {pageViews.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">Most Visited Pages</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
            {pageViews.map((p: any) => (
              <div key={p.path} className="px-5 py-2.5 flex items-center justify-between gap-4">
                <span className="text-xs text-gray-600 font-mono truncate flex-1">{p.path}</span>
                <span className="text-xs text-teal-600 font-semibold flex-shrink-0">{Number(p.views)} views</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Downloads */}
      {downloads.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">Download History</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {downloads.map((d: any) => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-sm text-gray-700 truncate flex-1">{d.productTitle ?? "Unknown product"}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{fmtDateTime(d.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Instructor Tab ──────────────────────────────────────────────────────────

function InstructorTab() {
  const { data: courses, isLoading } = trpc.lms.getMyInstructorCourses.useQuery();

  const instructorPortalUrl = `${LEARN_APP_URL}/instructor-portal`;

  function statusColor(status: string | null | undefined) {
    if (status === "public") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (status === "private") return "bg-blue-100 text-blue-700 border-blue-200";
    if (status === "draft") return "bg-gray-100 text-gray-500 border-gray-200";
    return "bg-amber-100 text-amber-700 border-amber-200";
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-[#189aa1]/20 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#189aa1" }}>
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Instructor Dashboard</h2>
            <p className="text-xs text-gray-500">Manage your courses, lessons, and content</p>
          </div>
        </div>
        <a
          href={instructorPortalUrl}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: "#189aa1" }}
        >
          Full Instructor Portal
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>

      {/* Courses list */}
      {!courses || courses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <BookMarked className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No courses assigned yet</p>
          <p className="text-xs text-gray-400 mt-1">Contact your platform admin to be assigned as an instructor.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course: any) => (
            <div key={course.permId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Thumbnail */}
                {course.courseThumbnail ? (
                  <img src={course.courseThumbnail} alt={course.courseTitle ?? ""} className="w-16 h-12 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-[#189aa1]/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-[#189aa1]" />
                  </div>
                )}
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800 truncate">{course.courseTitle ?? "Untitled Course"}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(course.courseStatus)}`}>
                      {course.courseStatus ?? "draft"}
                    </span>
                    {course.canSelfPublish && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-teal-50 text-teal-700 border-teal-200">
                        Can Self-Publish
                      </span>
                    )}
                  </div>
                  {course.revenueSharePct > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">{course.revenueSharePct}% revenue share</p>
                  )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={`${instructorPortalUrl}?courseId=${course.courseId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#189aa1] text-[#189aa1] hover:bg-[#189aa1]/5 transition-colors"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    Manage Lessons
                  </a>
                  {course.courseSlug && (
                    <a
                      href={`${LEARN_APP_URL}/courses/${course.courseSlug}/overview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Course
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

// TABS is built dynamically in the component based on user roles (see below)

export default function StudentDashboardPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const isAdmin = (user as any)?.role === "admin";
  const isInstructor = isAdmin || (user as any)?.appRoles?.includes("instructor") || (user as any)?.appRoles?.includes("platform_admin") || (user as any)?.appRoles?.includes("platform_owner");

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "content",       label: "My Content",    icon: BookOpen },
    { key: "profile",       label: "Profile",       icon: User },
    { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
    { key: "purchases",     label: "Purchases",     icon: ShoppingCart },
    { key: "certificates",  label: "Certificates",  icon: Award },
    ...(isInstructor ? [{ key: "instructor" as Tab, label: "Instructor", icon: GraduationCap }] : []),
  ];

  // Parse ?tab= from URL
  const urlTab = new URLSearchParams(search).get("tab") as Tab | null;
  const initialTab: Tab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : "content";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Keep URL in sync when tab changes.
  // Use window.history.replaceState directly so the URL updates reliably
  // across all subdomains — wouter's navigate() can miss re-renders when
  // only the query string changes inside a nested Switch.
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  };

  // Sync if URL changes externally (e.g. back/forward)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && VALID_TABS.includes(t) && t !== activeTab) setActiveTab(t);
  }, [search]);

      // On members/learn subdomains the outer router already provides a layout wrapper.
  // Rendering Layout again would create a double sidebar.
  // IMPORTANT: Do NOT create an inline component (e.g. `const Wrapper = () => ...`)
  // inside the render function — that creates a new component identity on every render,
  // causing all children (including ProfileTab) to unmount/remount and lose state.
  const skipLayout = isMembersDomain() || isLearnDomain();
  if (loading) {
    const inner = (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
      </div>
    );
    return skipLayout ? <>{inner}</> : <Layout>{inner}</Layout>;
  }
  if (!isAuthenticated) {
    // On the learn subdomain, redirect to the login page with a returnTo so the user
    // comes back to the right page after signing in. The login page will then send
    // them to members.allaboutultrasound.com after authentication.
    const currentPath = window.location.pathname + window.location.search;
    navigate(`/login?returnTo=${encodeURIComponent(currentPath)}`);
    return null;
  }
  const content = (
      <div className="min-h-screen bg-[#f0fbfc]">
        {/* Header */}
        <div className="bg-white border-b border-[#189aa1]/15 px-4 sm:px-8 py-4 sm:py-6">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              My Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 hidden sm:block">
              Manage your profile, content, subscriptions, and certificates across all platforms.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-3 sm:px-8 py-4 sm:py-8">
          {/* Tab Navigation */}
          <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1 mb-5 sm:mb-8">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex-1 min-h-[44px] ${
                  activeTab === t.key
                    ? "bg-[#189aa1] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <t.icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden text-[10px] font-semibold leading-tight text-center">{t.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "profile"       && <ProfileTab />}
          {activeTab === "content"       && <MyContentTab />}
          {activeTab === "subscriptions" && <SubscriptionsTab />}
          {activeTab === "purchases"     && <PurchasesTab />}
          {activeTab === "certificates"  && <CertificatesTab />}
          {activeTab === "instructor"    && <InstructorTab />}
        </div>
      </div>
  );
  return skipLayout ? <>{content}</> : <Layout>{content}</Layout>;
}
