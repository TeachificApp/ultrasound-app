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
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              <span style={d.headlineColor ? { color: d.headlineColor } : undefined} dangerouslySetInnerHTML={{ __html: d.headline ?? '' }} />
              {d.headline2 && <><br /><span style={d.headline2Color ? { color: d.headline2Color } : undefined} dangerouslySetInnerHTML={{ __html: d.headline2 }} /></>}
            </h1>
            {d.subheadline && <p className="text-xl opacity-90 mb-8 max-w-2xl" dangerouslySetInnerHTML={{ __html: d.subheadline }} />}
            {!d.hideButtons && <div className="flex flex-wrap gap-3" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
              {heroButtons.map((btn, i) => (
                <a key={i} href={btn.link || "#"} className={`px-8 py-3 rounded-lg font-semibold text-lg shadow-lg inline-block transition-transform hover:scale-105 ${btn.animation && btn.animation !== "none" ? `animate-${btn.animation}-btn` : ""}`}
                  style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                  {btn.text}
                </a>
              ))}
            </div>}
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
            {d.url && <img src={d.url} alt={d.alt ?? ""} className="shadow-md mx-auto" style={{ maxWidth: d.maxWidth ?? "100%", height: d.height || "auto", objectFit: "cover", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined }} />}
            {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
          </div>
        </div>
      );
    case "video":
      return (
        <div className="px-8 py-8">
          <div className="mx-auto" style={{ maxWidth: d.maxWidth ?? "56rem" }}>
            {d.embedUrl && (
              <div className="relative w-full overflow-hidden shadow-lg" style={{ paddingBottom: d.height ? undefined : "56.25%", height: d.height || undefined, borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem",border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined }}>
                <iframe src={d.embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen />
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
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
            <h2 className="text-3xl font-bold mb-4 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />
            {d.subtext && <p className="text-lg text-gray-600 mb-8" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
            <button className={`px-10 py-4 rounded-xl font-bold text-xl shadow-lg transition-transform hover:scale-105 ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`}
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
            <h2 className="text-2xl font-bold mb-3 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />
            {d.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
            <a href={d.ctaLink || "#"} className={`inline-block px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-transform hover:scale-105 ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`}
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
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
          <hr style={{ borderColor: d.color ?? "#e5e7eb", borderStyle: d.style ?? "solid", borderWidth: `${d.thickness ?? 1}px 0 0 0`, borderRadius: d.borderRadius ? `${d.borderRadius}px` : undefined }} />
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
    case "two_column": {
      const renderCol = (side: "left" | "right") => {
        const colType = d[`${side}Type`] ?? "rich_text";
        switch (colType) {
          case "rich_text": return <div className="prose" dangerouslySetInnerHTML={{ __html: d[`${side}Html`] ?? "" }} />;
          case "cta": return <div className="flex items-center justify-center h-full"><a href={d[`${side}CtaLink`] || "#"} className={`px-8 py-4 rounded-lg font-bold text-lg shadow-lg inline-block ${d[`${side}CtaAnimation`] && d[`${side}CtaAnimation`] !== "none" ? `animate-${d[`${side}CtaAnimation`]}-btn` : ""}`} style={{ backgroundColor: d[`${side}CtaColor`] ?? "#179ca3", color: d[`${side}CtaTextColor`] ?? "#fff" }}>{d[`${side}CtaText`] ?? "Click Here"}</a></div>;
          case "countdown": return <CountdownDisplay mode="on_load" durationMinutes={Number(d[`${side}CountdownMinutes`]) || 60} headline={d[`${side}CountdownHeadline`]} accentColor={d[`${side}CountdownColor`]} />;
          case "contact_form": return <div className="space-y-3"><p className="text-lg font-semibold">{d[`${side}FormHeadline`] ?? "Get in Touch"}</p>{(d[`${side}FormFields`] ?? "name,email,message").split(",").map((f: string) => <input key={f} type="text" placeholder={f.trim()} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />)}<button className="w-full py-2 rounded-lg text-white font-medium" style={{ backgroundColor: d[`${side}FormBtnColor`] ?? "#179ca3" }}>Submit</button></div>;
          case "image": return d[`${side}ImageUrl`] ? <img src={d[`${side}ImageUrl`]} alt={d[`${side}ImageAlt`] ?? ""} className="w-full rounded-lg shadow" /> : null;
          case "video": return d[`${side}VideoUrl`] ? <div className="relative w-full rounded-lg overflow-hidden shadow" style={{ paddingBottom: "56.25%" }}><iframe src={d[`${side}VideoUrl`]} className="absolute inset-0 w-full h-full" allowFullScreen /></div> : null;
          default: return null;
        }
      };
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
            <div style={{ flex: d.leftRatio ?? 50 }}>{renderCol("left")}</div>
            <div style={{ flex: 100 - (d.leftRatio ?? 50) }}>{renderCol("right")}</div>
          </div>
        </div>
      );
    }
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
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
            {d.headline && <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
    case "logo_strip": {
      const logoAlign = d.align ?? "center";
      return (
        <div style={{ backgroundColor: d.bgColor ?? "#ffffff", padding: d.padding ?? "16px 0" }}>
          <div className={`flex ${logoAlign === "left" ? "justify-start" : logoAlign === "right" ? "justify-end" : "justify-center"} px-6`}>
            {d.logoUrl ? (
              d.link ? (
                <a href={d.link}><img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.maxWidth ?? "200px", height: "auto" }} className="object-contain" /></a>
              ) : (
                <img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.maxWidth ?? "200px", height: "auto" }} className="object-contain" />
              )
            ) : null}
          </div>
        </div>
      );
    }
    case "footer": {
      const footerLinks: Array<{ text: string; url: string }> = d.links ?? [];
      const socialLinks = d.socialLinks ?? {};
      return (
        <footer style={{ backgroundColor: d.bgColor ?? "#0e1e2e", color: d.textColor ?? "#ffffff" }} className="px-6 py-8">
          {d.logoUrl && (
            <div className="flex justify-center mb-4">
              <img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.logoMaxWidth ?? "120px" }} className="object-contain" />
            </div>
          )}
          {footerLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4 mb-4">
              {footerLinks.map((l, i) => (
                <a key={i} href={l.url} className="text-sm opacity-80 hover:opacity-100 underline" style={{ color: d.textColor ?? "#ffffff" }}>{l.text}</a>
              ))}
            </div>
          )}
          {d.showSocial && (socialLinks.facebook || socialLinks.instagram || socialLinks.youtube || socialLinks.linkedin) && (
            <div className="flex justify-center gap-4 mb-4">
              {socialLinks.facebook && <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>}
              {socialLinks.instagram && <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>}
              {socialLinks.youtube && <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>}
              {socialLinks.linkedin && <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>}
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

// ─── Price Stack CTA Block ──────────────────────────────────────────────────

function PriceStackBlock({ data: d }: { data: Record<string, any> }) {
  const items: Array<{ text: string; price: string }> = d.items ?? [];
  return (
    <div className={`px-8 py-12 text-center ${d.showBorder ? "border-2 rounded-2xl mx-4 my-4" : ""}`}
      style={{ backgroundColor: d.bgColor ?? "#ffffff", color: d.textColor ?? "#0e1e2e", borderColor: d.showBorder ? (d.borderColor ?? "#1a5f7a") : undefined }}>
      <div className="max-w-2xl mx-auto">
        {d.imageUrl && <img src={d.imageUrl} alt="" className="w-full max-w-lg mx-auto rounded-lg mb-8 object-cover" />}
        {d.headline && <h2 className="text-2xl md:text-3xl font-black uppercase mb-8 whitespace-pre-line leading-tight" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
        {d.headline && <h2 className="text-2xl md:text-3xl font-black text-center mb-6 whitespace-pre-line leading-tight" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
        <div key={block.id} style={{ marginTop: block.data.marginTop ? `${block.data.marginTop}px` : undefined, marginBottom: block.data.marginBottom ? `${block.data.marginBottom}px` : undefined, paddingTop: block.data.paddingTop ? `${block.data.paddingTop}px` : undefined, paddingBottom: block.data.paddingBottom ? `${block.data.paddingBottom}px` : undefined, paddingLeft: block.data.paddingLeft ? `${block.data.paddingLeft}px` : undefined, paddingRight: block.data.paddingRight ? `${block.data.paddingRight}px` : undefined }}>
          <RenderBlock
            block={block}
            funnelId={funnel.id}
            pageId={page.id}
            funnelSlug={funnel.slug}
            nextPage={nextPage}
          />
        </div>
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
