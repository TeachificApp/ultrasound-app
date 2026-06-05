/**
 * ProductsListing.tsx
 * Public products listing page — /products
 * Shows all published physical products with links to their individual landing pages.
 */
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Package, ShoppingCart, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function ProductsListing() {
  const { data, isLoading } = trpc.products.list.useQuery({ page: 1, limit: 50 });
  const products = data?.products ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-700 to-teal-900">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">Our Products</h1>
          <p className="text-teal-200 text-lg max-w-xl mx-auto">
            Professional ultrasound education resources to advance your clinical skills.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-lg">
                <Skeleton className="h-48 w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-teal-300 mx-auto mb-4 opacity-60" />
            <p className="text-teal-200 text-lg">No products available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(product => (
              <Link key={product.id} href={`/product/${product.slug}`}>
                <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1 cursor-pointer group h-full flex flex-col">
                  {product.thumbnailUrl ? (
                    <div className="relative h-52 overflow-hidden bg-gray-100">
                      <img
                        src={product.thumbnailUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="h-52 bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center">
                      <Package className="w-16 h-16 text-teal-400" />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <h2 className="text-gray-900 font-semibold text-lg leading-snug mb-2 group-hover:text-teal-700 transition-colors">
                      {product.title}
                    </h2>
                    {product.subtitle && (
                      <p className="text-gray-500 text-sm mb-3 line-clamp-2">{product.subtitle}</p>
                    )}
                    <div className="mt-auto pt-3 flex items-center justify-between">
                      <div>
                        {product.isFree ? (
                          <Badge className="bg-teal-100 text-teal-700 border-teal-200">Free</Badge>
                        ) : (
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900">
                              ${Number(product.price).toFixed(2)}
                            </span>
                            {product.compareAtPrice && (
                              <span className="text-sm text-gray-400 line-through">
                                ${Number(product.compareAtPrice).toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-teal-600 font-medium text-sm group-hover:gap-2 transition-all">
                        <ShoppingCart className="w-4 h-4" />
                        <span>View</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
