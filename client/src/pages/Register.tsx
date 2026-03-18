/**
 * Register.tsx — Redirects to Thinkific Free Membership enrollment.
 * All new user registrations are handled through Thinkific.
 * Once enrolled, the Thinkific webhook grants the user access to the app.
 */
import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { THINKIFIC_FREE_MEMBERSHIP_URL, THINKIFIC_FREE_MEMBERSHIP_PAGE } from "@/const";
import { Loader2, Heart, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOGO = import.meta.env.VITE_APP_LOGO as string;
const BRAND = "#189aa1";

export default function Register() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // If already authenticated, redirect to home
  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/");
  }, [isAuthenticated, loading, navigate]);

  // Auto-redirect to Thinkific enrollment after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = THINKIFIC_FREE_MEMBERSHIP_URL;
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0e1e2e] via-[#0e4a50] to-[#189aa1] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          {LOGO ? (
            <img src={LOGO} alt="iHeartEcho" className="w-16 h-16 object-contain" />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: BRAND }}>
              <Heart className="w-8 h-8 text-white" />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
          Create Your Free Account
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          iHeartEcho membership is managed through All About Ultrasound. You'll be redirected to complete your free enrollment.
        </p>

        {/* Benefits */}
        <div className="bg-[#f0fbfc] rounded-xl p-4 mb-6 text-left space-y-2">
          {[
            "Free access to Daily Echo Challenge",
            "Echo calculators and reference tools",
            "ScanCoach™ probe guidance",
            "Upgrade anytime for full clinical suite",
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
              {benefit}
            </div>
          ))}
        </div>

        {/* Redirect notice */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-5">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: BRAND }} />
          <span>Redirecting to enrollment in a moment…</span>
        </div>

        {/* Manual redirect button */}
        <a href={THINKIFIC_FREE_MEMBERSHIP_URL} className="block w-full">
          <Button className="w-full gap-2 text-white" style={{ background: BRAND }}>
            <ExternalLink className="w-4 h-4" />
            Go to Free Enrollment Now
          </Button>
        </a>

        <p className="text-xs text-gray-400 mt-4">
          Already have an account?{" "}
          <a href="/login" className="font-medium hover:underline" style={{ color: BRAND }}>
            Sign in
          </a>
        </p>

        <p className="text-xs text-gray-400 mt-2">
          Want to learn more first?{" "}
          <a
            href={THINKIFIC_FREE_MEMBERSHIP_PAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ color: BRAND }}
          >
            View membership details
          </a>
        </p>
      </div>
    </div>
  );
}
