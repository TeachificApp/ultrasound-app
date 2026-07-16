/**
 * WorkshopCheckout.tsx
 * Hosted checkout page for workshop registration.
 *
 * Route: /checkout/workshop/:slug?instance=<instanceId>
 *
 * Flow:
 *  1. Parse slug + instance query param
 *  2. Call workshopLearner.createEmbeddedCheckoutSession → get clientSecret (or free=true)
 *  3. Show workshop info on left, Stripe EmbeddedCheckout on right
 *  4. On free: show success immediately
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { trpc } from "@/lib/trpc";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Lock, ArrowLeft, AlertCircle, CheckCircle2, ShieldCheck,
} from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

export default function WorkshopCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const [location] = useLocation();

  const searchParams = useMemo(() => {
    const url = new URL(window.location.href);
    return {
      instanceId: url.searchParams.get("instance") ? Number(url.searchParams.get("instance")) : undefined,
    };
  }, [location]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [freeSuccess, setFreeSuccess] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<{
    workshopTitle: string;
    instanceTitle: string | null;
    workshopThumbnail: string | null;
    primaryColor: string;
    accentColor: string;
    productName: string;
    displayPrice: number;
    currency: string;
    termsUrl: string;
    privacyUrl: string;
    free: boolean;
  } | null>(null);

  const createSession = trpc.workshopLearner.createEmbeddedCheckoutSession.useMutation({
    onSuccess: (data) => {
      const { clientSecret: cs, free, ...meta } = data;
      setSessionMeta({ ...meta, free });
      if (free) {
        setFreeSuccess(true);
      } else {
        setClientSecret(cs);
      }
    },
  });

  const sessionStarted = useRef(false);
  useEffect(() => {
    if (!slug || !searchParams.instanceId || sessionStarted.current) return;
    sessionStarted.current = true;
    createSession.mutate({
      workshopSlug: slug,
      instanceId: searchParams.instanceId,
      origin: window.location.origin,
    });
  }, [slug, searchParams.instanceId]);

  const primary = sessionMeta?.primaryColor ?? "#189aa1";
  const stripeOptions = useMemo(() => (clientSecret ? { clientSecret } : undefined), [clientSecret]);

  const backHref = `/workshops/${slug}`;

  // ── Error state ───────────────────────────────────────────────────────────
  if (createSession.isError) {
    const msg = (createSession.error as any)?.message ?? "This workshop is not available for purchase right now.";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Registration Unavailable</h2>
          <p className="text-gray-500 text-sm mb-6">{msg}</p>
          <Link href={backHref}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Workshop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Free enrollment success ───────────────────────────────────────────────
  if (freeSuccess && sessionMeta) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-8 max-w-md w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">You're Registered!</h2>
          <p className="text-gray-500 text-sm mb-2">{sessionMeta.workshopTitle}</p>
          {sessionMeta.instanceTitle && (
            <p className="text-gray-400 text-xs mb-6">{sessionMeta.instanceTitle}</p>
          )}
          <Link href="/workshops">
            <Button className="gap-2 text-white" style={{ background: primary }}>
              View My Workshops
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={backHref}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Workshop
          </Link>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Lock className="h-3.5 w-3.5" />
            Secure checkout
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">

        {/* Left — workshop info */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Thumbnail */}
            {sessionMeta?.workshopThumbnail ? (
              <img
                src={sessionMeta.workshopThumbnail}
                alt={sessionMeta.workshopTitle}
                className="w-full h-44 object-cover"
              />
            ) : (
              <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, ${primary}, #0d9488)` }} />
            )}

            <div className="p-5">
              {createSession.isPending && !sessionMeta ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-5 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-8 bg-gray-100 rounded w-1/3 mt-4" />
                </div>
              ) : sessionMeta ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: primary }}>
                    Hands-On Workshop
                  </p>
                  <h1 className="text-xl font-bold text-gray-900 leading-snug mb-1">
                    {sessionMeta.workshopTitle}
                  </h1>
                  {sessionMeta.instanceTitle && (
                    <p className="text-sm text-gray-500 mb-3">{sessionMeta.instanceTitle}</p>
                  )}
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Registration fee</span>
                    <span className="text-2xl font-bold" style={{ color: primary }}>
                      {sessionMeta.displayPrice === 0
                        ? "Free"
                        : `$${sessionMeta.displayPrice.toLocaleString()}`}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>

        </div>

        {/* Right — Terms agreement + Stripe embedded checkout */}
        <div className="space-y-4">
          {/* Terms agreement card — above Stripe embed */}
          {sessionMeta && !sessionMeta.free && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800">
                <ShieldCheck className="h-4 w-4" style={{ color: primary }} />
                Before you proceed
              </h3>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(v) => setTermsAccepted(!!v)}
                  className="mt-0.5"
                  style={termsAccepted ? { backgroundColor: primary, borderColor: primary } : {}}
                />
                <Label htmlFor="terms" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                  I have reviewed and agree to the{" "}
                  <a
                    href={sessionMeta.termsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                    style={{ color: primary }}
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href={sessionMeta.privacyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                    style={{ color: primary }}
                  >
                    Privacy Policy
                  </a>
                  .
                </Label>
              </div>
              {!termsAccepted && (
                <p className="text-xs pt-1 text-gray-400">
                  Please agree to the Terms of Service and Privacy Policy to continue.
                </p>
              )}
            </div>
          )}

          {/* Stripe embedded checkout */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
            {createSession.isPending && !clientSecret ? (
              <div className="p-8 flex flex-col items-center justify-center min-h-[300px] gap-4">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: primary, borderTopColor: "transparent" }} />
                <p className="text-sm text-gray-400">Preparing secure checkout…</p>
              </div>
            ) : clientSecret && termsAccepted ? (
              <EmbeddedCheckoutProvider stripe={stripePromise} options={stripeOptions!}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            ) : clientSecret && !termsAccepted ? (
              <div className="p-8 flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
                <Lock className="w-10 h-10 text-gray-300" />
                <p className="text-sm text-gray-500 max-w-xs">
                  Please agree to the Terms of Service and Privacy Policy above to proceed to payment.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
