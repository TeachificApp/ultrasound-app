/**
 * InlineCheckoutBlock.tsx
 *
 * A fully embedded inline Stripe checkout form that matches the layout in the
 * design reference:
 *   Header banner → Contact Info → Product Selector → Billing Address (optional)
 *   → Payment Info (CardElement) → Order Bumps (animated) → Summary → Terms → Submit
 *
 * This component is used as a content block in all page builders.
 * Uses Stripe CardElement (not PaymentElement) for the classic inline card fields.
 * All purchases are recorded to funnelPurchases via embeddedCheckout.createPaymentIntent.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { trpc } from "@/lib/trpc";
import PromoCodeInput from "@/components/PromoCodeInput";
import { toast } from "sonner";
import {
  Lock, CheckCircle2, Plus, Minus, ChevronDown, ChevronUp,
  ShoppingCart, Loader2, CreditCard, Shield, Zap, Star, Heart,
  Gift, Award, ArrowRight, Sparkles, Rocket, BadgeCheck, ShoppingBag
} from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InlineCheckoutProduct {
  name: string;
  description: string;
  price: number;          // dollars
  imageUrl?: string;
  type?: string;          // "course" | "download" | "physical" | "membership" | "other"
}

export interface InlineCheckoutOrderBump {
  title: string;
  headline: string;
  description: string;
  price: number;          // dollars
  imageUrl?: string;
  ctaText?: string;
  ctaEmoji?: string;
  animation?: "none" | "pulse" | "glow" | "shake" | "bounce";
}

/** A bonus access item granted at no extra charge after payment */
export interface AdditionalAccessItem {
  /** Human-readable label shown in the editor */
  label: string;
  /** "course" | "download" | "physical" | "membership" */
  type: "course" | "download" | "physical" | "membership";
  /** DB product/course ID (for course/download/physical) */
  productId?: number;
  /** Brand slug for membership grants: "aaus" | "iheartecho" | "both" */
  brand?: "aaus" | "iheartecho" | "both";
}

export interface InlineCheckoutBlockData {
  // Header
  headerText?: string;
  headerPrice?: string;
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  // Sections
  showContactInfo?: boolean;
  showPhone?: boolean;              // default true — show phone field
  requirePhone?: boolean;           // default false — require phone field
  showBillingInfo?: boolean;        // address section
  collectShipping?: boolean;        // shipping address (physical products)
  showProductSelect?: boolean;
  products?: InlineCheckoutProduct[];
  orderBumps?: InlineCheckoutOrderBump[];
  // Terms
  termsText?: string;
  termsLinkText?: string;
  termsLinkUrl?: string;
  // Submit
  submitText?: string;
  submitIcon?: "none" | "lock" | "shield" | "shopping-cart" | "shopping-bag" | "zap" | "star" | "heart" | "gift" | "award" | "arrow-right" | "sparkles" | "rocket" | "badge-check" | "credit-card";
  successRedirect?: string;
  // Source context
  sourceType?: "funnel" | "landing_page" | "product_page" | "lms_lesson" | "other";
  sourceFunnelId?: number;
  sourceLandingPageId?: number;
  // Additional access items granted at no extra charge after payment
  additionalAccess?: AdditionalAccessItem[];
  // Legacy single-item fulfillment fields (deprecated — use additionalAccess)
  lmsCourseId?: number;
  fulfillmentBrand?: "aaus" | "iheartecho" | "both";
}

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

// ─── CSS animation classes (defined in index.css) ─────────────────────────────
const BUMP_ANIMATION_CLASS: Record<string, string> = {
  none:   "",
  pulse:  "order-bump-pulse",
  glow:   "order-bump-glow",
  shake:  "order-bump-shake",
  bounce: "order-bump-bounce",
};

// ─── Stripe card element shared appearance ────────────────────────────────────
const CARD_ELEMENT_STYLE = {
  base: {
    fontSize: "14px",
    color: "#0e1e2e",
    fontFamily: "'Inter', sans-serif",
    "::placeholder": { color: "#9ca3af" },
  },
  invalid: { color: "#ef4444" },
};

// ─── Country list ─────────────────────────────────────────────────────────────
const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "New Zealand",
  "Germany", "France", "Netherlands", "Sweden", "Norway", "Denmark",
  "Switzerland", "Austria", "Belgium", "Ireland", "Singapore", "Japan",
  "South Korea", "Brazil", "Mexico", "India", "Other",
];

// ─── US States ────────────────────────────────────────────────────────────────
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

