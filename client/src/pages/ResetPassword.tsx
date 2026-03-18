/**
 * ResetPassword.tsx — Set a new password after clicking the reset link
 * URL: /reset-password?token=xxx
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Heart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const LOGO = import.meta.env.VITE_APP_LOGO as string;

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      setTimeout(() => { window.location.href = "/login"; }, 3000);
    },
    onError: (err) => {
      toast.error(err.message || "Password reset failed");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!token) {
      toast.error("Invalid reset link. Please request a new one.");
      return;
    }
    resetMutation.mutate({ token, newPassword: password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <img src={LOGO || "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/tMerpTNEMefRhZwO.png?Expires=1804389585&Signature=WUUmbeKd6gRL-5YievLbV1CH3uu0nlv-Re4ouPNZeR8Uaa5fZGvIpyzCfN4GeYzdNVN-L2Dfhpb6wP3tKMLML8tU2MU77LZNA0Db1Qt~FgBKmBrDM8f98IhyhaIIh3mcPdLcoP5aezbNBOluLkAKxGF1onaa3LNS33jvn6RdWOARg3rQF-iGyCG8t~MaJrqXCHCHnEQWkv8ww0KFZrIE6cKq-EgnS6NZ6Ugc~9fSwQmMSgxfKiJuZdqcca1LwferRwRh3oNdounneCfHfE~QI00U4T7~b0DybwkrOKG0VWDKwXiSGd2AgO7up05Jcgsq7v8V58dmlV9XRRUqXN~soA__&Key-Pair-Id=K2HSFNDJXOU9YS"} alt="iHeartEcho™" className="w-10 h-10 object-contain" />
          <div className="text-xl font-black" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>iHeartEcho™</div>
        </div>

        {done ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#f0fbfc" }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: "#189aa1" }} />
            </div>
            <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>Password updated!</h2>
            <p className="text-gray-500 text-sm mb-6">Your password has been changed. Redirecting you to sign in…</p>
            <Link href="/login">
              <Button className="w-full font-semibold text-white" style={{ background: "#189aa1" }}>Sign In</Button>
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>Set new password</h2>
            <p className="text-sm text-gray-500 mb-8">Choose a strong password for your iHeartEcho™ account.</p>

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
