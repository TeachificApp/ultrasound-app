/**
 * IncludedItemsBlock.tsx
 * Renders the "Included Items" content block for membership and bundle landing pages.
 * Items are passed in from the parent page (already fetched + ordered by sortOrder).
 */
import { BookOpen, FileDown, HelpCircle, Package, Radio, Users, Globe, Check } from "lucide-react";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IncludedItem {
  id: number;
  itemType: string;
  itemId?: number | null;
  itemTitle?: string | null;
  itemSlug?: string | null;
  itemCoverImage?: string | null;
  label?: string | null;
}

export interface IncludedItemsBlockData {
  headline?: string;
  subtext?: string;
  layout?: "grid" | "list";
  columns?: 2 | 3 | 4;
  showTypeLabel?: boolean;
  showCoverImage?: boolean;
  showCheckIcon?: boolean;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  cardBgColor?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-5 h-5 text-teal-600" />,
  download: <FileDown className="w-5 h-5 text-blue-600" />,
  quiz: <HelpCircle className="w-5 h-5 text-purple-600" />,
  webinar: <Radio className="w-5 h-5 text-rose-600" />,
  community: <Users className="w-5 h-5 text-emerald-600" />,
  bundle: <Package className="w-5 h-5 text-orange-600" />,
  product: <Package className="w-5 h-5 text-orange-600" />,
  all_courses: <BookOpen className="w-5 h-5 text-teal-600" />,
  all_downloads: <FileDown className="w-5 h-5 text-blue-600" />,
  ultrasoundassist_free: <Globe className="w-5 h-5 text-teal-600" />,
  ultrasoundassist_premium: <Globe className="w-5 h-5 text-teal-600" />,
  echoassist_free: <Globe className="w-5 h-5 text-teal-600" />,
  echoassist_premium: <Globe className="w-5 h-5 text-teal-600" />,
};

const TYPE_LABELS: Record<string, string> = {
  course: "Course",
  download: "Download",
  quiz: "Quiz",
  webinar: "Webinar",
  community: "Community",
  bundle: "Bundle",
  product: "Product",
  all_courses: "All Courses",
  all_downloads: "All Downloads",
  ultrasoundassist_free: "UltrasoundAssist™",
  ultrasoundassist_premium: "UltrasoundAssist™",
  echoassist_free: "EchoAssist™",
  echoassist_premium: "EchoAssist™",
};

function itemHref(item: IncludedItem): string | null {
  if (!item.itemSlug) return null;
  switch (item.itemType) {
    case "course": return `/courses/${item.itemSlug}`;
    case "download": return `/downloads/${item.itemSlug}`;
    case "webinar": return `/webinars/${item.itemSlug}`;
    case "community": return `/community/${item.itemSlug}`;
    default: return null;
  }
}

// ─── Grid Card ────────────────────────────────────────────────────────────────

function GridCard({ item, d }: { item: IncludedItem; d: IncludedItemsBlockData }) {
  const accent = d.accentColor ?? "#179ca3";
  const cardBg = d.cardBgColor ?? "#ffffff";
  const textCol = d.textColor ?? "#111827";
  const href = itemHref(item);
  const displayTitle = item.itemTitle ?? item.label ?? `${TYPE_LABELS[item.itemType] ?? item.itemType} #${item.itemId}`;

  const inner = (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col hover:shadow-md transition-shadow"
      style={{ backgroundColor: cardBg }}
    >
      {/* Cover image or placeholder */}
      {d.showCoverImage !== false && (
        item.itemCoverImage ? (
          <img src={item.itemCoverImage} alt={displayTitle} className="w-full h-28 object-cover" />
        ) : (
          <div className="w-full h-28 flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
            {TYPE_ICONS[item.itemType] ?? <Package className="w-8 h-8" style={{ color: accent }} />}
          </div>
        )
      )}
      <div className="p-4 flex-1 flex flex-col">
        {d.showTypeLabel !== false && (
          <span className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: accent }}>
            {TYPE_LABELS[item.itemType] ?? item.itemType}
          </span>
        )}
        <p className="font-semibold text-sm leading-snug flex-1" style={{ color: textCol }}>{displayTitle}</p>
        {d.showCheckIcon !== false && (
          <div className="mt-3 flex items-center gap-1">
            <Check className="w-4 h-4" style={{ color: accent }} />
            <span className="text-xs" style={{ color: accent }}>Included</span>
          </div>
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block h-full">{inner}</Link>;
  return inner;
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({ item, d }: { item: IncludedItem; d: IncludedItemsBlockData }) {
  const accent = d.accentColor ?? "#179ca3";
  const cardBg = d.cardBgColor ?? "#ffffff";
  const textCol = d.textColor ?? "#111827";
  const href = itemHref(item);
  const displayTitle = item.itemTitle ?? item.label ?? `${TYPE_LABELS[item.itemType] ?? item.itemType} #${item.itemId}`;

  const inner = (
    <div
      className="flex items-center gap-4 rounded-xl border border-gray-200 px-4 py-3 hover:shadow-sm transition-shadow"
      style={{ backgroundColor: cardBg }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "18" }}>
        {item.itemCoverImage && d.showCoverImage !== false ? (
          <img src={item.itemCoverImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
        ) : (
          TYPE_ICONS[item.itemType] ?? <Package className="w-5 h-5" style={{ color: accent }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" style={{ color: textCol }}>{displayTitle}</p>
        {d.showTypeLabel !== false && (
          <p className="text-xs" style={{ color: accent }}>{TYPE_LABELS[item.itemType] ?? item.itemType}</p>
        )}
      </div>
      {d.showCheckIcon !== false && <Check className="w-5 h-5 shrink-0" style={{ color: accent }} />}
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

// ─── Main Block ───────────────────────────────────────────────────────────────

interface IncludedItemsBlockProps {
  data: IncludedItemsBlockData;
  items: IncludedItem[];
}

export default function IncludedItemsBlock({ data: d, items }: IncludedItemsBlockProps) {
  const bgColor = d.bgColor ?? "#f9fafb";
  const textCol = d.textColor ?? "#111827";
  const layout = d.layout ?? "grid";
  const cols = d.columns ?? 3;

  const colClass =
    layout === "grid"
      ? cols === 4
        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        : cols === 2
        ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      : "space-y-3";

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
        <div className={colClass}>
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
