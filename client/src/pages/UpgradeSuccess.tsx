/**
 * UpgradeSuccess.tsx
 *
 * Landing page for users returning from checkout.
 * Handles two scenarios:
 *  1. Logged-in user  → auto-sync premium status via checkAndSync
 *  2. Logged-out user → prompt to enter email to verify purchase,
 *                       then direct to sign-in or register
 *
 * Redirect here after checkout:
 *   https://your-domain.com/upgrade-success
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Crown, Check, Loader2, Mail, ArrowRight, AlertCircle, Sparkles, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";

export default function UpgradeSuccess() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // ── Logged-in flow ────────────────────────────────────────────────────────
  const [syncDone, setSyncDone] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);

  const checkAndSync = trpc.premium.checkAndSync.useMutation({
    onSuccess: (data) => {
      setSyncMessage(data.message);
      setSyncDone(true);
      setSyncError(false);
      if (data.isPremium) {
        setTimeout(() => navigate("/"), 3000);
      }
    },
    onError: () => {
      setSyncMessage("Could not verify your membership automatically. Please try again or contact support.");
      setSyncDone(true);
      setSyncError(true);
    },
  });

  // Auto-sync when user is logged in
  useEffect(() => {
    if (user && !authLoading && !syncDone && !checkAndSync.isPending) {
      checkAndSync.mutate();
    }
  }, [user, authLoading]);

  // ── Logged-out flow ───────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const syncByEmail = trpc.premium.syncByEmail.useMutation({
    onSuccess: (data) => {
      setEmailSubmitted(true);
      setEmailError(null);
      if (data.isPremium) {
        // Premium was found and synced — prompt to sign in
      } else if (data.premiumOnThinkific && !data.userExists) {
        // Purchase confirmed but no account yet — prompt to register
      } else if (!data.premiumOnThinkific) {
        setEmailError(data.message);
        setEmailSubmitted(false);
      }
    },
    onError: () => {
      setEmailError("Could not verify your purchase. Please check your email and try again.");
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailError(null);
    syncByEmail.mutate({ email: email.trim() });
  };

  const syncResult = syncByEmail.data;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="relative container py-16 md:py-24">
          <div className="max-w-lg mx-auto text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-[#4ad9e0]/40 flex items-center justify-center mx-auto mb-6">
              <Crown className="w-9 h-9 text-amber-400" />
            </div>

            <h1
              className="text-3xl md:text-4xl font-black text-white leading-tight mb-3"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              Thank You for Upgrading!
            </h1>
            <p className="text-white/70 text-base mb-8">
              You're one step away from unlocking the full iHeartEcho™ Premium suite.
            </p>

            {/* ── LOGGED-IN FLOW ── */}
            {user ? (
              <div className="bg-white rounded-2xl shadow-xl p-8">
                {checkAndSync.isPending ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
                    <p className="text-gray-600 text-sm">Verifying your purchase…</p>
                  </div>
                ) : syncDone && !syncError ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                      <Check className="w-7 h-7 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-base mb-1">
                        {syncMessage ?? "Premium access is active!"}
                      </p>
                      <p className="text-gray-400 text-sm">Redirecting you to the dashboard…</p>
                    </div>
                    <Button
                      onClick={() => navigate("/")}
                      className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-8"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Go to Dashboard
                    </Button>
                  </div>
                ) : syncDone && syncError ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
                      <AlertCircle className="w-7 h-7 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-base mb-1">Verification Issue</p>
                      <p className="text-gray-500 text-sm max-w-xs mx-auto">{syncMessage}</p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSyncDone(false);
                          setSyncError(false);
                          checkAndSync.mutate();
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>
                      <Button
                        onClick={() => navigate("/premium")}
                        className="bg-[#189aa1] hover:bg-[#147a80] text-white"
                      >
                        Go to Premium Page
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              /* ── LOGGED-OUT FLOW ── */
              <div className="bg-white rounded-2xl shadow-xl p-8">
                {!emailSubmitted ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Mail className="w-5 h-5 text-[#189aa1]" />
                      <h2 className="font-bold text-gray-800 text-lg">Verify Your Purchase</h2>
                    </div>
                    <p className="text-gray-500 text-sm mb-6">
                      Enter the email address you used to purchase to confirm your order and activate premium access.
                    </p>
                    <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="text-center"
                      />
                      {emailError && (
                        <p className="text-red-500 text-xs flex items-center gap-1 justify-center">
                          <AlertCircle className="w-3 h-3" />
                          {emailError}
                        </p>
                      )}
                      <Button
                        type="submit"
                        disabled={syncByEmail.isPending || !email.trim()}
                        className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold"
                      >
                        {syncByEmail.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</>
                        ) : (
                          <>Verify Purchase <ArrowRight className="w-4 h-4 ml-2" /></>
                        )}
                      </Button>
                    </form>
                    <div className="mt-5 pt-5 border-t border-gray-100">
                      <p className="text-gray-400 text-xs mb-3">Already have an iHeartEcho™ account?</p>
                      <a href="/login">
                        <Button variant="outline" size="sm" className="w-full">
                          Sign In
                        </Button>
                      </a>
                    </div>
                  </>
                ) : syncResult?.isPremium ? (
                  /* Purchase verified + account exists → prompt to sign in */
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                      <Check className="w-7 h-7 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-base mb-1">Purchase Confirmed!</p>
                      <p className="text-gray-500 text-sm max-w-xs mx-auto">
                        Your premium access has been activated. Sign in to start using all premium features.
                      </p>
                    </div>
                    <a href="/login" className="w-full">
                      <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold w-full">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Sign In to Access Premium
                      </Button>
                    </a>
                  </div>
                ) : syncResult?.premiumOnThinkific && !syncResult.userExists ? (
                  /* Purchase verified but no iHeartEcho™ account yet → prompt to register */
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#f0fbfc] flex items-center justify-center">
                      <Crown className="w-7 h-7 text-[#189aa1]" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-base mb-1">Purchase Confirmed!</p>
                      <p className="text-gray-500 text-sm max-w-xs mx-auto">
                        Your purchase was verified. Create your free iHeartEcho™ account using{" "}
                        <strong>{email}</strong> and premium will be activated automatically.
                      </p>
                    </div>
                    <a href="https://member.allaboutultrasound.com/enroll/3707211?price_id=4656299" target="_blank" rel="noopener noreferrer" className="w-full">
                      <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold w-full">
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Create Free Account
                      </Button>
                    </a>
                    <a href="/login" className="w-full">
                      <Button variant="outline" size="sm" className="w-full">
                        Already have an account? Sign In
                      </Button>
                    </a>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help section */}
      <div className="container py-10">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-gray-400 text-sm">
            Having trouble? Make sure you're using the same email address you used during checkout.{" "}
            <a href="/premium" className="text-[#189aa1] hover:underline">
              Go back to the Premium page
            </a>{" "}
            or contact us at{" "}
            <a href="mailto:support@iheartecho.com" className="text-[#189aa1] hover:underline">
              support@iheartecho.com
            </a>
            .
          </p>
        </div>
      </div>
    </Layout>
  );
}
