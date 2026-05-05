/**
 * DownloadLanding.tsx
 * Public landing/sales page for a single digital product — /downloads/:slug
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FileDown, Check, ShoppingCart, Download, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function DownloadLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { data: product, isLoading, error } = trpc.downloads.getBySlug.useQuery({ slug: slug! });

  // Check if user has purchased (only if logged in and product loaded)
  const { data: purchaseStatus } = trpc.downloadsLearner.hasPurchased.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: !!user && !!product }
  );

  const checkoutMut = trpc.downloadsLearner.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.free || data.alreadyPurchased) {
        window.location.href = `/downloads/${slug}/files?success=1`;
      } else if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.info("Redirecting to checkout...");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileDown className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h2 className="text-xl font-semibold text-gray-700">Product Not Found</h2>
          <p className="text-gray-500 mt-1">This download may have been removed or is not yet available.</p>
          <Link href="/downloads"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1" /> Browse Downloads</Button></Link>
        </div>
      </div>
    );
  }

  const price = product.isFree ? "Free" : `$${(product.price / 100).toFixed(2)}`;
  const hasPurchased = purchaseStatus?.purchased || product.isFree;
  const features = product.landingFeatures ? product.landingFeatures.split("\n").filter(Boolean) : [];

  const handleBuy = () => {
    if (!user) {
      window.location.href = getLoginUrl(`/downloads/${slug}`);
      return;
    }
    checkoutMut.mutate({ productId: product.id });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          <Link href="/downloads" className="text-teal-200 hover:text-white text-sm inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="w-3 h-3" /> All Downloads
          </Link>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                {product.landingHeadline || product.title}
              </h1>
              {product.subtitle && <p className="text-teal-100 text-lg mt-3">{product.subtitle}</p>}
              <div className="flex items-center gap-3 mt-6">
                <span className="text-3xl font-bold">{price}</span>
                {product.isFree && <Badge className="bg-green-500 text-white">Free</Badge>}
              </div>
              <div className="mt-6">
                {hasPurchased ? (
                  <Link href={`/downloads/${slug}/files`}>
                    <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50">
                      <Download className="w-5 h-5 mr-2" /> Access Your Files
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50" onClick={handleBuy} disabled={checkoutMut.isPending}>
                    <ShoppingCart className="w-5 h-5 mr-2" /> {checkoutMut.isPending ? "Processing..." : product.isFree ? "Get It Free" : `Buy Now — ${price}`}
                  </Button>
                )}
              </div>
            </div>
            {product.thumbnailUrl && (
              <div className="w-full md:w-64 flex-shrink-0">
                <img src={product.thumbnailUrl} alt={product.title} className="rounded-xl shadow-2xl w-full" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="md:col-span-2 space-y-8">
            {product.landingBody && (
              <div className="prose prose-gray max-w-none">
                <div dangerouslySetInnerHTML={{ __html: product.landingBody.replace(/\n/g, "<br/>") }} />
              </div>
            )}

            {product.description && !product.landingBody && (
              <div className="prose prose-gray max-w-none">
                <div dangerouslySetInnerHTML={{ __html: product.description.replace(/\n/g, "<br/>") }} />
              </div>
            )}

            {/* Features */}
            {features.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">What's Included</h3>
                  <ul className="space-y-3">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Files preview */}
            {product.files && product.files.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Files You'll Receive ({product.files.length})</h3>
                  <div className="space-y-2">
                    {product.files.map((f: any) => (
                      <div key={f.id} className="flex items-center gap-3 p-2 rounded bg-gray-50 border">
                        <FileDown className="w-4 h-4 text-teal-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700">{f.fileName}</span>
                        {f.fileSize > 0 && (
                          <span className="text-xs text-gray-400 ml-auto">
                            {f.fileSize < 1024 * 1024 ? `${(f.fileSize / 1024).toFixed(0)} KB` : `${(f.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-teal-700 mb-2">{price}</div>
                {hasPurchased ? (
                  <Link href={`/downloads/${slug}/files`}>
                    <Button className="w-full" size="lg">
                      <Download className="w-4 h-4 mr-2" /> Access Files
                    </Button>
                  </Link>
                ) : (
                  <Button className="w-full" size="lg" onClick={handleBuy} disabled={checkoutMut.isPending}>
                    {checkoutMut.isPending ? "Processing..." : product.isFree ? "Get It Free" : "Buy Now"}
                  </Button>
                )}
                <p className="text-xs text-gray-400 mt-3">Instant digital delivery</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
