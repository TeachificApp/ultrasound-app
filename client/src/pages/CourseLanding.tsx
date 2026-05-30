/**
 * CourseLanding.tsx
 * Public course landing page — renders blocks from the page builder when available,
 * falls back to the auto-generated layout.
 * Route: /courses/:slug
 */
import { useState, useEffect, useRef } from "react";
import PromoCodeInput from "@/components/PromoCodeInput";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ButtonSubtext } from "@/lib/ctaSubtext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { BookOpen, CheckCircle, ChevronRight, Clock, Download, HelpCircle, Lock, PlayCircle, Star, Users, AlertTriangle, Globe, LayoutGrid, Layers, BookMarked, Timer, Tag, CreditCard, List } from "lucide-react";
import OrderBumpOffer from "@/components/OrderBumpOffer";
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";
import { RelatedProductsBlock } from "@/components/RelatedProductsBlock";
import CarouselBlock from "@/components/CarouselBlock";
import type { Block } from "@/components/BlockPreview";
import { CountdownV2Block, ImageLinkWrapper, FormEmbedBlockPreview } from "@/components/BlockPreview";
import { injectUserParams, injectUserParamsIntoHtml, type UserParamSource } from "@/lib/userUrlParams";
import { getStoredAffiliateCode } from "@/pages/AffiliateRedirect";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Click-delegation handler for [data-cta-btn] elements inserted via the rich text CTA button dialog.
 * Attach as onClick on any container that renders dangerouslySetInnerHTML rich text.
 */
