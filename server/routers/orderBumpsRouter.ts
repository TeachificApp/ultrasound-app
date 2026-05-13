/**
 * Order Bumps Router
 * Admin CRUD for order bump offers + public query for displaying bumps at checkout
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sql, eq, and } from "drizzle-orm";
import { orderBumps, orderBumpConversions } from "../../drizzle/schema";

// Helper to get DB
async function getDb() {
  const { drizzle } = await import("drizzle-orm/mysql2");
  return drizzle(process.env.DATABASE_URL!);
}

// ─── Admin Router ────────────────────────────────────────────────────────────
export const orderBumpsAdminRouter = router({
  /** List all order bumps */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    const rows = await db.select().from(orderBumps).orderBy(orderBumps.createdAt);
    return rows;
  }),

  /** Get a single order bump by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [row] = await db.select().from(orderBumps).where(eq(orderBumps.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  /** Create a new order bump */
  create: protectedProcedure
    .input(z.object({
      triggerType: z.enum(["course", "download", "bundle"]),
      triggerProductId: z.number(),
      bumpType: z.enum(["course", "download", "bundle", "physical"]),
      bumpProductId: z.number(),
      timing: z.enum(["before_checkout", "after_checkout"]).default("after_checkout"),
      bumpPrice: z.number().min(0),
      discountLabel: z.string().optional(),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      bodyHtml: z.string().optional(),
      imageUrl: z.string().optional(),
      ctaText: z.string().default("Add to Order"),
      ctaColor: z.string().default("#179ca3"),
      skipText: z.string().default("No thanks, continue"),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [result] = await db.insert(orderBumps).values({
        triggerType: input.triggerType,
        triggerProductId: input.triggerProductId,
        bumpType: input.bumpType,
        bumpProductId: input.bumpProductId,
        timing: input.timing,
        bumpPrice: input.bumpPrice,
        discountLabel: input.discountLabel ?? null,
        headline: input.headline ?? null,
        subheadline: input.subheadline ?? null,
        bodyHtml: input.bodyHtml ?? null,
        imageUrl: input.imageUrl ?? null,
        ctaText: input.ctaText,
        ctaColor: input.ctaColor,
        skipText: input.skipText,
        isActive: input.isActive,
      });
      return { id: result.insertId };
    }),

  /** Update an existing order bump */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      triggerType: z.enum(["course", "download", "bundle"]).optional(),
      triggerProductId: z.number().optional(),
      bumpType: z.enum(["course", "download", "bundle", "physical"]).optional(),
      bumpProductId: z.number().optional(),
      timing: z.enum(["before_checkout", "after_checkout"]).optional(),
      bumpPrice: z.number().min(0).optional(),
      discountLabel: z.string().nullable().optional(),
      headline: z.string().nullable().optional(),
      subheadline: z.string().nullable().optional(),
      bodyHtml: z.string().nullable().optional(),
      imageUrl: z.string().nullable().optional(),
      ctaText: z.string().optional(),
      ctaColor: z.string().optional(),
      skipText: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const { id, ...data } = input;
      await db.update(orderBumps).set(data).where(eq(orderBumps.id, id));
      return { success: true };
    }),

  /** Delete an order bump */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      await db.delete(orderBumps).where(eq(orderBumps.id, input.id));
      return { success: true };
    }),

  /** Get conversion stats for an order bump */
  stats: protectedProcedure
    .input(z.object({ bumpId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [bump] = await db.select().from(orderBumps).where(eq(orderBumps.id, input.bumpId));
      if (!bump) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        impressions: bump.impressions,
        conversions: bump.conversions,
        conversionRate: bump.impressions > 0 ? ((bump.conversions / bump.impressions) * 100).toFixed(1) : "0.0",
        revenue: bump.conversions * bump.bumpPrice,
      };
    }),

  /** Duplicate an order bump (resets impressions/conversions, marks inactive) */
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [src] = await db.select().from(orderBumps).where(eq(orderBumps.id, input.id)).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });
      const { id: _id, impressions: _imp, conversions: _conv, createdAt: _ca, updatedAt: _ua, ...rest } = src;
      const [result] = await db.insert(orderBumps).values({
        ...rest,
        headline: rest.headline ? `${rest.headline} [Copy]` : null,
        isActive: false,
        impressions: 0,
        conversions: 0,
      });
      return { id: result.insertId };
    }),
});

// ─── Public Router (for checkout flow) ───────────────────────────────────────
export const orderBumpsPublicRouter = router({
  /** Get active bumps for a given trigger product (used at checkout) */
  getForProduct: publicProcedure
    .input(z.object({
      triggerType: z.enum(["course", "download", "bundle"]),
      triggerProductId: z.number(),
      timing: z.enum(["before_checkout", "after_checkout"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions = [
        eq(orderBumps.triggerType, input.triggerType),
        eq(orderBumps.triggerProductId, input.triggerProductId),
        eq(orderBumps.isActive, true),
      ];
      if (input.timing) {
        conditions.push(eq(orderBumps.timing, input.timing));
      }
      const rows = await db.select().from(orderBumps).where(and(...conditions));
      return rows;
    }),

  /** Record an impression (bump was shown to user) */
  recordImpression: publicProcedure
    .input(z.object({ bumpId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.execute(sql`UPDATE order_bumps SET impressions = impressions + 1 WHERE id = ${input.bumpId}`);
      return { success: true };
    }),

  /** Accept a bump offer — creates a conversion record */
  acceptBump: protectedProcedure
    .input(z.object({
      bumpId: z.number(),
      triggerOrderType: z.enum(["course", "download", "bundle"]),
      triggerOrderId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Get the bump details
      const [bump] = await db.select().from(orderBumps).where(eq(orderBumps.id, input.bumpId));
      if (!bump) throw new TRPCError({ code: "NOT_FOUND", message: "Order bump not found" });

      // Record conversion
      await db.insert(orderBumpConversions).values({
        bumpId: input.bumpId,
        userId: ctx.user.id,
        triggerOrderType: input.triggerOrderType,
        triggerOrderId: input.triggerOrderId ?? null,
        bumpAmount: bump.bumpPrice,
        status: "pending",
      });

      // Increment conversions counter
      await db.execute(sql`UPDATE order_bumps SET conversions = conversions + 1 WHERE id = ${input.bumpId}`);

      return { 
        success: true, 
        bumpId: bump.id,
        bumpPrice: bump.bumpPrice,
        bumpType: bump.bumpType,
        bumpProductId: bump.bumpProductId,
        headline: bump.headline,
      };
    }),
});
