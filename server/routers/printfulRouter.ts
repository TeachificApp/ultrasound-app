import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { printfulSyncProducts } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  listStores,
  listSyncProducts,
  getSyncProduct,
  listOrders,
  getOrder,
  cancelOrder,
  calculateShipping,
  createOrder,
} from "../printful";

// ── Admin router ──────────────────────────────────────────────────────────────

export const printfulAdminRouter = router({
  /** List all Printful stores connected to the API key */
  listStores: protectedProcedure.query(async () => {
    const stores = await listStores();
    return stores;
  }),

  /** List products in a store (from Printful API, not local cache) */
  listProducts: protectedProcedure
    .input(z.object({ storeId: z.number(), offset: z.number().default(0), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const { paging, result } = await listSyncProducts(input.storeId, input.offset, input.limit);
      return { paging, products: result };
    }),

  /** Sync all products from a Printful store into local DB cache */
  syncProducts: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      let offset = 0;
      const limit = 100;
      let total = 0;
      let synced = 0;

      do {
        const { paging, result } = await listSyncProducts(input.storeId, offset, limit);
        total = paging.total;

        for (const product of result) {
          // Fetch variant details to get retail price
          let retailPrice: string | null = null;
          let variantsJson: string | null = null;
          try {
            const detail = await getSyncProduct(input.storeId, product.id);
            const firstVariant = detail.sync_variants?.[0];
            retailPrice = firstVariant?.retail_price ?? null;
            variantsJson = JSON.stringify(
              detail.sync_variants?.map((v) => ({
                id: v.id,
                name: v.name,
                sku: v.sku,
                retailPrice: v.retail_price,
                currency: v.currency,
                thumbnailUrl: v.files?.find((f) => f.type === "preview")?.thumbnail_url ?? null,
                variantId: v.variant_id,
                product: v.product,
              })) ?? []
            );
          } catch {
            // Non-fatal — sync the product without variant details
          }

          await db
            .insert(printfulSyncProducts)
            .values({
              printfulProductId: product.id,
              storeId: input.storeId,
              externalId: product.external_id,
              name: product.name,
              thumbnailUrl: product.thumbnail_url,
              variantCount: product.variants,
              syncedVariantCount: product.synced,
              isIgnored: product.is_ignored,
              retailPrice,
              variantsJson,
              lastSyncedAt: new Date(),
            })
            .onDuplicateKeyUpdate({
              set: {
                externalId: product.external_id,
                name: product.name,
                thumbnailUrl: product.thumbnail_url,
                variantCount: product.variants,
                syncedVariantCount: product.synced,
                isIgnored: product.is_ignored,
                retailPrice,
                variantsJson,
                lastSyncedAt: new Date(),
              },
            });
          synced++;
        }

        offset += limit;
      } while (offset < total);

      return { synced, total };
    }),

  /** Get locally cached products for a store */
  getCachedProducts: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const products = await db
        .select()
        .from(printfulSyncProducts)
        .where(and(eq(printfulSyncProducts.storeId, input.storeId), eq(printfulSyncProducts.isIgnored, false)));
      return products;
    }),

  /** List orders in a store */
  listOrders: protectedProcedure
    .input(
      z.object({
        storeId: z.number(),
        status: z.string().optional(),
        offset: z.number().default(0),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      const { paging, result } = await listOrders(input.storeId, input.status, input.offset, input.limit);
      return { paging, orders: result };
    }),

  /** Get a single order */
  getOrder: protectedProcedure
    .input(z.object({ storeId: z.number(), orderId: z.number() }))
    .query(async ({ input }) => {
      return getOrder(input.storeId, input.orderId);
    }),

  /** Cancel an order */
  cancelOrder: protectedProcedure
    .input(z.object({ storeId: z.number(), orderId: z.number() }))
    .mutation(async ({ input }) => {
      return cancelOrder(input.storeId, input.orderId);
    }),
});

// ── Public / learner router ───────────────────────────────────────────────────

export const printfulPublicRouter = router({
  /** Get cached products for the storefront (no auth required) */
  listProducts: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const products = await db
        .select()
        .from(printfulSyncProducts)
        .where(and(eq(printfulSyncProducts.storeId, input.storeId), eq(printfulSyncProducts.isIgnored, false)));
      return products.map((p) => ({
        ...p,
        variants: p.variantsJson ? (JSON.parse(p.variantsJson) as unknown[]) : [],
      }));
    }),

  /** Calculate shipping rates for a cart */
  calculateShipping: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
        recipient: z.object({
          address1: z.string(),
          city: z.string(),
          country_code: z.string(),
          state_code: z.string().optional(),
          zip: z.string().optional(),
        }),
        items: z.array(z.object({ quantity: z.number(), variant_id: z.number() })),
      })
    )
    .query(async ({ input }) => {
      return calculateShipping(input.storeId, input.recipient, input.items);
    }),

  /** Create a Printful order (called after Stripe payment succeeds) */
  createOrder: protectedProcedure
    .input(
      z.object({
        storeId: z.number(),
        externalId: z.string().optional(),
        shipping: z.string().default("STANDARD"),
        recipient: z.object({
          name: z.string(),
          address1: z.string(),
          city: z.string(),
          country_code: z.string(),
          state_code: z.string().optional(),
          zip: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
        }),
        items: z.array(
          z.object({
            sync_variant_id: z.number().optional(),
            variant_id: z.number().optional(),
            quantity: z.number(),
            retail_price: z.string().optional(),
            name: z.string().optional(),
          })
        ),
        confirm: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const { storeId, confirm, ...orderData } = input;
      return createOrder(storeId, orderData, confirm);
    }),
});
