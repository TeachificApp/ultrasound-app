/**
 * DownloadsBrowse.tsx
 * Public browse page for digital download products — /downloads
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, Search } from "lucide-react";

function ProductCard({ product }: { product: any }) {
  const price = product.isFree ? "Free" : `$${(product.price / 100).toFixed(2)}`;
  return (
    <Link href={`/downloads/${product.slug}`}>
      <div className="group bg-white rounded-xl border border-gray-200 hover:border-teal-400 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer flex flex-col h-full">
        <div className="relative h-44 bg-gradient-to-br from-teal-50 to-cyan-50 overflow-hidden">
          {product.thumbnailUrl ? (
            <img src={product.thumbnailUrl} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileDown className="w-12 h-12 text-teal-300" />
            </div>
          )}
          {product.isFree && (
            <Badge className="absolute top-3 left-3 bg-green-500 text-white text-xs">Free</Badge>
          )}
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors line-clamp-2">{product.title}</h3>
          {product.subtitle && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.subtitle}</p>}
          <div className="mt-auto pt-3 flex items-center justify-between">
            <span className="font-bold text-teal-700">{price}</span>
            <Badge variant="outline" className="text-xs text-gray-500">Digital Download</Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DownloadsBrowse() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = trpc.downloads.list.useQuery({ search: search || undefined, limit: 50 });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-600 to-cyan-600 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold">Digital Downloads</h1>
          <p className="text-teal-100 mt-2 text-lg">Printable resources, reference guides, and clinical tools for ultrasound professionals.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-10 bg-white"
            placeholder="Search downloads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : data?.products && data.products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <FileDown className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{search ? "No products match your search." : "No digital downloads available yet."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
