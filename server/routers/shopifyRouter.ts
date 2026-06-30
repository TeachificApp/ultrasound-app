import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getProductById,
  getShopifyStores,
  isShopifyConfigured,
  listProducts,
  testStoreConnection,
} from "../shopify";
import {
  importShopifyProductById,
  importShopifyProductsBulk,
  listImportedShopifyProductIds,
} from "../lib/importShopifyProduct";

function assertAdmin(role: string | undefined) {
  if (role !== "admin" && role !== "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const shopifyAdminRouter = router({
  /** List configured Shopify stores (no secrets returned). */
  listStores: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    return getShopifyStores().map((s) => ({
      key: s.key,
      label: s.label,
      domain: s.domain,
    }));
  }),

  /** Connection status for all configured stores. */
  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isShopifyConfigured()) {
      return { configured: false, stores: [] as Array<{ key: string; label: string; domain: string; connected: boolean; shopName?: string; error?: string }> };
    }

    const stores = getShopifyStores();
    const results = await Promise.all(
      stores.map(async (store) => {
        try {
          const result = await testStoreConnection(store.key);
          return {
            key: store.key,
            label: store.label,
            domain: store.domain,
            connected: true,
            shopName: result.shopName,
          };
        } catch (err) {
          return {
            key: store.key,
            label: store.label,
            domain: store.domain,
            connected: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    return { configured: true, stores: results };
  }),

  testConnection: protectedProcedure
    .input(z.object({ storeKey: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isShopifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Shopify store is configured" });
      }
      return testStoreConnection(input?.storeKey);
    }),

  listProducts: protectedProcedure
    .input(z.object({
      storeKey: z.string().optional(),
      first: z.number().min(1).max(100).default(50),
      after: z.string().nullable().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isShopifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Shopify store is configured" });
      }
      return listProducts(input?.storeKey, input?.first ?? 50, input?.after ?? null);
    }),

  lookupProduct: protectedProcedure
    .input(z.object({ storeKey: z.string().optional(), productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isShopifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Shopify store is configured" });
      }
      const product = await getProductById(input.storeKey, input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Shopify product not found" });
      return product;
    }),

  /** Shopify product IDs already imported for a store */
  listImportedProductIds: protectedProcedure
    .input(z.object({ storeKey: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      return listImportedShopifyProductIds(input?.storeKey);
    }),

  /** Import one Shopify product as a physical product */
  importProduct: protectedProcedure
    .input(z.object({
      storeKey: z.string().optional(),
      shopifyProductId: z.string().min(1),
      publish: z.boolean().optional(),
      updateExisting: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isShopifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Shopify store is configured" });
      }
      try {
        return await importShopifyProductById(input.storeKey, input.shopifyProductId, {
          publish: input.publish ?? false,
          updateExisting: input.updateExisting ?? false,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  /** Import multiple Shopify products */
  importProducts: protectedProcedure
    .input(z.object({
      storeKey: z.string().optional(),
      shopifyProductIds: z.array(z.string().min(1)).min(1).max(50),
      publish: z.boolean().optional(),
      updateExisting: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isShopifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Shopify store is configured" });
      }
      const results = await importShopifyProductsBulk(
        input.storeKey ?? "default",
        input.shopifyProductIds,
        {
          publish: input.publish ?? false,
          updateExisting: input.updateExisting ?? false,
        },
      );
      const created = results.filter((r) => r.action === "created").length;
      const updated = results.filter((r) => r.action === "updated").length;
      const skipped = results.filter((r) => r.action === "skipped").length;
      return { results, created, updated, skipped };
    }),
});
