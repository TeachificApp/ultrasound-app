/**
 * PublicFunnelPage.tsx
 * Renders a public funnel page at /f/:slug/:pageSlug
 * Displays the block-based content and handles lead capture + checkout CTAs.
 */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ButtonSubtext } from "@/lib/ctaSubtext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ArrowRight, CheckCircle, Globe, Users, Lock, PlayCircle, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Block } from "@/components/BlockPreview";
import { CountdownV2Block, ImageLinkWrapper, WebinarCountdownTimer } from "@/components/BlockPreview";
import { BlockPreview } from "@/components/BlockPreview";
import { applyVideoTrim } from "@/lib/videoTrim";
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";
import CheckoutFormBlock from "@/components/CheckoutFormBlock";
import EmbeddedCheckoutBlock from "@/components/EmbeddedCheckoutBlock";
import InlineCheckoutBlock from "@/components/InlineCheckoutBlock";
import CarouselBlock from "@/components/CarouselBlock";
import { RelatedProductsBlock } from "@/components/RelatedProductsBlock";
import AudioBlockPlayer from "@/components/AudioBlockPlayer";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { injectUserParams, injectUserParamsIntoHtml, type UserParamSource } from "@/lib/userUrlParams";
import { LEARN_APP_URL } from "@/hooks/useSubdomain";

// ─── Opt-Out Link Component ─────────────────────────────────────────────────

function OptOutLink({ d }: { d: Record<string, any> }) {
  const enabled = !!d.optOutEnabled || !!d.showOptOut;
  const text = d.optOutText || "No thanks, I don't want this offer";
  const linkType: string = d.optOutLinkType ?? "custom";

  // Hooks must always be called unconditionally — early return moved below
  const { data: courseSlug } = trpc.lms.getSlugById.useQuery(
    { id: Number(d.optOutCourseId) || 0 },
    { enabled: enabled && linkType === "course" && !!d.optOutCourseId }
  );
  const { data: downloadSlug } = trpc.downloads.getSlugById.useQuery(
    { id: Number(d.optOutDownloadId) || 0 },
    { enabled: enabled && linkType === "download" && !!d.optOutDownloadId }
  );

  if (!enabled) return null;

  let href = "#";
  if (linkType === "course" && courseSlug) href = `/courses/${courseSlug}`;
  else if (linkType === "download" && downloadSlug) href = `/downloads/${downloadSlug}`;
  else if (linkType === "custom" && (d.optOutCustomUrl || d.optOutUrl)) href = d.optOutCustomUrl || d.optOutUrl;

  return (
    <div className="mt-4 text-center">
      <a
        href={href}
        className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
      >
        {text}
      </a>
    </div>
  );
}

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

