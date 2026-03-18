/**
 * Unsubscribe page — one-click opt-out from platform campaign emails
 * Route: /unsubscribe?token=<token>
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
  const token = params.get("token") ?? "";

  const [attempted, setAttempted] = useState(false);

  const unsubscribeMutation = trpc.emailCampaign.unsubscribe.useMutation();

  useEffect(() => {
    if (token && !attempted) {
      setAttempted(true);
      unsubscribeMutation.mutate({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isLoading = unsubscribeMutation.isPending || (!attempted && !!token);
  const isSuccess = unsubscribeMutation.isSuccess;
  const isError = unsubscribeMutation.isError || (!token);
  const alreadyDone = unsubscribeMutation.data?.alreadyUnsubscribed;

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
            iHeartEcho™
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
                  ? "You have already opted out of platform campaign emails. You will not receive any further marketing emails from iHeartEcho™."
                  : "You have been removed from our platform email list. You will no longer receive campaign or marketing emails from iHeartEcho™."}
              </p>
              <p className="text-xs text-gray-400 mb-6">
                Note: You may still receive transactional emails such as password resets, account
                notifications, and daily challenge reminders (if enabled in your profile).
              </p>
              <div className="flex flex-col gap-3">
                <Link href="/profile#interests">
                  <Button
                    className="w-full"
                    style={{ background: brandColor, color: "#fff" }}
                  >
                    Manage Interest Preferences
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to iHeartEcho™
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
                {!token
                  ? "No unsubscribe token was found in the link. Please use the unsubscribe link from your email."
                  : "This unsubscribe link is invalid or has expired. Please use the link from your most recent email."}
              </p>
              <Link href="/">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to iHeartEcho™
                </Button>
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © All About Ultrasound · iHeartEcho™ Platform
        </p>
      </div>
    </div>
  );
}
