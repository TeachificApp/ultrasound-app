/**
 * CheckoutFormBlock.tsx
 * A full checkout form component for funnel pages.
 * Supports inline embedding or standalone page rendering.
 * Includes: contact info, product selection, billing address,
 * Stripe payment, order bumps, terms, and submit.
 */
import { useState, useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Lock, ShoppingCart } from "lucide-react";

// Load Stripe outside of component to avoid re-creating on every render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckoutProduct {
  name: string;
  description: string;
  price: number; // cents
  imageUrl: string;
  type: string; // "course" | "quiz" | "product" | "external"
}

interface OrderBump {
  title: string;
  headline: string;
  description: string;
  price: number; // cents
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
  showBillingInfo: boolean;
  showProductSelect: boolean;
  products: CheckoutProduct[];
  orderBumps: OrderBump[];
  termsText: string;
  termsLinkText: string;
  termsLinkUrl: string;
  submitText: string;
  successRedirect: string;
}

interface CheckoutFormBlockProps {
  data: Record<string, any>;
  funnelId: number;
  pageId: number;
  funnelSlug: string;
}

// ─── Inner Form (needs Stripe context) ───────────────────────────────────────

function CheckoutFormInner({ data, funnelId, pageId, funnelSlug }: CheckoutFormBlockProps) {
  const d = data as unknown as CheckoutFormData;
  const stripe = useStripe();
  const elements = useElements();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

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

  const createCheckout = trpc.funnelPublic.createFunnelFormCheckout.useMutation({
    onError: (e: any) => toast.error(e.message || "Checkout failed"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted && d.termsText) {
      toast.error("Please accept the terms to continue");
      return;
    }

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create checkout session on the server
      const result = await createCheckout.mutateAsync({
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
      });

      if (result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.open(result.checkoutUrl, "_blank");
        toast.success("Redirecting to secure checkout...");
      }
    } catch (err) {
      // Error handled by mutation onError
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleBump = (idx: number) => {
    const next = new Set(addedBumps);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setAddedBumps(next);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto" style={{ color: d.textColor ?? "#0e1e2e" }}>
      {/* Header Banner */}
      <div
        className="rounded-lg px-6 py-4 mb-6 text-center text-white font-bold text-lg flex items-center justify-center gap-2"
        style={{ backgroundColor: accent }}
      >
        <Lock size={18} />
        <span>{d.headerText ?? "Lock in your seat now!"} {d.headerPrice ?? ""}</span>
      </div>

      {/* Contact Information */}
      {d.showContactInfo !== false && (
        <fieldset className="border border-gray-300 rounded-lg p-5 mb-5">
          <legend className="text-xs font-bold tracking-wider text-gray-600 px-2 uppercase">Contact Information</legend>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
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
                <span className="font-medium text-sm">${(product.price / 100).toFixed(2)}</span>
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

      {/* Payment Information */}
      <fieldset className="border border-gray-300 rounded-lg p-5 mb-5">
        <legend className="text-xs font-bold tracking-wider text-gray-600 px-2 uppercase">Payment Information</legend>
        <div className="border border-gray-200 rounded-lg p-4">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#1a1a1a",
                  "::placeholder": { color: "#9ca3af" },
                },
              },
            }}
          />
        </div>
      </fieldset>

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
                <img src={bump.imageUrl} alt="" className="w-16 h-20 rounded object-cover flex-shrink-0" />
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
                  ${(bump.price / 100).toFixed(2)}
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
                  {addedBumps.has(idx) ? "Added ✓" : (bump.ctaText || "+ Add")}
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
            {showSummary ? "Hide" : "For more details, fill the form"} ▾
          </span>
        </button>
        {showSummary && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2 text-sm">
            {selectedProduct && (
              <div className="flex justify-between">
                <span>{selectedProduct.name}</span>
                <span className="font-medium">${(selectedProduct.price / 100).toFixed(2)}</span>
              </div>
            )}
            {Array.from(addedBumps).map((idx) => {
              const bump = orderBumps[idx];
              if (!bump) return null;
              return (
                <div key={idx} className="flex justify-between text-gray-600">
                  <span>{bump.title}</span>
                  <span>${(bump.price / 100).toFixed(2)}</span>
                </div>
              );
            })}
            <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-2">
              <span>Total</span>
              <span>${(totalPrice / 100).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

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

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 rounded-lg font-bold text-white text-lg transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ backgroundColor: accent }}
      >
        {isSubmitting && <Loader2 size={20} className="animate-spin" />}
        {d.submitText ?? "Submit"}
      </button>
    </form>
  );
}

// ─── Wrapper with Stripe Elements Provider ───────────────────────────────────

export default function CheckoutFormBlock(props: CheckoutFormBlockProps) {
  return (
    <div className="px-4 py-10" style={{ backgroundColor: props.data.bgColor ?? "#ffffff" }}>
      <Elements stripe={stripePromise}>
        <CheckoutFormInner {...props} />
      </Elements>
    </div>
  );
}
