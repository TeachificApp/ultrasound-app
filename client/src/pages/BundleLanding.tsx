/**
 * BundleLanding.tsx — Public bundle sales/landing page
 * Uses the new bundles system (courses, quizzes, downloads, products, webinars)
 */
import { useParams, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Package, Check, ArrowLeft, ShoppingCart, BookOpen,
  FileDown, Radio, HelpCircle, Box, Sparkles, Truck
} from "lucide-react";
import { Link } from "wouter";
import React, { useEffect, useMemo, useState } from "react";
import { useCheckoutClickGuard } from "@/hooks/useCheckoutClickGuard";
import { PURCHASE_ACCESS_LABEL, bundleAccessHref } from "@/lib/accessCta";
import { BlockPreview } from "@/components/BlockPreview";
import IncludedItemsBlock from "@/components/IncludedItemsBlock";
import { RelatedProductsBlock } from "@/components/RelatedProductsBlock";
import { AvailabilityWaitlistDialog } from "@/components/AvailabilityWaitlistDialog";
import { UnavailableContentPage } from "@/components/UnavailableContentPage";
import { formatAuthoredDollars } from "@shared/authoredPriceDisplay";
import { trackMetaPurchaseOnce } from "@/components/MetaPixel";

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-5 h-5 text-teal-600" />,
  quiz: <HelpCircle className="w-5 h-5 text-purple-600" />,
  download: <FileDown className="w-5 h-5 text-blue-600" />,
  product: <Box className="w-5 h-5 text-orange-600" />,
  webinar: <Radio className="w-5 h-5 text-rose-600" />,
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  course: "Course",
  quiz: "Quiz",
  download: "Download",
  product: "Product",
  webinar: "Webinar",
};

export function BundleOptionPrice({ price }: { price: number | string | null | undefined }) {
  return <>{formatAuthoredDollars(price)}</>;
}

/**
 * Dynamic pricing for a bundle's visual landing page. The source of truth stays
 * in Bundle Pricing Options, so pricing, labels, and active options never become
 * stale inside a saved page block.
 */
