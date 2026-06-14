/**
 * ProductLanding.tsx
 * Public sales page for a single physical product — /products/:slug
 * Renders blocks from the page builder when available, otherwise falls back to
 * the standard layout using description / landingFeatures fields.
 *
 * Checkout modes:
 *  - "native"   → Stripe Checkout with shipping address collection (required)
 *  - "shopify"  → Shopify embed (buy button) or redirect to shopifyUrl
 *  - "external" → Redirect to externalCheckoutUrl
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Package, Check, ShoppingCart, ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useRef } from "react";
import { ImageLinkWrapper } from "@/components/BlockPreview";

// ─── Block type (matches builder) ─────────────────────────────────────────────
interface Block { id: string; type: string; data: Record<string, any>; }

// ─── Shopify Embed ─────────────────────────────────────────────────────────────
function ShopifyEmbed({ embedCode }: { embedCode: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = embedCode;
    // Re-execute any script tags in the embed
    const scripts = ref.current.querySelectorAll("script");
    scripts.forEach(oldScript => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [embedCode]);
  return <div ref={ref} className="shopify-embed-container" />;
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────
function ProductCountdownTimer({ mode, durationMinutes, targetDate, headline, textColor, bgColor }: { mode: string; durationMinutes?: number; targetDate?: string; headline?: string; textColor: string; bgColor: string }) {
  const endRef = useRef<number | null>(null);
  const [time, setTime] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  useEffect(() => {
    if (mode === "event" && targetDate) {
      endRef.current = new Date(targetDate).getTime();
    } else {
      const storageKey = `countdown_pl_${durationMinutes ?? 90}`;
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        endRef.current = Number(stored);
      } else {
        endRef.current = Date.now() + (durationMinutes ?? 90) * 60 * 1000;
        sessionStorage.setItem(storageKey, String(endRef.current));
      }
    }
    const tick = () => {
      if (!endRef.current) return;
      const diff = Math.max(0, endRef.current - Date.now());
      setTime({ days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), mins: Math.floor((diff % 3600000) / 60000), secs: Math.floor((diff % 60000) / 1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mode, durationMinutes, targetDate]);
  const units: Array<[string, number]> = mode === "event"
    ? [["Days", time.days], ["Hours", time.hours], ["Mins", time.mins], ["Secs", time.secs]]
    : [["Hours", time.hours], ["Mins", time.mins], ["Secs", time.secs]];
  return (
    <div className="px-8 py-10 text-center" style={{ backgroundColor: bgColor }}>
      {headline && <h2 className="text-2xl font-bold mb-6" style={{ color: textColor }} dangerouslySetInnerHTML={{ __html: headline }} />}
      <div className="flex justify-center gap-4">
        {units.map(([label, val]) => (
          <div key={label} className="bg-white/20 rounded-xl px-6 py-4 min-w-[80px]">
            <div className="text-4xl font-bold" style={{ color: textColor }}>{String(val).padStart(2, "0")}</div>
            <div className="text-sm opacity-80 mt-1" style={{ color: textColor }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Block Renderer ───────────────────────────────────────────────────────────
function RenderBlock({ block, onBuy, buying, price, slug }: {
  block: Block; onBuy: () => void; buying: boolean; price: string; slug: string;
}) {
  const d = block.data;
  switch (block.type) {
    case "hero": {
      const buttons = d.buttons ?? [{ text: "Buy Now", color: "#ffffff", textColor: "#179ca3", style: "filled" }];
      const bgType = d.bgType ?? (d.imageUrl ? "image" : "color");
      let bgStyle: React.CSSProperties = {};
      if (bgType === "image" && d.imageUrl) bgStyle = { backgroundImage: `url(${d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
      else if (bgType === "gradient") bgStyle = { background: `linear-gradient(${d.gradientDir ?? "to bottom right"}, ${d.gradientFrom ?? "#179ca3"}, ${d.gradientTo ?? "#0e4a50"})` };
      else if (bgType === "video") bgStyle = { backgroundColor: "#000" };
      else bgStyle = { backgroundColor: d.bgColor ?? "#179ca3" };
      const hasInlineMediaPL = !!d.inlineMediaUrl;
      const placementPL = d.inlineMediaPlacement ?? "right";
      const isHorizontalPL = placementPL === "left" || placementPL === "right";
      const heroTopBorderStylePL: React.CSSProperties = d.heroTopBorder
        ? { borderTop: `${d.heroTopBorderWidth ?? 4}px solid ${d.heroTopBorderColor ?? "#179ca3"}` }
        : {};
      const heroBottomBorderStylePL: React.CSSProperties = d.heroBottomBorder
        ? { borderBottom: `${d.heroBottomBorderWidth ?? 4}px solid ${d.heroBottomBorderColor ?? "#179ca3"}` }
        : {};
      const heroClickHandlerPL = d.heroClickable && d.heroBehavior && d.heroBehavior !== "next_funnel_step"
        ? () => {
            const beh = d.heroBehavior as string;
            if (beh === "url" && d.heroLink) window.open(d.heroLink, "_blank");
            else if (beh === "send_email" && d.heroEmail) window.location.href = `mailto:${d.heroEmail}`;
            else if (beh === "scroll_to_section" && d.heroScrollAnchor) {
              const el = document.getElementById(d.heroScrollAnchor.replace(/^#/, ""));
              el?.scrollIntoView({ behavior: "smooth" });
            } else if (beh === "download_file" && d.heroDownloadUrl) window.open(d.heroDownloadUrl, "_blank");
            else if (beh === "open_popup" && d.heroPopupUrl) window.open(d.heroPopupUrl, "_blank");
          }
        : undefined;
      return (
        <div className="hero-block relative px-8 py-20 overflow-hidden" style={{ ...bgStyle, ...heroTopBorderStylePL, ...heroBottomBorderStylePL, color: d.textColor ?? "#fff", textAlign: hasInlineMediaPL && isHorizontalPL ? "left" as const : (d.align ?? "left"), minHeight: `${d.heroMinHeight ?? 400}px`, cursor: heroClickHandlerPL ? "pointer" : undefined }} onClick={heroClickHandlerPL}>
          {bgType === "video" && d.videoUrl && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.videoUrl} /></video>
          )}
          <div className={`relative max-w-5xl mx-auto ${hasInlineMediaPL && isHorizontalPL ? "flex items-center gap-10" : ""} ${hasInlineMediaPL && placementPL === "left" ? "flex-row-reverse" : ""}`}>
            <div className={hasInlineMediaPL && isHorizontalPL ? "flex-1" : "max-w-3xl mx-auto"}>
              <h1 className="text-4xl font-bold mb-4 leading-tight">
                <span style={d.headlineColor ? { color: d.headlineColor } : undefined} dangerouslySetInnerHTML={{ __html: d.headline ?? "" }} />
                {d.headline2 && <><br /><span style={d.headline2Color ? { color: d.headline2Color } : undefined} dangerouslySetInnerHTML={{ __html: d.headline2 }} /></>}
              </h1>
              {d.subheadline && <p className="text-xl opacity-90 mb-8" dangerouslySetInnerHTML={{ __html: d.subheadline }} />}
              {!d.hideButtons && <div className="flex flex-wrap gap-3" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
                {buttons.map((btn: any, i: number) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <button onClick={btn.link ? () => { window.location.href = btn.link; } : onBuy}
                      disabled={buying}
                      className={`px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60 ${btn.animation && btn.animation !== "none" ? `animate-${btn.animation}-btn` : ""}`}
                      style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                      {buying ? "Processing…" : btn.text}
                    </button>
                    {btn.showStrikethrough && btn.strikethroughPrice && (
                      <span className="text-xs text-white/60 line-through">{btn.strikethroughPrice}</span>
                    )}
                    {btn.showOptOut && btn.optOutText && (
                      <a href={btn.optOutUrl || "#"} className="text-xs text-white/60 underline hover:text-white/80 cursor-pointer">{btn.optOutText}</a>
                    )}
                  </div>
                ))}
              </div>}
            </div>
            {hasInlineMediaPL && (
              <div className={isHorizontalPL ? "flex-1 max-w-md" : "mt-8 max-w-lg mx-auto"}>
                {d.inlineMediaType === "video" ? (
                  <video autoPlay muted loop playsInline className="w-full rounded-lg shadow-2xl"><source src={d.inlineMediaUrl} /></video>
                ) : (
                  <img src={d.inlineMediaUrl} alt="" className="w-full rounded-lg shadow-2xl" />
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    case "text":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-3xl mx-auto prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: d.content ?? "" }} />
        </div>
      );
    case "image": {
      const imgAlignPL = d.align ?? "center";
      const imgJustifyPL = imgAlignPL === "left" ? "flex-start" : imgAlignPL === "right" ? "flex-end" : "center";
      const mwPL = d.maxWidth ?? "auto";
      const imgStylePL: React.CSSProperties = { maxWidth: mwPL === "auto" ? "100%" : mwPL, width: mwPL === "auto" ? undefined : "100%", height: d.height || "auto", objectFit: "cover", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.noBorder ? "none" : (d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined) };
      const imgElPL = d.url ? <img src={d.url} alt={d.alt ?? ""} className={d.showShadow !== false ? "shadow" : ""} style={imgStylePL} /> : null;
      return imgElPL ? (
        <div className="px-8 py-6" style={{ backgroundColor: d.bgColor ?? "#ffffff", display: "flex", flexDirection: "column", alignItems: imgJustifyPL }}>
          <ImageLinkWrapper d={d}>{imgElPL}</ImageLinkWrapper>
          {d.caption && <p className="text-sm text-gray-500 mt-2" style={{ textAlign: imgAlignPL as any }}>{d.caption}</p>}
        </div>
      ) : null;
    }
    case "bullets":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          <div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <ul className="space-y-3">
              {(d.items ?? []).map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: d.iconColor ?? "#179ca3" }} />
                  <span className="text-gray-700" dangerouslySetInnerHTML={{ __html: item }} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "pricing_cta":
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-3 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          {d.showPrice && <div className="text-3xl font-bold text-teal-700 mb-4">{price}</div>}
          <button onClick={onBuy} disabled={buying}
            className={`px-10 py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-60 transition-opacity hover:opacity-90 ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`}
            style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>
            {buying ? "Processing…" : (d.ctaText ?? "Buy Now")}
          </button>
        </div>
      );
    case "two_col":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
            <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: d.leftContent ?? "" }} />
            <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: d.rightContent ?? "" }} />
          </div>
        </div>
      );
    case "testimonials":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(d.items ?? []).map((t: any, i: number) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <p className="text-gray-700 italic mb-4">"{t.quote}"</p>
                <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                {t.title && <p className="text-gray-500 text-xs">{t.title}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    case "countdown": {
      const resolvedMode = d.mode ?? (d.targetDate ? "event" : "on_load");
      return <ProductCountdownTimer mode={resolvedMode} durationMinutes={d.durationMinutes} targetDate={d.targetDate} headline={d.headline} textColor={d.textColor ?? "#fff"} bgColor={d.bgColor ?? "#179ca3"} />;
    }
    case "divider":
      return <div style={{ height: `${d.height ?? 2}px`, backgroundColor: d.color ?? "#e5e7eb", margin: `${d.marginY ?? 0}px 0` }} />;
    case "spacer":
      return <div style={{ height: `${d.height ?? 40}px` }} />;
    case "footer": {
      const footerLinks: Array<{ text: string; url: string }> = d.links ?? [];
      return (
        <footer style={{ backgroundColor: d.bgColor ?? "#0e1e2e", color: d.textColor ?? "#ffffff" }} className="px-6 py-8">
          {d.logoUrl && <div className="flex justify-center mb-4"><img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.logoMaxWidth ?? "120px" }} className="object-contain" /></div>}
          {footerLinks.length > 0 && <div className="flex flex-wrap justify-center gap-4 mb-4">{footerLinks.map((l, i) => <a key={i} href={l.url} className="text-sm opacity-80 hover:opacity-100 underline" style={{ color: d.textColor ?? "#ffffff" }}>{l.text}</a>)}</div>}
          <p className="text-xs text-center opacity-60">{d.copyrightText ?? `© ${new Date().getFullYear()} All rights reserved.`}</p>
        </footer>
      );
    }
    default:
      return null;
  }
}

// ─── Pricing Option Selector ──────────────────────────────────────────────────
function PricingOptionSelector({
  options,
  selectedId,
  onSelect,
}: {
  options: any[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700 mb-2">Select an option:</p>
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-colors text-left ${
            selectedId === opt.id
              ? "border-teal-500 bg-teal-50"
              : "border-gray-200 hover:border-teal-300"
          }`}
        >
          <span className="font-medium text-gray-900">{opt.label}</span>
          <span className="font-bold text-teal-700">${Number(opt.price).toFixed(2)}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProductLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const isPreview = new URLSearchParams(window.location.search).get("preview") === "admin";

  const { data, isLoading, error } = trpc.products.getBySlug.useQuery(
    { slug: slug!, preview: isPreview || undefined },
    { enabled: !!slug }
  );
  const product = data?.product;
  const pricingOptions = data?.pricingOptions ?? [];

  const [selectedPricingOptionId, setSelectedPricingOptionId] = useState<number | null>(null);

  // Auto-select first pricing option if available
  useEffect(() => {
    if (pricingOptions.length > 0 && !selectedPricingOptionId) {
      setSelectedPricingOptionId(pricingOptions[0].id);
    }
  }, [pricingOptions.length]);

  const checkoutMut = trpc.productsLearner.createCheckout.useMutation({
    onSuccess: (result: any) => {
      if (result.free) {
        toast.success("Order placed!");
      } else if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
        toast.info("Redirecting to checkout...");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h2 className="text-xl font-semibold text-gray-700">Product Not Found</h2>
          <p className="text-gray-500 mt-1">This product may have been removed or is not yet available.</p>
          <Link href="/products">
            <Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1" /> Browse Products</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Resolve display price
  const selectedOption = pricingOptions.find((o: any) => o.id === selectedPricingOptionId);
  const displayPrice = product.isFree
    ? "Free"
    : selectedOption
      ? `$${Number(selectedOption.price).toFixed(2)}`
      : `$${Number(product.price).toFixed(2)}`;

  const handleBuy = () => {
    if (product.checkoutMode === "shopify" && product.shopifyProductUrl && !product.shopifyEmbedCode) {
      window.open(product.shopifyProductUrl, "_blank");
      return;
    }
    if (product.checkoutMode === "external" && product.externalCheckoutUrl) {
      window.open(product.externalCheckoutUrl, "_blank");
      return;
    }
    // Native Stripe checkout
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    checkoutMut.mutate({
      productId: product.id,
      pricingOptionId: selectedPricingOptionId ?? undefined,
    });
  };

  const features = product.landingFeatures ? product.landingFeatures.split("\n").filter(Boolean) : [];

  // ── Parse landing page blocks ──
  let blocks: Block[] = [];
  if (product.landingBlocks) {
    try { blocks = typeof product.landingBlocks === "string" ? JSON.parse(product.landingBlocks) : product.landingBlocks; } catch { blocks = []; }
  }

  // ── Shopify embed mode ──
  if (product.checkoutMode === "shopify" && product.shopifyEmbedCode) {
    // If there are builder blocks, render them with the Shopify embed injected
    if (blocks.length > 0) {
      return (
        <div className="min-h-screen bg-white">
          {blocks.map(block => (
            <div key={block.id}>
              <RenderBlock block={block} onBuy={handleBuy} buying={checkoutMut.isPending} price={displayPrice} slug={slug!} />
            </div>
          ))}
          <div className="max-w-2xl mx-auto px-4 py-12">
            <ShopifyEmbed embedCode={product.shopifyEmbedCode} />
          </div>
        </div>
      );
    }
    // Fallback: standard layout with Shopify embed
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white py-16">
          <div className="max-w-4xl mx-auto px-4">
            <Link href="/products" className="text-teal-200 hover:text-white text-sm inline-flex items-center gap-1 mb-4">
              <ArrowLeft className="w-3 h-3" /> All Products
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold">{product.title}</h1>
            {product.subtitle && <p className="text-teal-100 text-lg mt-3">{product.subtitle}</p>}
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              {product.description && <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />}
            </div>
            <div>
              <Card>
                <CardContent className="p-6">
                  <ShopifyEmbed embedCode={product.shopifyEmbedCode} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Blocks-based rendering ──
  if (blocks.length > 0) {
    return (
      <div className="min-h-screen bg-white">
        {blocks.map(block => (
          <div key={block.id}>
            <RenderBlock block={block} onBuy={handleBuy} buying={checkoutMut.isPending} price={displayPrice} slug={slug!} />
          </div>
        ))}
        {/* Pricing options selector below blocks if multiple options */}
        {pricingOptions.length > 1 && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            <PricingOptionSelector
              options={pricingOptions}
              selectedId={selectedPricingOptionId}
              onSelect={setSelectedPricingOptionId}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Fallback: standard layout ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          <Link href="/products" className="text-teal-200 hover:text-white text-sm inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="w-3 h-3" /> All Products
          </Link>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                {product.landingHeadline || product.title}
              </h1>
              {product.subtitle && <p className="text-teal-100 text-lg mt-3">{product.subtitle}</p>}
              <div className="flex items-center gap-3 mt-6">
                <span className="text-3xl font-bold">{displayPrice}</span>
                {product.isFree && <Badge className="bg-teal-500 text-white">Free</Badge>}
              </div>
              {/* Pricing options */}
              {pricingOptions.length > 1 && (
                <div className="mt-4 max-w-sm">
                  <PricingOptionSelector
                    options={pricingOptions}
                    selectedId={selectedPricingOptionId}
                    onSelect={setSelectedPricingOptionId}
                  />
                </div>
              )}
              <div className="mt-6">
                {product.checkoutMode === "shopify" && product.shopifyProductUrl ? (
                  <a href={product.shopifyProductUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50">
                      <ExternalLink className="w-5 h-5 mr-2" /> Buy on Shopify
                    </Button>
                  </a>
                ) : product.checkoutMode === "external" && product.externalCheckoutUrl ? (
                  <a href={product.externalCheckoutUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50">
                      <ExternalLink className="w-5 h-5 mr-2" /> Buy Now
                    </Button>
                  </a>
                ) : (
                  <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50" onClick={handleBuy} disabled={checkoutMut.isPending}>
                    <ShoppingCart className="w-5 h-5 mr-2" /> {checkoutMut.isPending ? "Processing..." : product.isFree ? "Get It Free" : `Buy Now — ${displayPrice}`}
                  </Button>
                )}
              </div>
            </div>
            {product.thumbnailUrl && (
              <div className="w-full md:w-64 flex-shrink-0">
                <img src={product.thumbnailUrl} alt={product.title} className="rounded-xl shadow-2xl w-full" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {product.description && (
              <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
            )}
            {features.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">What's Included</h3>
                  <ul className="space-y-3">
                    {features.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-teal-700 mb-2">{displayPrice}</div>
                {pricingOptions.length > 1 && (
                  <div className="mb-4 text-left">
                    <PricingOptionSelector
                      options={pricingOptions}
                      selectedId={selectedPricingOptionId}
                      onSelect={setSelectedPricingOptionId}
                    />
                  </div>
                )}
                {product.checkoutMode === "shopify" && product.shopifyProductUrl ? (
                  <a href={product.shopifyProductUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Button className="w-full" size="lg">
                      <ExternalLink className="w-4 h-4 mr-2" /> Buy on Shopify
                    </Button>
                  </a>
                ) : product.checkoutMode === "external" && product.externalCheckoutUrl ? (
                  <a href={product.externalCheckoutUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Button className="w-full" size="lg">
                      <ExternalLink className="w-4 h-4 mr-2" /> Buy Now
                    </Button>
                  </a>
                ) : (
                  <Button className="w-full" size="lg" onClick={handleBuy} disabled={checkoutMut.isPending}>
                    {checkoutMut.isPending ? "Processing..." : product.isFree ? "Get It Free" : "Buy Now"}
                  </Button>
                )}
                <p className="text-xs text-gray-400 mt-3">
                  {product.checkoutMode === "native" ? "Secure checkout — shipping address required" : ""}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
