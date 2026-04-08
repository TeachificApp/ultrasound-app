/**
 * PremiumPearlGate — unified teaser-lock component for All About Ultrasound™.
 *
 * Free users see a partial content preview that fades into a blur, with a
 * floating upgrade card anchored below the visible teaser. Premium users see
 * the full content with no overlay at all.
 *
 * Replaces: BlurredOverlay (premium), PremiumGate, PremiumLockOverlay, PremiumOverlay
 *
 * Usage:
 *   // Wraps a full page or section — shows teaser + upgrade card for free users
 *   <PremiumPearlGate featureName="Venous Navigator">
 *     <YourContent />
 *   </PremiumPearlGate>
 *
 *   // Login gate (unauthenticated users)
 *   <PremiumPearlGate type="login" featureName="Echo Case Library">
 *     <YourContent />
 *   </PremiumPearlGate>
 *
 *   // DIY gate
 *   <PremiumPearlGate type="diy" featureName="Lab Admin">
 *     <YourContent />
 *   </PremiumPearlGate>
 *
 *   // Compact inline badge (no preview, just a lock chip)
 *   <PremiumPearlGate compact featureName="Tips">
 *     <TipsSection />
 *   </PremiumPearlGate>
 *
 *   // Pass-through (already confirmed premium — skip all checks)
 *   <PremiumPearlGate bypass>
 *     <YourContent />
 *   </PremiumPearlGate>
 */

import { Link } from "wouter";
import {
  Crown, Lock, Sparkles, ArrowRight, Loader2, LogIn, Layers,
  Check, Zap, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";

// ─── Types ────────────────────────────────────────────────────────────────────

type GateType = "premium" | "login" | "diy";

interface PremiumPearlGateProps {
  children: React.ReactNode;
  /** Feature name shown in the upgrade card */
  featureName?: string;
  /** Gate type — controls CTA copy and destination. Defaults to "premium". */
  type?: GateType;
  /** When true, render children directly without any gate (pass-through mode) */
  bypass?: boolean;
  /** Compact inline badge mode — no preview, just a lock chip */
  compact?: boolean;
  /**
   * How many pixels of content to show as the teaser before the fade.
   * Defaults to 340px. Set to 0 to show no teaser (full blur).
   */
  teaserHeight?: number;
  /** Optional custom checkout URL (premium gate only) */
  checkoutUrl?: string;
}

// ─── Premium feature bullets ─────────────────────────────────────────────────

const PREMIUM_BULLETS = [
  "All Navigator protocols — vascular, OB, POCUS, MSK & more",
  "ScanCoach™ for every specialty with step-by-step scanning guides",
  "500+ Echo Case Library cases with teaching points",
  "Ultrasound-Assist™ calculator engines with guideline references",
  "Unlimited daily flashcards & advanced challenge modes",
];

const DIY_BULLETS = [
  "Lab Admin portal — seat management & member onboarding",
  "Accreditation Navigator — ICAEL/IAC protocol workflows",
  "Quality review tools & peer review tracking",
  "Accreditation document library & compliance checklists",
];

// ─── Main component ───────────────────────────────────────────────────────────

export function PremiumPearlGate({
  children,
  featureName,
  type = "premium",
  bypass = false,
  compact = false,
  teaserHeight = 340,
  checkoutUrl,
}: PremiumPearlGateProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: status, isLoading: statusLoading } = trpc.premium.getStatus.useQuery(undefined, {
    enabled: !!user && type === "premium",
  });

  // ── Bypass / pass-through ──────────────────────────────────────────────────
  if (bypass) return <>{children}</>;

  // ── Auth loading state ─────────────────────────────────────────────────────
  const isLoading = authLoading || (!!user && type === "premium" && statusLoading);

  // ── Access check ───────────────────────────────────────────────────────────
  const isLoggedIn = !authLoading && !!user;
  const isConfirmedPremium =
    !authLoading && !statusLoading && !!user && !!status?.isPremium;

  // Reveal content once access is confirmed
  if (type === "login" && isLoggedIn) return <>{children}</>;
  if (type === "premium" && isConfirmedPremium) return <>{children}</>;
  // DIY gate: always show gate (parent controls bypass via `bypass` prop)

  // ── Compact inline badge ───────────────────────────────────────────────────
  if (compact) {
    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
          <Lock className="w-3 h-3 animate-pulse" />
          <span>Checking access…</span>
        </span>
      );
    }
    if (!isLoggedIn) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Lock className="w-3 h-3" />
          <span>Sign in to access {featureName ?? "this feature"}</span>
          <a href={getLoginUrl()} className="text-[#189aa1] font-medium hover:underline">
            Sign in
          </a>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <Crown className="w-3 h-3" />
        <span>{featureName ?? "Premium"} feature</span>
        <Link href="/premium">
          <span className="text-[#189aa1] font-medium hover:underline cursor-pointer">
            Upgrade →
          </span>
        </Link>
      </span>
    );
  }

  // ── Full teaser gate ───────────────────────────────────────────────────────
  return (
    <div className="relative w-full">
      {/* Teaser — visible portion fades into blur */}
      {teaserHeight > 0 ? (
        <div
          className="pointer-events-none select-none overflow-hidden"
          style={{
            maxHeight: `${teaserHeight}px`,
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 45%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 45%, transparent 100%)",
          }}
          aria-hidden="true"
        >
          <div style={{ filter: "blur(2px)", opacity: 0.5 }}>{children}</div>
        </div>
      ) : (
        /* No teaser — just a short blurred stub so the card has something behind it */
        <div
          className="pointer-events-none select-none overflow-hidden"
          style={{ maxHeight: "120px", filter: "blur(4px)", opacity: 0.3 }}
          aria-hidden="true"
        >
          {children}
        </div>
      )}

      {/* Upgrade card — anchored below the teaser, not floating over it */}
      <div className="relative z-10 flex justify-center px-4 pb-8 -mt-8">
        {isLoading ? (
          <LoadingCard />
        ) : type === "login" ? (
          <LoginCard featureName={featureName} />
        ) : type === "diy" ? (
          <DiyCard featureName={featureName} />
        ) : (
          <UpgradeCard
            featureName={featureName}
            isLoggedIn={isLoggedIn}
            checkoutUrl={checkoutUrl ?? status?.checkoutUrl}
          />
        )}
      </div>
    </div>
  );
}

