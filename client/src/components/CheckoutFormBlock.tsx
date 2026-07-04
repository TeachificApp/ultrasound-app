/**
 * CheckoutFormBlock.tsx
 * A full checkout form component for funnel pages.
 * Uses inline Stripe Elements (PaymentElement) for on-page payment.
 * Includes: contact info, product selection, billing address,
 * Stripe payment, order bumps, terms, and submit.
 */
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import PromoCodeInput from "@/components/PromoCodeInput";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2, Lock, ShoppingCart, CheckCircle2,
  Shield, Zap, Star, Heart, Gift, Award, ArrowRight,
  Sparkles, Rocket, BadgeCheck, ShoppingBag, CreditCard,
} from "lucide-react";

// ─── Submit icon renderer ────────────────────────────────────────────────────
function renderSubmitIcon(icon: string | undefined, size: number) {
  const s = icon ?? "none";
  if (s === "none") return null;
  if (s === "lock") return <Lock size={size} />;
  if (s === "shield") return <Shield size={size} />;
  if (s === "shopping-cart") return <ShoppingCart size={size} />;
  if (s === "shopping-bag") return <ShoppingBag size={size} />;
  if (s === "zap") return <Zap size={size} />;
  if (s === "star") return <Star size={size} />;
  if (s === "heart") return <Heart size={size} />;
  if (s === "gift") return <Gift size={size} />;
  if (s === "award") return <Award size={size} />;
  if (s === "arrow-right") return <ArrowRight size={size} />;
  if (s === "sparkles") return <Sparkles size={size} />;
  if (s === "rocket") return <Rocket size={size} />;
  if (s === "badge-check") return <BadgeCheck size={size} />;
  if (s === "credit-card") return <CreditCard size={size} />;
  return null;
}

// Load Stripe outside of component to avoid re-creating on every render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckoutProduct {
  name: string;
  description: string;
  price: number; // dollars
  imageUrl: string;
  type: string; // "course" | "quiz" | "product" | "external"
  strikethroughPrice?: string; // display-only original price, e.g. "$97"
}

interface OrderBump {
  title: string;
  headline: string;
  description: string;
  price: number; // dollars
  imageUrl: string;
  ctaText: string;
  ctaEmoji: string;
  externalUrl: string;
}

interface CheckoutFormData {
  displayMode: "inline" | "standalone";
  headerText: string;
  headerPrice: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  showContactInfo: boolean;
  showPhone?: boolean;       // default true — show phone field
  requirePhone?: boolean;    // default false — require phone field
  showBillingInfo: boolean;
  showProductSelect: boolean;
  products: CheckoutProduct[];
  orderBumps: OrderBump[];
  termsText: string;
  termsLinkText: string;
  termsLinkUrl: string;
  submitText: string;
  submitIcon?: "none" | "lock" | "shield" | "shopping-cart" | "shopping-bag" | "zap" | "star" | "heart" | "gift" | "award" | "arrow-right" | "sparkles" | "rocket" | "badge-check" | "credit-card";
  successRedirect: string;
}

interface CheckoutFormBlockProps {
  data: Record<string, any>;
  funnelId: number;
  pageId: number;
  funnelSlug: string;
}

// ─── Contact & Product Selection Step ────────────────────────────────────────

