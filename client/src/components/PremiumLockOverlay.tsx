/*
  PremiumLockOverlay — iHeartEcho™
  Wraps any page content with a blurred overlay and upgrade CTA.
  Use `isPremium` prop to conditionally show the lock.
  When locked, the children are rendered but blurred behind the overlay.
*/
import { Lock, Zap, Check, ExternalLink, Star } from "lucide-react";

interface PremiumLockOverlayProps {
  /** When false, the overlay is shown and content is blurred */
  isPremium: boolean;
  /** Name of the locked feature shown in the overlay header */
  featureName: string;
  /** Short description of what the feature does */
  featureDescription?: string;
  /** The page content to render (blurred when locked) */
  children: React.ReactNode;
}

const PREMIUM_FEATURES = [
  "TEE Navigator — ME, TG & UE views with full guidance",
  "Stress Echo Navigator — Exercise & DSE protocols",
  "Strain Navigator — LV/RV/LA strain reference values",
  "ICE Navigator — Procedural checklists & measurements",
  "Device Navigator — TAVR, MitraClip, WATCHMAN guidance",
  "EchoAssist™ Valve Engines — AS, MS, AR, MR severity grading",
  "DIY Accreditation Tool™ — Full lab accreditation suite",
  "500+ Echo Case Lab cases with gamified learning",
];

export default function PremiumLockOverlay({
  isPremium,
  featureName,
  featureDescription,
  children,
}: PremiumLockOverlayProps) {
  // If the user has premium access, render children as-is
  if (isPremium) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred content preview — first ~400px visible, rest fades */}
      <div
        className="pointer-events-none select-none overflow-hidden"
        style={{ maxHeight: "420px", WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 100%)" }}
        aria-hidden="true"
      >
        <div style={{ filter: "blur(3px)", opacity: 0.45 }}>
          {children}
        </div>
      </div>

      {/* Lock overlay card */}
      <div className="relative z-10 -mt-16 flex justify-center px-4 pb-8">
        <div
          className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-amber-200/60"
          style={{ background: "#fff" }}
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
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-amber-300 uppercase tracking-widest mb-0.5">
                  Premium Feature
                </div>
                <h2
                  className="text-lg font-black text-white leading-tight"
                  style={{ fontFamily: "Merriweather, serif" }}
                >
                  {featureName}
                </h2>
              </div>
            </div>
            {featureDescription && (
              <p className="text-white/70 text-xs leading-relaxed">{featureDescription}</p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-gray-800">What's included in Premium</span>
            </div>
            <ul className="space-y-1.5 mb-5">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">{f}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <a
              href="https://www.iheartecho.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Zap className="w-4 h-4" />
              Upgrade to Premium — iheartecho.com
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
