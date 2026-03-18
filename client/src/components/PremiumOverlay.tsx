/*
  PremiumOverlay.tsx — iHeartEcho™
  Transparent premium gate: shows content blurred behind a lock overlay
  so free users can see what they're missing before upgrading.

  Security model:
  - Uses the cached auth.me user object (appRoles + isPremium flag) as the
    PRIMARY check — no extra network round-trip, no flash for premium users.
  - The overlay is shown by DEFAULT while auth is loading (no spinner flash).
  - Content is only revealed once we have CONFIRMED the user is premium.
  - This prevents bypass via fast navigation or slow auth checks.

  Usage:
    <PremiumOverlay featureName="LAP Estimation">
      <YourPremiumContent />
    </PremiumOverlay>
*/
import { Link } from "wouter";
import { Crown, Lock, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePremium } from "@/hooks/usePremium";

interface PremiumOverlayProps {
  children: React.ReactNode;
  /** Feature name shown in the overlay prompt */
  featureName?: string;
  /** Optional: custom checkout URL override */
  checkoutUrl?: string;
}

export function PremiumOverlay({ children, featureName, checkoutUrl }: PremiumOverlayProps) {
  const { isPremium, loading, isAuthenticated } = usePremium();

  // While auth is still loading, show the overlay with a spinner — never reveal content early.
  // Once loaded: if premium, render children directly with no overlay at all.
  if (!loading && isPremium) {
    return <>{children}</>;
  }

  const isLoading = loading;
  const isLoggedIn = isAuthenticated;
  const upgradeUrl = checkoutUrl ?? "https://member.allaboutultrasound.com/enroll/3703267?price_id=4651832";

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred content preview — always shown, never accessible */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: "blur(3px)", opacity: 0.45 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay — shown during loading AND when not premium */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div
          className="mx-4 rounded-2xl border shadow-xl px-6 py-6 text-center max-w-sm w-full"
          style={{
            background: "rgba(14, 30, 46, 0.92)",
            borderColor: "rgba(74, 217, 224, 0.3)",
            backdropFilter: "blur(8px)",
          }}
        >
          {isLoading ? (
            /* Loading state — show spinner inside the overlay card, not instead of it */
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 text-[#4ad9e0] animate-spin" />
              <p className="text-white/60 text-xs">Checking membership…</p>
            </div>
          ) : (
            <>
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(24, 154, 161, 0.2)", border: "1px solid rgba(74, 217, 224, 0.3)" }}
              >
                <Lock className="w-6 h-6 text-[#4ad9e0]" />
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3 text-xs font-semibold"
                style={{ background: "rgba(24, 154, 161, 0.2)", color: "#4ad9e0", border: "1px solid rgba(74, 217, 224, 0.2)" }}>
                <Crown className="w-3 h-3" />
                Premium Feature
              </div>

              <h3 className="font-bold text-white text-base mb-1.5" style={{ fontFamily: "Merriweather, serif" }}>
                {featureName ?? "Premium Content"}
              </h3>
              <p className="text-white/60 text-xs mb-4 leading-relaxed">
                {isLoggedIn
                  ? "Upgrade to iHeartEcho™ Premium to unlock this feature and the full clinical suite."
                  : "Sign in and upgrade to access this feature and the full iHeartEcho™ clinical suite."}
              </p>

              <div className="flex flex-col gap-2">
                {isLoggedIn ? (
                  <>
                    <a href={upgradeUrl} target="_blank" rel="noopener noreferrer">
                      <Button
                        className="w-full text-sm font-semibold text-white"
                        style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
                      >
                        <Sparkles className="w-4 h-4 mr-1.5" />
                        Upgrade — $9.97/month
                      </Button>
                    </a>
                    <Link href="/premium">
                      <Button variant="outline" className="w-full text-xs border-white/20 text-white/70 hover:bg-white/10">
                        Learn More <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <a href="/login">
                      <Button
                        className="w-full text-sm font-semibold text-white"
                        style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
                      >
                        Sign In to Continue
                      </Button>
                    </a>
                    <a href={upgradeUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full text-xs border-white/20 text-white/70 hover:bg-white/10">
                        <Crown className="w-3 h-3 mr-1" />
                        View Premium Plans
                      </Button>
                    </a>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