// ─── Inner form (must be inside <Elements>) ───────────────────────────────────
interface InnerFormProps {
  data: InlineCheckoutBlockData;
  onSuccess: (successUrl: string) => void;
}

function InlineCheckoutInner({ data, onSuccess }: InnerFormProps) {
  const stripe  = useStripe();
  const elements = useElements();

  const accent  = data.accentColor ?? "#179ca3";
  const products    = data.products ?? [];
  const orderBumps  = data.orderBumps ?? [];

  // ── Form state ─────────────────────────────────────────────────────────────
  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [address,     setAddress]     = useState("");
  const [address2,    setAddress2]    = useState("");
  const [country,     setCountry]     = useState("United States");
  const [stateVal,    setStateVal]    = useState("");
  const [city,        setCity]        = useState("");
  const [postalCode,  setPostalCode]  = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [addedBumps,  setAddedBumps]  = useState<Set<number>>(new Set());
  const [termsOk,     setTermsOk]     = useState(false);
  const [promoCode,   setPromoCode]   = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [cardError,   setCardError]   = useState<string | null>(null);

  // Animate bumps into view when they first appear
  const bumpRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    bumpRefs.current = bumpRefs.current.slice(0, orderBumps.length);
  }, [orderBumps.length]);

  const createPaymentIntent = trpc.embeddedCheckout.createPaymentIntent.useMutation({
    onError: (e) => toast.error(e.message || "Failed to initialize payment"),
  });
  const confirmPayment = trpc.embeddedCheckout.confirmPayment.useMutation();
  const processFreeOrder = trpc.embeddedCheckout.processFreeOrder.useMutation({
    onError: (e) => toast.error(e.message || "Failed to process order"),
  });

  const selectedProduct = products[selectedIdx];

  const totalAmount = useMemo(() => {
    let t = selectedProduct?.price ?? 0;
    addedBumps.forEach(i => { if (orderBumps[i]) t += orderBumps[i].price; });
    return t;
  }, [selectedIdx, addedBumps, products, orderBumps]);
  const totalCents = Math.round(totalAmount * 100); // convert dollars to cents for Stripe (unused here, prices sent as dollars to server)

  const fmt = (dollars: number) => `$${Number(dollars).toFixed(2)}`;

  const toggleBump = (idx: number) => {
    setAddedBumps(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (data.termsText && !termsOk) {
      toast.error("Please accept the terms to continue.");
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    if (!selectedProduct) {
      toast.error("Please select a product.");
      return;
    }

    setSubmitting(true);
    setCardError(null);

    // ── Free order: skip Stripe entirely ──
    if (totalAmount === 0) {
      try {
        const result = await processFreeOrder.mutateAsync({
          email,
          firstName: firstName || undefined,
          lastName:  lastName  || undefined,
          phone:     phone     || undefined,
          productName:  selectedProduct.name,
          productType:  (selectedProduct.type as any) ?? "other",
          productId:    (selectedProduct as any).productId ?? undefined,
          sourceType: data.sourceType ?? "other",
          sourceFunnelId:      data.sourceFunnelId,
          sourceLandingPageId: data.sourceLandingPageId,
          successRedirect: data.successRedirect,
          origin: window.location.origin,
          lmsCourseId: data.lmsCourseId,
          fulfillmentBrand: data.fulfillmentBrand,
          additionalAccess: (data as any).additionalAccess ?? undefined,
        });
        onSuccess(result.successUrl);
      } catch (_) {
        // error handled by onError above
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      // 1. Create PaymentIntent on server
      const intentResult = await createPaymentIntent.mutateAsync({
        email,
        firstName: firstName || undefined,
        lastName:  lastName  || undefined,
        phone:     phone     || undefined,
        productName:  selectedProduct.name,
        productPrice: selectedProduct.price,
        productType:  (selectedProduct.type as any) ?? "other",
        productId:    (selectedProduct as any).productId ?? undefined,
        selectedBumps: Array.from(addedBumps).map(i => ({
          title: orderBumps[i].title,
          price: orderBumps[i].price,
          productType: "other",
        })),
        billingAddress: data.showBillingInfo ? { address, address2, country, state: stateVal, city, postalCode } : undefined,
        collectShipping: data.collectShipping ?? false,
        sourceType: data.sourceType ?? "other",
        sourceFunnelId:      data.sourceFunnelId,
        sourceLandingPageId: data.sourceLandingPageId,
        successRedirect: data.successRedirect,
        origin: window.location.origin,
        // Legacy single-item fulfillment (backward compat) — these are still passed as metadata
        // for the webhook to process. additionalAccess array is resolved server-side from block data.
        lmsCourseId: data.lmsCourseId,
        fulfillmentBrand: data.fulfillmentBrand,
        promoCode: promoCode || undefined,
      });

      // 2. Confirm card payment with Stripe
      const cardNumber = elements.getElement(CardNumberElement);
      if (!cardNumber) throw new Error("Card element not found");

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        intentResult.clientSecret,
        {
          payment_method: {
            card: cardNumber,
            billing_details: {
              name:  [firstName, lastName].filter(Boolean).join(" ") || undefined,
              email,
              phone: phone || undefined,
              address: data.showBillingInfo ? {
                line1:       address,
                line2:       address2 || undefined,
                city,
                state:       stateVal,
                postal_code: postalCode,
                country:     country === "United States" ? "US"
                           : country === "Canada"        ? "CA"
                           : country === "United Kingdom"? "GB"
                           : country === "Australia"     ? "AU"
                           : undefined,
              } : undefined,
            },
          },
        }
      );

      if (stripeError) {
        setCardError(stripeError.message ?? "Payment failed — please check your card details.");
        setSubmitting(false);
        return;
      }

      // 3. Confirm on server (marks purchase as paid)
      if (paymentIntent?.id) {
        await confirmPayment.mutateAsync({ paymentIntentId: paymentIntent.id });
      }

      // 4. Success
      onSuccess(intentResult.successUrl);

    } catch {
      // Errors already toasted by mutation onError
    } finally {
      setSubmitting(false);
    }
  };

  const fieldCls = "w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 bg-white text-gray-800 placeholder-gray-400";
  const focusRingStyle = { "--tw-ring-color": accent } as React.CSSProperties;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-2 sm:px-4 py-2" style={{ color: data.textColor ?? "#0e1e2e" }}>

      {/* ── Header Banner ─────────────────────────────────────────────────── */}
      {data.headerText && (
        <div
          className="rounded-t-xl px-6 py-4 mb-0 text-center text-white font-bold text-lg flex flex-col items-center justify-center gap-1"
          style={{ backgroundColor: accent }}
        >
          <div className="flex items-center gap-2">
            <span>{data.headerText}</span>
          </div>
          {data.headerPrice && (
            <div className="flex items-center gap-2 text-base">
              {(data as any).showHeaderStrikethrough && (data as any).headerStrikethroughPrice && (
                <span className="font-normal line-through opacity-70">{(data as any).headerStrikethroughPrice}</span>
              )}
              <span>{data.headerPrice}</span>
            </div>
          )}
        </div>
      )}

      <div className="border border-gray-200 rounded-b-xl rounded-t-none bg-white shadow-sm overflow-hidden">
        <div className="p-5 space-y-5">

          {/* ── Contact Information ─────────────────────────────────────── */}
          {data.showContactInfo !== false && (
            <fieldset className="border border-gray-200 rounded-lg p-4 space-y-3">
              <legend className="text-[10px] font-bold tracking-widest text-gray-500 uppercase px-1">
                Contact Information
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className={fieldCls}
                  style={focusRingStyle}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className={fieldCls}
                  style={focusRingStyle}
                />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={fieldCls}
                style={focusRingStyle}
              />
              {data.showPhone !== false && (
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required={data.requirePhone === true}
                  className={fieldCls}
                  style={focusRingStyle}
                />
              )}
            </fieldset>
          )}

          {/* ── Product Selector ────────────────────────────────────────── */}
          {data.showProductSelect !== false && products.length > 0 && (
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-[10px] font-bold tracking-widest text-gray-500 uppercase px-1">
                Select Product
              </legend>
              <div className="space-y-2 mt-2">
                {products.map((product, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-all ${
                      selectedIdx === idx
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-transparent hover:bg-gray-50"
                    }`}
                    style={{ "--accent": accent } as React.CSSProperties}
                  >
                    <input
                      type="radio"
                      name="product"
                      checked={selectedIdx === idx}
                      onChange={() => setSelectedIdx(idx)}
                      className="w-4 h-4 flex-shrink-0"
                      style={{ accentColor: accent }}
                    />
                    {product.imageUrl && (
                      <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{product.name}</div>
                      {product.description && (
                        <div className="text-xs text-gray-500 truncate">{product.description}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {(product as any).strikethroughPrice && (
                        <div className="text-xs text-red-500 line-through font-medium">{(product as any).strikethroughPrice}</div>
                      )}
                      <span className="font-semibold text-sm">{fmt(product.price)}</span>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* ── Billing / Address ───────────────────────────────────────── */}
          {data.showBillingInfo && (
            <fieldset className="border border-gray-200 rounded-lg p-4 space-y-3">
              <legend className="text-[10px] font-bold tracking-widest text-gray-500 uppercase px-1">
                Billing Information
              </legend>
              <input
                type="text"
                placeholder="Address"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className={fieldCls}
                style={focusRingStyle}
              />
              <input
                type="text"
                placeholder="Apartment, building, floor (optional)"
                value={address2}
                onChange={e => setAddress2(e.target.value)}
                className={fieldCls}
                style={focusRingStyle}
              />
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className={fieldCls}
                style={focusRingStyle}
              >
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select
                value={stateVal}
                onChange={e => setStateVal(e.target.value)}
                className={fieldCls}
                style={focusRingStyle}
              >
                <option value="">State</option>
                {US_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className={fieldCls}
                  style={focusRingStyle}
                />
                <input
                  type="text"
                  placeholder="Postal Code"
                  value={postalCode}
                  onChange={e => setPostalCode(e.target.value)}
                  className={fieldCls}
                  style={focusRingStyle}
                />
              </div>
            </fieldset>
          )}

          {/* ── Payment Information ─────────────────────────────────────── */}
          {totalAmount > 0 && <fieldset className="border border-gray-200 rounded-lg p-4 space-y-3">
            <legend className="text-[10px] font-bold tracking-widest text-gray-500 uppercase px-1">
              Payment Information
            </legend>
            {/* Card Number */}
            <div className="border border-gray-200 rounded-lg px-4 py-3 bg-white">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <CardNumberElement options={{ style: CARD_ELEMENT_STYLE, showIcon: true }} />
                </div>
              </div>
            </div>
            {/* Expiry + CVC */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-lg px-4 py-3 bg-white">
                <CardExpiryElement options={{ style: CARD_ELEMENT_STYLE }} />
              </div>
              <div className="border border-gray-200 rounded-lg px-4 py-3 bg-white">
                <CardCvcElement options={{ style: CARD_ELEMENT_STYLE }} />
              </div>
            </div>
            {cardError && (
              <p className="text-xs text-red-500 mt-1">{cardError}</p>
            )}
          </fieldset>}

          {/* ── Order Bumps ─────────────────────────────────────────────── */}
          {orderBumps.length > 0 && (
            <div className="space-y-3">
              {orderBumps.map((bump, idx) => {
                const added = addedBumps.has(idx);
                const animClass = BUMP_ANIMATION_CLASS[bump.animation ?? "none"];
                return (
                  <div
                    key={idx}
                    ref={el => { bumpRefs.current[idx] = el; }}
                    className={`border-2 rounded-xl p-4 transition-all duration-300 ${
                      added
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : `border-gray-200 hover:border-[var(--accent)]/40 ${animClass}`
                    }`}
                    style={{ "--accent": accent } as React.CSSProperties}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox indicator */}
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-colors"
                        style={{
                          borderColor: added ? accent : "#d1d5db",
                          backgroundColor: added ? accent : "transparent",
                        }}
                      >
                        {added && <CheckCircle2 size={12} className="text-white" />}
                      </div>

                      {/* Image */}
                      {bump.imageUrl && (
                        <img
                          src={bump.imageUrl}
                          alt=""
                          className="w-20 h-28 rounded-lg object-cover flex-shrink-0"
                        />
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {bump.headline && (
                          <div className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: accent }}>
                            {bump.headline}
                          </div>
                        )}
                        <div className="font-bold text-sm text-gray-800 mb-1">{bump.title}</div>
                        {bump.description && (
                          <p className="text-xs text-gray-500 leading-relaxed mb-2">{bump.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm" style={{ color: accent }}>
                            {fmt(bump.price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleBump(idx)}
                            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                            style={{
                              backgroundColor: added ? accent : "transparent",
                              color: added ? "white" : accent,
                              border: `1.5px solid ${accent}`,
                            }}
                          >
                            {added ? (
                              <><Minus size={12} /> Remove</>
                            ) : (
                              <><Plus size={12} /> {bump.ctaText || "Add"} {bump.ctaEmoji || ""}</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Order Summary ───────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setSummaryOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart size={15} />
                Summary
              </span>
              <span className="flex items-center gap-2">
                <span style={{ color: accent }}>{fmt(totalAmount)}</span>
                {summaryOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </span>
            </button>
            {summaryOpen && (
              <div className="px-4 py-3 space-y-2 text-sm border-t border-gray-100">
                {selectedProduct && (
                  <div className="flex justify-between text-gray-700">
                    <span>{selectedProduct.name}</span>
                    <span className="font-medium">{fmt(selectedProduct.price)}</span>
                  </div>
                )}
                {Array.from(addedBumps).map(i => (
                  <div key={i} className="flex justify-between text-gray-600">
                    <span className="flex items-center gap-1">
                      <Plus size={11} style={{ color: accent }} />
                      {orderBumps[i]?.title}
                    </span>
                    <span className="font-medium">{fmt(orderBumps[i]?.price ?? 0)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-800">
                  <span>Total</span>
                  <span style={{ color: accent }}>{fmt(totalAmount)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Promo Code ──────────────────────────────────────────────── */}
          <PromoCodeInput onApply={(code, _) => setPromoCode(code)} />

          {/* ── Terms ───────────────────────────────────────────────────── */}
          {data.termsText && (
            <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-500 leading-relaxed">
              <input
                type="checkbox"
                checked={termsOk}
                onChange={e => setTermsOk(e.target.checked)}
                className="mt-0.5 flex-shrink-0 w-4 h-4 rounded"
                style={{ accentColor: accent }}
              />
              <span>
                {data.termsText}{" "}
                {data.termsLinkText && data.termsLinkUrl && (
                  <a
                    href={data.termsLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
                    style={{ color: accent }}
                  >
                    {data.termsLinkText}
                  </a>
                )}
              </span>
            </label>
          )}

          {/* ── Submit ──────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={submitting || !stripe}
            className="w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: accent }}
          >
            {submitting ? (
              <><Loader2 size={18} className="animate-spin" /> Processing…</>
            ) : (
              <>{renderSubmitIcon(data.submitIcon, 16)}{renderSubmitIcon(data.submitIcon, 16) ? " " : ""}{data.submitText || "Submit"}</>
            )}
          </button>

          {/* Trust line */}
          <p className="text-center text-xs text-gray-400">
            We Never Share Your Information With Anyone
          </p>
        </div>
      </div>
    </form>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ successUrl, accent }: { successUrl: string; accent: string }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-16 px-4">
      <CheckCircle2 size={64} className="mx-auto mb-4" style={{ color: accent }} />
      <h2 className="text-2xl font-bold mb-2 text-gray-800">Payment Successful!</h2>
      <p className="text-gray-500 mb-6">
        Thank you for your purchase. You will receive a confirmation email shortly.
      </p>
      {successUrl && (
        <a
          href={successUrl}
          className="inline-block px-8 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          Continue
        </a>
      )}
    </div>
  );
}

// ─── Public-facing wrapper (wraps with Elements provider) ─────────────────────
interface InlineCheckoutBlockProps {
  data: Record<string, unknown>;
  /** Optional source context for attribution */
  sourceType?: InlineCheckoutBlockData["sourceType"];
  sourceFunnelId?: number;
  sourceLandingPageId?: number;
}

export default function InlineCheckoutBlock({
  data,
  sourceType,
  sourceFunnelId,
  sourceLandingPageId,
}: InlineCheckoutBlockProps) {
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  const d: InlineCheckoutBlockData = {
    ...(data as InlineCheckoutBlockData),
    sourceType:          sourceType          ?? (data.sourceType as any)          ?? "other",
    sourceFunnelId:      sourceFunnelId      ?? (data.sourceFunnelId as number)   ?? undefined,
    sourceLandingPageId: sourceLandingPageId ?? (data.sourceLandingPageId as number) ?? undefined,
  };

  const accent = d.accentColor ?? "#179ca3";

  if (successUrl) {
    return <SuccessScreen successUrl={successUrl} accent={accent} />;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: accent, fontFamily: "Inter, sans-serif" },
        },
      }}
    >
      <InlineCheckoutInner data={d} onSuccess={setSuccessUrl} />
    </Elements>
  );
}

// ─── Admin editor default data ────────────────────────────────────────────────
export const INLINE_CHECKOUT_DEFAULTS: InlineCheckoutBlockData = {
  headerText:       "🔒 Lock in your seat now!",
  headerPrice:      "$997",
  accentColor:      "#179ca3",
  bgColor:          "#ffffff",
  textColor:        "#0e1e2e",
  showContactInfo:  true,
  showBillingInfo:  false,
  collectShipping:  false,
  showProductSelect: true,
  products: [
    {
      name:        "Example Course",
      description: "Full online access",
      price:       997,
      imageUrl:    "",
      type:        "course",
    },
  ],
  orderBumps: [],
  termsText:      "I attest that I meet the pre-requisites for this course and I agree to the",
  termsLinkText:  "TERMS OF SERVICE",
  termsLinkUrl:   "/terms",
  submitText:     "Submit",
  successRedirect: "",
  sourceType:     "landing_page",
};
