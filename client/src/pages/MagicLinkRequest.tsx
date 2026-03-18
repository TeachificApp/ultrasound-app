/**
 * MagicLinkRequest.tsx — Request a magic sign-in link
 * URL: /magic-link
 */
import { useState } from "react";
import { Link } from "wouter";
import { Mail, ArrowLeft, CheckCircle2, Heart, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOGO = import.meta.env.VITE_APP_LOGO as string;

export default function MagicLinkRequest() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const requestMutation = trpc.auth.requestMagicLink.useMutation({
    onSuccess: () => setSent(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    requestMutation.mutate({ email: trimmed });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div
            className="px-8 py-6 text-center"
            style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
          >
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
              <img src={LOGO || "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/tMerpTNEMefRhZwO.png?Expires=1804389585&Signature=WUUmbeKd6gRL-5YievLbV1CH3uu0nlv-Re4ouPNZeR8Uaa5fZGvIpyzCfN4GeYzdNVN-L2Dfhpb6wP3tKMLML8tU2MU77LZNA0Db1Qt~FgBKmBrDM8f98IhyhaIIh3mcPdLcoP5aezbNBOluLkAKxGF1onaa3LNS33jvn6RdWOARg3rQF-iGyCG8t~MaJrqXCHCHnEQWkv8ww0KFZrIE6cKq-EgnS6NZ6Ugc~9fSwQmMSgxfKiJuZdqcca1LwferRwRh3oNdounneCfHfE~QI00U4T7~b0DybwkrOKG0VWDKwXiSGd2AgO7up05Jcgsq7v8V58dmlV9XRRUqXN~soA__&Key-Pair-Id=K2HSFNDJXOU9YS"} alt="iHeartEcho™" className="w-8 h-8 object-contain" />
            </div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: "Merriweather, serif" }}>
              iHeartEcho™
            </h1>
            <p className="text-sm text-[#4ad9e0] mt-1">Passwordless Sign In</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {!sent ? (
              <>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-full bg-[#f0fbfc] flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-7 h-7 text-[#189aa1]" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    Sign in with a magic link
                  </h2>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    Enter your email address and we'll send you a one-click sign-in link. No password required.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoComplete="email"
                      autoFocus
                      required
                      className="h-11"
                      disabled={requestMutation.isPending}
                    />
                    {requestMutation.isError && (
                      <p className="text-xs text-red-500 mt-1">
                        {requestMutation.error?.message || "Something went wrong. Please try again."}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={requestMutation.isPending || !email.trim()}
                    className="w-full h-11 flex items-center justify-center gap-2 font-semibold text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #189aa1 0%, #0e7a80 100%)" }}
                  >
                    {requestMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending link…
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send Magic Link
                      </>
                    )}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs text-gray-400 bg-white px-2">
                    or
                  </div>
                </div>

                <div className="space-y-2 text-center">
                  <Link href="/login">
                    <button className="text-sm text-[#189aa1] hover:underline">
                      Sign in with password instead
                    </button>
                  </Link>
                </div>

                <div className="mt-4 text-center">
                  <Link href="/login">
                    <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mx-auto">
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to Sign In
                    </button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    Check your inbox
                  </h2>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    If{" "}
                    <span className="font-semibold text-gray-700">{email.trim()}</span>{" "}
                    is registered, a sign-in link is on its way.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <Zap className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      The link expires in <strong>15 minutes</strong> and can only be used once.
                    </p>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => { setSent(false); setEmail(""); requestMutation.reset(); }}
                    className="text-sm text-[#189aa1] hover:underline block mx-auto"
                  >
                    Try a different email address
                  </button>
                  <Link href="/login">
                    <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mx-auto mt-1">
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to Sign In
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              © All About Ultrasound ·{" "}
              <a href="https://www.iheartecho.com" className="text-[#189aa1] hover:underline">
                www.iheartecho.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
