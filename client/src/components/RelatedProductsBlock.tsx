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

interface ManualItem {
  type: string;
  id: number;
}

interface RelatedProductsBlockData {
  headline?: string;
  subtext?: string;
  productType?: "course" | "download" | "both" | "bundle" | "physical" | "all";
  selectionMode?: "auto" | "manual";
  manualItems?: ManualItem[];
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

function formatPrice(price: number, isFree: boolean): string {
  if (isFree || price === 0) return "Free";
  return `$${(price / 100).toFixed(2)}`;
}

type ProductItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  isFree: boolean;
  imageUrl: string;
  type: "course" | "download" | "bundle" | "physical";
  href: string;
};

export function RelatedProductsBlock({ data, currentSlug, currentType }: Props) {
  const d = data;
  const selectionMode = d.selectionMode ?? "auto";
  const productType = d.productType ?? "both";
  const maxItems = d.maxItems ?? 3;
  const layout = d.layout ?? "grid";
  const accent = d.accentColor ?? "#179ca3";
  const textColor = d.textColor ?? "#111827";
  const cardBg = d.cardBgColor ?? "#ffffff";

  // ── AUTO mode queries ──────────────────────────────────────────────────────
  const needsCourses =
    selectionMode === "auto" &&
    (productType === "course" || productType === "both" || productType === "all");
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
  const manualRefs = d.manualItems ?? [];
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
    items = (manualData ?? []).map((p) => ({
      id: `${p.type}-${p.id}`,
      slug: p.slug,
      title: p.title,
      description: p.description ?? "",
      price: p.price,
      isFree: p.isFree ?? false,
      imageUrl: p.imageUrl ?? "",
      type: p.type as ProductItem["type"],
      href: p.href,
    }));
  } else {
    const courseItems: ProductItem[] = (coursesData?.courses ?? []).map((c) => ({
      id: `course-${c.id}`,
      slug: c.slug,
      title: c.title,
      description: c.subtitle ?? c.description ?? "",
      price: c.price,
      isFree: c.isFree,
      imageUrl: (c as any).coverImageUrl ?? (c as any).thumbnailUrl ?? "",
      type: "course" as const,
      href: `/courses/${c.slug}`,
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

    if (productType === "course") items = courseItems;
    else if (productType === "download") items = downloadItems;
    else items = [...courseItems, ...downloadItems];

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
    case "course":   return { Icon: BookOpen,  label: "Course" };
    case "download": return { Icon: FileDown,  label: "Digital Download" };
    case "bundle":   return { Icon: Package,   label: "Bundle" };
    case "physical": return { Icon: Package,   label: "Physical" };
    default:         return { Icon: Package,   label: type };
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
      <div className="h-36 flex-shrink-0 overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
            <Icon size={36} style={{ color: accent, opacity: 0.6 }} />
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

        {/* Footer — price + button always on same row, pinned to bottom */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 flex-shrink-0">
          {showPrice ? (
            <span className="text-sm font-bold whitespace-nowrap" style={{ color: accent }}>
              {formatPrice(item.price, item.isFree)}
            </span>
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
      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
            <Icon size={24} style={{ color: accent, opacity: 0.6 }} />
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
      </div>

      {/* Price + CTA — same row, right-aligned */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {showPrice && (
          <span className="text-sm font-bold whitespace-nowrap" style={{ color: accent }}>
            {formatPrice(item.price, item.isFree)}
          </span>
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