export function handleCtaBtnClick(
  e: React.MouseEvent<HTMLElement>,
  onEnroll?: () => void,
  onEnrollWithOption?: (pricingOptionId: number | undefined) => void,
) {
  const target = (e.target as HTMLElement).closest("[data-cta-btn]") as HTMLElement | null;
  if (!target) return;
  e.preventDefault();
  e.stopPropagation();
  const action = target.dataset.action ?? "url";
  if (action === "url") {
    const link = target.dataset.link;
    if (link && link !== "#") window.open(link, "_blank", "noopener,noreferrer");
  } else if (action === "send_email") {
    const email = target.dataset.email;
    if (email) window.location.href = `mailto:${email}`;
  } else if (action === "phone") {
    const phone = target.dataset.phone;
    if (phone) window.location.href = `tel:${phone.replace(/\s/g, "")}`;
  } else if (action === "scroll_to_section") {
    const anchor = target.dataset.anchor;
    if (anchor) {
      const el = document.getElementById(anchor.replace(/^#/, ""));
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  } else if (action === "open_popup") {
    const popup = target.dataset.popup;
    if (popup) {
      const w = 800, h = 600;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(popup, "_blank", `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    }
  } else if (action === "download_file") {
    const dl = target.dataset.download;
    if (dl) window.open(dl, "_blank", "noopener,noreferrer");
  } else if (action === "direct_checkout") {
    onEnroll?.();
  } else if (action === "pricing_option") {
    // Pass the pricing option ID directly to avoid React state closure issues
    const rawId = target.dataset.pricingOption;
    const poId = rawId ? Number(rawId) : undefined;
    if (onEnrollWithOption) {
      onEnrollWithOption(poId);
    } else {
      onEnroll?.();
    }
  }
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-5 h-5" />,
  quiz: <HelpCircle className="w-5 h-5" />,
  download: <Download className="w-5 h-5" />,
};

function formatPrice(c: any): string {
  const pt = c?.pricingType ?? (c?.isFree ? "free" : "one_time");
  if (pt === "free") return "Free";
  if (pt === "trial_then_subscription") {
    const trialDays = c.trialDays ?? 7;
    const intervalLabel: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr" };
    return `${trialDays}-day free trial, then $${Number(c.price).toFixed(2)}${intervalLabel[c.subscriptionInterval ?? "monthly"] ?? "/mo"}`;
  }
  if (pt === "subscription") {
    const intervalLabel: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr" };
    return `$${Number(c.price).toFixed(2)}${intervalLabel[c.subscriptionInterval ?? "monthly"] ?? "/mo"}`;
  }
  if (pt === "payment_plan") {
    const dp = c.downPayment ? `$${Number(c.downPayment).toFixed(2)} down` : "";
    const inst = c.installmentCount && c.installmentAmount
      ? ` + ${c.installmentCount}×$${Number(c.installmentAmount).toFixed(2)}`
      : "";
    return dp + inst || `$${Number(c.price).toFixed(2)}`;
  }
  return `$${Number(c.price).toFixed(2)}`;
}

function formatPricingOption(opt: any): string {
  const pt = opt.pricingType ?? "one_time";
  if (pt === "free") return "Free";
  if (pt === "subscription") {
    const intervalLabel: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr" };
    return `$${Number(opt.price).toFixed(2)}${intervalLabel[opt.subscriptionInterval ?? "monthly"] ?? "/mo"}`;
  }
  if (pt === "payment_plan") {
const dp = opt.downPayment ? `$${Number(opt.downPayment).toFixed(2)} down` : "";
    const inst = opt.installmentCount && opt.installmentAmount
      ? ` + ${opt.installmentCount}×$${Number(opt.installmentAmount).toFixed(2)}`
      : "";
    return dp + inst || `$${Number(opt.price).toFixed(2)}`;
  }
  return `$${Number(opt.price).toFixed(2)}`;
}

function accessLabel(c: any): string {
  const days = c?.accessDurationDays;
  if (!days || days === 0) return "Full lifetime access";
  if (days <= 30) return `${days}-day access`;
  if (days <= 365) return `${Math.round(days / 30)}-month access`;
  if (days === 365) return "1-year access";
  return `${Math.round(days / 365)}-year access`;
}

// ─── Countdown Timer Component ────────────────────────────────────────────────

function CountdownTimer({ mode, durationMinutes, targetDate, textColor }: { mode?: string; durationMinutes?: number; targetDate?: string; textColor: string }) {
  const endRef = useRef<number | null>(null);
  const [time, setTime] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const resolvedMode = mode ?? (targetDate ? "event" : "on_load");
  useEffect(() => {
    if (resolvedMode === "event" && targetDate) {
      endRef.current = new Date(targetDate).getTime();
    } else {
      const storageKey = `countdown_cl_${durationMinutes ?? 90}`;
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

// ─── Block Renderer ────────────────────────────────────────────────────────────

/** Resolve a CTA button action to a click handler */
function resolveBtnAction(
  behavior: string | undefined,
  link: string | undefined,
  emailAddress: string | undefined,
  scrollAnchor: string | undefined,
  popupUrl: string | undefined,
  downloadUrl: string | undefined,
  onEnroll: () => void,
  onEnrollWithOption?: (pricingOptionId: number | undefined) => void,
  pricingOptionId?: number,
  onFreePreview?: () => void,
): () => void {
  const b = behavior ?? (link ? "url" : "");
  if (b === "url" && link) return () => window.open(link, "_blank", "noopener,noreferrer");
  if (b === "send_email" && emailAddress) return () => { window.location.href = `mailto:${emailAddress}`; };
  if (b === "scroll_to_section" && scrollAnchor) return () => { const el = document.getElementById(scrollAnchor.replace(/^#/, "")); if (el) el.scrollIntoView({ behavior: "smooth" }); };
  if (b === "open_popup" && popupUrl) return () => { const w = 800, h = 600; const left = window.screenX + (window.outerWidth - w) / 2; const top = window.screenY + (window.outerHeight - h) / 2; window.open(popupUrl, "_blank", `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`); };
  if (b === "download_file" && downloadUrl) return () => window.open(downloadUrl, "_blank", "noopener,noreferrer");
  // pricing_option → enroll with specific pricing option
  if (b === "pricing_option" && onEnrollWithOption) return () => onEnrollWithOption(pricingOptionId);
  // free_preview → open free preview flow (not checkout)
  if (b === "free_preview" && onFreePreview) return onFreePreview;
  // direct_checkout, group_purchase, next_funnel_step, or default → onEnroll
  return onEnroll;
}

function RenderBlock({ block, course, onEnroll, onEnrollWithOption, enrolling, ctaText, price, selectedPricingOptionId, onSelectPricingOption, slug, enrollment, user, onFreePreviewClick }: {
  block: Block; course: any; onEnroll: () => void; onEnrollWithOption?: (pricingOptionId: number | undefined) => void; enrolling: boolean; ctaText: string; price: string;
  selectedPricingOptionId?: number; onSelectPricingOption?: (id: number | undefined) => void;
  slug?: string; enrollment?: any; user?: UserParamSource | null;
  onFreePreviewClick?: (lessonId: number) => void;
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
      const buttons: Array<{ text: string; color: string; textColor: string; link: string; style: string; animation?: string; showStrikethrough?: boolean; strikethroughPrice?: string; showOptOut?: boolean; optOutText?: string; optOutUrl?: string }> =
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Enroll Now", color: "#fff", textColor: "#179ca3", link: "", style: "filled" }];
      const hasInlineMedia = !!d.inlineMediaUrl;
      const placement = d.inlineMediaPlacement ?? "right";
      const isHorizontal = placement === "left" || placement === "right";
      const heroBottomBorderStyle: React.CSSProperties = d.heroBottomBorder
        ? { borderBottom: `${d.heroBottomBorderWidth ?? 4}px solid ${d.heroBottomBorderColor ?? "#179ca3"}` }
        : {};
      const heroClickHandler = d.heroClickable && d.heroBehavior && d.heroBehavior !== "next_funnel_step"
        ? () => {
            const beh = d.heroBehavior as string;
            if (beh === "url" && d.heroLink) window.open(d.heroLink, "_blank");
            else if (beh === "send_email" && d.heroEmail) window.location.href = `mailto:${d.heroEmail}`;
            else if (beh === "scroll_to_section" && d.heroScrollAnchor) {
              const el = document.getElementById(d.heroScrollAnchor.replace(/^#/, ""));
              el?.scrollIntoView({ behavior: "smooth" });
            } else if (beh === "download_file" && d.heroDownloadUrl) window.open(d.heroDownloadUrl, "_blank");
            else if (beh === "open_popup" && d.heroPopupUrl) window.open(d.heroPopupUrl, "_blank");
            else if (beh === "pricing_option") {
              const poId = d.heroPricingOptionId ? Number(d.heroPricingOptionId) : undefined;
              if (onEnrollWithOption) onEnrollWithOption(poId);
              else onEnroll();
            } else if (beh === "direct_checkout") {
              onEnroll();
            }
          }
        : undefined;
      return (
        <div className="relative px-8 py-16 overflow-hidden" style={{ ...heroBg, ...heroBottomBorderStyle, color: d.textColor ?? "#fff", textAlign: hasInlineMedia && isHorizontal ? "left" as const : (d.align ?? "left"), minHeight: `${d.heroMinHeight ?? 400}px`, cursor: heroClickHandler ? "pointer" : undefined }} onClick={heroClickHandler}>
          {bgType === "video" && d.videoUrl && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.videoUrl} /></video>
          )}
          <div className={`relative max-w-5xl mx-auto ${hasInlineMedia && isHorizontal ? "flex items-center gap-10" : ""} ${hasInlineMedia && placement === "left" ? "flex-row-reverse" : ""}`}>
            <div className={hasInlineMedia && isHorizontal ? "flex-1" : "max-w-3xl mx-auto"}>
              <h1 className="text-4xl font-bold mb-4 leading-tight animate-fade-slide-up" dangerouslySetInnerHTML={{ __html: `<span style="${d.headlineColor ? `color:${d.headlineColor}` : ''}">${d.headline ?? ''}</span>${d.headline2 ? `<br/><span style="${d.headline2Color ? `color:${d.headline2Color}` : ''}">${d.headline2}</span>` : ''}` }} />
              {d.subheadline && <p className="text-xl opacity-90 mb-8 animate-fade-slide-up-delay-1" dangerouslySetInnerHTML={{ __html: d.subheadline }} />}
              {!d.hideButtons && <div className="flex flex-wrap gap-3 animate-fade-slide-up-delay-2" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
                {buttons.map((btn, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <button onClick={resolveBtnAction((btn as any).behavior, btn.link, (btn as any).emailAddress, (btn as any).scrollAnchor, (btn as any).popupUrl, (btn as any).downloadUrl, onEnroll, onEnrollWithOption, (btn as any).pricingOptionId ? Number((btn as any).pricingOptionId) : undefined, onFreePreviewClick ? () => { const fp = (course?.sections ?? []).flatMap((s: any) => s.lessons ?? []).find((l: any) => l.isPreview || l.previewMode === "preview") ?? (course?.sections ?? []).flatMap((s: any) => s.lessons ?? [])[0]; if (fp && onFreePreviewClick) onFreePreviewClick(fp.id); else onEnroll(); } : undefined)}
                      className={`px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-opacity hover:opacity-90 ${(btn as any).animation && (btn as any).animation !== "none" ? `animate-${(btn as any).animation}-btn` : ""}`}
                      style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                      {btn.text}
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
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff", color: d.textColor ?? "#1a1a1a", textAlign: d.align ?? "left" }}
          onClick={e => handleCtaBtnClick(e as React.MouseEvent<HTMLElement>, handleEnroll, onEnrollWithOption)}>
          <div className="max-w-3xl mx-auto prose" dangerouslySetInnerHTML={{ __html: d.html ?? "" }} />
        </div>
      );
    case "image": {
      const imgAlignCL = d.align ?? "center";
      const imgJustifyCL = imgAlignCL === "left" ? "flex-start" : imgAlignCL === "right" ? "flex-end" : "center";
      const mwCL = d.maxWidth ?? "auto";
      const imgStyleCL: React.CSSProperties = { maxWidth: mwCL === "auto" ? "100%" : mwCL, width: mwCL === "auto" ? undefined : "100%", height: d.height || "auto", objectFit: "cover", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.noBorder ? "none" : (d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined) };
      const imgElCL = d.url ? <img src={d.url} alt={d.alt ?? ""} className={d.showShadow !== false ? "shadow" : ""} style={imgStyleCL} /> : null;
      // Resolve onAction for checkout/free_preview image link behaviors
      const imgOnAction = (() => {
        const beh = d.linkBehavior as string | undefined;
        if (!beh) return undefined;
        if (beh === "free_preview") return onFreePreviewClick ? () => { const fp = (course?.sections ?? []).flatMap((s: any) => s.lessons ?? []).find((l: any) => l.isPreview || l.previewMode === "preview") ?? (course?.sections ?? []).flatMap((s: any) => s.lessons ?? [])[0]; if (fp && onFreePreviewClick) onFreePreviewClick(fp.id); else onEnroll(); } : onEnroll;
        if (beh === "pricing_option") return onEnrollWithOption ? () => onEnrollWithOption(d.linkPricingOptionId ? Number(d.linkPricingOptionId) : undefined) : onEnroll;
        if (beh === "direct_checkout" || beh === "group_purchase") return onEnroll;
        return undefined;
      })();
      return (
        <div className="px-8 py-6" style={{ display: "flex", flexDirection: "column", alignItems: imgJustifyCL }}>
          {imgElCL && <ImageLinkWrapper d={d} onAction={imgOnAction}>{imgElCL}</ImageLinkWrapper>}
          {d.caption && <p className="text-sm text-gray-500 mt-2" style={{ textAlign: imgAlignCL as any }}>{d.caption}</p>}
        </div>
      );
    }
    case "video": {
      const resolvedVidUrl = injectUserParams(d.embedUrl ?? "", user);
      return (
        <div className="px-8 py-6">
          <div className="mx-auto" style={{ maxWidth: d.maxWidth ?? "100%" }}>
            {resolvedVidUrl && (
              <div className="relative w-full overflow-hidden shadow" style={{ paddingBottom: d.height ? undefined : "56.25%", height: d.height || undefined, borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined }}>
                <iframe src={resolvedVidUrl} className="absolute inset-0 w-full h-full" allowFullScreen title="Video" />
              </div>
            )}
            {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
          </div>
        </div>
      );
    }
    case "embed":
      return (
        <div className="px-8 py-6">
          {d.embedCode ? (
            <iframe
              srcDoc={injectUserParamsIntoHtml(d.embedCode, user)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
              style={{ width: "100%", height: d.height ?? 400, border: "none", display: "block" }}
              title={d.caption ?? "Embedded content"}
            />
          ) : null}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
    case "gallery":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
            {(d.images ?? []).map((img: any, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden shadow">
                {img.url ? <img src={img.url} alt={img.caption ?? ""} className="w-full h-40 object-cover" /> : null}
                {img.caption && <p className="text-xs text-gray-500 p-2 text-center">{img.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    case "bullets": {
      const bulletItems = (d.items ?? []).map((item: any) =>
        typeof item === "string" ? item : (item?.text ?? "")
      );
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
            {bulletItems.map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 text-lg" style={{ color: d.iconColor ?? "#179ca3" }}>✓</span>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "numbered_list": {
      const numItems = (d.items ?? []).map((item: any) =>
        typeof item === "string" ? item : (item?.text ?? "")
      );
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-2 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subHeading && <p className="text-gray-500 mb-6 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: d.subHeading }} />}
          {!d.subHeading && d.headline && <div className="mb-6" />}
          <div className="space-y-4 max-w-2xl">
            {numItems.map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{i + 1}</span>
                <span className="text-gray-700 pt-1">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "checklist": {
      const clItems: Array<{ text: string; crossed: boolean }> = (d.items ?? []).map(
        (item: any) => typeof item === "string" ? { text: item, crossed: false } : { text: item?.text ?? "", crossed: item?.crossed ?? false }
      );
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-2 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subHeading && <p className="text-gray-500 mb-6 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: d.subHeading }} />}
          {!d.subHeading && d.headline && <div className="mb-6" />}
          <div className="space-y-3 max-w-2xl">
            {clItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                {item.crossed ? (
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5" style={{ backgroundColor: "#ef4444" }}>✗</span>
                ) : (
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>✓</span>
                )}
                <span className={item.crossed ? "text-gray-400 line-through" : "text-gray-700"}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "icon_grid":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
            {(d.items ?? []).map((item: any, i: number) => (
              <div key={i} className="text-center p-4">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "testimonial":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f0fafa" }}>
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-4xl mb-4" style={{ color: d.accentColor ?? "#179ca3" }}>"</div>
            <p className="text-xl text-gray-700 italic mb-6">{d.quote}</p>
            {(d.rating ?? 0) > 0 && (
              <div className="flex items-center justify-center gap-0.5 mb-4">
                {Array.from({ length: d.rating }).map((_: any, i: number) => <span key={i} className="text-yellow-400 text-xl">★</span>)}
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              {d.avatarUrl && <img src={d.avatarUrl} alt={d.author} className="w-10 h-10 rounded-full object-cover" />}
              <span className="font-semibold text-gray-900">{d.author}</span>
            </div>
          </div>
        </div>
      );
    case "reviews":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {(d.reviews ?? []).map((r: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-1 mb-2">{Array.from({ length: r.rating ?? 5 }).map((_, j) => <span key={j} className="text-yellow-400">★</span>)}</div>
                <p className="text-gray-700 mb-3 italic">"{r.text}"</p>
                <p className="text-sm font-semibold text-gray-900">— {r.name}</p>
              </div>
            ))}
          </div>
        </div>
      );
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
    case "instructor":
      return <InstructorPublicBlock d={d} />;
    case "related_products":
      return <RelatedProductsBlock data={d} currentSlug={slug} currentType="course" />;
    case "faq":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8" style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="max-w-3xl space-y-3">
            {(d.items ?? []).map((item: any, i: number) => (
              <details key={i} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${d.accentColor ?? "#e5e7eb"}`, backgroundColor: d.itemBgColor ?? "transparent" }}>
                <summary
                  className="px-5 py-4 font-semibold cursor-pointer"
                  style={{ color: d.questionColor ?? "#111827" }}
                  onMouseEnter={e => { if (d.itemHoverColor) (e.currentTarget.parentElement as HTMLElement).style.backgroundColor = d.itemHoverColor; }}
                  onMouseLeave={e => { (e.currentTarget.parentElement as HTMLElement).style.backgroundColor = d.itemBgColor ?? "transparent"; }}
                >{item.q}</summary>
                <div className="px-5 py-4 prose prose-sm max-w-none" style={{ color: d.answerColor ?? "#4b5563", borderTop: `1px solid ${d.dividerColor ?? "#f3f4f6"}` }} dangerouslySetInnerHTML={{ __html: item.a ?? "" }} />
              </details>
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
    case "countdown_v2": {
      return <CountdownV2Block data={d} />;
    }
    case "alert": {
      const alertStyles: Record<string, string> = { info: "bg-blue-50 border-blue-300 text-blue-800", success: "bg-green-50 border-green-300 text-green-800", warning: "bg-yellow-50 border-yellow-300 text-yellow-800", error: "bg-red-50 border-red-300 text-red-800" };
      return (
        <div className={`mx-8 my-4 px-5 py-4 rounded-lg border-l-4 flex items-start gap-3 ${alertStyles[d.alertType ?? "info"] ?? alertStyles.info}`}>
          <span className="text-xl flex-shrink-0">{d.icon ?? "💡"}</span>
          <p className="font-medium">{d.text}</p>
        </div>
      );
    }
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
          <button onClick={resolveBtnAction(d.ctaBehavior, d.ctaLink, d.emailAddress, d.scrollAnchor, d.popupUrl, d.downloadUrl, onEnroll, onEnrollWithOption, d.ctaPricingOptionId ? Number(d.ctaPricingOptionId) : undefined)} disabled={enrolling} className={`px-10 py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-60 transition-opacity hover:opacity-90 ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`} style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>
            {enrolling ? "Processing…" : (d.ctaText ?? ctaText)}
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
    case "cta_standalone":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa", textAlign: d.align ?? "center" }}>
          {d.headline && <h2 className="text-2xl font-bold text-gray-900 mb-3" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          <button onClick={resolveBtnAction(d.ctaBehavior, d.ctaLink, d.emailAddress, d.scrollAnchor, d.popupUrl, d.downloadUrl, onEnroll, onEnrollWithOption, d.ctaPricingOptionId ? Number(d.ctaPricingOptionId) : undefined)} disabled={enrolling}
            className={`inline-block px-8 py-3 rounded-lg font-semibold shadow disabled:opacity-60 transition-opacity hover:opacity-90 ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`} style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>
            {d.ctaText ?? ctaText}
          </button>
          <ButtonSubtext d={d} />
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
    case "funnel_workflow":
      return <FunnelWorkflowBlock data={d} />;
    case "product_offer_stack":
      return <ProductOfferStackBlock data={d} onPrimaryCta={onEnroll} />;
    case "order_bump_checkout":
      return <InlineOrderBumpBlock data={d} onPrimaryCta={onEnroll} />;
    case "curriculum_auto": {
      const cr = d.cornerRadius ?? 12;
      const iconStyle = d.iconStyle ?? "lock";
      const hAlign = d.headlineAlign ?? "left";
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className={`text-2xl font-bold mb-6 ${hAlign === "center" ? "text-center" : hAlign === "right" ? "text-right" : "text-left"}`} style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="overflow-hidden max-w-3xl" style={{ border: `1px solid ${d.sectionBorderColor ?? "#e5e7eb"}`, borderRadius: `${cr}px` }}>
            <Accordion type="multiple" defaultValue={["section-0"]}>
              {course.sections.filter((section: any) => {
                const published = (section.lessons ?? []).filter((l: any) => l.lessonStatus !== "draft");
                return published.length > 0;
              }).map((section: any, si: number) => {
                const publishedLessons = (section.lessons ?? []).filter((l: any) => l.lessonStatus !== "draft");
                return (
                <AccordionItem key={section.id} value={`section-${si}`} style={{ borderBottom: `1px solid ${d.sectionBorderColor ?? "#e5e7eb"}` }}>
                  <AccordionTrigger
                    className="hover:no-underline px-5 font-semibold text-sm"
                    style={{ backgroundColor: d.sectionBgColor ?? "#f9fafb", color: d.sectionTextColor ?? "#1f2937" }}
                  >
                    <span>{section.title}</span>
                    <span className="text-xs ml-auto mr-2" style={{ color: d.lessonCountColor ?? "#9ca3af" }}>{publishedLessons.length} lesson{publishedLessons.length !== 1 ? "s" : ""}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1 pt-1">
                      {publishedLessons.filter((lesson: any) => {
                        if (!enrollment) return true; // not enrolled — show all
                        const pm = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
                        return pm !== "preview_hide_after_purchase";
                      }).map((lesson: any) => {
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
                            <span style={{ color: isFreePreview ? (d.lessonPreviewIconColor ?? "#0d9488") : (d.lessonTextColor ?? "#374151"), fontWeight: isFreePreview ? 500 : 400 }}>{lesson.title}</span>
                            {isFreePreview && (
                              <button
                                type="button"
                                className="ml-auto text-xs hover:underline font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                                style={{ color: d.lessonPreviewIconColor ?? "#0d9488" }}
                                onClick={(e) => { e.stopPropagation(); onFreePreviewClick?.(lesson.id); }}
                              >
                                <PlayCircle className="w-3 h-3" /> Free Preview
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </div>
      );
    }
    case "pricing_options_auto": {
      const pricingOptions: any[] = course.pricingOptions ?? [];
      const allOptions = [
        // Primary option (always first)
        {
          id: undefined as number | undefined,
          label: d.primaryLabel ?? course.title,
          sublabel: d.primarySublabel ?? null,
          pricingType: course.pricingType ?? (course.isFree ? "free" : "one_time"),
          price: course.price,
          ctaLabel: d.primaryCtaLabel ?? null,
          isPrimary: true,
        },
        // Active secondary options
        ...pricingOptions.filter((o: any) => o.isActive).map((o: any) => ({ ...o, isPrimary: false })),
      ];
      const currentSelected = selectedPricingOptionId;
      const cardBg = d.cardBgColor ?? "#ffffff";
      const cardBorder = d.cardBorderColor ?? "#e5e7eb";
      const featuredColor = d.featuredCardColor ?? "#179ca3";
      const titleColor = d.cardTitleColor ?? "#111827";
      const priceColor = d.priceColor ?? "#179ca3";
      const ctaTextColor = d.ctaTextColor ?? "#ffffff";
      // Merge per-card overrides (d.cards) with auto-populated allOptions
      const mergedOptions = allOptions.map((opt: any, i: number) => {
        const override = (d.cards ?? [])[i] ?? {};
        return { ...opt, ...Object.fromEntries(Object.entries(override).filter(([, v]) => v !== undefined && v !== "")) };
      });
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center" style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className={`grid gap-4 max-w-4xl mx-auto ${mergedOptions.length === 1 ? "max-w-sm" : mergedOptions.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
            {mergedOptions.map((opt: any, i: number) => {
              const isSelected = opt.id === undefined ? currentSelected === undefined : currentSelected === opt.id;
              const optPrice = opt.isPrimary ? price : formatPricingOption(opt);
              const optCta = opt.ctaLabel ?? (opt.isPrimary ? ctaText : `Enroll — ${opt.label}`);
              const isFeatured = opt.isPrimary;
              const badgeLabel = opt.badge ?? (isFeatured ? "Most Popular" : null);
              // Resolve per-card CTA action (supports all CTAActionPicker behaviors)
              const cardBehavior = opt.ctaBehavior ?? (opt.ctaUrl ? "url" : undefined);
              const cardCtaAction = resolveBtnAction(
                cardBehavior,
                opt.ctaUrl,
                opt.ctaEmailAddress,
                opt.ctaScrollAnchor,
                opt.ctaPopupUrl,
                opt.ctaDownloadUrl,
                () => { onSelectPricingOption?.(opt.id); onEnroll(); },
                onEnrollWithOption,
                opt.ctaPricingOptionId ? Number(opt.ctaPricingOptionId) : opt.id,
              );
              const isExternalAction = cardBehavior && ["url", "send_email", "download_file", "open_popup", "scroll_to_section"].includes(cardBehavior);
              const handleCardClick = () => { if (isExternalAction) { cardCtaAction(); } else { onSelectPricingOption?.(opt.id); } };
              return (
                <div
                  key={i}
                  onClick={handleCardClick}
                  className="rounded-xl overflow-hidden cursor-pointer transition-all border-2"
                  style={{ borderColor: isSelected ? featuredColor : cardBorder, backgroundColor: cardBg, boxShadow: isSelected ? `0 4px 20px ${featuredColor}33` : undefined }}
                >
                  {opt.imageUrl && <img src={opt.imageUrl} alt={opt.label ?? ""} className="w-full h-28 object-cover" />}
                  <div className="p-6 text-center">
                    {badgeLabel && <div className="text-xs font-semibold uppercase tracking-wide mb-2 px-3 py-1 rounded-full inline-block text-white" style={{ backgroundColor: featuredColor }}>{badgeLabel}</div>}
                    <h3 className="font-bold mb-1" style={{ color: titleColor }}>{opt.label}</h3>
                    {opt.sublabel && <p className="text-xs mb-3" style={{ color: d.answerColor ?? "#6b7280" }}>{opt.sublabel}</p>}
                    <p className="text-3xl font-bold mb-4" style={{ color: priceColor }}>{optPrice}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); cardCtaAction(); }}
                      disabled={enrolling && isSelected && !isExternalAction}
                      className="w-full py-3 rounded-lg font-semibold disabled:opacity-60 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: ctaTextColor }}
                    >
                      {enrolling && isSelected && !isExternalAction ? "Processing\u2026" : optCta}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case "cohort_sessions_auto": {
      const sessions: any[] = course.cohortSessions ?? [];
      const now = new Date();
      const visibleSessions = d.showPastSessions
        ? sessions
        : sessions.filter((s: any) => new Date(s.sessionDate) >= now);
      const accentColor = d.accentColor ?? "#179ca3";
      if (visibleSessions.length === 0) return null;
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6" style={{ color: d.headlineColor ?? "#111827", textAlign: "center" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="space-y-3 max-w-2xl mx-auto">
            {visibleSessions.map((s: any, i: number) => {
              const sessionDate = new Date(s.sessionDate);
              const tz = s.timezone ?? "America/New_York";
              const dateStr = sessionDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
              const timeStr = sessionDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: tz });
              const isPast = sessionDate < now;
              return (
                <div key={s.id} className="flex items-start gap-4 p-4 rounded-xl border" style={{ borderColor: `${accentColor}33`, backgroundColor: isPast ? "#f9fafb" : `${accentColor}08`, opacity: isPast ? 0.7 : 1 }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5" style={{ backgroundColor: isPast ? "#9ca3af" : accentColor }}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{dateStr} · {timeStr}{d.showDuration !== false && s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}</p>
                    {d.showDescription !== false && s.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{s.description}</p>}
                  </div>
                  {isPast && <span className="text-xs text-gray-400 flex-shrink-0 mt-1">Past</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case "divider":
      return <div style={{ padding: `${d.spacing ?? 32}px 32px` }}><hr style={{ borderTop: `${d.thickness ?? 1}px ${d.style ?? "solid"} ${d.color ?? "#e5e7eb"}`, borderRadius: d.borderRadius ? `${d.borderRadius}px` : undefined }} /></div>;
    case "two_column":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}
          onClick={e => handleCtaBtnClick(e as React.MouseEvent<HTMLElement>, onEnroll, onEnrollWithOption)}>
          <div className="flex gap-8">
            <div className="prose" style={{ flex: d.leftRatio ?? 50 }} dangerouslySetInnerHTML={{ __html: d.leftHtml ?? "" }} />
            <div className="prose" style={{ flex: 100 - (d.leftRatio ?? 50) }} dangerouslySetInnerHTML={{ __html: d.rightHtml ?? "" }} />
          </div>
        </div>
      );
    case "divided_columns": {
      const cols = d.columns ?? [{ html: "" }, { html: "" }];
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}
          onClick={e => handleCtaBtnClick(e as React.MouseEvent<HTMLElement>, onEnroll, onEnrollWithOption)}>
          <div className="max-w-5xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: `${d.gap ?? 32}px` }}>
            {cols.map((col: any, i: number) => (
              <div key={i} className="prose" dangerouslySetInnerHTML={{ __html: col.html ?? "" }} />
            ))}
          </div>
        </div>
      );
    }
    case "three_column": {
      const divStyle3 = d.showDividers ? { borderRightWidth: `${d.dividerWidth ?? 1}px`, borderRightStyle: (d.dividerStyle ?? "solid") as any, borderRightColor: d.dividerColor ?? "#e5e7eb", borderRadius: d.dividerRadius ? `${d.dividerRadius}px` : undefined } : {};
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}
          onClick={e => handleCtaBtnClick(e as React.MouseEvent<HTMLElement>, onEnroll, onEnrollWithOption)}>
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
    case "logo_strip": {
      const logoAlign = d.align ?? "center";
      return (
        <div style={{ backgroundColor: d.bgColor ?? "#ffffff", padding: d.padding ?? "16px 0" }}>
          <div className={`flex ${logoAlign === "left" ? "justify-start" : logoAlign === "right" ? "justify-end" : "justify-center"} px-6`}>
            {d.logoUrl ? (
              d.link ? <a href={d.link}><img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.maxWidth ?? "200px", height: "auto" }} className="object-contain" /></a>
              : <img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.maxWidth ?? "200px", height: "auto" }} className="object-contain" />
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
          <p className="text-xs text-center opacity-60">{d.copyrightText ?? `\u00a9 ${new Date().getFullYear()} All rights reserved.`}</p>
        </footer>
      );
    }
    case "carousel":
      return <div className="px-4 py-4"><CarouselBlock data={d} /></div>;
    case "form_embed":
      return <FormEmbedBlockPreview d={d} />;
    case "pricing_cards": {
      // Render pricing cards with full CTA action support — clicks delegated to handleCtaBtnClick
      const pcTiers: Array<{ name: string; price: string; interval?: string; description?: string; badge?: string; features: string[]; ctaText: string; ctaLink?: string; ctaBehavior?: string; ctaEmailAddress?: string; ctaScrollAnchor?: string; ctaPopupUrl?: string; ctaDownloadUrl?: string; highlighted?: boolean }> = d.tiers ?? [];
      const accentColor = d.accentColor ?? "#179ca3";
      const tierDataAttrs = (tier: typeof pcTiers[0]) => {
        const beh = tier.ctaBehavior ?? (tier.ctaLink ? "url" : "direct_checkout");
        const attrs: Record<string, string> = { "data-cta-btn": "1", "data-action": beh };
        if (beh === "url" && tier.ctaLink) attrs["data-link"] = tier.ctaLink;
        if (beh === "send_email" && tier.ctaEmailAddress) attrs["data-email"] = tier.ctaEmailAddress;
        if (beh === "scroll_to_section" && tier.ctaScrollAnchor) attrs["data-anchor"] = tier.ctaScrollAnchor;
        if (beh === "open_popup" && tier.ctaPopupUrl) attrs["data-popup"] = tier.ctaPopupUrl;
        if (beh === "download_file" && tier.ctaDownloadUrl) attrs["data-download"] = tier.ctaDownloadUrl;
        if (beh === "pricing_option" && (tier as any).ctaPricingOptionId) attrs["data-pricing-option"] = String((tier as any).ctaPricingOptionId);
        return attrs;
      };
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}
          onClick={e => handleCtaBtnClick(e as React.MouseEvent<HTMLElement>, onEnroll, onEnrollWithOption)}>
          {d.headline && <h2 className="text-2xl font-bold mb-2 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-center text-gray-500 mb-8 text-sm" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          {!d.subtext && d.headline && <div className="mb-8" />}
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${pcTiers.length || 1}, 1fr)`, maxWidth: "900px", margin: "0 auto" }}>
            {pcTiers.map((tier, ti) => (
              <div key={ti} className="rounded-2xl overflow-hidden flex flex-col" style={{ border: tier.highlighted ? `2px solid ${accentColor}` : "1px solid #e5e7eb", boxShadow: tier.highlighted ? `0 8px 32px ${accentColor}22` : "0 1px 4px rgba(0,0,0,0.06)" }}>
                {tier.badge && (
                  <div className="text-center text-xs font-bold py-1.5 text-white" style={{ backgroundColor: accentColor }}>{tier.badge}</div>
                )}
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{tier.name}</h3>
                  {tier.description && <p className="text-gray-500 text-xs mb-4">{tier.description}</p>}
                  <div className="mb-4">
                    <span className="text-3xl font-black" style={{ color: accentColor }}>{tier.price}</span>
                    {tier.interval && <span className="text-sm text-gray-400 ml-1">{tier.interval}</span>}
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {(tier.features ?? []).map((feat, fi) => (
                      <li key={fi} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold mt-0.5" style={{ backgroundColor: accentColor }}>✓</span>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <button {...tierDataAttrs(tier)} disabled={enrolling} className="block w-full text-center py-2.5 rounded-xl font-semibold text-sm cursor-pointer disabled:opacity-60" style={{ backgroundColor: tier.highlighted ? accentColor : "transparent", color: tier.highlighted ? "#fff" : accentColor, border: `2px solid ${accentColor}` }}>
                    {enrolling ? "Processing…" : (tier.ctaText || "Get Started")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CourseLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [enrolling, setEnrolling] = useState(false);
  const [selectedOrderBumpId, setSelectedOrderBumpId] = useState<number | undefined>();
  // Read pricingOptionId from URL so ?pricingOptionId=N&checkout=1 links open the correct Stripe price
  const _urlSearchParams = new URLSearchParams(window.location.search);
  const _urlPricingOptionId = _urlSearchParams.get("pricingOptionId") ? Number(_urlSearchParams.get("pricingOptionId")) : undefined;
  const [selectedPricingOptionId, setSelectedPricingOptionId] = useState<number | undefined>(_urlPricingOptionId);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const isPreview = _urlSearchParams.get("preview") === "admin";
  const autoCheckout = _urlSearchParams.get("checkout") === "1";
  // Guest checkout modal state (for unauthenticated users clicking CTA)
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestPricingOptionId, setGuestPricingOptionId] = useState<number | undefined>();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);

  // Free Preview modal state
  const [freePreviewOpen, setFreePreviewOpen] = useState(false);
  const [freePreviewLessonId, setFreePreviewLessonId] = useState<number | null>(null);
  const [fpFirstName, setFpFirstName] = useState("");
  const [fpLastName, setFpLastName] = useState("");
  const [fpEmail, setFpEmail] = useState("");
  const [fpSubmitting, setFpSubmitting] = useState(false);

  const { data: course, isLoading } = trpc.lms.getCourse.useQuery({ slug: slug!, preview: isPreview || undefined }, { enabled: !!slug });
  const { data: myCourses } = trpc.lmsLearner.getMyCourses.useQuery(undefined, { enabled: !!user });
  const enrollment = myCourses?.find((e: any) => e.courseId === course?.id);

  const enrollFree = trpc.lmsLearner.enrollFree.useMutation({
    onSuccess: () => { toast.success("Enrolled! You now have access to this course."); navigate(`/courses/${slug}/player`); },
    onError: (e) => toast.error(`Enrollment failed: ${e.message}`),
  });
  const createCheckout = trpc.lmsLearner.createCheckout.useMutation({
    onSuccess: (data) => { if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank"); },
    onError: (e) => toast.error(`Checkout failed: ${e.message}`),
  });
  const registerFreePreview = trpc.lms.registerFreePreview.useMutation();
  const utils = trpc.useUtils();
  const guestCheckoutRegister = trpc.lmsLearner.guestCheckoutRegister.useMutation({
    onSuccess: async (data) => {
      // Invalidate auth state so useAuth() picks up the new session cookie immediately
      await utils.auth.me.invalidate();
      setGuestModalOpen(false);
      if (data.enrolled) {
        toast.success("Enrolled! You now have access to this course.");
        navigate(`/courses/${slug}/player`);
      } else if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
      }
    },
    onError: (e) => toast.error(`Checkout failed: ${e.message}`),
  });

  const handleFreePreviewClick = (lessonId: number) => {
    // If user is logged in, grant access directly via lmsLearner.createFreePreviewEnrollment
    if (user) {
      navigate(`/courses/${slug}/player?lesson=${lessonId}`);
      return;
    }
    // Guest: show registration modal
    setFreePreviewLessonId(lessonId);
    setFpFirstName("");
    setFpLastName("");
    setFpEmail("");
    setFreePreviewOpen(true);
  };

  const handleFreePreviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !freePreviewLessonId) return;
    setFpSubmitting(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const { accessToken } = await registerFreePreview.mutateAsync({
        courseId: course.id,
        email: fpEmail,
        firstName: fpFirstName,
        lastName: fpLastName || undefined,
        source: "course_landing",
        utmSource: params.get("utm_source") ?? undefined,
        utmMedium: params.get("utm_medium") ?? undefined,
        utmCampaign: params.get("utm_campaign") ?? undefined,
      });
      setFreePreviewOpen(false);
      // Store token in sessionStorage so the player can verify access
      sessionStorage.setItem(`fp_token_${course.id}`, accessToken);
      navigate(`/courses/${slug}/player?lesson=${freePreviewLessonId}&fp=${accessToken}`);
    } catch (err: any) {
      toast.error(err.message ?? "Registration failed");
    } finally {
      setFpSubmitting(false);
    }
  };

  const openGuestCheckoutModal = (pricingOptionId?: number) => {
    setGuestPricingOptionId(pricingOptionId);
    setGuestName("");
    setGuestEmail("");
    setGuestModalOpen(true);
  };

  const handleGuestCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !guestName.trim() || !guestEmail.trim()) return;
    setGuestSubmitting(true);
    try {
      await guestCheckoutRegister.mutateAsync({
        courseSlug: slug,
        name: guestName.trim(),
        email: guestEmail.trim(),
        pricingOptionId: guestPricingOptionId,
        orderBumpId: selectedOrderBumpId,
        promoCode: promoCode ?? undefined,
        origin: window.location.origin,
        referrer: document.referrer || undefined,
      });
    } finally {
      setGuestSubmitting(false);
    }
  };

  const handleEnroll = async () => {
    if (!user) {
      openGuestCheckoutModal(selectedPricingOptionId);
      return;
    }
    if (enrollment) { navigate(`/courses/${slug}/player`); return; }
    if (isEnrollmentClosed) return; // Enrollment is closed — do nothing
    setEnrolling(true);
    try {
      // If a secondary pricing option is selected, use it; otherwise use primary course pricing
      const resolvedPricingType = selectedPricingOptionId
        ? (course?.pricingOptions?.find((o: any) => o.id === selectedPricingOptionId)?.pricingType ?? course?.pricingType)
        : (course?.pricingType ?? (course?.isFree ? "free" : "one_time"));
      if (resolvedPricingType === "free") await enrollFree.mutateAsync({ courseSlug: slug! });
      else await createCheckout.mutateAsync({ courseSlug: slug!, seats: 1, origin: window.location.origin, orderBumpId: selectedOrderBumpId, pricingOptionId: selectedPricingOptionId, promoCode: promoCode ?? undefined, affiliateCode: getStoredAffiliateCode() ?? undefined });
    } finally { setEnrolling(false); }
  };

  /** Enroll with a specific pricing option ID — avoids React state closure timing issues */
  const handleEnrollWithOption = async (pricingOptionId: number | undefined) => {
    if (!user) {
      openGuestCheckoutModal(pricingOptionId);
      return;
    }
    if (enrollment) { navigate(`/courses/${slug}/player`); return; }
    if (isEnrollmentClosed) return;
    setEnrolling(true);
    // Also sync the UI selection state so the checkout modal shows the right option
    if (pricingOptionId !== undefined) setSelectedPricingOptionId(pricingOptionId);
    try {
      const resolvedPricingType = pricingOptionId
        ? (course?.pricingOptions?.find((o: any) => o.id === pricingOptionId)?.pricingType ?? course?.pricingType)
        : (course?.pricingType ?? (course?.isFree ? "free" : "one_time"));
      if (resolvedPricingType === "free") await enrollFree.mutateAsync({ courseSlug: slug! });
      else await createCheckout.mutateAsync({ courseSlug: slug!, seats: 1, origin: window.location.origin, orderBumpId: selectedOrderBumpId, pricingOptionId, promoCode: promoCode ?? undefined, affiliateCode: getStoredAffiliateCode() ?? undefined });
    } finally { setEnrolling(false); }
  };

  // Auto-trigger checkout when ?checkout=1 is in the URL (used by BSLinkField product links)
  // MUST be before early returns to comply with React Rules of Hooks
  useEffect(() => {
    if (autoCheckout && course && !isLoading) {
      // Pass the URL pricing option ID directly to bypass React state closure timing issues
      handleEnrollWithOption(_urlPricingOptionId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckout, course?.id, isLoading]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20 text-gray-500">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">Course not found</p>
        <Button variant="link" onClick={() => navigate("/education-library")}>Back to Library</Button>
      </div>
    );
  }

  const lp = course.landingPage;
  const price = formatPrice(course);
  const pricingType = course.pricingType ?? (course.isFree ? "free" : "one_time");
  const isEnrollmentClosed = !enrollment && course.enrollmentCloseDate && new Date(course.enrollmentCloseDate) < new Date();
  const ctaText = enrollment ? "Continue Learning" : isEnrollmentClosed ? "Enrollment Closed" : (lp?.ctaText ?? "Enroll Now");

  // Enrollment countdown: days remaining until close (only for cohorts, not yet closed, not enrolled)
  const enrollmentCountdownDays = (() => {
    if (enrollment || isEnrollmentClosed || !course.enrollmentCloseDate) return null;
    const diff = new Date(course.enrollmentCloseDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 30 ? days : null; // show banner up to 30 days out
  })();

  const EnrollmentCountdownBanner = enrollmentCountdownDays !== null ? (
    <div className="w-full bg-amber-50 border-b border-amber-200 py-2.5 px-4 sticky top-0 z-50 shadow-sm">
      <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 text-sm font-medium text-amber-800">
        <span className="text-amber-500">⏳</span>
        {enrollmentCountdownDays === 1
          ? "Enrollment closes tomorrow — last chance to join this cohort!"
          : `Enrollment closes in ${enrollmentCountdownDays} day${enrollmentCountdownDays === 1 ? "" : "s"} — secure your spot now.`}
      </div>
    </div>
  ) : null;
  const totalLessons = (course.sections ?? []).reduce((sum: number, s: any) => sum + (s.lessons?.length ?? 0), 0)
    + ((course as any).topLevelLessons?.length ?? 0);
  const totalDuration = (course.sections ?? []).reduce((sum: number, s: any) =>
    sum + (s.lessons ?? []).reduce((ls: number, l: any) => ls + (l.durationMinutes ?? 0), 0), 0);

  // Compute first preview lesson for free_preview CTA buttons
  const firstPreviewLesson = (() => {
    const allLessons = (course.sections ?? []).flatMap((s: any) => s.lessons ?? []);
    return allLessons.find((l: any) => l.isPreview || l.previewMode === "preview") ?? allLessons[0] ?? null;
  })();
  const handleFreePreviewCta = firstPreviewLesson
    ? () => handleFreePreviewClick(firstPreviewLesson.id)
    : handleEnroll;

  // Parse blocks from landing page
  let blocks: Block[] = [];
  if (lp?.blocks) {
    try { blocks = typeof lp.blocks === "string" ? JSON.parse(lp.blocks) : lp.blocks; } catch { blocks = []; }
  }

  // ── Blocks-based rendering ──
  if (blocks.length > 0) {
    return (
      <div className="min-h-screen bg-white">
        {EnrollmentCountdownBanner}
        {blocks.map(block => {
          // Full-bleed block types must never be wrapped in a contentWidth constraint at the outer level.
          const FULL_BLEED_TYPES_CL = ["hero", "pricing_cta", "cta_standalone", "divider", "spacer", "footer", "logo_strip", "urgency_offer", "product_offer_stack", "price_stack", "image_content"];
          const isFullBleedCL = FULL_BLEED_TYPES_CL.includes(block.type);
          const bwCL = block.data?.contentWidth;
          const bwMapCL: Record<string, string> = { xl: "1280px", lg: "1024px", md: "768px", sm: "640px" };
          const bwMaxCL = !isFullBleedCL && bwCL && bwCL !== "full" ? bwMapCL[bwCL] : null;
          return (
            <div key={block.id} style={{ marginTop: block.data?.marginTop || undefined, marginBottom: block.data?.marginBottom || undefined, paddingTop: block.data?.paddingTop || undefined, paddingBottom: block.data?.paddingBottom || undefined, paddingLeft: block.data?.paddingLeft || undefined, paddingRight: block.data?.paddingRight || undefined }}>
              {bwMaxCL ? (
                <div style={{ maxWidth: bwMaxCL, marginLeft: "auto", marginRight: "auto", width: "100%" }}>
                  <RenderBlock block={block} course={course} onEnroll={handleEnroll} onEnrollWithOption={handleEnrollWithOption} enrolling={enrolling || enrollFree.isPending || createCheckout.isPending} ctaText={ctaText} price={price} selectedPricingOptionId={selectedPricingOptionId} onSelectPricingOption={setSelectedPricingOptionId} slug={slug} enrollment={enrollment} user={user} onFreePreviewClick={handleFreePreviewClick} />
                </div>
              ) : (
                <RenderBlock block={block} course={course} onEnroll={handleEnroll} onEnrollWithOption={handleEnrollWithOption} enrolling={enrolling || enrollFree.isPending || createCheckout.isPending} ctaText={ctaText} price={price} selectedPricingOptionId={selectedPricingOptionId} onSelectPricingOption={setSelectedPricingOptionId} slug={slug} enrollment={enrollment} user={user} onFreePreviewClick={handleFreePreviewClick} />
              )}
            </div>
          );
        })}
        {/* Before-checkout order bump */}
        {!enrollment && course && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            <OrderBumpOffer
              triggerType="course"
              triggerProductId={course.id}
              timing="before_checkout"
              onAccept={(bump) => setSelectedOrderBumpId(bump.bumpId)}
              onDecline={() => setSelectedOrderBumpId(undefined)}
            />
            {selectedOrderBumpId && (
              <div className="mt-3 text-center">
                <Button onClick={handleEnroll} disabled={enrolling || createCheckout.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
                  Continue to checkout with selected bump
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Auto-generated fallback layout ──
  const heroColor = lp?.heroImageUrl ? undefined : "#179ca3";
  const heroBg = lp?.heroImageUrl
    ? { backgroundImage: `url(${lp.heroImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: heroColor };

  // Set page title
  useEffect(() => {
    if (course?.title) document.title = `${course.title} | Education Library | All About Ultrasound™`;
    return () => { document.title = "UltrasoundAssist™ | All About Ultrasound™"; };
  }, [course?.title]);

  return (
    <>
    {EnrollmentCountdownBanner}
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1.5 text-sm text-gray-500">
          <Link href="/education-library" className="hover:text-teal-600 transition-colors">Education Library</Link>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-gray-800 truncate max-w-xs">{course.title}</span>
        </div>
      </div>
      {/* Hero */}
      <div style={heroBg} className="text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-teal-600 text-white border-0 flex items-center gap-1">
                {TYPE_ICONS[course.type]} {course.type === "download" ? "Digital Download" : course.type.charAt(0).toUpperCase() + course.type.slice(1)}
              </Badge>
              <Badge variant="outline" className="border-teal-400 text-teal-200">
                {course.brand === "aaus" ? "All About Ultrasound™" : "iHeartEcho™"}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{lp?.heroTitle ?? course.title}</h1>
            {(lp?.heroSubtitle ?? course.subtitle) && (
              <p className="text-teal-100 text-lg">{lp?.heroSubtitle ?? course.subtitle}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-teal-200 pt-2">
              {totalLessons > 0 && <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{totalLessons} lesson{totalLessons !== 1 ? "s" : ""}</span>}
              {totalDuration > 0 && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{totalDuration} min</span>}
              {course.hasCertificate && <span className="flex items-center gap-1"><Star className="w-4 h-4" />Certificate included</span>}
            </div>
            {course.instructors?.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {course.instructors.map((ins: any) => ins && (
                  <div key={ins.id} className="flex items-center gap-2">
                    {ins.avatarUrl ? <img src={ins.avatarUrl} alt={ins.name} className="w-8 h-8 rounded-full object-cover border-2 border-teal-400" /> : <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-sm font-bold">{ins.name[0]}</div>}
                    <div><p className="text-sm font-medium">{ins.name}</p>{ins.title && <p className="text-xs text-teal-300">{ins.title}</p>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Enrollment card */}
          <div className="bg-white rounded-xl shadow-xl p-6 text-gray-900 space-y-4">
            {course.coverImageUrl && <img src={course.coverImageUrl} alt={course.title} className="w-full h-36 object-cover rounded-lg" />}
            {/* Secondary pricing options selector */}
            {(course.pricingOptions ?? []).filter((o: any) => o.isActive).length > 0 && !enrollment && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Choose your plan</p>
                {/* Primary option */}
                <button
                  onClick={() => setSelectedPricingOptionId(undefined)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-colors ${
                    selectedPricingOptionId === undefined
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-teal-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">Full Access</span>
                    <span className="text-sm font-bold text-teal-700">{price}</span>
                  </div>
                </button>
                {/* Secondary options */}
                {(course.pricingOptions ?? []).filter((o: any) => o.isActive).map((opt: any) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedPricingOptionId(opt.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-colors ${
                      selectedPricingOptionId === opt.id
                        ? "border-teal-500 bg-teal-50"
                        : "border-gray-200 hover:border-teal-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">{opt.label}</span>
                      <span className="text-sm font-bold text-teal-700">{formatPricingOption(opt)}</span>
                    </div>
                    {opt.sublabel && <p className="text-xs text-gray-500 mt-0.5">{opt.sublabel}</p>}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1">
              <div className="text-3xl font-bold text-teal-700">{price}</div>
              {pricingType === "trial_then_subscription" && (
                <p className="text-xs text-gray-500">{course.trialDays ?? 7}-day free trial, then billed {course.subscriptionInterval ?? "monthly"}</p>
              )}
              {pricingType === "subscription" && <p className="text-xs text-gray-500">Billed {course.subscriptionInterval ?? "monthly"} — cancel anytime</p>}
              {pricingType === "payment_plan" && course.downPayment && (
                <p className="text-xs text-gray-500">${Number(course.downPayment).toFixed(0)} due today{course.installmentCount && course.installmentAmount ? `, then ${course.installmentCount}×$${Number(course.installmentAmount).toFixed(0)} every ${course.installmentIntervalDays ?? 30} days` : ""}</p>
              )}
              {pricingType === "free" && <p className="text-xs text-gray-500">No payment required</p>}
            </div>
            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold" size="lg" onClick={handleEnroll} disabled={enrolling || enrollFree.isPending || createCheckout.isPending}>
              {enrolling ? "Processing..." : ctaText}<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            {enrollment && (
              <Button variant="outline" className="w-full border-teal-300 text-teal-700 hover:bg-teal-50" size="sm" onClick={() => navigate(`/courses/${slug}/overview`)}>
                <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Course Overview
              </Button>
            )}
            {!user && (
              <p className="text-xs text-gray-500 text-center">
                <button className="text-teal-600 underline" onClick={() => navigate("/login")}>Sign in</button> or{" "}
                <button className="text-teal-600 underline" onClick={() => navigate("/register")}>create an account</button> to enroll
              </p>
            )}
            {course.hasCertificate && <div className="flex items-center gap-2 text-sm text-gray-600 border-t pt-3"><Star className="w-4 h-4 text-yellow-500" />Certificate of completion included</div>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {lp?.whatYouLearn && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">What You'll Learn</h2>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lp.whatYouLearn }} />
            </section>
          )}
          {(lp?.bodyContent ?? course.description) && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">About This Course</h2>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lp?.bodyContent ?? course.description ?? "" }} />
            </section>
          )}
          {course.sections?.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Curriculum</h2>
              <Accordion type="multiple" defaultValue={["section-0"]}>
                {course.sections.map((section: any, si: number) => (
                  <AccordionItem key={section.id} value={`section-${si}`}>
                    <AccordionTrigger className="text-sm font-medium text-gray-800 hover:no-underline">
                      <span>{section.title}</span>
                      <span className="text-xs text-gray-400 ml-auto mr-2">{section.lessons.length} lesson{section.lessons.length !== 1 ? "s" : ""}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1 pt-1">
                        {section.lessons.filter((lesson: any) => {
                          if (!enrollment) return true;
                          const pm = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
                          return pm !== "preview_hide_after_purchase";
                        }).map((lesson: any) => (
                          <li key={lesson.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                            {lesson.isPreview ? <PlayCircle className="w-4 h-4 text-teal-500 flex-shrink-0" /> : <Lock className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                            <span className={lesson.isPreview ? "text-teal-700 font-medium" : "text-gray-700"}>{lesson.title}</span>
                            {lesson.isPreview && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300 ml-auto">Preview</Badge>}
                            {lesson.durationMinutes && <span className="text-xs text-gray-400 ml-auto">{lesson.durationMinutes} min</span>}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}
          {lp?.requirements && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h2>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lp.requirements }} />
            </section>
          )}
          {course.instructors?.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Instructor{course.instructors.length > 1 ? "s" : ""}</h2>
              <div className="space-y-6">
                {course.instructors.map((ins: any) => ins && (
                  <div key={ins.id} className="flex gap-4">
                    {ins.avatarUrl ? <img src={ins.avatarUrl} alt={ins.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" /> : <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-700 flex-shrink-0">{ins.name[0]}</div>}
                    <div>
                      <p className="font-semibold text-gray-900">{ins.name}</p>
                      {ins.title && <p className="text-sm text-teal-600">{ins.title}</p>}
                      {ins.bio && <div className="text-sm text-gray-600 mt-1 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: ins.bio }} />}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        {/* Sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-6 bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            {/* Secondary pricing options in sidebar */}
            {(course.pricingOptions ?? []).filter((o: any) => o.isActive).length > 0 && !enrollment ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Choose your plan</p>
                <button
                  onClick={() => setSelectedPricingOptionId(undefined)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-colors ${
                    selectedPricingOptionId === undefined ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-teal-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">Full Access</span>
                    <span className="text-sm font-bold text-teal-700">{price}</span>
                  </div>
                </button>
                {(course.pricingOptions ?? []).filter((o: any) => o.isActive).map((opt: any) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedPricingOptionId(opt.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-colors ${
                      selectedPricingOptionId === opt.id ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-teal-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">{opt.label}</span>
                      <span className="text-sm font-bold text-teal-700">{formatPricingOption(opt)}</span>
                    </div>
                    {opt.sublabel && <p className="text-xs text-gray-500 mt-0.5">{opt.sublabel}</p>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-2xl font-bold text-teal-700">{price}</div>
            )}
            {pricingType === "trial_then_subscription" && (
              <p className="text-xs text-gray-500">{course.trialDays ?? 7}-day free trial, then billed {course.subscriptionInterval ?? "monthly"}</p>
            )}
            {!enrollment && pricingType !== "free" && (
              <PromoCodeInput
                onApply={(code, _discount) => setPromoCode(code)}
              />
            )}
            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold" size="lg" onClick={handleEnroll} disabled={enrolling || enrollFree.isPending || createCheckout.isPending}>
              {enrolling ? "Processing..." : (selectedPricingOptionId ? (course.pricingOptions?.find((o: any) => o.id === selectedPricingOptionId)?.ctaLabel ?? ctaText) : ctaText)}
            </Button>
            <ul className="space-y-2 text-sm text-gray-600">
              {totalLessons > 0 && <li className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-500" />{totalLessons} lessons</li>}
              {totalDuration > 0 && <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-teal-500" />{totalDuration} minutes of content</li>}
              {course.hasCertificate && <li className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" />Certificate of completion</li>}
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-500" />{accessLabel(course)}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    {/* Guest Checkout Modal — shown to unauthenticated users who click a CTA — build:v3 */}
    <Dialog open={guestModalOpen} onOpenChange={setGuestModalOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-teal-700">Almost there!</DialogTitle>
          <DialogDescription>
            Enter your name and email to continue to checkout. We'll create your account automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGuestCheckoutSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="gc-name">Full Name <span className="text-red-500">*</span></Label>
            <Input
              id="gc-name"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Jane Smith"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gc-email">Email Address <span className="text-red-500">*</span></Label>
            <Input
              id="gc-email"
              type="email"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              placeholder="jane@example.com"
              required
            />
          </div>
          <p className="text-xs text-gray-500">
            Your account will be created automatically. You'll receive a login link by email after purchase.
          </p>
          <Button
            type="submit"
            className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            disabled={guestSubmitting}
          >
            {guestSubmitting ? "Setting up…" : "Continue to Checkout"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>

    {/* Free Preview Registration Modal */}
    <Dialog open={freePreviewOpen} onOpenChange={setFreePreviewOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-teal-700">Access Free Preview</DialogTitle>
          <DialogDescription>
            Enter your details to unlock free access to this preview lesson. No payment required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleFreePreviewSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fp-first">First Name <span className="text-red-500">*</span></Label>
              <Input id="fp-first" value={fpFirstName} onChange={e => setFpFirstName(e.target.value)} placeholder="Jane" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fp-last">Last Name</Label>
              <Input id="fp-last" value={fpLastName} onChange={e => setFpLastName(e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fp-email">Email Address <span className="text-red-500">*</span></Label>
            <Input id="fp-email" type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="jane@example.com" required />
          </div>
          <p className="text-xs text-gray-500">Your preview access link will be valid for 7 days. We may send you a follow-up email about this course.</p>
          <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white" disabled={fpSubmitting}>
            {fpSubmitting ? "Granting Access..." : "Watch Free Preview"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
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
