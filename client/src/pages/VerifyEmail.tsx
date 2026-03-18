/**
 * VerifyEmail.tsx — Handles both email-change verification and initial account verification
 * URL: /verify-email?token=xxx&type=change  (email change)
 * URL: /verify-email?token=xxx             (account activation)
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, Loader2, Heart, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOGO = import.meta.env.VITE_APP_LOGO as string;

export default function VerifyEmail() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const type = params.get("type"); // "change" for email-change flow

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [newEmail, setNewEmail] = useState<string | null>(null);

  // ── Account activation verification ──────────────────────────────────────
  const verifyAccountMutation = trpc.emailAuth.verifyEmail.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      setMessage(data.alreadyVerified ? "Your email was already verified." : "Your account is now active!");
      setTimeout(() => { window.location.href = "/"; }, 3000);
    },
    onError: (err) => {
      setStatus("error");
      setMessage(err.message || "Verification failed. The link may have expired.");
    },
  });

  // ── Email change verification ─────────────────────────────────────────────
  const verifyEmailChangeMutation = trpc.auth.verifyEmailChange.useMutation({
    onSuccess: (data) => {
      setNewEmail(data.newEmail);
      setStatus("success");
      setMessage(`Your email has been updated to ${data.newEmail}.`);
    },
    onError: (err) => {
      setStatus("error");
      setMessage(err.message || "Verification failed. The link may be invalid or expired.");
    },
  });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the URL.");
      return;
    }
    if (type === "change") {
      verifyEmailChangeMutation.mutate({ token });
    } else {
      verifyAccountMutation.mutate({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEmailChange = type === "change";

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
              {isEmailChange ? (
                <Mail className="w-6 h-6 text-white" />
              ) : (
                <img src={LOGO || "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/tMerpTNEMefRhZwO.png?Expires=1804389585&Signature=WUUmbeKd6gRL-5YievLbV1CH3uu0nlv-Re4ouPNZeR8Uaa5fZGvIpyzCfN4GeYzdNVN-L2Dfhpb6wP3tKMLML8tU2MU77LZNA0Db1Qt~FgBKmBrDM8f98IhyhaIIh3mcPdLcoP5aezbNBOluLkAKxGF1onaa3LNS33jvn6RdWOARg3rQF-iGyCG8t~MaJrqXCHCHnEQWkv8ww0KFZrIE6cKq-EgnS6NZ6Ugc~9fSwQmMSgxfKiJuZdqcca1LwferRwRh3oNdounneCfHfE~QI00U4T7~b0DybwkrOKG0VWDKwXiSGd2AgO7up05Jcgsq7v8V58dmlV9XRRUqXN~soA__&Key-Pair-Id=K2HSFNDJXOU9YS"} alt="iHeartEcho™" className="w-8 h-8 object-contain" />
              )}
            </div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: "Merriweather, serif" }}>
              iHeartEcho™
            </h1>
            <p className="text-sm text-[#4ad9e0] mt-1">
              {isEmailChange ? "Email Address Change" : "Account Verification"}
            </p>
          </div>

          {/* Body */}
          <div className="px-8 py-8 text-center">
            {status === "loading" && (
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#f0fbfc] flex items-center justify-center mx-auto">
                  <Loader2 className="w-7 h-7 text-[#189aa1] animate-spin" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    {isEmailChange ? "Confirming your new email..." : "Verifying your account..."}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Please wait a moment.</p>
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    {isEmailChange ? "Email address confirmed!" : "Email verified!"}
                  </h2>
                  {isEmailChange && newEmail ? (
                    <>
                      <p className="text-sm text-gray-500 mt-1">Your email has been successfully updated to:</p>
                      <div className="mt-2 px-4 py-2 rounded-lg bg-[#f0fbfc] border border-[#189aa1]/20 inline-block">
                        <span className="text-sm font-semibold text-[#189aa1]">{newEmail}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-3">You can now sign in using your new email address.</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">
                      {message || "Your account is now active. Redirecting you to the app…"}
                    </p>
                  )}
                </div>
                <div className="pt-2">
                  {isEmailChange ? (
                    <Link href="/profile">
                      <button
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 mx-auto"
                        style={{ background: "#189aa1" }}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Profile
                      </button>
                    </Link>
                  ) : (
                    <Link href="/">
                      <Button className="w-full font-semibold text-white" style={{ background: "#189aa1" }}>
                        Go to iHeartEcho™
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                  <XCircle className="w-7 h-7 text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    Verification failed
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>
                </div>
                <div className="pt-2 space-y-2">
                  {isEmailChange ? (
                    <>
                      <Link href="/profile">
                        <button
                          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 mx-auto"
                          style={{ background: "#189aa1" }}
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Go to Profile
                        </button>
                      </Link>
                      <p className="text-xs text-gray-400">From your profile, you can request a new verification email.</p>
                    </>
                  ) : (
                    <>
                      <a href="https://member.allaboutultrasound.com/enroll/3707211?price_id=4656299" target="_blank" rel="noopener noreferrer" className="w-full">
                        <Button className="w-full font-semibold text-white" style={{ background: "#189aa1" }}>
                          Create a new account
                        </Button>
                      </a>
                      <div className="mt-3">
                        <Link href="/login" className="text-sm hover:underline" style={{ color: "#189aa1" }}>
                          Back to Sign In
                        </Link>
                      </div>
                    </>
                  )}
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
