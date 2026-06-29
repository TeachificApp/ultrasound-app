/*
  PremiumOverlay.tsx — All About Ultrasound™
  Timed premium gate: shows content fully interactive for 60 seconds,
  then a full-screen upgrade modal appears.

  Security model:
  - Uses the cached auth.me user object (appRoles + isPremium flag) as the
    PRIMARY check — no extra network round-trip, no flash for premium users.
  - Timer is tracked in sessionStorage per feature key.
  - Content is only revealed once we have CONFIRMED the user is premium.

  Usage:
    <PremiumOverlay featureName="LAP Estimation">
      <YourPremiumContent />
    </PremiumOverlay>
*/
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Crown, Lock, Sparkles, ArrowRight, Loader2, Zap, Star, Check, LogIn, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePremium } from "@/hooks/usePremium";
import { getLoginUrl } from "@/const";

// ── Timer helpers ─────────────────────────────────────────────────────────────
const PREVIEW_SECONDS = 60;
function getSessionKey(k: string | undefined) {
  return `ppg_start_${(k ?? "feature").replace(/\s+/g, "_").toLowerCase()}`;
}
function getElapsedSeconds(k: string | undefined): number {
  try {
    const stored = sessionStorage.getItem(getSessionKey(k));
    if (!stored) return 0;
    const ms = parseInt(stored, 10);
    return isNaN(ms) ? 0 : Math.floor((Date.now() - ms) / 1000);
  } catch { return 0; }
}
function startSessionTimer(k: string | undefined) {
  try {
    const key = getSessionKey(k);
    if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, String(Date.now()));
  } catch {}
}

const PREMIUM_BULLETS = [
  "All Navigator protocols — vascular, OB, POCUS, MSK & more",
  "ScanCoach™ for every specialty with step-by-step scanning guides",
  "500+ Echo Case Library cases with teaching points",
  "Ultrasound-Assist™ calculator engines with guideline references",
  "Unlimited daily flashcards & advanced challenge modes",
];

interface PremiumOverlayProps {
  children: React.ReactNode;
  /** Feature name shown in the overlay prompt */
  featureName?: string;
  /** Optional: custom checkout URL override */
  checkoutUrl?: string;
}

export function PremiumOverlay({ children, featureName, checkoutUrl }: PremiumOverlayProps) {
  const { isPremium, loading, isAuthenticated } = usePremium();

  // Pass-through for confirmed premium users
  if (!loading && isPremium) return <>{children}</>;

  // Still loading — show blurred stub
  if (loading) {
    return (
      <div className="relative rounded-xl overflow-hidden">
        <div className="pointer-events-none select-none" style={{ filter: "blur(3px)", opacity: 0.45 }} aria-hidden="true">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="mx-4 rounded-2xl border shadow-xl px-6 py-6 text-center max-w-sm w-full"
            style={{ background: "rgba(14,30,46,0.92)", borderColor: "rgba(74,217,224,0.3)", backdropFilter: "blur(8px)" }}>
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 text-[#4ad9e0] animate-spin" />
              <p className="text-white/60 text-xs">Checking membership…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Timed preview gate
  return (
    <TimedPreviewOverlay featureName={featureName} isLoggedIn={isAuthenticated} checkoutUrl={checkoutUrl}>
      {children}
    </TimedPreviewOverlay>
  );
}

// ── Timed Preview Overlay ─────────────────────────────────────────────────────

function TimedPreviewOverlay({
  children, featureName, isLoggedIn, checkoutUrl,
}: { children: React.ReactNode; featureName?: string; isLoggedIn: boolean; checkoutUrl?: string; }) {
  const elapsed = getElapsedSeconds(featureName);
  const remaining = Math.max(0, PREVIEW_SECONDS - elapsed);
  const [secondsLeft, setSecondsLeft] = useState(remaining);
  const [gateVisible, setGateVisible] = useState(remaining === 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { startSessionTimer(featureName); }, [featureName]);
  useEffect(() => {
    if (gateVisible) return;
    intervalRef.current = setInterval(() => {
      const newR = Math.max(0, PREVIEW_SECONDS - getElapsedSeconds(featureName));
      setSecondsLeft(newR);
      if (newR === 0) { setGateVisible(true); if (intervalRef.current) clearInterval(intervalRef.current); }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [featureName, gateVisible]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pct = (secondsLeft / PREVIEW_SECONDS) * 100;
  const upgradeUrl = checkoutUrl ?? "/premium";

  return (
    <div className="relative w-full">
      <div className={gateVisible ? "pointer-events-none select-none" : ""}>{children}</div>

      {/* Countdown pill */}
      {!gateVisible && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full px-4 py-2.5 shadow-xl border"
          style={{ background: "rgba(14,30,46,0.92)", borderColor: "rgba(74,217,224,0.35)", backdropFilter: "blur(10px)" }}>
          <div className="relative w-8 h-8 flex-shrink-0">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(74,217,224,0.15)" strokeWidth="3" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="#4ad9e0" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 13}`}
                strokeDashoffset={`${2 * Math.PI * 13 * (1 - pct / 100)}`}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <Clock className="w-3.5 h-3.5 text-[#4ad9e0] absolute inset-0 m-auto" />
          </div>
          <div>
            <div className="text-[10px] text-white/50 leading-none mb-0.5">Free preview</div>
            <div className="text-sm font-bold text-white font-mono leading-none">{mins}:{String(secs).padStart(2, "0")}</div>
          </div>
        </div>
      )}

      {/* Upgrade modal */}
      {gateVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(14,30,46,0.88)", backdropFilter: "blur(12px)" }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border animate-in fade-in slide-in-from-bottom-4 duration-300"
            style={{ borderColor: "rgba(245,158,11,0.35)" }}>
            <div className="px-6 pt-6 pb-5" style={{ background: "linear-gradient(135deg,#0e1e2e 0%,#0e4a50 60%,#189aa1 100%)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-amber-300 uppercase tracking-widest mb-0.5">Preview Ended</div>
                  <h2 className="text-base font-black text-white leading-tight" style={{ fontFamily: "Merriweather,serif" }}>
                    {featureName ? `Unlock ${featureName}` : "Upgrade to Continue"}
                  </h2>
                </div>
              </div>
              <p className="text-white/60 text-xs leading-relaxed">
                Your 60-second free preview has ended. Upgrade to{" "}
                <strong className="text-white/90">All About Ultrasound™ Premium</strong> for{" "}
                <strong className="text-white/90">$9.97/month</strong>.
              </p>
            </div>
            <div className="bg-white px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-gray-800">What's included in Premium</span>
              </div>
              <ul className="space-y-1.5 mb-5">
                {PREMIUM_BULLETS.map(b => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-600">{b}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <a href={upgradeUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full font-bold text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                    <Zap className="w-4 h-4 mr-1.5" />Upgrade — $9.97/month
                  </Button>
                </a>
                {!isLoggedIn && (
                  <a href={getLoginUrl()}>
                    <Button className="w-full font-semibold text-white" style={{ background: "linear-gradient(135deg,#189aa1,#0e7490)" }}>
                      <LogIn className="w-4 h-4 mr-1.5" />Sign In (Already a Member?)
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
