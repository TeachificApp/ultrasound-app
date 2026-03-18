/**
 * ForgotPassword.tsx — Request a password reset email
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Heart, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const LOGO = import.meta.env.VITE_APP_LOGO as string;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const forgotMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSent(true);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send reset email");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    forgotMutation.mutate({ email: email.trim().toLowerCase() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <img src={LOGO || "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/tMerpTNEMefRhZwO.png?Expires=1804389585&Signature=WUUmbeKd6gRL-5YievLbV1CH3uu0nlv-Re4ouPNZeR8Uaa5fZGvIpyzCfN4GeYzdNVN-L2Dfhpb6wP3tKMLML8tU2MU77LZNA0Db1Qt~FgBKmBrDM8f98IhyhaIIh3mcPdLcoP5aezbNBOluLkAKxGF1onaa3LNS33jvn6RdWOARg3rQF-iGyCG8t~MaJrqXCHCHnEQWkv8ww0KFZrIE6cKq-EgnS6NZ6Ugc~9fSwQmMSgxfKiJuZdqcca1LwferRwRh3oNdounneCfHfE~QI00U4T7~b0DybwkrOKG0VWDKwXiSGd2AgO7up05Jcgsq7v8V58dmlV9XRRUqXN~soA__&Key-Pair-Id=K2HSFNDJXOU9YS"} alt="iHeartEcho™" className="w-10 h-10 object-contain" />
          <div className="text-xl font-black" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>iHeartEcho™</div>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#f0fbfc" }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: "#189aa1" }} />
            </div>
            <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>Check your email</h2>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>Forgot your password?</h2>
            <p className="text-sm text-gray-500 mb-8">Enter your email address and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                disabled={forgotMutation.isPending || !email}
                className="w-full h-11 font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #189aa1 0%, #0e7a80 100%)" }}
              >
                {forgotMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                ) : "Send Reset Link"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm flex items-center justify-center gap-1 hover:underline" style={{ color: "#189aa1" }}>
                <ArrowLeft className="w-3 h-3" />
                Back to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
