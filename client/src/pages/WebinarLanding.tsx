/**
 * WebinarLanding.tsx
 * Public-facing sales/landing page for a webinar.
 * Route: /webinars/:slug
 *
 * Renders the page-builder blocks stored in webinar.landingPageBlocks.
 * Falls back to an auto-layout if no blocks are configured.
 * Handles:
 *   - Free registration (webinarLearner.register)
 *   - Paid checkout (redirect to /checkout/:slug?type=webinar)
 *   - Draft state → "Enrollment Closed" + "Notify Me When Open" modal
 *   - Preview mode (?preview=admin) for admins
 */
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Clock, Users, Video, Bell, CheckCircle } from "lucide-react";
import type { Block } from "@/components/BlockPreview";
import { BlockPreview } from "@/components/BlockPreview";
import type { UserParamSource } from "@/lib/userUrlParams";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(webinar: any): string {
  if (webinar.accessType === "free" || webinar.isFree) return "Free";
  const opts: any[] = webinar.pricingOptions ? JSON.parse(webinar.pricingOptions) : [];
  if (opts.length > 0 && opts[0].price) return `$${opts[0].price % 1 === 0 ? Number(opts[0].price).toLocaleString("en-US") : Number(opts[0].price).toFixed(2)}`;
  if (webinar.price) return `$${(webinar.price / 100).toFixed(2)}`;
  return "Free";
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(ts: number | null | undefined, tz?: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: tz ?? undefined });
}

