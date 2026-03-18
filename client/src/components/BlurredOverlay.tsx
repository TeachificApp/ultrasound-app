/**
 * BlurredOverlay — wraps page content with a blur + lock overlay.
 *
 * The overlay card is positioned near the TOP of the viewport on mobile
 * (no scrolling required) and centered on desktop.
 *
 * Types:
 *   "login"   — unauthenticated users, CTA: Sign In / Create Free Account
 *   "premium" — authenticated free users, CTA: Upgrade to Premium
 *   "diy"     — users without DIY membership, CTA: Join DIY Accreditation
 */

import { getLoginUrl } from "@/const";
import { Crown, Lock, LogIn, Layers } from "lucide-react";
import { Link } from "wouter";

type OverlayType = "login" | "premium" | "diy";

interface BlurredOverlayProps {
  type: OverlayType;
  featureName?: string;
  children: React.ReactNode;
  /** When true, renders children directly without any overlay (passthrough mode) */
  disabled?: boolean;
}

const CONFIGS: Record<
  OverlayType,
  {
    icon: React.ReactNode;
    badge: string;
    title: string;
    description: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel?: string;
    secondaryHref?: string;
    gradient: string;
    badgeColor: string;
  }
> = {
  login: {
    icon: <LogIn className="w-8 h-8 text-white" />,
    badge: "Sign In Required",
    title: "Sign In to Continue",
    description:
      "Create a free account to access this feature. Free members get access to core tools, daily challenges, and the Echo Case Library.",
    primaryLabel: "Sign In or Create Free Account",
    primaryHref: getLoginUrl(),
    gradient: "linear-gradient(135deg, #0e4a50, #189aa1)",
    badgeColor: "#189aa1",
  },
  premium: {
    icon: <Crown className="w-8 h-8 text-white" />,
    badge: "Premium Feature",
    title: "Upgrade to Premium",
    description:
      "This feature requires a Premium membership. Unlock all EchoNavigator protocols, ScanCoach guides, EchoAssist™ engines, unlimited flashcards, and more.",
    primaryLabel: "Upgrade to Premium",
    primaryHref: "/premium",
    secondaryLabel: "Back to Dashboard",
    secondaryHref: "/",
    gradient: "linear-gradient(135deg, #b45309, #d97706)",
    badgeColor: "#d97706",
  },
  diy: {
    icon: <Layers className="w-8 h-8 text-white" />,
    badge: "DIY Accreditation",
    title: "DIY Membership Required",
    description:
      "This tool is available to DIY Accreditation members. Join to access the Lab Admin portal, accreditation navigator, quality review tools, and seat management.",
    primaryLabel: "View DIY Plans",
    primaryHref: "/diy-accreditation-plans",
    secondaryLabel: "Back to Dashboard",
    secondaryHref: "/",
    gradient: "linear-gradient(135deg, #0e4a50, #189aa1)",
    badgeColor: "#189aa1",
  },
};

export function BlurredOverlay({ type, featureName, children, disabled }: BlurredOverlayProps) {
  if (disabled) return <>{children}</>;
  // Build config lazily so getLoginUrl() is called at render time (not module init),
  // ensuring window.location.origin is available and up-to-date.
  const cfg = type === "login"
    ? { ...CONFIGS.login, primaryHref: getLoginUrl() }
    : CONFIGS[type];

  return (
    <div className="relative">
      {/* Blurred background content */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: "blur(6px)", opacity: 0.35, maxHeight: "60vh", overflow: "hidden" }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay — fixed on mobile (near top), absolute-centered on desktop */}
      <div
        className="
          fixed inset-x-0 top-16 z-50 flex justify-center px-4
          sm:absolute sm:inset-0 sm:top-0 sm:flex sm:items-center sm:justify-center sm:px-6
        "
      >
        <div
          className="w-full max-w-sm rounded-2xl border shadow-2xl px-6 py-7 text-center"
          style={{
            background: "rgba(14, 30, 46, 0.97)",
            borderColor: "#4ad9e040",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: cfg.gradient }}
          >
            {cfg.icon}
          </div>

          {/* Badge */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3 text-xs font-semibold"
            style={{
              background: cfg.badgeColor + "22",
              color: cfg.badgeColor,
              border: `1px solid ${cfg.badgeColor}33`,
            }}
          >
            {cfg.badge}
          </div>

          {/* Title */}
          <h2
            className="font-bold text-white text-lg mb-2"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            {featureName ? `${featureName}: ${cfg.title}` : cfg.title}
          </h2>

          {/* Description */}
          <p className="text-white/60 text-sm mb-5 leading-relaxed">{cfg.description}</p>

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            {type === "login" ? (
              <a href={cfg.primaryHref} className="block">
                <button
                  className="w-full font-semibold text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
                  style={{ background: cfg.gradient }}
                >
                  <LogIn className="w-4 h-4" />
                  {cfg.primaryLabel}
                </button>
              </a>
            ) : (
              <Link href={cfg.primaryHref}>
                <button
                  className="w-full font-semibold text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
                  style={{ background: cfg.gradient }}
                >
                  {type === "premium" ? <Crown className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                  {cfg.primaryLabel}
                </button>
              </Link>
            )}
            {cfg.secondaryLabel && cfg.secondaryHref && (
              <Link href={cfg.secondaryHref}>
                <button className="w-full text-white/50 text-sm py-2 hover:text-white/70 transition-colors">
                  {cfg.secondaryLabel}
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
