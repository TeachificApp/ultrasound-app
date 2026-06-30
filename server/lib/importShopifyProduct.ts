/**
 * Import Shopify catalog products as native physical_products records.
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { physicalProducts } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  getProductById,
  getShopifyStore,
  type ShopifyProductSummary,
} from "../shopify";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(db: Db, base: string): Promise<string> {
  let slug = base || "product";
  let i = 0;
  while (true) {
    const [existing] = await db
      .select({ id: physicalProducts.id })
      .from(physicalProducts)
      .where(eq(physicalProducts.slug, slug))
      .limit(1);
    if (!existing) return slug;
    i += 1;
    slug = `${base}-${i}`.slice(0, 80);
  }
}

function priceToCents(amount: string | null | undefined): number {
  if (!amount) return 0;
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function normalizeCurrency(code: string | null | undefined): string {
  return (code ?? "USD").toLowerCase();
}

export interface ImportShopifyProductResult {
  action: "created" | "skipped" | "updated";
  productId: number;
  slug: string;
  title: string;
  shopifyProductId: string;
  reason?: string;
}

export async function findImportedShopifyProduct(
  db: Db,
  storeKey: string,
  shopifyProductId: string,
): Promise<{ id: number; slug: string; title: string } | null> {
  const [row] = await db
    .select({
      id: physicalProducts.id,
      slug: physicalProducts.slug,
      title: physicalProducts.title,
    })
    .from(physicalProducts)
    .where(and(
      eq(physicalProducts.shopifyProductId, shopifyProductId),
      eq(physicalProducts.shopifyStoreKey, storeKey),
    ))
    .limit(1);
  return row ?? null;
}

export async function importShopifyProductRecord(
  db: Db,
  storeKey: string,
  shopifyProduct: ShopifyProductSummary,
  options?: { publish?: boolean; updateExisting?: boolean },
): Promise<ImportShopifyProductResult> {
  const store = getShopifyStore(storeKey);
  if (!store) throw new Error("No Shopify store is configured");

  const existing = await findImportedShopifyProduct(db, store.key, shopifyProduct.numericId);
  if (existing && !options?.updateExisting) {
    return {
      action: "skipped",
      productId: existing.id,
      slug: existing.slug,
      title: existing.title,
      shopifyProductId: shopifyProduct.numericId,
      reason: "already_imported",
    };
  }

  const priceCents = priceToCents(shopifyProduct.priceAmount);
  const values = {
    title: shopifyProduct.title,
    description: shopifyProduct.descriptionHtml,
    thumbnailUrl: shopifyProduct.imageUrl,
    price: priceCents,
    isFree: priceCents === 0,
    currency: normalizeCurrency(shopifyProduct.priceCurrency),
    checkoutMode: "shopify" as const,
    shopifyProductUrl: shopifyProduct.url,
    shopifyProductId: shopifyProduct.numericId,
    shopifyStoreKey: store.key,
    status: (options?.publish ? "published" : "draft") as "published" | "draft",
    landingHeadline: shopifyProduct.title,
    metaTitle: shopifyProduct.title,
  };

  if (existing && options?.updateExisting) {
    await db.update(physicalProducts).set(values).where(eq(physicalProducts.id, existing.id));
    return {
      action: "updated",
      productId: existing.id,
      slug: existing.slug,
      title: shopifyProduct.title,
      shopifyProductId: shopifyProduct.numericId,
    };
  }

  const baseSlug = slugify(shopifyProduct.handle || shopifyProduct.title);
  const slug = await uniqueSlug(db, baseSlug);
  const [result] = await db.insert(physicalProducts).values({
    ...values,
    slug,
  });
  const insertId = (result as { insertId?: number }).insertId;
  if (!insertId) throw new Error("Failed to create physical product");

  return {
    action: "created",
    productId: insertId,
    slug,
    title: shopifyProduct.title,
    shopifyProductId: shopifyProduct.numericId,
  };
}

export async function importShopifyProductById(
  storeKey: string,
  shopifyProductId: string,
  options?: { publish?: boolean; updateExisting?: boolean },
): Promise<ImportShopifyProductResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const shopifyProduct = await getProductById(storeKey, shopifyProductId);
  if (!shopifyProduct) throw new Error("Shopify product not found");

  const store = getShopifyStore(storeKey);
  return importShopifyProductRecord(db, store?.key ?? storeKey, shopifyProduct, options);
}

export async function importShopifyProductsBulk(
  storeKey: string | undefined,
  shopifyProductIds: string[],
  options?: { publish?: boolean; updateExisting?: boolean },
): Promise<ImportShopifyProductResult[]> {
  const resolvedKey = getShopifyStore(storeKey)?.key ?? storeKey ?? "default";
  const results: ImportShopifyProductResult[] = [];
  for (const id of shopifyProductIds) {
    try {
      results.push(await importShopifyProductById(resolvedKey, id, options));
    } catch (err) {
      results.push({
        action: "skipped",
        productId: 0,
        slug: "",
        title: id,
        shopifyProductId: id.replace(/\D/g, ""),
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

export async function listImportedShopifyProductIds(
  storeKey?: string,
): Promise<Array<{ shopifyProductId: string; productId: number; title: string }>> {
  const db = await getDb();
  if (!db) return [];
  const key = getShopifyStore(storeKey)?.key ?? storeKey ?? "default";
  const rows = await db
    .select({
      shopifyProductId: physicalProducts.shopifyProductId,
      productId: physicalProducts.id,
      title: physicalProducts.title,
    })
    .from(physicalProducts)
    .where(and(
      eq(physicalProducts.shopifyStoreKey, key),
      isNotNull(physicalProducts.shopifyProductId),
    ));
  return rows
    .filter((r) => r.shopifyProductId)
    .map((r) => ({
      shopifyProductId: r.shopifyProductId!,
      productId: r.productId,
      title: r.title,
    }));
}