// ─── RenderBlock ──────────────────────────────────────────────────────────────
function RenderBlock({
  block, webinar, onRegister, registering, ctaText, price, isRegistered, isDraft, onDraftNotify, user,
}: {
  block: Block;
  webinar: any;
  onRegister: () => void;
  registering: boolean;
  ctaText: string;
  price: string;
  isRegistered: boolean;
  isDraft: boolean;
  onDraftNotify: () => void;
  user?: UserParamSource | null;
}) {
  const d = block.data ?? {};
  const isEnrollBtn = (btn: any) => {
    const beh = btn?.behavior ?? btn?.action ?? "";
    return beh === "enroll" || beh === "checkout" || beh === "direct_checkout" || beh === "free_enrollment" || !beh;
  };

  switch (block.type) {
    case "hero": {
      const heroButtons: any[] = d.buttons ?? [];
      return (
        <div className="relative overflow-hidden" style={{ backgroundColor: d.bgColor ?? "#0e1e2e", minHeight: 480 }}>
          {d.bgImage && (
            <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${d.bgImage})` }} />
          )}
          <div className="relative max-w-5xl mx-auto px-4 py-20 text-center">
            {d.badge && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4" style={{ backgroundColor: "#189aa120", color: "#4ad9e0" }}>{d.badge}</span>
            )}
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: d.textColor ?? "#fff" }}>{d.headline ?? webinar.title}</h1>
            {d.subheadline && <p className="text-lg mb-8 opacity-80 max-w-2xl mx-auto" style={{ color: d.textColor ?? "#fff" }}>{d.subheadline}</p>}
            <div className="flex flex-wrap gap-3 justify-center">
              {heroButtons.length > 0 ? heroButtons.map((btn: any, i: number) => {
                const isEnroll = isEnrollBtn(btn);
                return (
                  <button key={i}
                    onClick={isDraft && isEnroll ? undefined : isEnroll ? onRegister : undefined}
                    disabled={(isDraft && isEnroll) || (registering && isEnroll)}
                    className="px-8 py-3 rounded-xl font-bold text-base shadow-lg disabled:opacity-60 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: btn.color ?? "#189aa1", color: btn.textColor ?? "#fff" }}
                  >
                    {isDraft && isEnroll ? "Enrollment Closed" : registering && isEnroll ? "Processing…" : btn.text ?? ctaText}
                  </button>
                );
              }) : (
                <button
                  onClick={isDraft ? undefined : onRegister}
                  disabled={isDraft || registering}
                  className="px-10 py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-60 transition-opacity hover:opacity-90 bg-teal-500 text-white"
                >
                  {isDraft ? "Enrollment Closed" : registering ? "Processing…" : ctaText}
                </button>
              )}
            </div>
            {isDraft && (
              <div className="mt-4 space-y-2">
                <p className="text-sm opacity-60" style={{ color: d.textColor ?? "#fff" }}>Check back soon for enrollment updates.</p>
                <button onClick={onDraftNotify} className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" style={{ color: d.textColor ?? "#fff" }}>
                  <Bell className="w-3.5 h-3.5" /> Notify Me When Open
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    case "cta_section":
    case "cta_standalone": {
      return (
        <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#f8fafc" }}>
          <div className="max-w-3xl mx-auto px-4 text-center">
            {d.headline && <h2 className="text-3xl font-bold mb-3" style={{ color: d.textColor ?? "#111827" }}>{d.headline}</h2>}
            {d.subheadline && <p className="text-gray-500 mb-6">{d.subheadline}</p>}
            {(d.showStrikethrough && d.strikethroughPrice) && <p className="text-lg text-gray-400 line-through mb-1">{d.strikethroughPrice}</p>}
            {d.displayPrice && <p className="text-3xl font-bold mb-4" style={{ color: d.ctaColor ?? "#189aa1" }}>{d.displayPrice}</p>}
            <button
              onClick={isDraft ? undefined : onRegister}
              disabled={isDraft || registering}
              className="px-10 py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: d.ctaColor ?? "#189aa1", color: d.ctaTextColor ?? "#fff" }}
            >
              {isDraft ? "Enrollment Closed" : registering ? "Processing…" : (d.ctaText ?? ctaText)}
            </button>
            {isDraft && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-500">Check back soon for enrollment updates.</p>
                <button onClick={onDraftNotify} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700">
                  <Bell className="w-3.5 h-3.5" /> Notify Me When Open
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    case "webinar_hero":
    case "webinar_registration":
    case "webinar_host_bio":
    case "webinar_replay":
    case "webinar_agenda":
      return <BlockPreview block={block} />;

    default:
      return <BlockPreview block={block} />;
  }
}

// ─── Auto-layout fallback ─────────────────────────────────────────────────────
function AutoLayout({
  webinar, onRegister, registering, ctaText, price, isRegistered, isDraft, onDraftNotify,
}: {
  webinar: any; onRegister: () => void; registering: boolean; ctaText: string; price: string;
  isRegistered: boolean; isDraft: boolean; onDraftNotify: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0e1e2e] to-[#1a3a4a] text-white">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4 bg-teal-500/20 text-teal-300">
                <Video className="w-3.5 h-3.5" />
                {webinar.type === "live" ? "LIVE WEBINAR" : "ON-DEMAND WEBINAR"}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">{webinar.title}</h1>
              {webinar.subtitle && <p className="text-lg text-gray-300 mb-4">{webinar.subtitle}</p>}
              {webinar.description && (
                <p className="text-gray-400 mb-6 line-clamp-3">{webinar.description}</p>
              )}
              {/* Meta */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-300 mb-8">
                {webinar.scheduledAt && (
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-teal-400" />{formatDate(webinar.scheduledAt)}</span>
                )}
                {webinar.scheduledAt && (
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-teal-400" />{formatTime(webinar.scheduledAt, webinar.timezone)}</span>
                )}
                {webinar.durationMinutes && (
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-teal-400" />{webinar.durationMinutes} min</span>
                )}
              </div>
              {/* CTA */}
              <div className="space-y-3">
                <button
                  onClick={isDraft ? undefined : onRegister}
                  disabled={isDraft || registering}
                  className="w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-lg bg-teal-500 hover:bg-teal-600 text-white shadow-lg disabled:opacity-60 transition-colors"
                >
                  {isDraft ? "Enrollment Closed" : registering ? "Processing…" : ctaText}
                </button>
                {isDraft && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Check back soon for enrollment updates.</p>
                    <button onClick={onDraftNotify} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-400 hover:text-teal-300">
                      <Bell className="w-3.5 h-3.5" /> Notify Me When Open
                    </button>
                  </div>
                )}
                {!isDraft && webinar.accessType !== "free" && (
                  <p className="text-sm text-gray-400">Price: <span className="text-white font-semibold">{price}</span></p>
                )}
              </div>
            </div>
            {/* Thumbnail */}
            <div className="hidden md:block">
              {webinar.thumbnailUrl || webinar.coverImage ? (
                <img src={webinar.thumbnailUrl ?? webinar.coverImage} alt={webinar.title} className="w-full rounded-2xl shadow-2xl object-cover aspect-video" />
              ) : (
                <div className="w-full rounded-2xl bg-white/10 flex items-center justify-center aspect-video">
                  <Video className="w-16 h-16 text-teal-400/50" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Host bio */}
      {(webinar.hostName || webinar.hostTitle) && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 py-10 flex items-center gap-6">
            {webinar.hostAvatar ? (
              <img src={webinar.hostAvatar} alt={webinar.hostName} className="w-16 h-16 rounded-full object-cover border-2 border-teal-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                <Users className="w-8 h-8 text-teal-500" />
              </div>
            )}
            <div>
              <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide mb-0.5">Your Host</p>
              <p className="text-lg font-bold text-gray-900">{webinar.hostName}</p>
              {webinar.hostTitle && <p className="text-sm text-gray-500">{webinar.hostTitle}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {webinar.description && (
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">About This Webinar</h2>
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{webinar.description}</p>
        </div>
      )}

      {/* Bottom CTA */}
      {!isDraft && (
        <div className="bg-teal-50 border-t border-teal-100">
          <div className="max-w-5xl mx-auto px-4 py-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Join?</h2>
            <p className="text-gray-500 mb-6">{webinar.accessType === "free" ? "Registration is free." : `Price: ${price}`}</p>
            <button
              onClick={onRegister}
              disabled={registering}
              className="px-10 py-4 rounded-xl font-bold text-lg bg-teal-500 hover:bg-teal-600 text-white shadow-lg disabled:opacity-60 transition-colors"
            >
              {registering ? "Processing…" : ctaText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WebinarLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isPreview = new URLSearchParams(window.location.search).get("preview") === "admin";

  // Notify Me modal state
  const [draftNotifyOpen, setDraftNotifyOpen] = useState(false);
  const [dnName, setDnName] = useState("");
  const [dnEmail, setDnEmail] = useState("");
  const [dnSubmitted, setDnSubmitted] = useState(false);

  const submitDraftNotify = trpc.lms.submitDraftNotify.useMutation({
    onSuccess: () => setDnSubmitted(true),
    onError: (e) => toast.error(e.message),
  });

  // Fetch webinar data
  const { data, isLoading, error } = trpc.webinar.getBySlug.useQuery(
    { slug: slug!, preview: isPreview || undefined },
    { enabled: !!slug }
  );
  const webinar = data?.webinar;
  const isRegistered = data?.isRegistered ?? false;

  // Registration mutation (free)
  const registerMut = trpc.webinarLearner.register.useMutation({
    onSuccess: () => {
      toast.success("Registered! You now have access.");
      navigate(`/webinar/${slug}`);
    },
    onError: (e) => toast.error(`Registration failed: ${e.message}`),
  });

  const registering = registerMut.isPending;

  // Pre-fill notify modal with user info
  useEffect(() => {
    if (user) {
      setDnName((user as any).name ?? "");
      setDnEmail((user as any).email ?? "");
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!webinar || error) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">Webinar not found</p>
        <Button variant="link" onClick={() => navigate("/")}>Back to Home</Button>
      </div>
    );
  }

  const isDraft = webinar.status === "draft" || webinar.status === "enrollment_closed";
  const price = formatPrice(webinar);
  const isFree = webinar.accessType === "free" || webinar.isFree;

  const ctaText = isDraft
    ? "Enrollment Closed"
    : isRegistered
    ? "Watch Webinar"
    : isFree
    ? "Register Free"
    : `Register — ${price}`;

  const handleRegister = () => {
    if (isDraft) return;
    if (isRegistered) {
      navigate(`/webinar/${slug}`);
      return;
    }
    if (isFree) {
      registerMut.mutate({ webinarId: webinar.id });
    } else {
      // Paid — go to checkout
      navigate(`/checkout/${slug}?type=webinar`);
    }
  };

  const handleDraftNotify = () => {
    setDnName((user as any)?.name ?? "");
    setDnEmail((user as any)?.email ?? "");
    setDnSubmitted(false);
    setDraftNotifyOpen(true);
  };

  // Parse landing page blocks
  let blocks: Block[] = [];
  if (webinar.landingPageBlocks) {
    try { blocks = JSON.parse(webinar.landingPageBlocks) as Block[]; } catch {}
  }

  const hasBlocks = blocks.length > 0;

  return (
    <>
      {/* Draft banner for admins */}
      {isDraft && isPreview && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-700 font-medium">
          Preview Mode — This webinar is in <strong>draft</strong>. CTAs are disabled for visitors.
        </div>
      )}

      {hasBlocks ? (
        <div>
          {blocks.map((block) => (
            <RenderBlock
              key={block.id}
              block={block}
              webinar={webinar}
              onRegister={handleRegister}
              registering={registering}
              ctaText={ctaText}
              price={price}
              isRegistered={isRegistered}
              isDraft={isDraft}
              onDraftNotify={handleDraftNotify}
              user={user as UserParamSource | null}
            />
          ))}
        </div>
      ) : (
        <AutoLayout
          webinar={webinar}
          onRegister={handleRegister}
          registering={registering}
          ctaText={ctaText}
          price={price}
          isRegistered={isRegistered}
          isDraft={isDraft}
          onDraftNotify={handleDraftNotify}
        />
      )}

      {/* Notify Me When Open modal */}
      <Dialog open={draftNotifyOpen} onOpenChange={setDraftNotifyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-teal-500" /> Notify Me When Open
            </DialogTitle>
            <DialogDescription>
              Enter your details and we'll email you as soon as enrollment opens for this webinar.
            </DialogDescription>
          </DialogHeader>
          {dnSubmitted ? (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-teal-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800">You're on the list!</p>
              <p className="text-sm text-gray-500 mt-1">We'll notify you at <strong>{dnEmail}</strong> when enrollment opens.</p>
              <Button className="mt-4" onClick={() => setDraftNotifyOpen(false)}>Close</Button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); submitDraftNotify.mutate({ name: dnName, email: dnEmail, productId: webinar.id, productType: "webinar" }); }} className="space-y-4">
              <div>
                <Label htmlFor="dn-name">Name</Label>
                <Input id="dn-name" value={dnName} onChange={e => setDnName(e.target.value)} placeholder="Your name" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="dn-email">Email</Label>
                <Input id="dn-email" type="email" value={dnEmail} onChange={e => setDnEmail(e.target.value)} placeholder="your@email.com" required className="mt-1" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDraftNotifyOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitDraftNotify.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
                  {submitDraftNotify.isPending ? "Saving…" : "Notify Me"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
