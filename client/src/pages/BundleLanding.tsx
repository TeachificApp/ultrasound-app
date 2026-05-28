/**
 * BundleLanding.tsx — Public bundle sales page
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Package, Check, ArrowLeft, ShoppingCart, FileDown } from "lucide-react";
import { Link } from "wouter";

export default function BundleLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();

  const { data: bundle, isLoading } = trpc.downloadsLearner.getBundleBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug }
  );

  const { data: purchaseData } = trpc.downloadsLearner.hasPurchasedBundle.useQuery(
    { bundleId: bundle?.id ?? 0 },
    { enabled: !!user && !!bundle }
  );

  const checkoutMut = trpc.downloadsLearner.createBundleCheckout.useMutation({
    onSuccess: (data) => {
      if (data.alreadyPurchased) {
        toast.info("You already own this bundle!");
        return;
      }
      if (data.checkoutUrl) {
        toast.info("Redirecting to checkout...");
        window.open(data.checkoutUrl, "_blank");
      }
    },
    onError: (e) => toast.error(e.message),
  });

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

  if (!bundle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h2 className="text-xl font-semibold text-gray-700">Bundle Not Found</h2>
          <Link href="/downloads"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1" /> Browse Downloads</Button></Link>
        </div>
      </div>
    );
  }

  const hasPurchased = purchaseData?.purchased ?? false;
  const savings = bundle.originalPrice - bundle.discountPrice;
  const savingsPercent = bundle.originalPrice > 0 ? Math.round((savings / bundle.originalPrice) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 text-white py-16">
        <div className="max-w-3xl mx-auto px-4">
          <Link href="/downloads" className="text-teal-300 hover:text-white text-sm inline-flex items-center gap-1 mb-6">
            <ArrowLeft className="w-3 h-3" /> All Downloads
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center flex-shrink-0">
              <Package className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{bundle.title}</h1>
              {bundle.subtitle && <p className="text-teal-200 mt-2 text-lg">{bundle.subtitle}</p>}
            </div>
          </div>

          {/* Pricing */}
          <div className="mt-8 flex items-end gap-4">
            <span className="text-4xl font-bold">${Number(bundle.discountPrice).toFixed(2)}</span>
            {savings > 0 && (
              <>
                <span className="text-xl text-gray-400 line-through">${Number(bundle.originalPrice).toFixed(2)}</span>
                <Badge className="bg-teal-500 text-white text-sm">Save {savingsPercent}%</Badge>
              </>
            )}
          </div>

          {/* CTA */}
          <div className="mt-6">
            {hasPurchased ? (
              <Link href="/my-downloads">
                <Button size="lg" className="bg-teal-500 hover:bg-teal-600 gap-2">
                  <Check className="w-5 h-5" /> Already Purchased — View Downloads
                </Button>
              </Link>
            ) : user ? (
              <Button
                size="lg"
                className="bg-teal-500 hover:bg-teal-600 gap-2"
                onClick={() => checkoutMut.mutate({ bundleId: bundle.id })}
                disabled={checkoutMut.isPending}
              >
                <ShoppingCart className="w-5 h-5" /> {checkoutMut.isPending ? "Processing..." : "Buy Bundle"}
              </Button>
            ) : (
              <a href={getLoginUrl(`/bundles/${slug}`)}>
                <Button size="lg" className="bg-teal-500 hover:bg-teal-600 gap-2">
                  Sign In to Purchase
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

      {/* Included Products */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-4">Included in This Bundle ({bundle.items.length} products)</h2>
        <div className="space-y-3">
          {bundle.items.map((item) => (
            <Card key={item.productId} className="hover:border-teal-400 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                  <FileDown className="w-5 h-5 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/downloads/${item.slug}`} className="font-medium text-gray-900 hover:text-teal-600 truncate block">
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {item.isFree ? "Free" : `$${Number(item.price).toFixed(2)}`}
                  </p>
                </div>
                <Check className="w-5 h-5 text-teal-500" />
              </CardContent>
            </Card>
          ))}
        </div>

        {savings > 0 && (
          <div className="mt-6 bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
            <p className="text-teal-700 font-medium">
              You save ${(savings / 100).toFixed(2)} ({savingsPercent}% off) compared to buying individually
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
