/**
 * DownloadLanding.tsx
 * Public landing/sales page for a single digital product — /downloads/:slug
 * Renders blocks from the page builder when available, otherwise falls back to the
 * standard layout using landingBody / landingFeatures fields.
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { ButtonSubtext } from "@/lib/ctaSubtext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FileDown, Check, ShoppingCart, Download, ArrowLeft, Users, Globe } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import OrderBumpOffer from "@/components/OrderBumpOffer";
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";
import { RelatedProductsBlock } from "@/components/RelatedProductsBlock";
import CarouselBlock from "@/components/CarouselBlock";
import { useState, useEffect, useRef } from "react";
import PromoCodeInput from "@/components/PromoCodeInput";
import { injectUserParams, injectUserParamsIntoHtml, type UserParamSource } from "@/lib/userUrlParams";

// ─── Block type (matches builder) ─────────────────────────────────────────────
interface Block { id: string; type: string; data: Record<string, any>; }

// ─── Countdown Timer ─────────────────────────────────────────────────────────
function CountdownTimer({ mode, durationMinutes, targetDate, textColor }: { mode?: string; durationMinutes?: number; targetDate?: string; textColor: string }) {
  const endRef = useRef<number | null>(null);
  const [time, setTime] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const resolvedMode = mode ?? (targetDate ? "event" : "on_load");
  useEffect(() => {
    if (resolvedMode === "event" && targetDate) {
      endRef.current = new Date(targetDate).getTime();
    } else {
      const storageKey = `countdown_dl_${durationMinutes ?? 90}`;
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
  }, [resolvedMode, durationMinutes, targetDate]);
  const units: Array<[string, number]> = resolvedMode === "event"
    ? [["Days", time.days], ["Hours", time.hours], ["Mins", time.mins], ["Secs", time.secs]]
    : [["Hours", time.hours], ["Mins", time.mins], ["Secs", time.secs]];
  return (
    <div className="flex justify-center gap-4">
      {units.map(([label, val]) => (
        <div key={label} className="bg-white/20 rounded-xl px-6 py-4 min-w-[80px] text-center">
          <div className="text-4xl font-bold" style={{ color: textColor }}>{String(val).padStart(2, "0")}</div>
          <div className="text-sm opacity-80 mt-1" style={{ color: textColor }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Block Renderer ───────────────────────────────────────────────────────────
function RenderBlock({ block, onBuy, buying, price, hasPurchased, slug, user }: {
  block: Block; onBuy: () => void; buying: boolean; price: string; hasPurchased: boolean; slug: string; user?: UserParamSource | null;
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
      const heroBottomBorderStyleDL: React.CSSProperties = d.heroBottomBorder
        ? { borderBottom: `${d.heroBottomBorderWidth ?? 4}px solid ${d.heroBottomBorderColor ?? "#179ca3"}` }
        : {};
      const heroClickHandlerDL = d.heroClickable && d.heroBehavior && d.heroBehavior !== "next_funnel_step"
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
        <div style={{ ...bgStyle, ...heroBottomBorderStyleDL, color: d.textColor ?? "#fff", textAlign: hasInlineMedia && isHorizontal ? "left" as const : (d.align ?? "left"), minHeight: `${d.heroMinHeight ?? 400}px`, cursor: heroClickHandlerDL ? "pointer" : undefined }} className="relative px-8 py-20 overflow-hidden" onClick={heroClickHandlerDL}>
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
                  <div key={i} className="flex flex-col items-center gap-1">
                    <button onClick={btn.link ? () => { window.location.href = btn.link; } : hasPurchased ? () => { window.location.href = `/downloads/${slug}/files`; } : onBuy}
                      disabled={buying}
                      className={`px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60 ${btn.animation && btn.animation !== "none" ? `animate-${btn.animation}-btn` : ""}`}
                      style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                      {hasPurchased ? "Access Files" : btn.text}
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
    case "image": {
      const imgAlignDL = d.align ?? "center";
      const imgJustifyDL = imgAlignDL === "left" ? "flex-start" : imgAlignDL === "right" ? "flex-end" : "center";
      const mwDL = d.maxWidth ?? "auto";
      const imgStyleDL: React.CSSProperties = { maxWidth: mwDL === "auto" ? "100%" : mwDL, width: mwDL === "auto" ? undefined : "100%", height: d.height || "auto", objectFit: "cover", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.noBorder ? "none" : (d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined) };
      const imgElDL = d.url ? <img src={d.url} alt={d.alt ?? ""} className={d.showShadow !== false ? "shadow" : ""} style={imgStyleDL} /> : null;
      return (
        <div className="px-8 py-6" style={{ display: "flex", flexDirection: "column", alignItems: imgJustifyDL }}>
          {imgElDL && (d.linkUrl ? <a href={d.linkUrl} target={d.openInNewTab !== false ? "_blank" : undefined} rel="noopener noreferrer" style={{ display: "inline-block" }}>{imgElDL}</a> : imgElDL)}
          {d.caption && <p className="text-sm text-gray-500 mt-2" style={{ textAlign: imgAlignDL as any }}>{d.caption}</p>}
        </div>
      );
    }
    case "video": {
      let embedUrl = d.url ?? "";
      if (embedUrl.includes("youtube.com/watch")) {
        const vid = new URL(embedUrl).searchParams.get("v");
        embedUrl = `https://www.youtube.com/embed/${vid}`;
      } else if (embedUrl.includes("youtu.be/")) {
        embedUrl = `https://www.youtube.com/embed/${embedUrl.split("youtu.be/")[1]}`;
      }
      const resolvedVidUrl = injectUserParams(embedUrl, user);
      return (
        <div className="px-8 py-6 max-w-4xl mx-auto">
          {resolvedVidUrl && (
            <div className="relative w-full overflow-hidden shadow" style={{ paddingBottom: d.height ? undefined : "56.25%", height: d.height || undefined, borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined }}>
              <iframe src={resolvedVidUrl} className="absolute inset-0 w-full h-full" allowFullScreen title="Video" />
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
            {d.headline && <h2 className="text-2xl font-bold mb-2 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            {d.subHeading && <p className="text-gray-500 mb-6 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: d.subHeading }} />}
            {!d.subHeading && d.headline && <div className="mb-6" />}
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
    case "checklist":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-2xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-2 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            {d.subHeading && <p className="text-gray-500 mb-6 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: d.subHeading }} />}
            {!d.subHeading && d.headline && <div className="mb-6" />}
            <div className="space-y-3">
              {(d.items ?? []).map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>✓</span>
                  <span className="text-gray-700">{item}</span>
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
            {(d.rating ?? 0) > 0 && (
              <div className="flex items-center justify-center gap-0.5 mb-4">
                {Array.from({ length: d.rating }).map((_: any, i: number) => <span key={i} className="text-yellow-400 text-xl">★</span>)}
              </div>
            )}
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
          {/* Price above button */}
          {d.showPrice && d.priceSource !== "none" && (d.pricePosition ?? "above") === "above" && (
            <div className="mb-6">
              {(d.showStrikethroughPrice && d.strikethroughPrice) && <p className="text-xl text-gray-400 line-through mb-1">{d.strikethroughPrice}</p>}
              {(d.showOriginalPrice && d.originalPrice && !d.currentPrice) && <p className="text-xl text-gray-400 line-through mb-1">${d.originalPrice}</p>}
              <p className="text-4xl font-bold" style={{ color: d.ctaColor ?? "#179ca3" }}>
                {d.currentPrice || price}
                {d.priceInterval && <span className="text-xl font-normal text-gray-500 ml-1">{d.priceInterval}</span>}
              </p>
            </div>
          )}
          <button
            onClick={hasPurchased ? () => { window.location.href = `/downloads/${slug}/files`; } : onBuy}
            disabled={buying}
            className={`px-10 py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-60 transition-opacity hover:opacity-90 ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`}
            style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}
          >
            {buying ? "Processing…" : hasPurchased ? "Access Your Files" : (d.ctaText ?? `Buy Now — ${d.currentPrice || price}`)}
          </button>
          {/* Price below button */}
          {d.showPrice && d.priceSource !== "none" && (d.pricePosition ?? "above") === "below" && (
            <div className="mt-6">
              {(d.showStrikethroughPrice && d.strikethroughPrice) && <p className="text-xl text-gray-400 line-through mb-1">{d.strikethroughPrice}</p>}
              <p className="text-4xl font-bold" style={{ color: d.ctaColor ?? "#179ca3" }}>
                {d.currentPrice || price}
                {d.priceInterval && <span className="text-xl font-normal text-gray-500 ml-1">{d.priceInterval}</span>}
              </p>
            </div>
          )}
          <ButtonSubtext d={d} />
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
            className={`inline-block px-8 py-3 rounded-lg font-semibold shadow disabled:opacity-60 transition-opacity hover:opacity-90 ${d.size === "lg" ? "text-lg px-10 py-4" : ""} ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`}
            style={{ backgroundColor: d.color ?? d.ctaColor ?? "#179ca3", color: d.textColor ?? d.ctaTextColor ?? "#fff" }}
          >
            {hasPurchased ? "Access Files" : (d.text ?? d.ctaText ?? "Buy Now")}
          </button>
          <ButtonSubtext d={d} />
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
              {(d.reviews ?? []).map((item: any, i: number) => (
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
              <div dangerouslySetInnerHTML={{ __html: injectUserParamsIntoHtml(d.embedCode, user) }} style={{ height: d.height ?? 400 }} />
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
    case "instructor":
      return <InstructorPublicBlock d={d} />;
    case "related_products":
      return <RelatedProductsBlock data={d} currentSlug={slug} currentType="download" />;
    case "logos":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="flex flex-wrap items-center justify-center gap-8">
            {(d.logos ?? []).map((logo: any, i: number) => (
              logo.url ? <img key={i} src={logo.url} alt={logo.alt ?? ""} className="h-10 object-contain opacity-70 hover:opacity-100 transition-opacity" />
                : <div key={i} className="h-10 w-24 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">{logo.alt || "Logo"}</div>
            ))}
          </div>
        </div>
      );
    case "countdown":
      return (
        <div className="px-8 py-10 text-center" style={{ backgroundColor: d.bgColor ?? "#179ca3" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6" style={{ color: d.textColor ?? "#fff" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <CountdownTimer mode={d.mode} durationMinutes={d.durationMinutes} targetDate={d.targetDate} textColor={d.textColor ?? "#fff"} />
        </div>
      );
    case "flip_cards":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {(d.cards ?? []).map((card: any, i: number) => (
              <div key={i} className="rounded-xl overflow-hidden shadow-sm border border-gray-200">
                <div className="p-5 font-semibold text-white text-center" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{card.front}</div>
                <div className="p-5 text-sm text-gray-600 text-center bg-white">{card.back}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case "lead_capture":
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#179ca3", color: d.textColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-3" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="opacity-90 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          <div className="flex max-w-md mx-auto gap-2">
            <input type="email" placeholder="Your email address" className="flex-1 px-4 py-3 rounded-lg text-gray-900 border-0 focus:ring-2 focus:ring-white/50" />
            <button className="px-6 py-3 bg-white font-semibold rounded-lg" style={{ color: d.bgColor ?? "#179ca3" }}>{d.ctaText ?? "Send Me Access"}</button>
          </div>
        </div>
      );
    case "urgency_offer":
      return (
        <div className="px-8 py-8 text-center" style={{ backgroundColor: d.bgColor ?? "#fff7ed" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-3" style={{ color: d.headlineColor ?? "#92400e" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="mb-4" style={{ color: d.textColor ?? "#78350f" }} dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          {d.ctaText && (
            <button onClick={onBuy} disabled={buying}
              className="px-8 py-3 rounded-lg font-semibold shadow disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: d.ctaColor ?? "#f59e0b", color: d.ctaTextColor ?? "#fff" }}>
              {buying ? "Processing…" : d.ctaText}
            </button>
          )}
        </div>
      );
    case "price_stack":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="flex flex-col gap-4 max-w-2xl mx-auto">
            {(d.items ?? []).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                <div>
                  <p className="font-semibold text-gray-900">{item.title}</p>
                  {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  {item.originalPrice && <p className="text-sm text-gray-400 line-through">{item.originalPrice}</p>}
                  <p className="font-bold text-teal-600">{item.price}</p>
                </div>
              </div>
            ))}
            {d.totalLabel && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-teal-600 text-white">
                <p className="font-bold text-lg">{d.totalLabel}</p>
                <p className="font-bold text-xl">{d.totalPrice ?? price}</p>
              </div>
            )}
          </div>
        </div>
      );
    case "checkout_form":
    case "pricing_options_auto":
    case "curriculum_auto":
    case "course":
    case "digital":
    case "physical":
      // These blocks are course/LMS-specific; render a generic CTA for download pages
      const _hAlign = d.headlineAlign ?? "left";
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className={`text-2xl font-bold text-gray-900 mb-3 ${_hAlign === "center" ? "text-center" : _hAlign === "right" ? "text-right" : "text-left"}`} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          <button onClick={onBuy} disabled={buying}
            className="px-10 py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-60 transition-opacity hover:opacity-90"
            style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>
            {buying ? "Processing…" : (d.ctaText ?? "Buy Now")}
          </button>
        </div>
      );
    case "carousel":
      return <div className="px-4 py-4"><CarouselBlock data={d} /></div>;
    default:
      return null;
  }
}

