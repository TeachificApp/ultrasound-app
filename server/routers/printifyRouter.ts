import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getDefaultPrintifyShopId,
  getOrder,
  getProduct,
  isPrintifyConfigured,
  listOrders,
  listProducts,
  listShops,
  testConnection,
} from "../printify";
import {
  importPrintifyProductById,
  importPrintifyProductsBulk,
  listImportedPrintifyProductIds,
} from "../lib/importPrintifyProduct";
import { fulfillPrintifyOrder } from "../lib/fulfillPrintifyOrder";
import { getDb } from "../db";

function assertAdmin(role: string | undefined) {
  if (role !== "admin" && role !== "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const printifyAdminRouter = router({
  listShops: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isPrintifyConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
    }
    return listShops();
  }),

  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isPrintifyConfigured()) {
      return { configured: false, connected: false, shops: [], error: "PRINTIFY_API_TOKEN is not configured" };
    }
    try {
      const { shops } = await testConnection();
      return { configured: true, connected: true, shops, defaultShopId: getDefaultPrintifyShopId() };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        shops: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }),

  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    assertAdmin((ctx.user as { role?: string }).role);
    if (!isPrintifyConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
    }
    return testConnection();
  }),

  listProducts: protectedProcedure
    .input(z.object({
      shopId: z.number(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isPrintifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
      }
      return listProducts(input.shopId, input.page, input.limit);
    }),

  getProduct: protectedProcedure
    .input(z.object({ shopId: z.number(), productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isPrintifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
      }
      const product = await getProduct(input.shopId, input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Printify product not found" });
      return product;
    }),

  listOrders: protectedProcedure
    .input(z.object({ shopId: z.number(), page: z.number().min(1).default(1), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isPrintifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
      }
      return listOrders(input.shopId, input.page, input.limit);
    }),

  getOrder: protectedProcedure
    .input(z.object({ shopId: z.number(), orderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isPrintifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
      }
      return getOrder(input.shopId, input.orderId);
    }),

  listImportedProductIds: protectedProcedure
    .input(z.object({ shopId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      return listImportedPrintifyProductIds(input.shopId);
    }),

  importProduct: protectedProcedure
    .input(z.object({
      shopId: z.number(),
      printifyProductId: z.string().min(1),
      publish: z.boolean().optional(),
      updateExisting: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isPrintifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
      }
      try {
        return await importPrintifyProductById(input.shopId, input.printifyProductId, {
          publish: input.publish ?? false,
          updateExisting: input.updateExisting ?? false,
        });
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) });
      }
    }),

  importProducts: protectedProcedure
    .input(z.object({
      shopId: z.number(),
      printifyProductIds: z.array(z.string().min(1)).min(1).max(50),
      publish: z.boolean().optional(),
      updateExisting: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin((ctx.user as { role?: string }).role);
      if (!isPrintifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
      }
      const results = await importPrintifyProductsBulk(input.shopId, input.printifyProductIds, {
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
      const result = await fulfillPrintifyOrder(db, input.orderId, { force: input.force ?? false });
      if (result.error) throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      return result;
    }),
});
