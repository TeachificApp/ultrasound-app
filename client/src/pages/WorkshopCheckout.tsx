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
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Lock, ArrowLeft, AlertCircle, Bell, CheckCircle2, ShieldCheck,
} from "lucide-react";
import { formatWorkshopDollars } from "../../../shared/workshopPricing";
import { AvailabilityWaitlistDialog } from "@/components/AvailabilityWaitlistDialog";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

export function WorkshopCheckoutClosedState({ title, backHref }: { title: string; backHref: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Enrollment Closed</h2>
        <p className="text-gray-500 text-sm mb-6">Registration for {title} is closed. Payment is not available for this session.</p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button data-testid="workshop-checkout-closed-cta" disabled variant="outline">Enrollment Closed</Button>
          <Link href={backHref}><Button variant="outline">Back to Workshop</Button></Link>
        </div>
      </div>
    </div>
  );
}

export default function WorkshopCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const [location] = useLocation();
  const { user } = useAuth();

  const searchParams = useMemo(() => {
    const url = new URL(window.location.href);
    return {
      instanceId: url.searchParams.get("instance") ? Number(url.searchParams.get("instance")) : undefined,
    };
  }, [location]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  // Stripe collects the payer; learner access is confirmed alongside payment.
  const [learnerIsPayee, setLearnerIsPayee] = useState(true);
  const [payerEmail, setPayerEmail] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [learnerEmail, setLearnerEmail] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
  const [checkoutAttempt, setCheckoutAttempt] = useState(0);
  const activeSessionKeyRef = useRef<string | null>(null);
  const [freeSuccess, setFreeSuccess] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<{
    workshopTitle: string;
    instanceTitle: string | null;
    workshopThumbnail: string | null;
    primaryColor: string;
    accentColor: string;
    productName: string;
    displayPrice: number | string;
    currency: string;
    termsUrl: string;
    privacyUrl: string;
    checkoutTermsText: string;
    checkoutTermsLink1Text: string;
    checkoutTermsLink1Url: string;
    checkoutTermsLink2Text: string;
    checkoutTermsLink2Url: string;
    free: boolean;
    availabilityStatus?: "waitlist" | "enrollment_closed";
  } | null>(null);

  const createSession = trpc.workshopLearner.createEmbeddedCheckoutSession.useMutation();
  // Public workshop data is deliberately loaded separately from the payment
  // session. A guest can therefore review the image, session, price, and terms
  // before entering an email, and a recoverable checkout error never erases it.
  const workshopPresentationQuery = trpc.workshop.getBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: Boolean(slug) },
  );
  const selectedInstance = useMemo(() => (
    workshopPresentationQuery.data?.allInstances?.find((instance: any) => instance.id === searchParams.instanceId) ?? null
  ), [workshopPresentationQuery.data, searchParams.instanceId]);
  const presentation = sessionMeta ?? (workshopPresentationQuery.data?.workshop && selectedInstance ? {
    workshopTitle: workshopPresentationQuery.data.workshop.title,
    instanceTitle: selectedInstance.title ?? null,
    workshopThumbnail: workshopPresentationQuery.data.workshop.thumbnailUrl ?? null,
    primaryColor: workshopPresentationQuery.data.workshop.primaryColor ?? "#179ca3",
    accentColor: workshopPresentationQuery.data.workshop.accentColor ?? "#0d9488",
    productName: `${workshopPresentationQuery.data.workshop.title} — ${selectedInstance.title ?? workshopPresentationQuery.data.workshop.title}`,
    displayPrice: selectedInstance.price ?? workshopPresentationQuery.data.workshop.price ?? 0,
    currency: workshopPresentationQuery.data.workshop.currency ?? "usd",
    termsUrl: workshopPresentationQuery.data.checkoutTerms?.termsUrl ?? "https://www.allaboutultrasound.com/terms",
    privacyUrl: workshopPresentationQuery.data.checkoutTerms?.privacyUrl ?? "https://www.allaboutultrasound.com/privacy-policy.html",
    checkoutTermsText: workshopPresentationQuery.data.checkoutTerms?.checkoutTermsText ?? "I have reviewed and agree to the",
    checkoutTermsLink1Text: workshopPresentationQuery.data.checkoutTerms?.checkoutTermsLink1Text ?? "Terms of Service",
    checkoutTermsLink1Url: workshopPresentationQuery.data.checkoutTerms?.checkoutTermsLink1Url ?? "https://www.allaboutultrasound.com/terms",
    checkoutTermsLink2Text: workshopPresentationQuery.data.checkoutTerms?.checkoutTermsLink2Text ?? "Privacy Policy",
    checkoutTermsLink2Url: workshopPresentationQuery.data.checkoutTerms?.checkoutTermsLink2Url ?? "https://www.allaboutultrasound.com/privacy-policy.html",
    free: false,
  } : null);
  const friendlyCheckoutError = createSession.isError
    ? "We could not prepare secure checkout just yet. Your workshop details and registration form are still available—please try again."
    : null;
  const retryCheckout = () => {
    createSession.reset();
    invalidateEmbeddedSession();
    setCheckoutAttempt((attempt) => attempt + 1);
  };
  useEffect(() => {
    const knownEmail = (user as any)?.email?.trim().toLowerCase();
    if (knownEmail && !payerEmail) setPayerEmail(knownEmail);
  }, [user, payerEmail]);
  const hasValidPayerEmail = /^\S+@\S+\.\S+$/.test(payerEmail.trim());
  const hasValidLearnerDetails = hasValidPayerEmail && (learnerIsPayee || (learnerName.trim().length > 1 && /^\S+@\S+\.\S+$/.test(learnerEmail.trim())));
  const checkoutSessionKey = [slug ?? "", searchParams.instanceId ?? "", payerEmail.trim().toLowerCase(), learnerIsPayee ? "payer" : `${learnerName.trim()}|${learnerEmail.trim().toLowerCase()}`].join(":");
  const invalidateEmbeddedSession = () => {
    activeSessionKeyRef.current = null;
    setActiveSessionKey(null);
    setClientSecret(null);
    setSessionMeta(null);
    setFreeSuccess(false);
  };
  useEffect(() => {
    if (!slug || !searchParams.instanceId || !hasValidLearnerDetails || activeSessionKey === checkoutSessionKey || activeSessionKeyRef.current === checkoutSessionKey) return;
    const timeout = window.setTimeout(() => {
      activeSessionKeyRef.current = checkoutSessionKey;
      setActiveSessionKey(checkoutSessionKey);
      setClientSecret(null);
      setSessionMeta(null);
      setFreeSuccess(false);
      createSession.mutate({
        workshopSlug: slug,
        instanceId: searchParams.instanceId,
        origin: window.location.origin,
        payerEmail: payerEmail.trim().toLowerCase(),
        ...(!learnerIsPayee ? { recipientName: learnerName.trim(), recipientEmail: learnerEmail.trim().toLowerCase() } : {}),
      }, { onSuccess: (data) => {
        if (activeSessionKeyRef.current !== checkoutSessionKey) return;
        if (data.alreadyEnrolled && data.accessUrl) {
          window.location.href = data.accessUrl;
          return;
        }
        const { clientSecret: cs, free, ...meta } = data;
        setSessionMeta({ ...meta, free });
        if (free) setFreeSuccess(true);
        else setClientSecret(cs);
      }});
    }, learnerIsPayee ? 0 : 350);
    return () => window.clearTimeout(timeout);
  }, [slug, searchParams.instanceId, learnerIsPayee, payerEmail, learnerName, learnerEmail, hasValidLearnerDetails, checkoutSessionKey, activeSessionKey, checkoutAttempt]);

  const primary = presentation?.primaryColor ?? "#189aa1";
  const stripeOptions = useMemo(() => (clientSecret ? { clientSecret } : undefined), [clientSecret]);

  const backHref = `/workshops/${slug}`;

  // The public workshop response knows availability before any payer details are
  // entered. Honor it immediately rather than creating a Stripe session simply
  // to discover that registration is closed or waitlisted.
  if ((selectedInstance as any)?.status === "waitlist") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-8 max-w-md w-full text-center">
          <Bell className="h-12 w-12 text-teal-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Join the Waitlist</h2>
          <p className="text-gray-500 text-sm mb-6">{(selectedInstance as any).title ?? "This workshop session"} is not currently open for registration. Share your name and email and we’ll notify you when enrolment opens.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button className="text-white" style={{ background: primary }} onClick={() => setWaitlistOpen(true)}>Join Waitlist</Button>
            <Link href={backHref}><Button variant="outline">Back to Workshop</Button></Link>
          </div>
          <AvailabilityWaitlistDialog
            open={waitlistOpen}
            onClose={() => setWaitlistOpen(false)}
            productType="workshop_instance"
            productId={searchParams.instanceId ?? 0}
            title={(selectedInstance as any).title ?? "Workshop session"}
          />
        </div>
      </div>
    );
  }

  if ((selectedInstance as any)?.status === "enrollment_closed") {
    return <WorkshopCheckoutClosedState title={(selectedInstance as any).title ?? "This workshop session"} backHref={backHref} />;
  }


  // Restricted workshop instances never receive a Stripe client secret. Keep users
  // on a clear availability screen so Waitlist capture and closed enrollment cannot
  // fall through into a payment form.
  if (sessionMeta?.availabilityStatus === "waitlist") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-8 max-w-md w-full text-center">
          <Bell className="h-12 w-12 text-teal-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Join the Waitlist</h2>
          <p className="text-gray-500 text-sm mb-6">{sessionMeta.instanceTitle ?? sessionMeta.workshopTitle} is not currently open for registration. Share your name and email and we’ll notify you when enrolment opens.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button className="text-white" style={{ background: sessionMeta.primaryColor }} onClick={() => setWaitlistOpen(true)}>Join Waitlist</Button>
            <Link href={backHref}><Button variant="outline">Back to Workshop</Button></Link>
          </div>
          <AvailabilityWaitlistDialog
            open={waitlistOpen}
            onClose={() => setWaitlistOpen(false)}
            productType="workshop_instance"
            productId={searchParams.instanceId ?? 0}
            title={sessionMeta.instanceTitle ?? sessionMeta.workshopTitle}
          />
        </div>
      </div>
    );
  }

  if (sessionMeta?.availabilityStatus === "enrollment_closed") {
    return <WorkshopCheckoutClosedState title={sessionMeta.instanceTitle ?? sessionMeta.workshopTitle} backHref={backHref} />;
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
            {presentation?.workshopThumbnail ? (
              <img
                src={presentation.workshopThumbnail}
                alt={presentation.workshopTitle}
                className="w-full h-44 object-cover"
              />
            ) : (
              <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, ${primary}, #0d9488)` }} />
            )}

            <div className="p-5">
              {workshopPresentationQuery.isLoading && !presentation ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-5 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-8 bg-gray-100 rounded w-1/3 mt-4" />
                </div>
              ) : presentation ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: primary }}>
                    Hands-On Workshop
                  </p>
                  <h1 className="text-xl font-bold text-gray-900 leading-snug mb-1">
                    {presentation.workshopTitle}
                  </h1>
                  {presentation.instanceTitle && (
                    <p className="text-sm text-gray-500 mb-3">{presentation.instanceTitle}</p>
                  )}
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Registration fee</span>
                    <span className="text-2xl font-bold" style={{ color: primary }}>
                      {formatWorkshopDollars(presentation.displayPrice, presentation.currency)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>

        </div>

        {/* Right — learner assignment, terms, and embedded Stripe checkout */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-base font-semibold text-gray-900">Checkout details</h3>
            <div className="mt-3 grid gap-2">
              <Label htmlFor="workshop-payer-email">Payer email</Label>
              <Input id="workshop-payer-email" value={payerEmail} onChange={(event) => { setPayerEmail(event.target.value); invalidateEmbeddedSession(); }} placeholder="payer@email.com" type="email" autoComplete="email" required />
              <p className="text-xs leading-relaxed text-gray-500">Your Stripe receipt is sent here. We use it to recognize an existing registration before payment.</p>
            </div>
            <p className="mt-4 text-sm text-gray-500">Will the learner use the same name and email as the payer?</p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Learner and payer relationship">
              <button type="button" aria-pressed={learnerIsPayee} onClick={() => { if (!learnerIsPayee) { setLearnerIsPayee(true); invalidateEmbeddedSession(); } }} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${learnerIsPayee ? "border-teal-600 bg-teal-50 text-teal-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Yes, same learner</button>
              <button type="button" aria-pressed={!learnerIsPayee} onClick={() => { if (learnerIsPayee) { setLearnerIsPayee(false); invalidateEmbeddedSession(); } }} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${!learnerIsPayee ? "border-teal-600 bg-teal-50 text-teal-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>No, another learner</button>
            </div>
            {!learnerIsPayee && (
              <div className="mt-4 grid gap-3">
                <Input value={learnerName} onChange={(event) => { setLearnerName(event.target.value); invalidateEmbeddedSession(); }} placeholder="Learner full name" autoComplete="name" required />
                <Input value={learnerEmail} onChange={(event) => { setLearnerEmail(event.target.value); invalidateEmbeddedSession(); }} placeholder="Learner email" type="email" autoComplete="email" required />
                <p className="text-xs leading-relaxed text-gray-500">The payer receives the Stripe receipt. The learner receives workshop registration details and access.</p>
              </div>
            )}
          </div>
          {/* Terms and workshop policy are visible before a guest enters an email. */}
          {presentation && !presentation.free && (
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
                <label htmlFor="terms" className="text-sm text-gray-700 leading-relaxed cursor-pointer flex-1">
                  <span className="block [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic">
                    {presentation.checkoutTermsText && /^\s*</.test(presentation.checkoutTermsText)
                      ? <span dangerouslySetInnerHTML={{ __html: presentation.checkoutTermsText }} />
                      : <>{presentation.checkoutTermsText}</>}
                  </span>
                  {(presentation.checkoutTermsLink1Text && presentation.checkoutTermsLink1Url) || (presentation.checkoutTermsLink2Text && presentation.checkoutTermsLink2Url) ? (
                    <span className="block mt-2">
                      {presentation.checkoutTermsLink1Text && presentation.checkoutTermsLink1Url && (
                        <a href={presentation.checkoutTermsLink1Url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: primary }} onClick={e => e.stopPropagation()}>
                          {presentation.checkoutTermsLink1Text}
                        </a>
                      )}
                      {presentation.checkoutTermsLink2Text && presentation.checkoutTermsLink2Url && (
                        <>{" "}and{" "}
                        <a href={presentation.checkoutTermsLink2Url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: primary }} onClick={e => e.stopPropagation()}>
                          {presentation.checkoutTermsLink2Text}
                        </a></>
                      )}
                    </span>
                  ) : null}
                </label>
              </div>
              {!termsAccepted && (
                <p className="text-xs pt-1 text-gray-400">
                  Please agree to the Terms of Service and Privacy Policy to continue.
                </p>
              )}
            </div>
          )}

          {friendlyCheckoutError && (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div className="min-w-0">
                  <p className="font-semibold">Secure checkout needs a refresh</p>
                  <p className="mt-1 leading-5">{friendlyCheckoutError}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3 border-amber-300 bg-white text-amber-950 hover:bg-amber-100" onClick={retryCheckout} disabled={createSession.isPending || !hasValidLearnerDetails}>Try secure checkout again</Button>
                </div>
              </div>
            </div>
          )}

          {/* Stripe embedded checkout stays gated only by valid identity and consent. */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
            {!hasValidLearnerDetails ? (
              <div className="p-8 flex min-h-[300px] flex-col items-center justify-center text-center">
                <ShieldCheck className="mx-auto h-10 w-10" style={{ color: primary }} />
                <h4 className="mt-4 text-base font-semibold text-gray-900">Add the learner’s details</h4>
                <p className="mt-2 max-w-sm text-sm text-gray-500">Enter the payer and learner details above to load secure payment. Workshop details, policy, and registration requirements remain visible while you do.</p>
              </div>
            ) : createSession.isPending && !clientSecret ? (
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
            ) : (
              <div className="p-8 flex min-h-[300px] flex-col items-center justify-center text-center">
                <ShieldCheck className="mx-auto h-10 w-10" style={{ color: primary }} />
                <p className="mt-3 text-sm text-gray-500">Complete the registration details above to continue securely.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
