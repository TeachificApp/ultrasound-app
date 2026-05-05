/**
 * MyDownloads.tsx
 * Page where logged-in users can see all their purchased digital products
 * and quickly access files — /my-downloads
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, FileDown, Package, ArrowRight, Lock } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function MyDownloads() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: purchases, isLoading } = trpc.downloadsLearner.myPurchases.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Not logged in
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Lock className="w-12 h-12 mx-auto text-teal-600 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-6">Please sign in to access your downloaded products.</p>
            <a href={getLoginUrl("/my-downloads")}>
              <Button className="w-full bg-teal-600 hover:bg-teal-700">Sign In</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Downloads</h1>
            <p className="text-gray-600 mt-1">Access your purchased digital products and files.</p>
          </div>
          <Link href="/downloads">
            <Button variant="outline" size="sm">
              <Package className="w-4 h-4 mr-1" /> Browse More
            </Button>
          </Link>
        </div>

        {/* Empty state */}
        {(!purchases || purchases.length === 0) ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <FileDown className="w-14 h-14 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Downloads Yet</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                You haven't purchased any digital products yet. Browse our collection to find resources for your practice.
              </p>
              <Link href="/downloads">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  <Package className="w-4 h-4 mr-2" /> Browse Downloads
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {purchases.map((purchase) => (
              <Card key={purchase.purchaseId} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    {purchase.thumbnailUrl ? (
                      <img
                        src={purchase.thumbnailUrl}
                        alt={purchase.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 border border-teal-100">
                        <FileDown className="w-7 h-7 text-teal-600" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{purchase.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs text-teal-700 border-teal-200 bg-teal-50">
                          Purchased
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {new Date(purchase.purchasedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <Link href={`/downloads/${purchase.slug}/files`}>
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700 flex-shrink-0">
                        <Download className="w-4 h-4 mr-1" /> Access Files
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
