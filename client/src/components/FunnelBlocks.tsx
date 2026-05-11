import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Gift, Package, ShoppingCart, Truck } from "lucide-react";

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
                  <span className="text-2xl font-bold" style={{ color: accentColor }}>{product.price}</span>
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

export function InlineOrderBumpBlock({ data, onPrimaryCta }: { data: Record<string, any>; onPrimaryCta?: () => void }) {
  const [selected, setSelected] = useState(Boolean(data.defaultSelected));
  const accentColor = data.accentColor ?? "#f59e0b";
  const features: string[] = data.features?.length ? data.features : [];
  const productType: InlineOrderBumpProductType = data.productType ?? "digital";

  return (
    <section id={data.anchorId ?? "order-bump"} className="px-8 py-10" style={{ backgroundColor: data.bgColor ?? "#fff7ed" }}>
      <div className="max-w-3xl mx-auto rounded-2xl border-2 border-dashed bg-white p-6 shadow-sm" style={{ borderColor: accentColor }}>
        <div className="flex flex-col md:flex-row gap-5">
          {data.imageUrl && <img src={data.imageUrl} alt="" className="w-full md:w-40 h-40 object-cover rounded-xl" />}
          <div className="flex-1">
            {data.discountLabel && <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold text-white mb-3" style={{ backgroundColor: accentColor }}>{data.discountLabel}</span>}
            <div className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: accentColor }}>
              <Gift size={16} /> Order bump
              <span className="text-gray-400">|</span>
              <span>{productType === "physical" ? "Physical shipment" : "Digital delivery"}</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{data.headline}</h3>
            {data.subheadline && <p className="text-gray-600 mt-2">{data.subheadline}</p>}
            {data.description && <p className="text-sm text-gray-700 mt-4">{data.description}</p>}
            {features.length > 0 && (
              <ul className="grid md:grid-cols-2 gap-2 mt-4 text-sm text-gray-700">
                {features.map((feature, i) => (
                  <li key={`${feature}-${i}`} className="flex items-start gap-2">
                    <CheckCircle size={15} className="mt-0.5 flex-shrink-0" style={{ color: accentColor }} />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            <label className="flex items-start gap-3 mt-5 p-4 rounded-xl border bg-amber-50 cursor-pointer">
              <input type="checkbox" checked={selected} onChange={(e) => setSelected(e.target.checked)} className="mt-1" />
              <span className="text-sm text-gray-800">
                <strong>{data.checkboxLabel ?? "Yes, add this to my order"}</strong>
                <span className="block text-gray-600 mt-0.5">
                  {data.compareAtPrice && <span className="line-through mr-2">{data.compareAtPrice}</span>}
                  <span className="font-bold" style={{ color: accentColor }}>{data.price}</span>
                  {productType === "physical" && data.shippingNote ? ` - ${data.shippingNote}` : ""}
                </span>
              </span>
            </label>
            <Button
              onClick={onPrimaryCta}
              className="w-full mt-4 text-white"
              style={{ backgroundColor: selected ? accentColor : data.ctaColor ?? "#179ca3" }}
            >
              {selected ? data.ctaText ?? "Add bump and continue" : data.skipText ?? "Continue without bump"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
