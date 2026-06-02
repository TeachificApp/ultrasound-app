/**
 * CheckoutComplete.tsx
 * Return URL page for the hosted Stripe Embedded Checkout.
 *
 * Route: /checkout/complete
 * Query params:
 *   ?session_id=<cs_...>   — Stripe session ID (injected by Stripe)
 *   ?slug=<courseSlug>     — course slug (injected by our return_url template)
 */
import { useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, Clock, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function CheckoutComplete() {
  const [, navigate] = useLocation();

  const sessionId = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams.get("session_id") ?? "";
  }, []);

  const courseSlug = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams.get("slug") ?? "";
  }, []);

  const { data, isLoading, isError } = trpc.lmsLearner.getCheckoutSessionStatus.useQuery(
    { sessionId },
    { enabled: !!sessionId, retry: 3, retryDelay: 1500 }
  );

  // Auto-redirect to course player after a short delay on success
  useEffect(() => {
    if (data?.status === "complete" && courseSlug) {
      const timer = setTimeout(() => {
        navigate(`/courses/${courseSlug}/player`);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [data?.status, courseSlug, navigate]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Session</h2>
          <p className="text-gray-500 text-sm mb-6">No checkout session was found. Please try again.</p>
          <Link href="/library">
            <Button variant="outline" className="border-teal-200 text-teal-700 hover:bg-teal-50">
              Back to Library
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
            Your payment is being processed. If you completed payment, your enrollment will appear in your library
            within a few minutes. Check your email for a confirmation.
          </p>
          <div className="flex gap-3 justify-center">
            {courseSlug && (
              <Link href={`/courses/${courseSlug}`}>
                <Button variant="outline" className="border-teal-200 text-teal-700 hover:bg-teal-50">
                  Back to Course
                </Button>
              </Link>
            )}
            <Link href="/library">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                My Library
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Payment complete
  if (data.status === "complete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="relative inline-block mb-5">
            <CheckCircle2 className="h-16 w-16 text-teal-500 mx-auto" />
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-teal-500 rounded-full animate-ping opacity-60" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're enrolled! 🎉</h2>
          <p className="text-gray-500 text-sm mb-1">
            {data.customerEmail ? (
              <>A confirmation has been sent to <strong>{data.customerEmail}</strong>.</>
            ) : (
              "Your enrollment is confirmed."
            )}
          </p>
          <p className="text-gray-400 text-xs mb-7">Redirecting you to the course in a moment…</p>

          <div className="flex flex-col gap-3">
            {courseSlug && (
              <Link href={`/courses/${courseSlug}/player`}>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2">
                  <BookOpen className="h-4 w-4" />
                  Start Learning Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="/library">
              <Button variant="outline" className="w-full border-gray-200 text-gray-600 hover:bg-gray-50">
                Go to My Library
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Payment open (incomplete) or expired
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
          {courseSlug && (
            <Link href={`/checkout/${courseSlug}`}>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                Try Again
              </Button>
            </Link>
          )}
          <Link href="/library">
            <Button variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50">
              Back to Library
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
