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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Briefcase, Calendar, MapPin, Clock, Users, Edit2, ArrowLeft, ExternalLink, CheckCircle, Bell } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useState, useEffect } from "react";
import { BlockPreview, type Block } from "@/components/BlockPreview";
import { handleCtaBtnClick } from "@/pages/CourseLanding";
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

  const checkoutMutation = trpc.workshopLearner.createEmbeddedCheckoutSession.useMutation({
    onSuccess: (res: any) => {
      if (res.checkoutUrl) {
        window.open(res.checkoutUrl, "_blank");
        toast.info("Redirecting to checkout…");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const workshop = data?.workshop;
  const availableInstances = data?.availableInstances ?? [];
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
      checkoutMutation.mutate({
        workshopSlug: workshop!.slug,
        instanceId,
        origin: window.location.origin,
      });
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
          {landingBlocks.map((block: Block) => (
            <BlockPreview
              key={block.id}
              block={block}
            />
          ))}
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
          {!isWaitlistMode && availableInstances.length > 0 && (
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
    </div>
  );
}
