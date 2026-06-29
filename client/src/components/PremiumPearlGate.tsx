/**
 * PremiumPearlGate — unified teaser-lock component for All About Ultrasound™.
 *
 * Free users see a 60-second live preview of the content. After the timer
 * expires, a full-screen upgrade modal slides in blocking further access.
 * Premium users see the full content with no overlay at all.
 *
 * Timer state is stored in sessionStorage keyed by featureName so it persists
 * across tab switches within the same session but resets on a new session.
 *
 * Usage:
 *   // Wraps a full page or section — 60s preview then upgrade modal for free users
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

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Crown, Lock, ArrowRight, Loader2, LogIn, Layers,
  Check, Zap, Star, Clock, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Seconds of free preview before the upgrade gate appears */
const PREVIEW_SECONDS = 35;
/** Seconds remaining at which to show the "X seconds left" toast */
const TOAST_TRIGGER_AT = 15;

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
   * Only used after the timer expires (legacy fallback gate).
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
  "Accreditation Navigator — IAC protocol workflows",
  "Quality review tools & peer review tracking",
  "Accreditation document library & compliance checklists",
];

// ─── Session-storage timer helpers ───────────────────────────────────────────

function getSessionKey(featureName: string | undefined) {
  return `ppg_start_${(featureName ?? "feature").replace(/\s+/g, "_").toLowerCase()}`;
}

function getElapsedSeconds(featureName: string | undefined): number {
  try {
    const key = getSessionKey(featureName);
    const stored = sessionStorage.getItem(key);
    if (!stored) return 0;
    const startMs = parseInt(stored, 10);
    if (isNaN(startMs)) return 0;
    return Math.floor((Date.now() - startMs) / 1000);
  } catch {
    return 0;
  }
}

function startSessionTimer(featureName: string | undefined) {
  try {
    const key = getSessionKey(featureName);
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, String(Date.now()));
    }
  } catch {
    // sessionStorage unavailable — degrade gracefully
  }
}

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

  // ── Timed preview gate (premium type only) ─────────────────────────────────
  // For login/diy gates, skip the timer and show the gate immediately
  if (type === "premium" && !isLoading) {
    return (
      <TimedPreviewGate
        featureName={featureName}
        isLoggedIn={isLoggedIn}
        checkoutUrl={checkoutUrl ?? status?.checkoutUrl}
        teaserHeight={teaserHeight}
      >
        {children}
      </TimedPreviewGate>
    );
  }

  // ── Non-premium gates (login / diy) or loading state ──────────────────────
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
        <div
          className="pointer-events-none select-none overflow-hidden"
          style={{ maxHeight: "120px", filter: "blur(4px)", opacity: 0.3 }}
          aria-hidden="true"
        >
          {children}
        </div>
      )}

      {/* Upgrade card — anchored below the teaser */}
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

// ─── Timed Preview Gate ───────────────────────────────────────────────────────

