/**
 * Register.tsx — Native free membership registration.
 * Users sign up directly through the app's OAuth flow.
 * Free membership is granted automatically on first login.
 * Existing Thinkific members are synced nightly and also receive free access.
 */
import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { Loader2, Heart, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const LOGO = import.meta.env.VITE_APP_LOGO as string;
const BRAND = "#189aa1";

export default function Register() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // If already authenticated, redirect to home
  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/");
  }, [isAuthenticated, loading, navigate]);

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
            <img src={LOGO} alt="All About Ultrasound™" className="w-16 h-16 object-contain" />
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
          Sign up in seconds and get instant access to free tools. No credit card required.
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

        {/* CTA */}
        <a href={getLoginUrl("/")} className="block w-full">
          <Button className="w-full gap-2 text-white text-base py-5" style={{ background: BRAND }}>
            Get Started — It's Free
            <ArrowRight className="w-4 h-4" />
          </Button>
        </a>

        <p className="text-xs text-gray-400 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="font-medium hover:underline" style={{ color: BRAND }}>
            Sign in
          </Link>
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Want premium features?{" "}
          <Link href="/premium" className="font-medium hover:underline" style={{ color: BRAND }}>
            View plans
          </Link>
        </p>
      </div>
    </div>
  );
}
