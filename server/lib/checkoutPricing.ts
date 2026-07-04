import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  digitalBundles,
  digitalProducts,
  funnelPages,
  lmsCourses,
  physicalProducts,
} from "../../drizzle/schema";

export function assertClientPriceMatches(clientCents: number, serverCents: number, label = "price") {
  if (Math.round(clientCents) !== Math.round(serverCents)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid ${label}: price mismatch`,
    });
  }
}

export type FunnelCheckoutSelection = {
  selectedProductIndex: number;
  addedBumpIndexes: number[];
};

export function parseCheckoutFormBlock(blocksJson: string | null | undefined) {
  try {
    const blocks = JSON.parse(blocksJson || "[]") as Array<{ type?: string; data?: Record<string, unknown> }>;
    return blocks.find((b) => b.type === "checkout_form") ?? null;
  } catch {
    return null;
  }
}

export function parseEmbeddedCheckoutBlock(blocksJson: string | null | undefined) {
  try {
    const blocks = JSON.parse(blocksJson || "[]") as Array<{ type?: string; data?: Record<string, unknown> }>;
    return blocks.find((b) => b.type === "embedded_checkout") ?? null;
  } catch {
    return null;
  }
}

export function computeFunnelCheckoutTotalCents(
  checkoutBlock: { data?: { products?: Array<{ price?: number }>; orderBumps?: Array<{ price?: number }> } },
  selection: FunnelCheckoutSelection
) {
  const products = checkoutBlock.data?.products ?? [];
  const orderBumps = checkoutBlock.data?.orderBumps ?? [];
  const selectedProduct = products[selection.selectedProductIndex];
  if (!selectedProduct) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid product selection" });
  }

  let totalCents = Math.round(Number(selectedProduct.price ?? 0) * 100);
  for (const idx of selection.addedBumpIndexes) {
    const bump = orderBumps[idx];
    if (bump && Number(bump.price) > 0) {
      totalCents += Math.round(Number(bump.price) * 100);
    }
  }

  return { totalCents, selectedProduct, orderBumps };
}

async function resolveCatalogPriceCents(
  db: MySql2Database<Record<string, unknown>>,
  productType: string,
  productId: number
): Promise<number | null> {
  if (productType === "course" || productType === "quiz" || productType === "cohort") {
    const [course] = await db
      .select({ price: lmsCourses.price, isFree: lmsCourses.isFree, pricingType: lmsCourses.pricingType })
      .from(lmsCourses)
      .where(eq(lmsCourses.id, productId))
      .limit(1);
    if (!course) return null;
    if (course.isFree || course.pricingType === "free") return 0;
    return Math.round(Number(course.price ?? 0));
  }

  if (productType === "download") {
    const [prod] = await db
      .select({ price: digitalProducts.price })
      .from(digitalProducts)
      .where(eq(digitalProducts.id, productId))
      .limit(1);
    return prod ? Math.round(Number(prod.price ?? 0)) : null;
  }

  if (productType === "bundle") {
    const [bundle] = await db
      .select({ discountPrice: digitalBundles.discountPrice, originalPrice: digitalBundles.originalPrice })
      .from(digitalBundles)
      .where(eq(digitalBundles.id, productId))
      .limit(1);
    if (!bundle) return null;
    const price = bundle.discountPrice || bundle.originalPrice;
    return price ? Math.round(Number(price)) : 0;
  }

  if (productType === "physical" || productType === "product") {
    const [prod] = await db
      .select({ price: physicalProducts.price })
      .from(physicalProducts)
      .where(eq(physicalProducts.id, productId))
      .limit(1);
    return prod?.price != null ? Math.round(Number(prod.price)) : null;
  }

  return null;
}

function findBlockProductPriceCents(
  block: { data?: { products?: Array<{ name?: string; price?: number; productId?: number }> } } | null,
  productName: string,
  productId?: number
): number | null {
  if (!block?.data?.products?.length) return null;
  const match = block.data.products.find((p) => {
    if (productId != null && p.productId != null && Number(p.productId) === productId) return true;
    return p.name === productName;
  });
  return match ? Math.round(Number(match.price ?? 0) * 100) : null;
}

function validateSelectedBumps(
  orderBumps: Array<{ title?: string; price?: number }>,
  selectedBumps: Array<{ title: string; price: number }>
) {
  for (const bump of selectedBumps) {
    const serverBump = orderBumps.find((b) => b.title === bump.title);
    if (!serverBump) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid order bump selection" });
    }
    assertClientPriceMatches(Math.round(bump.price * 100), Math.round(Number(serverBump.price ?? 0) * 100), "order bump price");
  }
}

/** Resolve expected embedded-checkout total (base + bumps) in cents from catalog and/or page blocks. */
export async function resolveEmbeddedCheckoutExpectedCents(
  db: MySql2Database<Record<string, unknown>>,
  input: {
    productName: string;
    productPrice: number;
    productType: string;
    productId?: number;
    lmsCourseId?: number;
    sourceFunnelPageId?: number;
    selectedBumps: Array<{ title: string; price: number }>;
  }
): Promise<number> {
  let baseCents: number | null = null;
  let blockOrderBumps: Array<{ title?: string; price?: number }> = [];

  if (input.lmsCourseId) {
    const [course] = await db
      .select({ price: lmsCourses.price, isFree: lmsCourses.isFree, pricingType: lmsCourses.pricingType })
      .from(lmsCourses)
      .where(eq(lmsCourses.id, input.lmsCourseId))
      .limit(1);
    if (!course) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Course not found" });
    }
    baseCents =
      course.isFree || course.pricingType === "free" ? 0 : Math.round(Number(course.price ?? 0));
  } else if (input.productId) {
    baseCents = await resolveCatalogPriceCents(db, input.productType, input.productId);
    if (baseCents == null) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Product not found" });
    }
  }

  if (input.sourceFunnelPageId) {
    const [page] = await db
      .select({ blocks: funnelPages.blocks })
      .from(funnelPages)
      .where(eq(funnelPages.id, input.sourceFunnelPageId))
      .limit(1);
    const embeddedBlock = parseEmbeddedCheckoutBlock(page?.blocks ?? null);
    const checkoutBlock = parseCheckoutFormBlock(page?.blocks ?? null);
    const block = embeddedBlock ?? checkoutBlock;
    const blockPrice = findBlockProductPriceCents(block, input.productName, input.productId);
    if (blockPrice != null) {
      baseCents = blockPrice;
    }
    blockOrderBumps =
      (block?.data?.orderBumps as Array<{ title?: string; price?: number }> | undefined) ?? [];
  }

  if (baseCents == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unable to validate product price — missing product reference",
    });
  }

  assertClientPriceMatches(Math.round(input.productPrice * 100), baseCents, "product price");
  if (blockOrderBumps.length > 0) {
    validateSelectedBumps(blockOrderBumps, input.selectedBumps);
  }

  let totalCents = baseCents;
  for (const bump of input.selectedBumps) {
    if (bump.price > 0) totalCents += Math.round(Number(bump.price) * 100);
  }
  return totalCents;
}

/** Ensure a free-order request matches a zero-price product on the server. */
export async function assertFreeOrderEligible(
  db: MySql2Database<Record<string, unknown>>,
  input: {
    productName: string;
    productType: string;
    productId?: number;
    lmsCourseId?: number;
    sourceFunnelPageId?: number;
    sourceFunnelId?: number;
  }
): Promise<void> {
  if (input.lmsCourseId) {
    const [course] = await db
      .select({ price: lmsCourses.price, isFree: lmsCourses.isFree, pricingType: lmsCourses.pricingType })
      .from(lmsCourses)
      .where(eq(lmsCourses.id, input.lmsCourseId))
      .limit(1);
    if (!course) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Course not found" });
    }
    const isFree =
      course.isFree || course.pricingType === "free" || Math.round(Number(course.price ?? 0)) === 0;
    if (!isFree) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This product is not free" });
    }
    return;
  }

  if (input.productId) {
    const catalogPrice = await resolveCatalogPriceCents(db, input.productType, input.productId);
    if (catalogPrice == null) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Product not found" });
    }
    if (catalogPrice > 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This product is not free" });
    }
    return;
  }

  if (input.sourceFunnelPageId) {
    const [page] = await db
      .select({ blocks: funnelPages.blocks, funnelId: funnelPages.funnelId })
      .from(funnelPages)
      .where(eq(funnelPages.id, input.sourceFunnelPageId))
      .limit(1);
    if (!page) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Funnel page not found" });
    }
    if (input.sourceFunnelId && page.funnelId !== input.sourceFunnelId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid funnel page" });
    }
    const checkoutBlock =
      parseCheckoutFormBlock(page.blocks) ?? parseEmbeddedCheckoutBlock(page.blocks);
    const blockPrice = findBlockProductPriceCents(checkoutBlock, input.productName, input.productId);
    if (blockPrice == null) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Product not found on page" });
    }
    if (blockPrice > 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This product is not free" });
    }
    return;
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Unable to validate free order — missing product reference",
  });
}
