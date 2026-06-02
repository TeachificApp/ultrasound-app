/**
 * Checkout.tsx
 * Thinkific-style hosted checkout page for All About Ultrasound™ LMS.
 *
 * Route: /checkout/:courseSlug
 * Query params:
 *   ?option=<pricingOptionId>   — use a specific pricing option
 *   ?tier=<teamTierId>          — use a team tier (bulk seats)
 *
 * Flow:
 *  1. Fetch course + pricing metadata from backend (createEmbeddedCheckoutSession)
 *  2. Show course cover image, title, subtitle, description, and billing disclosure
 *  3. Require user to check Terms of Service + Privacy Policy (org-level URLs)
 *     and subscription acknowledgment if recurring
 *  4. Mount <EmbeddedCheckout> from @stripe/react-stripe-js once terms accepted
 *
 * All interactive elements (buttons, checkboxes, badges, links) use the course's
 * primaryColor / accentColor / gradient from the database.
 */
import { useState, useMemo, CSSProperties } from "react";
import { useParams, useLocation, Link } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { trpc } from "@/lib/trpc";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck, RefreshCw, Lock, AlertCircle, ArrowLeft, CheckCircle2, BookOpen,
  Award, Star, Heart, Zap, Shield, BadgeCheck, ChevronDown, ChevronRight,
  MessageSquare, HelpCircle, Code2,
} from "lucide-react";
import {
  parseCheckoutPageConfig,
  CheckoutSection,
  TrustSealsSection,
  GuaranteeSection,
  TestimonialsSection,
  FaqSection,
  CustomHtmlSection,
  CourseIncludesSection,
  ContentBlockSection,
  PresetSealId,
} from "@/../../shared/checkoutPageConfig";
import { BlockPreview } from "@/pages/admin/LandingPageBuilder";
import type { Block } from "@/pages/admin/LandingPageBuilder";

// Initialise Stripe once outside the component to avoid re-creating on every render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

// ─── Preset seal icon map ─────────────────────────────────────────────────────
const SEAL_ICONS: Record<PresetSealId, React.ReactNode> = {
  stripe_secure: <Lock className="h-4 w-4" />,
  ssl_encrypted: <ShieldCheck className="h-4 w-4" />,
  money_back_30: <RefreshCw className="h-4 w-4" />,
  money_back_14: <RefreshCw className="h-4 w-4" />,
  satisfaction_guaranteed: <Star className="h-4 w-4" />,
  hipaa_compliant: <Shield className="h-4 w-4" />,
  accredited_cme: <BadgeCheck className="h-4 w-4" />,
  secure_payment: <Lock className="h-4 w-4" />,
  privacy_protected: <Shield className="h-4 w-4" />,
};

const GUARANTEE_ICONS: Record<string, React.ReactNode> = {
  ShieldCheck: <ShieldCheck className="h-8 w-8" />,
  Award: <Award className="h-8 w-8" />,
  Star: <Star className="h-8 w-8" />,
  Heart: <Heart className="h-8 w-8" />,
  Zap: <Zap className="h-8 w-8" />,
  CheckCircle2: <CheckCircle2 className="h-8 w-8" />,
  BadgeCheck: <BadgeCheck className="h-8 w-8" />,
  RefreshCw: <RefreshCw className="h-8 w-8" />,
};

// ─── Section renderers ────────────────────────────────────────────────────────

