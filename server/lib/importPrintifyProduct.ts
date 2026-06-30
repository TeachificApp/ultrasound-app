/**
 * Import Printify catalog products as physical_products records.
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { physicalProducts } from "../../drizzle/schema";
import { getDb } from "../db";
import { getProduct, type PrintifyProductDetail } from "../printify";

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

export interface ImportPrintifyProductResult {
  action: "created" | "skipped" | "updated";
  productId: number;
  slug: string;
  title: string;
  printifyProductId: string;
  reason?: string;
}

export async function findImportedPrintifyProduct(
  db: Db,
  shopId: number,
  printifyProductId: string,
): Promise<{ id: number; slug: string; title: string } | null> {
  const [row] = await db
    .select({ id: physicalProducts.id, slug: physicalProducts.slug, title: physicalProducts.title })
    .from(physicalProducts)
    .where(and(
      eq(physicalProducts.printifyShopId, shopId),
      eq(physicalProducts.printifyProductId, printifyProductId),
    ))
    .limit(1);
  return row ?? null;
}

export async function importPrintifyProductRecord(
  db: Db,
  shopId: number,
  printifyProduct: PrintifyProductDetail,
  options?: { publish?: boolean; updateExisting?: boolean },
): Promise<ImportPrintifyProductResult> {
  const existing = await findImportedPrintifyProduct(db, shopId, printifyProduct.id);
  if (existing && !options?.updateExisting) {
    return {
      action: "skipped",
      productId: existing.id,
      slug: existing.slug,
      title: existing.title,
      printifyProductId: printifyProduct.id,
      reason: "already_imported",
    };
  }

  const enabledVariant = printifyProduct.variants.find((v) => v.is_enabled) ?? printifyProduct.variants[0];
  const priceCents = enabledVariant?.price ?? printifyProduct.priceCents ?? 0;

  const values = {
    title: printifyProduct.title,
    description: printifyProduct.description || null,
    thumbnailUrl: printifyProduct.imageUrl,
    price: priceCents,
    isFree: priceCents === 0,
    currency: "usd",
    checkoutMode: "native" as const,
    requiresShipping: true,
    printifyEnabled: true,
    printifyShopId: shopId,
    printifyProductId: printifyProduct.id,
    printifyVariantId: enabledVariant?.id ?? printifyProduct.defaultVariantId,
    status: (options?.publish ? "published" : "draft") as "published" | "draft",
    landingHeadline: printifyProduct.title,
    metaTitle: printifyProduct.title,
  };

  if (existing && options?.updateExisting) {
    await db.update(physicalProducts).set(values).where(eq(physicalProducts.id, existing.id));
    return {
      action: "updated",
      productId: existing.id,
      slug: existing.slug,
      title: printifyProduct.title,
      printifyProductId: printifyProduct.id,
    };
  }

  const slug = await uniqueSlug(db, slugify(printifyProduct.title));
  const [result] = await db.insert(physicalProducts).values({ ...values, slug });
  const insertId = (result as { insertId?: number }).insertId;
  if (!insertId) throw new Error("Failed to create physical product");

  return {
    action: "created",
    productId: insertId,
    slug,
    title: printifyProduct.title,
    printifyProductId: printifyProduct.id,
  };
}

export async function importPrintifyProductById(
  shopId: number,
  printifyProductId: string,
  options?: { publish?: boolean; updateExisting?: boolean },
): Promise<ImportPrintifyProductResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const printifyProduct = await getProduct(shopId, printifyProductId);
  if (!printifyProduct) throw new Error("Printify product not found");

  return importPrintifyProductRecord(db, shopId, printifyProduct, options);
}

export async function importPrintifyProductsBulk(
  shopId: number,
  printifyProductIds: string[],
  options?: { publish?: boolean; updateExisting?: boolean },
): Promise<ImportPrintifyProductResult[]> {
  const results: ImportPrintifyProductResult[] = [];
  for (const id of printifyProductIds) {
    try {
      results.push(await importPrintifyProductById(shopId, id, options));
    } catch (err) {
      results.push({
        action: "skipped",
        productId: 0,
        slug: "",
        title: id,
        printifyProductId: id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

export async function listImportedPrintifyProductIds(
  shopId: number,
): Promise<Array<{ printifyProductId: string; productId: number; title: string }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      printifyProductId: physicalProducts.printifyProductId,
      productId: physicalProducts.id,
      title: physicalProducts.title,
    })
    .from(physicalProducts)
    .where(and(
      eq(physicalProducts.printifyShopId, shopId),
      isNotNull(physicalProducts.printifyProductId),
    ));
  return rows
    .filter((r) => r.printifyProductId)
    .map((r) => ({
      printifyProductId: r.printifyProductId!,
      productId: r.productId,
      title: r.title,
    }));
}
