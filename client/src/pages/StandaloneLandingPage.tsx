/**
 * StandaloneLandingPage.tsx
 * Renders a standalone funnel page at /p/:slug
 * Any funnel page marked as isStandaloneLanding=true can be accessed here.
 */
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Suspense, lazy } from "react";

// Re-use the same block renderer from PublicFunnelPage
const PublicFunnelPage = lazy(() => import("./PublicFunnelPage"));

export default function StandaloneLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = trpc.funnelPublic.getStandalonePage.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
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
        <p className="text-gray-400 mb-4">This page doesn't exist or is no longer active.</p>
        <Button onClick={() => navigate("/")} variant="outline">Go Home</Button>
      </div>
    );
  }

  const { funnel, page } = data;
  let blocks: any[] = [];
  try {
    blocks = page.blocks ? JSON.parse(page.blocks) : [];
  } catch {
    blocks = [];
  }

  // We render the page using the same block rendering approach as PublicFunnelPage
  // but without the funnel navigation (no next/prev page links)
  return (
    <div className="min-h-screen bg-white">
      {blocks.map((block: any) => (
        <div
          key={block.id}
          style={{
            marginTop: block.data.marginTop ? `${block.data.marginTop}px` : undefined,
            marginBottom: block.data.marginBottom ? `${block.data.marginBottom}px` : undefined,
            paddingTop: block.data.paddingTop ? `${block.data.paddingTop}px` : undefined,
            paddingBottom: block.data.paddingBottom ? `${block.data.paddingBottom}px` : undefined,
            paddingLeft: block.data.paddingLeft ? `${block.data.paddingLeft}px` : undefined,
            paddingRight: block.data.paddingRight ? `${block.data.paddingRight}px` : undefined,
          }}
        >
          <StandaloneRenderBlock
            block={block}
            funnelId={funnel?.id ?? 0}
            pageId={page.id}
            funnelSlug={funnel?.slug ?? ""}
          />
        </div>
      ))}
      {blocks.length === 0 && (
        <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
          <p>This page is being built. Check back soon!</p>
        </div>
      )}
    </div>
  );
}

// Minimal block renderer — imports the same rendering logic
// We import the RenderBlock from PublicFunnelPage dynamically to avoid circular deps
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle, Globe, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Block } from "@/components/BlockPreview";
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";
import CheckoutFormBlock from "@/components/CheckoutFormBlock";
import EmbeddedCheckoutBlock from "@/components/EmbeddedCheckoutBlock";
import InlineCheckoutBlock from "@/components/InlineCheckoutBlock";
import { RelatedProductsBlock } from "@/components/RelatedProductsBlock";

