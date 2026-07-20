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
  manualInvoices, workshopEnrollments, workshops, webinarRegistrations, webinars,
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
      console.log(`[getUserTransactions] userId=${input.userId} page=${input.page}`);
      try {
        // Fetch each source table individually using Drizzle ORM (avoids UNION ALL column-name issues)
        const uid = input.userId;

        // 1. Funnel purchases
        const funnelRows = await db
          .select({
            id: funnelPurchases.id,
            productName: funnelPurchases.productName,
            productType: funnelPurchases.productType,
            amountPaid: funnelPurchases.amountPaid,
            currency: funnelPurchases.currency,
            status: funnelPurchases.status,
            stripePaymentIntentId: funnelPurchases.stripePaymentIntentId,
            purchasedAt: funnelPurchases.purchasedAt,
          })
          .from(funnelPurchases)
          .where(eq(funnelPurchases.userId, uid));

        // 2. LMS course orders
        const courseRows = await db
          .select({
            id: lmsOrders.id,
            courseTitle: lmsCourses.title,
            amountPaid: lmsOrders.amount,
            currency: lmsOrders.currency,
            status: lmsOrders.status,
            stripePaymentIntentId: lmsOrders.stripePaymentIntentId,
            stripeSubscriptionId: lmsOrders.stripeSubscriptionId,
            purchasedAt: lmsOrders.createdAt,
          })
          .from(lmsOrders)
          .leftJoin(lmsCourses, eq(lmsOrders.courseId, lmsCourses.id))
          .where(eq(lmsOrders.userId, uid));

        // 3. Digital download purchases
        const downloadRows = await db
          .select({
            id: digitalPurchases.id,
            productTitle: digitalProducts.title,
            amountPaid: digitalPurchases.amount,
            currency: digitalPurchases.currency,
            status: digitalPurchases.status,
            stripePaymentIntentId: digitalPurchases.stripePaymentIntentId,
            purchasedAt: digitalPurchases.purchasedAt,
          })
          .from(digitalPurchases)
          .leftJoin(digitalProducts, eq(digitalPurchases.productId, digitalProducts.id))
          .where(eq(digitalPurchases.userId, uid));

        // 4. Bundle purchases
        const bundleRows = await db
          .select({
            id: digitalBundlePurchases.id,
            bundleTitle: digitalBundles.title,
            discountPrice: digitalBundles.discountPrice,
            originalPrice: digitalBundles.originalPrice,
            purchasedAt: digitalBundlePurchases.purchasedAt,
          })
          .from(digitalBundlePurchases)
          .leftJoin(digitalBundles, eq(digitalBundlePurchases.bundleId, digitalBundles.id))
          .where(eq(digitalBundlePurchases.userId, uid));

        // 5. Physical product orders
        const physicalRows = await db
          .select({
            id: physicalProductOrders.id,
            productTitle: physicalProducts.title,
            amountPaid: physicalProductOrders.amountPaid,
            currency: physicalProductOrders.currency,
            fulfillmentStatus: physicalProductOrders.fulfillmentStatus,
            stripePaymentIntentId: physicalProductOrders.stripePaymentIntentId,
            orderedAt: physicalProductOrders.orderedAt,
          })
          .from(physicalProductOrders)
          .leftJoin(physicalProducts, eq(physicalProductOrders.productId, physicalProducts.id))
          .where(eq(physicalProductOrders.userId, uid));

        // 6. Workshop enrollments
        const workshopRows = await db
          .select({
            id: workshopEnrollments.id,
            workshopTitle: workshops.title,
            amountPaid: workshopEnrollments.amountPaid,
            currency: workshopEnrollments.currency,
            status: workshopEnrollments.status,
            stripePaymentIntentId: workshopEnrollments.stripePaymentIntentId,
            createdAt: workshopEnrollments.createdAt,
          })
          .from(workshopEnrollments)
          .leftJoin(workshops, eq(workshopEnrollments.workshopId, workshops.id))
          .where(eq(workshopEnrollments.userId, uid));
        // 7. Webinar registrations (paid)
        const webinarRows = await db
          .select({
            id: webinarRegistrations.id,
            webinarTitle: webinars.title,
            webinarPrice: webinars.price,
            stripePaymentIntentId: webinarRegistrations.stripePaymentIntentId,
            registeredAt: webinarRegistrations.registeredAt,
          })
          .from(webinarRegistrations)
          .leftJoin(webinars, eq(webinarRegistrations.webinarId, webinars.id))
          .where(eq(webinarRegistrations.userId, uid));
        // 8. Manual invoices
        const invoiceRows = await db
          .select()
          .from(manualInvoices)
          .where(eq(manualInvoices.userId, uid));

        // Normalize all rows into a unified shape
        type TxnRow = {
          transactionId: number;
          sourceTable: string;
          productName: string;
          productType: string;
          amountPaid: number;
          currency: string;
          status: string;
          stripePaymentIntentId: string | null;
          purchasedAt: Date;
          orderType: string;
          // Extended fields for invoice/receipt
          invoiceNumber: string | null;
          paymentSource: string | null;
          notes: string | null;
          lineItems: Array<{ name: string; amount: number; qty: number }> | null;
        };

        const allTxns: TxnRow[] = [
          ...funnelRows.map(r => ({
            transactionId: r.id,
            sourceTable: 'funnel',
            productName: r.productName || 'Purchase',
            productType: r.productType || 'other',
            amountPaid: Number(r.amountPaid ?? 0),
            currency: r.currency || 'usd',
            status: r.status || 'paid',
            stripePaymentIntentId: r.stripePaymentIntentId ?? null,
            purchasedAt: r.purchasedAt ? new Date(r.purchasedAt) : new Date(),
            orderType: 'one_time',
            invoiceNumber: null,
            paymentSource: 'stripe',
            notes: null,
            lineItems: [{ name: r.productName || 'Purchase', amount: Number(r.amountPaid ?? 0), qty: 1 }],
          })),
          ...courseRows.map(r => ({
            transactionId: r.id,
            sourceTable: 'course',
            productName: r.courseTitle || 'Course',
            productType: 'course',
            amountPaid: Number(r.amountPaid ?? 0),
            currency: r.currency || 'usd',
            status: r.status || 'paid',
            stripePaymentIntentId: r.stripePaymentIntentId ?? null,
            purchasedAt: r.purchasedAt ? new Date(r.purchasedAt) : new Date(),
            orderType: r.stripeSubscriptionId ? 'subscription' : 'one_time',
            invoiceNumber: null,
            paymentSource: 'stripe',
            notes: null,
            lineItems: [{ name: r.courseTitle || 'Course', amount: Number(r.amountPaid ?? 0), qty: 1 }],
          })),
          ...downloadRows.map(r => ({
            transactionId: r.id,
            sourceTable: 'download',
            productName: r.productTitle || 'Download',
            productType: 'download',
            amountPaid: Number(r.amountPaid ?? 0),
            currency: r.currency || 'usd',
            status: r.status || 'paid',
            stripePaymentIntentId: r.stripePaymentIntentId ?? null,
            purchasedAt: r.purchasedAt ? new Date(r.purchasedAt) : new Date(),
            orderType: 'one_time',
            invoiceNumber: null,
            paymentSource: 'stripe',
            notes: null,
            lineItems: [{ name: r.productTitle || 'Download', amount: Number(r.amountPaid ?? 0), qty: 1 }],
          })),
          ...bundleRows.map(r => ({
            transactionId: r.id,
            sourceTable: 'bundle',
            productName: r.bundleTitle || 'Bundle',
            productType: 'bundle',
            amountPaid: Number(r.discountPrice ?? r.originalPrice ?? 0),
            currency: 'usd',
            status: 'paid',
            stripePaymentIntentId: null,
            purchasedAt: r.purchasedAt ? new Date(r.purchasedAt) : new Date(),
            orderType: 'one_time',
            invoiceNumber: null,
            paymentSource: 'stripe',
            notes: null,
            lineItems: [{ name: r.bundleTitle || 'Bundle', amount: Number(r.discountPrice ?? r.originalPrice ?? 0), qty: 1 }],
          })),
          ...physicalRows.map(r => ({
            transactionId: r.id,
            sourceTable: 'physical',
            productName: r.productTitle || 'Physical Product',
            productType: 'physical',
            amountPaid: Number(r.amountPaid ?? 0),
            currency: r.currency || 'usd',
            status: r.fulfillmentStatus || 'pending',
            stripePaymentIntentId: r.stripePaymentIntentId ?? null,
            purchasedAt: r.orderedAt ? new Date(r.orderedAt) : new Date(),
            orderType: 'one_time',
            invoiceNumber: null,
            paymentSource: 'stripe',
            notes: null,
            lineItems: [{ name: r.productTitle || 'Physical Product', amount: Number(r.amountPaid ?? 0), qty: 1 }],
          })),
          ...workshopRows.map(r => ({
            transactionId: r.id,
            sourceTable: 'workshop',
            productName: r.workshopTitle || 'Workshop',
            productType: 'workshop',
            amountPaid: Number(r.amountPaid ?? 0),
            currency: r.currency || 'usd',
            status: r.status || 'active',
            stripePaymentIntentId: r.stripePaymentIntentId ?? null,
            purchasedAt: r.createdAt ? new Date(r.createdAt) : new Date(),
            orderType: 'one_time',
            invoiceNumber: null,
            paymentSource: 'stripe',
            notes: null,
            lineItems: [{ name: r.workshopTitle || 'Workshop', amount: Number(r.amountPaid ?? 0), qty: 1 }],
          })),
          ...webinarRows.filter(r => r.stripePaymentIntentId).map(r => ({
            transactionId: r.id,
            sourceTable: 'webinar',
            productName: r.webinarTitle || 'Webinar',
            productType: 'webinar',
            amountPaid: Number(r.webinarPrice ?? 0),
            currency: 'usd',
            status: 'paid',
            stripePaymentIntentId: r.stripePaymentIntentId ?? null,
            purchasedAt: r.registeredAt ? new Date(r.registeredAt) : new Date(),
            orderType: 'one_time',
            invoiceNumber: null,
            paymentSource: 'stripe',
            notes: null,
            lineItems: [{ name: r.webinarTitle || 'Webinar', amount: Number(r.webinarPrice ?? 0), qty: 1 }],
          })),
          ...invoiceRows.map(r => ({
            transactionId: r.id,
            sourceTable: 'manual_invoice',
            productName: r.description || 'Manual Invoice',
            productType: 'manual',
            amountPaid: Number(r.amountPaid ?? 0),
            currency: r.currency || 'usd',
            status: 'paid',
            stripePaymentIntentId: null,
            purchasedAt: r.paidAt ? new Date(r.paidAt) : new Date(),
            orderType: 'one_time',
            invoiceNumber: r.invoiceNumber ?? null,
            paymentSource: r.paymentSource ?? null,
            notes: r.notes ?? null,
            lineItems: Array.isArray(r.lineItems) ? r.lineItems as Array<{ name: string; amount: number; qty: number }> : null,
          })),
        ];

        // Sort by purchasedAt desc
        allTxns.sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());

        const total = allTxns.length;
        const totalSpent = allTxns.reduce((sum, t) => sum + t.amountPaid, 0);
        const offset = (input.page - 1) * input.pageSize;
        const txns = allTxns.slice(offset, offset + input.pageSize);

        console.log(`[getUserTransactions] userId=${uid} total=${total} spent=${totalSpent} page=${input.page} returning=${txns.length}`);
        return { transactions: txns, total, totalSpent };
      } catch (err: any) {
        console.error(`[getUserTransactions] Error for userId=${input.userId}:`, err?.message ?? err);
        return { transactions: [], total: 0, totalSpent: 0 };
      }
    }),

  /**
   * Create a manual invoice for a user (admin only)
   */
  createManualInvoice: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      description: z.string().min(1),
      lineItems: z.array(z.object({
        name: z.string(),
        amount: z.number().int(), // cents
        qty: z.number().int().default(1),
      })).min(1),
      amountPaid: z.number().int(), // cents
      currency: z.string().default('usd'),
      paidAt: z.string(), // ISO date string
      paymentSource: z.string().optional(),
      notes: z.string().optional(),
      sendEmail: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

      // Generate invoice number
      const [countRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(manualInvoices);
      const invoiceNum = `INV-${new Date().getFullYear()}-${String(Number(countRow?.count ?? 0) + 1).padStart(4, '0')}`;

      const [inserted] = await db.insert(manualInvoices).values({
        userId: input.userId,
        invoiceNumber: invoiceNum,
        description: input.description,
        lineItems: input.lineItems,
        amountPaid: input.amountPaid,
        currency: input.currency,
        paidAt: new Date(input.paidAt),
        paymentSource: input.paymentSource ?? null,
        notes: input.notes ?? null,
        createdBy: ctx.user.id,
      });

      // Optionally send email
      if (input.sendEmail) {
        try {
          const [userRow] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
          if (userRow) {
            const { sendEmail } = await import('../_core/email');
            const fmtCurrency = (cents: number, currency = 'usd') =>
              new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
            const lineItemsHtml = input.lineItems.map(li =>
              `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${li.name}</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #f0f0f0">${fmtCurrency(li.amount * li.qty, input.currency)}</td></tr>`
            ).join('');
            await sendEmail({
              to: { name: userRow.name ?? userRow.email, email: userRow.email },
              subject: `Your Receipt — ${invoiceNum}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff">
                  <h2 style="color:#189aa1;margin-bottom:4px">Receipt</h2>
                  <p style="color:#666;font-size:13px;margin-bottom:24px">All About Ultrasound, Inc. dba iHeartEcho</p>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                    <tr><td style="color:#888;font-size:12px">Invoice #</td><td style="text-align:right;font-size:12px">${invoiceNum}</td></tr>
                    <tr><td style="color:#888;font-size:12px">Date</td><td style="text-align:right;font-size:12px">${new Date(input.paidAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</td></tr>
                    ${input.paymentSource ? `<tr><td style="color:#888;font-size:12px">Payment Method</td><td style="text-align:right;font-size:12px;text-transform:capitalize">${input.paymentSource}</td></tr>` : ''}
                  </table>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                    <thead><tr><th style="text-align:left;padding:6px 0;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151">Description</th><th style="text-align:right;padding:6px 0;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151">Amount</th></tr></thead>
                    <tbody>${lineItemsHtml}</tbody>
                    <tfoot><tr><td style="padding-top:12px;font-weight:bold">Total</td><td style="text-align:right;padding-top:12px;font-weight:bold;color:#189aa1">${fmtCurrency(input.amountPaid, input.currency)}</td></tr></tfoot>
                  </table>
                  ${input.notes ? `<p style="color:#888;font-size:12px;margin-top:16px">${input.notes}</p>` : ''}
                  <p style="color:#aaa;font-size:11px;margin-top:32px">All About Ultrasound, Inc. dba iHeartEcho &bull; allaboutultrasound.com</p>
                </div>
              `,
            });
            console.log(`[createManualInvoice] Receipt email sent to ${userRow.email}`);
          }
        } catch (emailErr: any) {
          console.error('[createManualInvoice] Email error:', emailErr?.message ?? emailErr);
          // Don't fail the whole operation if email fails
        }
      }

      return { success: true, invoiceNumber: invoiceNum };
    }),
});

