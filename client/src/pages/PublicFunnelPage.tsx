/**
 * PublicFunnelPage.tsx
 * Renders a public funnel page at /f/:slug/:pageSlug
 * Displays the block-based content and handles lead capture + checkout CTAs.
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ArrowRight, CheckCircle } from "lucide-react";
import type { Block } from "./admin/LandingPageBuilder";
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";
import CheckoutFormBlock from "@/components/CheckoutFormBlock";

// ─── Live Countdown Hook ─────────────────────────────────────────────────────

function useCountdown(mode: "on_load" | "event", durationMinutes: number, targetDate?: string) {
  const endRef = useRef<number | null>(null);
  const [remaining, setRemaining] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (mode === "event" && targetDate) {
      endRef.current = new Date(targetDate).getTime();
    } else if (mode === "on_load") {
      // Use sessionStorage to persist the end time across re-renders within same session
      const storageKey = `countdown_${durationMinutes}`;
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        endRef.current = Number(stored);
      } else {
        const end = Date.now() + durationMinutes * 60 * 1000;
        endRef.current = end;
        sessionStorage.setItem(storageKey, String(end));
      }
    }

    const tick = () => {
      if (!endRef.current) return;
      const diff = Math.max(0, endRef.current - Date.now());
      const totalSec = Math.floor(diff / 1000);
      setRemaining({
        days: Math.floor(totalSec / 86400),
        hours: Math.floor((totalSec % 86400) / 3600),
        minutes: Math.floor((totalSec % 3600) / 60),
        seconds: totalSec % 60,
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [mode, durationMinutes, targetDate]);

  return remaining;
}

// ─── Live Countdown Display Component ────────────────────────────────────────

function CountdownDisplay({ mode, durationMinutes, targetDate, headline, accentColor, textColor, showBorder, bgColor }: {
  mode: "on_load" | "event"; durationMinutes: number; targetDate?: string;
  headline?: string; accentColor?: string; textColor?: string; showBorder?: boolean; bgColor?: string;
}) {
  const { days, hours, minutes, seconds } = useCountdown(mode, durationMinutes, targetDate);
  const units = mode === "event"
    ? [{ label: "Days", value: days }, { label: "Hours", value: hours }, { label: "Minutes", value: minutes }, { label: "Seconds", value: seconds }]
    : [{ label: "Hours", value: hours }, { label: "Minutes", value: minutes }, { label: "Seconds", value: seconds }];

  return (
    <div className={`px-8 py-10 text-center ${showBorder ? "border-2 rounded-2xl mx-4 my-4" : ""}`}
      style={{ backgroundColor: bgColor ?? "#ffffff", color: textColor ?? "#0e1e2e", borderColor: showBorder ? (accentColor ?? "#179ca3") : undefined }}>
      {headline && <h2 className="text-lg font-bold uppercase tracking-wide mb-4" style={{ color: accentColor ?? "#179ca3" }}>{headline}</h2>}
      <div className="flex justify-center items-center gap-3">
        {units.map((unit, i) => (
          <div key={unit.label} className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-5xl font-black tracking-tight" style={{ color: textColor ?? "#0e1e2e" }}>
                {String(unit.value).padStart(2, "0")}
              </div>
              <div className="text-xs font-medium mt-1 opacity-70">{unit.label}</div>
            </div>
            {i < units.length - 1 && <span className="text-4xl font-bold opacity-40 -mt-4">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Public Block Renderer ───────────────────────────────────────────────────

function RenderBlock({ block, funnelId, pageId, funnelSlug, nextPage }: {
  block: Block;
  funnelId: number;
  pageId: number;
  funnelSlug: string;
  nextPage?: { slug: string; title: string; pageType: string } | null;
}) {
  const d = block.data;

  switch (block.type) {
    case "hero": {
      const bgType = d.bgType ?? "color";
      let heroBg: React.CSSProperties = {};
      if (bgType === "color") heroBg = { backgroundColor: d.bgColor ?? "#179ca3" };
      else if (bgType === "gradient") heroBg = { background: `linear-gradient(${d.gradientDir ?? "to bottom right"}, ${d.gradientFrom ?? "#179ca3"}, ${d.gradientTo ?? "#0e4a50"})` };
      else if (bgType === "image") heroBg = { backgroundImage: `url(${d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
      else if (bgType === "video") heroBg = { backgroundColor: "#000" };
      const heroButtons: Array<{ text: string; color: string; textColor: string; link: string; style: string }> =
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Get Started", color: "#fff", textColor: "#179ca3", link: "", style: "filled" }];
      return (
        <div className="relative px-8 py-20 overflow-hidden" style={{ ...heroBg, color: d.textColor ?? "#fff", textAlign: d.align ?? "left" }}>
          {bgType === "video" && d.videoUrl && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.videoUrl} /></video>
          )}
          <div className="relative max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">{d.headline}{d.headline2 && <><br />{d.headline2}</>}</h1>
            {d.subheadline && <p className="text-xl opacity-90 mb-8 max-w-2xl">{d.subheadline}</p>}
            <div className="flex flex-wrap gap-3" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
              {heroButtons.map((btn, i) => (
                <a key={i} href={btn.link || "#"} className="px-8 py-3 rounded-lg font-semibold text-lg shadow-lg inline-block transition-transform hover:scale-105"
                  style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                  {btn.text}
                </a>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case "text":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff", color: d.textColor ?? "#1a1a1a", textAlign: d.align ?? "left" }}>
          <div className="max-w-4xl mx-auto prose prose-lg" dangerouslySetInnerHTML={{ __html: d.html ?? "" }} />
        </div>
      );
    case "image":
      return (
        <div className="px-8 py-8" style={{ textAlign: d.align ?? "center" }}>
          <div className="max-w-4xl mx-auto">
            {d.url && <img src={d.url} alt={d.alt ?? ""} className="rounded-lg shadow-md mx-auto" style={{ maxWidth: d.maxWidth ?? "100%" }} />}
            {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
          </div>
        </div>
      );
    case "video":
      return (
        <div className="px-8 py-8">
          <div className="max-w-4xl mx-auto">
            {d.embedUrl && (
              <div className="aspect-video rounded-lg overflow-hidden shadow-lg">
                <iframe src={d.embedUrl} className="w-full h-full" allowFullScreen />
              </div>
            )}
            {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
          </div>
        </div>
      );
    case "bullets":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          <div className="max-w-4xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900">{d.headline}</h2>}
            <ul className="space-y-3">
              {(d.items ?? []).map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-lg text-gray-700">
                  <CheckCircle size={20} className="flex-shrink-0 mt-1" style={{ color: d.iconColor ?? "#179ca3" }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "testimonial":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa" }}>
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-4xl mb-4" style={{ color: d.accentColor ?? "#179ca3" }}>"</div>
            <blockquote className="text-xl italic text-gray-700 mb-4">{d.quote}</blockquote>
            <p className="font-semibold text-gray-900">— {d.author}</p>
          </div>
        </div>
      );
    case "reviews":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-4xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(d.reviews ?? []).map((review: any, i: number) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <div className="flex gap-1 mb-2">
                    {Array.from({ length: review.rating ?? 5 }).map((_, j) => (
                      <span key={j} className="text-yellow-400">★</span>
                    ))}
                  </div>
                  <p className="text-gray-700 mb-3">{review.text}</p>
                  <p className="text-sm font-semibold text-gray-500">— {review.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "pricing_cta":
      return (
        <div className="px-8 py-16" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4 text-gray-900">{d.headline}</h2>
            {d.subtext && <p className="text-lg text-gray-600 mb-8">{d.subtext}</p>}
            <button className="px-10 py-4 rounded-xl font-bold text-xl shadow-lg transition-transform hover:scale-105"
              style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#ffffff" }}>
              {d.ctaText ?? "Get Started"}
            </button>
          </div>
        </div>
      );
    case "cta_standalone":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa", textAlign: d.align ?? "center" }}>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-3 text-gray-900">{d.headline}</h2>
            {d.subtext && <p className="text-gray-600 mb-6">{d.subtext}</p>}
            <a href={d.ctaLink || "#"} className="inline-block px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-transform hover:scale-105"
              style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#ffffff" }}>
              {d.ctaText ?? "Get Started"}
            </a>
          </div>
        </div>
      );
    case "lead_capture":
      return <LeadCaptureBlock data={d} funnelId={funnelId} pageId={pageId} />;
    case "faq":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-gray-900">{d.headline}</h2>}
            <div className="space-y-4">
              {(d.items ?? []).map((item: { q: string; a: string }, i: number) => (
                <details key={i} className="group border border-gray-200 rounded-lg">
                  <summary className="flex items-center justify-between p-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-50 rounded-lg">
                    {item.q}
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="px-4 pb-4 text-gray-600">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      );
    case "countdown":
      return (
        <CountdownDisplay
          mode={d.mode ?? "on_load"}
          durationMinutes={d.durationMinutes ?? 90}
          targetDate={d.targetDate}
          headline={d.headline}
          accentColor={d.accentColor}
          textColor={d.textColor}
          showBorder={d.showBorder}
          bgColor={d.bgColor}
        />
      );
    case "divider":
      return (
        <div style={{ padding: `${(d.spacing ?? 32) / 2}px 0` }}>
          <hr style={{ borderColor: d.color ?? "#e5e7eb", borderStyle: d.style ?? "solid", borderWidth: `${d.thickness ?? 1}px 0 0 0` }} />
        </div>
      );
    case "spacer":
      return <div style={{ height: d.height ?? 48 }} />;
    case "two_column":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="prose" dangerouslySetInnerHTML={{ __html: d.leftHtml ?? "" }} />
            <div className="prose" dangerouslySetInnerHTML={{ __html: d.rightHtml ?? "" }} />
          </div>
        </div>
      );
    case "instructor":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-8">
            {d.avatarUrl && <img src={d.avatarUrl} alt={d.name} className="w-32 h-32 rounded-full object-cover shadow-lg" />}
            <div>
              <h3 className="text-xl font-bold text-gray-900">{d.name}</h3>
              <p className="text-sm text-teal-600 font-medium mb-2">{d.title}</p>
              <p className="text-gray-600">{d.bio}</p>
            </div>
          </div>
        </div>
      );
    case "alert":
      return (
        <div className="px-8 py-4">
          <div className="max-w-4xl mx-auto">
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${
              d.alertType === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" :
              d.alertType === "error" ? "bg-red-50 border-red-200 text-red-800" :
              d.alertType === "success" ? "bg-green-50 border-green-200 text-green-800" :
              "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              <span className="text-xl">{d.icon ?? "💡"}</span>
              <p className="font-medium">{d.text}</p>
            </div>
          </div>
        </div>
      );
    case "icon_grid":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-4xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
            <div className={`grid gap-6 ${d.columns === 2 ? "grid-cols-1 md:grid-cols-2" : d.columns === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3"}`}>
              {(d.items ?? []).map((item: { icon: string; title: string; text: string }, i: number) => (
                <div key={i} className="text-center p-4">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "numbered_list":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900">{d.headline}</h2>}
            <ol className="space-y-4">
              {(d.items ?? []).map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{i + 1}</span>
                  <span className="text-lg text-gray-700 pt-1">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      );
    case "logos":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          <div className="max-w-4xl mx-auto text-center">
            {d.headline && <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">{d.headline}</p>}
            <div className="flex flex-wrap justify-center items-center gap-8">
              {(d.logos ?? []).map((logo: { url: string; alt: string }, i: number) => (
                logo.url ? <img key={i} src={logo.url} alt={logo.alt} className="h-10 opacity-60 hover:opacity-100 transition-opacity" /> :
                <div key={i} className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      );
    case "funnel_workflow":
      return <FunnelWorkflowBlock data={d} />;
    case "product_offer_stack":
      return <ProductOfferStackBlock data={d} />;
    case "order_bump_checkout":
      return <InlineOrderBumpBlock data={d} />;
    case "price_stack":
      return <PriceStackBlock data={d} />;
    case "urgency_offer":
      return <UrgencyOfferBlock data={d} />;
    case "embed":
      return (
        <div className="px-8 py-8">
          <div className="max-w-4xl mx-auto">
            {d.embedCode ? (
              <div dangerouslySetInnerHTML={{ __html: d.embedCode }} style={{ height: d.height ?? 400 }} />
            ) : (
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Embed placeholder</div>
            )}
            {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
          </div>
        </div>
      );
    case "gallery":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className={`max-w-5xl mx-auto grid gap-4 ${d.columns === 2 ? "grid-cols-2" : d.columns === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
            {(d.images ?? []).map((img: { url: string; caption: string }, i: number) => (
              <div key={i}>
                {img.url ? <img src={img.url} alt={img.caption} className="rounded-lg shadow-sm w-full" /> :
                  <div className="aspect-square bg-gray-100 rounded-lg" />}
              </div>
            ))}
          </div>
        </div>
      );
    case "flip_cards":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          <div className="max-w-4xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(d.cards ?? []).map((card: { front: string; back: string }, i: number) => (
                <div key={i} className="border rounded-xl p-6 hover:shadow-md transition-shadow" style={{ borderColor: d.accentColor ?? "#179ca3" }}>
                  <h3 className="font-bold text-gray-900 mb-2">{card.front}</h3>
                  <p className="text-gray-600 text-sm">{card.back}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "checkout_form":
      return <CheckoutFormBlock data={d} funnelId={funnelId} pageId={pageId} funnelSlug={funnelSlug} />;
    default:
      return null;
  }
}

// ─── Price Stack CTA Block ──────────────────────────────────────────────────

function PriceStackBlock({ data: d }: { data: Record<string, any> }) {
  const items: Array<{ text: string; price: string }> = d.items ?? [];
  return (
    <div className={`px-8 py-12 text-center ${d.showBorder ? "border-2 rounded-2xl mx-4 my-4" : ""}`}
      style={{ backgroundColor: d.bgColor ?? "#ffffff", color: d.textColor ?? "#0e1e2e", borderColor: d.showBorder ? (d.borderColor ?? "#1a5f7a") : undefined }}>
      <div className="max-w-2xl mx-auto">
        {d.imageUrl && <img src={d.imageUrl} alt="" className="w-full max-w-lg mx-auto rounded-lg mb-8 object-cover" />}
        {d.headline && <h2 className="text-2xl md:text-3xl font-black uppercase mb-8 whitespace-pre-line leading-tight">{d.headline}</h2>}
        {items.length > 0 && (
          <div className="space-y-3 mb-10 max-w-md mx-auto text-left">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-lg">
                <span className="text-teal-600 flex-shrink-0">▶</span>
                <span className="font-medium">{item.text}</span>
                <span className="text-gray-500 ml-auto text-sm">{item.price}</span>
              </div>
            ))}
          </div>
        )}
        {d.totalValueText && <p className="text-2xl md:text-3xl font-black italic mb-2">{d.totalValueText}</p>}
        {d.originalPrice && <p className="text-xl font-bold uppercase line-through opacity-50 mb-2">{d.originalPrice}</p>}
        {(d.finalPriceLabel || d.finalPrice) && (
          <p className="text-3xl md:text-5xl font-black mb-8">
            {d.finalPriceLabel && <span>{d.finalPriceLabel} </span>}
            {d.finalPrice && <span className="underline decoration-4 underline-offset-8">{d.finalPrice}</span>}
          </p>
        )}
        {d.ctaText && (
          <a href={d.ctaLink || "#"}
            className="inline-block px-12 py-5 rounded-xl font-bold text-xl shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#ffffff" }}>
            {d.ctaText}
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Urgency Offer Block ────────────────────────────────────────────────────

function UrgencyOfferBlock({ data: d }: { data: Record<string, any> }) {
  const { days, hours, minutes, seconds } = useCountdown(
    d.countdownMode ?? "on_load",
    d.countdownMinutes ?? 90,
    d.countdownTargetDate
  );
  const mode = d.countdownMode ?? "on_load";
  const units = mode === "event"
    ? [{ label: "Days", value: days }, { label: "Hours", value: hours }, { label: "Minutes", value: minutes }, { label: "Seconds", value: seconds }]
    : [{ label: "Hours", value: hours }, { label: "Minutes", value: minutes }, { label: "Seconds", value: seconds }];

  return (
    <div className={`px-8 py-10 ${d.showBorder ? "border-2 rounded-2xl mx-4 my-4" : ""}`}
      style={{ backgroundColor: d.bgColor ?? "#ffffff", color: d.textColor ?? "#0e1e2e", borderColor: d.showBorder ? (d.accentColor ?? "#179ca3") : undefined }}>
      <div className="max-w-2xl mx-auto">
        {/* Countdown section */}
        <div className="text-center mb-8">
          {d.countdownHeadline && <h3 className="text-lg font-bold uppercase tracking-wide mb-4" style={{ color: d.accentColor ?? "#179ca3" }}>{d.countdownHeadline}</h3>}
          <div className="flex justify-center items-center gap-3">
            {units.map((unit, i) => (
              <div key={unit.label} className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-5xl font-black tracking-tight">{String(unit.value).padStart(2, "0")}</div>
                  <div className="text-xs font-medium mt-1 opacity-70">{unit.label}</div>
                </div>
                {i < units.length - 1 && <span className="text-4xl font-bold opacity-40 -mt-4">:</span>}
              </div>
            ))}
          </div>
        </div>
        {/* Content section */}
        {d.headline && <h2 className="text-2xl md:text-3xl font-black text-center mb-6 whitespace-pre-line leading-tight">{d.headline}</h2>}
        {d.description && <p className="italic text-lg mb-4" style={{ color: d.accentColor ?? "#179ca3" }}>{d.description}</p>}
        {d.bodyHtml && <div className="prose prose-lg max-w-none mb-6" dangerouslySetInnerHTML={{ __html: d.bodyHtml }} />}
        {d.ctaText && (
          <a href={d.ctaLink || "#"} className="inline-flex items-center gap-2 font-bold text-lg transition-opacity hover:opacity-80" style={{ color: d.accentColor ?? "#179ca3" }}>
            {d.ctaEmoji && <span>{d.ctaEmoji}</span>}
            {d.ctaText}
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Lead Capture Block ──────────────────────────────────────────────────────

function LeadCaptureBlock({ data, funnelId, pageId }: { data: Record<string, any>; funnelId: number; pageId: number }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitLead = trpc.funnelPublic.submitLead.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Thank you! Check your email for access.");
    },
    onError: (e: any) => toast.error(e.message || "Submission failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Please enter your email"); return; }
    submitLead.mutate({ funnelId, funnelPageId: pageId, email, name: name || undefined });
  };

  if (submitted) {
    return (
      <div className="px-8 py-16 text-center" style={{ backgroundColor: data.bgColor ?? "#179ca3", color: data.textColor ?? "#ffffff" }}>
        <div className="max-w-md mx-auto">
          <CheckCircle size={48} className="mx-auto mb-4 opacity-90" />
          <h2 className="text-2xl font-bold mb-2">You're In!</h2>
          <p className="opacity-80">Check your email for access details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-16" style={{ backgroundColor: data.bgColor ?? "#179ca3", color: data.textColor ?? "#ffffff" }}>
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-2">{data.headline ?? "Get Access"}</h2>
        {data.subtext && <p className="opacity-80 mb-6">{data.subtext}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="text"
            placeholder="Your name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-12 text-base bg-white/10 border-white/30 text-white placeholder:text-white/60"
          />
          <Input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="h-12 text-base bg-white/10 border-white/30 text-white placeholder:text-white/60"
          />
          <Button
            type="submit"
            disabled={submitLead.isPending}
            className="w-full h-12 text-base font-bold bg-white text-gray-900 hover:bg-gray-100"
          >
            {submitLead.isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
            {data.ctaText ?? "Get Access"}
          </Button>
        </form>
        <p className="text-xs opacity-60 mt-3">We respect your privacy. Unsubscribe anytime.</p>
      </div>
    </div>
  );
}

// ─── Main Public Funnel Page Component ───────────────────────────────────────

export default function PublicFunnelPage() {
  const { slug, pageSlug } = useParams<{ slug: string; pageSlug: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = trpc.funnelPublic.getPage.useQuery(
    { funnelSlug: slug ?? "", pageSlug: pageSlug ?? "" },
    { enabled: !!slug && !!pageSlug }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-teal-600" size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-600">
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-gray-400 mb-4">This funnel page doesn't exist or is no longer active.</p>
        <Button onClick={() => navigate("/")} variant="outline">Go Home</Button>
      </div>
    );
  }

  const { funnel, page, nextPage } = data;
  let blocks: Block[] = [];
  try {
    blocks = page.blocks ? JSON.parse(page.blocks) : [];
  } catch {
    blocks = [];
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Render all blocks */}
      {blocks.map((block) => (
        <RenderBlock
          key={block.id}
          block={block}
          funnelId={funnel.id}
          pageId={page.id}
          funnelSlug={funnel.slug}
          nextPage={nextPage}
        />
      ))}

      {/* Next page navigation (if connected) */}
      {nextPage && (
        <div className="px-8 py-8 bg-gray-50 border-t border-gray-200">
          <div className="max-w-3xl mx-auto text-center">
            <a
              href={`/f/${funnel.slug}/${nextPage.slug}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors"
            >
              Continue to {nextPage.title} <ArrowRight size={18} />
            </a>
          </div>
        </div>
      )}

      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
          <p>This page is being built. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
