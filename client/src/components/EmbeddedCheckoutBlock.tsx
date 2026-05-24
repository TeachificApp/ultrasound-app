/**
 * EmbeddedCheckoutBlock.tsx
 *
 * A fully embedded Stripe checkout block for any page builder surface.
 * Features:
 *  - Inline Stripe PaymentElement (no redirect)
 *  - Animated order bumps with pulse/glow highlight
 *  - Address collection toggle (auto-enabled for physical products)
 *  - Contact info collection
 *  - Success state with confetti-style animation
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { trpc } from "@/lib/trpc";
import PromoCodeInput from "@/components/PromoCodeInput";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  CheckCircle2,
  ShoppingBag,
  Plus,
  Check,
  MapPin,
  ChevronDown,
  ChevronUp,
  Shield, Zap, Star, Heart,
  Gift, Award, ArrowRight, Sparkles, Rocket, BadgeCheck,
  ShoppingCart, CreditCard,
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

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmbeddedCheckoutProduct {
  name: string;
  description?: string;
  price: number; // cents
  imageUrl?: string;
  type: "course" | "download" | "physical" | "membership" | "bundle" | "other" | "subscription";
  strikethroughPrice?: string; // display-only, e.g. "$197"
}

export interface EmbeddedCheckoutOrderBump {
  title: string;
  headline?: string;
  description?: string;
  price: number; // cents
  imageUrl?: string;
  ctaText?: string;
  animationStyle?: "pulse" | "glow" | "shake" | "bounce" | "none";
  highlightColor?: string;
}

export interface EmbeddedCheckoutBlockData {
  // Header
  headerText?: string;
  headerSubtext?: string;
  // Product
  products: EmbeddedCheckoutProduct[];
  // Order bumps
  orderBumps?: EmbeddedCheckoutOrderBump[];
  // Address collection
  collectShipping?: boolean; // if true, show shipping address form
  collectBilling?: boolean;  // if true, show billing address form
  // Contact info
  showContactInfo?: boolean;
  showPhone?: boolean;    // default true — show phone field
  requirePhone?: boolean; // default false — require phone field
  // Appearance
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  // Submit
  submitText?: string;
  submitIcon?: "none" | "lock" | "shield" | "shopping-cart" | "shopping-bag" | "zap" | "star" | "heart" | "gift" | "award" | "arrow-right" | "sparkles" | "rocket" | "badge-check" | "credit-card";
  successRedirect?: string;
  successMessage?: string;
  // Terms
  termsText?: string;
  termsLinkText?: string;
  termsLinkUrl?: string;
  // Source context (set by the page builder)
  sourceType?: "funnel" | "landing_page" | "product_page" | "lms_lesson" | "other";
  sourceFunnelId?: number;
  sourceFunnelPageId?: number;
  sourceLandingPageId?: number;
  sourceLmsLessonId?: number;
}

interface EmbeddedCheckoutBlockProps {
  data: Record<string, any>;
  previewMode?: boolean; // if true, disable actual payments
  pageSlug?: string; // optional context for purchase tracking
}

// ─── Animated Order Bump ─────────────────────────────────────────────────────

function AnimatedOrderBump({
  bump,
  isAdded,
  onToggle,
  accent,
}: {
  bump: EmbeddedCheckoutOrderBump;
  isAdded: boolean;
  onToggle: () => void;
  accent: string;
}) {
  const [hasBeenSeen, setHasBeenSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const animStyle = bump.animationStyle ?? "pulse";
  const highlightColor = bump.highlightColor ?? accent;

  // Trigger animation when the bump enters the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasBeenSeen) {
          setHasBeenSeen(true);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasBeenSeen]);

  const animClass = !isAdded && hasBeenSeen
    ? animStyle === "pulse"
      ? "animate-pulse-border"
      : animStyle === "glow"
      ? "animate-glow-border"
      : animStyle === "shake"
      ? "animate-shake"
      : animStyle === "bounce"
      ? "animate-bounce-subtle"
      : ""
    : "";

  return (
    <div
      ref={ref}
      className={`relative rounded-xl border-2 p-4 mb-4 transition-all duration-300 cursor-pointer select-none ${animClass}`}
      style={{
        borderColor: isAdded ? highlightColor : `${highlightColor}60`,
        backgroundColor: isAdded ? `${highlightColor}10` : "white",
        boxShadow: isAdded
          ? `0 0 0 3px ${highlightColor}30`
          : hasBeenSeen && !isAdded && animStyle === "glow"
          ? `0 0 16px 4px ${highlightColor}40`
          : undefined,
      }}
      onClick={onToggle}
    >
      {/* "Special Offer" badge */}
      {!isAdded && (
        <div
          className="absolute -top-3 left-4 px-3 py-0.5 rounded-full text-xs font-bold text-white shadow"
          style={{ backgroundColor: highlightColor }}
        >
          ✦ Special Add-On Offer
        </div>
      )}
      {isAdded && (
        <div
          className="absolute -top-3 left-4 px-3 py-0.5 rounded-full text-xs font-bold text-white shadow flex items-center gap-1"
          style={{ backgroundColor: "#16a34a" }}
        >
          <Check size={10} /> Added to Order
        </div>
      )}

      <div className="flex items-start gap-3 mt-1">
        {/* Checkbox */}
        <div
          className="flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors mt-0.5"
          style={{
            borderColor: isAdded ? "#16a34a" : highlightColor,
            backgroundColor: isAdded ? "#16a34a" : "transparent",
          }}
        >
          {isAdded && <Check size={14} className="text-white" />}
        </div>

        {/* Image */}
        {bump.imageUrl && (
          <img
            src={bump.imageUrl}
            alt={bump.title}
            className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {bump.headline && (
            <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: highlightColor }}>
              {bump.headline}
            </p>
          )}
          <p className="font-bold text-gray-900 text-sm leading-tight">{bump.title}</p>
          {bump.description && (
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{bump.description}</p>
          )}
        </div>

        {/* Price + CTA */}
        <div className="flex-shrink-0 text-right">
          <p className="font-bold text-base" style={{ color: highlightColor }}>
            +${(bump.price / 100).toFixed(2)}
          </p>
          <button
            type="button"
            className="mt-1 px-3 py-1 rounded-lg text-xs font-bold border-2 transition-colors"
            style={
              isAdded
                ? { borderColor: "#16a34a", color: "#16a34a", backgroundColor: "#f0fdf4" }
                : { borderColor: highlightColor, color: highlightColor, backgroundColor: "transparent" }
            }
          >
            {isAdded ? "✓ Added" : (bump.ctaText || "+ Add")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Contact & Details Step ───────────────────────────────────────────────────

function DetailsStep({
  d,
  accent,
  onProceed,
}: {
  d: EmbeddedCheckoutBlockData;
  accent: string;
  onProceed: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    shippingAddress: any;
    selectedProductIdx: number;
    addedBumps: Set<number>;
    totalAmount: number;
    promoCode?: string;
  }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedProductIdx, setSelectedProductIdx] = useState(0);
  const [addedBumps, setAddedBumps] = useState<Set<number>>(new Set());
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
  const [shippingName, setShippingName] = useState("");
  const [shippingLine1, setShippingLine1] = useState("");
  const [shippingLine2, setShippingLine2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("US");
  const [promoCode, setPromoCode] = useState<string | null>(null);

  const products = d.products ?? [];
  const orderBumps = d.orderBumps ?? [];
  const selectedProduct = products[selectedProductIdx];
  const isPhysical = selectedProduct?.type === "physical";
  const shouldCollectShipping = d.collectShipping || isPhysical;

  const totalAmount = useMemo(() => {
    let total = selectedProduct?.price ?? 0;
    addedBumps.forEach((idx) => {
      if (orderBumps[idx]) total += orderBumps[idx].price;
    });
    return total;
  }, [selectedProductIdx, addedBumps, products, orderBumps]);

  const toggleBump = (idx: number) => {
    setAddedBumps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter your email address.");
    if (d.termsText && !termsAccepted) return toast.error("Please accept the terms to continue.");
    if (shouldCollectShipping && !shippingLine1) return toast.error("Please enter your shipping address.");

    onProceed({
      firstName,
      lastName,
      email,
      phone,
      promoCode: promoCode || undefined,
      shippingAddress: shouldCollectShipping ? {
        name: shippingName || `${firstName} ${lastName}`.trim(),
        line1: shippingLine1,
        line2: shippingLine2,
        city: shippingCity,
        state: shippingState,
        postalCode: shippingPostalCode,
        country: shippingCountry,
      } : null,
      selectedProductIdx,
      addedBumps,
      totalAmount,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product selection */}
      {products.length > 1 && (
        <fieldset className="border border-gray-200 rounded-xl p-4">
          <legend className="text-xs font-bold tracking-wider text-gray-500 px-2 uppercase">Select Product</legend>
          <div className="space-y-2 mt-1">
            {products.map((p, i) => (
              <label key={i} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                <div
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: accent, backgroundColor: selectedProductIdx === i ? accent : "transparent" }}
                >
                  {selectedProductIdx === i && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                {p.imageUrl && <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />}
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                  {p.description && <p className="text-xs text-gray-500">{p.description}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  {p.strikethroughPrice && (
                    <div className="text-xs text-red-500 line-through font-medium">{p.strikethroughPrice}</div>
                  )}
                  <span className="font-bold text-sm" style={{ color: accent }}>${(p.price / 100).toFixed(2)}</span>
                </div>
                <input type="radio" className="sr-only" checked={selectedProductIdx === i} onChange={() => setSelectedProductIdx(i)} />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Single product display */}
      {products.length === 1 && selectedProduct && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
          {selectedProduct.imageUrl && (
            <img src={selectedProduct.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-bold text-gray-900">{selectedProduct.name}</p>
            {selectedProduct.description && <p className="text-sm text-gray-500">{selectedProduct.description}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            {selectedProduct.strikethroughPrice && (
              <div className="text-sm text-red-500 line-through font-medium">{selectedProduct.strikethroughPrice}</div>
            )}
            <span className="font-bold text-lg" style={{ color: accent }}>${(selectedProduct.price / 100).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Contact info */}
      {(d.showContactInfo !== false) && (
        <fieldset className="border border-gray-200 rounded-xl p-4">
          <legend className="text-xs font-bold tracking-wider text-gray-500 px-2 uppercase">Contact Information</legend>
          <div className="grid grid-cols-2 gap-2 mt-2 mb-2">
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": accent } as any}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>
          <input
            type="email"
            placeholder="Email Address *"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2"
          />
          {d.showPhone !== false && (
            <input
              type="tel"
              placeholder={d.requirePhone ? "Phone Number *" : "Phone Number (optional)"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required={d.requirePhone === true}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          )}
        </fieldset>
      )}

      {/* Shipping address */}
      {shouldCollectShipping && (
        <fieldset className="border border-gray-200 rounded-xl p-4">
          <legend className="text-xs font-bold tracking-wider text-gray-500 px-2 uppercase flex items-center gap-1">
            <MapPin size={12} /> Shipping Address
          </legend>
          <div className="space-y-2 mt-2">
            <input type="text" placeholder="Full Name" value={shippingName} onChange={(e) => setShippingName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
            <input type="text" placeholder="Address Line 1 *" required value={shippingLine1} onChange={(e) => setShippingLine1(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
            <input type="text" placeholder="Address Line 2 (optional)" value={shippingLine2} onChange={(e) => setShippingLine2(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="City *" required value={shippingCity} onChange={(e) => setShippingCity(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
              <input type="text" placeholder="State / Province *" required value={shippingState} onChange={(e) => setShippingState(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Postal Code *" required value={shippingPostalCode} onChange={(e) => setShippingPostalCode(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
              <select value={shippingCountry} onChange={(e) => setShippingCountry(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white">
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="NZ">New Zealand</option>
                <option value="IE">Ireland</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </fieldset>
      )}

      {/* Order bumps */}
      {orderBumps.length > 0 && (
        <div>
          {orderBumps.map((bump, i) => (
            <AnimatedOrderBump
              key={i}
              bump={bump}
              isAdded={addedBumps.has(i)}
              onToggle={() => toggleBump(i)}
              accent={accent}
            />
          ))}
        </div>
      )}

      {/* Order summary */}
      {(addedBumps.size > 0 || products.length > 0) && (
        <div className="bg-gray-50 rounded-xl p-4 text-sm">
          <p className="font-bold text-gray-700 mb-2 text-xs uppercase tracking-wide">Order Summary</p>
          {selectedProduct && (
            <div className="flex justify-between text-gray-600 mb-1">
              <span>{selectedProduct.name}</span>
              <span>${(selectedProduct.price / 100).toFixed(2)}</span>
            </div>
          )}
          {Array.from(addedBumps).map((idx) => {
            const bump = orderBumps[idx];
            if (!bump) return null;
            return (
              <div key={idx} className="flex justify-between text-gray-600 mb-1">
                <span className="flex items-center gap-1"><Plus size={10} />{bump.title}</span>
                <span>${(bump.price / 100).toFixed(2)}</span>
              </div>
            );
          })}
          <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-2 text-gray-900">
            <span>Total</span>
            <span style={{ color: accent }}>${(totalAmount / 100).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Promo Code */}
      <PromoCodeInput onApply={(code, _) => setPromoCode(code)} />

      {/* Terms */}
      {d.termsText && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 w-4 h-4 rounded accent-teal-600"
          />
          <span className="text-sm text-gray-600">
            {d.termsText}{" "}
            {d.termsLinkUrl && (
              <a href={d.termsLinkUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline" style={{ color: accent }}>
                {d.termsLinkText || "Terms of Service"}
              </a>
            )}
          </span>
        </label>
      )}

      <button
        type="submit"
        className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
        style={{ backgroundColor: accent }}
      >
        Proceed to Payment — ${(totalAmount / 100).toFixed(2)}
      </button>
    </form>
  );
}

// ─── Payment Step ─────────────────────────────────────────────────────────────

function PaymentStep({
  accent,
  submitText,
  submitIcon,
  successUrl,
  paymentIntentId,
  onSuccess,
}: {
  accent: string;
  submitText: string;
  submitIcon?: string;
  successUrl: string;
  paymentIntentId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const confirmPayment = trpc.embeddedCheckout.confirmPayment.useMutation();

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);
    setPaymentError(null);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: successUrl || window.location.href },
        redirect: "if_required",
      });
      if (error) {
        setPaymentError(error.message || "Payment failed. Please try again.");
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // Mark as paid in our DB
        await confirmPayment.mutateAsync({ paymentIntentId });
        toast.success("Payment successful! Thank you for your purchase.");
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === "requires_action") {
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
      <div className="border border-gray-200 rounded-xl p-5 mb-5 bg-white">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      {paymentError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
          {paymentError}
        </div>
      )}
      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all hover:opacity-90 active:scale-[0.98] shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
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

// ─── Success State ────────────────────────────────────────────────────────────

function SuccessState({ message, accent }: { message?: string; accent: string }) {
  return (
    <div className="text-center py-12 px-4">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-in"
        style={{ backgroundColor: `${accent}20` }}
      >
        <CheckCircle2 size={40} style={{ color: accent }} />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
      <p className="text-gray-600 max-w-sm mx-auto">
        {message || "Thank you for your purchase. You'll receive a confirmation email shortly."}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function EmbeddedCheckoutInner({
  d,
  previewMode,
}: {
  d: EmbeddedCheckoutBlockData;
  previewMode: boolean;
}) {
  const accent = d.accentColor ?? "#179ca3";
  const [step, setStep] = useState<"details" | "payment" | "success">("details");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string>("");
  const [paymentIntentId, setPaymentIntentId] = useState<string>("");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);

  const createPaymentIntent = trpc.embeddedCheckout.createPaymentIntent.useMutation({
    onError: (e: any) => {
      toast.error(e.message || "Failed to initialize payment");
      setIsCreatingIntent(false);
    },
  });

  const processFreeOrder = trpc.embeddedCheckout.processFreeOrder.useMutation({
    onError: (e: any) => {
      toast.error(e.message || "Failed to process order");
      setIsCreatingIntent(false);
    },
  });

  const handleProceed = async (formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    shippingAddress: any;
    selectedProductIdx: number;
    addedBumps: Set<number>;
    totalAmount: number;
    promoCode?: string;
  }) => {
    if (previewMode) {
      toast.info("Preview mode — payments are disabled.");
      return;
    }

    const products = d.products ?? [];
    const orderBumps = d.orderBumps ?? [];
    const selectedProduct = products[formData.selectedProductIdx];
    if (!selectedProduct) return;

    const selectedBumps = Array.from(formData.addedBumps)
      .map((idx) => orderBumps[idx])
      .filter(Boolean)
      .map((b) => ({ title: b.title, price: b.price, productType: b.title }));

    setIsCreatingIntent(true);
    // ── Free order: skip Stripe entirely ──
    if (formData.totalAmount === 0) {
      try {
        const result = await processFreeOrder.mutateAsync({
          email: formData.email,
          firstName: formData.firstName || undefined,
          lastName: formData.lastName || undefined,
          phone: formData.phone || undefined,
          productName: selectedProduct.name,
          productType: selectedProduct.type,
          productId: (selectedProduct as any).productId ?? undefined,
          sourceType: d.sourceType ?? "other",
          sourceFunnelId: d.sourceFunnelId,
          sourceFunnelPageId: d.sourceFunnelPageId,
          sourceLandingPageId: d.sourceLandingPageId,
          sourceLmsLessonId: d.sourceLmsLessonId,
          lmsCourseId: (d as any).lmsCourseId ?? undefined,
          fulfillmentBrand: (d as any).fulfillmentBrand ?? undefined,
          successRedirect: d.successRedirect,
          origin: window.location.origin,
          additionalAccess: (d as any).additionalAccess ?? undefined,
        });
        setSuccessUrl(result.successUrl);
        setStep("success");
        if (result.successUrl && result.successUrl !== window.location.href) {
          setTimeout(() => { window.location.href = result.successUrl; }, 2500);
        }
      } finally {
        setIsCreatingIntent(false);
      }
      return;
    }
    try {
      const result = await createPaymentIntent.mutateAsync({
        email: formData.email,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        phone: formData.phone || undefined,
        productName: selectedProduct.name,
        productPrice: selectedProduct.price,
        productType: selectedProduct.type,
        productId: (selectedProduct as any).productId ?? undefined,
        selectedBumps,
        shippingAddress: formData.shippingAddress || undefined,
        collectShipping: !!formData.shippingAddress,
        sourceType: d.sourceType ?? "other",
        sourceFunnelId: d.sourceFunnelId,
        sourceFunnelPageId: d.sourceFunnelPageId,
        sourceLandingPageId: d.sourceLandingPageId,
        sourceLmsLessonId: d.sourceLmsLessonId,
        lmsCourseId: (d as any).lmsCourseId ?? undefined,
        fulfillmentBrand: (d as any).fulfillmentBrand ?? undefined,
        successRedirect: d.successRedirect,
        origin: window.location.origin,
        promoCode: formData.promoCode || undefined,
      });
      setClientSecret(result.clientSecret);
      setSuccessUrl(result.successUrl);
      setPaymentIntentId(result.paymentIntentId);
      setStep("payment");
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const handleSuccess = () => {
    setStep("success");
    if (successUrl && successUrl !== window.location.href) {
      setTimeout(() => { window.location.href = successUrl; }, 2500);
    }
  };

  return (
    <div
      className="max-w-lg mx-auto rounded-2xl shadow-xl overflow-hidden"
      style={{ backgroundColor: d.bgColor ?? "#ffffff" }}
    >
      {/* Header */}
      {(d.headerText || d.headerSubtext) && step !== "success" && (
        <div className="px-6 pt-6 pb-4 text-center border-b border-gray-100">
          {d.headerText && (
            <h2 className="text-xl font-bold" style={{ color: d.textColor ?? "#111827" }}>
              {d.headerText}
            </h2>
          )}
          {d.headerSubtext && (
            <p className="text-sm mt-1" style={{ color: d.textColor ? `${d.textColor}99` : "#6b7280" }}>
              {d.headerSubtext}
            </p>
          )}
        </div>
      )}

      <div className="px-6 py-6">
        {/* Step indicator — only show for paid products */}
        {step !== "success" && (d.products ?? []).some(p => p.price > 0) && (
          <div className="flex items-center gap-2 mb-6">
            <div
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={step === "details" ? { backgroundColor: accent, color: "white" } : { backgroundColor: "#f0fdf4", color: "#16a34a" }}
            >
              {step === "payment" ? <Check size={12} /> : <ShoppingBag size={12} />}
              {step === "payment" ? "Details" : "1. Your Details"}
            </div>
            <div className="flex-1 h-px bg-gray-200" />
            <div
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={step === "payment" ? { backgroundColor: accent, color: "white" } : { backgroundColor: "#f3f4f6", color: "#9ca3af" }}
            >
              <CreditCard size={12} />
              2. Payment
            </div>
          </div>
        )}

        {step === "details" && !isCreatingIntent && (
          <DetailsStep d={d} accent={accent} onProceed={handleProceed} />
        )}

        {step === "details" && isCreatingIntent && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 size={32} className="animate-spin" style={{ color: accent }} />
            <p className="text-sm text-gray-500">Processing your order...</p>
          </div>
        )}

        {step === "payment" && clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: accent,
                  borderRadius: "12px",
                },
              },
            }}
          >
            <PaymentStep
              accent={accent}
              submitText={d.submitText ?? "Complete Purchase"}
              submitIcon={d.submitIcon}
              successUrl={successUrl}
              paymentIntentId={paymentIntentId}
              onSuccess={handleSuccess}
            />
          </Elements>
        )}

        {step === "success" && (
          <SuccessState message={d.successMessage} accent={accent} />
        )}
      </div>
    </div>
  );
}

// ─── Public Export ────────────────────────────────────────────────────────────

export default function EmbeddedCheckoutBlock({ data, previewMode = false }: EmbeddedCheckoutBlockProps) {
  const d = data as unknown as EmbeddedCheckoutBlockData;
  return (
    <div className="px-4 py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
      <EmbeddedCheckoutInner d={d} previewMode={previewMode} />
    </div>
  );
}