function CheckoutFormInner({ data, funnelId, pageId, funnelSlug }: CheckoutFormBlockProps) {
  const d = data as unknown as CheckoutFormData;
  const { user, logout } = useAuth();

  // Auto-populate priority: logged-in user > URL params > sessionStorage funnel_lead > empty
  const savedLead = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlName = params.get("name") ?? "";
      const urlEmail = params.get("email") ?? "";
      if (urlName || urlEmail) return { name: urlName, email: urlEmail };
      return JSON.parse(sessionStorage.getItem("funnel_lead") ?? "null") ?? {};
    } catch { return {}; }
  })();

  // Derive initial values — logged-in user takes highest priority
  const initFirstName = user?.firstName ?? user?.displayName?.split(" ")[0] ?? user?.name?.split(" ")[0] ?? savedLead.name?.split(" ")[0] ?? "";
  const initLastName = user?.lastName ?? user?.displayName?.split(" ").slice(1).join(" ") ?? user?.name?.split(" ").slice(1).join(" ") ?? savedLead.name?.split(" ").slice(1).join(" ") ?? "";
  const initEmail = user?.email ?? savedLead.email ?? "";

  const [firstName, setFirstName] = useState(initFirstName);
  const [lastName, setLastName] = useState(initLastName);
  const [email, setEmail] = useState(initEmail);

  // Sync state when user auth loads (handles async auth resolution)
  useEffect(() => {
    if (user) {
      const fn = user.firstName ?? user.displayName?.split(" ")[0] ?? user.name?.split(" ")[0] ?? "";
      const ln = user.lastName ?? user.displayName?.split(" ").slice(1).join(" ") ?? user.name?.split(" ").slice(1).join(" ") ?? "";
      if (fn) setFirstName(fn);
      if (ln) setLastName(ln);
      if (user.email) setEmail(user.email);
    }
  }, [user?.id]);

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [address2, setAddress2] = useState("");
  const [country, setCountry] = useState("United States");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [selectedProductIdx, setSelectedProductIdx] = useState(0);
  const [addedBumps, setAddedBumps] = useState<Set<number>>(new Set());
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);

  // Payment intent state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const products = d.products ?? [];
  const orderBumps = d.orderBumps ?? [];
  const accent = d.accentColor ?? "#179ca3";

  const selectedProduct = products[selectedProductIdx];
  const totalPrice = useMemo(() => {
    let total = selectedProduct?.price ?? 0;
    addedBumps.forEach((idx) => {
      if (orderBumps[idx]) total += orderBumps[idx].price;
    });
    return total;
  }, [selectedProductIdx, addedBumps, products, orderBumps]);

  const createPaymentIntent = trpc.funnelPublic.createFunnelPaymentIntent.useMutation({
    onError: (e: any) => toast.error(e.message || "Failed to initialize payment"),
  });

  // Fallback to redirect checkout
  const createCheckout = trpc.funnelPublic.createFunnelFormCheckout.useMutation({
    onError: (e: any) => toast.error(e.message || "Checkout failed"),
  });

  const processFreeOrder = trpc.embeddedCheckout.processFreeOrder.useMutation({
    onError: (e: any) => toast.error(e.message || "Failed to process order"),
  });

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted && d.termsText) {
      toast.error("Please accept the terms to continue");
      return;
    }
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    // ── Free order: skip Stripe entirely ──
    if (totalPrice === 0) {
      setIsCreatingIntent(true);
      try {
        const selectedProduct = products[selectedProductIdx];
        const result = await processFreeOrder.mutateAsync({
          email,
          firstName: firstName || undefined,
          lastName:  lastName  || undefined,
          phone:     phone     || undefined,
          productName:  selectedProduct?.name ?? "Free Product",
          productType:  (selectedProduct?.type as any) ?? "other",
          productId:    (selectedProduct as any)?.productId ?? undefined,
          sourceType: "funnel",
          sourceFunnelId: funnelId,
          sourceFunnelPageId: pageId,
          successRedirect: d.successRedirect,
          origin: window.location.origin,
          lmsCourseId: (d as any).lmsCourseId,
          fulfillmentBrand: (d as any).fulfillmentBrand,
          additionalAccess: (d as any).additionalAccess ?? undefined,
        });
        setSuccessUrl(result.successUrl);
        setPaymentSuccess(true);
      } catch {
        // Error handled by mutation onError
      } finally {
        setIsCreatingIntent(false);
      }
      return;
    }

    setIsCreatingIntent(true);
    try {
      const result = await createPaymentIntent.mutateAsync({
        funnelId,
        pageId,
        origin: window.location.origin,
        email,
        firstName,
        lastName,
        phone,
        selectedProductIndex: selectedProductIdx,
        addedBumpIndexes: Array.from(addedBumps),
        billingAddress: d.showBillingInfo ? { address, address2, country, state, city, postalCode } : undefined,
        promoCode: promoCode || undefined,
      });

      setClientSecret(result.clientSecret ?? null);
      setSuccessUrl(result.successUrl ?? null);
    } catch {
      // Error handled by mutation onError
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const toggleBump = (idx: number) => {
    const next = new Set(addedBumps);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setAddedBumps(next);
  };

  // If payment succeeded, show success message
  if (paymentSuccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 px-4" style={{ color: d.textColor ?? "#0e1e2e" }}>
        <CheckCircle2 size={64} className="mx-auto mb-4" style={{ color: accent }} />
        <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
        <p className="text-gray-600 mb-6">Thank you for your purchase. You will receive a confirmation email shortly.</p>
        {successUrl && (
          <a
            href={successUrl}
            className="inline-block px-8 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Continue
          </a>
        )}
      </div>
    );
  }

  // If we have a clientSecret, show the Stripe PaymentElement
  if (clientSecret) {
    return (
      <div className="max-w-2xl mx-auto px-4" style={{ color: d.textColor ?? "#0e1e2e" }}>
        {/* Header Banner */}
        <div
          className="rounded-lg px-6 py-4 mb-6 text-center text-white font-bold text-lg flex items-center justify-center gap-2"
          style={{ backgroundColor: accent }}
        >
          <span>Complete Your Payment — ${Number(totalPrice).toFixed(2)}</span>
        </div>

        {/* Order Summary */}
        <div className="border border-gray-200 rounded-lg mb-6 p-4 space-y-2 text-sm">
          {selectedProduct && (
            <div className="flex justify-between">
              <span className="font-medium">{selectedProduct.name}</span>
              <span className="font-medium">${Number(selectedProduct.price).toFixed(2)}</span>
            </div>
          )}
          {Array.from(addedBumps).map((idx) => {
            const bump = orderBumps[idx];
            if (!bump) return null;
            return (
              <div key={idx} className="flex justify-between text-gray-600">
                <span>{bump.title}</span>
                <span>${Number(bump.price).toFixed(2)}</span>
              </div>
            );
          })}
          <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-2">
            <span>Total</span>
            <span>${Number(totalPrice).toFixed(2)}</span>
          </div>
        </div>

        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: accent,
                fontFamily: "Inter, system-ui, sans-serif",
              },
            },
          }}
        >
          <PaymentStep
            accent={accent}
            submitText={d.submitText ?? "Pay Now"}
            submitIcon={d.submitIcon}
            successUrl={successUrl}
            onSuccess={() => setPaymentSuccess(true)}
          />
        </Elements>

        <button
          type="button"
          onClick={() => setClientSecret(null)}
          className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
        >
          ← Back to order details
        </button>
      </div>
    );
  }

  // Step 1: Contact info, product selection, bumps
  return (
    <form onSubmit={handleProceedToPayment} className="max-w-2xl mx-auto" style={{ color: d.textColor ?? "#0e1e2e" }}>
      {/* Header Banner */}
      <div
        className="rounded-lg px-6 py-4 mb-6 text-center text-white font-bold text-lg flex items-center justify-center gap-2"
        style={{ backgroundColor: accent }}
      >
        <span>{d.headerText ?? "Lock in your seat now!"} {d.headerPrice ?? ""}</span>
      </div>

      {/* Contact Information */}
      {d.showContactInfo !== false && (
        <fieldset className="border border-gray-300 rounded-lg p-5 mb-5">
          <legend className="text-xs font-bold tracking-wider text-gray-600 px-2 uppercase">Contact Information</legend>
          {/* Logged-in user notice */}
          {user && (
            <div className="mb-3 flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
              <span>Purchasing as <strong>{user.email}</strong></span>
              <button
                type="button"
                onClick={logout}
                className="ml-auto text-xs text-teal-600 underline hover:text-teal-800 whitespace-nowrap"
              >
                Log out to use a different email
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => !user && setFirstName(e.target.value)}
              readOnly={!!user}
              className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${user ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => !user && setLastName(e.target.value)}
              readOnly={!!user}
              className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${user ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
            />
          </div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => !user && setEmail(e.target.value)}
            readOnly={!!user}
            required
            className={`w-full border border-gray-200 rounded-lg px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-teal-400 ${user ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
          />
          {d.showPhone !== false && (
            <input
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required={d.requirePhone === true}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          )}
        </fieldset>
      )}

      {/* Product Selection */}
      {d.showProductSelect !== false && products.length > 0 && (
        <fieldset className="border border-gray-300 rounded-lg p-5 mb-5">
          <legend className="text-xs font-bold tracking-wider text-gray-600 px-2 uppercase">Select Product</legend>
          <div className="space-y-3">
            {products.map((product, idx) => (
              <label
                key={idx}
                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                  selectedProductIdx === idx ? "border-teal-500 bg-teal-50/30" : "border-transparent hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="product"
                  checked={selectedProductIdx === idx}
                  onChange={() => setSelectedProductIdx(idx)}
                  className="w-4 h-4 accent-teal-600"
                />
                {product.imageUrl && (
                  <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-sm">{product.name}</div>
                  <div className="text-xs text-gray-500">{product.description}</div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {(product as any).strikethroughPrice && (
                    <span className="text-xs font-medium text-red-500 line-through leading-none">{(product as any).strikethroughPrice}</span>
                  )}
                  <span className="font-medium text-sm">${Number(product.price).toFixed(2)}</span>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Billing Information */}
      {d.showBillingInfo && (
        <fieldset className="border border-gray-300 rounded-lg p-5 mb-5">
          <legend className="text-xs font-bold tracking-wider text-gray-600 px-2 uppercase">Billing Information</legend>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <input
              type="text"
              placeholder="Apartment, building, floor (optional)"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                <option>United States</option>
                <option>Canada</option>
                <option>United Kingdom</option>
                <option>Australia</option>
                <option>Other</option>
              </select>
              <input
                type="text"
                placeholder="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <input
                type="text"
                placeholder="Postal Code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>
        </fieldset>
      )}

      {/* Order Bumps */}
      {orderBumps.length > 0 && (
        <div className="space-y-4 mb-5">
          {orderBumps.map((bump, idx) => (
            <div
              key={idx}
              className={`border-2 rounded-lg p-4 flex items-start gap-4 transition-colors ${
                addedBumps.has(idx) ? "bg-teal-50/30" : ""
              }`}
              style={{ borderColor: accent }}
            >
              {bump.imageUrl && (
                <img src={bump.imageUrl} alt="" className="w-24 h-32 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight">{bump.headline}</p>
                <p className="text-sm font-semibold mt-1">{bump.title}</p>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{bump.description}</p>
                {bump.ctaEmoji && (
                  <p className="text-xs mt-2 font-medium" style={{ color: accent }}>
                    {bump.ctaEmoji} {bump.externalUrl
                      ? <a href={bump.externalUrl} target="_blank" rel="noopener noreferrer" className="underline">Learn more</a>
                      : `Add the ${bump.title} to your order`
                    }
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold" style={{ color: accent }}>
                  ${Number(bump.price).toFixed(2)}
                </p>
                <button
                  type="button"
                  onClick={() => toggleBump(idx)}
                  className={`mt-2 px-5 py-2 border-2 rounded-lg font-semibold text-sm transition-colors ${
                    addedBumps.has(idx)
                      ? "text-white"
                      : ""
                  }`}
                  style={{
                    borderColor: accent,
                    color: addedBumps.has(idx) ? "#fff" : accent,
                    backgroundColor: addedBumps.has(idx) ? accent : "transparent",
                  }}
                >
                  {addedBumps.has(idx) ? "Added \u2713" : (bump.ctaText || "+ Add")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="border border-gray-200 rounded-lg mb-5">
        <button
          type="button"
          onClick={() => setShowSummary(!showSummary)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-lg"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart size={14} />
            Summary
          </span>
          <span className="text-xs text-gray-500">
            {showSummary ? "Hide" : "For more details, fill the form"} \u25BE
          </span>
        </button>
        {showSummary && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2 text-sm">
            {selectedProduct && (
              <div className="flex justify-between">
                <span>{selectedProduct.name}</span>
                <span className="font-medium">${Number(selectedProduct.price).toFixed(2)}</span>
              </div>
            )}
            {Array.from(addedBumps).map((idx) => {
              const bump = orderBumps[idx];
              if (!bump) return null;
              return (
                <div key={idx} className="flex justify-between text-gray-600">
                  <span>{bump.title}</span>
                  <span>${Number(bump.price).toFixed(2)}</span>
                </div>
              );
            })}
            <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-2">
              <span>Total</span>
              <span>${Number(totalPrice).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Promo Code */}
      <PromoCodeInput onApply={(code, _) => setPromoCode(code)} />

      {/* Terms */}
      {d.termsText && (
        <label className="flex items-start gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 w-4 h-4 rounded accent-teal-600"
          />
          <span className="text-sm text-gray-700">
            {d.termsText}{" "}
            {d.termsLinkUrl && (
              <a href={d.termsLinkUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline" style={{ color: accent }}>
                {d.termsLinkText || "TERMS OF SERVICE"}
              </a>
            )}
          </span>
        </label>
      )}

      {/* Proceed to Payment Button */}
      <button
        type="submit"
        disabled={isCreatingIntent}
        className="w-full py-4 rounded-lg font-bold text-white text-lg transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ backgroundColor: accent }}
      >
        {isCreatingIntent && <Loader2 size={20} className="animate-spin" />}
        {isCreatingIntent
          ? (totalPrice === 0 ? "Processing..." : "Preparing Payment...")
          : totalPrice === 0
            ? (d.submitText || "Complete Order")
            : `Proceed to Payment — $${Number(totalPrice).toFixed(2)}`
        }
      </button>
    </form>
  );
}

// ─── Payment Step (Stripe PaymentElement) ───────────────────────────────────

function PaymentStep({
  accent,
  submitText,
  submitIcon,
  successUrl,
  onSuccess,
}: {
  accent: string;
  submitText: string;
  submitIcon?: string;
  successUrl: string | null;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: successUrl || window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        setPaymentError(error.message || "Payment failed. Please try again.");
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        toast.success("Payment successful!");
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === "requires_action") {
        // 3D Secure or other action — Stripe handles this automatically
        toast.info("Additional verification required...");
      }
    } catch (err: any) {
      setPaymentError(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handlePayment}>
      <div className="border border-gray-200 rounded-lg p-5 mb-5">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {paymentError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {paymentError}
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full py-4 rounded-lg font-bold text-white text-lg transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ backgroundColor: accent }}
      >
        {isProcessing && <Loader2 size={20} className="animate-spin" />}
        {!isProcessing && renderSubmitIcon(submitIcon, 20)}
        {isProcessing ? "Processing..." : submitText}
      </button>

      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-400">
        <Lock size={12} />
        <span>Secured by Stripe. Your payment information is encrypted.</span>
      </div>
    </form>
  );
}

// ─── Wrapper ────────────────────────────────────────────────────────────────

export default function CheckoutFormBlock(props: CheckoutFormBlockProps) {
  return (
    <div className="px-4 py-10" style={{ backgroundColor: props.data.bgColor ?? "#ffffff" }}>
      <CheckoutFormInner {...props} />
    </div>
  );
}