function TrustSealsRenderer({
  section, primary, primaryLight, isDark,
}: { section: TrustSealsSection; primary: string; primaryLight: string; isDark: boolean }) {
  const enabled = section.seals.filter((s) => s.enabled);
  if (!enabled.length) return null;
  return (
    <div className={`rounded-xl border p-4 ${
      isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
    }`}>
      <div className={section.layout === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-wrap gap-3 justify-center"}>
        {enabled.map((seal) => (
          <div
            key={seal.id}
            className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg"
            style={{ backgroundColor: primaryLight, color: primary, border: `1px solid ${primary}33` }}
          >
            {seal.preset && SEAL_ICONS[seal.preset as PresetSealId]
              ? SEAL_ICONS[seal.preset as PresetSealId]
              : <ShieldCheck className="h-4 w-4" />}
            {seal.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function GuaranteeRenderer({
  section, primary, primaryLight, isDark,
}: { section: GuaranteeSection; primary: string; primaryLight: string; isDark: boolean }) {
  return (
    <div
      className="rounded-xl p-4 flex gap-4"
      style={{ backgroundColor: primaryLight, border: `1px solid ${primary}44` }}
    >
      <div
        className="h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${primary}22`, color: primary }}
      >
        {GUARANTEE_ICONS[section.icon] ?? <ShieldCheck className="h-8 w-8" />}
      </div>
      <div className="flex-1 min-w-0">
        {section.badgeLabel && (
          <span
            className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2"
            style={{ backgroundColor: `${primary}22`, color: primary }}
          >
            {section.badgeLabel}
          </span>
        )}
        <p className="text-sm font-bold mb-1" style={{ color: primary }}>{section.headline}</p>
        <p className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>{section.body}</p>
      </div>
    </div>
  );
}

function TestimonialsRenderer({
  section, primary, isDark,
}: { section: TestimonialsSection; primary: string; isDark: boolean }) {
  const enabled = section.testimonials.filter((t) => t.enabled);
  if (!enabled.length) return null;
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
    }`}>
      {section.headline && (
        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-800"}`}>{section.headline}</p>
      )}
      {enabled.map((t) => (
        <div key={t.id} className={`p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
          {t.rating && (
            <div className="flex gap-0.5 mb-1.5">
              {[1,2,3,4,5].map((r) => (
                <span key={r} className={`text-sm ${(t.rating ?? 5) >= r ? "text-yellow-400" : "text-gray-200"}`}>★</span>
              ))}
            </div>
          )}
          <p className={`text-xs leading-relaxed italic mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            "{t.quote}"
          </p>
          <div className="flex items-center gap-2">
            {t.avatarUrl ? (
              <img src={t.avatarUrl} alt={t.name} className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: primary }}>
                {t.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-gray-800"}`}>{t.name}</p>
              {t.role && <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-500"}`}>{t.role}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FaqRenderer({
  section, primary, isDark,
}: { section: FaqSection; primary: string; isDark: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const enabled = section.items.filter((i) => i.enabled);
  if (!enabled.length) return null;
  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
    }`}>
      {section.headline && (
        <div className={`px-4 py-3 border-b ${isDark ? "border-gray-800" : "border-gray-100"}`}>
          <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-800"}`}>{section.headline}</p>
        </div>
      )}
      {enabled.map((item, idx) => (
        <div key={item.id} className={idx > 0 ? `border-t ${isDark ? "border-gray-800" : "border-gray-100"}` : ""}>
          <button
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
              isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
            }`}
            onClick={() => setOpenId(openId === item.id ? null : item.id)}
          >
            <span className={`text-xs font-medium ${isDark ? "text-white" : "text-gray-800"}`}>{item.question}</span>
            <ChevronDown
              className={`h-4 w-4 flex-shrink-0 transition-transform ${openId === item.id ? "rotate-180" : ""}`}
              style={{ color: primary }}
            />
          </button>
          {openId === item.id && (
            <div className={`px-4 pb-3 text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CourseIncludesRenderer({
  section, courseStats, primary, primaryLight, isDark,
}: {
  section: CourseIncludesSection;
  courseStats: { totalLessons: number; totalSections: number; hasCertificate: boolean } | null;
  primary: string;
  primaryLight: string;
  isDark: boolean;
}) {
  const items = section.items ?? (
    courseStats ? [
      courseStats.totalLessons > 0 ? { icon: "BookOpen", text: `${courseStats.totalLessons} lesson${courseStats.totalLessons !== 1 ? "s" : ""}` } : null,
      courseStats.totalSections > 0 ? { icon: "BookOpen", text: `${courseStats.totalSections} section${courseStats.totalSections !== 1 ? "s" : ""}` } : null,
      courseStats.hasCertificate ? { icon: "Award", text: "Certificate of completion" } : null,
      { icon: "CheckCircle2", text: "Lifetime access" },
    ].filter(Boolean) as Array<{ icon: string; text: string }>
    : []
  );
  if (!items.length) return null;
  return (
    <div className={`rounded-xl border p-4 ${
      isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
    }`}>
      {section.headline && (
        <p className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-gray-800"}`}>{section.headline}</p>
      )}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: primary }} />
            <span className={`text-xs ${isDark ? "text-gray-300" : "text-gray-700"}`}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomHtmlRenderer({ section }: { section: CustomHtmlSection }) {
  if (!section.html.trim()) return null;
  return (
    <div
      className="checkout-custom-html text-sm"
      dangerouslySetInnerHTML={{ __html: section.html }}
    />
  );
}

function formatPrice(amount: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Lighten a hex color by mixing it with white at the given ratio (0–1) */
function lighten(hex: string, ratio = 0.88): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * ratio);
  const lg = Math.round(g + (255 - g) * ratio);
  const lb = Math.round(b + (255 - b) * ratio);
  return `rgb(${lr},${lg},${lb})`;
}

/** Determine a readable text color (white or dark) for a given background hex */
function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1a2e2e" : "#ffffff";
}

// ─── CheckoutSections: fetches config and renders all enabled sections ────────────────────

function CheckoutSections({
  entitySlug, entityType, primary, primaryLight, isDark, courseStats,
}: {
  entitySlug: string;
  entityType: "course" | "download" | "physical" | "webinar" | "membership";
  primary: string;
  primaryLight: string;
  isDark: boolean;
  courseStats: { totalLessons: number; totalSections: number; hasCertificate: boolean } | null;
}) {
  const lmsData = trpc.lmsAdmin.getPublicCheckoutPageConfig.useQuery({ courseSlug: entitySlug }, { enabled: entityType === "course" });
  const dlData = trpc.downloadsCheckout.getPublicCheckoutPageConfig.useQuery({ productSlug: entitySlug }, { enabled: entityType === "download" });
  const physData = trpc.productsCheckout.getPublicCheckoutPageConfig.useQuery({ productSlug: entitySlug }, { enabled: entityType === "physical" });
  const webData = trpc.webinarCheckout.getPublicCheckoutPageConfig.useQuery({ webinarSlug: entitySlug }, { enabled: entityType === "webinar" });
  const memData = trpc.membership.getPublicCheckoutPageConfig.useQuery({ planSlug: entitySlug }, { enabled: entityType === "membership" });
  const data = entityType === "course" ? lmsData.data
    : entityType === "download" ? dlData.data
    : entityType === "physical" ? physData.data
    : entityType === "webinar" ? webData.data
    : memData.data;

  const config = data ? parseCheckoutPageConfig(data.config) : null;
  const stats = data?.courseStats ?? courseStats;

  if (!config) return null;

  return (
    <div className="space-y-4">
      {config.sections
        .filter((s) => s.enabled)
        .sort((a, b) => a.order - b.order)
        .map((section, idx) => {
          if (section.type === "trust_seals") {
            return <TrustSealsRenderer key={idx} section={section} primary={primary} primaryLight={primaryLight} isDark={isDark} />;
          }
          if (section.type === "guarantee") {
            return <GuaranteeRenderer key={idx} section={section} primary={primary} primaryLight={primaryLight} isDark={isDark} />;
          }
          if (section.type === "testimonials") {
            return <TestimonialsRenderer key={idx} section={section} primary={primary} isDark={isDark} />;
          }
          if (section.type === "faq") {
            return <FaqRenderer key={idx} section={section} primary={primary} isDark={isDark} />;
          }
          if (section.type === "custom_html") {
            return <CustomHtmlRenderer key={idx} section={section} />;
          }
          if (section.type === "course_includes") {
            return <CourseIncludesRenderer key={idx} section={section} courseStats={stats} primary={primary} primaryLight={primaryLight} isDark={isDark} />;
          }
          if (section.type === "content_block") {
            const cb = section as ContentBlockSection;
            const block: Block = { id: `checkout-cb-${idx}`, type: cb.blockType as any, data: cb.blockData };
            return (
              <div key={idx} className="rounded-xl overflow-hidden">
                <BlockPreview block={block} />
              </div>
            );
          }
          return null;
        })}
    </div>
  );
}

export default function Checkout() {
  const { slug } = useParams<{ slug: string }>();
  const [location] = useLocation();

  // Parse query params once (stable reference)
  const searchParams = useMemo(() => {
    const url = new URL(window.location.href);
    return {
      pricingOptionId: url.searchParams.get("option") ? Number(url.searchParams.get("option")) : undefined,
      teamTierId: url.searchParams.get("tier") ? Number(url.searchParams.get("tier")) : undefined,
      entityType: (url.searchParams.get("type") ?? "course") as "course" | "download" | "physical" | "webinar" | "membership",
    };
  }, [location]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [subscriptionAcknowledged, setSubscriptionAcknowledged] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [seatCount, setSeatCount] = useState<number>(searchParams.teamTierId ? 3 : 1);
  const [sessionMeta, setSessionMeta] = useState<{
    courseTitle: string;
    courseSubtitle: string | null;
    courseDescription: string | null;
    courseThumbnail: string | null;
    primaryColor: string;
    accentColor: string;
    gradientFrom: string;
    gradientTo: string;
    gradientDirection: string;
    playerTheme: string;
    termsUrl: string;
    privacyUrl: string;
    productName: string;
    displayPrice: number;
    pricingType: string;
    isSubscription: boolean;
    billingLabel: string | null;
    currency: string;
    minSeats: number | null;
    discountPercent: number | null;
  } | null>(null);

  const entityType = searchParams.entityType;

  const onSessionSuccess = (data: any) => {
    const { clientSecret: cs, ...meta } = data;
    setClientSecret(cs);
    setSessionMeta(meta);
    // Sync seatCount to the tier's minimum on first load
    if (meta.minSeats && seatCount < meta.minSeats) {
      setSeatCount(meta.minSeats);
    }
  };

  const createCourseSession = trpc.lmsLearner.createEmbeddedCheckoutSession.useMutation({ onSuccess: onSessionSuccess });
  const createDownloadSession = trpc.downloadsLearner.createEmbeddedCheckoutSession.useMutation({ onSuccess: onSessionSuccess });
  const createPhysicalSession = trpc.productsLearner.createEmbeddedCheckoutSession.useMutation({ onSuccess: onSessionSuccess });
  const createWebinarSession = trpc.webinarAdmin.createEmbeddedCheckoutSession.useMutation({ onSuccess: onSessionSuccess });
  const createMembershipSession = trpc.membership.createEmbeddedCheckoutSession.useMutation({ onSuccess: onSessionSuccess });

  const createSession = {
    isPending: createCourseSession.isPending || createDownloadSession.isPending || createPhysicalSession.isPending || createWebinarSession.isPending || createMembershipSession.isPending,
    isError: createCourseSession.isError || createDownloadSession.isError || createPhysicalSession.isError || createWebinarSession.isError || createMembershipSession.isError,
    error: createCourseSession.error ?? createDownloadSession.error ?? createPhysicalSession.error ?? createWebinarSession.error ?? createMembershipSession.error,
  };

  // Trigger session creation once on mount
  const [sessionRequested, setSessionRequested] = useState(false);
  if (!sessionRequested && slug) {
    setSessionRequested(true);
    if (entityType === "download") {
      createDownloadSession.mutate({ productSlug: slug, origin: window.location.origin });
    } else if (entityType === "physical") {
      createPhysicalSession.mutate({ productSlug: slug, origin: window.location.origin });
    } else if (entityType === "webinar") {
      createWebinarSession.mutate({ webinarSlug: slug, origin: window.location.origin });
    } else if (entityType === "membership") {
      createMembershipSession.mutate({ planSlug: slug, origin: window.location.origin });
    } else {
      createCourseSession.mutate({
        courseSlug: slug,
        pricingOptionId: searchParams.pricingOptionId,
        teamTierId: searchParams.teamTierId,
        seatCount: searchParams.teamTierId ? seatCount : undefined,
        origin: window.location.origin,
      });
    }
  }

  // ── Derived theme values ──────────────────────────────────────────────────
  const primary = sessionMeta?.primaryColor ?? "#179ca3";
  const accent = sessionMeta?.accentColor ?? "#0d9488";
  const gradFrom = sessionMeta?.gradientFrom ?? primary;
  const gradTo = sessionMeta?.gradientTo ?? accent;
  const gradDir = sessionMeta?.gradientDirection ?? "135deg";
  const primaryText = contrastText(primary);
  const primaryLight = lighten(primary, 0.88);
  const isDark = sessionMeta?.playerTheme === "dark";

  const isSubscription = sessionMeta?.isSubscription ?? false;
  const requiresSubscriptionAck = isSubscription;
  const canProceed = termsAccepted && (!requiresSubscriptionAck || subscriptionAcknowledged);

  // Stripe EmbeddedCheckout options — stable reference
  const stripeOptions = useMemo(
    () => (clientSecret ? { clientSecret } : undefined),
    [clientSecret]
  );

  // ── Themed style helpers ──────────────────────────────────────────────────
  const btnStyle: CSSProperties = {
    backgroundColor: primary,
    color: primaryText,
    border: "none",
  };
  const checkboxStyle: CSSProperties = {
    accentColor: primary,
  };
  const linkStyle: CSSProperties = {
    color: primary,
  };
  const badgeStyle: CSSProperties = {
    backgroundColor: primaryLight,
    color: primary,
    border: `1px solid ${primary}33`,
  };
  const headerGradient: CSSProperties = {
    background: `linear-gradient(${gradDir}, ${gradFrom}, ${gradTo})`,
  };

  // ── Error state ───────────────────────────────────────────────────────────
  if (createSession.isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Checkout Unavailable</h2>
          <p className="text-gray-500 text-sm mb-6">
            {(createSession.error as any)?.message ?? "This course is not available for purchase right now."}
          </p>
          <Link href={`/courses/${slug}`} className="inline-flex items-center gap-2 font-medium text-sm" style={linkStyle}>
            <ArrowLeft className="h-4 w-4" /> Back to course
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-gray-950" : "bg-gray-50"}`}>
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-10 border-b ${isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/courses/${slug}`}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-800"}`}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to course
          </Link>
          <div className={`flex items-center gap-2 text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            <Lock className="h-3.5 w-3.5" />
            Secure checkout
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8 items-start">

        {/* ── Left column: Course info ────────────────────────────── */}
        <div className="space-y-5">

          {/* Course card */}
          <div className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? "bg-gray-900 border border-gray-800" : "bg-white border border-gray-100"}`}>

            {/* Cover image with gradient overlay */}
            {sessionMeta?.courseThumbnail ? (
              <div className="relative">
                <img
                  src={sessionMeta.courseThumbnail}
                  alt={sessionMeta.courseTitle}
                  className="w-full h-48 object-cover"
                />
                <div
                  className="absolute inset-0 opacity-40"
                  style={headerGradient}
                />
              </div>
            ) : (
              /* Gradient banner when no thumbnail */
              <div className="h-24 w-full" style={headerGradient} />
            )}

            <div className="p-5">
              {createSession.isPending && !sessionMeta ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-5 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-16 bg-gray-100 rounded w-full mt-3" />
                  <div className="h-8 bg-gray-100 rounded w-1/3 mt-4" />
                </div>
              ) : sessionMeta ? (
                <>
                  {/* Brand label */}
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: primary }}>
                    All About Ultrasound™
                  </p>

                  {/* Title */}
                  <h1 className={`text-xl font-bold leading-snug mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
                    {sessionMeta.courseTitle}
                  </h1>

                  {/* Subtitle */}
                  {sessionMeta.courseSubtitle && (
                    <p className={`text-sm mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {sessionMeta.courseSubtitle}
                    </p>
                  )}

                  {/* Description */}
                  {sessionMeta.courseDescription && (
                    <>
                      <Separator className={`my-3 ${isDark ? "bg-gray-800" : ""}`} />
                      <div
                        className={`text-sm leading-relaxed line-clamp-6 ${isDark ? "text-gray-300" : "text-gray-600"}`}
                        dangerouslySetInnerHTML={{ __html: sessionMeta.courseDescription }}
                      />
                    </>
                  )}

                  <Separator className={`my-4 ${isDark ? "bg-gray-800" : ""}`} />

                  {/* Pricing summary */}
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <span className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                        {formatPrice(sessionMeta.displayPrice, sessionMeta.currency)}
                      </span>
                      {searchParams.teamTierId && sessionMeta.minSeats ? (
                        <span className="ml-2 text-base font-semibold" style={{ color: primary }}>
                          per seat{sessionMeta.pricingType === "subscription" && sessionMeta.billingLabel
                            ? ` / ${sessionMeta.billingLabel.split("/")[1]?.split("—")[0]?.trim() ?? "month"}`
                            : ""}
                        </span>
                      ) : sessionMeta.pricingType === "subscription" && sessionMeta.billingLabel ? (
                        <span className="ml-2 text-base font-semibold" style={{ color: primary }}>
                          / {sessionMeta.billingLabel.split("/")[1]?.split("—")[0]?.trim() ?? "month"}
                        </span>
                      ) : null}
                    </div>
                    {sessionMeta.pricingType === "subscription" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={badgeStyle}>
                        <RefreshCw className="h-3 w-3" />
                        Recurring
                      </span>
                    )}
                    {sessionMeta.pricingType === "payment_plan" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={badgeStyle}>
                        Payment plan
                      </span>
                    )}
                  </div>

                  {/* Team tier seat stepper */}
                  {sessionMeta.minSeats && searchParams.teamTierId && (
                    <div className={`mt-3 p-3 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                      <p className={`text-xs font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                        Number of seats
                        {sessionMeta.discountPercent ? (
                          <span className="ml-2 font-normal" style={{ color: primary }}>{sessionMeta.discountPercent}% team discount applied</span>
                        ) : null}
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const next = Math.max(sessionMeta.minSeats!, seatCount - 1);
                            if (next === seatCount) return;
                            setSeatCount(next);
                            setClientSecret(null);
                            setSessionMeta(null);
                            setSessionRequested(false);
                          }}
                          className="w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold transition-colors hover:bg-gray-200 disabled:opacity-40"
                          style={{ borderColor: primary, color: primary }}
                          disabled={seatCount <= sessionMeta.minSeats}
                        >
                          −
                        </button>
                        <span className={`text-xl font-bold w-8 text-center ${isDark ? "text-white" : "text-gray-900"}`}>{seatCount}</span>
                        <button
                          onClick={() => {
                            const next = seatCount + 1;
                            setSeatCount(next);
                            setClientSecret(null);
                            setSessionMeta(null);
                            setSessionRequested(false);
                          }}
                          className="w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold transition-colors hover:bg-gray-200"
                          style={{ borderColor: primary, color: primary }}
                        >
                          +
                        </button>
                        <span className={`text-xs ml-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                          × {formatPrice(sessionMeta.displayPrice, sessionMeta.currency)}/seat
                          {sessionMeta.pricingType === "subscription" && sessionMeta.billingLabel
                            ? `/${sessionMeta.billingLabel.split("/")[1]?.split("—")[0]?.trim() ?? "month"}`
                            : ""}
                          {sessionMeta.minSeats > 1 ? ` (min ${sessionMeta.minSeats})` : ""}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {/* Subscription billing disclosure */}
          {isSubscription && sessionMeta?.billingLabel && (
            <div
              className="rounded-xl p-4 flex gap-3"
              style={{ backgroundColor: lighten(primary, 0.92), border: `1px solid ${primary}44` }}
            >
              <RefreshCw className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: primary }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: primary }}>Recurring Subscription</p>
                <p className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {sessionMeta.billingLabel}. Your payment method will be charged automatically each billing period
                  until you cancel. You can cancel anytime from your account settings.
                </p>
              </div>
            </div>
          )}

          {/* ── Configurable checkout page sections ──────────────────────── */}
          {slug && <CheckoutSections entitySlug={slug} entityType={entityType} primary={primary} primaryLight={primaryLight} isDark={isDark} courseStats={null} />}
        </div>

        {/* ── Right column: Terms agreement + Embedded Stripe Checkout ──────────────────────── */}
        <div className="space-y-4">

          {/* Terms agreement card — above Stripe embed */}
          {sessionMeta && (
            <div className={`rounded-2xl shadow-sm border p-5 space-y-4 ${isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
              <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? "text-white" : "text-gray-800"}`}>
                <ShieldCheck className="h-4 w-4" style={{ color: primary }} />
                Before you proceed
              </h3>

              {/* Subscription acknowledgment */}
              {requiresSubscriptionAck && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="subscription-ack"
                    checked={subscriptionAcknowledged}
                    onCheckedChange={(v) => setSubscriptionAcknowledged(!!v)}
                    className="mt-0.5"
                    style={subscriptionAcknowledged ? { backgroundColor: primary, borderColor: primary } : {}}
                  />
                  <Label
                    htmlFor="subscription-ack"
                    className={`text-sm leading-relaxed cursor-pointer ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    I understand this is a <strong>recurring subscription</strong>.{" "}
                    {sessionMeta.billingLabel && (
                      <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                        {sessionMeta.billingLabel.replace(/,?\s*cancel anytime/i, "").trim()}.{" "}
                      </span>
                    )}
                    I can cancel anytime from my account.
                  </Label>
                </div>
              )}

              {/* Terms + Privacy Policy */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(v) => setTermsAccepted(!!v)}
                  className="mt-0.5"
                  style={termsAccepted ? { backgroundColor: primary, borderColor: primary } : {}}
                />
                <Label
                  htmlFor="terms"
                  className={`text-sm leading-relaxed cursor-pointer ${isDark ? "text-gray-300" : "text-gray-700"}`}
                >
                  I have reviewed and agree to the{" "}
                  <a
                    href={sessionMeta.termsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                    style={linkStyle}
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href={sessionMeta.privacyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                    style={linkStyle}
                  >
                    Privacy Policy
                  </a>
                  .
                </Label>
              </div>

              {!canProceed && (
                <p className={`text-xs pt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                  {requiresSubscriptionAck && !subscriptionAcknowledged
                    ? "Please acknowledge the recurring billing terms above to continue."
                    : "Please agree to the Terms of Service and Privacy Policy to continue."}
                </p>
              )}
            </div>
          )}

          <div className={`rounded-2xl shadow-sm border overflow-hidden min-h-[400px] ${isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
          {!sessionMeta || createSession.isPending ? (
            /* Loading skeleton */
            <div className="p-8 space-y-4 animate-pulse">
              <div className="h-6 bg-gray-100 rounded w-1/2" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-12 bg-gray-100 rounded w-full mt-6" />
              <div className="h-12 bg-gray-100 rounded w-full" />
            </div>
          ) : !canProceed ? (
            /* Waiting for terms acceptance */
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center mb-5"
                style={{ backgroundColor: primaryLight }}
              >
                <ShieldCheck className="h-8 w-8" style={{ color: primary }} />
              </div>
              <h3 className={`text-base font-semibold mb-2 ${isDark ? "text-white" : "text-gray-700"}`}>
                Almost there
              </h3>
              <p className={`text-sm max-w-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                {requiresSubscriptionAck && !subscriptionAcknowledged
                  ? "Please acknowledge the recurring billing terms above to unlock payment."
                  : "Please agree to the Terms of Service and Privacy Policy above to unlock payment."}
              </p>
              {/* Visual CTA hint */}
              <div
                className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold opacity-40 cursor-not-allowed"
                style={btnStyle}
              >
                <BookOpen className="inline h-4 w-4 mr-2" />
                Complete Agreement to Continue
              </div>
            </div>
          ) : stripeOptions ? (
            /* Embedded Stripe Checkout */
            <div className="p-4">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={stripeOptions}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div
                className="animate-spin h-8 w-8 border-4 border-t-transparent rounded-full"
                style={{ borderColor: `${primary}44`, borderTopColor: "transparent" }}
              />
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