function StandaloneRenderBlock({ block, funnelId, pageId, funnelSlug }: { block: Block; funnelId: number; pageId: number; funnelSlug: string }) {
  const d = block.data;
  // This is a simplified version — for a full implementation, we'd share the RenderBlock component
  // For now, we'll use the same rendering approach as PublicFunnelPage
  switch (block.type) {
    case "checkout_form":
      return (
        <CheckoutFormBlock
          data={d}
          funnelId={funnelId}
          pageId={pageId}
          funnelSlug={funnelSlug}
        />
      );
    case "inline_checkout":
      return <InlineCheckoutBlock data={d} sourceType="landing_page" sourceFunnelId={funnelId} />;
    case "embedded_checkout":
      return <EmbeddedCheckoutBlock data={d} pageSlug={funnelSlug} />;
    case "hero": {
      const bgStyle: React.CSSProperties = {};
      if (d.bgType === "gradient") {
        bgStyle.background = `linear-gradient(${d.gradientDir || "to bottom right"}, ${d.gradientFrom || "#179ca3"}, ${d.gradientTo || "#0e4a50"})`;
      } else if (d.bgType === "image" && d.imageUrl) {
        bgStyle.backgroundImage = `url(${d.imageUrl})`;
        bgStyle.backgroundSize = "cover";
        bgStyle.backgroundPosition = "center";
      } else {
        bgStyle.backgroundColor = d.bgColor || "#179ca3";
      }
      const align = d.align || "left";
      const hasInlineMedia = d.inlineMediaUrl && d.inlineMediaType;
      return (
        <div className="px-8 py-16 md:py-24" style={{ ...bgStyle, color: d.textColor || "#ffffff" }}>
          <div className={`max-w-5xl mx-auto ${hasInlineMedia ? "flex flex-col md:flex-row items-center gap-8" : ""}`}>
            <div className={`${hasInlineMedia ? "flex-1" : "max-w-3xl"} ${align === "center" ? "text-center mx-auto" : align === "right" ? "text-right ml-auto" : ""}`}>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4" style={{ color: d.headlineColor || d.textColor || "#ffffff" }}>{d.headline}</h1>
              {d.headline2 && <h2 className="text-xl md:text-2xl font-semibold mb-4" style={{ color: d.headline2Color || d.textColor || "#ffffff" }}>{d.headline2}</h2>}
              {d.subheadline && <p className="text-lg md:text-xl opacity-90 mb-6">{d.subheadline}</p>}
              {d.buttons?.length > 0 && (
                <div className={`flex flex-wrap gap-3 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
                  {d.buttons.map((btn: any, i: number) => (
                    <a key={i} href={btn.link || "#"} className="inline-block px-6 py-3 rounded-lg font-semibold text-lg transition-transform hover:scale-105" style={{ backgroundColor: btn.color || "#ffffff", color: btn.textColor || "#179ca3" }}>{btn.text}</a>
                  ))}
                </div>
              )}
            </div>
            {hasInlineMedia && (
              <div className="flex-1 max-w-lg">
                {d.inlineMediaType === "video" ? (
                  <div className="aspect-video rounded-xl overflow-hidden shadow-2xl"><iframe src={d.inlineMediaUrl} className="w-full h-full" allowFullScreen /></div>
                ) : (
                  <img src={d.inlineMediaUrl} alt="" className="rounded-xl shadow-2xl w-full" />
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    case "text":
      return (
        <div className="px-8 py-6" style={{ backgroundColor: d.bgColor || "#ffffff", color: d.textColor || "#1a1a1a", textAlign: d.align || "left" }}>
          <div className="max-w-3xl mx-auto prose prose-lg" dangerouslySetInnerHTML={{ __html: d.html || "" }} />
        </div>
      );
    case "image":
      return d.url ? (
        <div className="px-8 py-6" style={{ textAlign: d.align || "center" }}>
          <div className="max-w-4xl mx-auto"><img src={d.url} alt={d.alt || ""} className="rounded-lg shadow-md" style={{ maxWidth: d.maxWidth || "100%" }} /></div>
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      ) : null;
    case "video":
      return d.embedUrl ? (
        <div className="px-8 py-6"><div className="max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden shadow-lg"><iframe src={d.embedUrl} className="w-full h-full" allowFullScreen /></div>{d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}</div>
      ) : null;
    case "bullets":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor || "#f8fffe" }}>
          <div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900">{d.headline}</h2>}
            <ul className="space-y-3">{(d.items || []).map((item: string, i: number) => (<li key={i} className="flex items-start gap-3"><CheckCircle size={20} style={{ color: d.iconColor || "#179ca3" }} className="flex-shrink-0 mt-0.5" /><span className="text-gray-700">{item}</span></li>))}</ul>
          </div>
        </div>
      );
    case "spacer":
      return <div style={{ height: d.height || 48 }} />;
    case "divider":
      return <div className="px-8" style={{ paddingTop: d.spacing || 32, paddingBottom: d.spacing || 32 }}><hr style={{ borderColor: d.color || "#e5e7eb", borderWidth: d.thickness || 1, borderStyle: d.style || "solid" }} /></div>;
    case "related_products":
      return <RelatedProductsBlock data={d} />;
    default:
      // For blocks we haven't explicitly handled, render a placeholder
      return (
        <div className="px-8 py-6">
          <div className="max-w-4xl mx-auto text-center text-gray-400 text-sm">
            Block type: {block.type}
          </div>
        </div>
      );
  }
}