function BundlePricingOptionsBlock({
  data,
  pricingOptions,
  isEnrolled,
  isWaitlist,
  isClosed,
  isBusy,
  onChoose,
}: {
  data: Record<string, any>;
  pricingOptions: any[];
  isEnrolled: boolean;
  isWaitlist: boolean;
  isClosed: boolean;
  isBusy: boolean;
  onChoose: (pricingOptionId?: string) => void;
}) {
  const accentColor = data.accentColor ?? data.ctaColor ?? "#179ca3";
  const headline = data.headline ?? "Choose Your Bundle Access";
  const subtext = data.subtext ?? "Select the option that works best for you.";
  const getIntervalLabel = (option: any) => {
    const interval = option.subscriptionInterval ?? option.interval;
    if (interval === "quarterly") return "/3 months";
    if (interval === "annual") return "/year";
    if (interval === "monthly") return "/month";
    return option.type === "subscription" || option.pricingType === "subscription" ? "/month" : "";
  };
  const getButtonLabel = (option: any) => {
    if (isEnrolled) return PURCHASE_ACCESS_LABEL;
    if (isWaitlist) return "Join Waitlist";
    if (isClosed) return "Enrollment Closed";
    if (isBusy) return "Processing…";
    return option.ctaLabel || option.label || "Choose This Option";
  };

  if (pricingOptions.length === 0) {
    return (
      <section className="py-10 px-4" style={{ backgroundColor: data.bgColor ?? "#f9fafb" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900">{headline}</h2>
          {subtext && <p className="mt-2 text-gray-600">{subtext}</p>}
          <Button className="mt-6" style={{ backgroundColor: accentColor }} onClick={() => onChoose()} disabled={isClosed || isBusy}>
            {getButtonLabel({})}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 px-4" style={{ backgroundColor: data.bgColor ?? "#f9fafb" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-7">
          <h2 className="text-2xl font-bold text-gray-900">{headline}</h2>
          {subtext && <p className="mt-2 text-gray-600">{subtext}</p>}
        </div>
        <div className={`grid gap-5 ${pricingOptions.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-2"}`}>
          {pricingOptions.map((option, index) => {
            const featured = option.featured === true || index === 0;
            return (
              <article key={option.id ?? index} className="rounded-2xl bg-white p-6 shadow-sm" style={{ border: `2px solid ${featured ? accentColor : "#e5e7eb"}` }}>
                <p className="font-semibold text-gray-900">{option.label || `Option ${index + 1}`}</p>
                {option.sublabel && <p className="mt-1 text-sm text-gray-500">{option.sublabel}</p>}
                <div className="mt-4">
                  <span className="text-3xl font-black" style={{ color: accentColor }}><BundleOptionPrice price={option.price} /></span>
                  <span className="ml-1 text-sm text-gray-500">{getIntervalLabel(option)}</span>
                </div>
                <Button
                  className="mt-6 w-full"
                  variant={featured ? "default" : "outline"}
                  style={featured ? { backgroundColor: accentColor } : { borderColor: accentColor, color: accentColor }}
                  onClick={() => onChoose(option.id != null ? String(option.id) : undefined)}
                  disabled={isClosed || isBusy}
                >
                  {getButtonLabel(option)}
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function BundleLanding() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const { user, loading: authLoading } = useAuth();
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const { data, isLoading, refetch } = trpc.bundles.getBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug }
  );

  const checkoutMut = trpc.bundlesLearner.createCheckout.useMutation({
    onSuccess: (result) => {
      if (result.alreadyEnrolled) {
        toast.info("You already have access to this bundle!");
        refetch();
        return;
      }
      if (result.enrolled) {
        toast.success("You're enrolled! Access your content now.");
        refetch();
        return;
      }
      if (result.checkoutUrl) {
        toast.info("Redirecting to checkout...");
        window.open(result.checkoutUrl, "_blank");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const { runGuarded, isGuarded } = useCheckoutClickGuard();

  const runCheckout = (bundleId: number, pricingOptionId?: string) => {
    if (data?.isEnrolled) {
      window.location.href = bundleAccessHref();
      return;
    }
    if (data?.bundle.status === "waitlist") {
      setWaitlistOpen(true);
      return;
    }
    runGuarded(() => {
      checkoutMut.mutate({ bundleId, pricingOptionId });
    });
  };

  const checkoutBusy = checkoutMut.isPending || isGuarded;

  // Handle success/cancelled query params
  useEffect(() => {
    const params = new URLSearchParams(search);
    const checkoutSessionId = params.get("session_id");
    if (params.get("success") === "1" && checkoutSessionId && data?.isEnrolled) {
      trackMetaPurchaseOnce(checkoutSessionId);
    }
    if (params.get("success") === "1") {
      toast.success("Payment successful! Your access has been granted.");
      refetch();
    } else if (params.get("cancelled") === "1") {
      toast.info("Checkout was cancelled.");
    }
  }, [search, data?.isEnrolled, refetch]);

  const pricingOptions = useMemo(() => {
    if (Array.isArray(data?.pricingOptions)) return data.pricingOptions;
    if (!data?.bundle?.pricingOptions) return [];
    try { return JSON.parse(data.bundle.pricingOptions); } catch { return []; }
  }, [data?.pricingOptions, data?.bundle?.pricingOptions]);
  const landingBlocks = useMemo(() => {
    if (!data?.bundle?.landingPageBlocks) return [];
    try { return JSON.parse(data.bundle.landingPageBlocks) as any[]; } catch { return []; }
  }, [data?.bundle?.landingPageBlocks]);

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data?.bundle) {
    return <UnavailableContentPage kind="bundle" returnHref="/education-library" returnLabel="Browse Education Library" />;
  }

  const { bundle, items, isEnrolled } = data;
  const isWaitlist = bundle.status === "waitlist";
  const isClosed = bundle.status === "enrollment_closed";
  const itemCount = items.length;

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      {landingBlocks.length === 0 && <>
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 text-white py-16">
        <div className="max-w-3xl mx-auto px-4">
          <Link href="/education" className="text-teal-300 hover:text-white text-sm inline-flex items-center gap-1 mb-6">
            <ArrowLeft className="w-3 h-3" /> Education Library
          </Link>

          <div className="flex items-start gap-4">
            {bundle.coverImage ? (
              <img src={bundle.coverImage} alt={bundle.title} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center flex-shrink-0">
                <Package className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30">
                  <Sparkles className="w-3 h-3 mr-1" /> Bundle
                </Badge>
                {bundle.collectShippingAddress && (
                  <Badge className="bg-amber-400/20 text-amber-200 border-amber-400/30">
                    <Truck className="w-3 h-3 mr-1" /> Physical item included
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold">{bundle.title}</h1>
              <p className="text-teal-200 mt-1 text-sm">{itemCount} items included</p>
            </div>
          </div>

          {/* Pricing */}
          {pricingOptions.length > 0 && (
            <div className="mt-8 flex flex-wrap items-end gap-4">
              {pricingOptions.map((opt: any, i: number) => (
                <div key={opt.id || i} className="bg-white/10 rounded-lg px-4 py-2">
                  <span className="text-2xl font-bold"><BundleOptionPrice price={opt.price} /></span>
                  {opt.type === "subscription" && (
                    <span className="text-sm text-teal-200">/{opt.interval || "month"}</span>
                  )}
                  {opt.label && <p className="text-xs text-teal-300 mt-0.5">{opt.label}</p>}
                </div>
              ))}
            </div>
          )}

          {bundle.accessType === "free" && pricingOptions.length === 0 && (
            <div className="mt-8">
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-lg px-4 py-1">Free</Badge>
            </div>
          )}

          {/* CTA */}
          <div className="mt-6 flex flex-wrap gap-3">
            {isEnrolled ? (
              <Link href={bundleAccessHref()}>
                <Button size="lg" className="bg-teal-500 hover:bg-teal-600 gap-2">
                  <Check className="w-5 h-5" /> {PURCHASE_ACCESS_LABEL}
                </Button>
              </Link>
            ) : isWaitlist ? (
              <Button size="lg" className="bg-teal-500 hover:bg-teal-600 gap-2" onClick={() => setWaitlistOpen(true)}>
                <ShoppingCart className="w-5 h-5" /> Join Waitlist
              </Button>
            ) : isClosed ? (
              <Button size="lg" variant="secondary" disabled>Enrollment Closed</Button>
            ) : bundle.accessType === "free" && !user ? (
              // Free bundles require sign-in (no payment to create account through)
              <a href={getLoginUrl(`/bundles/${slug}`)}>
                <Button size="lg" className="bg-teal-500 hover:bg-teal-600 gap-2">
                  Sign In to Enroll
                </Button>
              </a>
            ) : (
              // Paid bundles — guest checkout allowed, no sign-in required
              <>
                {pricingOptions.length > 0 ? (
                  pricingOptions.map((opt: any, i: number) => (
                    <Button
                      key={opt.id || i}
                      size="lg"
                      className={i === 0 ? "bg-teal-500 hover:bg-teal-600 gap-2" : "bg-white/10 hover:bg-white/20 gap-2 border border-teal-400/50"}
                      onClick={() => runCheckout(bundle.id, opt.id)}
                      disabled={checkoutBusy}
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {checkoutBusy ? "Processing..." : (
                        opt.type === "subscription"
                          ? `Subscribe — ${formatAuthoredDollars(opt.price)}/${opt.interval || "mo"}`
                          : `${opt.label || "Buy Now"} — ${formatAuthoredDollars(opt.price)}`
                      )}
                    </Button>
                  ))
                ) : (
                  <Button
                    size="lg"
                    className="bg-teal-500 hover:bg-teal-600 gap-2"
                    onClick={() => runCheckout(bundle.id)}
                    disabled={checkoutBusy}
                  >
                    <><ShoppingCart className="w-5 h-5" /> {checkoutBusy ? "Processing..." : "Get Access"}</>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {bundle.description && (
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-gray-700 whitespace-pre-wrap">{bundle.description}</p>
            </CardContent>
          </Card>
        </div>
      )}
      </>}

      {/* A saved visual page controls the entire public bundle URL. */}
      {landingBlocks.length > 0 ? (
        <div>
          {landingBlocks.map((block: any) => {
            if (block.type === "included_items_auto") {
              return <IncludedItemsBlock key={block.id} data={block.data ?? {}} items={items as any[]} />;
            }
            if (block.type === "pricing_options_auto") {
              return (
                <BundlePricingOptionsBlock
                  key={block.id}
                  data={block.data ?? {}}
                  pricingOptions={pricingOptions}
                  isEnrolled={isEnrolled}
                  isWaitlist={isWaitlist}
                  isClosed={isClosed}
                  isBusy={checkoutBusy}
                  onChoose={(pricingOptionId) => runCheckout(bundle.id, pricingOptionId)}
                />
              );
            }
            if (block.type === "related_products") {
              return <RelatedProductsBlock key={block.id} data={block.data ?? {}} currentType={undefined} />;
            }
            return (
              <BlockPreview
                key={block.id}
                block={block}
                onCheckoutPage={(pricingOptionId?: number) => runCheckout(bundle.id, pricingOptionId != null ? String(pricingOptionId) : undefined)}
              />
            );
          })}
        </div>
      ) : (
        /* Default included items layout — matches membership IncludedItemsBlock style */
        <IncludedItemsBlock
          data={{ title: `What's Included`, subtitle: `${itemCount} item${itemCount !== 1 ? "s" : ""} in this bundle`, ctaText: "Explore", showIncluded: true }}
          items={(items as any[]).map(item => ({
            ...item,
            itemTitle: (item as any).itemTitle ?? null,
            itemSlug: (item as any).itemSlug ?? null,
            itemCoverImage: (item as any).itemCoverImage ?? null,
          }))}
        />
      )}
    </div>
    <AvailabilityWaitlistDialog open={waitlistOpen} onClose={() => setWaitlistOpen(false)} productType="bundle" productId={bundle.id} title={bundle.title} />
    </>
  );
}