// ─── Card sub-components ──────────────────────────────────────────────────────

function LoadingCard() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl p-8 text-center">
      <Loader2 className="w-8 h-8 text-[#189aa1] animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-400">Checking membership…</p>
    </div>
  );
}

function LoginCard({ featureName }: { featureName?: string }) {
  return (
    <div
      className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border"
      style={{ borderColor: "rgba(74,217,224,0.25)" }}
    >
      {/* Header */}
      <div
        className="px-6 pt-6 pb-5 text-center"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
          style={{ background: "rgba(74,217,224,0.15)", border: "1px solid rgba(74,217,224,0.3)" }}
        >
          <LogIn className="w-6 h-6 text-[#4ad9e0]" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-semibold"
          style={{ background: "rgba(74,217,224,0.15)", color: "#4ad9e0", border: "1px solid rgba(74,217,224,0.2)" }}>
          Sign In Required
        </div>
        <h2 className="font-bold text-white text-lg leading-snug" style={{ fontFamily: "Merriweather, serif" }}>
          {featureName ? `Sign In to Access ${featureName}` : "Sign In to Continue"}
        </h2>
        <p className="text-white/60 text-xs mt-2 leading-relaxed">
          Create a free account to access this feature. Free members get core tools, daily challenges, and the Echo Case Library.
        </p>
      </div>
      {/* Body */}
      <div className="bg-white px-6 py-5">
        <a href={getLoginUrl()} className="block">
          <Button
            className="w-full font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
          >
            <LogIn className="w-4 h-4 mr-1.5" />
            Sign In or Create Free Account
          </Button>
        </a>
      </div>
    </div>
  );
}

function DiyCard({ featureName }: { featureName?: string }) {
  return (
    <div
      className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border"
      style={{ borderColor: "rgba(74,217,224,0.25)" }}
    >
      {/* Header */}
      <div
        className="px-6 pt-6 pb-5"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
          >
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#4ad9e0] uppercase tracking-widest mb-0.5">
              DIY Accreditation
            </div>
            <h2 className="text-base font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
              {featureName ?? "DIY Membership Required"}
            </h2>
          </div>
        </div>
        <p className="text-white/60 text-xs leading-relaxed">
          This tool is available to DIY Accreditation members. Join to access the full lab management suite.
        </p>
      </div>
      {/* Body */}
      <div className="bg-white px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-[#189aa1]" />
          <span className="text-sm font-bold text-gray-800">What's included</span>
        </div>
        <ul className="space-y-1.5 mb-5">
          {DIY_BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0 mt-0.5" />
              <span className="text-xs text-gray-600">{b}</span>
            </li>
          ))}
        </ul>
        <Link href="/diy-accreditation-plans">
          <Button
            className="w-full font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
          >
            <Layers className="w-4 h-4 mr-1.5" />
            View DIY Plans
          </Button>
        </Link>
        <Link href="/">
          <Button variant="outline" className="w-full mt-2 text-sm">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

function UpgradeCard({
  featureName,
  isLoggedIn,
  checkoutUrl,
}: {
  featureName?: string;
  isLoggedIn: boolean;
  checkoutUrl?: string;
}) {
  const returnUrl =
    typeof window !== "undefined" ? `${window.location.origin}/enrolled` : "";
  const upgradeUrl =
    checkoutUrl ??
    `https://member.allaboutultrasound.com/enroll/3714929?price_id=4664974${
      returnUrl ? `&redirect_url=${encodeURIComponent(returnUrl)}` : ""
    }`;

  return (
    <div
      className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border"
      style={{ borderColor: "rgba(245,158,11,0.3)" }}
    >
      {/* Header */}
      <div
        className="px-6 pt-6 pb-5"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
          >
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-amber-300 uppercase tracking-widest mb-0.5">
              Premium Feature
            </div>
            <h2
              className="text-base font-black text-white leading-tight"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              {featureName ? `Unlock ${featureName}` : "Premium Access Required"}
            </h2>
          </div>
        </div>
        <p className="text-white/60 text-xs leading-relaxed">
          Upgrade to All About Ultrasound™ Premium for{" "}
          <strong className="text-white/90">$9.97/month</strong> — every Navigator protocol,
          ScanCoach guide, calculator engine, and 500+ echo cases.
        </p>
      </div>

      {/* Body */}
      <div className="bg-white px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-gray-800">What's included in Premium</span>
        </div>
        <ul className="space-y-1.5 mb-5">
          {PREMIUM_BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0 mt-0.5" />
              <span className="text-xs text-gray-600">{b}</span>
            </li>
          ))}
        </ul>

        {/* CTAs */}
        <div className="flex flex-col gap-2">
          <a href={upgradeUrl} target="_blank" rel="noopener noreferrer">
            <Button
              className="w-full font-bold text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Zap className="w-4 h-4 mr-1.5" />
              Upgrade — $9.97/month
            </Button>
          </a>
          {!isLoggedIn && (
            <a href={getLoginUrl()}>
              <Button
                className="w-full font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                Sign In (Already a Member?)
              </Button>
            </a>
          )}
          <Link href="/premium">
            <Button variant="outline" className="w-full text-sm">
              Learn More <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
