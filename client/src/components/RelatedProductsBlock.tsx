/**
 * RelatedProductsBlock.tsx
 * Public-facing cross-sell block that auto-fetches published courses and/or downloads.
 * Used in CourseLanding, DownloadLanding, and PublicFunnelPage.
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, BookOpen, FileDown, ExternalLink } from "lucide-react";

interface RelatedProductsBlockData {
  headline?: string;
  subtext?: string;
  productType?: "course" | "download" | "both";
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

export function RelatedProductsBlock({ data, currentSlug, currentType }: Props) {
  const d = data;
  const productType = d.productType ?? "both";
  const maxItems = d.maxItems ?? 3;
  const layout = d.layout ?? "grid";
  const accent = d.accentColor ?? "#179ca3";
  const textColor = d.textColor ?? "#111827";
  const cardBg = d.cardBgColor ?? "#ffffff";

  // Fetch courses if needed
  const { data: coursesData, isLoading: coursesLoading } = trpc.lms.listCourses.useQuery(
    { pageSize: maxItems + 2 },
    { enabled: productType === "course" || productType === "both" }
  );

  // Fetch downloads if needed
  const { data: downloadsData, isLoading: downloadsLoading } = trpc.downloads.list.useQuery(
    { limit: maxItems + 2 },
    { enabled: productType === "download" || productType === "both" }
  );

  const isLoading = coursesLoading || downloadsLoading;

  // Merge and filter
  const courseItems = (coursesData?.courses ?? []).map((c) => ({
    id: `course-${c.id}`,
    slug: c.slug,
    title: c.title,
    description: c.subtitle ?? c.description ?? "",
    price: c.price,
    isFree: c.isFree,
    imageUrl: c.coverImageUrl ?? "",
    type: "course" as const,
    href: `/courses/${c.slug}`,
  }));

  const downloadItems = (downloadsData?.products ?? []).map((p) => ({
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

  let items = [
    ...(productType === "course" ? courseItems : []),
    ...(productType === "download" ? downloadItems : []),
    ...(productType === "both" ? [...courseItems, ...downloadItems] : []),
  ];

  // Exclude current product
  if (d.excludeCurrentSlug !== false && currentSlug) {
    items = items.filter((item) => !(item.slug === currentSlug && item.type === currentType));
  }

  // Shuffle and limit
  items = items.sort(() => Math.random() - 0.5).slice(0, maxItems);

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
          <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
            {Array.from({ length: maxItems }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-gray-200" style={{ backgroundColor: cardBg }}>
                <Skeleton className="h-32 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-8 w-24 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? null : layout === "grid" ? (
          <div
            className="grid gap-5"
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

interface CardProps {
  item: {
    slug: string;
    title: string;
    description: string;
    price: number;
    isFree: boolean;
    imageUrl: string;
    type: "course" | "download";
    href: string;
  };
  accent: string;
  textColor: string;
  cardBg: string;
  showPrice: boolean;
  showDescription: boolean;
  ctaText: string;
}

function ProductCard({ item, accent, textColor, cardBg, showPrice, showDescription, ctaText }: CardProps) {
  const TypeIcon = item.type === "course" ? BookOpen : FileDown;
  const typeLabel = item.type === "course" ? "Course" : "Download";

  return (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow"
      style={{ backgroundColor: cardBg }}
    >
      {/* Thumbnail */}
      {item.imageUrl ? (
        <div className="h-36 overflow-hidden">
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-36 flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
          <TypeIcon size={36} style={{ color: accent, opacity: 0.6 }} />
        </div>
      )}

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest mb-1 flex items-center gap-1"
          style={{ color: accent }}
        >
          <TypeIcon size={10} /> {typeLabel}
        </span>
        <h3 className="font-bold text-sm leading-snug mb-1" style={{ color: textColor }}>
          {item.title}
        </h3>
        {showDescription && item.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">
            {item.description.replace(/<[^>]+>/g, "").slice(0, 120)}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          {showPrice && (
            <span className="text-sm font-bold" style={{ color: accent }}>
              {formatPrice(item.price, item.isFree)}
            </span>
          )}
          <Link href={item.href}>
            <button
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 hover:opacity-90 transition-opacity"
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
  const TypeIcon = item.type === "course" ? BookOpen : FileDown;
  const typeLabel = item.type === "course" ? "Course" : "Download";

  return (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden flex gap-4 p-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ backgroundColor: cardBg }}
    >
      {/* Thumbnail */}
      {item.imageUrl ? (
        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-20 h-20 flex-shrink-0 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
          <TypeIcon size={24} style={{ color: accent, opacity: 0.6 }} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1 mb-0.5" style={{ color: accent }}>
          <TypeIcon size={10} /> {typeLabel}
        </span>
        <h3 className="font-bold text-sm leading-snug" style={{ color: textColor }}>{item.title}</h3>
        {showDescription && item.description && (
          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
            {item.description.replace(/<[^>]+>/g, "").slice(0, 100)}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        {showPrice && (
          <span className="text-sm font-bold" style={{ color: accent }}>
            {formatPrice(item.price, item.isFree)}
          </span>
        )}
        <Link href={item.href}>
          <button
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 hover:opacity-90 transition-opacity mt-2"
            style={{ backgroundColor: accent }}
          >
            {ctaText} <ExternalLink size={10} />
          </button>
        </Link>
      </div>
    </div>
  );
}
