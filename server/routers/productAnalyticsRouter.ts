/**
 * productAnalyticsRouter.ts — Per-product/course/funnel analytics
 * 
 * Provides:
 *  - List of all products with purchase counts
 *  - Per-product purchaser list with deep links to user profiles
 *  - Grant access to new/existing users
 *  - Per-funnel analytics with purchaser lists
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql, eq, and, desc, asc } from "drizzle-orm";
import {
  funnelPurchases, lmsOrders, lmsCourses, lmsEnrollments,
  digitalProducts, digitalPurchases, digitalBundles, digitalBundlePurchases,
  physicalProducts, physicalProductOrders, users, funnels, funnelPages,
} from "../../drizzle/schema";

async function assertAdmin(ctx: any) {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
}

export const productAnalyticsRouter = router({
  /**
   * Get all products across all types with purchase counts
   */
  listAllProductsWithStats: protectedProcedure
    .input(z.object({
      type: z.enum(["all", "course", "download", "physical", "bundle", "funnel"]).default("all"),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { products: [] };

      const results: Array<{
        id: number;
        type: string;
        title: string;
        purchaseCount: number;
        revenue: number;
        createdAt: Date | null;
      }> = [];

      const search = input.search?.toLowerCase();

      // Courses
      if (input.type === "all" || input.type === "course") {
        const courses = await db.execute(sql`
          SELECT c.id, c.title, c.created_at AS createdAt,
            COUNT(DISTINCT lo.id) AS purchaseCount,
            COALESCE(SUM(CASE WHEN lo.status = 'paid' THEN lo.amount ELSE 0 END), 0) AS revenue
          FROM lms_courses c
          LEFT JOIN lms_orders lo ON lo.course_id = c.id
          WHERE c.title IS NOT NULL AND c.title != ''
            ${search ? sql`AND LOWER(c.title) LIKE ${'%' + search + '%'}` : sql``}
          GROUP BY c.id, c.title, c.created_at
          ORDER BY purchaseCount DESC
        `) as any;
        const rows = ((courses as any)[0] ?? []) as any[];
        for (const r of rows) {
          results.push({
            id: Number(r.id),
            type: "course",
            title: r.title ?? "Untitled Course",
            purchaseCount: Number(r.purchaseCount ?? 0),
            revenue: Number(r.revenue ?? 0),
            createdAt: r.createdAt ? new Date(r.createdAt) : null,
          });
        }
      }

      // Digital Downloads
      if (input.type === "all" || input.type === "download") {
        const downloads = await db.execute(sql`
          SELECT dp.id, dp.title, dp.created_at AS createdAt, dp.price,
            COUNT(DISTINCT pur.id) AS purchaseCount
          FROM digital_products dp
          LEFT JOIN digital_purchases pur ON pur.product_id = dp.id
          WHERE dp.title IS NOT NULL AND dp.title != ''
            ${search ? sql`AND LOWER(dp.title) LIKE ${'%' + search + '%'}` : sql``}
          GROUP BY dp.id, dp.title, dp.created_at, dp.price
          ORDER BY purchaseCount DESC
        `) as any;
        const rows = ((downloads as any)[0] ?? []) as any[];
        for (const r of rows) {
          results.push({
            id: Number(r.id),
            type: "download",
            title: r.title ?? "Untitled Download",
            purchaseCount: Number(r.purchaseCount ?? 0),
            revenue: Number(r.purchaseCount ?? 0) * Number(r.price ?? 0),
            createdAt: r.createdAt ? new Date(r.createdAt) : null,
          });
        }
      }

      // Physical Products
      if (input.type === "all" || input.type === "physical") {
        const physical = await db.execute(sql`
          SELECT pp.id, pp.title, pp.created_at AS createdAt,
            COUNT(DISTINCT po.id) AS purchaseCount,
            COALESCE(SUM(CASE WHEN po.fulfillment_status IN ('pending', 'processing', 'shipped', 'delivered') THEN po.amount_paid ELSE 0 END), 0) AS revenue
          FROM physical_products pp
          LEFT JOIN physical_product_orders po ON po.product_id = pp.id
          WHERE pp.title IS NOT NULL AND pp.title != ''
            ${search ? sql`AND LOWER(pp.title) LIKE ${'%' + search + '%'}` : sql``}
          GROUP BY pp.id, pp.title, pp.created_at
          ORDER BY purchaseCount DESC
        `) as any;
        const rows = ((physical as any)[0] ?? []) as any[];
        for (const r of rows) {
          results.push({
            id: Number(r.id),
            type: "physical",
            title: r.title ?? "Untitled Product",
            purchaseCount: Number(r.purchaseCount ?? 0),
            revenue: Number(r.revenue ?? 0),
            createdAt: r.createdAt ? new Date(r.createdAt) : null,
          });
        }
      }

      // Bundles
      if (input.type === "all" || input.type === "bundle") {
        const bundles = await db.execute(sql`
          SELECT b.id, b.title, b.created_at AS createdAt, b.discount_price AS price,
            COUNT(DISTINCT bp.id) AS purchaseCount
          FROM digital_bundles b
          LEFT JOIN digital_bundle_purchases bp ON bp.bundle_id = b.id
          WHERE b.title IS NOT NULL AND b.title != ''
            ${search ? sql`AND LOWER(b.title) LIKE ${'%' + search + '%'}` : sql``}
          GROUP BY b.id, b.title, b.created_at, b.discount_price
          ORDER BY purchaseCount DESC
        `) as any;
        const rows = ((bundles as any)[0] ?? []) as any[];
        for (const r of rows) {
          results.push({
            id: Number(r.id),
            type: "bundle",
            title: r.title ?? "Untitled Bundle",
            purchaseCount: Number(r.purchaseCount ?? 0),
            revenue: Number(r.purchaseCount ?? 0) * Number(r.price ?? 0),
            createdAt: r.createdAt ? new Date(r.createdAt) : null,
          });
        }
      }

      // Funnels
      if (input.type === "all" || input.type === "funnel") {
        const funnelData = await db.execute(sql`
          SELECT f.id, f.name AS title, f.created_at AS createdAt,
            COUNT(DISTINCT fp2.id) AS purchaseCount,
            COALESCE(SUM(CASE WHEN fp2.status = 'paid' THEN fp2.amount_paid ELSE 0 END), 0) AS revenue
          FROM funnels f
          LEFT JOIN funnel_purchases fp2 ON fp2.source_funnel_id = f.id
          WHERE f.name IS NOT NULL AND f.name != ''
            ${search ? sql`AND LOWER(f.name) LIKE ${'%' + search + '%'}` : sql``}
          GROUP BY f.id, f.name, f.created_at
          ORDER BY purchaseCount DESC
        `) as any;
        const rows = ((funnelData as any)[0] ?? []) as any[];
        for (const r of rows) {
          results.push({
            id: Number(r.id),
            type: "funnel",
            title: r.title ?? "Untitled Funnel",
            purchaseCount: Number(r.purchaseCount ?? 0),
            revenue: Number(r.revenue ?? 0),
            createdAt: r.createdAt ? new Date(r.createdAt) : null,
          });
        }
      }

      return { products: results };
    }),

  /**
   * Get purchasers for a specific product
   */
  getProductPurchasers: protectedProcedure
    .input(z.object({
      productId: z.number().int(),
      productType: z.enum(["course", "download", "physical", "bundle", "funnel"]),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { purchasers: [], total: 0, totalRevenue: 0 };

      const offset = (input.page - 1) * input.pageSize;
      const search = input.search?.toLowerCase();
      let queryStr: any;

      switch (input.productType) {
        case "course":
          queryStr = sql`
            SELECT lo.id AS transactionId, lo.user_id AS userId,
              COALESCE(u.name, '') AS userName, COALESCE(u.email, '') AS userEmail,
              lo.amount AS amountPaid, lo.currency, lo.status,
              lo.stripe_payment_intent_id AS stripePaymentIntentId,
              lo.created_at AS purchasedAt,
              'course' AS sourceTable
            FROM lms_orders lo
            LEFT JOIN users u ON lo.user_id = u.id
            WHERE lo.course_id = ${input.productId}
              ${search ? sql`AND (LOWER(u.name) LIKE ${`%${search}%`} OR LOWER(u.email) LIKE ${`%${search}%`})` : sql``}
            ORDER BY lo.created_at DESC
            LIMIT ${input.pageSize} OFFSET ${offset}
          `;
          break;
        case "download":
          queryStr = sql`
            SELECT dp.id AS transactionId, dp.user_id AS userId,
              COALESCE(u.name, '') AS userName, COALESCE(u.email, '') AS userEmail,
              COALESCE(prod.price, 0) AS amountPaid, 'usd' AS currency, 'paid' AS status,
              dp.stripe_payment_intent_id AS stripePaymentIntentId,
              dp.purchased_at AS purchasedAt,
              'download' AS sourceTable
            FROM digital_purchases dp
            LEFT JOIN users u ON dp.user_id = u.id
            LEFT JOIN digital_products prod ON dp.product_id = prod.id
            WHERE dp.product_id = ${input.productId}
              ${search ? sql`AND (LOWER(u.name) LIKE ${`%${search}%`} OR LOWER(u.email) LIKE ${`%${search}%`})` : sql``}
            ORDER BY dp.purchased_at DESC
            LIMIT ${input.pageSize} OFFSET ${offset}
          `;
          break;
        case "physical":
          queryStr = sql`
            SELECT po.id AS transactionId, po.user_id AS userId,
              COALESCE(u.name, '') AS userName, COALESCE(u.email, '') AS userEmail,
              po.amount_paid AS amountPaid, 'usd' AS currency, po.fulfillment_status AS status,
              po.stripe_payment_intent_id AS stripePaymentIntentId,
              po.ordered_at AS purchasedAt,
              'physical' AS sourceTable
            FROM physical_product_orders po
            LEFT JOIN users u ON po.user_id = u.id
            WHERE po.product_id = ${input.productId}
              ${search ? sql`AND (LOWER(u.name) LIKE ${`%${search}%`} OR LOWER(u.email) LIKE ${`%${search}%`})` : sql``}
            ORDER BY po.ordered_at DESC
            LIMIT ${input.pageSize} OFFSET ${offset}
          `;
          break;
        case "bundle":
          queryStr = sql`
            SELECT bp.id AS transactionId, bp.user_id AS userId,
              COALESCE(u.name, '') AS userName, COALESCE(u.email, '') AS userEmail,
              COALESCE(b.discount_price, b.original_price, 0) AS amountPaid, 'usd' AS currency, 'paid' AS status,
              NULL AS stripePaymentIntentId,
              bp.purchased_at AS purchasedAt,
              'bundle' AS sourceTable
            FROM digital_bundle_purchases bp
            LEFT JOIN users u ON bp.user_id = u.id
            LEFT JOIN digital_bundles b ON bp.bundle_id = b.id
            WHERE bp.bundle_id = ${input.productId}
              ${search ? sql`AND (LOWER(u.name) LIKE ${`%${search}%`} OR LOWER(u.email) LIKE ${`%${search}%`})` : sql``}
            ORDER BY bp.purchased_at DESC
            LIMIT ${input.pageSize} OFFSET ${offset}
          `;
          break;
        case "funnel":
          queryStr = sql`
            SELECT fp.id AS transactionId, fp.user_id AS userId,
              COALESCE(fp.name, u.name, '') AS userName, COALESCE(fp.email, u.email, '') AS userEmail,
              fp.amount_paid AS amountPaid, fp.currency, fp.status,
              fp.stripe_payment_intent_id AS stripePaymentIntentId,
              fp.purchased_at AS purchasedAt,
              'funnel' AS sourceTable
            FROM funnel_purchases fp
            LEFT JOIN users u ON fp.user_id = u.id
            WHERE fp.source_funnel_id = ${input.productId}
              ${search ? sql`AND (LOWER(COALESCE(fp.name, u.name, '')) LIKE ${`%${search}%`} OR LOWER(COALESCE(fp.email, u.email, '')) LIKE ${`%${search}%`})` : sql``}
            ORDER BY fp.purchased_at DESC
            LIMIT ${input.pageSize} OFFSET ${offset}
          `;
          break;
      }

      const result = await db.execute(queryStr) as any;
      const rows = Array.isArray(result) ? result : (result as any)[0] ?? [];

      // Get total count
      let countQuery: any;
      switch (input.productType) {
        case "course":
          countQuery = sql`SELECT COUNT(*) AS total FROM lms_orders WHERE course_id = ${input.productId}`;
          break;
        case "download":
          countQuery = sql`SELECT COUNT(*) AS total FROM digital_purchases WHERE product_id = ${input.productId}`;
          break;
        case "physical":
          countQuery = sql`SELECT COUNT(*) AS total FROM physical_product_orders WHERE product_id = ${input.productId}`;
          break;
        case "bundle":
          countQuery = sql`SELECT COUNT(*) AS total FROM digital_bundle_purchases WHERE bundle_id = ${input.productId}`;
          break;
        case "funnel":
          countQuery = sql`SELECT COUNT(*) AS total FROM funnel_purchases WHERE source_funnel_id = ${input.productId}`;
          break;
      }
      const countResult = await db.execute(countQuery) as any;
      const total = Number((Array.isArray(countResult) ? countResult[0] : (countResult as any)[0]?.[0])?.total ?? 0);

      // Calculate total revenue
      let revenueQuery: any;
      switch (input.productType) {
        case "course":
          revenueQuery = sql`SELECT COALESCE(SUM(amount), 0) AS rev FROM lms_orders WHERE course_id = ${input.productId} AND status = 'paid'`;
          break;
        case "funnel":
          revenueQuery = sql`SELECT COALESCE(SUM(amount_paid), 0) AS rev FROM funnel_purchases WHERE source_funnel_id = ${input.productId} AND status = 'paid'`;
          break;
        default:
          revenueQuery = null;
      }
      let totalRevenue = 0;
      if (revenueQuery) {
        const revResult = await db.execute(revenueQuery) as any;
        const revRows = Array.isArray(revResult) ? revResult : (revResult as any)[0] ?? [];
        totalRevenue = Number(revRows[0]?.rev ?? 0);
      }

      return {
        purchasers: rows.map((r: any) => ({
          transactionId: Number(r.transactionId),
          userId: r.userId ? Number(r.userId) : null,
          userName: r.userName ?? "",
          userEmail: r.userEmail ?? "",
          amountPaid: Number(r.amountPaid ?? 0),
          currency: r.currency ?? "usd",
          status: r.status ?? "paid",
          stripePaymentIntentId: r.stripePaymentIntentId ?? null,
          purchasedAt: r.purchasedAt ? new Date(r.purchasedAt) : new Date(),
          sourceTable: r.sourceTable,
        })),
        total,
        totalRevenue,
      };
    }),

  /**
   * Grant access to a product for a user (by email or userId)
   */
  grantProductAccess: protectedProcedure
    .input(z.object({
      productId: z.number().int(),
      productType: z.enum(["course", "download", "bundle"]),
      userEmail: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Find or create user by email
      const { getOrCreateUserByEmail } = await import("../db");
      const { user } = await getOrCreateUserByEmail({ email: input.userEmail });

      switch (input.productType) {
        case "course": {
          // Check if already enrolled
          const [existing] = await db.select({ id: lmsEnrollments.id })
            .from(lmsEnrollments)
            .where(and(eq(lmsEnrollments.userId, user.id), eq(lmsEnrollments.courseId, input.productId)))
            .limit(1);
          if (existing) throw new TRPCError({ code: "CONFLICT", message: "User is already enrolled in this course" });
          await db.insert(lmsEnrollments).values({
            userId: user.id,
            courseId: input.productId,
          });
          return { success: true, message: `Enrolled ${input.userEmail} in course` };
        }
        case "download": {
          const [existing] = await db.select({ id: digitalPurchases.id })
            .from(digitalPurchases)
            .where(and(eq(digitalPurchases.userId, user.id), eq(digitalPurchases.productId, input.productId)))
            .limit(1);
          if (existing) throw new TRPCError({ code: "CONFLICT", message: "User already has access to this download" });
          await db.insert(digitalPurchases).values({
            userId: user.id,
            productId: input.productId,
            stripeCheckoutSessionId: "admin_grant",
          });
          return { success: true, message: `Granted download access to ${input.userEmail}` };
        }
        case "bundle": {
          const [existing] = await db.select({ id: digitalBundlePurchases.id })
            .from(digitalBundlePurchases)
            .where(and(eq(digitalBundlePurchases.userId, user.id), eq(digitalBundlePurchases.bundleId, input.productId)))
            .limit(1);
          if (existing) throw new TRPCError({ code: "CONFLICT", message: "User already has access to this bundle" });
          await db.insert(digitalBundlePurchases).values({
            userId: user.id,
            bundleId: input.productId,
            stripeCheckoutSessionId: "admin_grant",
          });
          return { success: true, message: `Granted bundle access to ${input.userEmail}` };
        }
      }
    }),

  /**
   * Get user's transactions (for user profile page)
   */
  getUserTransactions: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { transactions: [], total: 0, totalSpent: 0 };

      const offset = (input.page - 1) * input.pageSize;

      const result = await db.execute(sql`
        SELECT * FROM (
          SELECT fp.id AS transactionId, 'funnel' AS sourceTable,
            fp.product_name AS productName, fp.product_type AS productType,
            fp.amount_paid AS amountPaid, fp.currency, fp.status,
            fp.stripe_payment_intent_id AS stripePaymentIntentId,
            fp.purchased_at AS purchasedAt,
            'one_time' AS orderType
          FROM funnel_purchases fp WHERE fp.user_id = ${input.userId}
          UNION ALL
          SELECT lo.id AS transactionId, 'course' AS sourceTable,
            COALESCE(c.title, 'Course') AS productName, 'course' AS productType,
            lo.amount AS amountPaid, lo.currency, lo.status,
            lo.stripe_payment_intent_id AS stripePaymentIntentId,
            lo.created_at AS purchasedAt,
            CASE WHEN lo.stripe_subscription_id IS NOT NULL THEN 'subscription' ELSE 'one_time' END AS orderType
          FROM lms_orders lo
          LEFT JOIN lms_courses c ON lo.course_id = c.id
          WHERE lo.user_id = ${input.userId}
          UNION ALL
          SELECT dp.id AS transactionId, 'download' AS sourceTable,
            COALESCE(prod.title, 'Download') AS productName, 'download' AS productType,
            COALESCE(prod.price, 0) AS amountPaid, 'usd' AS currency, 'paid' AS status,
            dp.stripe_payment_intent_id AS stripePaymentIntentId,
            dp.purchased_at AS purchasedAt,
            'one_time' AS orderType
          FROM digital_purchases dp
          LEFT JOIN digital_products prod ON dp.product_id = prod.id
          WHERE dp.user_id = ${input.userId}
          UNION ALL
          SELECT bp.id AS transactionId, 'bundle' AS sourceTable,
            COALESCE(b.title, 'Bundle') AS productName, 'bundle' AS productType,
            COALESCE(b.discount_price, b.original_price, 0) AS amountPaid, 'usd' AS currency, 'paid' AS status,
            NULL AS stripePaymentIntentId,
            bp.purchased_at AS purchasedAt,
            'one_time' AS orderType
          FROM digital_bundle_purchases bp
          LEFT JOIN digital_bundles b ON bp.bundle_id = b.id
          WHERE bp.user_id = ${input.userId}
          UNION ALL
          SELECT po.id AS transactionId, 'physical' AS sourceTable,
            COALESCE(pp.title, 'Physical Product') AS productName, 'physical' AS productType,
            po.amount_paid AS amountPaid, 'usd' AS currency, po.fulfillment_status AS status,
            po.stripe_payment_intent_id AS stripePaymentIntentId,
            po.created_at AS purchasedAt,
            'one_time' AS orderType
          FROM physical_product_orders po
          LEFT JOIN physical_products pp ON po.product_id = pp.id
          WHERE po.user_id = ${input.userId}
          UNION ALL
          SELECT mi.id AS transactionId, 'manual_invoice' AS sourceTable,
            mi.description AS productName, 'manual' AS productType,
            mi.amount_paid AS amountPaid, mi.currency, 'paid' AS status,
            NULL AS stripePaymentIntentId,
            mi.paid_at AS purchasedAt,
            'one_time' AS orderType
          FROM manualInvoices mi
          WHERE mi.user_id = ${input.userId}
        ) AS user_txns
        ORDER BY purchasedAt DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;

      const rows = Array.isArray(result) ? result : (result as any)[0] ?? [];

      // Count total
      const countResult = await db.execute(sql`
        SELECT (
          (SELECT COUNT(*) FROM funnel_purchases WHERE user_id = ${input.userId}) +
          (SELECT COUNT(*) FROM lms_orders WHERE user_id = ${input.userId}) +
          (SELECT COUNT(*) FROM digital_purchases WHERE user_id = ${input.userId}) +
          (SELECT COUNT(*) FROM digital_bundle_purchases WHERE user_id = ${input.userId}) +
          (SELECT COUNT(*) FROM physical_product_orders WHERE user_id = ${input.userId}) +
          (SELECT COUNT(*) FROM manualInvoices WHERE user_id = ${input.userId})
        ) AS total
      `) as any;
      const countRows = Array.isArray(countResult) ? countResult : (countResult as any)[0] ?? [];
      const total = Number(countRows[0]?.total ?? 0);

      // Total spent — normalize everything to cents before summing
      // funnel_purchases.amount_paid is in cents (from Stripe amount_total), lms_orders.amount and physical_product_orders.amount_paid are also in cents
      const spentResult = await db.execute(sql`
        SELECT (
          COALESCE((SELECT SUM(amount_paid) FROM funnel_purchases WHERE user_id = ${input.userId} AND status = 'paid'), 0) +
          COALESCE((SELECT SUM(amount) FROM lms_orders WHERE user_id = ${input.userId} AND status = 'paid'), 0) +
          COALESCE((SELECT SUM(amount_paid) FROM physical_product_orders WHERE user_id = ${input.userId} AND fulfillment_status = 'paid'), 0) +
          COALESCE((SELECT SUM(amount_paid) FROM manualInvoices WHERE user_id = ${input.userId}), 0)
        ) AS totalSpent
      `) as any;
      const spentRows = Array.isArray(spentResult) ? spentResult : (spentResult as any)[0] ?? [];
      const totalSpent = Number(spentRows[0]?.totalSpent ?? 0);

      // Normalize amounts: all sources store cents; frontend fmtCurrency divides by 100
      const normalizeAmount = (r: any): number => {
        return Number(r.amountPaid ?? 0); // all sources store cents
      };
      return {
        transactions: rows.map((r: any) => ({
          transactionId: Number(r.transactionId),
          sourceTable: r.sourceTable,
          productName: r.productName ?? "",
          productType: r.productType ?? "other",
          amountPaid: normalizeAmount(r),
          currency: r.currency ?? "usd",
          status: r.status ?? "paid",
          stripePaymentIntentId: r.stripePaymentIntentId ?? null,
          purchasedAt: r.purchasedAt ? new Date(r.purchasedAt) : new Date(),
          orderType: r.orderType ?? 'one_time',
        })),
        total,
        totalSpent,
      };
    }),
});

