/**
 * RelatedProductsBlock.tsx
 * Public-facing cross-sell block that auto-fetches published courses and/or downloads,
 * or renders a manually curated list of products.
 *
 * Card layout rules:
 *  - All cards are the same height (flex-col, fixed thumbnail, flex-1 content area)
 *  - Course name: max 2 lines (line-clamp-2), never pushes card taller
 *  - Description: max 2 lines (line-clamp-2), never pushes card taller
 *  - Price + CTA button always on the same row, pinned to the bottom of the card
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, FileDown, Package, ExternalLink } from "lucide-react";
import { CourseInstanceInfo } from "@/components/CourseInstanceInfo";
import {
  pickManualRelatedProducts,
  resolveRelatedProductsSelectionMode,
  type RelatedProductFeedItem,
  type RelatedProductManualRef,
} from "@shared/relatedProductsBlock";

interface RelatedProductsBlockData {
  headline?: string;
  subtext?: string;
  productType?: "course" | "cohort" | "quiz" | "download" | "both" | "bundle" | "physical" | "all" | "webinar" | "community" | "workshop" | "app";
  selectionMode?: "auto" | "manual";
  manualItems?: RelatedProductManualRef[];
  maxItems?: number;
  layout?: "grid" | "list";
  showPrice?: boolean;
  showDescription?: boolean;
  ctaText?: string;
  bgColor?: string;
  cardBgColor?: string;
  accentColor?: string;
  textColor?: string;
  excludeCurrentSlug?: boolean;
}

interface Props {
  data: RelatedProductsBlockData;
  currentSlug?: string;
  currentType?: "course" | "download";
}

const INTERVAL_LABEL: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr" };
function formatPrice(price: number, isFree: boolean, pricingType?: string | null, subscriptionInterval?: string | null): string {
  if (isFree || price === 0) return "Free";
  if (price === -1) return "Subscription";
  const base = `$${Number(price).toFixed(2)}`;
  if (pricingType === "subscription") return base + (INTERVAL_LABEL[subscriptionInterval ?? "monthly"] ?? "/mo");
  if (pricingType === "payment_plan") return base + " (plan)";
  return base;
}

type ProductItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  isFree: boolean;
  imageUrl: string;
  type: string;
  href: string;
  pricingType?: string | null;
  subscriptionInterval?: string | null;
  appLabel?: string;
  nextInstance?: { startDate?: Date | string | null; endDate?: Date | string | null; locationType?: string | null; venueName?: string | null; venueCity?: string | null; venueState?: string | null } | null;
  primaryCohortGroup?: { name?: string | null; startDate?: Date | string | null; endDate?: Date | string | null } | null;
};

function toProductItem(p: RelatedProductFeedItem): ProductItem {
  return {
    id: `${p.type}-${p.id}`,
    slug: p.slug,
    title: p.title,
    description: p.description ?? "",
    price: p.price,
    isFree: p.isFree ?? false,
    imageUrl: p.imageUrl ?? "",
    type: p.type,
    href: p.href,
    pricingType: p.pricingType ?? null,
    subscriptionInterval: p.subscriptionInterval ?? null,
    appLabel: p.appLabel,
    nextInstance: (p as any).nextInstance ?? null,
    primaryCohortGroup: (p as any).primaryCohortGroup ?? null,
  };
}

export function RelatedProductsBlock({ data, currentSlug, currentType }: Props) {
  const d = data;
  const selectionMode = resolveRelatedProductsSelectionMode(d);
  const productType = d.productType ?? "both";
  const maxItems = Math.max(1, Math.min(12, Number(d.maxItems ?? 3) || 3));
  const layout = d.layout ?? "grid";
  const accent = d.accentColor ?? "#179ca3";
  const textColor = d.textColor ?? "#111827";
  const cardBg = d.cardBgColor ?? "#ffffff";
  const manualRefs = d.manualItems ?? [];

  // ── AUTO mode queries ──────────────────────────────────────────────────────
  const needsCourses =
    selectionMode === "auto" &&
    (productType === "course" || productType === "cohort" || productType === "quiz" || productType === "both" || productType === "all");
  const needsDownloads =
    selectionMode === "auto" &&
    (productType === "download" || productType === "both" || productType === "all");

  const { data: coursesData, isLoading: coursesLoading } = trpc.lms.listCourses.useQuery(
    { pageSize: maxItems + 4 },
    { enabled: needsCourses }
  );
  const { data: downloadsData, isLoading: downloadsLoading } = trpc.downloads.list.useQuery(
    { limit: maxItems + 4 },
    { enabled: needsDownloads }
  );

  // ── MANUAL mode query ──────────────────────────────────────────────────────
  const { data: manualData, isLoading: manualLoading } = trpc.funnel.getProductsByIds.useQuery(
    { items: manualRefs },
    { enabled: selectionMode === "manual" && manualRefs.length > 0 }
  );

  const isLoading =
    selectionMode === "manual"
      ? manualLoading
      : coursesLoading || downloadsLoading;

  // ── Build items list ───────────────────────────────────────────────────────
  let items: ProductItem[] = [];

  if (selectionMode === "manual") {
    items = pickManualRelatedProducts(manualRefs, manualData ?? [], maxItems).map(toProductItem);
  } else {
    const courseItems: ProductItem[] = (coursesData?.courses ?? []).filter((c) => (c as any).type !== "quiz").map((c) => ({
      id: `course-${c.id}`,
      slug: c.slug,
      title: c.title,
      description: c.subtitle ?? c.description ?? "",
      price: c.price,
      isFree: c.isFree,
      imageUrl: (c as any).coverImageUrl ?? (c as any).thumbnailUrl ?? "",
      type: "course" as const,
      href: `/courses/${c.slug}`,
      pricingType: (c as any).pricingType ?? null,
      subscriptionInterval: (c as any).subscriptionInterval ?? null,
    }));

    const downloadItems: ProductItem[] = (downloadsData?.products ?? []).map((p) => ({
      id: `download-${p.id}`,
      slug: p.slug,
      title: p.title,
      description: p.subtitle ?? p.description ?? "",
      price: p.price,
      isFree: p.isFree,
      imageUrl: p.thumbnailUrl ?? "",
      type: "download" as const,
      href: `/downloads/${p.slug}`,
    }));

    // For auto mode: filter by productType
    if (productType === "course" || productType === "cohort" || productType === "quiz") items = courseItems;
    else if (productType === "download") items = downloadItems;
    else items = [...courseItems, ...downloadItems];
    // Note: webinar/community/workshop/app in auto mode fall through to manual mode;
    // use Manual Pick selection mode for those types.

    // Exclude current product
    if (d.excludeCurrentSlug !== false && currentSlug) {
      items = items.filter(
        (item) => !(item.slug === currentSlug && item.type === currentType)
      );
    }

    // Shuffle and limit
    items = items.sort(() => Math.random() - 0.5).slice(0, maxItems);
  }

  const colCount = Math.min(items.length || maxItems, 3);

  return (
    <section style={{ backgroundColor: d.bgColor ?? "#f9fafb" }} className="py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {d.headline && (
          <h2
            className="text-2xl md:text-3xl font-bold text-center mb-2"
            style={{ color: textColor }}
            dangerouslySetInnerHTML={{ __html: d.headline }}
          />
        )}
        {d.subtext && (
          <p className="text-center text-sm md:text-base mb-8 opacity-70" style={{ color: textColor }}>
            {d.subtext}
          </p>
        )}

        {isLoading ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
            {Array.from({ length: maxItems }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-gray-200" style={{ backgroundColor: cardBg }}>
                <Skeleton className="h-36 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex items-center justify-between mt-4 pt-2 border-t border-gray-100">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? null : layout === "grid" ? (
          <div
            className="grid gap-5 items-stretch"
            style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
          >
            {items.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                accent={accent}
                textColor={textColor}
                cardBg={cardBg}
                showPrice={d.showPrice ?? true}
                showDescription={d.showDescription ?? true}
                ctaText={d.ctaText ?? "Learn More"}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <ProductListRow
                key={item.id}
                item={item}
                accent={accent}
                textColor={textColor}
                cardBg={cardBg}
                showPrice={d.showPrice ?? true}
                showDescription={d.showDescription ?? true}
                ctaText={d.ctaText ?? "Learn More"}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────────────
// Layout: fixed thumbnail → flex-1 body (type badge + 2-line title + 2-line desc + spacer) → pinned footer (price + button)

interface CardProps {
  item: ProductItem;
  accent: string;
  textColor: string;
  cardBg: string;
  showPrice: boolean;
  showDescription: boolean;
  ctaText: string;
}

function typeInfo(type: string) {
  switch (type) {
    case "course":    return { Icon: BookOpen,  label: "Course" };
    case "cohort":    return { Icon: BookOpen,  label: "Cohort" };
    case "quiz":      return { Icon: BookOpen,  label: "Quiz" };
    case "download":  return { Icon: FileDown,  label: "Digital Download" };
    case "bundle":    return { Icon: Package,   label: "Bundle" };
    case "physical":  return { Icon: Package,   label: "Physical" };
    case "webinar":   return { Icon: ExternalLink, label: "Webinar" };
    case "community": return { Icon: Package,   label: "Community" };
    case "workshop":  return { Icon: BookOpen,  label: "Workshop" };
    case "app":       return { Icon: ExternalLink, label: "App" };
    default:          return { Icon: Package,   label: type };
  }
}

function ProductCard({ item, accent, textColor, cardBg, showPrice, showDescription, ctaText }: CardProps) {
  const { Icon, label } = typeInfo(item.type);

  return (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow h-full"
      style={{ backgroundColor: cardBg }}
    >
      {/* Fixed-height thumbnail — never grows */}
      <div className="h-36 flex-shrink-0 overflow-hidden relative">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
            <Icon size={36} style={{ color: accent, opacity: 0.6 }} />
          </div>
        )}
        {/* App name overlay */}
        {item.type === "app" && item.appLabel && (
          <div className="absolute inset-0 flex items-end justify-start p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
            <span className="text-white font-bold text-sm leading-tight drop-shadow-md">{item.appLabel}</span>
          </div>
        )}
      </div>

      {/* Body — grows to fill remaining space */}
      <div className="p-4 flex flex-col flex-1">
        {/* Type badge */}
        <span
          className="text-[10px] font-semibold uppercase tracking-widest mb-1 flex items-center gap-1 flex-shrink-0"
          style={{ color: accent }}
        >
          <Icon size={10} /> {label}
        </span>

        {/* Title — max 2 lines, never overflows */}
        <h3
          className="font-bold text-sm leading-snug mb-1 line-clamp-2 flex-shrink-0"
          style={{ color: textColor }}
        >
          {item.title}
        </h3>

        {/* Description — max 2 lines, grows to fill space */}
        {showDescription && item.description ? (
          <p className="text-xs text-gray-500 line-clamp-2 flex-1 min-h-0">
            {item.description.replace(/<[^>]+>/g, "").slice(0, 160)}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        {/* Instance / cohort info */}
        {(item.type === "workshop" || item.type === "cohort") && (
          <div className="mt-2 flex-shrink-0">
            <CourseInstanceInfo
              type={item.type as "workshop" | "cohort"}
              nextInstance={item.nextInstance}
              primaryCohortGroup={item.primaryCohortGroup}
              accentColor={accent}
              compact
            />
          </div>
        )}

        {/* Footer — free badge + button always on same row, pinned to bottom */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 flex-shrink-0">
          {item.isFree ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Free</span>
          ) : (
            <span />
          )}
          <Link href={item.href}>
            <button
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0"
              style={{ backgroundColor: accent }}
            >
              {ctaText} <ExternalLink size={10} />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ProductListRow({ item, accent, textColor, cardBg, showPrice, showDescription, ctaText }: CardProps) {
  const { Icon, label } = typeInfo(item.type);

  return (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden flex gap-4 p-4 shadow-sm hover:shadow-md transition-shadow items-center"
      style={{ backgroundColor: cardBg }}
    >
      {/* Fixed thumbnail */}
      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden relative">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
            <Icon size={24} style={{ color: accent, opacity: 0.6 }} />
          </div>
        )}
        {item.type === "app" && item.appLabel && (
          <div className="absolute inset-0 flex items-end justify-start p-1 bg-gradient-to-t from-black/70 via-black/20 to-transparent rounded-lg">
            <span className="text-white font-bold text-[9px] leading-tight drop-shadow-md">{item.appLabel}</span>
          </div>
        )}
      </div>

      {/* Content — grows, truncated */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1 mb-0.5" style={{ color: accent }}>
          <Icon size={10} /> {label}
        </span>
        <h3 className="font-bold text-sm leading-snug line-clamp-2" style={{ color: textColor }}>
          {item.title}
        </h3>
        {showDescription && item.description && (
          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
            {item.description.replace(/<[^>]+>/g, "").slice(0, 120)}
          </p>
        )}
        {(item.type === "workshop" || item.type === "cohort") && (
          <div className="mt-1">
            <CourseInstanceInfo
              type={item.type as "workshop" | "cohort"}
              nextInstance={item.nextInstance}
              primaryCohortGroup={item.primaryCohortGroup}
              accentColor={accent}
              compact
            />
          </div>
        )}
      </div>

      {/* Free badge + CTA — same row, right-aligned */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {item.isFree && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Free</span>
        )}
        <Link href={item.href}>
          <button
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 hover:opacity-90 transition-opacity whitespace-nowrap"
            style={{ backgroundColor: accent }}
          >
            {ctaText} <ExternalLink size={10} />
          </button>
        </Link>
      </div>
    </div>
  );
}
