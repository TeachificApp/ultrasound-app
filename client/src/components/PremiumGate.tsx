/**
 * PremiumGate — wraps content that requires an active Premium Access subscription.
 *
 * Usage:
 *   <PremiumGate>
 *     <MyPremiumFeature />
 *   </PremiumGate>
 *
 * When the user is not premium, the children are rendered underneath a
 * blurred + semi-transparent overlay so they can see what they are missing.
 * The upgrade/sign-in prompt floats on top.
 */
import { Link } from "wouter";
import { Crown, Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

interface PremiumGateProps {
  children: React.ReactNode;
  /** Optional feature name shown in the upgrade prompt */
  featureName?: string;
  /** If true, show a compact inline lock badge instead of the full overlay */
  compact?: boolean;
}

export function PremiumGate({ children, featureName, compact = false }: PremiumGateProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: status, isLoading: statusLoading } = trpc.premium.getStatus.useQuery(undefined, {
    enabled: !!user,
  });

  // Only reveal content once we have CONFIRMED premium status.
  // During loading, show the locked state (not a spinner) to prevent bypass.
  const isConfirmedPremium = !authLoading && !statusLoading && !!user && !!status?.isPremium;

  if (isConfirmedPremium) {
    return <>{children}</>;
  }

  // Compact variant — no preview overlay, just an inline badge
  if (compact) {
    if (authLoading || (!!user && statusLoading)) {
      return (
        <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
          <Lock className="w-3 h-3 animate-pulse" />
          <span>Checking access…</span>
        </div>
      );
    }
    if (!user) {
      return (
        <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Lock className="w-3 h-3" />
          <span>Sign in to access {featureName ?? "this feature"}</span>
          <a href="/login" className="text-[#189aa1] font-medium hover:underline">Sign in</a>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <Crown className="w-3 h-3" />
        <span>{featureName ?? "Premium"} feature</span>
        <Link href="/premium">
          <span className="text-[#189aa1] font-medium hover:underline cursor-pointer">Upgrade →</span>
        </Link>
      </div>
    );
  }

  // Full-size variant — render children blurred behind the overlay
  const isLoading = authLoading || (!!user && statusLoading);
  const isNotLoggedIn = !isLoading && !user;

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred content preview — pointer-events disabled so users can't interact */}
      <div
        className="select-none pointer-events-none"
        style={{ filter: "blur(4px)", opacity: 0.45 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] z-10">
        <div className="w-full max-w-sm mx-4">
          {isLoading ? (
            <LoadingPrompt />
          ) : isNotLoggedIn ? (
            <NotLoggedInPrompt featureName={featureName} />
          ) : (
            <UpgradePrompt featureName={featureName} checkoutUrl={status?.checkoutUrl} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingPrompt() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-xl p-7 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 animate-pulse">
        <Lock className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-sm text-gray-400">Checking access…</p>
    </div>
  );
}

function NotLoggedInPrompt({ featureName }: { featureName?: string }) {
  return (
    <div className="rounded-2xl border border-[#189aa1]/30 bg-white/95 shadow-2xl p-7 text-center">
      <div className="w-14 h-14 rounded-full bg-[#189aa1]/10 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-7 h-7 text-[#189aa1]" />
      </div>
      <h3 className="font-bold text-gray-800 text-lg mb-2" style={{ fontFamily: "Merriweather, serif" }}>
        Sign in to Continue
      </h3>
      <p className="text-gray-500 text-sm mb-5">
        {featureName
          ? `${featureName} requires an account.`
          : "Please sign in to access this feature."}
      </p>
      <a href="/login">
        <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">
          Sign In <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </a>
    </div>
  );
}

function UpgradePrompt({
  featureName,
  checkoutUrl,
}: {
  featureName?: string;
  checkoutUrl?: string;
}) {
  const url = checkoutUrl ?? "https://member.allaboutultrasound.com/enroll/3703267?price_id=4651832";

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-white/95 shadow-2xl p-7 text-center">
      {/* Crown icon */}
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center mx-auto mb-4 shadow-md">
        <Crown className="w-7 h-7 text-amber-500" />
      </div>

      {/* Badge */}
      <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
        <Sparkles className="w-3 h-3" />
        Premium Feature
      </div>

      {/* Heading */}
      <h3 className="font-bold text-gray-800 text-lg mb-2 leading-snug" style={{ fontFamily: "Merriweather, serif" }}>
        {featureName ? `Unlock ${featureName}` : "Premium Access Required"}
      </h3>

      {/* Body */}
      <p className="text-gray-500 text-sm mb-5 leading-relaxed">
        Upgrade to iHeartEcho™ Premium for <strong className="text-gray-700">$9.97/month</strong> — advanced
        protocols, 500+ echo cases, all calculator engines, and every premium tool.
      </p>

      {/* CTAs */}
      <div className="flex flex-col gap-2.5">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full font-semibold">
            <Crown className="w-4 h-4 mr-1.5" />
            Upgrade — $9.97/month
          </Button>
        </a>
        <Link href="/premium">
          <Button variant="outline" className="w-full">
            Learn More <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
