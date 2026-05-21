import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Gift, Package, ShoppingCart, Truck, Plus } from "lucide-react";

export type FunnelStep = {
  name: string;
  role: string;
  url: string;
  cta: string;
};

export type FunnelProduct = {
  type: "digital" | "physical";
  title: string;
  description: string;
  price: string;
  imageUrl?: string;
  ctaText: string;
  ctaLink?: string;
  fulfillment?: string;
};

export type InlineOrderBumpProductType = "digital" | "physical";

function openLink(url?: string, fallback?: () => void) {
  if (url) window.location.href = url;
  else fallback?.();
}

export function FunnelWorkflowBlock({ data }: { data: Record<string, any> }) {
  const steps: FunnelStep[] = data.steps?.length ? data.steps : [];
  const accentColor = data.accentColor ?? "#179ca3";

  return (
    <section className="px-8 py-12" style={{ backgroundColor: data.bgColor ?? "#f8fffe" }}>
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl mb-8">
          {data.eyebrow && <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: accentColor }}>{data.eyebrow}</p>}
          {data.headline && <h2 className="text-3xl font-bold text-gray-900">{data.headline}</h2>}
          {data.subtext && <p className="text-gray-600 mt-3">{data.subtext}</p>}
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <div key={`${step.name}-${i}`} className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <span className="w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center mb-4" style={{ backgroundColor: accentColor }}>{i + 1}</span>
              <h3 className="font-bold text-gray-900">{step.name}</h3>
              <p className="text-sm text-gray-600 mt-2 min-h-[44px]">{step.role}</p>
              <button
                onClick={() => openLink(step.url)}
                className="mt-4 text-sm font-semibold hover:underline"
                style={{ color: accentColor }}
              >
                {step.cta} {"->"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProductOfferStackBlock({ data, onPrimaryCta }: { data: Record<string, any>; onPrimaryCta?: () => void }) {
  const products: FunnelProduct[] = data.products?.length ? data.products : [];
  const accentColor = data.accentColor ?? "#179ca3";

  return (
    <section className="px-8 py-12" style={{ backgroundColor: data.bgColor ?? "#ffffff" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8">
          {data.headline && <h2 className="text-3xl font-bold text-gray-900">{data.headline}</h2>}
          {data.subtext && <p className="text-gray-600 mt-3">{data.subtext}</p>}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {products.map((product, i) => (
            <article key={`${product.title}-${i}`} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              {product.imageUrl && <img src={product.imageUrl} alt="" className="w-full h-44 object-cover" />}
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${product.type === "physical" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {product.type === "physical" ? <Truck size={12} /> : <Package size={12} />}
                    {product.type === "physical" ? "Physical" : "Digital"}
                  </span>
                  <div className="text-right">
                    {(product as any).strikethroughPrice && (
                      <div className="text-sm text-red-500 line-through font-medium">{(product as any).strikethroughPrice}</div>
                    )}
                    <span className="text-2xl font-bold" style={{ color: accentColor }}>{product.price}</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900">{product.title}</h3>
                <p className="text-sm text-gray-600 mt-2">{product.description}</p>
                {product.fulfillment && <p className="text-xs text-gray-500 mt-3">{product.fulfillment}</p>}
                <Button
                  onClick={() => openLink(product.ctaLink, onPrimaryCta)}
                  className="w-full mt-5 text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" /> {product.ctaText}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * InlineOrderBumpBlock
 * Matches the allaboutultrasound.net checkout order bump design:
 * - Product image on left
 * - Shipping/delivery notice at top
 * - Product title + description in center
 * - Price on top-right
 * - "+ Add" button on right
 * - Persuasive CTA text at bottom
 */
export function InlineOrderBumpBlock({ data, onPrimaryCta }: { data: Record<string, any>; onPrimaryCta?: () => void }) {
  const [added, setAdded] = useState(Boolean(data.defaultSelected));
  const accentColor = data.accentColor ?? "#179ca3";
  const productType: InlineOrderBumpProductType = data.productType ?? "digital";

  function handleAdd() {
    setAdded(true);
    onPrimaryCta?.();
  }

  function handleRemove() {
    setAdded(false);
  }

  return (
    <section id={data.anchorId ?? "order-bump"} className="px-4 py-6" style={{ backgroundColor: data.bgColor ?? "#ffffff" }}>
      <div className="max-w-3xl mx-auto rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Product Image */}
          {data.imageUrl && (
            <div className="flex-shrink-0">
              <img
                src={data.imageUrl}
                alt={data.headline ?? "Order bump product"}
                className="w-full sm:w-28 h-28 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Shipping/delivery notice */}
            {data.shippingNote && (
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {data.shippingNote}
              </p>
            )}

            {/* Product title */}
            <h3 className="text-base font-bold text-gray-900">
              {data.headline}
            </h3>

            {/* Description */}
            {data.description && (
              <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                {data.description}
              </p>
            )}

            {/* Persuasive CTA line */}
            {data.subheadline && (
              <p className="text-sm mt-2" style={{ color: accentColor }}>
                👉 {data.subheadline}
              </p>
            )}
          </div>

          {/* Price + Add Button */}
          <div className="flex-shrink-0 flex flex-col items-end justify-between gap-3 sm:min-w-[120px]">
            {/* Price */}
            <div className="text-right">
              {data.compareAtPrice && (
                <span className="text-sm text-gray-400 line-through mr-2">{data.compareAtPrice}</span>
              )}
              <span className="text-lg font-bold" style={{ color: accentColor }}>
                {data.price}
              </span>
            </div>

            {/* Add/Remove Button */}
            {!added ? (
              <Button
                onClick={handleAdd}
                variant="outline"
                className="whitespace-nowrap border-2 font-semibold"
                style={{ borderColor: accentColor, color: accentColor }}
              >
                <Plus size={16} className="mr-1" /> Add
              </Button>
            ) : (
              <Button
                onClick={handleRemove}
                className="whitespace-nowrap text-white font-semibold"
                style={{ backgroundColor: accentColor }}
              >
                <CheckCircle size={16} className="mr-1" /> Added
              </Button>
            )}
          </div>
        </div>

        {/* Discount badge if present */}
        {data.discountLabel && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#ef4444" }}>
              <Gift size={12} /> {data.discountLabel}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
