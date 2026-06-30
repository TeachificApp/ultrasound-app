/**
 * Import Printful sync products as physical_products records.
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { physicalProducts } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSyncProduct, retailPriceToCents, type PrintfulSyncVariant } from "../printful";

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

function pickDefaultVariant(variants: PrintfulSyncVariant[]): PrintfulSyncVariant | null {
  const synced = variants.filter((v) => v.synced && !v.is_ignored);
  return synced[0] ?? variants.find((v) => !v.is_ignored) ?? variants[0] ?? null;
}

export interface ImportPrintfulProductResult {
  action: "created" | "skipped" | "updated";
  productId: number;
  slug: string;
  title: string;
  printfulSyncProductId: number;
  reason?: string;
}

export async function findImportedPrintfulProduct(
  db: Db,
  storeId: number,
  syncProductId: number,
): Promise<{ id: number; slug: string; title: string } | null> {
  const [row] = await db
    .select({ id: physicalProducts.id, slug: physicalProducts.slug, title: physicalProducts.title })
    .from(physicalProducts)
    .where(and(
      eq(physicalProducts.printfulStoreId, storeId),
      eq(physicalProducts.printfulSyncProductId, syncProductId),
    ))
    .limit(1);
  return row ?? null;
}

export async function importPrintfulProductRecord(
  db: Db,
  storeId: number,
  syncProductId: number,
  options?: { publish?: boolean; updateExisting?: boolean },
): Promise<ImportPrintfulProductResult> {
  const detail = await getSyncProduct(storeId, syncProductId);
  const syncProduct = detail.sync_product;
  const variants = detail.sync_variants ?? [];
  const defaultVariant = pickDefaultVariant(variants);

  const existing = await findImportedPrintfulProduct(db, storeId, syncProductId);
  if (existing && !options?.updateExisting) {
    return {
      action: "skipped",
      productId: existing.id,
      slug: existing.slug,
      title: existing.title,
      printfulSyncProductId: syncProductId,
      reason: "already_imported",
    };
  }

  const priceCents = retailPriceToCents(defaultVariant?.retail_price);
  const thumbnailUrl =
    syncProduct.thumbnail_url ??
    defaultVariant?.files?.find((f) => f.type === "preview")?.thumbnail_url ??
    defaultVariant?.product?.image ??
    null;

  const values = {
    title: syncProduct.name,
    description: null as string | null,
    thumbnailUrl,
    price: priceCents,
    isFree: priceCents === 0,
    currency: (defaultVariant?.currency ?? "usd").toLowerCase(),
    checkoutMode: "native" as const,
    requiresShipping: true,
    printfulEnabled: true,
    printfulStoreId: storeId,
    printfulSyncProductId: syncProductId,
    printfulSyncVariantId: defaultVariant?.id ?? null,
    status: (options?.publish ? "published" : "draft") as "published" | "draft",
    landingHeadline: syncProduct.name,
    metaTitle: syncProduct.name,
  };

  if (existing && options?.updateExisting) {
    await db.update(physicalProducts).set(values).where(eq(physicalProducts.id, existing.id));
    return {
      action: "updated",
      productId: existing.id,
      slug: existing.slug,
      title: syncProduct.name,
      printfulSyncProductId: syncProductId,
    };
  }

  const slug = await uniqueSlug(db, slugify(syncProduct.name));
  const [result] = await db.insert(physicalProducts).values({ ...values, slug });
  const insertId = (result as { insertId?: number }).insertId;
  if (!insertId) throw new Error("Failed to create physical product");

  return {
    action: "created",
    productId: insertId,
    slug,
    title: syncProduct.name,
    printfulSyncProductId: syncProductId,
  };
}

export async function importPrintfulProductById(
  storeId: number,
  syncProductId: number,
  options?: { publish?: boolean; updateExisting?: boolean },
): Promise<ImportPrintfulProductResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return importPrintfulProductRecord(db, storeId, syncProductId, options);
}

export async function importPrintfulProductsBulk(
  storeId: number,
  syncProductIds: number[],
  options?: { publish?: boolean; updateExisting?: boolean },
): Promise<ImportPrintfulProductResult[]> {
  const results: ImportPrintfulProductResult[] = [];
  for (const id of syncProductIds) {
    try {
      results.push(await importPrintfulProductById(storeId, id, options));
    } catch (err) {
      results.push({
        action: "skipped",
        productId: 0,
        slug: "",
        title: String(id),
        printfulSyncProductId: id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

export async function listImportedPrintfulProductIds(
  storeId: number,
): Promise<Array<{ printfulSyncProductId: number; productId: number; title: string }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      printfulSyncProductId: physicalProducts.printfulSyncProductId,
      productId: physicalProducts.id,
      title: physicalProducts.title,
    })
    .from(physicalProducts)
    .where(and(
      eq(physicalProducts.printfulStoreId, storeId),
      isNotNull(physicalProducts.printfulSyncProductId),
    ));
  return rows
    .filter((r) => r.printfulSyncProductId != null)
    .map((r) => ({
      printfulSyncProductId: r.printfulSyncProductId!,
      productId: r.productId,
      title: r.title,
    }));
}
