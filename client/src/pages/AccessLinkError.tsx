import { Link } from "wouter";
import { ShieldAlert, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const REASON_MESSAGES: Record<string, string> = {
  invalid: "This access link is invalid. Please request a new sign-in link or contact support.",
  revoked:
    "This access link was used from too many locations and has been disabled for security. Your purchases are still active — sign in with your email to continue.",
  missing_token: "No access token was found in this link.",
  db_unavailable: "Service temporarily unavailable. Please try again in a moment.",
  server_error: "An unexpected error occurred. Please try again.",
};

export default function AccessLinkError() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason") ?? "invalid";
  const message = REASON_MESSAGES[reason] ?? REASON_MESSAGES.invalid;
  const isRevoked = reason === "revoked";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div
            className="px-8 py-6 text-center"
            style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
          >
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: "Merriweather, serif" }}>
              All About Ultrasound™
            </h1>
            <p className="text-sm text-[#4ad9e0] mt-1">Access link issue</p>
          </div>
          <div className="px-8 py-10 text-center space-y-4">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
                isRevoked ? "bg-amber-50" : "bg-red-50"
              }`}
            >
              {isRevoked ? (
                <ShieldAlert className="w-7 h-7 text-amber-500" />
              ) : (
                <XCircle className="w-7 h-7 text-red-500" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                {isRevoked ? "Access link disabled" : "Access failed"}
              </h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{message}</p>
            </div>
            <div className="pt-2 space-y-2">
              <Link href="/magic-link">
                <Button
                  className="w-full font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: "#189aa1" }}
                >
                  <RefreshCw className="w-4 h-4" />
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
