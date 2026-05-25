/**
 * BlockPreview.tsx
 * Shared read-only block renderer used by CoursePlayer, CourseOverview, and LandingPageBuilder.
 * Extracted into its own file to break the circular dependency between CoursePlayer and LandingPageBuilder.
 */
import { useState, useEffect } from "react";
import { ChevronDown, Globe, Image, Package, Upload, Video } from "lucide-react";
import CarouselBlock from "@/components/CarouselBlock";
import InlineCheckoutBlock from "@/components/InlineCheckoutBlock";
import AudioBlockPlayer from "@/components/AudioBlockPlayer";
import { Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";
import { ButtonSubtext } from "@/lib/ctaSubtext";

/**
 * Wraps an image element with the correct click action based on the CTAActionPicker behavior.
 * Handles: url, send_email, scroll_to_section, open_popup, download_file.
 * For checkout/funnel behaviors the image is not wrapped (no-op).
 */
export function ImageLinkWrapper({ d, children }: { d: Record<string, any>; children: React.ReactNode }) {
  const behavior: string = d.linkBehavior ?? (d.linkUrl ? "url" : "");
  const newTab = d.openInNewTab !== false;
  const style: React.CSSProperties = { display: "inline-block", cursor: "pointer" };

  if (!behavior) return <>{children}</>;

  if (behavior === "url" && d.linkUrl) {
    return <a href={d.linkUrl} target={newTab ? "_blank" : undefined} rel="noopener noreferrer" style={style}>{children}</a>;
  }
  if (behavior === "send_email" && d.linkEmailAddress) {
    return <a href={`mailto:${d.linkEmailAddress}`} style={style}>{children}</a>;
  }
  if (behavior === "download_file" && d.linkDownloadUrl) {
    return <a href={d.linkDownloadUrl} download target="_blank" rel="noopener noreferrer" style={style}>{children}</a>;
  }
  if (behavior === "scroll_to_section" && d.linkScrollAnchor) {
    const anchor = d.linkScrollAnchor.replace(/^#/, "");
    return (
      <span style={style} onClick={() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }}>{children}</span>
    );
  }
  if (behavior === "open_popup" && d.linkPopupUrl) {
    // Open in a centered popup window
    return (
      <span style={style} onClick={() => {
        const w = 800, h = 600;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(d.linkPopupUrl, "_blank", `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
      }}>{children}</span>
    );
  }
  return <>{children}</>;
}

export type BlockType =
  | "hero" | "text" | "image" | "video" | "audio" | "bullets" | "testimonial"
  | "pricing_cta" | "divider" | "two_column" | "divided_columns" | "spacer"
  | "faq" | "image_text" | "gallery" | "icon_grid" | "countdown"
  | "instructor" | "logos" | "reviews" | "embed" | "cta_standalone"
  | "lead_capture" | "cta_optin" | "numbered_list" | "checklist" | "alert" | "flip_cards"
  | "curriculum_auto" | "pricing_options_auto"
  | "funnel_workflow" | "product_offer_stack" | "order_bump_checkout"
  | "price_stack" | "urgency_offer" | "checkout_form"
  | "footer" | "logo_strip" | "three_column"
  | "related_products" | "embedded_checkout" | "inline_checkout"
  | "lesson_quiz" | "lesson_flashcard"
  | "file_download" | "scorm_embed" | "url_embed"
  | "column_layout" | "carousel" | "ticker" | "countdown_v2";

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, any>;
}

export function BlockPreview({ block, coursePrice, courseTitle }: { block: Block; coursePrice?: number; courseTitle?: string }) {
  const d = block.data ?? {};
  const bwBP = d.contentWidth;
  const bwMapBP: Record<string, string> = { xl: "1280px", lg: "1024px", md: "768px", sm: "640px" };
  const bwMaxBP = bwBP && bwBP !== "full" ? bwMapBP[bwBP] : null;

  const wrapWidth = (inner: React.ReactNode) =>
    bwMaxBP ? <div style={{ maxWidth: bwMaxBP, marginLeft: "auto", marginRight: "auto", width: "100%" }}>{inner}</div> : <>{inner}</>;

  switch (block.type) {
    case "hero": {
      const bgType = d.bgType ?? "color";
      let heroBg: React.CSSProperties = {};
      if (bgType === "color") heroBg = { backgroundColor: d.bgColor ?? "#179ca3" };
      else if (bgType === "gradient") heroBg = { background: `linear-gradient(${d.gradientDir ?? "to bottom right"}, ${d.gradientFrom ?? "#179ca3"}, ${d.gradientTo ?? "#0e4a50"})` };
      else if (bgType === "image") heroBg = { backgroundImage: `url(${d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
      else if (bgType === "video") heroBg = { backgroundColor: "#000" };
      const heroButtons: Array<{ text: string; color: string; textColor: string; link: string; style: string; animation?: string; showStrikethrough?: boolean; strikethroughPrice?: string; showOptOut?: boolean; optOutText?: string; optOutUrl?: string }> =
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Enroll Now", color: d.ctaColor ?? "#fff", textColor: d.ctaTextColor ?? "#179ca3", link: "", style: "filled" }];
      const hasInlineMedia = !!d.inlineMediaUrl;
      const placement = d.inlineMediaPlacement ?? "right";
      const isHorizontal = placement === "left" || placement === "right";
      const heroClickHandler = d.heroClickable && d.heroBehavior && d.heroBehavior !== "next_funnel_step"
        ? (() => {
            const beh = d.heroBehavior as string;
            if (beh === "url" && d.heroLink) window.open(d.heroLink, "_blank");
            else if (beh === "send_email" && d.heroEmail) window.location.href = `mailto:${d.heroEmail}`;
            else if (beh === "scroll_to_section" && d.heroScrollAnchor) {
              const el = document.getElementById(d.heroScrollAnchor.replace(/^#/, ""));
              el?.scrollIntoView({ behavior: "smooth" });
            } else if (beh === "download_file" && d.heroDownloadUrl) window.open(d.heroDownloadUrl, "_blank");
            else if (beh === "open_popup" && d.heroPopupUrl) window.open(d.heroPopupUrl, "_blank");
          })
        : undefined;
      const heroBottomBorderStyle: React.CSSProperties = d.heroBottomBorder
        ? { borderBottom: `${d.heroBottomBorderWidth ?? 4}px solid ${d.heroBottomBorderColor ?? "#179ca3"}` }
        : {};
      const heroMinHeight = d.heroMinHeight ?? 400;
      return (
        <div
          className="relative px-8 py-16 overflow-hidden"
          style={{ ...heroBg, ...heroBottomBorderStyle, color: d.textColor ?? "#fff", textAlign: hasInlineMedia && isHorizontal ? "left" as const : (d.align ?? "left"), cursor: heroClickHandler ? "pointer" : undefined, minHeight: `${heroMinHeight}px` }}
          onClick={heroClickHandler}
        >
          {bgType === "video" && d.videoUrl && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.videoUrl} /></video>
          )}
          <div className={`relative max-w-5xl mx-auto ${hasInlineMedia && isHorizontal ? "flex items-center gap-8" : ""} ${hasInlineMedia && placement === "left" ? "flex-row-reverse" : ""}`}>
            <div className={hasInlineMedia && isHorizontal ? "flex-1" : "max-w-3xl"}>
              <h1 className="text-4xl font-bold mb-4 leading-tight">
                <span style={d.headlineColor ? { color: d.headlineColor } : undefined} dangerouslySetInnerHTML={{ __html: d.headline ?? '' }} />
                {d.headline2 && <><br /><span style={d.headline2Color ? { color: d.headline2Color } : undefined} dangerouslySetInnerHTML={{ __html: d.headline2 }} /></>}
              </h1>
              {d.subheadline && <p className="text-xl opacity-90 mb-8" dangerouslySetInnerHTML={{ __html: d.subheadline }} />}
              {!d.hideButtons && <div className="flex flex-wrap gap-3" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
                {heroButtons.map((btn, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <button className={`px-8 py-3 rounded-lg font-semibold text-lg shadow-lg ${btn.animation && btn.animation !== "none" ? `animate-${btn.animation}-btn` : ""}`}
                      style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                      {btn.text}
                    </button>
                    {(btn as any).behavior === "direct_checkout" && <span className="text-[10px] bg-teal-700/80 text-white rounded px-1.5 py-0.5">→ Stripe Checkout</span>}
                    {btn.showStrikethrough && btn.strikethroughPrice && (
                      <span className="text-xs text-white/60 line-through">{btn.strikethroughPrice}</span>
                    )}
                  {btn.showOptOut && btn.optOutText && (
                      <span className="text-xs text-white/60 underline cursor-pointer hover:text-white/80">{btn.optOutText}</span>
                    )}
                  </div>
                ))}
              </div>}
            </div>
            {hasInlineMedia && (
              <div className={isHorizontal ? "flex-1 max-w-xs" : "mt-8 max-w-sm mx-auto"}>
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
      const imgAlign = d.align ?? "center";
      const imgJustify = imgAlign === "left" ? "flex-start" : imgAlign === "right" ? "flex-end" : "center";
      const mw = d.maxWidth ?? "auto";
      const imgStyle: React.CSSProperties = { maxWidth: mw === "auto" ? "100%" : mw, width: mw === "auto" ? undefined : "100%", height: d.height || "auto", objectFit: "cover", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.noBorder ? "none" : (d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined) };
      const imgEl = d.url
        ? <img src={d.url} alt={d.alt ?? ""} className={d.showShadow !== false ? "shadow" : ""} style={imgStyle} />
        : <div className="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><Image size={32} /></div>;
      return (
        <div className="px-8 py-6" style={{ display: "flex", flexDirection: "column", alignItems: imgJustify }}>
          <ImageLinkWrapper d={d}>{imgEl}</ImageLinkWrapper>
          {d.caption && <p className="text-sm text-gray-500 mt-2" style={{ textAlign: imgAlign as any }}>{d.caption}</p>}
        </div>
      );
    }
    case "video": {
      const isDirectVideo = d.embedUrl && /\.(mp4|webm|ogg|mov)([?#]|$)/i.test(d.embedUrl);
      const containerStyle: React.CSSProperties = { maxWidth: d.maxWidth ?? "100%", height: d.height || undefined, paddingBottom: d.height ? undefined : (isDirectVideo ? undefined : "56.25%"), borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined };
      return (
        <div className="px-8 py-6">
          {d.embedUrl ? (
            isDirectVideo ? (
              <div className="mx-auto overflow-hidden shadow" style={containerStyle}>
                <video
                  src={d.trimStart && d.trimStart > 0 ? `${d.embedUrl}#t=${d.trimStart ?? 0}${d.trimEnd ? `,${d.trimEnd}` : ""}` : d.embedUrl}
                  autoPlay={d.autoplay ?? false}
                  muted={d.muted ?? true}
                  loop={d.loop ?? false}
                  controls={d.controls ?? true}
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ height: d.height || undefined }}
                />
              </div>
            ) : (
              <div className="relative w-full overflow-hidden shadow mx-auto" style={containerStyle}>
                <iframe
                  src={d.autoplay ? `${d.embedUrl}${d.embedUrl.includes('?') ? '&' : '?'}autoplay=1${d.muted !== false ? '&mute=1' : ''}${d.loop ? '&loop=1' : ''}` : d.embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  title="Video"
                  allow="autoplay; fullscreen"
                />
              </div>
            )
          ) : <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><Video size={32} /></div>}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
    }
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
        <div className="px-8 py-6">
          {d.embedCode ? (
            <div dangerouslySetInnerHTML={{ __html: d.embedCode }} style={{ height: d.height ?? 400 }} />
          ) : <div className="w-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-400" style={{ height: d.height ?? 400 }}><Globe size={32} /></div>}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
    case "gallery":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
            {(d.images ?? []).map((img: any, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden shadow">
                {img.url ? <img src={img.url} alt={img.caption ?? ""} className="w-full h-40 object-cover" /> : <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400"><Image size={24} /></div>}
                {img.caption && <p className="text-xs text-gray-500 p-2 text-center">{img.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    case "bullets":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
            {(d.items ?? []).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 text-lg" style={{ color: d.iconColor ?? "#179ca3" }}>✓</span>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "numbered_list":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-2 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subHeading && <p className="text-gray-500 mb-6 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: d.subHeading }} />}
          {!d.subHeading && d.headline && <div className="mb-6" />}
          <div className="space-y-4 max-w-2xl">
            {(d.items ?? []).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{i + 1}</span>
                <span className="text-gray-700 pt-1">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "checklist":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-2 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subHeading && <p className="text-gray-500 mb-6 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: d.subHeading }} />}
          {!d.subHeading && d.headline && <div className="mb-6" />}
          <div className="space-y-3 max-w-2xl">
            {(d.items ?? []).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>✓</span>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
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
                {Array.from({ length: d.rating }).map((_, i) => <span key={i} className="text-yellow-400 text-xl">★</span>)}
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
              <div key={i} className="rounded-xl p-5 shadow-sm" style={{ backgroundColor: d.cardBgColor ?? "#f9fafb" }}>
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: r.rating ?? 5 }).map((_, j) => <span key={j} className="text-yellow-400">★</span>)}
                </div>
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
      return <InstructorBlockPreview d={d} />;
    case "faq":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="max-w-3xl space-y-3">
            {(d.items ?? []).map((item: any, i: number) => (
              <details key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                <summary className="px-5 py-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                  {item.q}
                </summary>
                <div className="px-5 py-4 text-gray-600 border-t border-gray-100">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      );
    case "countdown": {
      const mode = d.mode ?? "on_load";
      const units = mode === "event" ? ["Days", "Hours", "Minutes", "Seconds"] : ["Hours", "Minutes", "Seconds"];
      const placeholders = mode === "event" ? ["00", "00", "00", "00"] : [String(Math.floor((d.durationMinutes ?? 90) / 60)).padStart(2, "0"), String((d.durationMinutes ?? 90) % 60).padStart(2, "0"), "00"];
      return (
        <div className={`px-8 py-10 text-center ${d.showBorder ? "border-2 rounded-2xl mx-4 my-4" : ""}`} style={{ backgroundColor: d.bgColor ?? "#ffffff", color: d.textColor ?? "#0e1e2e", borderColor: d.showBorder ? (d.accentColor ?? "#179ca3") : undefined }}>
          {d.headline && <h2 className="text-lg font-bold uppercase tracking-wide mb-4" style={{ color: d.accentColor ?? "#179ca3" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="flex justify-center items-center gap-2">
            {units.map((unit, i) => (
              <div key={unit} className="flex items-center gap-2">
                <div className="text-center">
                  <div className="text-5xl font-black tracking-tight">{placeholders[i]}</div>
                  <div className="text-xs font-medium mt-1 opacity-70">{unit}</div>
                </div>
                {i < units.length - 1 && <span className="text-4xl font-bold opacity-50 -mt-4">:</span>}
              </div>
            ))}
          </div>
          {mode === "on_load" && <p className="text-xs text-gray-400 mt-3">Timer starts when visitor loads page ({d.durationMinutes ?? 90} min)</p>}
        </div>
      );
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
              <div key={i} className="rounded-xl overflow-hidden shadow-sm border border-gray-200 group cursor-pointer">
                <div className="p-5 font-semibold text-white text-center" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{card.front}</div>
                <div className="p-5 text-sm text-gray-600 text-center bg-white">{card.back}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case "pricing_cta": {
      const priceAbove = (d.pricePosition ?? "above") === "above";
      const priceBlock = d.showPrice && d.currentPrice && d.priceSource !== "none" ? (
        <div className="mb-4">
          {d.showStrikethroughPrice && d.strikethroughPrice && (
            <p className="text-xl text-gray-400 line-through mb-1">{d.strikethroughPrice}</p>
          )}
          <p className="text-4xl font-bold" style={{ color: d.ctaColor ?? "#179ca3" }}>
            {d.currentPrice}
            {d.priceInterval && <span className="text-xl font-normal text-gray-500 ml-1">{d.priceInterval}</span>}
          </p>
        </div>
      ) : null;
      const ctaBtn = (
        <a
          href={d.ctaUrl ?? "#"}
          target={d.ctaUrl && d.ctaUrl.startsWith("http") ? "_blank" : undefined}
          rel={d.ctaUrl && d.ctaUrl.startsWith("http") ? "noopener noreferrer" : undefined}
          className={`inline-block px-10 py-4 rounded-xl font-bold text-lg shadow-lg ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`}
          style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}
        >
          {d.ctaText ?? "Get Started"}
        </a>
      );
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-3xl font-bold text-gray-900 mb-3" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-gray-600 mb-6 max-w-xl mx-auto" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          {priceAbove && priceBlock}
          {ctaBtn}
          {d.ctaBehavior === "direct_checkout" && <p className="text-[10px] text-teal-600 mt-1">→ Stripe Checkout</p>}
          {!priceAbove && priceBlock}
          <ButtonSubtext d={d} />
        </div>
      );
    }
    case "cta_standalone":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa", textAlign: d.align ?? "center" }}>
          {d.headline && <h2 className="text-2xl font-bold text-gray-900 mb-3" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          {(d.showStrikethrough && d.strikethroughPrice) && (
            <p className="text-lg text-gray-400 line-through mb-1">{d.strikethroughPrice}</p>
          )}
          {d.displayPrice && <p className="text-3xl font-bold mb-4" style={{ color: d.ctaColor ?? "#179ca3" }}>{d.displayPrice}</p>}
          <a href={d.ctaLink ?? "#"} className={`inline-block px-8 py-3 rounded-lg font-semibold shadow ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`} style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>{d.ctaText ?? "Get Started"}</a>
          {d.ctaBehavior === "direct_checkout" && <p className="text-[10px] text-teal-600 mt-1">→ Stripe Checkout</p>}
          <ButtonSubtext d={d} />
          {(d.showOptOut || d.optOutEnabled) && d.optOutText && (
            <div className="mt-3"><a href={d.optOutUrl || d.optOutCustomUrl || "#"} className="text-xs text-gray-400 underline hover:text-gray-600">{d.optOutText}</a></div>
          )}
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
    case "cta_optin":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa", textAlign: d.align ?? "center" }}>
          {d.headline && <h2 className="text-2xl font-bold text-gray-900 mb-3" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          {(d.showStrikethrough && d.strikethroughPrice) && (
            <p className="text-lg text-gray-400 line-through mb-1">{d.strikethroughPrice}</p>
          )}
          {d.displayPrice && <p className="text-3xl font-bold mb-4" style={{ color: d.ctaColor ?? "#179ca3" }}>{d.displayPrice}</p>}
          <div className="max-w-sm mx-auto space-y-3 mb-4">
            <input type="text" placeholder={d.namePlaceholder ?? "Your name"} className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 text-sm" />
            <input type="email" placeholder={d.emailPlaceholder ?? "Your email address"} className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 text-sm" />
          </div>
          <a href="#" className={`inline-block px-8 py-3 rounded-lg font-semibold shadow ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`} style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>{d.ctaText ?? "Get Access"}</a>
          <ButtonSubtext d={d} />
        </div>
      );
    case "funnel_workflow":
      return <FunnelWorkflowBlock data={d} />;
    case "product_offer_stack":
      return <ProductOfferStackBlock data={d} />;
    case "order_bump_checkout":
      return <InlineOrderBumpBlock data={d} />;
    case "price_stack": {
      const items: Array<{ text: string; price: string }> = d.items ?? [];
      return (
        <div className={`px-8 py-10 text-center ${d.showBorder ? "border-2 rounded-2xl mx-4 my-4" : ""}`} style={{ backgroundColor: d.bgColor ?? "#ffffff", color: d.textColor ?? "#0e1e2e", borderColor: d.showBorder ? (d.borderColor ?? "#1a5f7a") : undefined }}>
          {d.imageUrl && <img src={d.imageUrl} alt="" className="w-full max-w-lg mx-auto rounded-lg mb-6 object-cover" />}
          {d.headline && <h2 className="text-2xl md:text-3xl font-black uppercase mb-6 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {items.length > 0 && (
            <div className="space-y-2 mb-8 max-w-md mx-auto text-left">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-teal-600">▶</span>
                  <span className="font-medium">{item.text}</span>
                  <span className="text-gray-500 ml-auto">{item.price}</span>
                </div>
              ))}
            </div>
          )}
          {d.totalValueText && <p className="text-2xl md:text-3xl font-black italic mb-1">{d.totalValueText}</p>}
          {d.originalPrice && <p className="text-xl font-bold uppercase line-through opacity-60 mb-1">{d.originalPrice}</p>}
          {(d.finalPriceLabel || d.finalPrice) && (
            <p className="text-3xl md:text-4xl font-black mb-6">
              {d.finalPriceLabel && <span>{d.finalPriceLabel} </span>}
              {d.finalPrice && <span className="underline decoration-4 underline-offset-4">{d.finalPrice}</span>}
            </p>
          )}
          {d.ctaText && <button className="px-10 py-4 rounded-xl font-bold text-lg shadow-lg" style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>{d.ctaText}</button>}
        </div>
      );
    }
    case "urgency_offer": {
      const cMode = d.countdownMode ?? "on_load";
      const cUnits = cMode === "event" ? ["Days", "Hours", "Minutes", "Seconds"] : ["Hours", "Minutes", "Seconds"];
      const cPlaceholders = cMode === "event" ? ["00", "00", "00", "00"] : [String(Math.floor((d.countdownMinutes ?? 90) / 60)).padStart(2, "0"), String((d.countdownMinutes ?? 90) % 60).padStart(2, "0"), "00"];
      return (
        <div className={`px-8 py-10 ${d.showBorder ? "border-2 rounded-2xl mx-4 my-4" : ""}`} style={{ backgroundColor: d.bgColor ?? "#ffffff", color: d.textColor ?? "#0e1e2e", borderColor: d.showBorder ? (d.accentColor ?? "#179ca3") : undefined }}>
          {/* Countdown section */}
          <div className="text-center mb-8">
            {d.countdownHeadline && <h3 className="text-lg font-bold uppercase tracking-wide mb-3" style={{ color: d.accentColor ?? "#179ca3" }}>{d.countdownHeadline}</h3>}
            <div className="flex justify-center items-center gap-2">
              {cUnits.map((unit, i) => (
                <div key={unit} className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="text-4xl font-black tracking-tight">{cPlaceholders[i]}</div>
                    <div className="text-xs font-medium mt-1 opacity-70">{unit}</div>
                  </div>
                  {i < cUnits.length - 1 && <span className="text-3xl font-bold opacity-50 -mt-4">:</span>}
                </div>
              ))}
            </div>
          </div>
          {/* Content section */}
          {d.headline && <h2 className="text-2xl md:text-3xl font-black text-center mb-4 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.description && <p className="italic mb-4" style={{ color: d.accentColor ?? "#179ca3" }}>{d.description}</p>}
          {d.bodyHtml && <div className="prose max-w-none mb-6" dangerouslySetInnerHTML={{ __html: d.bodyHtml }} />}
          {(d.showStrikethrough && d.strikethroughPrice) && (
            <p className="text-xl text-gray-400 line-through text-center mt-4">{d.strikethroughPrice}</p>
          )}
          {d.displayPrice && <p className="text-3xl font-bold text-center mt-1" style={{ color: d.accentColor ?? "#179ca3" }}>{d.displayPrice}</p>}
          {d.ctaText && (
            <p className="font-bold mt-4" style={{ color: d.accentColor ?? "#179ca3" }}>
              {d.ctaEmoji && <span className="mr-1">{d.ctaEmoji}</span>}
              {d.ctaText}
            </p>
          )}
        </div>
      );
    }
    case "checkout_form": {
      const cfProducts: Array<{ name: string; description: string; price: number; imageUrl: string; type: string }> = d.products ?? [];
      const cfBumps: Array<{ title: string; headline: string; description: string; price: number; imageUrl: string; ctaText: string }> = d.orderBumps ?? [];
      return (
        <div className="py-6 px-4" style={{ backgroundColor: d.bgColor ?? "#ffffff", color: d.textColor ?? "#0e1e2e" }}>
          {/* Header */}
          <div className="rounded-lg px-6 py-4 mb-6 text-center text-white font-bold text-lg flex flex-col items-center justify-center gap-1" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>
            <div className="flex items-center gap-2">
              <span>\uD83D\uDD12</span> {d.headerText ?? "Lock in your seat now!"}
            </div>
            {d.headerPrice && (
              <div className="flex items-center gap-2">
                {d.showHeaderStrikethrough && d.headerStrikethroughPrice && (
                  <span className="text-base font-normal line-through opacity-70">{d.headerStrikethroughPrice}</span>
                )}
                <span>{d.headerPrice}</span>
              </div>
            )}
          </div>
          {/* Contact Info */}
          {d.showContactInfo && (
            <fieldset className="border border-gray-300 rounded-lg p-4 mb-4">
              <legend className="text-xs font-bold tracking-wider text-gray-600 px-2">CONTACT INFORMATION</legend>
              <div className="grid grid-cols-2 gap-2 mb-2"><div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">First Name</div><div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">Last Name</div></div>
              <div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400 mb-2">Email</div>
              <div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">Phone Number</div>
            </fieldset>
          )}
          {/* Product Selection */}
          {d.showProductSelect && cfProducts.length > 0 && (
            <fieldset className="border border-gray-300 rounded-lg p-4 mb-4">
              <legend className="text-xs font-bold tracking-wider text-gray-600 px-2">SELECT PRODUCT</legend>
              {cfProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <span className="w-4 h-4 rounded-full border-2 border-teal-500 flex-shrink-0" style={{ backgroundColor: i === 0 ? d.accentColor ?? "#179ca3" : "transparent" }} />
                  {p.imageUrl && <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />}
                  <div className="flex-1"><div className="font-semibold text-sm">{p.name}</div><div className="text-xs text-gray-500">{p.description}</div></div>
                  <div className="text-right">
                    {(p as any).strikethroughPrice && <div className="text-xs text-gray-400 line-through">{(p as any).strikethroughPrice}</div>}
                    <span className="text-sm font-medium">${(p.price / 100).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </fieldset>
          )}
          {/* Billing Info */}
          {d.showBillingInfo && (
            <fieldset className="border border-gray-300 rounded-lg p-4 mb-4">
              <legend className="text-xs font-bold tracking-wider text-gray-600 px-2">BILLING INFORMATION</legend>
              <div className="space-y-2">
                <div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">Address</div>
                <div className="grid grid-cols-2 gap-2"><div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">Country</div><div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">State</div></div>
                <div className="grid grid-cols-2 gap-2"><div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">City</div><div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">Postal Code</div></div>
              </div>
            </fieldset>
          )}
          {/* Payment Info */}
          <fieldset className="border border-gray-300 rounded-lg p-4 mb-4">
            <legend className="text-xs font-bold tracking-wider text-gray-600 px-2">PAYMENT INFORMATION</legend>
            <div className="border border-gray-200 rounded px-3 py-2 text-sm text-gray-400 flex items-center gap-4"><span>\uD83D\uDCB3 Card number</span><span className="ml-auto">MM / YY</span><span>CVV</span></div>
          </fieldset>
          {/* Order Bumps */}
          {cfBumps.length > 0 && cfBumps.map((bump, i) => (
            <div key={i} className="border-2 rounded-lg p-4 mb-4 flex items-start gap-4" style={{ borderColor: d.accentColor ?? "#179ca3" }}>
              {bump.imageUrl && <img src={bump.imageUrl} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />}
              <div className="flex-1">
                <div className="text-sm font-bold">{bump.headline}</div>
                <div className="text-sm font-semibold">{bump.title}</div>
                <div className="text-xs text-gray-600 mt-1">{bump.description}</div>
              </div>
              <div className="text-right flex-shrink-0">
                {(bump as any).strikethroughPrice && <div className="text-xs text-gray-400 line-through">{(bump as any).strikethroughPrice}</div>}
                <div className="text-sm font-bold" style={{ color: d.accentColor ?? "#179ca3" }}>${(bump.price / 100).toFixed(2)}</div>
                <button className="mt-2 px-4 py-1 border-2 rounded font-semibold text-sm" style={{ borderColor: d.accentColor ?? "#179ca3", color: d.accentColor ?? "#179ca3" }}>{bump.ctaText || "+ Add"}</button>
              </div>
            </div>
          ))}
          {/* Submit */}
          <button className="w-full py-4 rounded-lg font-bold text-white text-lg mt-2" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{d.submitText ?? "Submit"}</button>
          {d.displayMode === "standalone" && <p className="text-xs text-center text-gray-400 mt-2">This form will render as a standalone page</p>}
        </div>
      );
    }
    case "curriculum_auto": {
      const cr = d.cornerRadius ?? 12;
      const hAlign = d.headlineAlign ?? "left";
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className={`text-2xl font-bold mb-6 ${hAlign === "center" ? "text-center" : hAlign === "right" ? "text-right" : "text-left"}`} style={{ color: d.headlineColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="overflow-hidden max-w-3xl" style={{ border: `1px solid ${d.sectionBorderColor ?? "#e5e7eb"}`, borderRadius: `${cr}px` }}>
            {["Section 1", "Section 2", "Section 3"].map((s, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${d.sectionBorderColor ?? "#e5e7eb"}` }} className="last:border-0">
                <div className="flex items-center justify-between px-5 py-4 font-semibold" style={{ backgroundColor: d.sectionBgColor ?? "#f9fafb", color: d.sectionTextColor ?? "#1f2937" }}>
                  <span>{s}</span>
                  <span className="text-xs mr-2" style={{ color: d.lessonCountColor ?? "#9ca3af" }}>5 lessons</span>
                  <ChevronDown size={16} style={{ color: d.lessonCountColor ?? "#9ca3af" }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Auto-populated from course curriculum</p>
        </div>
      );
    }
    case "pricing_options_auto":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="flex justify-center gap-6 max-w-3xl mx-auto">
            {["Basic", "Pro", "Enterprise"].map((plan, i) => (
              <div key={i} className={`flex-1 rounded-xl border-2 p-6 text-center ${i === 1 ? "border-teal-500 shadow-lg" : "border-gray-200"}`}>
                <h3 className="font-bold text-gray-900 mb-2">{plan}</h3>
                <p className="text-2xl font-bold text-teal-600 mb-4">$0</p>
                <button className="w-full py-2 rounded-lg font-semibold text-sm" style={{ backgroundColor: i === 1 ? "#179ca3" : "#f3f4f6", color: i === 1 ? "#fff" : "#374151" }}>Select</button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Auto-populated from course pricing options</p>
        </div>
      );
    case "divider":
      return (
        <div style={{ padding: `${d.spacing ?? 32}px 32px` }}>
          <hr style={{ borderTop: `${d.thickness ?? 1}px ${d.style ?? "solid"} ${d.color ?? "#e5e7eb"}`, borderRadius: d.borderRadius ? `${d.borderRadius}px` : undefined }} />
        </div>
      );
    case "two_column": {
      const renderCol = (side: "left" | "right") => {
        const colType = d[`${side}Type`] ?? "rich_text";
        switch (colType) {
          case "rich_text": return <div className="prose" dangerouslySetInnerHTML={{ __html: d[`${side}Html`] ?? "" }} />;
          case "cta": return <div className="flex items-center justify-center h-full"><button className={`px-6 py-3 rounded-lg font-semibold shadow ${d[`${side}CtaAnimation`] && d[`${side}CtaAnimation`] !== "none" ? `animate-${d[`${side}CtaAnimation`]}` : ""}`} style={{ backgroundColor: d[`${side}CtaColor`] ?? "#179ca3", color: d[`${side}CtaTextColor`] ?? "#fff" }}>{d[`${side}CtaText`] ?? "Click Here"}</button></div>;
          case "countdown": return <div className="text-center"><p className="text-xs font-bold mb-1">{d[`${side}CountdownHeadline`] ?? ""}</p><div className="flex justify-center gap-2">{["00","00","00"].map((v,i) => <span key={i} className="bg-gray-900 text-white px-2 py-1 rounded text-sm font-mono">{v}</span>)}</div></div>;
          case "contact_form": return <div className="space-y-2"><p className="text-sm font-semibold">{d[`${side}FormHeadline`] ?? "Get in Touch"}</p>{(d[`${side}FormFields`] ?? "name,email,message").split(",").map((f: string) => <div key={f} className="h-7 bg-gray-100 rounded border border-gray-200 px-2 flex items-center text-xs text-gray-400">{f.trim()}</div>)}<button className="w-full h-7 rounded text-xs text-white font-medium" style={{ backgroundColor: d[`${side}FormBtnColor`] ?? "#179ca3" }}>Submit</button></div>;
          case "image": return d[`${side}ImageUrl`] ? <img src={d[`${side}ImageUrl`]} alt={d[`${side}ImageAlt`] ?? ""} className="w-full rounded-lg" /> : <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">No image</div>;
          case "video": return <div className="relative w-full rounded-lg overflow-hidden bg-gray-900" style={{ paddingBottom: "56.25%" }}><div className="absolute inset-0 flex items-center justify-center text-white text-xs">Video</div></div>;
          default: return null;
        }
      };
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="flex gap-8">
            <div style={{ flex: d.leftRatio ?? 50 }}>{renderCol("left")}</div>
            <div style={{ flex: 100 - (d.leftRatio ?? 50) }}>{renderCol("right")}</div>
          </div>
        </div>
      );
    }
    case "divided_columns": {
      const cols = d.columns ?? [{ html: "" }, { html: "" }];
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: `${d.gap ?? 32}px` }}>
            {cols.map((col: any, i: number) => (
              <div key={i} className="prose" dangerouslySetInnerHTML={{ __html: col.html ?? "" }} />
            ))}
          </div>
        </div>
      );
    }
    case "three_column": {
      const divStyle = d.showDividers ? { borderRightWidth: `${d.dividerWidth ?? 1}px`, borderRightStyle: d.dividerStyle ?? "solid", borderRightColor: d.dividerColor ?? "#e5e7eb", borderRadius: d.dividerRadius ? `${d.dividerRadius}px` : undefined } : {};
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="grid grid-cols-3 gap-6 items-stretch">
            <div className="prose prose-sm pr-4" style={divStyle} dangerouslySetInnerHTML={{ __html: d.col1Html ?? "" }} />
            <div className="prose prose-sm px-4" style={divStyle} dangerouslySetInnerHTML={{ __html: d.col2Html ?? "" }} />
            <div className="prose prose-sm pl-4" dangerouslySetInnerHTML={{ __html: d.col3Html ?? "" }} />
          </div>
        </div>
      );
    }
    case "spacer":
      return <div style={{ height: d.height ?? 48 }} className="bg-transparent" />;
    case "logo_strip": {
      const align = d.align ?? "center";
      return (
        <div className="py-4 px-6" style={{ backgroundColor: d.bgColor ?? "#ffffff", padding: d.padding ?? "16px 0" }}>
          <div className={`flex ${align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center"}`}>
            {d.logoUrl ? (
              <img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.maxWidth ?? "200px", height: "auto" }} className="object-contain" />
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg px-8 py-4 text-gray-400 text-sm flex items-center gap-2">
                <Image size={16} /> Add your logo
              </div>
            )}
          </div>
        </div>
      );
    }
    case "footer": {
      const links: Array<{ text: string; url: string }> = d.links ?? [];
      const socialLinks = d.socialLinks ?? {};
      return (
        <div className="px-8 py-6" style={{ backgroundColor: d.bgColor ?? "#0e1e2e", color: d.textColor ?? "#ffffff" }}>
          {d.logoUrl && (
            <div className="flex justify-center mb-4">
              <img src={d.logoUrl} alt="Logo" style={{ maxWidth: d.logoMaxWidth ?? "120px" }} className="object-contain" />
            </div>
          )}
          {links.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4 mb-3">
              {links.map((l, i) => (
                <span key={i} className="text-sm opacity-80 hover:opacity-100 cursor-pointer underline">{l.text}</span>
              ))}
            </div>
          )}
          {d.showSocial && (socialLinks.facebook || socialLinks.instagram || socialLinks.youtube || socialLinks.linkedin) && (
            <div className="flex justify-center gap-3 mb-3">
              {socialLinks.facebook && <Globe size={16} className="opacity-70" />}
              {socialLinks.instagram && <Globe size={16} className="opacity-70" />}
              {socialLinks.youtube && <Globe size={16} className="opacity-70" />}
              {socialLinks.linkedin && <Globe size={16} className="opacity-70" />}
            </div>
          )}
          <p className="text-xs text-center opacity-60">{d.copyrightText ?? "© 2026 All rights reserved."}</p>
        </div>
      );
    }
    case "related_products": {
      const maxItems = d.maxItems ?? 3;
      const layout = d.layout ?? "grid";
      const mockCards = Array.from({ length: maxItems }, (_, i) => ({
        title: ["Advanced Vascular Ultrasound", "Fetal Echo Essentials", "POCUS Fundamentals"][i] ?? `Product ${i + 1}`,
        type: i % 2 === 0 ? "Course" : "Download",
        price: i === 0 ? "$149" : i === 1 ? "$79" : "Free",
        description: "Comprehensive training resource for sonographers and clinicians.",
      }));
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <h2 className="text-2xl font-bold text-center mb-2" style={{ color: d.textColor ?? "#111827" }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-center text-sm mb-6 opacity-70" style={{ color: d.textColor ?? "#111827" }}>{d.subtext}</p>}
          <div className={layout === "grid" ? `grid grid-cols-${Math.min(maxItems, 3)} gap-4` : "space-y-3"}>
            {mockCards.map((card, i) => (
              <div key={i} className="rounded-xl border border-gray-200 overflow-hidden" style={{ backgroundColor: d.cardBgColor ?? "#ffffff" }}>
                <div className="h-24 flex items-center justify-center" style={{ backgroundColor: d.accentColor ?? "#179ca3", opacity: 0.15 + i * 0.05 }}>
                  <Package size={28} style={{ color: d.accentColor ?? "#179ca3", opacity: 0.7 }} />
                </div>
                <div className="p-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: d.accentColor ?? "#179ca3" }}>{card.type}</span>
                  <h3 className="font-bold text-sm mt-0.5 mb-1" style={{ color: d.textColor ?? "#111827" }}>{card.title}</h3>
                  {d.showDescription && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{card.description}</p>}
                  <div className="flex items-center justify-between">
                    {d.showPrice && <span className="text-sm font-bold" style={{ color: d.accentColor ?? "#179ca3" }}>{card.price}</span>}
                    <button className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{d.ctaText ?? "Learn More"}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3 text-center">Auto-populated from published products</p>
        </div>
      );
    }
    case "embedded_checkout":
    case "inline_checkout": {
      return (
        <div style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          <InlineCheckoutBlock data={block.data} sourceType={d.sourceType ?? "other"} />
        </div>
      );
    }
    case "lesson_quiz": {
      const questions: any[] = d.questions ?? [];
      return (
        <div className="px-6 py-5 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{d.title || "Lesson Quiz"}</p>
              <p className="text-xs text-gray-500">{questions.length} question{questions.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          {questions.slice(0, 2).map((q: any, i: number) => (
            <div key={i} className="mb-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
              <p className="font-medium mb-1">{i + 1}. {q.question}</p>
              <div className="grid grid-cols-2 gap-1">
                {(q.options ?? []).slice(0, 4).map((opt: string, j: number) => (
                  <span key={j} className={`px-2 py-0.5 rounded text-xs ${j === q.correctAnswer ? "bg-teal-100 text-teal-700 font-medium" : "bg-white border border-gray-200 text-gray-500"}`}>{["A","B","C","D"][j]}. {opt}</span>
                ))}
              </div>
            </div>
          ))}
          {questions.length > 2 && <p className="text-xs text-gray-400 mt-1">+{questions.length - 2} more questions</p>}
        </div>
      );
    }
    case "lesson_flashcard": {
      const cards: any[] = d.cards ?? [];
      return (
        <div className="px-6 py-5 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{d.title || "Flashcard Deck"}</p>
              <p className="text-xs text-gray-500">{cards.length} card{cards.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          {cards.slice(0, 2).map((c: any, i: number) => (
            <div key={i} className="mb-2 p-2 bg-gradient-to-r from-purple-50 to-teal-50 rounded text-xs">
              <p className="font-medium text-gray-700 mb-0.5">Q: {c.front}</p>
              <p className="text-gray-500">A: {c.back}</p>
            </div>
          ))}
          {cards.length > 2 && <p className="text-xs text-gray-400 mt-1">+{cards.length - 2} more cards</p>}
        </div>
      );
    }
    case "file_download": {
      const fileUrl = d.source === "media_repo" ? (d.mediaAssetUrl || "") : (d.fileUrl || "");
      const fileName = d.source === "media_repo" ? (d.mediaAssetTitle || d.fileName || "File") : (d.fileName || "File");
      const displayMode = d.displayMode ?? "card";
      if (displayMode === "inline" && fileUrl) {
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
        const isPdf = ext === "pdf";
        const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
        const isVideo = ["mp4", "webm", "mov", "ogg"].includes(ext);
        const isAudio = ["mp3", "wav", "ogg", "m4a"].includes(ext);
        return (
          <div className="px-8 py-6" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
            {d.label && <h3 className="text-lg font-semibold text-gray-800 mb-2">{d.label}</h3>}
            {d.description && <p className="text-sm text-gray-500 mb-3">{d.description}</p>}
            {isPdf && <iframe src={fileUrl} className="w-full rounded-lg border border-gray-200" style={{ height: `${d.inlineHeight ?? 600}px` }} title={fileName} />}
            {isImage && <img src={fileUrl} alt={fileName} className="max-w-full rounded-lg shadow" />}
            {isVideo && <video src={fileUrl} controls className="w-full rounded-lg shadow" style={{ maxHeight: `${d.inlineHeight ?? 400}px` }} />}
            {isAudio && <audio src={fileUrl} controls className="w-full" />}
            {/* Always show download button in inline mode */}
            <div className="mt-3 flex justify-end">
              <a href={fileUrl} download={fileName}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: d.buttonColor ?? "#179ca3", color: d.buttonTextColor ?? "#fff" }}>
                <Upload size={14} />{d.buttonText ?? "Download"}
                {d.showFileSize !== false && d.fileSize && <span className="opacity-70 text-xs">({d.fileSize})</span>}
              </a>
            </div>
          </div>
        );
      }
      // Card mode (default)
      return (
        <div className="px-8 py-6" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          <div className="max-w-xl mx-auto flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
            {d.showIcon !== false && (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${d.buttonColor ?? "#179ca3"}20` }}>
                <Upload size={22} style={{ color: d.buttonColor ?? "#179ca3" }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{d.label || fileName || "Download File"}</p>
              {d.description && <p className="text-sm text-gray-500 mt-0.5">{d.description}</p>}
              {d.showFileSize !== false && d.fileSize && <p className="text-xs text-gray-400 mt-0.5">{d.fileSize}</p>}
              {!fileUrl && <p className="text-xs text-amber-500 mt-0.5">No file selected</p>}
            </div>
            <a href={fileUrl || "#"} download={fileName} onClick={e => !fileUrl && e.preventDefault()}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 transition-opacity"
              style={{ backgroundColor: d.buttonColor ?? "#179ca3", color: d.buttonTextColor ?? "#ffffff", opacity: fileUrl ? 1 : 0.4 }}>
              {d.buttonText ?? "Download"}
            </a>
          </div>
        </div>
      );
    }
    case "scorm_embed": {
      const slug = d.mediaAssetSlug ?? "";
      const title = d.mediaAssetTitle ?? "Interactive Content";
      const height = d.height ?? 600;
      const embedUrl = slug ? `/api/media/${slug}/embed` : "";
      return (
        <div className="px-8 py-6" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.title && <h3 className="text-lg font-semibold text-gray-800 mb-3">{d.title}</h3>}
          {embedUrl ? (
            <iframe
              src={embedUrl}
              style={{ width: "100%", height: `${height}px`, border: "none", borderRadius: "8px" }}
              title={title}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <div
              className="w-full bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 text-gray-400"
              style={{ height: `${height}px` }}
            >
              <Package size={36} className="text-gray-300" />
              <p className="text-sm font-medium">No file selected</p>
              <p className="text-xs text-gray-400">Pick an HTML, SCORM, or ZIP file from the media repository</p>
            </div>
          )}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
    }
    case "url_embed": {
      const url = d.url ?? "";
      const height = d.height ?? 600;
      const embedTitle = d.title ?? "Embedded Content";
      return (
        <div className="px-8 py-6" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.title && <h3 className="text-lg font-semibold text-gray-800 mb-3">{d.title}</h3>}
          {url ? (
            <iframe
              src={url}
              style={{ width: "100%", height: `${height}px`, border: "none", borderRadius: "8px" }}
              title={embedTitle}
              allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-top-navigation-by-user-activation"
            />
          ) : (
            <div
              className="w-full bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 text-gray-400"
              style={{ height: `${height}px` }}
            >
              <Globe size={36} className="text-gray-300" />
              <p className="text-sm font-medium">No URL entered</p>
              <p className="text-xs text-gray-400">Enter a URL to embed any webpage or interactive content</p>
            </div>
          )}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
    }
    case "column_layout": {
      const leftBlocks: Block[] = d.leftBlocks ?? [];
      const rightBlocks: Block[] = d.rightBlocks ?? [];
      const leftRatio = d.leftRatio ?? 50;
      const gap = d.gap ?? 32;
      return (
        <div className="py-4" style={{ backgroundColor: d.bgColor ?? "transparent", padding: `${d.paddingY ?? 16}px ${d.paddingX ?? 32}px` }}>
          <div className="flex items-start" style={{ gap: `${gap}px` }}>
            <div style={{ flex: leftRatio, minWidth: 0 }}>
              {leftBlocks.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-xs">Left column (empty)</div>
              ) : (
                <div className="space-y-2">
                  {leftBlocks.map((b: Block) => <BlockPreview key={b.id} block={b} />)}
                </div>
              )}
            </div>
            <div style={{ flex: 100 - leftRatio, minWidth: 0 }}>
              {rightBlocks.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-xs">Right column (empty)</div>
              ) : (
                <div className="space-y-2">
                  {rightBlocks.map((b: Block) => <BlockPreview key={b.id} block={b} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    case "carousel":
      return <div className="px-4 py-4"><CarouselBlock data={d} /></div>;
    case "ticker":
      return <TickerBlockPreview d={d} />;
    case "countdown_v2":
      return <CountdownV2BlockPreview d={d} />;
    default:
      return <div className="px-8 py-4 text-gray-400 text-sm text-center">Block preview not available</div>;
  }
}

function InstructorBlockPreview({ d }: { d: Record<string, any> }) {
  const instructorId = d.instructorId ? Number(d.instructorId) : null;
  const { data: instructors } = trpc.lms.listInstructors.useQuery();
  const instructor = instructorId ? instructors?.find((i: any) => i.id === instructorId) : null;
  const name = instructor?.name ?? d.name ?? "Instructor Name";
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
      <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
        <div className="max-w-2xl mx-auto text-center">
          {avatarUrl
            ? <img src={avatarUrl} alt={name} className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border-4 border-teal-100" />
            : <div className="w-28 h-28 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4"><Users size={40} className="text-teal-600" /></div>}
          <h3 className="text-2xl font-bold mb-1" style={{ color: headlineColor }}>{name}</h3>
          {title && <p className="font-semibold mb-3" style={{ color: titleColor }}>{title}</p>}
          {showBio && bio && <div className="text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: bio }} />}
          {showWebsite && website && <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm font-medium" style={{ color: titleColor }}><Globe size={14} /> {website.replace(/^https?:\/\//, "")}</a>}
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
      <div className="max-w-3xl mx-auto flex gap-6 items-start">
        {avatarUrl
          ? <img src={avatarUrl} alt={name} className="w-24 h-24 rounded-full object-cover flex-shrink-0 border-4 border-teal-100" />
          : <div className="w-24 h-24 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0"><Users size={32} className="text-teal-600" /></div>}
        <div className="min-w-0">
          <h3 className="text-xl font-bold" style={{ color: headlineColor }}>{name}</h3>
          {title && <p className="font-semibold mb-2" style={{ color: titleColor }}>{title}</p>}
          {showBio && bio && <div className="text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: bio }} />}
          {showWebsite && website && <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm font-medium" style={{ color: titleColor }}><Globe size={14} /> {website.replace(/^https?:\/\//, "")}</a>}
        </div>
      </div>
    </div>
  );
}


// ─── Ticker / Marquee Block ───────────────────────────────────────────────────

/**
 * Shared ticker renderer — used by BlockPreview, CourseLanding, PublicFunnelPage,
 * DownloadLanding, and LessonBlockEditor.
 */
export function TickerBlock({ data: d }: { data: Record<string, any> }) {
  const items: string[] = d.items?.length ? d.items : ["Welcome to our platform!", "New courses available now!", "Check out our latest resources!"];
  const sep = d.separator ?? "•";
  const speed = d.speed ?? 40; // seconds for one full cycle
  const direction = d.direction ?? "left"; // "left" | "right"
  const pauseOnHover = d.pauseOnHover !== false;
  const bgColor = d.bgColor ?? "#179ca3";
  const textColor = d.textColor ?? "#ffffff";
  const fontSize = d.fontSize ?? 15;
  const fontWeight = d.fontWeight ?? "500";
  const paddingY = d.paddingY ?? 10;
  const letterSpacing = d.letterSpacing ?? 0;
  const textTransform = d.textTransform ?? "none";
  const borderTop = d.borderTop ?? "";
  const borderBottom = d.borderBottom ?? "";

  // Build the repeated text string (duplicate for seamless loop)
  const fullText = items.map(i => i.trim()).join(`  ${sep}  `);
  const animName = direction === "right" ? "ticker-rtl" : "ticker-ltr";

  return (
    <div
      className="w-full overflow-hidden select-none"
      style={{
        backgroundColor: bgColor,
        paddingTop: paddingY,
        paddingBottom: paddingY,
        borderTop: borderTop || undefined,
        borderBottom: borderBottom || undefined,
      }}
    >
      <style>{`
        @keyframes ticker-ltr {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ticker-rtl {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ${animName} ${speed}s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: ${pauseOnHover ? "paused" : "running"};
        }
      `}</style>
      <div className="ticker-track">
        {/* Duplicate content twice for seamless loop */}
        {[0, 1].map(copy => (
          <span
            key={copy}
            className="whitespace-nowrap px-6"
            style={{
              color: textColor,
              fontSize,
              fontWeight,
              letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
              textTransform: textTransform as any,
            }}
          >
            {fullText}
          </span>
        ))}
      </div>
    </div>
  );
}

function TickerBlockPreview({ d }: { d: Record<string, any> }) {
  return <TickerBlock data={d} />;
}

// ─── Countdown Timer V2 Block ─────────────────────────────────────────────────

/**
 * Shared countdown v2 renderer — supports duration mode (hours+minutes from load)
 * and target-date mode (count down to a specific date/time).
 */
export function CountdownV2Block({ data: d }: { data: Record<string, any> }) {
  const mode: "duration" | "target_date" = d.mode ?? "duration";

  // Compute end time once on mount
  const [endTime] = useState<number>(() => {
    if (mode === "target_date" && d.targetDate) {
      return new Date(d.targetDate).getTime();
    }
    const h = Number(d.durationHours ?? 1);
    const m = Number(d.durationMinutes ?? 30);
    return Date.now() + (h * 3600 + m * 60) * 1000;
  });

  const calcRemaining = () => Math.max(0, endTime - Date.now());
  const [remaining, setRemaining] = useState(calcRemaining);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(id);
  }, [endTime]);

  const expired = remaining <= 0;

  const totalSec = Math.floor(remaining / 1000);
  const days    = Math.floor(totalSec / 86400);
  const hours   = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  const bgColor      = d.bgColor      ?? "#0e1e2e";
  const textColor    = d.textColor    ?? "#ffffff";
  const accentColor  = d.accentColor  ?? "#179ca3";
  const digitBg      = d.digitBg      ?? "#1a2e3e";
  const digitText    = d.digitTextColor ?? "#ffffff";
  const labelColor   = d.labelColor   ?? "rgba(255,255,255,0.6)";
  const sepColor     = d.separatorColor ?? "#179ca3";
  const cr           = d.cornerRadius ?? 8;
  const gap          = d.gap          ?? 12;
  const digitSize    = d.digitSize    ?? 56;
  const labelSize    = d.labelSize    ?? 11;
  const headlineSize = d.headlineSize ?? 22;
  const headlineWeight = d.headlineWeight ?? "700";

  const showDays    = d.showDays    !== false;
  const showHours   = d.showHours   !== false;
  const showMinutes = d.showMinutes !== false;
  const showSeconds = d.showSeconds !== false;

  const units: Array<{ label: string; value: number; show: boolean }> = [
    { label: "Days",    value: days,    show: showDays },
    { label: "Hours",   value: hours,   show: showHours },
    { label: "Minutes", value: minutes, show: showMinutes },
    { label: "Seconds", value: seconds, show: showSeconds },
  ].filter(u => u.show);

  return (
    <div
      className={`px-8 py-10 text-center ${d.showBorder ? "border-2" : ""}`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        borderColor: d.showBorder ? (d.borderColor ?? accentColor) : undefined,
        borderRadius: d.showBorder ? `${cr}px` : undefined,
      }}
    >
      {d.showHeadline !== false && d.headline && (
        <h2
          className="mb-2"
          style={{ color: textColor, fontSize: headlineSize, fontWeight: headlineWeight }}
          dangerouslySetInnerHTML={{ __html: d.headline }}
        />
      )}
      {d.subtext && (
        <p className="mb-6 opacity-75 text-sm" dangerouslySetInnerHTML={{ __html: d.subtext }} />
      )}
      {expired ? (
        <p className="text-lg font-semibold" style={{ color: accentColor }}>
          {d.expiredText ?? "This offer has expired."}
        </p>
      ) : (
        <div className="flex justify-center items-center flex-wrap" style={{ gap }}>
          {units.map((u, i) => (
            <div key={u.label} className="flex items-center" style={{ gap }}>
              <div className="flex flex-col items-center">
                <div
                  className="flex items-center justify-center font-black tabular-nums"
                  style={{
                    backgroundColor: digitBg,
                    color: digitText,
                    fontSize: digitSize,
                    borderRadius: cr,
                    minWidth: digitSize * 1.4,
                    padding: `${digitSize * 0.15}px ${digitSize * 0.2}px`,
                    lineHeight: 1,
                  }}
                >
                  {pad(u.value)}
                </div>
                <span
                  className="mt-1 font-medium uppercase tracking-wider"
                  style={{ color: labelColor, fontSize: labelSize }}
                >
                  {u.label}
                </span>
              </div>
              {i < units.length - 1 && (
                <span
                  className="font-black -mt-5"
                  style={{ color: sepColor, fontSize: digitSize * 0.7 }}
                >
                  :
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CountdownV2BlockPreview({ d }: { d: Record<string, any> }) {
  return <CountdownV2Block data={d} />;
}
