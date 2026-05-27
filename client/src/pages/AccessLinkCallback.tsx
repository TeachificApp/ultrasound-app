/**
 * AccessLinkCallback.tsx — Handles persistent access link login
 * URL: /auth/access?token=...
 *
 * Used in purchase confirmation and access emails.
 * Token never expires and is reusable (unlike magic links).
 * IP abuse detection on server: >3 distinct IPs/24h revokes token.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, XCircle, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOGO = import.meta.env.VITE_APP_LOGO as string;

type Status = "verifying" | "success" | "error" | "revoked";

export default function AccessLinkCallback() {
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [redirectTo, setRedirectTo] = useState("/");
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const next = params.get("next") || "/";
    setRedirectTo(next);

    if (!token) {
      setStatus("error");
      setErrorMessage("No access token found in this link. Please contact support.");
      return;
    }

    fetch("/api/auth/access-verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 403 && data.revoked) {
          setStatus("revoked");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(data.error || "This access link is invalid. Please contact support.");
          return;
        }
        setStatus("success");
        setTimeout(() => {
          window.location.href = next;
        }, 1500);
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("An unexpected error occurred. Please try again.");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
              <img
                src={LOGO || "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp"}
                alt="All About Ultrasound™"
                className="w-8 h-8 object-contain"
              />
            </div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: "Merriweather, serif" }}>
              All About Ultrasound™
            </h1>
            <p className="text-sm text-[#4ad9e0] mt-1">Accessing your content…</p>
          </div>

          {/* Body */}
          <div className="px-8 py-10 text-center">
            {status === "verifying" && (
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#f0fbfc] flex items-center justify-center mx-auto">
                  <Loader2 className="w-7 h-7 text-[#189aa1] animate-spin" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    Signing you in…
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Please wait while we verify your access link.
                  </p>
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
                    You're signed in!
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Redirecting you to your content…
                  </p>
                </div>
                <div className="pt-2">
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: "#189aa1",
                        animation: "progress 1.5s linear forwards",
                        width: "0%",
                      }}
                    />
                  </div>
                </div>
                <style>{`
                  @keyframes progress {
                    from { width: 0% }
                    to { width: 100% }
                  }
                `}</style>
              </div>
            )}

            {status === "revoked" && (
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-7 h-7 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    Access link disabled
                  </h2>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    This access link was used from too many locations and has been disabled for security.
                    Your purchases and access are still active — please sign in directly.
                  </p>
                </div>
                <div className="pt-2 space-y-2">
                  <Link href="/magic-link">
                    <Button className="w-full font-semibold text-white" style={{ background: "#189aa1" }}>
                      Sign in with email link
                    </Button>
                  </Link>
                  <Link href="/login">
                    <button className="text-sm text-gray-400 hover:text-gray-600 mt-1 block mx-auto">
                      Sign in with password
                    </button>
                  </Link>
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
                    Access failed
                  </h2>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
                <div className="pt-2 space-y-2">
                  <Link href="/magic-link">
                    <Button className="w-full font-semibold text-white" style={{ background: "#189aa1" }}>
                      Request a sign-in link
                    </Button>
                  </Link>
                  <Link href="/login">
                    <button className="text-sm text-gray-400 hover:text-gray-600 mt-1 block mx-auto">
                      Sign in with password
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              © All About Ultrasound™ ·{" "}
              <a href="https://www.allaboutultrasound.com" className="text-[#189aa1] hover:underline">
                www.allaboutultrasound.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
