/**
 * BlockPreview.tsx
 * Shared read-only block renderer used by CoursePlayer, CourseOverview, and LandingPageBuilder.
 * Extracted into its own file to break the circular dependency between CoursePlayer and LandingPageBuilder.
 */
import { ChevronDown, Globe, Image, Package, Video } from "lucide-react";
import { Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";

export type BlockType =
  | "hero" | "text" | "image" | "video" | "bullets" | "testimonial"
  | "pricing_cta" | "divider" | "two_column" | "divided_columns" | "spacer"
  | "faq" | "image_text" | "gallery" | "icon_grid" | "countdown"
  | "instructor" | "logos" | "reviews" | "embed" | "cta_standalone"
  | "lead_capture" | "numbered_list" | "alert" | "flip_cards"
  | "curriculum_auto" | "pricing_options_auto"
  | "funnel_workflow" | "product_offer_stack" | "order_bump_checkout"
  | "price_stack" | "urgency_offer" | "checkout_form"
  | "footer" | "logo_strip" | "three_column"
  | "related_products";

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, any>;
}

export function BlockPreview({ block, coursePrice, courseTitle }: { block: Block; coursePrice?: number; courseTitle?: string }) {
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
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Enroll Now", color: d.ctaColor ?? "#fff", textColor: d.ctaTextColor ?? "#179ca3", link: "", style: "filled" }];
      const hasInlineMedia = !!d.inlineMediaUrl;
      const placement = d.inlineMediaPlacement ?? "right";
      const isHorizontal = placement === "left" || placement === "right";
      return (
        <div className="relative px-8 py-16 overflow-hidden" style={{ ...heroBg, color: d.textColor ?? "#fff", textAlign: hasInlineMedia && isHorizontal ? "left" as const : (d.align ?? "left") }}>
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
                  <button key={i} className={`px-8 py-3 rounded-lg font-semibold text-lg shadow-lg ${btn.animation && btn.animation !== "none" ? `animate-${btn.animation}-btn` : ""}`}
                    style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                    {btn.text}
                  </button>
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
    case "image":
      return (
        <div className="px-8 py-6 text-center">
          {d.url ? <img src={d.url} alt={d.alt ?? ""} className="mx-auto shadow" style={{ maxWidth: d.maxWidth ?? "100%", height: d.height || "auto", objectFit: "cover", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined }} /> : <div className="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><Image size={32} /></div>}
          {d.caption && <p className="text-sm text-gray-500 mt-2">{d.caption}</p>}
        </div>
      );
    case "video":
      return (
        <div className="px-8 py-6">
          {d.embedUrl ? (
            <div className="relative w-full overflow-hidden shadow mx-auto" style={{ maxWidth: d.maxWidth ?? "100%", height: d.height || undefined, paddingBottom: d.height ? undefined : "56.25%", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined }}>
              <iframe src={d.embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen title="Video" />
            </div>
          ) : <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><Video size={32} /></div>}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
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
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
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
              <div key={i} className="bg-gray-50 rounded-xl p-5 shadow-sm">
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
    case "pricing_cta":
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-3xl font-bold text-gray-900 mb-3" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-gray-600 mb-6 max-w-xl mx-auto" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          {d.showPrice && coursePrice !== undefined && <div className="mb-6">{d.showOriginalPrice && d.originalPrice && <p className="text-xl text-gray-400 line-through mb-1">${d.originalPrice}</p>}<p className="text-4xl font-bold" style={{ color: d.ctaColor ?? "#179ca3" }}>{coursePrice === 0 ? "Free" : `$${(coursePrice / 100).toFixed(2)}`}</p></div>}
          <button className={`px-10 py-4 rounded-xl font-bold text-lg shadow-lg ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`} style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>{d.ctaText ?? "Enroll Now"}</button>
          {d.buttonSubtext && (
            <p className="mt-3 text-xs text-gray-500">
              {d.buttonSubtextUrl ? <a href={d.buttonSubtextUrl} className="underline hover:text-gray-700">{d.buttonSubtext}</a> : d.buttonSubtext}
            </p>
          )}
        </div>
      );
    case "cta_standalone":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa", textAlign: d.align ?? "center" }}>
          {d.headline && <h2 className="text-2xl font-bold text-gray-900 mb-3" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          {d.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
          <a href={d.ctaLink ?? "#"} className={`inline-block px-8 py-3 rounded-lg font-semibold shadow ${d.ctaAnimation && d.ctaAnimation !== "none" ? `animate-${d.ctaAnimation}-btn` : ""}`} style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>{d.ctaText ?? "Get Started"}</a>
          {d.buttonSubtext && (
            <p className="mt-3 text-xs text-gray-500">
              {d.buttonSubtextUrl ? <a href={d.buttonSubtextUrl} className="underline hover:text-gray-700">{d.buttonSubtext}</a> : d.buttonSubtext}
            </p>
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
          {d.ctaText && (
            <p className="font-bold" style={{ color: d.accentColor ?? "#179ca3" }}>
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
          <div className="rounded-lg px-6 py-4 mb-6 text-center text-white font-bold text-lg flex items-center justify-center gap-2" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>
            <span>\uD83D\uDD12</span> {d.headerText ?? "Lock in your seat now!"} {d.headerPrice ?? ""}
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
                  <span className="text-sm font-medium">${(p.price / 100).toFixed(2)}</span>
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
    case "curriculum_auto":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className="border border-gray-200 rounded-xl overflow-hidden max-w-3xl">
            {["Section 1", "Section 2", "Section 3"].map((s, i) => (
              <div key={i} className="border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between px-5 py-4 bg-gray-50 font-semibold text-gray-800">
                  <span>{s}</span><ChevronDown size={16} className="text-gray-400" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Auto-populated from course curriculum</p>
        </div>
      );
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

