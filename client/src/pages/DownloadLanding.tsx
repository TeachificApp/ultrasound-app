/**
 * DownloadLanding.tsx
 * Public landing/sales page for a single digital product — /downloads/:slug
 * Renders blocks from the page builder when available, otherwise falls back to the
 * standard layout using landingBody / landingFeatures fields.
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FileDown, Check, ShoppingCart, Download, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import OrderBumpOffer from "@/components/OrderBumpOffer";
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";
import { useState } from "react";

// ─── Block type (matches builder) ─────────────────────────────────────────────
interface Block { id: string; type: string; data: Record<string, any>; }

// ─── Block Renderer ───────────────────────────────────────────────────────────
function RenderBlock({ block, onBuy, buying, price, hasPurchased, slug }: {
  block: Block; onBuy: () => void; buying: boolean; price: string; hasPurchased: boolean; slug: string;
}) {
  const d = block.data;
  switch (block.type) {
    case "hero": {
      const buttons = d.buttons ?? [{ text: "Buy Now", color: "#ffffff", textColor: "#179ca3", style: "filled" }];
      const bgType = d.bgType ?? (d.imageUrl ? "image" : "color");
      let bgStyle: React.CSSProperties = {};
      if (bgType === "image" && d.imageUrl) bgStyle = { backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
      else if (bgType === "gradient") bgStyle = { background: `linear-gradient(${d.gradientDir ?? "to bottom right"}, ${d.gradientFrom ?? "#179ca3"}, ${d.gradientTo ?? "#0e4a50"})` };
      else if (bgType === "video") bgStyle = { backgroundColor: "#000" };
      else bgStyle = { backgroundColor: d.bgColor ?? "#179ca3" };
      const hasInlineMedia = !!d.inlineMediaUrl;
      const placement = d.inlineMediaPlacement ?? "right";
      const isHorizontal = placement === "left" || placement === "right";
      return (
        <div style={{ ...bgStyle, color: d.textColor ?? "#fff", textAlign: hasInlineMedia && isHorizontal ? "left" as const : (d.align ?? "left") }} className="relative px-8 py-20 overflow-hidden">
          {bgType === "video" && d.videoUrl && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.videoUrl} /></video>
          )}
          <div className={`relative max-w-5xl mx-auto ${hasInlineMedia && isHorizontal ? "flex items-center gap-10" : ""} ${hasInlineMedia && placement === "left" ? "flex-row-reverse" : ""}`}>
            <div className={hasInlineMedia && isHorizontal ? "flex-1" : "max-w-4xl mx-auto"}>
              <h1 className="text-4xl font-bold mb-4 leading-tight animate-fade-slide-up">
                <span style={d.headlineColor ? { color: d.headlineColor } : undefined} dangerouslySetInnerHTML={{ __html: d.headline ?? '' }} />
                {d.headline2 && <><br /><span style={d.headline2Color ? { color: d.headline2Color } : undefined} dangerouslySetInnerHTML={{ __html: d.headline2 }} /></>}
              </h1>
              {d.subheadline && <p className="text-xl opacity-90 mb-8 animate-fade-slide-up-delay-1" dangerouslySetInnerHTML={{ __html: d.subheadline }} />}
              {!d.hideButtons && <div className="flex flex-wrap gap-3 animate-fade-slide-up-delay-2" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
                {buttons.map((btn: any, i: number) => (
                  <button key={i} onClick={btn.link ? () => { window.location.href = btn.link; } : hasPurchased ? () => { window.location.href = `/downloads/${slug}/files`; } : onBuy}
                    disabled={buying}
                    className="px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                    {hasPurchased ? "Access Files" : btn.text}
                  </button>
                ))}
              </div>}
            </div>
            {hasInlineMedia && (
              <div className={`animate-fade-slide-up-delay-1 ${isHorizontal ? "flex-1 max-w-md" : "mt-8 max-w-lg mx-auto"}`}>
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
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff", color: d.textColor ?? "#1a1a1a", textAlign: d.align ?? "left" }}>
          <div className="max-w-3xl mx-auto prose" dangerouslySetInnerHTML={{ __html: d.html ?? "" }} />
        </div>
      );
    case "image":
      return (
        <div className="px-8 py-6 text-center">
          {d.url && <img src={d.url} alt={d.alt ?? ""} className="mx-auto shadow" style={{ maxWidth: d.maxWidth ?? "100%", height: d.height || "auto", objectFit: "cover", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined }} />}
          {d.caption && <p className="text-sm text-gray-500 mt-2">{d.caption}</p>}
        </div>
      );
    case "video": {
      let embedUrl = d.url ?? "";
      if (embedUrl.includes("youtube.com/watch")) {
        const vid = new URL(embedUrl).searchParams.get("v");
        embedUrl = `https://www.youtube.com/embed/${vid}`;
      } else if (embedUrl.includes("youtu.be/")) {
        embedUrl = `https://www.youtube.com/embed/${embedUrl.split("youtu.be/")[1]}`;
      }
      return (
        <div className="px-8 py-6 max-w-4xl mx-auto">
          {embedUrl && (
            <div className="relative w-full overflow-hidden shadow" style={{ paddingBottom: d.height ? undefined : "56.25%", height: d.height || undefined, borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined }}>
              <iframe src={embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen title="Video" />
            </div>
          )}
        </div>
      );
    }
    case "bullets":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          <div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(d.items ?? []).map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-lg" style={{ color: d.iconColor ?? "#179ca3" }}>✓</span>
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "numbered_list":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-2xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <div className="space-y-4">
              {(d.items ?? []).map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{i + 1}</span>
                  <span className="text-gray-700 pt-1">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "testimonial":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f0fdfa" }}>
          <div className="max-w-2xl mx-auto text-center">
            <blockquote className="text-xl italic text-gray-700 mb-4">"{d.quote}"</blockquote>
            <div className="flex items-center justify-center gap-3">
              {d.avatarUrl && <img src={d.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />}
              <div>
                <p className="font-semibold text-gray-900">{d.author}</p>
                {d.role && <p className="text-sm text-gray-500">{d.role}</p>}
              </div>
            </div>
          </div>
        </div>
      );
    case "pricing_cta":
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-3xl font-bold text-gray-900 mb-3" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-gray-600 mb-6 max-w-xl mx-auto" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          {d.showPrice && <p className="text-4xl font-bold mb-6" style={{ color: d.ctaColor ?? "#179ca3" }}>{price}</p>}
          <button
            onClick={hasPurchased ? () => { window.location.href = `/downloads/${slug}/files`; } : onBuy}
            disabled={buying}
            className="px-10 py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-60 transition-opacity hover:opacity-90"
            style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}
          >
            {buying ? "Processing…" : hasPurchased ? "Access Your Files" : (d.ctaText ?? `Buy Now — ${price}`)}
          </button>
        </div>
      );
    case "funnel_workflow":
      return <FunnelWorkflowBlock data={d} />;
    case "product_offer_stack":
      return <ProductOfferStackBlock data={d} onPrimaryCta={onBuy} />;
    case "order_bump_checkout":
      return <InlineOrderBumpBlock data={d} onPrimaryCta={onBuy} />;
    case "cta_standalone":
      return (
        <div className="px-8 py-8" style={{ textAlign: d.align ?? "center" }}>
          <button
            onClick={d.link ? () => { window.location.href = d.link; } : hasPurchased ? () => { window.location.href = `/downloads/${slug}/files`; } : onBuy}
            disabled={buying}
            className={`inline-block px-8 py-3 rounded-lg font-semibold shadow disabled:opacity-60 transition-opacity hover:opacity-90 ${d.size === "lg" ? "text-lg px-10 py-4" : ""}`}
            style={{ backgroundColor: d.color ?? "#179ca3", color: d.textColor ?? "#fff" }}
          >
            {hasPurchased ? "Access Files" : (d.text ?? "Buy Now")}
          </button>
        </div>
      );
    case "faq":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <div className="space-y-2">
              {(d.items ?? []).map((item: any, i: number) => (
                <details key={i} className="group border border-gray-200 rounded-lg overflow-hidden">
                  <summary className="px-5 py-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-50">{item.q}</summary>
                  <div className="px-5 py-4 text-gray-600 border-t border-gray-100">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      );
    case "alert": {
      const alertStyles: Record<string, string> = { info: "bg-blue-50 border-blue-300 text-blue-800", success: "bg-green-50 border-green-300 text-green-800", warning: "bg-yellow-50 border-yellow-300 text-yellow-800", error: "bg-red-50 border-red-300 text-red-800" };
      return (
        <div className={`mx-8 my-4 px-5 py-4 rounded-lg border-l-4 flex items-start gap-3 ${alertStyles[d.type ?? "info"] ?? alertStyles.info}`}>
          <p className="font-medium">{d.title && <strong>{d.title}: </strong>}{d.message}</p>
        </div>
      );
    }
    case "reviews":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-4xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <div className="grid md:grid-cols-2 gap-4">
              {(d.items ?? []).map((item: any, i: number) => (
                <div key={i} className="p-5 rounded-lg border bg-white shadow-sm">
                  <div className="flex items-center gap-1 mb-2">
                    {Array.from({ length: item.rating ?? 5 }).map((_, j) => <span key={j} className="text-yellow-400">★</span>)}
                  </div>
                  <p className="text-gray-700 text-sm mb-2">{item.text}</p>
                  <p className="text-xs font-semibold text-gray-500">— {item.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "icon_grid":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-4xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
              {(d.items ?? []).map((item: any, i: number) => (
                <div key={i} className="text-center p-4">
                  <div className="text-4xl mb-3">{item.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "gallery":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="grid gap-4 max-w-4xl mx-auto" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
            {(d.images ?? []).map((img: string, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden shadow">
                <img src={img} alt="" className="w-full h-40 object-cover" />
              </div>
            ))}
          </div>
        </div>
      );
    case "two_column":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-4xl mx-auto grid gap-8" style={{ gridTemplateColumns: `${d.leftRatio ?? 50}% 1fr` }}>
            <div className="prose" dangerouslySetInnerHTML={{ __html: d.leftHtml ?? "" }} />
            <div className="prose" dangerouslySetInnerHTML={{ __html: d.rightHtml ?? "" }} />
          </div>
        </div>
      );
    case "divided_columns": {
      const cols = d.columns ?? [{ html: "" }, { html: "" }];
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-5xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: `${d.gap ?? 32}px` }}>
            {cols.map((col: any, i: number) => (
              <div key={i} className="prose" dangerouslySetInnerHTML={{ __html: col.html ?? "" }} />
            ))}
          </div>
        </div>
      );
    }
    case "embed":
      return (
        <div className="px-8 py-6">
          <div className="max-w-4xl mx-auto">
            {d.embedCode ? (
              <div dangerouslySetInnerHTML={{ __html: d.embedCode }} style={{ height: d.height ?? 400 }} />
            ) : (
              <div className="w-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-400" style={{ height: d.height ?? 400 }}>Embed placeholder</div>
            )}
            {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
          </div>
        </div>
      );
    case "three_column": {
      const divStyle3 = d.showDividers ? { borderRightWidth: `${d.dividerWidth ?? 1}px`, borderRightStyle: (d.dividerStyle ?? "solid") as any, borderRightColor: d.dividerColor ?? "#e5e7eb", borderRadius: d.dividerRadius ? `${d.dividerRadius}px` : undefined } : {};
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            <div className="prose prose-lg pr-4" style={divStyle3} dangerouslySetInnerHTML={{ __html: d.col1Html ?? "" }} />
            <div className="prose prose-lg px-4" style={divStyle3} dangerouslySetInnerHTML={{ __html: d.col2Html ?? "" }} />
            <div className="prose prose-lg pl-4" dangerouslySetInnerHTML={{ __html: d.col3Html ?? "" }} />
          </div>
        </div>
      );
    }
    case "spacer":
      return <div style={{ height: d.height ?? 48 }} />;
    case "divider":
      return (
        <div style={{ padding: `${(d.spacing ?? 32) / 2}px 2rem` }}>
          <hr style={{ borderColor: d.color ?? "#e5e7eb", borderWidth: `${d.thickness ?? 1}px 0 0 0`, borderRadius: d.borderRadius ? `${d.borderRadius}px` : undefined }} />
        </div>
      );
    case "logo_strip": {
      const logoAlign = d.align ?? "center";
      return (
        <div style={{ backgroundColor: d.bgColor ?? "#ffffff", padding: d.padding ?? "16px 0" }}>
          <div className={`flex ${logoAlign === "left" ? "justify-start" : logoAlign === "right" ? "justify-end" : "justify-center"} px-6`}>
            {d.logoUrl ? (d.link ? <a href={d.link}><img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.maxWidth ?? "200px", height: "auto" }} className="object-contain" /></a> : <img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.maxWidth ?? "200px", height: "auto" }} className="object-contain" />) : null}
          </div>
        </div>
      );
    }
    case "footer": {
      const footerLinks: Array<{ text: string; url: string }> = d.links ?? [];
      const socialLinks = d.socialLinks ?? {};
      return (
        <footer style={{ backgroundColor: d.bgColor ?? "#0e1e2e", color: d.textColor ?? "#ffffff" }} className="px-6 py-8">
          {d.logoUrl && <div className="flex justify-center mb-4"><img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.logoMaxWidth ?? "120px" }} className="object-contain" /></div>}
          {footerLinks.length > 0 && <div className="flex flex-wrap justify-center gap-4 mb-4">{footerLinks.map((l, i) => <a key={i} href={l.url} className="text-sm opacity-80 hover:opacity-100 underline" style={{ color: d.textColor ?? "#ffffff" }}>{l.text}</a>)}</div>}
          {d.showSocial && (socialLinks.facebook || socialLinks.instagram || socialLinks.youtube || socialLinks.linkedin) && (
            <div className="flex justify-center gap-4 mb-4">
              {socialLinks.facebook && <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100">FB</a>}
              {socialLinks.instagram && <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100">IG</a>}
              {socialLinks.youtube && <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100">YT</a>}
              {socialLinks.linkedin && <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100">LI</a>}
            </div>
          )}
          <p className="text-xs text-center opacity-60">{d.copyrightText ?? "\u00a9 2026 All rights reserved."}</p>
        </footer>
      );
    }
    default:
      return null;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DownloadLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [selectedOrderBumpId, setSelectedOrderBumpId] = useState<number | undefined>();
  const { data: product, isLoading, error } = trpc.downloads.getBySlug.useQuery({ slug: slug! });

  // Check if user has purchased (only if logged in and product loaded)
  const { data: purchaseStatus } = trpc.downloadsLearner.hasPurchased.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: !!user && !!product }
  );

  const checkoutMut = trpc.downloadsLearner.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.free || data.alreadyPurchased) {
        window.location.href = `/downloads/${slug}/files?success=1`;
      } else if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.info("Redirecting to checkout...");
      }
    },
    onError: (e) => toast.error(e.message),
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
          <FileDown className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h2 className="text-xl font-semibold text-gray-700">Product Not Found</h2>
          <p className="text-gray-500 mt-1">This download may have been removed or is not yet available.</p>
          <Link href="/downloads"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1" /> Browse Downloads</Button></Link>
        </div>
      </div>
    );
  }

  const price = product.isFree ? "Free" : `$${(product.price / 100).toFixed(2)}`;
  const hasPurchased = purchaseStatus?.purchased || product.isFree;
  const features = product.landingFeatures ? product.landingFeatures.split("\n").filter(Boolean) : [];

  const handleBuy = () => {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    checkoutMut.mutate({ productId: product.id, orderBumpId: selectedOrderBumpId });
  };

  // ── Parse landing page blocks ──
  let blocks: Block[] = [];
  if (product.landingBlocks) {
    try { blocks = typeof product.landingBlocks === "string" ? JSON.parse(product.landingBlocks) : product.landingBlocks; } catch { blocks = []; }
  }

  // ── Blocks-based rendering ──
  if (blocks.length > 0) {
    return (
      <div className="min-h-screen bg-white">
        {blocks.map(block => (
          <div key={block.id} style={{ marginTop: block.data?.marginTop ? `${block.data.marginTop}px` : undefined, marginBottom: block.data?.marginBottom ? `${block.data.marginBottom}px` : undefined, paddingTop: block.data?.paddingTop ? `${block.data.paddingTop}px` : undefined, paddingBottom: block.data?.paddingBottom ? `${block.data.paddingBottom}px` : undefined, paddingLeft: block.data?.paddingLeft ? `${block.data.paddingLeft}px` : undefined, paddingRight: block.data?.paddingRight ? `${block.data.paddingRight}px` : undefined }}>
            <RenderBlock block={block} onBuy={handleBuy} buying={checkoutMut.isPending} price={price} hasPurchased={hasPurchased} slug={slug!} />
          </div>
        ))}
        {/* Before-checkout order bump */}
        {!hasPurchased && product && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            <OrderBumpOffer
              triggerType="download"
              triggerProductId={product.id}
              timing="before_checkout"
              onAccept={(bump) => setSelectedOrderBumpId(bump.bumpId)}
              onDecline={() => setSelectedOrderBumpId(undefined)}
            />
            {selectedOrderBumpId && (
              <div className="mt-3 text-center">
                <Button onClick={handleBuy} disabled={checkoutMut.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
                  Continue to checkout with selected bump
                </Button>
              </div>
            )}
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
          <Link href="/downloads" className="text-teal-200 hover:text-white text-sm inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="w-3 h-3" /> All Downloads
          </Link>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                {product.landingHeadline || product.title}
              </h1>
              {product.subtitle && <p className="text-teal-100 text-lg mt-3">{product.subtitle}</p>}
              <div className="flex items-center gap-3 mt-6">
                <span className="text-3xl font-bold">{price}</span>
                {product.isFree && <Badge className="bg-teal-500 text-white">Free</Badge>}
              </div>
              <div className="mt-6">
                {hasPurchased ? (
                  <Link href={`/downloads/${slug}/files`}>
                    <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50">
                      <Download className="w-5 h-5 mr-2" /> Access Your Files
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50" onClick={handleBuy} disabled={checkoutMut.isPending}>
                    <ShoppingCart className="w-5 h-5 mr-2" /> {checkoutMut.isPending ? "Processing..." : product.isFree ? "Get It Free" : `Buy Now — ${price}`}
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
          {/* Main content */}
          <div className="md:col-span-2 space-y-8">
            {product.landingBody && (
              <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: product.landingBody }} />
            )}

            {product.description && !product.landingBody && (
              <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
            )}

            {/* Features */}
            {features.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">What's Included</h3>
                  <ul className="space-y-3">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Files preview */}
            {product.files && product.files.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Files You'll Receive ({product.files.length})</h3>
                  <div className="space-y-2">
                    {product.files.map((f: any) => (
                      <div key={f.id} className="flex items-center gap-3 p-2 rounded bg-gray-50 border">
                        <FileDown className="w-4 h-4 text-teal-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700">{f.fileName}</span>
                        {f.fileSize > 0 && (
                          <span className="text-xs text-gray-400 ml-auto">
                            {f.fileSize < 1024 * 1024 ? `${(f.fileSize / 1024).toFixed(0)} KB` : `${(f.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-teal-700 mb-2">{price}</div>
                {hasPurchased ? (
                  <Link href={`/downloads/${slug}/files`}>
                    <Button className="w-full" size="lg">
                      <Download className="w-4 h-4 mr-2" /> Access Files
                    </Button>
                  </Link>
                ) : (
                  <Button className="w-full" size="lg" onClick={handleBuy} disabled={checkoutMut.isPending}>
                    {checkoutMut.isPending ? "Processing..." : product.isFree ? "Get It Free" : "Buy Now"}
                  </Button>
                )}
                <p className="text-xs text-gray-400 mt-3">Instant digital delivery</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
