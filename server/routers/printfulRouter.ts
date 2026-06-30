import { z } from "zod";
import { TRPCError } from "@trpc/server";
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
  getDefaultPrintfulStoreId,
  isPrintfulConfigured,
  testConnection,
} from "../printful";
import {
  importPrintfulProductById,
  importPrintfulProductsBulk,
  listImportedPrintfulProductIds,
} from "../lib/importPrintfulProduct";
import { fulfillPrintfulOrder } from "../lib/fulfillPrintfulOrder";

function assertAdmin(role: string | undefined) {
  if (role !== "admin" && role !== "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

// ── Admin router ──────────────────────────────────────────────────────────────

export const printfulAdminRouter = router({
  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isPrintfulConfigured()) {
      return { configured: false, connected: false, stores: [], error: "PRINTFUL_API_KEY is not configured" };
    }
    try {
      const { stores } = await testConnection();
      return { configured: true, connected: true, stores, defaultStoreId: getDefaultPrintfulStoreId() };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        stores: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }),

  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isPrintfulConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTFUL_API_KEY is not configured" });
    }
    return testConnection();
  }),

  /** List all Printful stores connected to the API key */
  listStores: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isPrintfulConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTFUL_API_KEY is not configured" });
    }
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
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
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
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      const db = await getDb();
      if (!db) return [];
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
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      return cancelOrder(input.storeId, input.orderId);
    }),

  listImportedProductIds: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      return listImportedPrintfulProductIds(input.storeId);
    }),

  importProduct: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      syncProductId: z.number(),
      publish: z.boolean().optional(),
      updateExisting: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isPrintfulConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTFUL_API_KEY is not configured" });
      }
      try {
        return await importPrintfulProductById(input.storeId, input.syncProductId, {
          publish: input.publish ?? false,
          updateExisting: input.updateExisting ?? false,
        });
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) });
      }
    }),

  importProducts: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      syncProductIds: z.array(z.number()).min(1).max(50),
      publish: z.boolean().optional(),
      updateExisting: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isPrintfulConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTFUL_API_KEY is not configured" });
      }
      const results = await importPrintfulProductsBulk(input.storeId, input.syncProductIds, {
        publish: input.publish ?? false,
        updateExisting: input.updateExisting ?? false,
      });
      return {
        results,
        created: results.filter((r) => r.action === "created").length,
        updated: results.filter((r) => r.action === "updated").length,
        skipped: results.filter((r) => r.action === "skipped").length,
      };
    }),

  retryFulfillment: protectedProcedure
    .input(z.object({ orderId: z.number(), force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await fulfillPrintfulOrder(db, input.orderId, { force: input.force ?? false });
      if (result.error) throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      return result;
    }),
});

// ── Public / learner router ───────────────────────────────────────────────────

export const printfulPublicRouter = router({
  /** Get cached products for the storefront (no auth required) */
  listProducts: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
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
