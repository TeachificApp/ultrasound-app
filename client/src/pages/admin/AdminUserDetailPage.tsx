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
  ClipboardCheck, RotateCcw, DollarSign, Edit3,
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
    refunded:   { label: "Refunded",   color: "bg-purple-100 text-purple-700 border-purple-200" },
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
type Tab = "profile" | "content" | "subscriptions" | "certificates";
const VALID_TABS: Tab[] = ["profile", "content", "subscriptions", "certificates"];

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ userId, data, refetch }: { userId: number; data: any; refetch: () => void }) {
  const utils = trpc.useUtils();
  const updateRole = trpc.adminUser.updateUserRole.useMutation({
    onSuccess: () => { toast.success("Role updated."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const grantMembership = trpc.adminUser.grantBrandMembership.useMutation({
    onSuccess: () => { toast.success("Membership granted."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantBrand, setGrantBrand] = useState<"aaus" | "iheartecho">("aaus");
  const [grantTier, setGrantTier] = useState<"free" | "premium">("premium");
  const [grantExpiry, setGrantExpiry] = useState("");

  const user = data.user;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Avatar + info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-5">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-4 border-[#189aa1]/20 shadow" />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow"
              style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
              {(user.displayName ?? user.name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-800">{user.displayName ?? user.name ?? "—"}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">Member since {formatDate(user.createdAt)}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge status={user.role} />
              {user.specialty && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{user.specialty}</span>}
              {user.location && <span className="text-xs text-gray-500">{user.location}</span>}
            </div>
          </div>
        </div>
        {user.bio && <p className="text-sm text-gray-600 mt-4 border-t border-gray-100 pt-4">{user.bio}</p>}
        {user.website && (
          <a href={user.website} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#189aa1] hover:underline mt-2">
            <ExternalLink className="w-3 h-3" /> {user.website}
          </a>
        )}
      </div>

      {/* Role management */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <SectionHeader title="Role & Access" />
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600">Current role: <strong>{user.role}</strong></span>
          <Button
            size="sm"
            variant="outline"
            disabled={updateRole.isPending || user.role === "admin"}
            onClick={() => updateRole.mutate({ userId, role: "admin" })}
            className="text-teal-700 border-teal-200 hover:bg-teal-50"
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" /> Promote to Admin
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={updateRole.isPending || user.role === "user"}
            onClick={() => updateRole.mutate({ userId, role: "user" })}
            className="text-gray-600 border-gray-200 hover:bg-gray-50"
          >
            <ShieldOff className="w-3.5 h-3.5 mr-1.5" /> Demote to User
          </Button>
        </div>
      </div>

      {/* Grant membership */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <SectionHeader
          title="Grant Brand Membership"
          action={
            <Button size="sm" onClick={() => setGrantOpen(true)} className="bg-[#189aa1] hover:bg-[#157f85] text-white">
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Grant Access
            </Button>
          }
        />
        <p className="text-sm text-gray-500">Grant or upgrade this user's access to a brand app directly from here.</p>
      </div>

      {/* Grant dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Brand Membership</DialogTitle>
            <DialogDescription>Manually grant access to a brand app for this user.</DialogDescription>
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
              onClick={() => {
                grantMembership.mutate({ userId, brand: grantBrand, tier: grantTier, expiresAt: grantExpiry || undefined });
                setGrantOpen(false);
              }}
              disabled={grantMembership.isPending}
              className="bg-[#189aa1] hover:bg-[#157f85] text-white"
            >
              {grantMembership.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Grant Access
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
                    <a href={`/learn/${e.courseSlug}/overview`} target="_blank" rel="noopener noreferrer"
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
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">Admin granted</span>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profile",       label: "Profile",       icon: User },
  { key: "content",       label: "Content",       icon: BookOpen },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "certificates",  label: "Certificates",  icon: Award },
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
              <div>
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
          {activeTab === "subscriptions" && <SubscriptionsTab userId={userId!} data={data} refetch={refetch} />}
          {activeTab === "certificates"  && <CertificatesTab  userId={userId!} data={data} refetch={refetch} />}
        </div>
      </div>
    </Layout>
  );
}
