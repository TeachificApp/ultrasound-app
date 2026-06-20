/**
 * IncludedItemsBlock.tsx
 * Renders the "Included Items" content block for membership and bundle landing pages.
 * Card layout mirrors RelatedProductsBlock.ProductCard exactly:
 *  - Fixed h-36 thumbnail (never grows)
 *  - Type badge with icon (10px uppercase)
 *  - Title: max 2 lines (line-clamp-2)
 *  - Description: max 2 lines (line-clamp-2), flex-1
 *  - Footer: "Included" badge + optional CTA button pinned to bottom (same row as price+button in RelatedProductsBlock)
 *
 * App-type items receive a gradient overlay with the app name AND the correct hero image,
 * matching the treatment in RelatedProductsBlock exactly.
 */
import React from "react";
import { BookOpen, FileDown, HelpCircle, Package, Radio, Users, Globe, Check, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

// ─── App hero images (same URLs as funnelRouter) ──────────────────────────────
// Wide hero banner images — same as used on the AAUS and iHeartEcho home pages
const AAUS_HERO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/ultrasound-hero-probe-3bWMAQMJw9YFHoPXwbt8bZ.webp";
const IHE_HERO  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IncludedItem {
  id: number;
  itemType: string;
  itemId?: number | null;
  itemTitle?: string | null;
  itemSlug?: string | null;
  itemCoverImage?: string | null;
  label?: string | null;
  /** For app-type items: short name shown in the gradient overlay */
  appLabel?: string | null;
  /** Short description shown under the title */
  itemDescription?: string | null;
}

export interface IncludedItemsBlockData {
  /** Source selection — when set, items are fetched from this membership or bundle */
  sourceType?: "membership" | "bundle";
  /** Numeric ID of the selected membership plan or bundle */
  sourceId?: number | string | null;
  /** Display name of the selected source (for admin UI) */
  sourceName?: string;
  headline?: string;
  subtext?: string;
  layout?: "grid" | "list";
  columns?: 2 | 3 | 4;
  showTypeLabel?: boolean;
  showCoverImage?: boolean;
  showCheckIcon?: boolean;
  /** CTA button label — defaults to "Explore" */
  ctaText?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  cardBgColor?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type IconComponent = React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;

function typeInfo(type: string): { Icon: IconComponent; label: string } {
  switch (type) {
    case "course":                  return { Icon: BookOpen,     label: "Course" };
    case "cohort":                  return { Icon: BookOpen,     label: "Cohort" };
    case "quiz":                    return { Icon: HelpCircle,   label: "Quiz" };
    case "download":                return { Icon: FileDown,     label: "Digital Download" };
    case "bundle":                  return { Icon: Package,      label: "Bundle" };
    case "product":                 return { Icon: Package,      label: "Product" };
    case "webinar":                 return { Icon: Radio,        label: "Webinar" };
    case "community":               return { Icon: Users,        label: "Community" };
    case "workshop":                return { Icon: BookOpen,     label: "Workshop" };
    case "all_courses":             return { Icon: BookOpen,     label: "All Courses" };
    case "all_downloads":           return { Icon: FileDown,     label: "All Downloads" };
    case "ultrasoundassist_free":   return { Icon: Globe,        label: "UltrasoundAssist™" };
    case "ultrasoundassist_premium":return { Icon: Globe,        label: "UltrasoundAssist™" };
    case "echoassist_free":         return { Icon: Globe,        label: "EchoAssist™" };
    case "echoassist_premium":      return { Icon: Globe,        label: "EchoAssist™" };
    default:                        return { Icon: Package,      label: type };
  }
}

function itemHref(item: IncludedItem): string | null {
  if (!item.itemSlug) return null;
  switch (item.itemType) {
    case "course":    return `/courses/${item.itemSlug}`;
    case "download":  return `/downloads/${item.itemSlug}`;
    case "webinar":   return `/webinars/${item.itemSlug}`;
    case "community": return `/community/${item.itemSlug}`;
    default:          return null;
  }
}

/** Derive a short app name for the gradient overlay on app-type items */
function appOverlayLabel(item: IncludedItem): string | null {
  if (item.appLabel) return item.appLabel;
  if (item.itemType === "ultrasoundassist_free")    return "UltrasoundAssist™";
  if (item.itemType === "ultrasoundassist_premium") return "UltrasoundAssist™";
  if (item.itemType === "echoassist_free")          return "EchoAssist™";
  if (item.itemType === "echoassist_premium")       return "EchoAssist™";
  return null;
}

/** Return the hero image URL for app-type items when no explicit cover is set */
function appHeroImage(itemType: string): string | null {
  if (itemType === "ultrasoundassist_free" || itemType === "ultrasoundassist_premium") return AAUS_HERO;
  if (itemType === "echoassist_free"       || itemType === "echoassist_premium")       return IHE_HERO;
  return null;
}

const IS_APP_TYPE = new Set([
  "ultrasoundassist_free", "ultrasoundassist_premium",
  "echoassist_free", "echoassist_premium",
]);

// ─── Grid Card ────────────────────────────────────────────────────────────────
// Mirrors RelatedProductsBlock.ProductCard layout exactly.

function GridCard({ item, d }: { item: IncludedItem; d: IncludedItemsBlockData }) {
  const accent   = d.accentColor  ?? "#179ca3";
  const cardBg   = d.cardBgColor  ?? "#ffffff";
  const textCol  = d.textColor    ?? "#111827";
  const href     = itemHref(item);
  const ctaText  = d.ctaText ?? "Explore";
  const { Icon, label } = typeInfo(item.itemType);
  const displayTitle = item.itemTitle ?? item.label ?? `${label} #${item.itemId}`;
  const isApp    = IS_APP_TYPE.has(item.itemType);
  const overlayLabel = isApp ? appOverlayLabel(item) : null;
  // Use explicit cover image, fall back to app hero, then nothing
  const coverImage = item.itemCoverImage || (isApp ? appHeroImage(item.itemType) : null);

  const inner = (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow h-full"
      style={{ backgroundColor: cardBg }}
    >
      {/* Fixed-height thumbnail — never grows */}
      {d.showCoverImage !== false && (
        <div className="h-36 flex-shrink-0 overflow-hidden relative">
          {coverImage ? (
            <img src={coverImage} alt={displayTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
              <Icon size={36} style={{ color: accent, opacity: 0.6 }} />
            </div>
          )}
          {/* App name overlay — same gradient treatment as RelatedProductsBlock */}
          {overlayLabel && (
            <div className="absolute inset-0 flex items-end justify-start p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
              <span className="text-white font-bold text-sm leading-tight drop-shadow-md">{overlayLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* Body — grows to fill remaining space */}
      <div className="p-4 flex flex-col flex-1">
        {/* Type badge */}
        {d.showTypeLabel !== false && (
          <span
            className="text-[10px] font-semibold uppercase tracking-widest mb-1 flex items-center gap-1 flex-shrink-0"
            style={{ color: accent }}
          >
            <Icon size={10} /> {label}
          </span>
        )}

        {/* Title — max 2 lines */}
        <h3
          className="font-bold text-sm leading-snug mb-1 line-clamp-2 flex-shrink-0"
          style={{ color: textCol }}
        >
          {displayTitle}
        </h3>

        {/* Description — max 2 lines, grows to fill space */}
        {item.itemDescription ? (
          <p className="text-xs text-gray-500 line-clamp-2 flex-1 min-h-0">
            {item.itemDescription.replace(/<[^>]+>/g, "").slice(0, 160)}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        {/* Footer — "Included" badge + CTA button, same row layout as RelatedProductsBlock price+button */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 flex-shrink-0">
          {d.showCheckIcon !== false ? (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: accent }}>
              <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
              Included
            </span>
          ) : (
            <span />
          )}
          {href ? (
            <Link href={href}>
              <button
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0"
                style={{ backgroundColor: accent }}
              >
                {ctaText} <ExternalLink size={10} />
              </button>
            </Link>
          ) : (
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 whitespace-nowrap flex-shrink-0"
              style={{ backgroundColor: accent }}
            >
              {ctaText} <ExternalLink size={10} />
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block h-full">{inner}</Link>;
  return inner;
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({ item, d }: { item: IncludedItem; d: IncludedItemsBlockData }) {
  const accent   = d.accentColor  ?? "#179ca3";
  const cardBg   = d.cardBgColor  ?? "#ffffff";
  const textCol  = d.textColor    ?? "#111827";
  const href     = itemHref(item);
  const ctaText  = d.ctaText ?? "Explore";
  const { Icon, label } = typeInfo(item.itemType);
  const displayTitle = item.itemTitle ?? item.label ?? `${label} #${item.itemId}`;
  const isApp    = IS_APP_TYPE.has(item.itemType);
  const coverImage = item.itemCoverImage || (isApp ? appHeroImage(item.itemType) : null);
  const overlayLabel = isApp ? appOverlayLabel(item) : null;

  const inner = (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden flex gap-4 p-4 shadow-sm hover:shadow-md transition-shadow items-center"
      style={{ backgroundColor: cardBg }}
    >
      {/* Fixed thumbnail */}
      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden relative">
        {coverImage ? (
          <img src={coverImage} alt={displayTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: accent + "18" }}>
            <Icon size={20} style={{ color: accent }} />
          </div>
        )}
        {overlayLabel && (
          <div className="absolute inset-0 flex items-end justify-start p-1 bg-gradient-to-t from-black/70 via-black/20 to-transparent rounded-lg">
            <span className="text-white font-bold text-[9px] leading-tight drop-shadow-md">{overlayLabel}</span>
          </div>
        )}
      </div>

      {/* Content — grows, truncated */}
      <div className="flex-1 min-w-0">
        {d.showTypeLabel !== false && (
          <p className="text-xs flex items-center gap-1 mb-0.5" style={{ color: accent }}>
            <Icon size={10} /> {label}
          </p>
        )}
        <p className="font-medium text-sm truncate" style={{ color: textCol }}>{displayTitle}</p>
      </div>

      {/* Right side — Included badge + CTA button */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {d.showCheckIcon !== false && (
          <span className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: accent }}>
            <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
            Included
          </span>
        )}
        {href ? (
          <Link href={href}>
            <button
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 hover:opacity-90 transition-opacity whitespace-nowrap"
              style={{ backgroundColor: accent }}
            >
              {ctaText} <ExternalLink size={10} />
            </button>
          </Link>
        ) : (
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 whitespace-nowrap"
            style={{ backgroundColor: accent }}
          >
            {ctaText} <ExternalLink size={10} />
          </span>
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

// ─── Main Block ───────────────────────────────────────────────────────────────

interface IncludedItemsBlockProps {
  data: IncludedItemsBlockData;
  /** Items injected by the parent page (membership/bundle context). Used as fallback when no sourceId is configured. */
  items?: IncludedItem[];
}

export default function IncludedItemsBlock({ data: d, items: injectedItems = [] }: IncludedItemsBlockProps) {
  const bgColor = d.bgColor  ?? "#f9fafb";
  const textCol = d.textColor ?? "#111827";
  const layout  = d.layout   ?? "grid";
  const cols    = d.columns  ?? 3;

  // Coerce sourceId to a valid positive number
  const rawSourceId = d.sourceId;
  const sourceId = rawSourceId != null && rawSourceId !== "" ? Number(rawSourceId) : null;
  const hasSource = sourceId != null && !isNaN(sourceId) && sourceId > 0;
  const isMembership = d.sourceType === "membership";
  const isBundle = d.sourceType === "bundle";

  // Fetch items from the configured source
  const membershipQuery = trpc.membership.getIncludedItems.useQuery(
    { planId: sourceId ?? 0 },
    { enabled: hasSource && isMembership, staleTime: 60_000 }
  );
  const bundleQuery = trpc.bundles.getIncludedItems.useQuery(
    { bundleId: sourceId ?? 0 },
    { enabled: hasSource && isBundle, staleTime: 60_000 }
  );

  const isLoading = (hasSource && isMembership && membershipQuery.isLoading) || (hasSource && isBundle && bundleQuery.isLoading);

  // Resolve items: source query wins over injected items
  let items: IncludedItem[] = injectedItems;
  if (hasSource && isMembership && membershipQuery.data) {
    items = membershipQuery.data.items as IncludedItem[];
  } else if (hasSource && isBundle && bundleQuery.data) {
    items = bundleQuery.data.items as IncludedItem[];
  }

  const colCount = Math.min(items.length || cols, cols);
  const colClass = layout === "grid" ? "grid gap-5 items-stretch" : "space-y-3";
  const gridStyle = layout === "grid" ? { gridTemplateColumns: `repeat(${colCount}, 1fr)` } : undefined;

  if (isLoading) {
    return (
      <div className="py-10 sm:py-14" style={{ backgroundColor: bgColor }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {d.headline && <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4" style={{ color: textCol }} dangerouslySetInnerHTML={{ __html: d.headline }} />}
          <div className={layout === "grid" ? "grid gap-5" : "space-y-3"} style={layout === "grid" ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}>
            {Array.from({ length: cols }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="h-36 bg-gray-200" />
                <div className="p-4 space-y-2"><div className="h-3 bg-gray-200 rounded w-1/3" /><div className="h-4 bg-gray-200 rounded w-3/4" /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="py-10 sm:py-14" style={{ backgroundColor: bgColor }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {d.headline && (
          <h2
            className="text-2xl sm:text-3xl font-bold text-center mb-2"
            style={{ color: textCol }}
            dangerouslySetInnerHTML={{ __html: d.headline }}
          />
        )}
        {d.subtext && (
          <p className="text-center text-sm mb-8 opacity-70" style={{ color: textCol }}>
            {d.subtext}
          </p>
        )}
        <div className={colClass} style={gridStyle}>
          {items.map((item) =>
            layout === "grid" ? (
              <GridCard key={item.id} item={item} d={d} />
            ) : (
              <ListRow key={item.id} item={item} d={d} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
