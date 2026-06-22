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
import { useEffect, useMemo } from "react";
import { BlockPreview } from "@/components/BlockPreview";
import IncludedItemsBlock from "@/components/IncludedItemsBlock";
import { RelatedProductsBlock } from "@/components/RelatedProductsBlock";

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

export default function BundleLanding() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const { user, loading: authLoading } = useAuth();

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

  // Handle success/cancelled query params
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("success") === "1") {
      toast.success("Payment successful! Your access has been granted.");
      refetch();
    } else if (params.get("cancelled") === "1") {
      toast.info("Checkout was cancelled.");
    }
  }, []);

  const pricingOptions = useMemo(() => {
    if (!data?.bundle?.pricingOptions) return [];
    try { return JSON.parse(data.bundle.pricingOptions); } catch { return []; }
  }, [data?.bundle?.pricingOptions]);

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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h2 className="text-xl font-semibold text-gray-700">Bundle Not Found</h2>
          <Link href="/education">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Browse Education Library
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { bundle, items, isEnrolled } = data;
  const landingBlocks = useMemo(() => {
    if (!bundle.landingPageBlocks) return [];
    try { return JSON.parse(bundle.landingPageBlocks) as any[]; } catch { return []; }
  }, [bundle.landingPageBlocks]);
  const itemCount = items.length;

  return (
    <div className="min-h-screen bg-gray-50">
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
                  <span className="text-2xl font-bold">${Number(opt.price).toFixed(2)}</span>
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
              <Link href="/my-courses">
                <Button size="lg" className="bg-teal-500 hover:bg-teal-600 gap-2">
                  <Check className="w-5 h-5" /> Already Enrolled — View Content
                </Button>
              </Link>
            ) : user ? (
              <>
                {pricingOptions.length > 0 ? (
                  pricingOptions.map((opt: any, i: number) => (
                    <Button
                      key={opt.id || i}
                      size="lg"
                      className={i === 0 ? "bg-teal-500 hover:bg-teal-600 gap-2" : "bg-white/10 hover:bg-white/20 gap-2 border border-teal-400/50"}
                      onClick={() => checkoutMut.mutate({ bundleId: bundle.id, pricingOptionId: opt.id })}
                      disabled={checkoutMut.isPending}
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {checkoutMut.isPending ? "Processing..." : (
                        opt.type === "subscription"
                          ? `Subscribe — $${Number(opt.price).toFixed(2)}/${opt.interval || "mo"}`
                          : `${opt.label || "Buy Now"} — $${Number(opt.price).toFixed(2)}`
                      )}
                    </Button>
                  ))
                ) : (
                  <Button
                    size="lg"
                    className="bg-teal-500 hover:bg-teal-600 gap-2"
                    onClick={() => checkoutMut.mutate({ bundleId: bundle.id })}
                    disabled={checkoutMut.isPending}
                  >
                    {bundle.accessType === "free" ? (
                      <><Check className="w-5 h-5" /> {checkoutMut.isPending ? "Enrolling..." : "Enroll for Free"}</>
                    ) : (
                      <><ShoppingCart className="w-5 h-5" /> {checkoutMut.isPending ? "Processing..." : "Get Access"}</>
                    )}
                  </Button>
                )}
              </>
            ) : (
              <a href={getLoginUrl(`/bundles/${slug}`)}>
                <Button size="lg" className="bg-teal-500 hover:bg-teal-600 gap-2">
                  Sign In to {bundle.accessType === "free" ? "Enroll" : "Purchase"}
                </Button>
              </a>
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

      {/* Page builder blocks (if configured) — otherwise fall back to default included items layout */}
      {landingBlocks.length > 0 ? (
        <div>
          {landingBlocks.map((block: any) => {
            if (block.type === "included_items_auto") {
              return <IncludedItemsBlock key={block.id} data={block.data ?? {}} items={items as any[]} />;
            }
            if (block.type === "related_products") {
              return <RelatedProductsBlock key={block.id} data={block.data ?? {}} currentType={undefined} />;
            }
            return <BlockPreview key={block.id} block={block} />;
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
  );
}
