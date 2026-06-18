export type RelatedProductManualRef = { type: string; id: number };

export type RelatedProductsBlockConfig = {
  selectionMode?: "auto" | "manual";
  manualItems?: RelatedProductManualRef[];
};

/** Resolve whether the block should use manual picks (handles legacy data missing selectionMode). */
export function resolveRelatedProductsSelectionMode(
  data: RelatedProductsBlockConfig
): "auto" | "manual" {
  if (data.selectionMode === "manual" || data.selectionMode === "auto") {
    return data.selectionMode;
  }
  return (data.manualItems?.length ?? 0) > 0 ? "manual" : "auto";
}

export type RelatedProductFeedItem = {
  id: number;
  type: string;
  slug: string;
  title: string;
  description?: string | null;
  price: number;
  isFree?: boolean;
  imageUrl?: string | null;
  href: string;
  pricingType?: string | null;
  subscriptionInterval?: string | null;
  appLabel?: string;
  nextInstance?: unknown;
  primaryCohortGroup?: unknown;
};

/** Keep only products explicitly listed in manualItems, in picker order. */
export function pickManualRelatedProducts(
  manualRefs: RelatedProductManualRef[],
  fetched: RelatedProductFeedItem[],
  maxItems: number
): RelatedProductFeedItem[] {
  if (manualRefs.length === 0) return [];

  const byKey = new Map<string, RelatedProductFeedItem>();
  for (const product of fetched) {
    byKey.set(`${product.type}-${product.id}`, product);
  }

  const seenKeys = new Set<string>();
  const ordered: RelatedProductFeedItem[] = [];

  for (const ref of manualRefs) {
    const key = `${ref.type}-${ref.id}`;
    if (seenKeys.has(key)) continue;
    const product = byKey.get(key);
    if (!product) continue;
    seenKeys.add(key);
    ordered.push(product);
    if (ordered.length >= maxItems) break;
  }

  return ordered;
}