// ─── Instructor Public Block (fetches from saved profile or uses manual data) ──
function InstructorPublicBlock({ d }: { d: Record<string, any> }) {
  const instructorId = d.instructorId ? Number(d.instructorId) : null;
  const { data: instructors } = trpc.lms.listInstructors.useQuery(undefined, { staleTime: 5 * 60_000 });
  const instructor = instructorId ? instructors?.find((i: any) => i.id === instructorId) : null;
  const name = instructor?.name ?? d.name ?? "";
  const title = instructor?.title ?? d.title ?? "";
  const bio = instructor?.bio ?? d.bio ?? "";
  const avatarUrl = instructor?.avatarUrl ?? d.avatarUrl ?? "";
  const website = instructor?.website ?? d.website ?? "";
  const layout = d.layout ?? "horizontal";
  const showBio = d.showBio !== false;
  const showWebsite = d.showWebsite !== false;
  const headlineColor = d.headlineColor ?? "#111827";
  const titleColor = d.titleColor ?? "#179ca3";

  if (layout === "centered") {
    return (
      <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
        <div className="max-w-2xl mx-auto text-center">
          {avatarUrl
            ? <img src={avatarUrl} alt={name} className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border-4 border-teal-100 shadow-md" />
            : <div className="w-28 h-28 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4"><Users size={40} className="text-teal-600" /></div>}
          <h3 className="text-2xl font-bold mb-1" style={{ color: headlineColor }}>{name}</h3>
          {title && <p className="font-semibold mb-3" style={{ color: titleColor }}>{title}</p>}
          {showBio && bio && <div className="text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: bio }} />}
          {showWebsite && website && (
            <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm font-medium" style={{ color: titleColor }}>
              <Globe size={14} /> {website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
      <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-shrink-0">
          {avatarUrl
            ? <img src={avatarUrl} alt={name} className="w-24 h-24 rounded-full object-cover border-4 border-teal-100 shadow-md" />
            : <div className="w-24 h-24 rounded-full bg-teal-100 flex items-center justify-center"><Users size={32} className="text-teal-600" /></div>}
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-bold" style={{ color: headlineColor }}>{name}</h3>
          {title && <p className="font-semibold mb-2" style={{ color: titleColor }}>{title}</p>}
          {showBio && bio && <div className="text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: bio }} />}
          {showWebsite && website && (
            <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm font-medium" style={{ color: titleColor }}>
              <Globe size={14} /> {website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DownloadLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [selectedOrderBumpId, setSelectedOrderBumpId] = useState<number | undefined>();
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoDiscountText, setPromoDiscountText] = useState<string | null>(null);
  const isPreview = new URLSearchParams(window.location.search).get("preview") === "admin";
  const autoCheckout = new URLSearchParams(window.location.search).get("checkout") === "1";
  const { data: product, isLoading, error } = trpc.downloads.getBySlug.useQuery({ slug: slug!, preview: isPreview || undefined });

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

  // Auto-trigger checkout when ?checkout=1 is in the URL (used by BSLinkField product links)
  // MUST be before early returns to comply with React Rules of Hooks
  useEffect(() => {
    if (autoCheckout && product && !isLoading) {
      if (!user) {
        window.location.href = getLoginUrl();
        return;
      }
      checkoutMut.mutate({ productId: product.id, orderBumpId: undefined });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckout, product?.id, isLoading]);

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
    checkoutMut.mutate({ productId: product.id, orderBumpId: selectedOrderBumpId, promoCode: promoCode ?? undefined });
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
        {blocks.map(block => {
          const FULL_BLEED_TYPES_DL = ["hero", "pricing_cta", "cta_standalone", "divider", "spacer", "footer", "logo_strip", "urgency_offer", "product_offer_stack", "price_stack", "image_content"];
          const isFullBleedDL = FULL_BLEED_TYPES_DL.includes(block.type);
          const bwDL = block.data?.contentWidth;
          const bwMapDL: Record<string, string> = { xl: "1280px", lg: "1024px", md: "768px", sm: "640px" };
          const bwMaxDL = !isFullBleedDL && bwDL && bwDL !== "full" ? bwMapDL[bwDL] : null;
          return (
            <div key={block.id} style={{ marginTop: block.data?.marginTop || undefined, marginBottom: block.data?.marginBottom || undefined, paddingTop: block.data?.paddingTop || undefined, paddingBottom: block.data?.paddingBottom || undefined, paddingLeft: block.data?.paddingLeft || undefined, paddingRight: block.data?.paddingRight || undefined }}>
              {bwMaxDL ? (
                <div style={{ maxWidth: bwMaxDL, marginLeft: "auto", marginRight: "auto", width: "100%" }}>
                  <RenderBlock block={block} onBuy={handleBuy} buying={checkoutMut.isPending} price={price} hasPurchased={hasPurchased} slug={slug!} user={user} />
                </div>
              ) : (
                <RenderBlock block={block} onBuy={handleBuy} buying={checkoutMut.isPending} price={price} hasPurchased={hasPurchased} slug={slug!} user={user} />
              )}
            </div>
          );
        })}
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
                {(product as any).bundleOnly && <Badge className="bg-amber-500 text-white">Bundle Only</Badge>}
              </div>
              <div className="mt-6">
                {hasPurchased ? (
                  <Link href={`/downloads/${slug}/files`}>
                    <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50">
                      <Download className="w-5 h-5 mr-2" /> Access Your Files
                    </Button>
                  </Link>
                ) : (product as any).bundleOnly ? (
                  <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-3 rounded-lg text-sm font-medium">
                    <span>🎁</span> Available as part of a bundle only
                  </div>
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
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-teal-700 mb-3 text-center">{price}</div>
                {!hasPurchased && !product.isFree && (
                  <PromoCodeInput
                    className="mb-3"
                    onApply={(code, discount) => { setPromoCode(code); setPromoDiscountText(discount); }}
                  />
                )}
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
                <p className="text-xs text-gray-400 mt-3 text-center">Instant digital delivery</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