function TimedPreviewGate({
  children,
  featureName,
  isLoggedIn,
  checkoutUrl,
  teaserHeight,
}: {
  children: React.ReactNode;
  featureName?: string;
  isLoggedIn: boolean;
  checkoutUrl?: string;
  teaserHeight: number;
}) {
  const elapsed = getElapsedSeconds(featureName);
  const remaining = Math.max(0, PREVIEW_SECONDS - elapsed);
  const [secondsLeft, setSecondsLeft] = useState(remaining);
  const [gateVisible, setGateVisible] = useState(remaining === 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start the session timer on first mount (no-op if already started)
  useEffect(() => {
    startSessionTimer(featureName);
  }, [featureName]);

  // Countdown tick
  useEffect(() => {
    if (gateVisible) return;
    intervalRef.current = setInterval(() => {
      const newElapsed = getElapsedSeconds(featureName);
      const newRemaining = Math.max(0, PREVIEW_SECONDS - newElapsed);
      setSecondsLeft(newRemaining);
      if (newRemaining === 0) {
        setGateVisible(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [featureName, gateVisible]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, "0")}`;
  const pct = (secondsLeft / PREVIEW_SECONDS) * 100;

  // Toast state — fires once when secondsLeft crosses TOAST_TRIGGER_AT
  const [toastVisible, setToastVisible] = useState(false);
  const toastFiredRef = useRef(false);
  useEffect(() => {
    if (!toastFiredRef.current && secondsLeft <= TOAST_TRIGGER_AT && secondsLeft > 0 && !gateVisible) {
      toastFiredRef.current = true;
      setToastVisible(true);
      const t = setTimeout(() => setToastVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [secondsLeft, gateVisible]);

  return (
    <div className="relative w-full">
      {/* Premium Access Preview banner — shown at top of content while timer runs */}
      {!gateVisible && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 mb-3 rounded-xl border"
          style={{
            background: "linear-gradient(135deg, rgba(14,30,46,0.96) 0%, rgba(14,74,80,0.96) 100%)",
            borderColor: "rgba(74,217,224,0.3)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Crown className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest block leading-none mb-0.5">
                Premium Access Preview
              </span>
              <span className="text-xs text-white/70 leading-none">
                {featureName ? `You're previewing ${featureName}` : "You're previewing a premium feature"}
                {" — "}
                <a
                  href="/premium"
                  className="text-[#4ad9e0] font-semibold hover:underline"
                >
                  Upgrade for full access →
                </a>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Clock className="w-3.5 h-3.5 text-[#4ad9e0]" />
            <span className="text-xs font-bold text-white font-mono">{timeStr}</span>
          </div>
        </div>
      )}

      {/* Live content — fully interactive during preview */}
      <div className={gateVisible ? "pointer-events-none select-none" : ""}>
        {children}
      </div>

      {/* 15-second toast warning */}
      {toastVisible && (
        <div
          className="fixed bottom-24 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl border animate-in slide-in-from-right-4 duration-300"
          style={{
            background: "rgba(14,30,46,0.96)",
            borderColor: "rgba(245,158,11,0.5)",
            backdropFilter: "blur(12px)",
            maxWidth: "280px",
          }}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div>
            <div className="text-[10px] font-bold text-amber-300 uppercase tracking-widest leading-none mb-0.5">
              Preview ending soon
            </div>
            <div className="text-xs text-white/80 leading-snug">
              <span className="font-bold text-white">{secondsLeft} seconds</span> left —{" "}
              <a href="/premium" className="text-[#4ad9e0] font-semibold hover:underline">
                upgrade now
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Countdown pill — shown while timer is running */}
      {!gateVisible && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full px-4 py-2.5 shadow-xl border"
          style={{
            background: "rgba(14, 30, 46, 0.92)",
            borderColor: "rgba(74, 217, 224, 0.35)",
            backdropFilter: "blur(10px)",
          }}
        >
          {/* Circular progress */}
          <div className="relative w-8 h-8 flex-shrink-0">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(74,217,224,0.15)" strokeWidth="3" />
              <circle
                cx="16" cy="16" r="13" fill="none"
                stroke="#4ad9e0" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 13}`}
                strokeDashoffset={`${2 * Math.PI * 13 * (1 - pct / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <Clock className="w-3.5 h-3.5 text-[#4ad9e0] absolute inset-0 m-auto" />
          </div>
          <div>
            <div className="text-[10px] text-white/50 leading-none mb-0.5">Free preview</div>
            <div className="text-sm font-bold text-white font-mono leading-none">{timeStr}</div>
          </div>
        </div>
      )}

      {/* Upgrade modal — slides in after timer expires */}
      {gateVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(14, 30, 46, 0.88)", backdropFilter: "blur(12px)" }}
        >
          {/* Modal card */}
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border animate-in fade-in slide-in-from-bottom-4 duration-300"
            style={{ borderColor: "rgba(245,158,11,0.35)" }}
          >
            {/* Header */}
            <div
              className="px-6 pt-6 pb-5 relative"
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
                    Preview Ended
                  </div>
                  <h2
                    className="text-base font-black text-white leading-tight"
                    style={{ fontFamily: "Merriweather, serif" }}
                  >
                    {featureName ? `Unlock ${featureName}` : "Upgrade to Continue"}
                  </h2>
                </div>
              </div>
              <p className="text-white/60 text-xs leading-relaxed">
                Your 60-second free preview has ended. Upgrade to{" "}
                <strong className="text-white/90">All About Ultrasound™ Premium</strong> for{" "}
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
                <a href={checkoutUrl ?? "/premium"} target="_blank" rel="noopener noreferrer">
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
        </div>
      )}
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
        <Button
          variant="outline"
          className="w-full mt-2 text-sm"
          onClick={() => { window.location.href = "/"; }}
        >
          Back to Dashboard
        </Button>
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
  const upgradeUrl = checkoutUrl ?? "/premium";

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
