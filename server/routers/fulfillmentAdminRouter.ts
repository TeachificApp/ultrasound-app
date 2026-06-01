/**
 * Fulfillment Admin Router — UltrasoundAssist™
 *
 * Admin-only procedures for viewing and retrying failed/pending fulfillments.
 * This is the safety net UI: when a student pays but doesn't get access,
 * an admin can see the failed record and retry it with one click.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getOrCreateUserByEmail } from "../db";
import { pendingFulfillments, lmsEnrollments, digitalPurchases, brandMemberships } from "../../drizzle/schema";
import { and, eq, desc, or, inArray, sql } from "drizzle-orm";
import { executeFulfillment, FulfillmentInput } from "../lib/fulfillmentEngine";
import { notifyOwner } from "../_core/notification";

// Admin guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const fulfillmentAdminRouter = router({
  /**
   * List pending and failed fulfillments (most recent first).
   * Includes completed ones for audit trail.
   */
  list: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "failed", "completed", "all"]).default("all"),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const query = db
        .select()
        .from(pendingFulfillments)
        .orderBy(desc(pendingFulfillments.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      if (input.status !== "all") {
        const rows = await db
          .select()
          .from(pendingFulfillments)
          .where(eq(pendingFulfillments.status, input.status as any))
          .orderBy(desc(pendingFulfillments.createdAt))
          .limit(input.limit)
          .offset(input.offset);
        return rows;
      }

      return query;
    }),

  /**
   * Get summary stats: counts by status.
   */
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [pending, failed, completed] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(pendingFulfillments)
        .where(eq(pendingFulfillments.status, "pending")),
      db.select({ count: sql<number>`COUNT(*)` }).from(pendingFulfillments)
        .where(eq(pendingFulfillments.status, "failed")),
      db.select({ count: sql<number>`COUNT(*)` }).from(pendingFulfillments)
        .where(eq(pendingFulfillments.status, "completed")),
    ]);

    return {
      pending: Number(pending[0]?.count ?? 0),
      failed: Number(failed[0]?.count ?? 0),
      completed: Number(completed[0]?.count ?? 0),
    };
  }),

  /**
   * Retry a specific fulfillment record.
   * Re-runs the fulfillment engine for the given record ID.
   */
  retry: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [record] = await db
        .select()
        .from(pendingFulfillments)
        .where(eq(pendingFulfillments.id, input.id))
        .limit(1);

      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fulfillment record not found" });
      }

      // If no user ID, try to resolve by email
      let userId = record.userId;
      if (!userId && record.email) {
        try {
          const nameParts = (record.customerName || "").split(" ");
          const { user } = await getOrCreateUserByEmail({
            email: record.email,
            firstName: nameParts[0] || undefined,
            lastName: nameParts.slice(1).join(" ") || undefined,
            name: record.customerName || undefined,
          });
          userId = user.id;
        } catch (err) {
          console.error(`[FulfillmentAdmin] Failed to resolve user for retry:`, err);
        }
      }

      // Parse additional access items
      let additionalAccess: FulfillmentInput["additionalAccess"] = null;
      if (record.additionalAccessJson) {
        try {
          additionalAccess = JSON.parse(record.additionalAccessJson);
        } catch { /* ignore */ }
      }

      const result = await executeFulfillment(db as any, {
        stripePaymentIntentId: record.stripePaymentIntentId,
        userId,
        email: record.email,
        customerName: record.customerName,
        productName: record.productName,
        productType: record.productType as any,
        courseId: record.courseId,
        productId: record.productId,
        fulfillmentBrand: record.fulfillmentBrand as any,
        additionalAccess,
        amountPaid: Number(record.amountPaid),
      }, record.id);

      await notifyOwner({
        title: `🔄 Fulfillment Retried — ${record.productName}`,
        content: `Admin retried fulfillment #${record.id} for ${record.email}.\nResult: ${result.success ? "SUCCESS" : "FAILED"}\nNotes: ${result.notes.join(", ") || "(none)"}\n${result.error ? `Error: ${result.error}` : ""}`,
      }).catch(() => {});

      return result;
    }),

  /**
   * Manually grant access to a user for a specific product.
   * Creates a completed fulfillment record for audit trail.
   */
  manualGrant: adminProcedure
    .input(z.object({
      email: z.string().email(),
      productType: z.enum(["course", "download", "physical", "membership", "bundle", "other"]),
      courseId: z.number().optional(),
      productId: z.number().optional(),
      fulfillmentBrand: z.enum(["aaus", "iheartecho", "both"]).optional(),
      productName: z.string().default("Manual Grant"),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Resolve user
      let userId: number | null = null;
      try {
        const { user } = await getOrCreateUserByEmail({ email: input.email });
        userId = user.id;
      } catch (err) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Cannot find or create user for email: ${input.email}` });
      }

      // Create a pending record first
      const [insertResult] = await db.insert(pendingFulfillments).values({
        stripePaymentIntentId: null,
        userId,
        email: input.email,
        customerName: null,
        productName: input.productName,
        productType: input.productType,
        courseId: input.courseId ?? null,
        productId: input.productId ?? null,
        fulfillmentBrand: input.fulfillmentBrand ?? null,
        additionalAccessJson: null,
        amountPaid: "0.00",
        status: "pending",
        attempts: 0,
      });
      const recordId = (insertResult as any).insertId as number;

      const result = await executeFulfillment(db as any, {
        stripePaymentIntentId: null,
        userId,
        email: input.email,
        customerName: null,
        productName: input.productName,
        productType: input.productType,
        courseId: input.courseId ?? null,
        productId: input.productId ?? null,
        fulfillmentBrand: input.fulfillmentBrand ?? null,
        additionalAccess: null,
        amountPaid: 0,
      }, recordId);

      await notifyOwner({
        title: `✅ Manual Access Grant — ${input.productName}`,
        content: `Admin manually granted access to ${input.email}.\nProduct: ${input.productName}\nType: ${input.productType}${input.courseId ? `\nCourse ID: ${input.courseId}` : ""}${input.productId ? `\nProduct ID: ${input.productId}` : ""}${input.fulfillmentBrand ? `\nBrand: ${input.fulfillmentBrand}` : ""}\nResult: ${result.notes.join(", ") || "(none)"}${input.note ? `\nNote: ${input.note}` : ""}`,
      }).catch(() => {});

      return { ...result, userId };
    }),

  /**
   * Get a single fulfillment record by ID.
   */
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [record] = await db
        .select()
        .from(pendingFulfillments)
        .where(eq(pendingFulfillments.id, input.id))
        .limit(1);

      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      return record;
    }),

  /**
   * Retry all pending/failed fulfillments (batch retry).
   * Processes up to 50 at a time to avoid timeouts.
   */
  retryAll: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const records = await db
      .select()
      .from(pendingFulfillments)
      .where(
        or(
          eq(pendingFulfillments.status, "pending"),
          eq(pendingFulfillments.status, "failed")
        )
      )
      .orderBy(desc(pendingFulfillments.createdAt))
      .limit(50);

    let successCount = 0;
    let failCount = 0;

    for (const record of records) {
      // Skip records with no user ID and no email
      if (!record.userId && !record.email) {
        failCount++;
        continue;
      }

      let userId = record.userId;
      if (!userId && record.email) {
        try {
          const { user } = await getOrCreateUserByEmail({ email: record.email });
          userId = user.id;
        } catch { failCount++; continue; }
      }

      let additionalAccess: FulfillmentInput["additionalAccess"] = null;
      if (record.additionalAccessJson) {
        try { additionalAccess = JSON.parse(record.additionalAccessJson); } catch { /* ignore */ }
      }

      const result = await executeFulfillment(db as any, {
        stripePaymentIntentId: record.stripePaymentIntentId,
        userId,
        email: record.email,
        customerName: record.customerName,
        productName: record.productName,
        productType: record.productType as any,
        courseId: record.courseId,
        productId: record.productId,
        fulfillmentBrand: record.fulfillmentBrand as any,
        additionalAccess,
        amountPaid: Number(record.amountPaid),
      }, record.id);

      if (result.success) successCount++;
      else failCount++;
    }

    return { processed: records.length, success: successCount, failed: failCount };
  }),
});
