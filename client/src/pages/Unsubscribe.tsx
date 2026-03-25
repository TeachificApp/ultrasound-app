/**
 * Unsubscribe page — one-click opt-out from platform emails.
 *
 * Two flows:
 *  1. Server-side HMAC redirect (challenge cron emails):
 *     /api/unsubscribe?token=<hmac> → server processes → redirects to
 *     /unsubscribe?status=success|already|invalid|notfound|error
 *
 *  2. Legacy tRPC token flow (campaign emails):
 *     /unsubscribe?token=<hex> → calls trpc.emailCampaign.unsubscribe
 */
import { useEffect, useState } from "react";
import { useSearch, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { CheckCircle, XCircle, Loader2, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const brandColor = "#189aa1";
const brandDark = "#0e1e2e";

export default function Unsubscribe() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const status = params.get("status"); // from HMAC server redirect
  const token = params.get("token");   // from legacy tRPC flow

  const [attempted, setAttempted] = useState(false);
  const unsubscribeMutation = trpc.emailCampaign.unsubscribe.useMutation();

  // Only call tRPC mutation if we have a raw token (legacy campaign emails)
  // and no server-side status (HMAC flow already processed server-side)
  useEffect(() => {
    if (token && !status && !attempted) {
      setAttempted(true);
      unsubscribeMutation.mutate({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  // Determine display state
  const isServerFlow = !!status;
  const serverSuccess = status === "success" || status === "already";
  const serverAlready = status === "already";
  const serverError = status === "invalid" || status === "notfound" || status === "error";

  const isLoading = !isServerFlow && (unsubscribeMutation.isPending || (!attempted && !!token));
  const isSuccess = isServerFlow ? serverSuccess : unsubscribeMutation.isSuccess;
  const isError = isServerFlow ? serverError : (unsubscribeMutation.isError || !token);
  const alreadyDone = isServerFlow ? serverAlready : unsubscribeMutation.data?.alreadyUnsubscribed;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #f0fbfc 0%, #e5f7f8 100%)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: `linear-gradient(135deg, ${brandDark}, ${brandColor})` }}
          >
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: brandDark, fontFamily: "Merriweather, serif" }}
          >
            All About Ultrasound™
          </h1>
          <p className="text-sm text-gray-500 mt-1">Email Preferences</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {isLoading && (
            <>
              <Loader2
                className="w-12 h-12 mx-auto mb-4 animate-spin"
                style={{ color: brandColor }}
              />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Processing…</h2>
              <p className="text-gray-500 text-sm">
                Updating your email preferences. This will only take a moment.
              </p>
            </>
          )}

          {isSuccess && !isLoading && (
            <>
              <CheckCircle
                className="w-14 h-14 mx-auto mb-4"
                style={{ color: brandColor }}
              />
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {alreadyDone ? "Already Unsubscribed" : "Successfully Unsubscribed"}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                {alreadyDone
                  ? "You have already opted out of platform emails. You will not receive any further marketing emails from All About Ultrasound™."
                  : "You have been removed from our email list. You will no longer receive daily challenge notifications or campaign emails from All About Ultrasound™."}
              </p>
              <p className="text-xs text-gray-400 mb-6">
                Note: You may still receive transactional emails such as password resets and
                account notifications.
              </p>
              <div className="flex flex-col gap-3">
                <Link href="/">
                  <Button variant="outline" className="w-full gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to All About Ultrasound™
                  </Button>
                </Link>
              </div>
            </>
          )}

          {isError && !isLoading && (
            <>
              <XCircle className="w-14 h-14 mx-auto mb-4 text-red-400" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                {status === "notfound"
                  ? "We could not find an account associated with this unsubscribe link."
                  : status === "error"
                  ? "Something went wrong processing your request. Please try again or contact support."
                  : "This unsubscribe link is invalid or has expired. Please use the link from your most recent email."}
              </p>
              <Link href="/">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to All About Ultrasound™
                </Button>
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © All About Ultrasound™ · All About Ultrasound™ Platform
        </p>
      </div>
    </div>
  );
}
