/**
 * PartnerSignup.tsx
 * Private, unlisted revenue partner sign-up page.
 * URL: /partner-signup
 * Not linked from anywhere — share the URL directly with pre-approved partners.
 *
 * Flow:
 * 1. Partner enters their name + email
 * 2. Backend checks against the partner_allowlist table
 * 3. If approved → creates Stripe Express account + returns onboarding link
 * 4. If not approved → shows error with contact email
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle, AlertCircle, ExternalLink, Loader2, ArrowRight, ShieldCheck,
} from "lucide-react";

// ─── Brand header ─────────────────────────────────────────────────────────────

function BrandHeader() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center shadow-lg mb-4">
        <ShieldCheck className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 text-center">Revenue Partner Registration</h1>
      <p className="text-sm text-gray-500 mt-1 text-center">All About Ultrasound™ · Powered by Stripe Connect</p>
    </div>
  );
}

// ─── Status: Complete ─────────────────────────────────────────────────────────

function CompleteState() {
  return (
    <div className="text-center py-8">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">Onboarding Complete!</h2>
      <p className="text-sm text-gray-500 max-w-sm mx-auto">
        Your Stripe Express account has been set up. You will receive payouts automatically
        when revenue is generated. You can close this window.
      </p>
      <p className="text-xs text-gray-400 mt-4">
        Questions? Contact <a href="mailto:admin@allaboutultrasound.com" className="text-teal-600 underline">admin@allaboutultrasound.com</a>
      </p>
    </div>
  );
}

// ─── Status: Refresh (Stripe returned to refresh URL) ────────────────────────

function RefreshState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <AlertCircle className="w-14 h-14 text-amber-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">Session Expired</h2>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        Your Stripe onboarding session expired. Please re-enter your details to get a new link.
      </p>
      <Button onClick={onRetry} className="bg-teal-600 hover:bg-teal-700 text-white">
        Start Again
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PartnerSignup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"form" | "success" | "complete" | "refresh">("form");
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Read URL status param (Stripe redirects back here)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "complete") setStep("complete");
    else if (status === "refresh") setStep("refresh");
  }, []);

  const register = trpc.revenueShare.selfRegisterPartner.useMutation({
    onSuccess: (data) => {
      setErrorMsg(null);
      if (data.onboardingUrl) {
        setOnboardingUrl(data.onboardingUrl);
        setStep("success");
      } else {
        // Stripe account created but no onboarding link (Stripe restriction)
        setStep("success");
        setOnboardingUrl(null);
      }
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim() || !email.trim()) {
      setErrorMsg("Please enter your full name and email address.");
      return;
    }
    register.mutate({
      name: name.trim(),
      email: email.trim(),
      origin: window.location.origin,
    });
  };

  // ── Complete state ──────────────────────────────────────────────────────────
  if (step === "complete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <BrandHeader />
          <CompleteState />
        </div>
      </div>
    );
  }

  // ── Refresh state ───────────────────────────────────────────────────────────
  if (step === "refresh") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <BrandHeader />
          <RefreshState onRetry={() => { setStep("form"); setOnboardingUrl(null); setErrorMsg(null); }} />
        </div>
      </div>
    );
  }

  // ── Success state (onboarding link ready) ───────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <BrandHeader />
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Welcome, <strong>{name}</strong>. Your partner account has been created.
              {onboardingUrl
                ? " Please complete your Stripe Express onboarding to start receiving payouts."
                : " Your account is pending Stripe setup — you will be contacted by admin@allaboutultrasound.com with next steps."}
            </p>
            {onboardingUrl ? (
              <a href={onboardingUrl} target="_blank" rel="noopener noreferrer">
                <Button className="bg-teal-600 hover:bg-teal-700 text-white w-full gap-2">
                  Complete Stripe Onboarding <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                Stripe account setup is pending. You will receive an email with onboarding instructions shortly.
              </div>
            )}
            <p className="text-xs text-gray-400 mt-4">
              Questions? <a href="mailto:admin@allaboutultrasound.com" className="text-teal-600 underline">admin@allaboutultrasound.com</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form state ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <BrandHeader />

        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6 text-sm text-teal-800">
          <strong>Invitation-only.</strong> This page is for pre-approved revenue partners only.
          If you have not been invited, please contact{" "}
          <a href="mailto:admin@allaboutultrasound.com" className="underline font-medium">
            admin@allaboutultrasound.com
          </a>{" "}
          to request access.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="partner-name" className="text-sm font-medium text-gray-700">Full Name</Label>
            <Input
              id="partner-name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="h-11"
              disabled={register.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="partner-email" className="text-sm font-medium text-gray-700">Email Address</Label>
            <Input
              id="partner-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="h-11"
              disabled={register.isPending}
            />
            <p className="text-xs text-gray-400">Must match the email address you were invited with.</p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                {errorMsg}
                {errorMsg.includes("not on the partner allowlist") && (
                  <div className="mt-1">
                    Contact{" "}
                    <a href="mailto:admin@allaboutultrasound.com" className="underline font-medium">
                      admin@allaboutultrasound.com
                    </a>{" "}
                    to enable your partner account.
                  </div>
                )}
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-2"
            disabled={register.isPending}
          >
            {register.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Setting up your account…</>
            ) : (
              <>Register as Revenue Partner <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Your payout information is processed securely via{" "}
            <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline">Stripe</a>.
            All About Ultrasound™ never stores your banking details.
          </p>
        </div>
      </div>
    </div>
  );
}
