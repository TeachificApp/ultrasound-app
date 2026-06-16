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
import { useSeoHead } from "@/hooks/useSeoHead";

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

  // SEO head tags for standalone funnel pages
  const _canonicalOrigin = typeof window !== "undefined" ? window.location.origin : "https://learn.allaboutultrasound.com";
  useSeoHead({
    title: page.seoTitle ?? funnel?.name ?? page.title ?? undefined,
    description: page.seoDescription ?? undefined,
    image: page.seoImage ?? undefined,
    canonical: `${_canonicalOrigin}/p/${slug}`,
    type: "website",
  });

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
import AudioBlockPlayer from "@/components/AudioBlockPlayer";
import { RelatedProductsBlock } from "@/components/RelatedProductsBlock";
import { ImageLinkWrapper } from "@/components/BlockPreview";

function StandaloneRenderBlock({ block, funnelId, pageId, funnelSlug }: { block: Block; funnelId: number; pageId: number; funnelSlug: string }) {
  const { data: freeEnrollCatalog } = trpc.funnel.listAllProducts.useQuery(undefined, { staleTime: 60_000 });
  const enrollFree = trpc.lmsLearner.enrollFree.useMutation({
    onSuccess: () => toast.success("Enrolled! You now have access."),
    onError: (e) => toast.error(`Enrollment failed: ${e.message}`),
  });
  const bundleEnroll = trpc.bundlesLearner.enroll.useMutation({
    onSuccess: () => toast.success("Enrolled! You now have access."),
    onError: (e) => toast.error(`Enrollment failed: ${e.message}`),
  });
  const webinarRegister = trpc.webinarLearner.register.useMutation({
    onSuccess: () => toast.success("Registered! You now have access."),
    onError: (e) => toast.error(`Registration failed: ${e.message}`),
  });
  const downloadsCheckout = trpc.downloadsLearner.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.free || data.alreadyPurchased) toast.success("Access granted!");
      else if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank");
    },
    onError: (e) => toast.error(`Checkout failed: ${e.message}`),
  });
  const workshopEnrollFree = trpc.workshopLearner.enrollFree.useMutation({
    onSuccess: (data) => {
      if (data.alreadyEnrolled) toast.success("You already have access to this workshop.");
      else toast.success("Enrolled! You now have access to this workshop.");
    },
    onError: (e) => toast.error(`Workshop enrollment failed: ${e.message}`),
  });
  const communityJoin = trpc.community.join.useMutation({
    onSuccess: (data) => {
      if ((data as any).pending) toast.success("Request submitted! Your membership is pending approval.");
      else toast.success("Joined! You now have access to this community.");
    },
    onError: (e) => toast.error(`Community join failed: ${e.message}`),
  });
  // Group free enrollment dialog state
  const [gfeDialogOpen, setGfeDialogOpen] = useState(false);
  const [gfeCourseId, setGfeCourseId] = useState<number | null>(null);
  const [gfeDefaultSeats, setGfeDefaultSeats] = useState(5);
  const [gfeGroupName, setGfeGroupName] = useState("");
  const [gfeSeats, setGfeSeats] = useState(5);
  const createFreeGroup = trpc.lmsLearner.createFreeGroup.useMutation({
    onSuccess: (data) => {
      toast.success(`Group "${gfeGroupName}" created with ${gfeSeats} seats!`);
      setGfeDialogOpen(false);
      window.location.href = "/my-team";
    },
    onError: (e) => toast.error(`Failed to create group: ${e.message}`),
  });
  const openGroupFreeEnrollDialog = (courseId: number, defaultSeats: number) => {
    setGfeCourseId(courseId);
    setGfeDefaultSeats(defaultSeats);
    setGfeSeats(defaultSeats);
    setGfeGroupName("");
    setGfeDialogOpen(true);
  };

  const handleFreeEnroll = async (productType: string, productId: number) => {
    try {
      if (productType === "course" || productType === "quiz" || productType === "cohort") {
        const target = (freeEnrollCatalog as any[])?.find((p: any) => p.type === productType && p.id === productId);
        if (target?.slug) await enrollFree.mutateAsync({ courseSlug: target.slug });
        else toast.error("Course not found.");
      } else if (productType === "bundle") {
        await bundleEnroll.mutateAsync({ bundleId: productId });
      } else if (productType === "webinar") {
        await webinarRegister.mutateAsync({ webinarId: productId });
      } else if (productType === "download") {
        await downloadsCheckout.mutateAsync({ productId });
      } else if (productType === "workshop") {
        await workshopEnrollFree.mutateAsync({ workshopId: productId });
      } else if (productType === "community") {
        await communityJoin.mutateAsync({ communityId: productId });
      } else {
        toast.error(`Free enrollment not supported for product type: ${productType}`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Enrollment failed.");
    }
  };
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
      const hasInlineMediaSL = !!d.inlineMediaUrl;
      const placementSL = d.inlineMediaPlacement ?? "right";
      const isHorizontalSL = placementSL === "left" || placementSL === "right";
      const heroTopBorderStyleSL: React.CSSProperties = d.heroTopBorder
        ? { borderTop: `${d.heroTopBorderWidth ?? 4}px solid ${d.heroTopBorderColor ?? "#179ca3"}` }
        : {};
      const heroBottomBorderStyleSL: React.CSSProperties = d.heroBottomBorder
        ? { borderBottom: `${d.heroBottomBorderWidth ?? 4}px solid ${d.heroBottomBorderColor ?? "#179ca3"}` }
        : {};
      const heroClickHandlerSL = d.heroClickable && d.heroBehavior && d.heroBehavior !== "next_funnel_step"
        ? () => {
            const beh = d.heroBehavior as string;
            if (beh === "group_free_enrollment" && (d as any).heroGroupFreeEnrollCourseId) {
              openGroupFreeEnrollDialog(Number((d as any).heroGroupFreeEnrollCourseId), (d as any).heroGroupFreeEnrollDefaultSeats ?? 5);
              return;
            }
            if (beh === "url" && d.heroLink) window.open(d.heroLink, "_blank");
            else if (beh === "send_email" && d.heroEmail) window.location.href = `mailto:${d.heroEmail}`;
            else if (beh === "scroll_to_section" && d.heroScrollAnchor) {
              const el = document.getElementById(d.heroScrollAnchor.replace(/^#/, ""));
              el?.scrollIntoView({ behavior: "smooth" });
            } else if (beh === "download_file" && d.heroDownloadUrl) window.open(d.heroDownloadUrl, "_blank");
            else if (beh === "open_popup" && d.heroPopupUrl) window.open(d.heroPopupUrl, "_blank");
            else if (beh === "free_enrollment" && d.heroFreeEnrollProductId) {
              handleFreeEnroll(d.heroFreeEnrollProductType ?? "course", Number(d.heroFreeEnrollProductId));
            }
          }
        : undefined;
      return (
        <>
        <div className="hero-block relative px-4 sm:px-8 py-10 sm:py-16 md:py-24 overflow-hidden w-full box-border" style={{ ...bgStyle, ...heroTopBorderStyleSL, ...heroBottomBorderStyleSL, color: d.textColor || "#ffffff", minHeight: `${d.heroMinHeight ?? 400}px`, cursor: heroClickHandlerSL ? "pointer" : undefined }} onClick={heroClickHandlerSL}>
          {d.bgType === "video" && d.videoUrl && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.videoUrl} /></video>
          )}
          <div className={`relative max-w-5xl mx-auto w-full ${
            hasInlineMediaSL && isHorizontalSL
              ? "flex flex-col sm:flex-row items-center gap-6 sm:gap-10"
              : ""
          } ${hasInlineMediaSL && placementSL === "left" ? "sm:flex-row-reverse" : ""}`}>
            <div className={`${hasInlineMediaSL && isHorizontalSL ? "w-full sm:flex-1 min-w-0" : "max-w-3xl w-full"} ${align === "center" ? "text-center mx-auto" : align === "right" ? "text-right ml-auto" : ""}`}>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold leading-tight mb-3 sm:mb-4 break-words" style={{ color: d.headlineColor || d.textColor || "#ffffff" }} dangerouslySetInnerHTML={{ __html: d.headline ?? "" }} />
              {d.headline2 && <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4 break-words" style={{ color: d.headline2Color || d.textColor || "#ffffff" }} dangerouslySetInnerHTML={{ __html: d.headline2 }} />}
              {d.subheadline && <p className="text-base sm:text-lg md:text-xl opacity-90 mb-5 sm:mb-6 break-words" dangerouslySetInnerHTML={{ __html: d.subheadline }} />}
              {!d.hideButtons && d.buttons?.length > 0 && (
                <div className={`flex flex-wrap gap-3 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
                  {d.buttons.map((btn: any, i: number) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      {btn.behavior === "group_free_enrollment" && btn.groupFreeEnrollCourseId ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); openGroupFreeEnrollDialog(Number(btn.groupFreeEnrollCourseId), btn.groupFreeEnrollDefaultSeats ?? 5); }}
                          className={`inline-block px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-base sm:text-lg transition-transform hover:scale-105 w-full sm:w-auto ${btn.animation && btn.animation !== "none" ? `animate-${btn.animation}-btn` : ""}`}
                          style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color || "#fff", border: `2px solid ${btn.color || "#fff"}` } : { backgroundColor: btn.color || "#ffffff", color: btn.textColor || "#179ca3" }}>
                          {btn.text}
                        </button>
                      ) : btn.behavior === "free_enrollment" && btn.freeEnrollProductId ? (
                        <button
                          onClick={() => handleFreeEnroll(btn.freeEnrollProductType ?? "course", Number(btn.freeEnrollProductId))}
                          className={`inline-block px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-base sm:text-lg transition-transform hover:scale-105 w-full sm:w-auto ${btn.animation && btn.animation !== "none" ? `animate-${btn.animation}-btn` : ""}`}
                          style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color || "#fff", border: `2px solid ${btn.color || "#fff"}` } : { backgroundColor: btn.color || "#ffffff", color: btn.textColor || "#179ca3" }}>
                          {btn.text}
                        </button>
                      ) : (
                      <a href={btn.link || "#"}
                        className={`inline-block px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-base sm:text-lg transition-transform hover:scale-105 w-full sm:w-auto ${btn.animation && btn.animation !== "none" ? `animate-${btn.animation}-btn` : ""}`}
                        style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color || "#fff", border: `2px solid ${btn.color || "#fff"}` } : { backgroundColor: btn.color || "#ffffff", color: btn.textColor || "#179ca3" }}>
                        {btn.text}
                      </a>
                      )}
                      {btn.showStrikethrough && btn.strikethroughPrice && (
                        <span className="text-xs text-white/60 line-through">{btn.strikethroughPrice}</span>
                      )}
                      {btn.showOptOut && btn.optOutText && (
                        <a href={btn.optOutUrl || "#"} className="text-xs text-white/60 underline hover:text-white/80 cursor-pointer">{btn.optOutText}</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {hasInlineMediaSL && (
              <div className={isHorizontalSL ? "w-full sm:flex-1 sm:max-w-lg mt-6 sm:mt-0" : "mt-6 max-w-lg mx-auto w-full"}>
                {d.inlineMediaType === "video" ? (
                  <div className="aspect-video rounded-xl overflow-hidden shadow-2xl"><iframe src={d.inlineMediaUrl} className="w-full h-full" allowFullScreen /></div>
                ) : (
                  <img src={d.inlineMediaUrl} alt="" className="rounded-xl shadow-2xl w-full" />
                )}
              </div>
            )}
          </div>
        </div>
        {/* Group Free Enrollment Dialog */}
        {gfeDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setGfeDialogOpen(false)}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Create Free Group Access</h2>
                <button onClick={() => setGfeDialogOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Enter your group details. You'll be able to assign seats and track member progress from your Team Dashboard.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group / Organization Name</label>
                  <input
                    type="text"
                    value={gfeGroupName}
                    onChange={e => setGfeGroupName(e.target.value)}
                    placeholder="e.g. Cardiology Department, St. Mary's Hospital"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Seats</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={gfeSeats}
                    onChange={e => setGfeSeats(Math.max(1, Number(e.target.value)))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Each seat allows one team member to access the course.</p>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setGfeDialogOpen(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
                >Cancel</button>
                <button
                  disabled={!gfeGroupName.trim() || gfeSeats < 1 || createFreeGroup.isPending || !gfeCourseId}
                  onClick={() => createFreeGroup.mutate({ courseId: gfeCourseId!, seats: gfeSeats, groupName: gfeGroupName.trim() })}
                  className="flex-1 bg-teal-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createFreeGroup.isPending ? "Creating..." : "Create Group"}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      );
    }
    case "text":
      return (
        <div className="px-4 sm:px-8 py-4 sm:py-6" style={{ backgroundColor: d.bgColor || "#ffffff", color: d.textColor || "#1a1a1a", textAlign: d.align || "left" }}>
          <div className="max-w-3xl mx-auto prose prose-lg" dangerouslySetInnerHTML={{ __html: d.html || "" }} />
        </div>
      );
    case "image": {
      const imgAlignSL = d.align ?? "center";
      const imgJustifySL = imgAlignSL === "left" ? "flex-start" : imgAlignSL === "right" ? "flex-end" : "center";
      const mwSL = d.maxWidth ?? "auto";
      const imgStyleSL: React.CSSProperties = { maxWidth: mwSL === "auto" ? "100%" : mwSL, width: mwSL === "auto" ? undefined : "100%", height: d.height || "auto", objectFit: "cover", borderRadius: d.borderRadius ? `${d.borderRadius}px` : "0.5rem", border: d.noBorder ? "none" : (d.borderWidth ? `${d.borderWidth}px ${d.borderStyle || "solid"} ${d.borderColor || "#e5e7eb"}` : undefined) };
      const imgElSL = d.url ? <img src={d.url} alt={d.alt ?? ""} className={d.showShadow !== false ? "shadow-md" : ""} style={imgStyleSL} /> : null;
      return imgElSL ? (
        <div className="px-4 sm:px-8 py-4 sm:py-6" style={{ display: "flex", flexDirection: "column", alignItems: imgJustifySL }}>
          <ImageLinkWrapper d={d}>{imgElSL}</ImageLinkWrapper>
          {d.caption && <p className="text-sm text-gray-500 mt-2" style={{ textAlign: imgAlignSL as any }}>{d.caption}</p>}
        </div>
      ) : null;
    }
    case "video":
      if (!d.embedUrl) return null;
      const isDirectVidSL = /\.(mp4|webm|ogg|mov)([?#]|$)/i.test(d.embedUrl);
      return (
        <div className="px-4 sm:px-8 py-4 sm:py-6">
          <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg">
            {isDirectVidSL ? (
              <video
                src={d.embedUrl}
                autoPlay={d.autoplay ?? false}
                muted={d.muted ?? true}
                loop={d.loop ?? false}
                controls={d.controls ?? true}
                playsInline
                className="w-full"
              />
            ) : (
              <div className="aspect-video">
                <iframe
                  src={d.autoplay ? `${d.embedUrl}${d.embedUrl.includes('?') ? '&' : '?'}autoplay=1${d.muted !== false ? '&mute=1' : ''}${d.loop ? '&loop=1' : ''}` : d.embedUrl}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; fullscreen"
                />
              </div>
            )}
          </div>
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
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
    case "bullets":
      return (
        <div className="py-8 sm:py-10" style={{ backgroundColor: d.bgColor || "#f8fffe" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
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
        <div className="py-4 sm:py-6">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center text-gray-400 text-sm">
            Block type: {block.type}
          </div>
        </div>
      );
  }
}
