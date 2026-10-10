/**
 * ResetPassword.tsx — Set a new password after clicking the reset link
 * URL: /reset-password?token=xxx
 */
import React, { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Heart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { buildPasswordSetupSubmission } from "@shared/passwordSetupSubmission";
import { getAuthPageBrandName, getAuthPageLogoUrl } from "@/lib/authPageBrand";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const brandName = getAuthPageBrandName();
  const logo = getAuthPageLogoUrl();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [automaticSignInReady, setAutomaticSignInReady] = useState(false);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: (data) => {
      setDone(true);
      // Password storage is already complete. Automatic sign-in is optional, so
      // give the learner a clear manual path if its handoff is unavailable.
      const autoLoginUrl = (data as any)?.autoLoginUrl as string | null | undefined;
      setAutomaticSignInReady(Boolean(autoLoginUrl));
      if (autoLoginUrl) {
        setTimeout(() => { window.location.href = autoLoginUrl; }, 2000);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Password reset failed");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submission = buildPasswordSetupSubmission(token, password, confirmPassword);
    if ("error" in submission) {
      toast.error(submission.error);
      return;
    }
    resetMutation.mutate(submission);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <img src={logo} alt={`${brandName} logo`} className="w-10 h-10 object-contain" />
          <div className="text-xl font-black" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>{brandName}</div>
        </div>

        {done ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#f0fbfc" }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: "#189aa1" }} />
            </div>
            <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>Password updated!</h2>
            <p className="text-gray-500 text-sm mb-6">
              {automaticSignInReady
                ? "Your password has been changed. Signing you in…"
                : "Your password has been changed. Please sign in with your new password."}
            </p>
            <Link href={automaticSignInReady ? "/my-dashboard" : "/login"}>
              <Button className="w-full font-semibold text-white" style={{ background: "#189aa1" }}>
                {automaticSignInReady ? "Go to Dashboard" : "Sign In"}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>Set new password</h2>
            <p className="text-sm text-gray-500 mb-8">Choose a strong password for your {brandName} account.</p>

            {!token && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                This reset link is invalid or has expired. Please{" "}
                <Link href="/forgot-password" className="underline font-medium">request a new one</Link>.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                disabled={resetMutation.isPending || !password || !confirmPassword || !token}
                className="w-full h-11 font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #189aa1 0%, #0e7a80 100%)" }}
              >
                {resetMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating password…</>
                ) : "Update Password"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm hover:underline" style={{ color: "#189aa1" }}>Back to Sign In</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
