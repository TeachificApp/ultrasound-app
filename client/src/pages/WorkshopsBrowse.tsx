/**
 * WorkshopsBrowse.tsx
 * Public browse page for workshops — /workshops
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Search } from "lucide-react";
import { CourseInstanceInfo } from "@/components/CourseInstanceInfo";

function WorkshopCard({ workshop }: { workshop: any }) {
  const price =
    workshop.isFree || workshop.price === 0
      ? "Free"
      : `$${(workshop.price / 100).toFixed(2)}`;

  return (
    <Link href={`/workshops/${workshop.slug}`}>
      <div className="group bg-white rounded-xl border border-gray-200 hover:border-teal-400 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer flex flex-col h-full">
        <div className="relative h-48 bg-gradient-to-br from-teal-50 to-cyan-50 overflow-hidden">
          {workshop.coverImageUrl || workshop.thumbnailUrl ? (
            <img
              src={workshop.coverImageUrl || workshop.thumbnailUrl}
              alt={workshop.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Briefcase className="w-14 h-14 text-teal-300" />
            </div>
          )}
          {workshop.isFree && (
            <Badge className="absolute top-3 left-3 bg-teal-500 text-white text-xs">
              Free
            </Badge>
          )}
          {workshop.isFeatured && (
            <Badge className="absolute top-3 right-3 bg-amber-500 text-white text-xs">
              Featured
            </Badge>
          )}
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors line-clamp-2 text-base">
            {workshop.title}
          </h3>
          {workshop.subtitle && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{workshop.subtitle}</p>
          )}

          {/* Next instance: date + venue */}
          <div className="mt-3">
            <CourseInstanceInfo
              type="workshop"
              nextInstance={workshop.nextInstance}
            />
          </div>

          <div className="mt-auto pt-4 flex items-center justify-between">
            <span className="font-bold text-teal-700 text-lg">{price}</span>
            <Badge variant="outline" className="text-xs text-gray-500">
              Workshop
            </Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      <Skeleton className="h-48 w-full" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/4 mt-4" />
      </div>
    </div>
  );
}

export default function WorkshopsBrowse() {
  const [search, setSearch] = useState("");

  const { data: workshops, isLoading } = trpc.workshop.list.useQuery({
    limit: 100,
    offset: 0,
  });

  const filtered = (workshops ?? []).filter((w: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.title?.toLowerCase().includes(q) ||
      w.subtitle?.toLowerCase().includes(q) ||
      w.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Hero */}
        <div className="teal-header py-12 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <Briefcase className="w-4 h-4" />
              Hands-On Workshops
            </div>
            <h1 className="text-3xl font-bold mb-2">Ultrasound Workshops</h1>
            <p className="text-teal-100 text-base max-w-2xl mx-auto">
              Immersive, hands-on training experiences led by expert sonographers.
              Build confidence, sharpen your technique, and advance your clinical skills.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-5xl mx-auto px-4 -mt-6">
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <Input
              placeholder="Search workshops…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 text-base"
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 py-10">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                {search ? "No workshops match your search" : "No workshops available yet"}
              </h2>
              <p className="text-gray-500">
                {search
                  ? "Try a different search term."
                  : "Check back soon for upcoming workshops."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {filtered.length} Workshop{filtered.length !== 1 ? "s" : ""} Available
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((w: any) => (
                  <WorkshopCard key={w.id} workshop={w} />
                ))}
              </div>
            </>
          )}
        </div>
    </div>
  );
}