function RenderBlock({ block, funnelId, pageId, funnelSlug, nextPage, user }: {
  block: Block;
  funnelId: number;
  pageId: number;
  funnelSlug: string;
  nextPage?: { slug: string; title: string; pageType: string } | null;
  user?: UserParamSource | null;
}) {
  const d = block.data;
  // Content width wrapper helper
  const widthMap: Record<string, string> = { full: "100%", xl: "1280px", lg: "1024px", md: "768px", sm: "640px" };
  const cw = d.contentWidth && d.contentWidth !== "full" ? widthMap[d.contentWidth] : null;
  const withWidthWrapper = (inner: React.ReactNode) =>
    cw ? <div style={{ maxWidth: cw, marginLeft: "auto", marginRight: "auto", width: "100%" }}>{inner}</div> : <>{inner}</>;

  switch (block.type) {
    case "hero": {
      const bgType = d.bgType ?? "color";
      let heroBg: React.CSSProperties = {};
      if (bgType === "color") heroBg = { backgroundColor: d.bgColor ?? "#179ca3" };
      else if (bgType === "gradient") heroBg = { background: `linear-gradient(${d.gradientDir ?? "to bottom right"}, ${d.gradientFrom ?? "#179ca3"}, ${d.gradientTo ?? "#0e4a50"})` };
      else if (bgType === "image") heroBg = { backgroundImage: `url(${d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
      else if (bgType === "video") heroBg = { backgroundColor: "#000" };
      const heroButtons: Array<{ text: string; color: string; textColor: string; link: string; style: string; animation?: string; leadCapture?: boolean; leadModalTitle?: string; leadModalSubtext?: string; leadTags?: string; showOptOut?: boolean; optOutText?: string; optOutUrl?: string }> =
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Get Started", color: "#fff", textColor: "#179ca3", link: "", style: "filled" }];
      const hasInlineMedia = !!d.inlineMediaUrl;
      const placement = d.inlineMediaPlacement ?? "right";
      const isHorizontal = placement === "left" || placement === "right";
      return (
        <HeroBlockWithLeadCapture
          d={d}
          heroButtons={heroButtons}
          heroBg={heroBg}
          bgType={bgType}
          hasInlineMedia={hasInlineMedia}
          placement={placement}
          isHorizontal={isHorizontal}
          funnelId={funnelId}
          pageId={pageId}
          funnelSlug={funnelSlug}
          nextPage={nextPage}
        />
      );
    }
    case "text":
      return (
        <div className="py-10" style={{ backgroundColor: d.bgColor ?? "#fff", color: d.textColor ?? "#1a1a1a", textAlign: d.align ?? "left" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="prose prose-lg" dangerouslySetInnerHTML={{ __html: d.html ?? "" }} /></div>
        </div>
      );
    case "image": {
      const imgAlignF = d.align ?? "center";
      const imgJustifyF = imgAlignF === "left" ? "flex-start" : imgAlignF === "right" ? "flex-end" : "center";
      const mwF = d.maxWidth ?? "auto";
      const imgStyleF: React.CSSProperties = { maxWidth: mwF === "auto" ? "100%" : mwF, width: mwF === "auto" ? undefined : "100%", height: d.height || "auto", objectFit: "cover", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.noBorder ? "none" : (d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined) };
      const imgElF = d.url ? <img src={d.url} alt={d.alt ?? ""} className={d.showShadow !== false ? "shadow-md" : ""} style={imgStyleF} /> : null;
      return (
        <div className="py-8" style={{ display: "flex", flexDirection: "column", alignItems: imgJustifyF }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full" style={{ display: "flex", flexDirection: "column", alignItems: imgJustifyF }}>
          {imgElF && <ImageLinkWrapper d={d}>{imgElF}</ImageLinkWrapper>}
          {d.caption && <p className="text-sm text-gray-500 mt-2" style={{ textAlign: imgAlignF as any }}>{d.caption}</p>}
          </div>
        </div>
      );
    }
    case "video": {
      const rawVidUrl = d.embedUrl ?? "";
      const resolvedVidUrl = injectUserParams(rawVidUrl, user);
      const isDirectVid = resolvedVidUrl && /\.(mp4|webm|ogg|mov)([?#]|$)/i.test(resolvedVidUrl);
      const vidTrimStart = d.trimStart ?? 0;
      const vidTrimEnd = d.trimEnd ?? 0;
      const trimmedVidUrl = resolvedVidUrl ? applyVideoTrim(resolvedVidUrl, vidTrimStart, vidTrimEnd) : "";
      const vidContainerStyle: React.CSSProperties = { paddingBottom: d.height ? undefined : (isDirectVid ? undefined : "56.25%"), height: d.height || undefined, borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined };
      return (
        <div className="py-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mx-auto" style={{ maxWidth: d.maxWidth ?? "56rem" }}>
            {resolvedVidUrl && (
              isDirectVid ? (
                <div className="overflow-hidden shadow-lg" style={vidContainerStyle}>
                  <video
                    src={trimmedVidUrl}
                    autoPlay={d.autoplay ?? false}
                    muted={d.muted ?? true}
                    loop={d.loop ?? false}
                    controls={d.controls ?? true}
                    playsInline
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="relative w-full overflow-hidden shadow-lg" style={vidContainerStyle}>
                  <iframe
                    src={d.autoplay ? `${trimmedVidUrl}${trimmedVidUrl.includes('?') ? '&' : '?'}autoplay=1${d.muted !== false ? '&mute=1' : ''}${d.loop ? '&loop=1' : ''}` : trimmedVidUrl}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    allow="autoplay; fullscreen"
                  />
                </div>
              )
            )}
            {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
          </div>
          </div>
        </div>
      );
    }
    case "bullets":
      return (
        <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <ul className="space-y-3">
              {(d.items ?? []).map((item: string | { text?: string; crossed?: boolean }, i: number) => {
                const txt = typeof item === "string" ? item : (item?.text ?? "");
                const crossed = typeof item === "object" && item?.crossed;
                return (
                  <li key={i} className="flex items-start gap-3 text-lg text-gray-700">
                    <CheckCircle size={20} className="flex-shrink-0 mt-1" style={{ color: d.iconColor ?? "#179ca3" }} />
                    <span className={crossed ? "line-through text-gray-400" : ""}>{txt}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      );
    case "testimonial":
      return (
        <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="max-w-3xl mx-auto text-center">
            <div className="text-4xl mb-4" style={{ color: d.accentColor ?? "#179ca3" }}>"</div>
            <blockquote className="text-xl italic text-gray-700 mb-4">{d.quote}</blockquote>
            {(d.rating ?? 0) > 0 && (
              <div className="flex items-center justify-center gap-0.5 mb-4">
                {Array.from({ length: d.rating }).map((_: any, i: number) => <span key={i} className="text-yellow-400 text-xl">★</span>)}
              </div>
            )}
            <p className="font-semibold text-gray-900">— {d.author}</p>
          </div></div>
        </div>
      );
    case "reviews":
      return (
        <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
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
      return <PricingCtaBlock d={d} funnelId={funnelId} pageId={pageId} funnelSlug={funnelSlug} nextPage={nextPage} />;
    case "cta_standalone":
      return <CtaStandaloneBlock d={d} funnelId={funnelId} pageId={pageId} funnelSlug={funnelSlug} nextPage={nextPage} />;
    case "lead_capture": {
      const lcNextUrl = nextPage ? (nextPage.slug.startsWith("/") ? nextPage.slug : `/${funnelSlug}/${nextPage.slug}`) : undefined;
      return <LeadCaptureBlock data={d} funnelId={funnelId} pageId={pageId} nextPageUrl={lcNextUrl} />;
    }
    case "cta_optin": {
      const optinNextUrl = nextPage ? (nextPage.slug.startsWith("/") ? nextPage.slug : `/${funnelSlug}/${nextPage.slug}`) : undefined;
      return <CtaOptinBlock data={d} funnelId={funnelId} pageId={pageId} nextPageUrl={optinNextUrl} />;
    }
    case "faq":
      return (
        <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="max-w-3xl mx-auto">
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
          </div></div>
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
    case "ticker": {
      const tickerItems: string[] = d.items ?? ["Welcome!"];
      const sep = d.separator ?? " ✦ ";
      const content = [...tickerItems, ...tickerItems].join(sep);
      const speed = d.speed ?? 30;
      const dir = d.direction === "right" ? "ticker-right" : "ticker-left";
      const fontSizeMap: Record<string, string> = { xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.125rem", xl: "1.25rem" };
      const fontWeightMap: Record<string, string> = { normal: "400", medium: "500", semibold: "600", bold: "700" };
      const letterSpacingMap: Record<string, string> = { tighter: "-0.05em", normal: "0", wide: "0.025em", wider: "0.05em", widest: "0.1em" };
      return (
        <div className={`overflow-hidden ${d.padding ?? "py-2"}`} style={{ backgroundColor: d.bgColor ?? "#0f766e" }}>
          <style>{`@keyframes ticker-left{from{transform:translateX(0)}to{transform:translateX(-50%)}} @keyframes ticker-right{from{transform:translateX(-50%)}to{transform:translateX(0)}}`}</style>
          <div style={{ display: "flex", whiteSpace: "nowrap", animation: `${dir} ${speed}s linear infinite`, willChange: "transform", color: d.textColor ?? "#ffffff", fontSize: fontSizeMap[d.fontSize ?? "sm"] ?? "0.875rem", fontWeight: fontWeightMap[d.fontWeight ?? "normal"] ?? "400", letterSpacing: letterSpacingMap[d.letterSpacing ?? "normal"] ?? "0", textTransform: (d.textTransform === "none" ? "none" : d.textTransform) as any }}>
            <span style={{ paddingRight: "4rem" }}>{content}</span>
            <span style={{ paddingRight: "4rem" }}>{content}</span>
          </div>
        </div>
      );
    }
    case "countdown_v2":
      return <CountdownV2Block data={d} />;
    case "divider":
      return (
        <div style={{ padding: `${(d.spacing ?? 32) / 2}px 0` }}>
          <hr style={{ borderColor: d.color ?? "#e5e7eb", borderStyle: d.style ?? "solid", borderWidth: `${d.thickness ?? 1}px 0 0 0`, borderRadius: d.borderRadius ? `${d.borderRadius}px` : undefined }} />
        </div>
      );
    case "three_column": {
      const divStyle3 = d.showDividers ? { borderRightWidth: `${d.dividerWidth ?? 1}px`, borderRightStyle: (d.dividerStyle ?? "solid") as any, borderRightColor: d.dividerColor ?? "#e5e7eb", borderRadius: d.dividerRadius ? `${d.dividerRadius}px` : undefined } : {};
      return (
        <div className="py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
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
        <div className="py-10" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-8">
            <div style={{ flex: d.leftRatio ?? 50 }}>{renderCol("left")}</div>
            <div style={{ flex: 100 - (d.leftRatio ?? 50) }}>{renderCol("right")}</div>
          </div>
        </div>
      );
    }
    case "instructor":
      return <InstructorPublicBlock d={d} />;
    case "related_products":
      return <RelatedProductsBlock data={d} />;
    case "alert":
      return (
        <div className="py-4">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
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
        <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
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
        <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-2 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            {d.subHeading && <p className="text-gray-500 mb-6 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: d.subHeading }} />}
            {!d.subHeading && d.headline && <div className="mb-6" />}
            <ol className="space-y-4">
              {(d.items ?? []).map((item: string | { text?: string; crossed?: boolean }, i: number) => {
                const txt = typeof item === "string" ? item : (item?.text ?? "");
                const crossed = typeof item === "object" && item?.crossed;
                return (
                  <li key={i} className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                      style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{i + 1}</span>
                    <span className={`text-lg text-gray-700 pt-1${crossed ? " line-through text-gray-400" : ""}`}>{txt}</span>
                  </li>
                );
              })}
            </ol>
          </div></div>
        </div>
      );
    case "checklist":
      return (
        <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-2 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            {d.subHeading && <p className="text-gray-500 mb-6 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: d.subHeading }} />}
            {!d.subHeading && d.headline && <div className="mb-6" />}
            <ul className="space-y-3">
              {(d.items ?? []).map((item: string | { text?: string; crossed?: boolean }, i: number) => {
                const txt = typeof item === "string" ? item : (item?.text ?? "");
                const crossed = typeof item === "object" && item?.crossed;
                return (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-xs mt-0.5"
                      style={{ backgroundColor: crossed ? "#ef4444" : (d.accentColor ?? "#179ca3") }}>{crossed ? "✗" : "✓"}</span>
                    <span className={`text-lg${crossed ? " line-through text-gray-400" : " text-gray-700"}`}>{txt}</span>
                  </li>
                );
              })}
            </ul>
          </div></div>
        </div>
      );
    case "logos":
      return (
        <div className="py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
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
      return <PriceStackBlock data={d} funnelSlug={funnelSlug} nextPage={nextPage} />;
    case "urgency_offer":
      return <UrgencyOfferBlock data={d} funnelSlug={funnelSlug} nextPage={nextPage} />;
    case "audio":
      return (
        <AudioBlockPlayer
          audioUrl={d.audioUrl ?? ""}
          title={d.title}
          caption={d.caption}
          autoplay={d.autoplay ?? false}
          muted={d.muted ?? false}
          loop={d.loop ?? false}
          controls={d.controls ?? true}
          trimStart={d.trimStart ?? 0}
          trimEnd={d.trimEnd ?? 0}
          bgColor={d.bgColor ?? "#f8fffe"}
        />
      );
    case "embed":
      return (
        <div className="py-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            {d.embedCode ? (
              <iframe
                srcDoc={injectUserParamsIntoHtml(d.embedCode, user)}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
                style={{ width: "100%", height: d.height ?? 400, border: "none", display: "block" }}
                title={d.caption ?? "Embedded content"}
              />
            ) : (
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Embed placeholder</div>
            )}
            {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
          </div>
        </div>
      );
    case "gallery":
      return (
        <div className="py-10" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
          <div className={`max-w-5xl mx-auto px-4 sm:px-6 grid gap-4 ${d.columns === 2 ? "grid-cols-2" : d.columns === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
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
        <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
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
    case "inline_checkout":
      return <InlineCheckoutBlock data={d} sourceType="funnel" sourceFunnelId={funnelId} />;
    case "embedded_checkout":
      return <EmbeddedCheckoutBlock data={d} pageSlug={funnelSlug} />;
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
          <p className="text-xs text-center opacity-60">{d.copyrightText ?? `\u00a9 ${new Date().getFullYear()} All rights reserved.`}</p>
        </footer>
      );
    }
    case "curriculum_auto":
      return <FunnelCurriculumBlock block={block} />;
    case "carousel":
      return <div className="px-4 py-4"><CarouselBlock data={d} /></div>;
    case "column_layout": {
      const leftBlocks: Block[] = d.leftBlocks ?? [];
      const rightBlocks: Block[] = d.rightBlocks ?? [];
      const leftRatio = d.leftRatio ?? 50;
      const rightRatio = 100 - leftRatio;
      const gap = d.gap ?? 32;
      return (
        <div style={{ backgroundColor: d.bgColor ?? "transparent" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: `${gap}px`,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: leftRatio, minWidth: "280px" }}>
              {leftBlocks.map((cb) => (
                <RenderBlock key={cb.id} block={cb} funnelId={funnelId} pageId={pageId} funnelSlug={funnelSlug} nextPage={nextPage} user={user} />
              ))}
            </div>
            <div style={{ flex: rightRatio, minWidth: "280px" }}>
              {rightBlocks.map((cb) => (
                <RenderBlock key={cb.id} block={cb} funnelId={funnelId} pageId={pageId} funnelSlug={funnelSlug} nextPage={nextPage} user={user} />
              ))}
            </div>
          </div>
        </div>
      );
    }
    // Webinar blocks — delegate to shared BlockPreview renderers
    case "webinar_hero":
    case "webinar_registration":
    case "webinar_host_bio":
    case "webinar_replay":
    case "webinar_agenda":
    // File download block — delegate to shared BlockPreview renderer
    case "file_download":
      return <BlockPreview block={block} />;
    default:
      return null;
  }
}

// ─── Curriculum Block (for funnel pages) ────────────────────────────────────

function FunnelCurriculumBlock({ block }: { block: Block }) {
  const d = block.data;
  const courseId = d.courseId ? Number(d.courseId) : 0;
  const { data: curriculum, isLoading } = trpc.lms.getCurriculumById.useQuery(
    { courseId },
    { enabled: courseId > 0 }
  );
  const cr = d.cornerRadius ?? 12;
  const iconStyle = d.iconStyle ?? "lock";
  const hAlign = d.headlineAlign ?? "left";

  if (!courseId) {
    return (
      <div className="py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6"><p className="text-sm text-gray-400 text-center">No course selected. Edit this block to choose a course.</p></div>
      </div>
    );
  }

  if (isLoading || !curriculum) {
    return (
      <div className="py-10 flex justify-center" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div className="py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
      {d.headline && (
        <h2 className={`text-2xl font-bold mb-6 ${hAlign === "center" ? "text-center" : hAlign === "right" ? "text-right" : "text-left"}`} style={{ color: d.headlineColor ?? "#111827" }}
          dangerouslySetInnerHTML={{ __html: d.headline }} />
      )}
      <div className="overflow-hidden max-w-3xl" style={{ border: `1px solid ${d.sectionBorderColor ?? "#e5e7eb"}`, borderRadius: `${cr}px` }}>
        <Accordion type="multiple" defaultValue={["section-0"]}>
          {curriculum.sections.map((section: any, si: number) => (
            <AccordionItem key={section.id} value={`section-${si}`} style={{ borderBottom: `1px solid ${d.sectionBorderColor ?? "#e5e7eb"}` }}>
              <AccordionTrigger
                className="hover:no-underline px-5 font-semibold text-sm"
                style={{ backgroundColor: d.sectionBgColor ?? "#f9fafb", color: d.sectionTextColor ?? "#1f2937" }}
              >
                <span>{section.title}</span>
                <span className="text-xs ml-auto mr-2" style={{ color: d.lessonCountColor ?? "#9ca3af" }}>
                  {section.lessons.length} lesson{section.lessons.length !== 1 ? "s" : ""}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1 pt-1">
                  {section.lessons.map((lesson: any) => {
                    const pm = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
                    const isFreePreview = pm === "preview" || pm === "preview_hide_after_purchase";
                    return (
                      <li key={lesson.id} className="flex items-center gap-3 py-2 px-5 text-sm">
                        {iconStyle !== "none" && (
                          isFreePreview
                            ? <PlayCircle className="w-4 h-4 flex-shrink-0" style={{ color: d.lessonPreviewIconColor ?? "#14b8a6" }} />
                            : iconStyle === "circle"
                              ? <span className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: d.lessonLockedIconColor ?? "#d1d5db" }} />
                              : <Lock className="w-4 h-4 flex-shrink-0" style={{ color: d.lessonLockedIconColor ?? "#d1d5db" }} />
                        )}
                        <span style={{ color: isFreePreview ? (d.lessonPreviewIconColor ?? "#0d9488") : (d.lessonTextColor ?? "#374151"), fontWeight: isFreePreview ? 500 : 400 }}>
                          {lesson.title}
                        </span>
                        {isFreePreview && (
                          <a
                            href={`/courses/${curriculum.slug}/player?lesson=${lesson.id}`}
                            className="ml-auto text-xs hover:underline font-semibold flex items-center gap-1 shrink-0"
                            style={{ color: d.lessonPreviewIconColor ?? "#0d9488" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PlayCircle className="w-3 h-3" /> Free Preview
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      </div>
    </div>
  );
}

// ─── Price Stack CTA Block ──────────────────────────────────────────────────

function PriceStackBlock({ data: d, funnelSlug, nextPage }: { data: Record<string, any>; funnelSlug: string; nextPage?: { slug: string; title: string; pageType: string } | null }) {
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
          <a href={d.ctaLink || (nextPage ? `/${funnelSlug}/${nextPage.slug}` : "#")}
            className="inline-block px-12 py-5 rounded-xl font-bold text-xl shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#ffffff" }}>
            {d.ctaText}
          </a>
        )}
        <OptOutLink d={d} />
      </div>
    </div>
  );
}

// ─── Urgency Offer Block ────────────────────────────────────────────────────

function UrgencyOfferBlock({ data: d, funnelSlug, nextPage }: { data: Record<string, any>; funnelSlug: string; nextPage?: { slug: string; title: string; pageType: string } | null }) {
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
          <a href={d.ctaLink || (nextPage ? `/${funnelSlug}/${nextPage.slug}` : "#")} className="inline-flex items-center gap-2 font-bold text-lg transition-opacity hover:opacity-80" style={{ color: d.accentColor ?? "#179ca3" }}>
            {d.ctaEmoji && <span>{d.ctaEmoji}</span>}
            {d.ctaText}
          </a>
        )}
        <OptOutLink d={d} />
      </div>
    </div>
  );
}

// ─── Hero Block with Lead Capture ──────────────────────────────────────────

function HeroBlockWithLeadCapture({ d, heroButtons, heroBg, bgType, hasInlineMedia, placement, isHorizontal, funnelId, pageId, funnelSlug, nextPage }: {
  d: Record<string, any>;
  heroButtons: Array<{ text: string; color: string; textColor: string; link: string; style: string; animation?: string; leadCapture?: boolean; leadModalTitle?: string; leadModalSubtext?: string; leadTags?: string; behavior?: string; emailAddress?: string; showOptOut?: boolean; optOutText?: string; optOutUrl?: string; checkoutProductType?: string; checkoutProductId?: number; checkoutPromoCode?: string }>;
  heroBg: React.CSSProperties;
  bgType: string;
  hasInlineMedia: boolean;
  placement: string;
  isHorizontal: boolean;
  funnelId: number;
  pageId: number;
  funnelSlug: string;
  nextPage?: { slug: string; title: string; pageType: string } | null;
}) {
  const [lcModal, setLcModal] = useState<{ btn: typeof heroButtons[0] } | null>(null);
  const [checkoutLoadingIdx, setCheckoutLoadingIdx] = useState<number | null>(null);
  const [heroPromoCode, setHeroPromoCode] = useState<string | null>(null);
  const nextPageRef = useRef(nextPage);
  nextPageRef.current = nextPage;
  const createDirectCheckout = trpc.funnelPublic.createDirectCheckout.useMutation();

  const handleBtnClick = async (e: React.MouseEvent, btn: typeof heroButtons[0], idx: number) => {
    const behavior = btn.behavior ?? "url";
    if (behavior === "direct_checkout") {
      e.preventDefault();
      if (!btn.checkoutProductId || !btn.checkoutProductType) { toast.error("No product configured for this button."); return; }
      setCheckoutLoadingIdx(idx);
      try {
        const result = await createDirectCheckout.mutateAsync({
          productType: btn.checkoutProductType as any,
          productId: Number(btn.checkoutProductId),
          origin: window.location.origin,
          promoCode: heroPromoCode || undefined,
          funnelId,
          pageId,
        });
        if ((result as any).freeSuccess) {
          toast.success("Access granted! Redirecting…");
          const url = (result as any).successUrl;
          if (url) setTimeout(() => { window.location.href = url; }, 1200);
        } else if (result.checkoutUrl) {
          window.open(result.checkoutUrl, "_blank");
        }
      } catch (err: any) { toast.error(err.message || "Failed to start checkout"); }
      finally { setCheckoutLoadingIdx(null); }
      return;
    }
    if (btn.leadCapture) {
      e.preventDefault();
      setLcModal({ btn });
    }
  };

  const getBtnHref = (btn: typeof heroButtons[0]) => {
    const behavior = btn.behavior ?? "url";
    const np = nextPageRef.current;
    const nextPageUrl = np ? (np.slug.startsWith("/") ? np.slug : `/${funnelSlug}/${np.slug}`) : null;
    if (behavior === "send_email" && btn.emailAddress) return `mailto:${btn.emailAddress}`;
    if (behavior === "next_funnel_step" && nextPageUrl) return nextPageUrl;
    if (behavior === "direct_checkout") return "#";
    if (behavior === "landing_page" && (btn as any).landingPageSlug) return `${LEARN_APP_URL}/courses/${(btn as any).landingPageSlug}`;
    if (behavior === "funnel_page" && (btn as any).funnelPageValue) {
      const [fs, ps] = ((btn as any).funnelPageValue as string).split("/");
      if (fs && ps) return `/${fs}/${ps}`;
    }
    return btn.link || nextPageUrl || "#";
  };

  const handleLeadSuccess = (btn: typeof heroButtons[0]) => {
    window.location.href = getBtnHref(btn);
  };

  const heroTopBorderStyle: React.CSSProperties = d.heroTopBorder
    ? { borderTop: `${d.heroTopBorderWidth ?? 4}px solid ${d.heroTopBorderColor ?? "#179ca3"}` }
    : {};
  const heroBottomBorderStyle: React.CSSProperties = d.heroBottomBorder
    ? { borderBottom: `${d.heroBottomBorderWidth ?? 4}px solid ${d.heroBottomBorderColor ?? "#179ca3"}` }
    : {};
  const heroClickHandler = d.heroClickable && d.heroBehavior && d.heroBehavior !== "next_funnel_step"
    ? (e: React.MouseEvent) => {
        const beh = d.heroBehavior as string;
        if (beh === "url" && d.heroLink) window.open(d.heroLink, "_blank");
        else if (beh === "send_email" && d.heroEmail) window.location.href = `mailto:${d.heroEmail}`;
        else if (beh === "scroll_to_section" && d.heroScrollAnchor) {
          const el = document.getElementById(d.heroScrollAnchor.replace(/^#/, ""));
          el?.scrollIntoView({ behavior: "smooth" });
        } else if (beh === "download_file" && d.heroDownloadUrl) window.open(d.heroDownloadUrl, "_blank");
        else if (beh === "open_popup" && d.heroPopupUrl) window.open(d.heroPopupUrl, "_blank");
        else if (beh === "direct_checkout" && d.heroCheckoutProductId && d.heroCheckoutProductType) {
          // handled by createDirectCheckout mutation below
        }
        else if (beh === "landing_page" && d.heroLandingPageSlug) {
          window.open(`${LEARN_APP_URL}/courses/${d.heroLandingPageSlug}`, "_blank");
        }
        else if (beh === "funnel_page" && d.heroFunnelPageValue) {
          const [fs, ps] = (d.heroFunnelPageValue as string).split("/");
          if (fs && ps) window.location.href = `/${fs}/${ps}`;
        }
      }
    : undefined;
  return (
    <div className="hero-block relative px-4 sm:px-8 py-10 sm:py-20 overflow-hidden" style={{ ...heroBg, ...heroTopBorderStyle, ...heroBottomBorderStyle, color: d.textColor ?? "#fff", textAlign: hasInlineMedia && isHorizontal ? "left" as const : (d.align ?? "left"), minHeight: `${d.heroMinHeight ?? 400}px`, cursor: heroClickHandler ? "pointer" : undefined }} onClick={heroClickHandler}>
      {bgType === "video" && d.videoUrl && (
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.videoUrl} /></video>
      )}
      <div className={`relative max-w-5xl mx-auto ${hasInlineMedia && isHorizontal ? "flex items-center gap-10" : ""} ${hasInlineMedia && placement === "left" ? "flex-row-reverse" : ""}`}>
        <div className={hasInlineMedia && isHorizontal ? "flex-1" : "max-w-4xl mx-auto"}>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight break-words">
            <span style={d.headlineColor ? { color: d.headlineColor } : undefined} dangerouslySetInnerHTML={{ __html: d.headline ?? "" }} />
            {d.headline2 && <><br /><span style={d.headline2Color ? { color: d.headline2Color } : undefined} dangerouslySetInnerHTML={{ __html: d.headline2 }} /></>}
          </h1>
          {d.subheadline && <p className="text-xl opacity-90 mb-8 max-w-2xl" dangerouslySetInnerHTML={{ __html: d.subheadline }} />}

          {!d.hideButtons && <div className="flex flex-wrap gap-3" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
            {heroButtons.map((btn, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <a
                  href={getBtnHref(btn)}
                  onClick={e => handleBtnClick(e, btn, i)}
                  className={`px-8 py-3 rounded-lg font-semibold text-lg shadow-lg inline-block transition-transform hover:scale-105 cursor-pointer ${btn.animation && btn.animation !== "none" ? `animate-${btn.animation}-btn` : ""} ${checkoutLoadingIdx === i ? "opacity-70 pointer-events-none" : ""}`}
                  style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                  {checkoutLoadingIdx === i ? "Redirecting..." : btn.text}
                </a>
                {btn.showStrikethrough && (btn as any).strikethroughPrice && (
                  <span className="text-xs text-white/60 line-through">{(btn as any).strikethroughPrice}</span>
                )}
                {btn.showOptOut && btn.optOutText && (
                  <a href={btn.optOutUrl || "#"} className="text-xs text-white/60 underline hover:text-white/80 cursor-pointer">{btn.optOutText}</a>
                )}
              </div>
            ))}
          </div>}
        </div>
        {hasInlineMedia && (
          <div className={isHorizontal ? "flex-1 max-w-md" : "mt-8 max-w-lg mx-auto"}>
            {d.inlineMediaType === "video" ? (
              <video autoPlay muted loop playsInline className="w-full rounded-lg shadow-2xl"><source src={d.inlineMediaUrl} /></video>
            ) : (
              <img src={d.inlineMediaUrl} alt="" className="w-full rounded-lg shadow-2xl" />
            )}
          </div>
        )}
      </div>
      {lcModal && (
        <LeadCaptureModal
          open={true}
          onClose={() => setLcModal(null)}
          onSuccess={() => handleLeadSuccess(lcModal.btn)}
          title={lcModal.btn.leadModalTitle || "Get Instant Access"}
          subtext={lcModal.btn.leadModalSubtext}
          tags={lcModal.btn.leadTags}
          funnelId={funnelId}
          pageId={pageId}
        />
      )}
    </div>
  );
}

// ─── CTA Standalone Block with Lead Capture ───────────────────────────────────

function CtaStandaloneBlock({ d, funnelId, pageId, funnelSlug, nextPage }: { d: Record<string, any>; funnelId: number; pageId: number; funnelSlug: string; nextPage?: { slug: string } | null }) {
  const [lcOpen, setLcOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const nextPageRef = useRef(nextPage);
  nextPageRef.current = nextPage;
  const createDirectCheckout = trpc.funnelPublic.createDirectCheckout.useMutation();

  const getHref = () => {
    const behavior = d.ctaBehavior ?? "url";
    const np = nextPageRef.current;
    const nextPageUrl = np ? (np.slug.startsWith("/") ? np.slug : `/${funnelSlug}/${np.slug}`) : null;
    if (behavior === "send_email" && d.ctaEmailAddress) return `mailto:${d.ctaEmailAddress}`;
    if (behavior === "next_funnel_step" && nextPageUrl) return nextPageUrl;
    if (behavior === "direct_checkout") return "#";
    if (behavior === "landing_page" && d.ctaLandingPageSlug) return `${LEARN_APP_URL}/courses/${d.ctaLandingPageSlug}`;
    if (behavior === "funnel_page" && d.ctaFunnelPageValue) {
      const [fs, ps] = (d.ctaFunnelPageValue as string).split("/");
      if (fs && ps) return `/${fs}/${ps}`;
    }
    return d.ctaLink || nextPageUrl || "#";
  };

  const btnStyle: React.CSSProperties = (d.btnStyle ?? "filled") === "outline"
    ? { backgroundColor: "transparent", color: d.ctaColor ?? "#179ca3", border: `2px solid ${d.btnBorderColor ?? d.ctaColor ?? "#179ca3"}` }
    : { backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#ffffff", border: `2px solid ${d.btnBorderColor ?? d.ctaColor ?? "#179ca3"}` };

  const handleClick = async (e: React.MouseEvent) => {
    const behavior = d.ctaBehavior ?? "url";
    if (behavior === "direct_checkout") {
      e.preventDefault();
      if (!d.checkoutProductId || !d.checkoutProductType) { toast.error("No product configured for this button."); return; }
      setCheckoutLoading(true);
      try {
        const result = await createDirectCheckout.mutateAsync({
          productType: d.checkoutProductType as any,
          productId: Number(d.checkoutProductId),
          origin: window.location.origin,
          promoCode: promoCode || undefined,
          funnelId,
          pageId,
        });
        if ((result as any).freeSuccess) {
          toast.success("Access granted! Redirecting…");
          const url = (result as any).successUrl;
          if (url) setTimeout(() => { window.location.href = url; }, 1200);
        } else if (result.checkoutUrl) {
          window.open(result.checkoutUrl, "_blank");
        }
      } catch (err: any) { toast.error(err.message || "Failed to start checkout"); }
      finally { setCheckoutLoading(false); }
      return;
    }
    if (d.leadCapture) {
      e.preventDefault();
      setLcOpen(true);
    }
  };

  return (
    <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa", textAlign: d.align ?? "center" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-3 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />
        {d.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}

        <a href={getHref()} onClick={handleClick}
          className={`inline-block px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-transform hover:scale-105 cursor-pointer ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""} ${checkoutLoading ? "opacity-70 pointer-events-none" : ""}`}
          style={btnStyle}>
          {checkoutLoading ? "Redirecting..." : (d.ctaText ?? "Get Started")}
        </a>
        <ButtonSubtext d={d} />
        <OptOutLink d={d} />
      </div></div>
      {lcOpen && (
        <LeadCaptureModal
          open={true}
          onClose={() => setLcOpen(false)}
          onSuccess={({ name: ln, email: le }) => {
            try {
              const u = new URL(getHref(), window.location.origin);
              if (ln) u.searchParams.set("name", ln);
              if (le) u.searchParams.set("email", le);
              window.location.href = u.toString();
            } catch { window.location.href = getHref(); }
          }}
          title={d.leadModalTitle || "Get Instant Access"}
          subtext={d.leadModalSubtext}
          tags={d.leadTags}
          funnelId={funnelId}
          pageId={pageId}
        />
      )}
    </div>
  );
}

// ─── Pricing CTA Block with Lead Capture ─────────────────────────────────────

function PricingCtaBlock({ d, funnelId, pageId, funnelSlug, nextPage }: { d: Record<string, any>; funnelId: number; pageId: number; funnelSlug: string; nextPage?: { slug: string } | null }) {
  const [lcOpen, setLcOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const nextPageRef = useRef(nextPage);
  nextPageRef.current = nextPage;
  const createDirectCheckout = trpc.funnelPublic.createDirectCheckout.useMutation();

  const getHref = () => {
    const behavior = d.ctaBehavior ?? "url";
    const np = nextPageRef.current;
    const nextPageUrl = np ? (np.slug.startsWith("/") ? np.slug : `/${funnelSlug}/${np.slug}`) : null;
    if (behavior === "send_email" && d.ctaEmailAddress) return `mailto:${d.ctaEmailAddress}`;
    if (behavior === "next_funnel_step" && nextPageUrl) return nextPageUrl;
    if (behavior === "direct_checkout") return "#";
    if (behavior === "landing_page" && d.ctaLandingPageSlug) return `${LEARN_APP_URL}/courses/${d.ctaLandingPageSlug}`;
    if (behavior === "funnel_page" && d.ctaFunnelPageValue) {
      const [fs, ps] = (d.ctaFunnelPageValue as string).split("/");
      if (fs && ps) return `/${fs}/${ps}`;
    }
    return d.ctaLink || nextPageUrl || "#";
  };

  const handleClick = async (e: React.MouseEvent) => {
    const behavior = d.ctaBehavior ?? "url";
    if (behavior === "direct_checkout") {
      e.preventDefault();
      if (!d.checkoutProductId || !d.checkoutProductType) { toast.error("No product configured for this button."); return; }
      setCheckoutLoading(true);
      try {
        const result = await createDirectCheckout.mutateAsync({
          productType: d.checkoutProductType as any,
          productId: Number(d.checkoutProductId),
          origin: window.location.origin,
          promoCode: promoCode || undefined,
          funnelId,
          pageId,
        });
        if ((result as any).freeSuccess) {
          toast.success("Access granted! Redirecting…");
          const url = (result as any).successUrl;
          if (url) setTimeout(() => { window.location.href = url; }, 1200);
        } else if (result.checkoutUrl) {
          window.open(result.checkoutUrl, "_blank");
        }
      } catch (err: any) { toast.error(err.message || "Failed to start checkout"); }
      finally { setCheckoutLoading(false); }
      return;
    }
    if (d.leadCapture) {
      e.preventDefault();
      setLcOpen(true);
    }
  };

  return (
    <div className="py-16" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />
        {d.subtext && <p className="text-lg text-gray-600 mb-8" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
        {/* Price display */}
        {d.showPrice && d.currentPrice && d.priceSource !== "none" && (d.pricePosition ?? "above") === "above" && (
          <div className="mb-6">
            {d.showStrikethroughPrice && d.strikethroughPrice && (
              <p className="text-xl text-gray-400 line-through mb-1">{d.strikethroughPrice}</p>
            )}
            <p className="text-5xl font-bold" style={{ color: d.ctaColor ?? "#179ca3" }}>
              {d.currentPrice}
              {d.priceInterval && <span className="text-2xl font-normal text-gray-500 ml-1">{d.priceInterval}</span>}
            </p>
          </div>
        )}

        <a href={getHref()} onClick={handleClick}
          className={`inline-block px-10 py-4 rounded-xl font-bold text-xl shadow-lg transition-transform hover:scale-105 cursor-pointer ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""} ${checkoutLoading ? "opacity-70 pointer-events-none" : ""}`}
          style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#ffffff" }}>
          {checkoutLoading ? "Redirecting..." : (d.ctaText ?? "Get Started")}
        </a>
        {/* Price below button */}
        {d.showPrice && d.currentPrice && d.priceSource !== "none" && (d.pricePosition ?? "above") === "below" && (
          <div className="mt-6">
            {d.showStrikethroughPrice && d.strikethroughPrice && (
              <p className="text-xl text-gray-400 line-through mb-1">{d.strikethroughPrice}</p>
            )}
            <p className="text-5xl font-bold" style={{ color: d.ctaColor ?? "#179ca3" }}>
              {d.currentPrice}
              {d.priceInterval && <span className="text-2xl font-normal text-gray-500 ml-1">{d.priceInterval}</span>}
            </p>
          </div>
        )}
        <ButtonSubtext d={d} />
        <OptOutLink d={d} />
      </div></div>
      {lcOpen && (
        <LeadCaptureModal
          open={true}
          onClose={() => setLcOpen(false)}
          onSuccess={({ name: ln, email: le }) => {
            try {
              const u = new URL(getHref(), window.location.origin);
              if (ln) u.searchParams.set("name", ln);
              if (le) u.searchParams.set("email", le);
              window.location.href = u.toString();
            } catch { window.location.href = getHref(); }
          }}
          title={d.leadModalTitle || "Get Instant Access"}
          subtext={d.leadModalSubtext}
          tags={d.leadTags}
          funnelId={funnelId}
          pageId={pageId}
        />
      )}
    </div>
  );
}

// ─── Lead Capture Block ──────────────────────────────────────────────────────

function LeadCaptureBlock({ data, funnelId, pageId, nextPageUrl }: { data: Record<string, any>; funnelId: number; pageId: number; nextPageUrl?: string }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // Autopopulate from logged-in user
  useEffect(() => {
    if (user) {
      const fullName = user.displayName ?? user.name ?? [user.firstName, user.lastName].filter(Boolean).join(" ") ?? "";
      if (fullName) setName(fullName);
      if (user.email) setEmail(user.email);
    }
  }, [user?.id]);

  const [submitted, setSubmitted] = useState(false);

  const submitLead = trpc.funnelPublic.submitLead.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      // Persist lead data so the next funnel step (checkout form) can auto-populate
      try { sessionStorage.setItem("funnel_lead", JSON.stringify({ name, email })); } catch {}
      const behavior = data.btnBehavior ?? "none";
      const buildUrl = (base: string) => {
        try {
          const u = new URL(base, window.location.origin);
          if (name) u.searchParams.set("name", name);
          if (email) u.searchParams.set("email", email);
          return u.toString();
        } catch { return base; }
      };
      if (behavior === "external_url" && data.btnUrl) {
        window.location.href = buildUrl(data.btnUrl);
      } else if (behavior === "next_funnel_step" && nextPageUrl) {
        window.location.href = buildUrl(nextPageUrl);
      } else {
        toast.success("Thank you! Check your email for access.");
      }
    },
    onError: (e: any) => toast.error(e.message || "Submission failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Please enter your email"); return; }
    submitLead.mutate({
      funnelId,
      funnelPageId: pageId,
      email,
      name: name || undefined,
      tags: data.tags || undefined,
      campaignId: data.campaignId ? Number(data.campaignId) : undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document.referrer || undefined,
      sourcePage: window.location.href,
    });
  };

  // Derived input styles
  const inputStyle: React.CSSProperties = {
    backgroundColor: data.inputBg ?? "rgba(255,255,255,0.15)",
    borderColor: data.inputBorderColor ?? "rgba(255,255,255,0.4)",
    color: data.inputTextColor ?? "#ffffff",
    borderRadius: data.inputBorderRadius != null ? `${data.inputBorderRadius}px` : "8px",
  };

  // Derived button styles
  const btnStyleType = data.btnStyle ?? "filled";
  const btnBgColor = data.btnBg ?? "#ffffff";
  const btnTxtColor = data.btnTextColor ?? "#179ca3";
  const btnBorderColor = data.btnBorderColor ?? btnBgColor;
  const buttonStyle: React.CSSProperties = btnStyleType === "outline"
    ? { backgroundColor: "transparent", color: btnTxtColor, border: `2px solid ${btnBorderColor}` }
    : { backgroundColor: btnBgColor, color: btnTxtColor, border: `2px solid ${btnBorderColor}` };

  // Compute block background style
  const lcBgType = data.bgType ?? "color";
  const lcBgStyle: React.CSSProperties = (() => {
    if (lcBgType === "gradient") {
      const start = data.bgGradientStart ?? "#179ca3";
      const end = data.bgGradientEnd ?? "#0e4a50";
      const angle = data.bgGradientAngle ?? 135;
      return { background: `linear-gradient(${angle}deg, ${start}, ${end})` };
    }
    if (lcBgType === "image" && data.bgImageUrl) {
      return {
        backgroundImage: `url(${data.bgImageUrl})`,
        backgroundSize: data.bgImageSize ?? "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative" as const,
      };
    }
    return { backgroundColor: data.bgColor ?? "#179ca3" };
  })();
  const lcBorderStyle: React.CSSProperties = (data.blockBorderWidth ?? 0) > 0
    ? { border: `${data.blockBorderWidth}px ${data.blockBorderStyle ?? "solid"} ${data.blockBorderColor ?? "#cccccc"}` }
    : {};
  const lcRadiusStyle: React.CSSProperties = data.blockBorderRadius ? { borderRadius: `${data.blockBorderRadius}px`, overflow: "hidden" } : {};
  const lcWrapStyle: React.CSSProperties = { ...lcBgStyle, ...lcBorderStyle, ...lcRadiusStyle, color: data.textColor ?? "#ffffff" };

  if (submitted && (data.btnBehavior ?? "none") === "none") {
    return (
      <div className="py-16 text-center" style={lcWrapStyle}>
        {lcBgType === "image" && data.bgImageUrl && data.bgOverlayColor && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: data.bgOverlayColor, opacity: data.bgOverlayOpacity ?? 0.4, pointerEvents: "none" }} />
        )}
        <div className="max-w-md mx-auto relative">
          <CheckCircle size={48} className="mx-auto mb-4 opacity-90" />
          <h2 className="text-2xl font-bold mb-2">You're In!</h2>
          <p className="opacity-80">Check your email for access details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-16" style={lcWrapStyle}>
      {lcBgType === "image" && data.bgImageUrl && data.bgOverlayColor && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: data.bgOverlayColor, opacity: data.bgOverlayOpacity ?? 0.4, pointerEvents: "none" }} />
      )}
      <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="max-w-2xl mx-auto text-center relative">
        <h2 className="text-2xl font-bold mb-2">{data.headline ?? "Get Access"}</h2>
        {data.subtext && <p className="opacity-80 mb-6">{data.subtext}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 items-stretch">
          {(data.showNameField ?? true) && (
            <Input
              type="text"
              placeholder={data.namePlaceholder ?? "Your name (optional)"}
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              className="h-12 text-base border flex-1 placeholder:opacity-70"
            />
          )}
          <Input
            type="email"
            placeholder={data.emailPlaceholder ?? "Your email address"}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
            className="h-12 text-base border flex-1 placeholder:opacity-70"
          />
          <Button
            type="submit"
            disabled={submitLead.isPending}
            className="h-12 text-base font-bold whitespace-nowrap px-6"
            style={buttonStyle}
          >
            {submitLead.isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
            {data.ctaText ?? "Get Access"}
          </Button>
        </form>
        <p className="text-xs opacity-60 mt-3">We respect your privacy. Unsubscribe anytime.</p>
      </div></div>
    </div>
  );
}

// ─── CTA with Opt-In Block ───────────────────────────────────────────────────

function CtaOptinBlock({ data, funnelId, pageId, nextPageUrl }: { data: Record<string, any>; funnelId: number; pageId: number; nextPageUrl?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitLead = trpc.funnelPublic.submitLead.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      // Persist lead data so the next funnel step (checkout form) can auto-populate
      try { sessionStorage.setItem("funnel_lead", JSON.stringify({ name, email })); } catch {}
      const behavior = data.btnBehavior ?? "none";
      if (behavior === "external_url" && data.btnUrl) {
        window.location.href = data.btnUrl;
      } else if (behavior === "next_funnel_step" && nextPageUrl) {
        window.location.href = nextPageUrl;
      } else if (data.ctaLink) {
        window.location.href = data.ctaLink;
      }
    },
    onError: (e: any) => toast.error(e.message || "Submission failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Please enter your email"); return; }
    submitLead.mutate({
      funnelId,
      funnelPageId: pageId,
      email,
      name: name || undefined,
      tags: data.tags || undefined,
      campaignId: data.campaignId ? Number(data.campaignId) : undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document.referrer || undefined,
      sourcePage: window.location.href,
    });
  };

  // Input appearance
  const inputStyle: React.CSSProperties = {
    backgroundColor: data.inputBg,
    borderColor: data.inputBorderColor,
    color: data.inputTextColor,
    borderRadius: data.inputBorderRadius != null ? `${data.inputBorderRadius}px` : undefined,
  };

  // Button appearance
  const btnStyleType = data.btnStyle ?? "filled";
  const btnBgColor = data.ctaColor ?? "#179ca3";
  const btnTxtColor = data.ctaTextColor ?? "#fff";
  const btnBorderColor = data.btnBorderColor ?? btnBgColor;
  const buttonStyle: React.CSSProperties = btnStyleType === "outline"
    ? { backgroundColor: "transparent", color: btnTxtColor, border: `2px solid ${btnBorderColor}` }
    : { backgroundColor: btnBgColor, color: btnTxtColor, border: `2px solid ${btnBorderColor}` };

  // Compute block background style
  const optinBgType = data.bgType ?? "color";
  const optinBgStyle: React.CSSProperties = (() => {
    if (optinBgType === "gradient") {
      const start = data.bgGradientStart ?? "#f0fafa";
      const end = data.bgGradientEnd ?? "#e0f7fa";
      const angle = data.bgGradientAngle ?? 135;
      return { background: `linear-gradient(${angle}deg, ${start}, ${end})` };
    }
    if (optinBgType === "image" && data.bgImageUrl) {
      return {
        backgroundImage: `url(${data.bgImageUrl})`,
        backgroundSize: data.bgImageSize ?? "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative" as const,
      };
    }
    return { backgroundColor: data.bgColor ?? "#f0fafa" };
  })();
  const optinBorderStyle: React.CSSProperties = (data.blockBorderWidth ?? 0) > 0
    ? { border: `${data.blockBorderWidth}px ${data.blockBorderStyle ?? "solid"} ${data.blockBorderColor ?? "#cccccc"}` }
    : {};
  const optinRadiusStyle: React.CSSProperties = data.blockBorderRadius ? { borderRadius: `${data.blockBorderRadius}px`, overflow: "hidden" } : {};
  const optinWrapStyle: React.CSSProperties = { ...optinBgStyle, ...optinBorderStyle, ...optinRadiusStyle, textAlign: (data.align ?? "center") as any };

  const showSuccess = submitted && (data.btnBehavior ?? "none") === "none" && !data.ctaLink;
  if (showSuccess) {
    return (
      <div className="py-16 text-center" style={optinWrapStyle}>
        {optinBgType === "image" && data.bgImageUrl && data.bgOverlayColor && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: data.bgOverlayColor, opacity: data.bgOverlayOpacity ?? 0.4, pointerEvents: "none" }} />
        )}
        <div className="max-w-md mx-auto relative">
          <CheckCircle size={48} className="mx-auto mb-4 text-teal-600" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're In!</h2>
          <p className="text-gray-600">Check your email for details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12" style={optinWrapStyle}>
      {optinBgType === "image" && data.bgImageUrl && data.bgOverlayColor && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: data.bgOverlayColor, opacity: data.bgOverlayOpacity ?? 0.4, pointerEvents: "none" }} />
      )}
      <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="max-w-sm mx-auto relative">
        {data.headline && <h2 className="text-2xl font-bold text-gray-900 mb-3" dangerouslySetInnerHTML={{ __html: data.headline }} />}
        {data.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: data.subtext }} />}
        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
          <Input
            type="text"
            placeholder={data.namePlaceholder ?? "Your name"}
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
            className="h-12 text-base placeholder:opacity-70"
          />
          <Input
            type="email"
            placeholder={data.emailPlaceholder ?? "Your email address"}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
            className="h-12 text-base placeholder:opacity-70"
          />
          <Button
            type="submit"
            disabled={submitLead.isPending}
            className="w-full h-12 text-base font-bold"
            style={buttonStyle}
          >
            {submitLead.isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
            {data.ctaText ?? "Get Access"}
          </Button>
        </form>
        <ButtonSubtext d={data} />
        <OptOutLink d={data} />
      </div></div>
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

  return <FunnelPageContent data={data} />;
}

