/**
 * CheckoutComplete.tsx
 * Return URL page for the hosted Stripe Embedded Checkout.
 *
 * Route: /checkout/complete
 * Query params:
 *   ?session_id=<cs_...>   — Stripe session ID (injected by Stripe)
 *   ?slug=<courseSlug>     — course slug (optional, LMS checkout)
 *   ?type=membership       — membership checkout
 */
import { useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, Clock, ArrowRight, BookOpen, Award, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function CheckoutComplete() {
  const [, navigate] = useLocation();

  const { sessionId, courseSlug, checkoutType } = useMemo(() => {
    const url = new URL(window.location.href);
    return {
      sessionId: url.searchParams.get("session_id") ?? "",
      courseSlug: url.searchParams.get("slug") ?? "",
      checkoutType: url.searchParams.get("type") ?? "course",
    };
  }, []);

  // Map content type to the correct My Content tab
  const getMyContentUrl = (contentType: string, slug?: string | null) => {
    switch (contentType) {
      case "quiz": return "/my-dashboard/my-content?tab=quizzes";
      case "download": return `/downloads/${slug}/files`;
      case "cohort": return "/my-dashboard/my-content?tab=cohorts";
      case "workshop": return "/my-dashboard/my-content?tab=workshops";
      case "webinar": return "/my-dashboard/my-content?tab=webinars";
      case "course":
      default: return slug ? `/courses/${slug}/player` : "/my-dashboard/my-content?tab=courses";
    }
  };

  const isMembership = checkoutType === "membership";

  const lmsQuery = trpc.lmsLearner.getCheckoutSessionStatus.useQuery(
    { sessionId },
    { enabled: !!sessionId && !isMembership, retry: 3, retryDelay: 1500 }
  );

  const membershipQuery = trpc.membership.getCheckoutSessionStatus.useQuery(
    { sessionId },
    { enabled: !!sessionId && isMembership, retry: 3, retryDelay: 1500 }
  );

  const data = isMembership ? membershipQuery.data : lmsQuery.data;
  const isLoading = isMembership ? membershipQuery.isLoading : lmsQuery.isLoading;
  const isError = isMembership ? membershipQuery.isError : lmsQuery.isError;

  const membershipPlanSlug = isMembership && data && "planSlug" in data ? data.planSlug : null;
  const autoLoginUrl = isMembership && data && "autoLoginUrl" in data ? data.autoLoginUrl : null;

  const resolvedContentType = (!isMembership && data && "contentType" in data) ? (data as any).contentType as string : "course";

  // Do NOT auto-redirect if payment is still pending — user needs to see the pending message
  // Only treat 'unpaid' as pending — 'no_payment_required' (free items, 100% discounts) should proceed normally
  const isPaymentPending = data?.status === "complete" && data?.paymentStatus === "unpaid";

  useEffect(() => {
    if (data?.status !== "complete") return;
    if (isPaymentPending) return; // stay on page, show pending message
    if (autoLoginUrl) {
      window.location.href = autoLoginUrl;
      return;
    }
    if (isMembership) {
      const timer = setTimeout(() => {
        navigate("/my-dashboard");
      }, 4000);
      return () => clearTimeout(timer);
    }
    // Redirect to the correct My Content section based on content type
    const timer = setTimeout(() => {
      const dest = getMyContentUrl(resolvedContentType, courseSlug);
      if (dest.startsWith("http") || dest.startsWith("/downloads")) {
        window.location.href = dest.startsWith("/") ? `${window.location.origin}${dest}` : dest;
      } else {
        navigate(dest);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [data?.status, courseSlug, resolvedContentType, navigate, autoLoginUrl, isMembership]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Session</h2>
          <p className="text-gray-500 text-sm mb-6">No checkout session was found. Please try again.</p>
          <Link href={isMembership ? "/my-dashboard" : "/library"}>
            <Button variant="outline" className="border-teal-200 text-teal-700 hover:bg-teal-50">
              {isMembership ? "My Dashboard" : "Back to Library"}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="animate-spin h-12 w-12 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Confirming your payment…</h2>
          <p className="text-gray-500 text-sm">Please wait while we verify your purchase.</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <Clock className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Still Processing</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your payment is being processed. If you completed payment, your {isMembership ? "membership" : "enrollment"} will appear in your account
            within a few minutes. Check your email for a confirmation.
          </p>
          <div className="flex gap-3 justify-center">
            {courseSlug && !isMembership && (
              <Link href={`/courses/${courseSlug}`}>
                <Button variant="outline" className="border-teal-200 text-teal-700 hover:bg-teal-50">
                  Back to Course
                </Button>
              </Link>
            )}
            <Link href={isMembership ? "/my-dashboard" : "/library"}>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                {isMembership ? "My Dashboard" : "My Library"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (data.status === "complete" && isPaymentPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-8 max-w-md w-full text-center">
          <div className="relative inline-block mb-5">
            <Clock className="h-16 w-16 text-amber-500 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Pending</h2>
          <p className="text-gray-600 text-sm mb-4">
            {data.customerEmail ? (
              <>Your order has been received and a confirmation has been sent to <strong>{data.customerEmail}</strong>.</>
            ) : (
              "Your order has been received."
            )}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">Awaiting bank confirmation</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Your payment method (e.g., ACH bank transfer or direct debit) requires additional processing time.
                  Access to your {isMembership ? "membership" : "content"} will be granted <strong>automatically</strong> once your bank confirms the payment — typically within <strong>1–5 business days</strong>.
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            You can check the status of your payment in <strong>My Dashboard → Purchases</strong>. No action is required from you.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/my-dashboard?tab=purchases">
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2">
                <Clock className="h-4 w-4" />
                View Purchase Status
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={isMembership ? "/my-dashboard" : "/library"}>
              <Button variant="outline" className="w-full border-gray-200 text-gray-600 hover:bg-gray-50">
                {isMembership ? "Go to My Dashboard" : "Back to Library"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (data.status === "complete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="relative inline-block mb-5">
            <CheckCircle2 className="h-16 w-16 text-teal-500 mx-auto" />
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-teal-500 rounded-full animate-ping opacity-60" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isMembership ? "Your membership is active! 🎉" : "You're enrolled! 🎉"}
          </h2>
          <p className="text-gray-500 text-sm mb-1">
            {data.customerEmail ? (
              <>A confirmation has been sent to <strong>{data.customerEmail}</strong>.</>
            ) : (
              isMembership ? "Your membership is confirmed." : "Your enrollment is confirmed."
            )}
          </p>
          <p className="text-gray-400 text-xs mb-5">
            {autoLoginUrl
              ? "Signing you in now…"
              : isMembership
                ? "Redirecting you to your dashboard in a moment…"
                : resolvedContentType === "quiz"
                  ? "Redirecting you to My Content → Quizzes in a moment…"
                  : resolvedContentType === "download"
                    ? "Redirecting you to your download in a moment…"
                    : "Redirecting you to the course in a moment…"}
          </p>
          <p className="text-gray-400 text-[10px] mb-7">
            All sales are final. By completing this purchase you agree to our{" "}
            <a href="/terms" className="underline hover:text-gray-600">Terms of Service</a>.
          </p>

          <div className="flex flex-col gap-3">
            {autoLoginUrl && (
              <a href={autoLoginUrl}>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2">
                  <Award className="h-4 w-4" />
                  Go to My Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            )}
            {!isMembership && (
              <Link href={getMyContentUrl(resolvedContentType, courseSlug)}>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2">
                  <BookOpen className="h-4 w-4" />
                  {resolvedContentType === "quiz" ? "Go to My Quizzes" : resolvedContentType === "download" ? "Access My Download" : "Start Learning Now"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {isMembership && membershipPlanSlug && (
              <Link href={`/memberships/${membershipPlanSlug}`}>
                <Button variant="outline" className="w-full border-gray-200 text-gray-600 hover:bg-gray-50">
                  View Membership
                </Button>
              </Link>
            )}
            <Link href={isMembership ? "/my-dashboard" : "/library"}>
              <Button variant="outline" className="w-full border-gray-200 text-gray-600 hover:bg-gray-50">
                {isMembership ? "Go to My Dashboard" : "Go to My Library"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Payment Not Completed</h2>
        <p className="text-gray-500 text-sm mb-6">
          {data.status === "expired"
            ? "This checkout session has expired. Please start a new checkout."
            : "Your payment was not completed. Please try again."}
        </p>
        <div className="flex gap-3 justify-center">
          {(courseSlug || membershipPlanSlug) && (
            <Link href={isMembership && membershipPlanSlug ? `/checkout/${membershipPlanSlug}?type=membership` : `/checkout/${courseSlug}`}>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                Try Again
              </Button>
            </Link>
          )}
          <Link href={isMembership ? "/my-dashboard" : "/library"}>
            <Button variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50">
              {isMembership ? "My Dashboard" : "Back to Library"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
