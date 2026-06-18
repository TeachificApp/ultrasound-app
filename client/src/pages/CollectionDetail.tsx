/**
 * CollectionDetail.tsx
 * Shows all items in a specific collection — /collections/:id
 * Supports: courses, quizzes, downloads, physical products, webinars, bundles, memberships
 */
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BookOpen,
  Download,
  HelpCircle,
  Video,
  Package,
  Layers,
  Users,
  ShoppingBag,
} from "lucide-react";
import { CourseInstanceInfo } from "@/components/CourseInstanceInfo";

// ─── Type helpers ──────────────────────────────────────────────────────────────

type ItemType = "course" | "quiz" | "download" | "physical" | "webinar" | "bundle" | "membership" | "workshop" | "cohort";

function getItemMeta(item: any): { icon: React.ReactNode; label: string; href: string; cta: string } {
  const type: ItemType = item._itemType ?? item.type ?? "course";
  switch (type) {
    case "quiz":
      return { icon: <HelpCircle className="w-4 h-4" />, label: "Quiz", href: `/courses/${item.slug}`, cta: "Take Quiz" };
    case "download":
      return { icon: <Download className="w-4 h-4" />, label: "Download", href: `/downloads/${item.slug}`, cta: "Get Download" };
    case "physical":
      return { icon: <ShoppingBag className="w-4 h-4" />, label: "Product", href: `/product/${item.slug}`, cta: "View Product" };
    case "webinar":
      return { icon: <Video className="w-4 h-4" />, label: "Webinar", href: `/webinar/${item.slug}`, cta: "View Webinar" };
    case "bundle":
      return { icon: <Layers className="w-4 h-4" />, label: "Bundle", href: `/bundle/${item.slug}`, cta: "View Bundle" };
    case "membership":
      return { icon: <Users className="w-4 h-4" />, label: "Membership", href: `/membership/${item.slug}`, cta: "View Membership" };
    case "workshop":
      return { icon: <BookOpen className="w-4 h-4" />, label: "Workshop", href: `/workshops/${item.slug}`, cta: "View Workshop" };
    case "cohort":
      return { icon: <Users className="w-4 h-4" />, label: "Cohort", href: `/courses/${item.slug}`, cta: "View Cohort" };
    default:
      return { icon: <BookOpen className="w-4 h-4" />, label: "Course", href: `/courses/${item.slug}`, cta: "View Course" };
  }
}

function formatPrice(item: any): string {
  if (item.isFree || item.price === 0) return "Free";
  const subscriptionSuffix =
    item.pricingType === "subscription"
      ? item.subscriptionInterval === "annual"
        ? "/yr"
        : item.subscriptionInterval === "quarterly"
        ? "/qtr"
        : "/mo"
      : item.pricingType === "payment_plan"
      ? " (plan)"
      : "";
  // Workshops store price in cents; all other types store in dollars
  const itemType = item._itemType ?? item.type ?? "course";
  const displayPrice = itemType === "workshop" ? Number(item.price) / 100 : Number(item.price);
  return `$${displayPrice.toFixed(2)}${subscriptionSuffix}`;
}

// ─── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({ item }: { item: any }) {
  const itemType: ItemType = item._itemType ?? item.type ?? "course";
  const { icon, label, href, cta } = getItemMeta(item);
  const price = formatPrice(item);

  return (
    <Link href={href}>
      <div className="group bg-white rounded-xl border border-gray-200 hover:border-teal-400 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer flex flex-col h-full">
        {/* Thumbnail */}
        <div className="relative h-44 bg-gradient-to-br from-teal-50 to-teal-100 overflow-hidden">
          {item.coverImageUrl ? (
            <img
              src={item.coverImageUrl}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-teal-300 w-12 h-12">{icon}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1 group-hover:text-teal-700 transition-colors">
            {item.title}
          </h3>
          {item.subtitle && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.subtitle}</p>
          )}

          {/* Workshop / Cohort date + venue info */}
          {(itemType === "workshop" || itemType === "cohort") && (
            <div className="mb-3">
              <CourseInstanceInfo
                type={itemType as "workshop" | "cohort"}
                nextInstance={item.nextInstance}
                primaryCohortGroup={item.primaryCohortGroup}
              />
            </div>
          )}

          {/* Price + CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
            <span className="text-sm font-bold text-teal-700">{price}</span>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-teal-300 text-teal-700 hover:bg-teal-50"
            >
              {cta}
            </Button>
          </div>

          {/* Type badge */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge
              variant="secondary"
              className="bg-teal-50 text-teal-700 text-xs font-medium flex items-center gap-1"
            >
              {icon} {label}
            </Badge>
            {item.isFree && (
              <Badge className="bg-green-500 text-white text-xs">Free</Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const collectionId = parseInt(id ?? "0", 10);
  const { data: collection, isLoading } = trpc.lms.getCollection.useQuery(
    { id: collectionId },
    { enabled: !isNaN(collectionId) && collectionId > 0 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="teal-header py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <Skeleton className="h-8 w-64 bg-white/20 mb-2" />
            <Skeleton className="h-4 w-96 bg-white/20" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <Skeleton className="h-44 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <div className="flex justify-between pt-3">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-7 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-700">Collection not found</h2>
          <Link href="/education-library">
            <Button variant="outline" className="mt-4">Back to Education Library</Button>
          </Link>
        </div>
      </div>
    );
  }

  const items = collection.courses ?? [];
  const itemCount = items.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div
        className="py-12 px-4 relative"
        style={
          collection.coverImageUrl
            ? {
                backgroundImage: `url(${collection.coverImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background: `linear-gradient(135deg, ${collection.color ?? "#189aa1"} 0%, #0e4a50 100%)`,
              }
        }
      >
        {/* Dark overlay for readability when using a photo */}
        {collection.coverImageUrl && (
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 100%)" }}
          />
        )}
        <div className="max-w-5xl mx-auto relative z-10">
          <Link href="/education-library">
            <button className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Education Library
            </button>
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {collection.title.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-white">{collection.title}</h1>
                {collection.label && (
                  <Badge className="bg-white/20 text-white border-white/30 text-xs">
                    {collection.label}
                  </Badge>
                )}
              </div>
              {collection.description && (
                <p className="text-white/80 text-sm max-w-xl">{collection.description}</p>
              )}
              <p className="text-white/60 text-xs mt-2">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {itemCount === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No items in this collection yet</p>
            <p className="text-sm mt-1">Check back soon or browse the full library</p>
            <Link href="/education-library">
              <Button variant="outline" className="mt-4">Browse All Courses</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((item: any) => (
              <ItemCard key={`${item._itemType ?? item.type}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