// Inner component so hooks are always called (no early returns before hooks)
function FunnelPageContent({ data }: { data: { funnel: any; page: any; nextPage: any } }) {
  const { funnel, page, nextPage } = data;
  const { user: pageUser } = useAuth();

  let blocks: Block[] = [];
  try {
    blocks = page.blocks ? JSON.parse(page.blocks) : [];
  } catch {
    blocks = [];
  }

  // ─── Branch Rule Evaluation ─────────────────────────────────────────────────
  // Collect visitor context from URL params and sessionStorage
  const urlParams = new URLSearchParams(window.location.search);
  const sessionContext = (() => {
    try { return JSON.parse(sessionStorage.getItem(`funnel_ctx_${funnel.id}`) ?? "{}"); } catch { return {}; }
  })();
  const visitorContext = {
    productsPurchased: sessionContext.productsPurchased ?? [],
    orderBumpsSelected: sessionContext.orderBumpsSelected ?? [],
    email: sessionContext.email ?? undefined,
    purchasePrice: sessionContext.purchasePrice ?? undefined,
    sourceUrl: document.referrer || window.location.href,
    utmSource: urlParams.get("utm_source") ?? undefined,
    utmMedium: urlParams.get("utm_medium") ?? undefined,
    utmCampaign: urlParams.get("utm_campaign") ?? undefined,
    country: sessionContext.country ?? undefined,
    deviceType: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    customFields: sessionContext.customFields ?? undefined,
  };

  const evaluateBranch = trpc.funnelPublic.evaluateBranch.useMutation();
  const [resolvedNextUrl, setResolvedNextUrl] = useState<string | null>(null);
  const [branchResolved, setBranchResolved] = useState(false);

  useEffect(() => {
    evaluateBranch.mutate(
      { pageId: page.id, context: visitorContext },
      {
        onSuccess: (result: any) => {
          if (result.matched) {
            if (result.targetUrl) {
              setResolvedNextUrl(result.targetUrl);
            } else if (result.targetPageSlug && result.targetFunnelSlug) {
              setResolvedNextUrl(`/${result.targetFunnelSlug}/${result.targetPageSlug}`);
            }
          } else if (nextPage) {
            setResolvedNextUrl(`/${funnel.slug}/${nextPage.slug}`);
          }
          setBranchResolved(true);
        },
        onError: () => {
          if (nextPage) setResolvedNextUrl(`/${funnel.slug}/${nextPage.slug}`);
          setBranchResolved(true);
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  // Effective next page for block rendering (use resolved URL or default)
  const effectiveNextPage = resolvedNextUrl
    ? { slug: resolvedNextUrl, title: nextPage?.title ?? "Continue", pageType: nextPage?.pageType ?? "" }
    : nextPage;

  return (
    <div className="min-h-screen bg-white">
      {/* Render all blocks */}
      {blocks.map((block) => {
        // Full-bleed block types must never be wrapped in a contentWidth constraint at the outer level.
        // Their background spans 100% width; contentWidth only constrains inner content (handled inside RenderBlock).
        const FULL_BLEED_TYPES = ["hero", "pricing_cta", "cta_standalone", "divider", "spacer", "footer", "logo_strip", "urgency_offer", "product_offer_stack", "price_stack", "image_content"];
        const isFullBleed = FULL_BLEED_TYPES.includes(block.type);
        const bw = block.data.contentWidth;
        const bwMap: Record<string, string> = { xl: "1280px", lg: "1024px", md: "768px", sm: "640px" };
        const bwMax = !isFullBleed && bw && bw !== "full" ? bwMap[bw] : null;
        return (
          <div key={block.id} style={{ marginTop: block.data.marginTop || undefined, marginBottom: block.data.marginBottom || undefined, paddingTop: block.data.paddingTop || undefined, paddingBottom: block.data.paddingBottom || undefined, paddingLeft: block.data.paddingLeft || undefined, paddingRight: block.data.paddingRight || undefined }}>
            {bwMax ? (
              <div style={{ maxWidth: bwMax, marginLeft: "auto", marginRight: "auto", width: "100%" }}>
                <RenderBlock block={block} funnelId={funnel.id} pageId={page.id} funnelSlug={funnel.slug} nextPage={effectiveNextPage} user={pageUser} />
              </div>
            ) : (
              <RenderBlock block={block} funnelId={funnel.id} pageId={page.id} funnelSlug={funnel.slug} nextPage={effectiveNextPage} user={pageUser} />
            )}
          </div>
        );
      })}

      {/* Next page navigation — only shown when showNavigationButton is explicitly ON */}
      {page.showNavigationButton && branchResolved && resolvedNextUrl && (
        <div className="px-8 py-8 bg-gray-50 border-t border-gray-200">
          <div className="max-w-3xl mx-auto text-center">
            <a
              href={resolvedNextUrl}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors"
            >
              Continue to {nextPage?.title ?? "Next Step"} <ArrowRight size={18} />
            </a>
          </div>
        </div>
      )}
      {/* Fallback: show default next page while branch evaluation is pending — only when showNavigationButton is ON */}
      {page.showNavigationButton && !branchResolved && nextPage && (
        <div className="px-8 py-8 bg-gray-50 border-t border-gray-200">
          <div className="max-w-3xl mx-auto text-center">
            <a
              href={`/${funnel.slug}/${nextPage.slug}`}
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
      <div className="py-12" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6"><div className="max-w-2xl mx-auto text-center">
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
      </div></div>
    );
  }

  return (
    <div className="py-10" style={{ backgroundColor: d.bgColor ?? "#ffffff" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-6 items-start">
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
