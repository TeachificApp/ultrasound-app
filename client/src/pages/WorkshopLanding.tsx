/**
 * WorkshopLanding.tsx
 * Public sales page for a workshop — /workshops/:slug
 *
 * Waitlist mode: when workshop.waitlistEnabled is true AND no active enrolling
 * instance exists, all CTAs switch to waitlist sign-up mode.
 * - If waitlistCtaUrl is set, CTAs navigate there.
 * - Otherwise a modal collects name/email/phone/message and submits to
 *   workshopWaitlist.join, then shows the success message or redirects.
 *
 * Also handles ?preview=admin to show an admin edit bar.
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Briefcase, Calendar, MapPin, Clock, Users, Edit2, ArrowLeft, ExternalLink, CheckCircle, Bell, ChevronRight, X } from "lucide-react";
import { WorkshopInstancesCalendar } from "@/components/WorkshopInstancesCalendar";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useState, useEffect } from "react";
import { BlockPreview, type Block } from "@/components/BlockPreview";
import { handleCtaBtnClick } from "@/lib/ctaUtils";
import { RemainingSeatsBlock } from "@/components/RemainingSeatsBlock";
import { getAdminUrl } from "@/hooks/useSubdomain";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(cents: number, currency = "usd") {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─── Admin Preview Bar ────────────────────────────────────────────────────────
function AdminPreviewBar({ workshopId }: { workshopId: number }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white px-4 py-2 flex items-center gap-3 text-sm shadow-lg">
      <Badge variant="secondary" className="bg-amber-500 text-white border-0 text-xs">Preview Mode</Badge>
      <span className="text-gray-300 flex-1">Workshop Landing Page Preview</span>
      <a
        href={getAdminUrl(`/admin/lms?tab=workshops&editWorkshop=${workshopId}`)}
        className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
      >
        <Edit2 className="w-3 h-3" />
        Edit in Admin
      </a>
      <a
        href={window.location.pathname}
        className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        View Public Page
      </a>
    </div>
  );
}

// ─── Sold-Out Instance Card ─────────────────────────────────────────────────
function SoldOutInstanceCard({ instance }: { instance: any }) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 opacity-75">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {instance.title && (
            <h3 className="font-semibold text-gray-700 mb-1">{instance.title}</h3>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
            {instance.startDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {fmtDate(instance.startDate)}
              </span>
            )}
            {instance.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {instance.location}
              </span>
            )}
          </div>
          {instance.description && (
            <p className="text-sm text-gray-400 mt-2 line-clamp-2">{instance.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {instance.price !== null && instance.price !== undefined ? (
            <div className="text-lg font-bold text-gray-400 mb-2 line-through">{fmtPrice(instance.price)}</div>
          ) : null}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            Sold Out
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Instance Card ────────────────────────────────────────────────────────────
function InstanceCard({
  instance,
  onRegister,
  isPending,
}: {
  instance: any;
  onRegister: (instanceId: number) => void;
  isPending: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white hover:border-teal-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {instance.title && (
            <h3 className="font-semibold text-gray-900 mb-1">{instance.title}</h3>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            {instance.startDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-500" />
                {fmtDate(instance.startDate)}
              </span>
            )}
            {instance.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-500" />
                {instance.location}
              </span>
            )}
            {instance.maxCapacity && (
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-teal-500" />
                {instance.maxCapacity} spots
              </span>
            )}
          </div>
          {instance.description && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{instance.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {instance.price !== null && instance.price !== undefined ? (
            <div className="text-lg font-bold text-gray-900 mb-2">{fmtPrice(instance.price)}</div>
          ) : null}
          <Button
            size="sm"
            onClick={() => onRegister(instance.id)}
            disabled={isPending}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            Register
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Waitlist Modal ───────────────────────────────────────────────────────────
function WaitlistModal({
  open,
  onClose,
  workshop,
}: {
  open: boolean;
  onClose: () => void;
  workshop: any;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const joinMutation = trpc.workshopWaitlist.join.useMutation({
    onSuccess: (res) => {
      if (res.alreadyRegistered) {
        toast.info("You're already on the waitlist for this workshop.");
        onClose();
        return;
      }
      setSubmitted(true);
      // Redirect if configured
      if (workshop.waitlistRedirectUrl) {
        setTimeout(() => {
          window.location.href = workshop.waitlistRedirectUrl;
        }, 1500);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    joinMutation.mutate({ workshopId: workshop.id, name, email, phone: phone || undefined, message: message || undefined });
  }

  const heading = workshop.waitlistHeading || "Join the Waitlist";
  const bodyHtml = workshop.waitlistBody;
  const successHtml = workshop.waitlistSuccessMessage;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal-600" />
            {heading}
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-4">
            {successHtml ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: successHtml }} />
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="w-10 h-10 text-teal-500 mx-auto mb-3" />
                <p className="font-medium text-gray-900">You're on the list!</p>
                <p className="text-sm text-gray-500 mt-1">We'll notify you as soon as new dates are announced.</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {bodyHtml && (
              <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            )}
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 text-sm" placeholder="Your name" required />
            </div>
            <div>
              <Label className="text-xs">Email Address *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 text-sm" placeholder="you@example.com" required />
            </div>
            <div>
              <Label className="text-xs">Phone (optional)</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 text-sm" placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <Label className="text-xs">Message (optional)</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} className="mt-1 text-sm" rows={2} placeholder="Any questions or comments?" />
            </div>
            <Button
              type="submit"
              disabled={!name.trim() || !email.trim() || joinMutation.isPending}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {joinMutation.isPending ? "Submitting…" : (workshop.waitlistCtaLabel || "Join Waitlist")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WorkshopLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const isPreview = new URLSearchParams(window.location.search).get("preview") === "admin";
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);

  const { data, isLoading, error } = trpc.workshop.getBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug }
  );

  const enrollMutation = trpc.workshopLearner.enrollFree.useMutation({
    onSuccess: () => {
      toast.success("You're registered! Check your email for details.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // checkoutMutation kept for free-enrollment path via handleCta (pricingOptions flow)
  // For instance-specific paid checkout, we navigate to /checkout/workshop/:slug?instance=<id>
  const checkoutMutation = trpc.workshopLearner.createEmbeddedCheckoutSession.useMutation({
    onSuccess: (res: any) => {
      if (res.free) {
        toast.success("You're registered! Check your email for details.");
        return;
      }
      // Should not reach here — paid checkout navigates to WorkshopCheckout page
    },
    onError: (e: any) => toast.error(e.message),
  });

  const workshop = data?.workshop;
  const availableInstances = data?.availableInstances ?? [];
  const soldOutInstances = data?.soldOutInstances ?? [];
  const allInstances = data?.allInstances ?? [];
  const pricingOptions = data?.pricingOptions ?? [];

  // Determine waitlist mode: enabled flag + no active enrolling instances
  const isWaitlistMode = !!(workshop?.waitlistEnabled && availableInstances.length === 0);

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gray-50 py-12 ${isPreview ? "pt-20" : ""}`}>
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (error || !workshop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-700 mb-2">Workshop Not Found</h1>
          <p className="text-gray-500 mb-4">This workshop is not available.</p>
          <Link href="/education-library">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Landing blocks (page builder) ─────────────────────────────────────────
  let landingBlocks: Block[] = [];
  try {
    landingBlocks = JSON.parse(workshop.landingBlocks ?? "[]");
  } catch {
    landingBlocks = [];
  }

  // ── CTA handler — routes to waitlist or checkout ───────────────────────────
  function handleCta(pricingOptionId?: number) {
    // Waitlist mode: CTA URL overrides the modal
    if (isWaitlistMode) {
      if (workshop!.waitlistCtaUrl) {
        window.open(workshop!.waitlistCtaUrl, "_blank");
      } else {
        setWaitlistOpen(true);
      }
      return;
    }
    if (!user) {
      window.location.href = getLoginUrl(window.location.pathname + window.location.search);
      return;
    }
    const opt = pricingOptionId
      ? pricingOptions.find((p: any) => p.id === pricingOptionId)
      : pricingOptions[0];
    if (!opt || opt.price === 0) {
      enrollMutation.mutate({ workshopId: workshop!.id });
    } else {
      const firstInstance = availableInstances[0];
      if (firstInstance) {
        checkoutMutation.mutate({
          workshopSlug: workshop!.slug,
          instanceId: firstInstance.id,
          origin: window.location.origin,
        });
      } else {
        toast.error("No available workshop dates. Please check back later.");
      }
    }
  }

  function handleInstanceRegister(instanceId: number) {
    if (isWaitlistMode) {
      if (workshop!.waitlistCtaUrl) {
        window.open(workshop!.waitlistCtaUrl, "_blank");
      } else {
        setWaitlistOpen(true);
      }
      return;
    }
    if (!user) {
      window.location.href = getLoginUrl(window.location.pathname + window.location.search);
      return;
    }
    const isFree = workshop!.isFree || workshop!.price === 0;
    if (isFree) {
      enrollMutation.mutate({ workshopId: workshop!.id });
    } else {
      // Navigate to dedicated workshop checkout page — handles embedded Stripe checkout
      window.location.href = `/checkout/workshop/${workshop!.slug}?instance=${instanceId}`;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-white ${isPreview ? "pt-10" : ""}`}>
      {isPreview && <AdminPreviewBar workshopId={workshop.id} />}

      {/* Waitlist banner (shown above page builder blocks too) */}
      {isWaitlistMode && (
        <div className="bg-teal-50 border-b border-teal-200 px-4 py-3 text-center">
          <span className="text-sm text-teal-800 font-medium">
            <Bell className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            No upcoming dates are currently open for enrollment — join the waitlist to be notified first.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-3 border-teal-400 text-teal-700 hover:bg-teal-100 text-xs"
            onClick={() => workshop.waitlistCtaUrl ? window.open(workshop.waitlistCtaUrl, "_blank") : setWaitlistOpen(true)}
          >
            {workshop.waitlistCtaLabel || "Join Waitlist"}
          </Button>
        </div>
      )}

      {landingBlocks.length > 0 ? (
        // Page builder blocks — CTA delegation intercepts all enroll/checkout clicks
        <div
          onClick={(e) =>
            handleCtaBtnClick(
              e as React.MouseEvent<HTMLElement>,
              // onEnroll (free) — in waitlist mode, open waitlist instead
              isWaitlistMode
                ? () => { workshop.waitlistCtaUrl ? window.open(workshop.waitlistCtaUrl, "_blank") : setWaitlistOpen(true); }
                : () => enrollMutation.mutate({ workshopId: workshop!.id }),
              // onEnrollWithOption
              undefined,
              // onCheckoutPage (paid)
              (pricingOptionId?: number) => handleCta(pricingOptionId),
            )
          }
        >
          {landingBlocks.map((block: Block) => {
            // cohort_sessions_auto — list, page, calendar, or groups mode
            if (block.type === "cohort_sessions_auto") {
              const d = block.data ?? {};
              const displayMode = (d.displayMode ?? "list") as "list" | "page" | "calendar" | "groups" | "sessions";
              const accentColor = d.accentColor ?? "#179ca3";
              const enrollNowText = d.enrollNowText ?? "Register";
              const showEnrollNow = d.showEnrollNow !== false;
              const groupSelectionMode = d.groupSelectionMode ?? "all";
              const selectedGroupIds: number[] = d.selectedGroupIds ?? [];
              const filteredInstances = groupSelectionMode === "manual" && selectedGroupIds.length > 0
                ? allInstances.filter((inst: any) => selectedGroupIds.includes(inst.id))
                : allInstances;
              const availableIdSet = new Set((availableInstances ?? []).map((inst: any) => inst.id));
              const soldOutIdSet = new Set((soldOutInstances ?? []).map((inst: any) => inst.id));
              const instanceEndMs = (inst: any) => {
                if (inst.endDate) return new Date(inst.endDate).getTime();
                return new Date(inst.startDate).getTime() + ((inst.durationMinutes ?? 60) * 60 * 1000);
              };
              const nowMs = Date.now();
              const visibleInstances = (d.showPastSessions ?? false)
                ? filteredInstances
                : filteredInstances.filter((inst: any) => instanceEndMs(inst) >= nowMs);
              const sortedVisibleInstances = [...visibleInstances].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
              const fmtInstDate = (dt: Date | string | null | undefined) => {
                if (!dt) return null;
                try { return new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return String(dt); }
              };
              const locationStr = (inst: any) => {
                if (inst.locationType === "virtual") return "Virtual / Online";
                const parts = [inst.venueName, inst.venueCity, inst.venueState].filter(Boolean);
                return parts.join(", ") || null;
              };

              // Calendar mode: show a single instance in list/calendar toggle view
              if (displayMode === "calendar") {
                const resolvedInstance = (() => {
                  if (d.calendarGroupId) {
                    return allInstances.find((inst: any) => inst.id === d.calendarGroupId) ?? null;
                  }
                  return filteredInstances
                    .filter((inst: any) => new Date(inst.startDate).getTime() > nowMs)
                    .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] ?? null;
                })();
                if (!resolvedInstance) return null;
                return (
                  <div key={block.id} className="py-8 sm:py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
                    <div className="max-w-4xl mx-auto px-4">
                      {d.headline && <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
                      <WorkshopInstancesCalendar
                        instances={[resolvedInstance]}
                        accentColor={accentColor}
                        defaultView={(d.calendarDefaultView ?? "list") as "list" | "calendar"}
                        showZoomJoin={d.showZoomJoin !== false}
                      />
                    </div>
                  </div>
                );
              }

              // Page mode: show next upcoming instance as full-detail embed
              if (displayMode === "page") {
                const nextUpcoming = filteredInstances
                  .filter((inst: any) => availableIdSet.has(inst.id) && new Date(inst.startDate).getTime() > nowMs)
                  .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] ?? null;
                const soldOutNext = !nextUpcoming
                  ? filteredInstances
                      .filter((inst: any) => new Date(inst.startDate).getTime() > nowMs)
                      .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] ?? null
                  : null;
                if (!nextUpcoming && !soldOutNext) return null;
                return (
                  <div key={block.id} className="py-8 sm:py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
                    <div className="max-w-4xl mx-auto px-4">
                      {d.headline && <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
                      {nextUpcoming ? (
                        <WorkshopInstanceEmbedSection
                          instanceId={nextUpcoming.id}
                          accentColor={accentColor}
                          onRegister={() => handleInstanceRegister(nextUpcoming.id)}
                          enrollNowText={enrollNowText}
                          showEnrollNow={showEnrollNow}
                        />
                      ) : soldOutNext ? (
                        <div className="rounded-2xl border p-6 text-center space-y-3" style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}06` }}>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: "#6b7280" }}>Sold Out</span>
                          <h3 className="font-bold text-gray-900 text-lg">{soldOutNext.title}</h3>
                          <p className="text-sm text-gray-500">This workshop date is currently full. Join the waitlist to be notified when a spot opens or a new date is added.</p>
                          {(workshop?.waitlistEnabled || workshop?.waitlistCtaUrl) && (
                            <button
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
                              style={{ backgroundColor: accentColor }}
                              onClick={() => { if (workshop?.waitlistCtaUrl) { window.open(workshop.waitlistCtaUrl, "_blank"); } else { setWaitlistOpen(true); } }}
                            >Join Waitlist</button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }

              // List / groups / sessions (default) mode: stacked cards
              if (sortedVisibleInstances.length === 0) return null;
              return (
                <div key={block.id} className="py-8 sm:py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
                  <div className="max-w-4xl mx-auto px-4">
                    {d.headline && <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
                    <div className="space-y-4">
                      {sortedVisibleInstances.map((inst: any) => (
                        <div
                          key={inst.id}
                          className="rounded-2xl border overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}06` }}
                          onClick={() => setSelectedInstanceId(inst.id)}
                        >
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="font-bold text-gray-900 text-base">{inst.title}</h3>
                                  {soldOutIdSet.has(inst.id) && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: "#6b7280" }}>Sold Out</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                  {inst.startDate && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-teal-500" />
                                      {fmtInstDate(inst.startDate)}{inst.endDate ? ` – ${fmtInstDate(inst.endDate)}` : ""}
                                    </span>
                                  )}
                                  {d.showLocation !== false && locationStr(inst) && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-teal-500" />
                                      {locationStr(inst)}
                                    </span>
                                  )}
                                  {d.showDuration !== false && inst.durationMinutes && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-teal-500" />
                                      {inst.durationMinutes >= 60 ? `${Math.round(inst.durationMinutes / 60)}h` : `${inst.durationMinutes}min`}
                                    </span>
                                  )}
                                </div>
                                {d.showDescription !== false && inst.description && (
                                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{inst.description}</p>
                                )}
                              </div>
                              {showEnrollNow && availableIdSet.has(inst.id) && (
                                <Button
                                  size="sm"
                                  className="flex-shrink-0 text-white"
                                  style={{ backgroundColor: accentColor }}
                                  onClick={e => { e.stopPropagation(); handleInstanceRegister(inst.id); }}
                                >
                                  {enrollNowText}
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="px-5 pb-3 flex items-center gap-1 text-[11px]" style={{ color: accentColor }}>
                            <ChevronRight className="w-3 h-3" />
                            View details for this date
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
            // cohort_instance_cards_auto — stacked cards, embed, or calendar mode
            if (block.type === "cohort_instance_cards_auto") {
              const d = block.data ?? {};
              const cardDisplayMode = d.cardDisplayMode ?? "stacked";
              const accentColor = d.accentColor ?? "#179ca3";
              const enrollNowText = d.enrollNowText ?? "Register";
              const showEnrollNow = d.showEnrollNow !== false;
              const groupSelectionMode = d.groupSelectionMode ?? "all";
              const selectedGroupIds: number[] = d.selectedGroupIds ?? [];
              const visibleInstances = (groupSelectionMode === "manual" && selectedGroupIds.length > 0
                ? allInstances.filter((inst: any) => selectedGroupIds.includes(inst.id))
                : allInstances);
              if (visibleInstances.length === 0) return null;
              if (cardDisplayMode === "embed") {
                return (
                  <div key={block.id} className="py-8 sm:py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
                    <div className="max-w-4xl mx-auto px-4">
                      {d.headline && <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
                      <div className="space-y-10">
                        {visibleInstances.map((inst: any) => (
                          <WorkshopInstanceEmbedSection
                            key={inst.id}
                            instanceId={inst.id}
                            accentColor={accentColor}
                            onRegister={() => handleInstanceRegister(inst.id)}
                            enrollNowText={enrollNowText}
                            showEnrollNow={showEnrollNow}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              if (cardDisplayMode === "calendar") {
                const calInstId: number | null = (() => {
                  if (groupSelectionMode === "manual" && selectedGroupIds.length > 0) return selectedGroupIds[0];
                  const nextOpen = allInstances.find((inst: any) => new Date(inst.startDate).getTime() > Date.now());
                  return nextOpen?.id ?? null;
                })();
                const calInst = calInstId ? allInstances.find((inst: any) => inst.id === calInstId) ?? null : null;
                if (!calInst) return null;
                return (
                  <div key={block.id} className="py-8 sm:py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
                    <div className="max-w-4xl mx-auto px-4">
                      {d.headline && <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
                      <WorkshopInstancesCalendar
                        instances={[calInst]}
                        accentColor={accentColor}
                        defaultView={(d.calendarDefaultView ?? "list") as "list" | "calendar"}
                        showZoomJoin={d.showZoomJoin !== false}
                      />
                    </div>
                  </div>
                );
              }
              // Stacked cards mode
              const fmtInstDate = (dt: Date | string | null | undefined) => {
                if (!dt) return null;
                try { return new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return String(dt); }
              };
              const locationStr = (inst: any) => {
                if (inst.locationType === "virtual") return "Virtual / Online";
                const parts = [inst.venueName, inst.venueCity, inst.venueState].filter(Boolean);
                return parts.join(", ") || null;
              };
              return (
                <div key={block.id} className="py-8 sm:py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
                  <div className="max-w-4xl mx-auto px-4">
                    {d.headline && <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
                    <div className="space-y-4">
                      {visibleInstances.map((inst: any) => (
                        <div
                          key={inst.id}
                          className="rounded-2xl border overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}06` }}
                          onClick={() => setSelectedInstanceId(inst.id)}
                        >
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-900 text-base mb-1">{inst.title}</h3>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                  {inst.startDate && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-teal-500" />
                                      {fmtInstDate(inst.startDate)}{inst.endDate ? ` – ${fmtInstDate(inst.endDate)}` : ""}
                                    </span>
                                  )}
                                  {d.showLocation !== false && locationStr(inst) && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-teal-500" />
                                      {locationStr(inst)}
                                    </span>
                                  )}
                                  {d.showDuration !== false && inst.durationMinutes && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-teal-500" />
                                      {inst.durationMinutes >= 60 ? `${Math.round(inst.durationMinutes / 60)}h` : `${inst.durationMinutes}min`}
                                    </span>
                                  )}
                                </div>
                                {d.showDescription !== false && inst.description && (
                                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{inst.description}</p>
                                )}
                              </div>
                              {showEnrollNow && (
                                <Button
                                  size="sm"
                                  className="flex-shrink-0 text-white"
                                  style={{ backgroundColor: accentColor }}
                                  onClick={e => { e.stopPropagation(); handleInstanceRegister(inst.id); }}
                                >
                                  {enrollNowText}
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="px-5 pb-3 flex items-center gap-1 text-[11px]" style={{ color: accentColor }}>
                            <ChevronRight className="w-3 h-3" />
                            View details for this date
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
            // remaining_seats — live seat availability block
            if (block.type === "remaining_seats") {
              // Auto-detect instance from page context when sourceId not explicitly set
              const rsData = { ...block.data };
              const firstInstance = availableInstances[0] ?? allInstances[0];
              if (firstInstance?.id) {
                rsData.sourceId = firstInstance.id;
                rsData.sourceType = "workshop_instance";
              }
              return <RemainingSeatsBlock key={block.id} data={rsData} />;
            }
            return (
              <BlockPreview
                key={block.id}
                block={block}
              />
            );
          })}
        </div>
      ) : (
        // Fallback layout
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
          {/* Header */}
          <div>
            {workshop.coverImageUrl && (
              <img
                src={workshop.coverImageUrl}
                alt={workshop.title}
                className="w-full max-h-64 object-cover rounded-xl mb-6"
              />
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="secondary" className="capitalize">{workshop.brand}</Badge>
              <Badge variant="outline" className="capitalize">{workshop.status}</Badge>
              {isWaitlistMode && (
                <Badge className="bg-teal-100 text-teal-700 border-teal-200">Waitlist Open</Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{workshop.title}</h1>
            {workshop.subtitle && (
              <p className="text-lg text-gray-600 mb-4">{workshop.subtitle}</p>
            )}
            {workshop.description && (
              <div
                className="prose prose-gray max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: workshop.description }}
              />
            )}
          </div>

          {/* Waitlist CTA (fallback layout, no instances) */}
          {isWaitlistMode && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-6">
              {workshop.waitlistHeading && (
                <h2 className="text-xl font-semibold text-teal-900 mb-2">{workshop.waitlistHeading}</h2>
              )}
              {workshop.waitlistBody && (
                <div
                  className="prose prose-sm text-teal-800 max-w-none mb-4"
                  dangerouslySetInnerHTML={{ __html: workshop.waitlistBody }}
                />
              )}
              <Button
                onClick={() => workshop.waitlistCtaUrl ? window.open(workshop.waitlistCtaUrl, "_blank") : setWaitlistOpen(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
              >
                <Bell className="w-4 h-4" />
                {workshop.waitlistCtaLabel || "Join the Waitlist"}
              </Button>
            </div>
          )}

          {/* Available Instances (non-waitlist mode) */}
          {!isWaitlistMode && (availableInstances.length > 0 || soldOutInstances.length > 0) && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Dates</h2>
              <div className="space-y-3">
                {availableInstances.map((inst: any) => (
                  <InstanceCard
                    key={inst.id}
                    instance={inst}
                    onRegister={handleInstanceRegister}
                    isPending={enrollMutation.isPending || checkoutMutation.isPending}
                  />
                ))}
                {soldOutInstances.map((inst: any) => (
                  <SoldOutInstanceCard key={inst.id} instance={inst} />
                ))}
              </div>
            </div>
          )}

          {/* Pricing (no instances, no waitlist mode) */}
          {!isWaitlistMode && availableInstances.length === 0 && pricingOptions.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Registration</h2>
              <div className="space-y-3">
                {pricingOptions.map((opt: any) => (
                  <div key={opt.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{opt.name ?? "Standard Registration"}</p>
                      {opt.description && <p className="text-sm text-gray-500">{opt.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900">{fmtPrice(opt.price)}</span>
                      <Button
                        size="sm"
                        onClick={() => handleCta(opt.id)}
                        disabled={enrollMutation.isPending || checkoutMutation.isPending}
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                      >
                        Register
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No instances, no pricing, no waitlist */}
          {!isWaitlistMode && availableInstances.length === 0 && pricingOptions.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="font-medium text-amber-800">No upcoming dates available</p>
              <p className="text-sm text-amber-600 mt-1">Check back soon for new workshop dates.</p>
            </div>
          )}
        </div>
      )}

      {/* Waitlist sign-up modal */}
      {isWaitlistMode && (
        <WaitlistModal
          open={waitlistOpen}
          onClose={() => setWaitlistOpen(false)}
          workshop={workshop}
        />
      )}

      {/* Workshop instance detail modal */}
      <WorkshopInstanceDetailModal
        open={selectedInstanceId !== null}
        instanceId={selectedInstanceId}
        onClose={() => setSelectedInstanceId(null)}
        onRegister={() => {
          const id = selectedInstanceId;
          setSelectedInstanceId(null);
          if (id !== null) handleInstanceRegister(id);
        }}
      />
    </div>
  );
}

// ─── PublicLandingBlock ─────────────────────────────────────────────────────
// Renders a landing block for a public page. Unlike BlockPreview, it renders
// remaining_seats with live data (no preview flag), auto-binding the current
// workshop instance id from context when no sourceId is saved on the block.
function PublicLandingBlock({ block, instanceId }: { block: any; instanceId: number | null }) {
  if (block.type === "remaining_seats") {
    const rsData = { ...block.data };
    if (instanceId && (!rsData.sourceId || Number(rsData.sourceId) === 0)) {
      rsData.sourceId = instanceId;
      rsData.sourceType = "workshop_instance";
    }
    return <RemainingSeatsBlock data={rsData} />;
  }
  return <BlockPreview block={block} />;
}
// ─── Workshop Instance Detail Modal ──────────────────────────────────────────
// Full-page modal that fetches and renders a workshop instance's landing blocks.
function WorkshopInstanceDetailModal({
  open,
  instanceId,
  onClose,
  onRegister,
}: {
  open: boolean;
  instanceId: number | null;
  onClose: () => void;
  onRegister: () => void;
}) {
  const { data, isLoading, error } = trpc.workshop.getInstancePage.useQuery(
    { instanceId: instanceId! },
    { enabled: open && instanceId !== null }
  );

  const fmtDate = (d: Date | string | null | undefined) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch { return String(d); }
  };

  const locationStr = data ? (() => {
    if (data.locationType === "virtual") return "Virtual / Online";
    const parts = [data.venueName, data.venueCity, data.venueState].filter(Boolean);
    return parts.join(", ") || null;
  })() : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl sm:max-w-5xl w-full h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0">
          <div>
            {data && <h2 className="text-lg font-bold text-gray-900">{data.title}</h2>}
            {!data && !isLoading && <h2 className="text-lg font-bold text-gray-900">Workshop Details</h2>}
            {isLoading && <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={onRegister}
            >
              Register Now
            </Button>
            <DialogClose asChild>
              <button className="rounded-full p-1.5 hover:bg-gray-100 transition-colors" aria-label="Close">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </DialogClose>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-8 space-y-4">
              <div className="h-8 w-2/3 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
              <div className="h-32 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          )}
          {error && (
            <div className="p-8 text-center text-gray-500">
              <p>Could not load instance details. Please try again.</p>
            </div>
          )}
          {data && (
            <>
              {(!data.landingBlocks || data.landingBlocks.length === 0) ? (
                <div className="p-8 max-w-2xl mx-auto space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{data.title}</h3>
                    {data.description && <p className="text-gray-600">{data.description}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.startDate && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-teal-50 border border-teal-100">
                        <Calendar className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Start Date</p>
                          <p className="text-sm text-gray-800 font-medium mt-0.5">{fmtDate(data.startDate)}</p>
                        </div>
                      </div>
                    )}
                    {data.endDate && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-teal-50 border border-teal-100">
                        <Calendar className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">End Date</p>
                          <p className="text-sm text-gray-800 font-medium mt-0.5">{fmtDate(data.endDate)}</p>
                        </div>
                      </div>
                    )}
                    {locationStr && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <MapPin className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Location</p>
                          <p className="text-sm text-gray-800 font-medium mt-0.5">{locationStr}</p>
                        </div>
                      </div>
                    )}
                    {data.durationMinutes && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <Clock className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Duration</p>
                          <p className="text-sm text-gray-800 font-medium mt-0.5">
                            {data.durationMinutes >= 60 ? `${Math.round(data.durationMinutes / 60)} hours` : `${data.durationMinutes} minutes`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {data.instanceContent && (
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: data.instanceContent }} />
                  )}
                  <div className="text-center pt-4">
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white px-8" onClick={onRegister}>
                      Register for This Date
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {(data.landingBlocks as any[]).map((block: any) => (
                    <PublicLandingBlock key={block.id} block={block} instanceId={instanceId} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── WorkshopInstanceEmbedSection ────────────────────────────────────────────
// Renders a workshop instance's full detail inline (no modal) for embed mode.
function WorkshopInstanceEmbedSection({
  instanceId,
  accentColor,
  onRegister,
  enrollNowText,
  showEnrollNow,
}: {
  instanceId: number;
  accentColor: string;
  onRegister: () => void;
  enrollNowText: string;
  showEnrollNow: boolean;
}) {
  const { data, isLoading, error } = trpc.workshop.getInstancePage.useQuery({ instanceId });

  const fmtDate = (d: Date | string | null | undefined) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch { return String(d); }
  };

  const locationStr = data ? (() => {
    if (data.locationType === "virtual") return "Virtual / Online";
    const parts = [data.venueName, data.venueCity, data.venueState].filter(Boolean);
    return parts.join(", ") || null;
  })() : null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border p-8 space-y-4" style={{ borderColor: `${accentColor}33` }}>
        <div className="h-8 w-2/3 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border p-8 text-center text-gray-500" style={{ borderColor: `${accentColor}33` }}>
        <p>Could not load workshop instance details.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${accentColor}22` }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ backgroundColor: `${accentColor}08`, borderColor: `${accentColor}22` }}>
        <h3 className="text-lg font-bold text-gray-900">{data.title}</h3>
        {showEnrollNow && (
          <Button
            size="sm"
            className="text-white flex-shrink-0"
            style={{ backgroundColor: accentColor }}
            onClick={onRegister}
          >
            {enrollNowText}
          </Button>
        )}
      </div>
      {/* Content */}
      {(!data.landingBlocks || (data.landingBlocks as any[]).length === 0) ? (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
          {data.description && <p className="text-gray-600">{data.description}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.startDate && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-teal-50 border border-teal-100">
                <Calendar className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Start Date</p>
                  <p className="text-sm text-gray-800 font-medium mt-0.5">{fmtDate(data.startDate)}</p>
                </div>
              </div>
            )}
            {data.endDate && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-teal-50 border border-teal-100">
                <Calendar className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">End Date</p>
                  <p className="text-sm text-gray-800 font-medium mt-0.5">{fmtDate(data.endDate)}</p>
                </div>
              </div>
            )}
            {locationStr && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <MapPin className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Location</p>
                  <p className="text-sm text-gray-800 font-medium mt-0.5">{locationStr}</p>
                </div>
              </div>
            )}
            {data.durationMinutes && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <Clock className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Duration</p>
                  <p className="text-sm text-gray-800 font-medium mt-0.5">
                    {data.durationMinutes >= 60 ? `${Math.round(data.durationMinutes / 60)} hours` : `${data.durationMinutes} minutes`}
                  </p>
                </div>
              </div>
            )}
          </div>
          {data.instanceContent && (
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: data.instanceContent }} />
          )}
          {showEnrollNow && (
            <div className="text-center pt-2">
              <Button className="text-white px-8" style={{ backgroundColor: accentColor }} onClick={onRegister}>
                {enrollNowText}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {(data.landingBlocks as any[]).map((block: any) => (
            <PublicLandingBlock key={block.id} block={block} instanceId={instanceId} />
          ))}
          {showEnrollNow && (
            <div className="text-center py-6">
              <Button className="text-white px-8" style={{ backgroundColor: accentColor }} onClick={onRegister}>
                {enrollNowText}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
