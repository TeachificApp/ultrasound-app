/**
 * adminUserRouter.ts
 * Admin procedures for managing individual users/students:
 *  - getUserDetail: full profile + purchases + subscriptions + certificates
 *  - updateUserRole: change user role
 *  - enrollInCourse: manually enroll user in an LMS course
 *  - unenrollFromCourse: remove enrollment
 *  - issueCertificate: manually issue a certificate for a course
 *  - removeCertificate: revoke a certificate
 *  - grantBrandMembership: grant premium access to a brand
 *  - revokeBrandMembership: downgrade to free / cancel brand membership
 *  - cancelStripeSubscription: cancel a Stripe subscription
 *  - refundPayment: issue a full refund on a Stripe payment intent
 *  - listAllCourses: for the enroll dropdown
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  users,
  lmsEnrollments,
  lmsCourses,
  lmsCertificates,
  brandMemberships,
  funnelPurchases,
  digitalPurchases,
  digitalProducts,
  physicalProductOrders,
  physicalProducts,
  lmsOrders,
  digitalBundlePurchases,
  digitalBundles,
  membershipSubscriptions,
  membershipPlans,
  lmsCertificates,
  lmsGroupSeats,
  lmsGroupCourses,
  lmsGroups,
} from "../../drizzle/schema";
import { and, eq, desc, sql, count } from "drizzle-orm";
import { storagePut } from "../storage";
import { generateCertificatePdf } from "../lib/certificateGenerator";
import { sendCertificateEmail } from "../lib/certificateEmail";
import { sendEmail, buildFunnelPurchaseConfirmationEmail } from "../_core/email";
import { generateAutoLoginToken } from "../routes/autoLogin";
import { or, like, gte, lte } from "drizzle-orm";

async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const adminUserRouter = router({
  /** Full user detail: profile, enrollments, purchases, subscriptions, certificates */
  getUserDetail: protectedProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Profile
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          displayName: users.displayName,
          email: users.email,
          avatarUrl: users.avatarUrl,
          role: users.role,
          bio: users.bio,
          specialty: users.specialty,
          location: users.location,
          website: users.website,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // LMS enrollments with progress
      const enrollments = await db.execute(sql`
        SELECT
          e.id AS enrollmentId,
          e.enrolled_at AS enrolledAt,
          e.completed_at AS completedAt,
          e.progress_pct AS progressPct,
          c.id AS courseId,
          c.title AS courseTitle,
          c.slug AS courseSlug,
          c.thumbnail_url AS thumbnailUrl,
          (SELECT COUNT(*) FROM lms_video_events WHERE user_id = ${input.userId} AND course_id = c.id AND event_type = 'complete') AS videosCompleted,
          (SELECT COUNT(*) FROM lms_quiz_attempts WHERE user_id = ${input.userId} AND course_id = c.id) AS quizAttempts,
          (SELECT ROUND(AVG(score),1) FROM lms_quiz_attempts WHERE user_id = ${input.userId} AND course_id = c.id) AS avgQuizScore
        FROM lms_enrollments e
        JOIN lms_courses c ON c.id = e.course_id
        WHERE e.user_id = ${input.userId}
        ORDER BY e.enrolled_at DESC
      `);

      // Certificates
      const certs = await db.execute(sql`
        SELECT
          cert.id,
          cert.course_id AS courseId,
          cert.enrollment_id AS enrollmentId,
          cert.certificate_url AS certificateUrl,
          cert.issued_at AS issuedAt,
          c.title AS courseTitle
        FROM lms_certificates cert
        JOIN lms_courses c ON c.id = cert.course_id
        WHERE cert.user_id = ${input.userId}
        ORDER BY cert.issued_at DESC
      `);

      // Brand memberships
      const memberships = await db
        .select()
        .from(brandMemberships)
        .where(eq(brandMemberships.userId, input.userId))
        .orderBy(desc(brandMemberships.createdAt));

      // Funnel/inline checkout purchases
      const funnelPurchaseList = await db
        .select()
        .from(funnelPurchases)
        .where(eq(funnelPurchases.userId, input.userId))
        .orderBy(desc(funnelPurchases.createdAt));

      // Digital product purchases
      const digitalPurchaseList = await db.execute(sql`
        SELECT
          dp.id,
          dp.purchased_at AS purchasedAt,
          dprod.title AS productTitle,
          dprod.slug AS productSlug,
          dprod.thumbnail_url AS thumbnailUrl
        FROM digital_purchases dp
        JOIN digital_products dprod ON dprod.id = dp.product_id
        WHERE dp.user_id = ${input.userId}
        ORDER BY dp.purchased_at DESC
      `);

      // Physical product orders
      const physicalOrderList = await db.execute(sql`
        SELECT
          po.id,
          po.created_at AS createdAt,
          po.amount_paid AS amountPaid,
          po.currency,
          po.fulfillment_status AS fulfillmentStatus,
          po.shipping_address AS shippingAddress,
          pp.title AS productTitle,
          pp.slug AS productSlug
        FROM physical_product_orders po
        JOIN physical_products pp ON pp.id = po.product_id
        WHERE po.user_id = ${input.userId}
        ORDER BY po.created_at DESC
      `);

      return {
        user,
        enrollments: (enrollments as any[]).map(r => ({
          enrollmentId: Number(r.enrollmentId),
          enrolledAt: r.enrolledAt,
          completedAt: r.completedAt ?? null,
          progressPct: Number(r.progressPct ?? 0),
          courseId: Number(r.courseId),
          courseTitle: String(r.courseTitle),
          courseSlug: String(r.courseSlug),
          thumbnailUrl: r.thumbnailUrl as string | null,
          videosCompleted: Number(r.videosCompleted ?? 0),
          quizAttempts: Number(r.quizAttempts ?? 0),
          avgQuizScore: r.avgQuizScore != null ? Number(r.avgQuizScore) : null,
        })),
        certificates: (certs as any[]).map(r => ({
          id: Number(r.id),
          courseId: Number(r.courseId),
          enrollmentId: Number(r.enrollmentId),
          certificateUrl: String(r.certificateUrl),
          issuedAt: r.issuedAt,
          courseTitle: String(r.courseTitle),
        })),
        memberships,
        funnelPurchases: funnelPurchaseList,
        digitalPurchases: (digitalPurchaseList as any[]).map(r => ({
          id: Number(r.id),
          purchasedAt: r.purchasedAt,
          productTitle: String(r.productTitle),
          productSlug: String(r.productSlug),
          thumbnailUrl: r.thumbnailUrl as string | null,
        })),
        physicalOrders: (physicalOrderList as any[]).map(r => ({
          id: Number(r.id),
          createdAt: r.createdAt,
          amountPaid: Number(r.amountPaid ?? 0),
          currency: String(r.currency ?? "usd"),
          fulfillmentStatus: String(r.fulfillmentStatus ?? "pending"),
          shippingAddress: r.shippingAddress as string | null,
          productTitle: String(r.productTitle),
          productSlug: String(r.productSlug),
        })),
      };
    }),

  /** List all LMS courses for the enroll dropdown */
  listAllCourses: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db
      .select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug })
      .from(lmsCourses)
      .orderBy(lmsCourses.title);
  }),

  /** Update user role */
  updateUserRole: protectedProcedure
    .input(z.object({ userId: z.number().int(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  /** Manually enroll user in an LMS course */
  enrollInCourse: protectedProcedure
    .input(z.object({ userId: z.number().int(), courseId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db
        .select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, input.courseId)))
        .limit(1);
      if (existing) return { enrollmentId: existing.id, alreadyEnrolled: true };
      const [result] = await db
        .insert(lmsEnrollments)
        .values({ userId: input.userId, courseId: input.courseId })
        .$returningId();
      return { enrollmentId: result.id, alreadyEnrolled: false };
    }),

  /** Remove an enrollment by enrollment ID */
  unenrollFromCourse: protectedProcedure
    .input(z.object({ enrollmentId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsEnrollments).where(eq(lmsEnrollments.id, input.enrollmentId));
      return { success: true };
    }),

  /** Manually issue a certificate for a user/course */
  issueCertificate: protectedProcedure
    .input(z.object({ userId: z.number().int(), courseId: z.number().int(), enrollmentId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if already issued
      const [existing] = await db
        .select({ id: lmsCertificates.id })
        .from(lmsCertificates)
        .where(and(eq(lmsCertificates.userId, input.userId), eq(lmsCertificates.courseId, input.courseId)))
        .limit(1);
      if (existing) return { certificateId: existing.id, alreadyIssued: true };

      // Get user and course info
      const [user] = await db.select({ name: users.name, displayName: users.displayName, email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
      const [course] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!user || !course) throw new TRPCError({ code: "NOT_FOUND", message: "User or course not found" });

      // Generate PDF
      const recipientName = user.displayName || user.name || "Student";
      const pdfBuffer = await generateCertificatePdf({
        recipientName,
        courseTitle: course.title,
        completionDate: new Date(),
      });

      const suffix = Date.now();
      const fileKey = `certificates/cert-${input.userId}-${input.courseId}-${suffix}.pdf`;
      const { url: certificateUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      const [result] = await db.insert(lmsCertificates).values({
        userId: input.userId,
        courseId: input.courseId,
        enrollmentId: input.enrollmentId,
        certificateUrl,
      }).$returningId();

      // Send email if user has one
      if (user.email) {
        await sendCertificateEmail({
          to: { name: recipientName, email: user.email },
          courseTitle: course.title,
          certificateUrl,
        }).catch(e => console.error("[adminUser] Certificate email failed:", e));
      }

      return { certificateId: result.id, certificateUrl, alreadyIssued: false };
    }),

  /** Remove a certificate by certificate ID */
  removeCertificate: protectedProcedure
    .input(z.object({ certificateId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCertificates).where(eq(lmsCertificates.id, input.certificateId));
      return { success: true };
    }),

  /** Grant or upgrade brand membership */
  grantBrandMembership: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      brand: z.enum(["aaus", "iheartecho"]),
      tier: z.enum(["free", "premium"]).default("premium"),
      expiresAt: z.string().optional(), // ISO date string
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

      const [existing] = await db
        .select({ id: brandMemberships.id })
        .from(brandMemberships)
        .where(and(eq(brandMemberships.userId, input.userId), eq(brandMemberships.brand, input.brand)))
        .limit(1);

      if (existing) {
        await db.update(brandMemberships)
          .set({ tier: input.tier, status: "active", source: "admin", grantedAt: new Date(), ...(expiresAt ? { expiresAt } : {}) })
          .where(eq(brandMemberships.id, existing.id));
        return { membershipId: existing.id, created: false };
      } else {
        const [result] = await db.insert(brandMemberships).values({
          userId: input.userId,
          brand: input.brand,
          tier: input.tier,
          status: "active",
          source: "admin",
          stripeSubscriptionId: null,
          stripeCustomerId: null,
          ...(expiresAt ? { expiresAt } : {}),
        }).$returningId();
        return { membershipId: result.id, created: true };
      }
    }),

  /** Revoke / downgrade brand membership */
  revokeBrandMembership: protectedProcedure
    .input(z.object({
      membershipId: z.number().int(),
      downgradeToFree: z.boolean().default(false), // true = downgrade to free, false = cancel
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.downgradeToFree) {
        await db.update(brandMemberships)
          .set({ tier: "free", status: "active", source: "admin" })
          .where(eq(brandMemberships.id, input.membershipId));
      } else {
        await db.update(brandMemberships)
          .set({ status: "cancelled", source: "admin" })
          .where(eq(brandMemberships.id, input.membershipId));
      }
      return { success: true };
    }),

  /** Cancel a Stripe subscription (at period end) */
  cancelStripeSubscription: protectedProcedure
    .input(z.object({
      membershipId: z.number().int(),
      stripeSubscriptionId: z.string(),
      immediately: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
      if (!STRIPE_SECRET_KEY) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as any });

      if (input.immediately) {
        await stripe.subscriptions.cancel(input.stripeSubscriptionId);
      } else {
        await stripe.subscriptions.update(input.stripeSubscriptionId, { cancel_at_period_end: true });
      }

      await db.update(brandMemberships)
        .set({ status: "cancelled" })
        .where(eq(brandMemberships.id, input.membershipId));

      return { success: true };
    }),

  /** Issue a full refund on a Stripe payment intent */
  refundPayment: protectedProcedure
    .input(z.object({
      stripePaymentIntentId: z.string(),
      purchaseId: z.number().int().optional(), // funnelPurchases.id
      reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).default("requested_by_customer"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);

      const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
      if (!STRIPE_SECRET_KEY) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as any });

      const refund = await stripe.refunds.create({
        payment_intent: input.stripePaymentIntentId,
        reason: input.reason,
      });

      // Update purchase record status
      if (input.purchaseId) {
        const db = await getDb();
        if (db) {
          await db.update(funnelPurchases)
            .set({ status: "refunded" })
            .where(eq(funnelPurchases.id, input.purchaseId));
        }
      }

      return { refundId: refund.id, status: refund.status };
    }),

  /** Resend the purchase confirmation + auto-login email for a funnel purchase */
  resendAccessEmail: protectedProcedure
    .input(z.object({
      purchaseId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [purchase] = await db
        .select()
        .from(funnelPurchases)
        .where(eq(funnelPurchases.id, input.purchaseId))
        .limit(1);

      if (!purchase) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });

      const recipientEmail = purchase.email;
      const firstName = (purchase.name || recipientEmail.split("@")[0]).split(" ")[0];

      // Generate a fresh auto-login token
      let loginUrl = `${process.env.VITE_OAUTH_PORTAL_URL || "https://app.allaboutultrasound.com"}/dashboard`;
      if (purchase.userId) {
        try {
          loginUrl = await generateAutoLoginToken(purchase.userId, loginUrl);
        } catch (e) {
          console.warn("[ResendEmail] Could not generate auto-login token:", e);
        }
      }

      const { subject, htmlBody } = buildFunnelPurchaseConfirmationEmail({
        firstName,
        productName: purchase.productName,
        amountPaid: purchase.amountPaid,
        orderBumps: purchase.orderBumps ? JSON.parse(purchase.orderBumps as string) : [],
        loginUrl,
      });

      const sent = await sendEmail({
        to: recipientEmail,
        subject: `[Resent] ${subject}`,
        htmlBody,
      });

      return { success: sent };
    }),

  /** List all sales across ALL purchase tables (funnel, courses, downloads, bundles, memberships) */
  listAllSales: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
      status: z.enum(["all", "paid", "pending", "refunded", "failed"]).default("all"),
      search: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const offset = (input.page - 1) * input.pageSize;
      const dateFrom = input.dateFrom ? new Date(input.dateFrom) : null;
      const dateTo = input.dateTo ? (() => { const d = new Date(input.dateTo!); d.setHours(23,59,59,999); return d; })() : null;
      const search = input.search?.toLowerCase();
      const statusFilter = input.status !== "all" ? input.status : null;

      // Build a UNION across all purchase tables using raw SQL for flexibility
      const rows = await db.execute(sql`
        SELECT * FROM (
          -- 1. Funnel purchases (already has all fields)
          SELECT
            CONCAT('fp-', fp.id) AS uid,
            fp.id AS sourceId,
            'funnel' AS sourceTable,
            fp.user_id AS userId,
            COALESCE(fp.email, u.email, '') AS email,
            COALESCE(fp.name, u.name, '') AS name,
            fp.product_name AS productName,
            fp.product_type AS productType,
            fp.amount_paid AS amountPaid,
            fp.currency,
            fp.status,
            fp.stripe_payment_intent_id AS stripePaymentIntentId,
            fp.purchased_at AS purchasedAt
          FROM funnel_purchases fp
          LEFT JOIN users u ON fp.user_id = u.id

          UNION ALL

          -- 2. LMS course orders
          SELECT
            CONCAT('lo-', lo.id) AS uid,
            lo.id AS sourceId,
            'course' AS sourceTable,
            lo.user_id AS userId,
            COALESCE(u.email, '') AS email,
            COALESCE(u.name, '') AS name,
            COALESCE(c.title, 'Course') AS productName,
            'course' AS productType,
            lo.amount AS amountPaid,
            lo.currency,
            lo.status,
            lo.stripe_payment_intent_id AS stripePaymentIntentId,
            lo.created_at AS purchasedAt
          FROM lms_orders lo
          LEFT JOIN users u ON lo.user_id = u.id
          LEFT JOIN lms_courses c ON lo.course_id = c.id

          UNION ALL

          -- 3. Digital product (download) purchases
          SELECT
            CONCAT('dp-', dp.id) AS uid,
            dp.id AS sourceId,
            'download' AS sourceTable,
            dp.user_id AS userId,
            COALESCE(u.email, '') AS email,
            COALESCE(u.name, '') AS name,
            COALESCE(prod.title, 'Download') AS productName,
            'download' AS productType,
            COALESCE(prod.price, 0) AS amountPaid,
            COALESCE(prod.currency, 'usd') AS currency,
            'paid' AS status,
            dp.stripe_payment_intent_id AS stripePaymentIntentId,
            dp.purchased_at AS purchasedAt
          FROM digital_purchases dp
          LEFT JOIN users u ON dp.user_id = u.id
          LEFT JOIN digital_products prod ON dp.product_id = prod.id

          UNION ALL

          -- 4. Bundle purchases
          SELECT
            CONCAT('bp-', dbp.id) AS uid,
            dbp.id AS sourceId,
            'bundle' AS sourceTable,
            dbp.user_id AS userId,
            COALESCE(u.email, '') AS email,
            COALESCE(u.name, '') AS name,
            COALESCE(b.title, 'Bundle') AS productName,
            'bundle' AS productType,
            COALESCE(b.discount_price, b.original_price, 0) AS amountPaid,
            COALESCE(b.currency, 'usd') AS currency,
            'paid' AS status,
            NULL AS stripePaymentIntentId,
            dbp.purchased_at AS purchasedAt
          FROM digital_bundle_purchases dbp
          LEFT JOIN users u ON dbp.user_id = u.id
          LEFT JOIN digital_bundles b ON dbp.bundle_id = b.id

          UNION ALL

          -- 5. Membership subscriptions
          SELECT
            CONCAT('ms-', ms.id) AS uid,
            ms.id AS sourceId,
            'membership' AS sourceTable,
            ms.user_id AS userId,
            COALESCE(u.email, '') AS email,
            COALESCE(u.name, '') AS name,
            COALESCE(mp.title, 'Membership') AS productName,
            'membership' AS productType,
            COALESCE(mp.price, 0) AS amountPaid,
            COALESCE(mp.currency, 'usd') AS currency,
            CASE ms.status WHEN 'active' THEN 'paid' WHEN 'cancelled' THEN 'refunded' ELSE ms.status END AS status,
            ms.stripe_subscription_id AS stripePaymentIntentId,
            ms.created_at AS purchasedAt
          FROM membership_subscriptions ms
          LEFT JOIN users u ON ms.user_id = u.id
          LEFT JOIN membership_plans mp ON ms.plan_id = mp.id
        ) AS all_sales
        WHERE 1=1
          ${statusFilter ? sql`AND status = ${statusFilter}` : sql``}
          ${dateFrom ? sql`AND purchasedAt >= ${dateFrom}` : sql``}
          ${dateTo ? sql`AND purchasedAt <= ${dateTo}` : sql``}
          ${search ? sql`AND (LOWER(email) LIKE ${`%${search}%`} OR LOWER(name) LIKE ${`%${search}%`} OR LOWER(productName) LIKE ${`%${search}%`})` : sql``}
        ORDER BY purchasedAt DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;

      const countResult = await db.execute(sql`
        SELECT COUNT(*) AS total FROM (
          SELECT id FROM funnel_purchases
          ${statusFilter ? sql`WHERE status = ${statusFilter}` : sql``}
          ${dateFrom ? sql`AND purchased_at >= ${dateFrom}` : sql``}
          ${dateTo ? sql`AND purchased_at <= ${dateTo}` : sql``}
          UNION ALL
          SELECT id FROM lms_orders
          ${statusFilter && statusFilter !== 'paid' ? sql`WHERE status = ${statusFilter}` : sql``}
          UNION ALL
          SELECT id FROM digital_purchases
          UNION ALL
          SELECT id FROM digital_bundle_purchases
          UNION ALL
          SELECT id FROM membership_subscriptions
        ) AS t
      `) as any;

      const rowsArr = Array.isArray(rows) ? rows : (rows as any)[0] ?? [];
      const total = Number((Array.isArray(countResult) ? countResult[0] : (countResult as any)[0]?.[0])?.total ?? 0);

      return {
        sales: rowsArr.map((r: any) => ({
          id: r.sourceId,
          uid: r.uid,
          sourceTable: r.sourceTable,
          email: r.email ?? '',
          name: r.name ?? '',
          userId: r.userId,
          productName: r.productName ?? '',
          productType: r.productType ?? 'other',
          amountPaid: Number(r.amountPaid ?? 0),
          currency: r.currency ?? 'usd',
          status: r.status ?? 'paid',
          stripePaymentIntentId: r.stripePaymentIntentId ?? null,
          sourceType: r.sourceTable,
          orderBumps: null,
          purchasedAt: r.purchasedAt ? new Date(r.purchasedAt) : new Date(),
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  // ── Coupon / Promo Code Management ──────────────────────────────────────────
  createCoupon: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      discountType: z.enum(["percent", "fixed"]),
      discountValue: z.number().positive(),
      currency: z.string().default("usd"),
      maxRedemptions: z.number().int().positive().optional(),
      redeemBy: z.string().optional(),
      promoCode: z.string().min(1).max(50).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
      if (!STRIPE_SECRET_KEY) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as any });
      const couponParams: Record<string, unknown> = {
        name: input.name,
        duration: "once",
        ...(input.discountType === "percent"
          ? { percent_off: input.discountValue }
          : { amount_off: Math.round(input.discountValue * 100), currency: input.currency }), // Stripe requires cents
      };
      if (input.maxRedemptions) couponParams.max_redemptions = input.maxRedemptions;
      if (input.redeemBy) couponParams.redeem_by = Math.floor(new Date(input.redeemBy).getTime() / 1000);
      const coupon = await (stripe.coupons as any).create(couponParams);
      let promoCodeObj: Record<string, unknown> | null = null;
      if (input.promoCode) {
        promoCodeObj = await (stripe.promotionCodes as any).create({
          coupon: coupon.id,
          code: input.promoCode.toUpperCase(),
        });
      }
      return { coupon, promoCode: promoCodeObj };
    }),

  listCoupons: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      startingAfter: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
      if (!STRIPE_SECRET_KEY) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as any });
      const params: Record<string, unknown> = { limit: input.limit };
      if (input.startingAfter) params.starting_after = input.startingAfter;
      const coupons = await (stripe.coupons as any).list(params);
      const couponIds: string[] = coupons.data.map((c: any) => c.id);
      const promoCodeResults = await Promise.all(
        couponIds.map((id: string) =>
          (stripe.promotionCodes as any).list({ coupon: id, limit: 10 }).then((r: any) => r.data)
        )
      );
      const promoCodesByCoupon: Record<string, any[]> = {};
      couponIds.forEach((id: string, i: number) => { promoCodesByCoupon[id] = promoCodeResults[i]; });
      return { coupons: coupons.data, hasMore: coupons.has_more, promoCodesByCoupon };
    }),

  deactivateCoupon: protectedProcedure
    .input(z.object({ couponId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
      if (!STRIPE_SECRET_KEY) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as any });
      await (stripe.coupons as any).del(input.couponId);
      return { success: true };
    }),

  deactivatePromoCode: protectedProcedure
    .input(z.object({ promoCodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
      if (!STRIPE_SECRET_KEY) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as any });
      await (stripe.promotionCodes as any).update(input.promoCodeId, { active: false });
      return { success: true };
    }),

  // ── Sales Analytics (UNION across all purchase tables) ───────────────────────
  getSalesAnalytics: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const dateFrom = input.dateFrom ? new Date(input.dateFrom) : null;
      const dateTo = input.dateTo ? (() => { const d = new Date(input.dateTo!); d.setHours(23,59,59,999); return d; })() : null;

      // All paid sales across all tables
      const allSalesQuery = sql`
        SELECT productName, productType, amountPaid, purchasedAt FROM (
          SELECT fp.product_name AS productName, fp.product_type AS productType, fp.amount_paid AS amountPaid, fp.purchased_at AS purchasedAt
          FROM funnel_purchases fp WHERE fp.status = 'paid'
          UNION ALL
          SELECT COALESCE(c.title,'Course'), 'course', lo.amount, lo.created_at
          FROM lms_orders lo LEFT JOIN lms_courses c ON lo.course_id = c.id WHERE lo.status = 'paid'
          UNION ALL
          SELECT COALESCE(prod.title,'Download'), 'download', COALESCE(prod.price,0), dp.purchased_at
          FROM digital_purchases dp LEFT JOIN digital_products prod ON dp.product_id = prod.id
          UNION ALL
          SELECT COALESCE(b.title,'Bundle'), 'bundle', COALESCE(b.discount_price, b.original_price, 0), dbp.purchased_at
          FROM digital_bundle_purchases dbp LEFT JOIN digital_bundles b ON dbp.bundle_id = b.id
          UNION ALL
          SELECT COALESCE(mp.title,'Membership'), 'membership', COALESCE(mp.price,0), ms.created_at
          FROM membership_subscriptions ms LEFT JOIN membership_plans mp ON ms.plan_id = mp.id WHERE ms.status IN ('active','trialing')
        ) AS all_sales
        WHERE 1=1
          ${dateFrom ? sql`AND purchasedAt >= ${dateFrom}` : sql``}
          ${dateTo ? sql`AND purchasedAt <= ${dateTo}` : sql``}
      `;

      const [summaryResult, byProductResult, byTypeResult, dailyResult] = await Promise.all([
        db.execute(sql`SELECT COALESCE(SUM(amountPaid),0) AS totalRevenue, COUNT(*) AS totalSales, COALESCE(AVG(amountPaid),0) AS avgOrderValue FROM (${allSalesQuery}) AS s`) as Promise<any>,
        db.execute(sql`SELECT productName, productType, COALESCE(SUM(amountPaid),0) AS revenue, COUNT(*) AS sales, COALESCE(AVG(amountPaid),0) AS avgPrice FROM (${allSalesQuery}) AS s GROUP BY productName, productType ORDER BY SUM(amountPaid) DESC LIMIT 100`) as Promise<any>,
        db.execute(sql`SELECT productType, COALESCE(SUM(amountPaid),0) AS revenue, COUNT(*) AS sales FROM (${allSalesQuery}) AS s GROUP BY productType ORDER BY SUM(amountPaid) DESC`) as Promise<any>,
        db.execute(sql`SELECT DATE(purchasedAt) AS date, COALESCE(SUM(amountPaid),0) AS revenue, COUNT(*) AS sales FROM (${allSalesQuery}) AS s GROUP BY DATE(purchasedAt) ORDER BY DATE(purchasedAt) ASC`) as Promise<any>,
      ]);

      const toArr = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);
      const summaryArr = toArr(summaryResult);
      const summary = summaryArr[0] ?? {};

      return {
        summary: {
          totalRevenue: Number(summary.totalRevenue ?? 0),
          totalSales: Number(summary.totalSales ?? 0),
          avgOrderValue: Number(summary.avgOrderValue ?? 0),
        },
        byProduct: toArr(byProductResult).map((r: any) => ({
          productName: r.productName ?? '',
          productType: r.productType ?? 'other',
          revenue: Number(r.revenue ?? 0),
          sales: Number(r.sales ?? 0),
          avgPrice: Number(r.avgPrice ?? 0),
        })),
        byType: toArr(byTypeResult).map((r: any) => ({
          productType: r.productType ?? 'other',
          revenue: Number(r.revenue ?? 0),
          sales: Number(r.sales ?? 0),
        })),
        dailySeries: toArr(dailyResult).map((r: any) => ({
          date: r.date,
          revenue: Number(r.revenue ?? 0),
          sales: Number(r.sales ?? 0),
        })),
      };
    }),

  /** Member Management Overview: stats, growth chart, status breakdown, recent members, activity feed */
  getMemberOverview: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);

    const [totalRow] = await db.execute(sql`SELECT COUNT(*) as total FROM users`) as any;
    const totalMembers = Number(toArr2(totalRow)[0]?.total ?? 0);

    const [activeRow] = await db.execute(sql`SELECT COUNT(*) as total FROM users WHERE last_signed_in >= DATE_SUB(NOW(), INTERVAL 30 DAY)`) as any;
    const activeMembers = Number(toArr2(activeRow)[0]?.total ?? 0);

    const [newRow] = await db.execute(sql`SELECT COUNT(*) as total FROM users WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`) as any;
    const newThisMonth = Number(toArr2(newRow)[0]?.total ?? 0);

    const [newLastRow] = await db.execute(sql`SELECT COUNT(*) as total FROM users WHERE created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01')`) as any;
    const newLastMonth = Number(toArr2(newLastRow)[0]?.total ?? 0);

    const [completionRow] = await db.execute(sql`SELECT COUNT(*) as total FROM lms_enrollments WHERE completed_at IS NOT NULL`) as any;
    const totalCompletions = Number(toArr2(completionRow)[0]?.total ?? 0);

    const [growthRows] = await db.execute(sql`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `) as any;
    const memberGrowth = toArr2(growthRows).map((r: any) => ({ month: r.month, count: Number(r.count) }));

    const [recentRows] = await db.execute(sql`
      SELECT u.id, u.name, u.email, u.avatar_url, u.created_at, u.last_signed_in,
        (SELECT COUNT(*) FROM lms_enrollments e WHERE e.user_id = u.id) as enrollment_count,
        (SELECT COUNT(*) FROM lms_enrollments e WHERE e.user_id = u.id AND e.completed_at IS NOT NULL) as completion_count
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 10
    `) as any;
    const recentMembers = toArr2(recentRows).map((r: any) => ({
      id: Number(r.id),
      name: r.name ?? r.email ?? 'Unknown',
      email: r.email ?? '',
      avatarUrl: r.avatar_url ?? null,
      createdAt: r.created_at,
      lastSignedIn: r.last_signed_in ?? null,
      enrollmentCount: Number(r.enrollment_count ?? 0),
      completionCount: Number(r.completion_count ?? 0),
      progress: Number(r.enrollment_count ?? 0) > 0 ? Math.round((Number(r.completion_count ?? 0) / Number(r.enrollment_count)) * 100) : 0,
    }));

    const [activityRows] = await db.execute(sql`
      SELECT 'enrollment' as type, u.name as user_name, u.avatar_url, c.title as subject, e.enrolled_at as occurred_at
      FROM lms_enrollments e
      JOIN users u ON u.id = e.user_id
      JOIN lms_courses c ON c.id = e.course_id
      UNION ALL
      SELECT 'completion' as type, u.name as user_name, u.avatar_url, c.title as subject, e.completed_at as occurred_at
      FROM lms_enrollments e
      JOIN users u ON u.id = e.user_id
      JOIN lms_courses c ON c.id = e.course_id
      WHERE e.completed_at IS NOT NULL
      UNION ALL
      SELECT 'certificate' as type, u.name as user_name, u.avatar_url, c.title as subject, cert.issued_at as occurred_at
      FROM lms_certificates cert
      JOIN users u ON u.id = cert.user_id
      JOIN lms_courses c ON c.id = cert.course_id
      ORDER BY occurred_at DESC
      LIMIT 15
    `) as any;
    const recentActivity = toArr2(activityRows).map((r: any) => ({
      type: r.type as string,
      userName: r.user_name ?? 'Unknown',
      avatarUrl: r.avatar_url ?? null,
      subject: r.subject ?? '',
      occurredAt: r.occurred_at,
    }));

    return {
      stats: {
        totalMembers,
        activeMembers,
        newThisMonth,
        newLastMonth,
        totalCompletions,
        engagementRate: totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0,
      },
      memberGrowth,
      statusBreakdown: [
        { status: 'Active', count: activeMembers },
        { status: 'Inactive', count: Math.max(0, totalMembers - activeMembers) },
      ],
      recentMembers,
      recentActivity,
    };
  }),

  /** List all issued certificates with pagination and filters */
  getCertificateList: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      courseId: z.number().int().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);
      const offset = (input.page - 1) * input.pageSize;

      const searchFilter = input.search
        ? sql`(u.name LIKE ${`%${input.search}%`} OR u.email LIKE ${`%${input.search}%`})`
        : sql`1=1`;
      const courseFilter = input.courseId ? sql`cert.course_id = ${input.courseId}` : sql`1=1`;

      const [rows] = await db.execute(sql`
        SELECT
          cert.id, cert.user_id, cert.course_id, cert.certificate_url, cert.issued_at,
          u.name AS user_name, u.email AS user_email, u.avatar_url,
          c.title AS course_title, c.slug AS course_slug
        FROM lms_certificates cert
        JOIN users u ON u.id = cert.user_id
        JOIN lms_courses c ON c.id = cert.course_id
        WHERE ${searchFilter} AND ${courseFilter}
        ORDER BY cert.issued_at DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;

      const [countRow] = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM lms_certificates cert
        JOIN users u ON u.id = cert.user_id
        WHERE ${searchFilter} AND ${courseFilter}
      `) as any;
      const total = Number(toArr2(countRow)[0]?.total ?? 0);

      return {
        certificates: toArr2(rows).map((r: any) => ({
          id: Number(r.id),
          userId: Number(r.user_id),
          courseId: Number(r.course_id),
          certificateUrl: r.certificate_url ?? '',
          issuedAt: r.issued_at,
          userName: r.user_name ?? r.user_email ?? 'Unknown',
          userEmail: r.user_email ?? '',
          avatarUrl: r.avatar_url ?? null,
          courseTitle: r.course_title ?? 'Unknown Course',
          courseSlug: r.course_slug ?? '',
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /** Enrollment analytics: per-course breakdown with completion rates */
  getEnrollmentAnalytics: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);

      const dateFrom = input.dateFrom ? new Date(input.dateFrom) : null;
      const dateTo = input.dateTo ? (() => { const d = new Date(input.dateTo!); d.setHours(23,59,59,999); return d; })() : null;

      const dateFilter = dateFrom && dateTo
        ? sql`e.enrolled_at BETWEEN ${dateFrom} AND ${dateTo}`
        : dateFrom
        ? sql`e.enrolled_at >= ${dateFrom}`
        : dateTo
        ? sql`e.enrolled_at <= ${dateTo}`
        : sql`1=1`;

      const [courseRows] = await db.execute(sql`
        SELECT
          c.id AS courseId,
          c.title AS courseTitle,
          c.slug AS courseSlug,
          c.thumbnail_url AS thumbnailUrl,
          COUNT(e.id) AS enrollments,
          SUM(CASE WHEN e.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completions,
          ROUND(AVG(e.progress_pct), 1) AS avgProgress
        FROM lms_courses c
        LEFT JOIN lms_enrollments e ON e.course_id = c.id AND ${dateFilter}
        WHERE c.status = 'published'
        GROUP BY c.id, c.title, c.slug, c.thumbnail_url
        ORDER BY COUNT(e.id) DESC
        LIMIT 50
      `) as any;

      const [monthlyRows] = await db.execute(sql`
        SELECT DATE_FORMAT(enrolled_at, '%Y-%m') AS month, COUNT(*) AS enrollments
        FROM lms_enrollments
        WHERE enrolled_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY month
        ORDER BY month ASC
      `) as any;

      const [totalRow] = await db.execute(sql`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed,
          ROUND(AVG(progress_pct), 1) AS avgProgress
        FROM lms_enrollments
      `) as any;
      const totals = toArr2(totalRow)[0] ?? {};

      return {
        courses: toArr2(courseRows).map((r: any) => ({
          courseId: Number(r.courseId),
          courseTitle: r.courseTitle ?? 'Unknown',
          courseSlug: r.courseSlug ?? '',
          thumbnailUrl: r.thumbnailUrl ?? null,
          enrollments: Number(r.enrollments ?? 0),
          completions: Number(r.completions ?? 0),
          completionRate: Number(r.enrollments ?? 0) > 0
            ? Math.round((Number(r.completions ?? 0) / Number(r.enrollments)) * 100)
            : 0,
          avgProgress: Number(r.avgProgress ?? 0),
        })),
        monthlyTrend: toArr2(monthlyRows).map((r: any) => ({
          month: r.month,
          enrollments: Number(r.enrollments ?? 0),
        })),
        totals: {
          total: Number(totals.total ?? 0),
          completed: Number(totals.completed ?? 0),
          avgProgress: Number(totals.avgProgress ?? 0),
          completionRate: Number(totals.total ?? 0) > 0
            ? Math.round((Number(totals.completed ?? 0) / Number(totals.total)) * 100)
            : 0,
        },
      };
    }),

  /** Activity feed: recent enrollments, completions, certificates, logins */
  getActivityFeed: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(200).default(50),
      type: z.enum(['all', 'enrollment', 'completion', 'certificate', 'login']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);

      const typeFilter = input.type !== 'all' ? sql`AND event_type = ${input.type}` : sql``;

      const [rows] = await db.execute(sql`
        SELECT * FROM (
          SELECT 'enrollment' AS event_type, u.id AS user_id, u.name AS user_name, u.email AS user_email, u.avatar_url,
            c.title AS subject, NULL AS subject2, e.enrolled_at AS occurred_at
          FROM lms_enrollments e
          JOIN users u ON u.id = e.user_id
          JOIN lms_courses c ON c.id = e.course_id

          UNION ALL

          SELECT 'completion' AS event_type, u.id, u.name, u.email, u.avatar_url,
            c.title, NULL, e.completed_at
          FROM lms_enrollments e
          JOIN users u ON u.id = e.user_id
          JOIN lms_courses c ON c.id = e.course_id
          WHERE e.completed_at IS NOT NULL

          UNION ALL

          SELECT 'certificate' AS event_type, u.id, u.name, u.email, u.avatar_url,
            c.title, NULL, cert.issued_at
          FROM lms_certificates cert
          JOIN users u ON u.id = cert.user_id
          JOIN lms_courses c ON c.id = cert.course_id

          UNION ALL

          SELECT 'login' AS event_type, u.id, u.name, u.email, u.avatar_url,
            NULL, NULL, u.last_signed_in
          FROM users u
          WHERE u.last_signed_in >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) AS feed
        WHERE 1=1 ${typeFilter}
        ORDER BY occurred_at DESC
        LIMIT ${input.limit}
      `) as any;

      return toArr2(rows).map((r: any) => ({
        type: r.event_type as string,
        userId: Number(r.user_id),
        userName: r.user_name ?? r.user_email ?? 'Unknown',
        userEmail: r.user_email ?? '',
        avatarUrl: r.avatar_url ?? null,
        subject: r.subject ?? null,
        occurredAt: r.occurred_at,
      }));
    }),

  /** Group/team invitation stats */
  getInvitationStats: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);

    const [summaryRow] = await db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS revoked
      FROM lms_group_seats
    `) as any;
    const summary = toArr2(summaryRow)[0] ?? {};

    const [groupRows] = await db.execute(sql`
      SELECT
        g.id AS groupId,
        g.name AS groupName,
        c.title AS courseTitle,
        COUNT(gs.id) AS totalSeats,
        SUM(CASE WHEN gs.status = 'active' THEN 1 ELSE 0 END) AS activeSeats,
        SUM(CASE WHEN gs.status = 'pending' THEN 1 ELSE 0 END) AS pendingSeats,
        g.created_at AS createdAt
      FROM lms_groups g
      LEFT JOIN lms_courses c ON c.id = g.course_id
      LEFT JOIN lms_group_seats gs ON gs.group_id = g.id
      GROUP BY g.id, g.name, c.title, g.created_at
      ORDER BY g.created_at DESC
      LIMIT 50
    `) as any;

    const [recentRows] = await db.execute(sql`
      SELECT
        gs.id, gs.email, gs.member_name, gs.status, gs.assigned_at, gs.accepted_at,
        g.name AS groupName,
        c.title AS courseTitle
      FROM lms_group_seats gs
      JOIN lms_groups g ON g.id = gs.group_id
      LEFT JOIN lms_courses c ON c.id = g.course_id
      ORDER BY gs.assigned_at DESC
      LIMIT 25
    `) as any;

    return {
      summary: {
        total: Number(summary.total ?? 0),
        pending: Number(summary.pending ?? 0),
        active: Number(summary.active ?? 0),
        revoked: Number(summary.revoked ?? 0),
      },
      groups: toArr2(groupRows).map((r: any) => ({
        groupId: Number(r.groupId),
        groupName: r.groupName ?? 'Unknown',
        courseTitle: r.courseTitle ?? 'Unknown Course',
        totalSeats: Number(r.totalSeats ?? 0),
        activeSeats: Number(r.activeSeats ?? 0),
        pendingSeats: Number(r.pendingSeats ?? 0),
        createdAt: r.createdAt,
      })),
      recentInvites: toArr2(recentRows).map((r: any) => ({
        id: Number(r.id),
        email: r.email ?? '',
        memberName: r.member_name ?? null,
        status: r.status as string,
        assignedAt: r.assigned_at,
        acceptedAt: r.accepted_at ?? null,
        groupName: r.groupName ?? 'Unknown',
        courseTitle: r.courseTitle ?? 'Unknown Course',
      })),
    };
  }),

  /** Search/list all members with filters and pagination */
  listMembers: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(['all', 'active', 'inactive']).default('all'),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);
      const offset = (input.page - 1) * input.pageSize;

      let statusFilter = sql`1=1`;
      if (input.status === 'active') {
        statusFilter = sql`u.last_signed_in >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
      } else if (input.status === 'inactive') {
        statusFilter = sql`(u.last_signed_in < DATE_SUB(NOW(), INTERVAL 30 DAY) OR u.last_signed_in IS NULL)`;
      }

      let searchFilter = sql`1=1`;
      if (input.search) {
        const s = `%${input.search}%`;
        searchFilter = sql`(u.name LIKE ${s} OR u.email LIKE ${s})`;
      }

      const [rows] = await db.execute(sql`
        SELECT u.id, u.name, u.email, u.avatar_url, u.created_at, u.last_signed_in, u.role,
          (SELECT COUNT(*) FROM lms_enrollments e WHERE e.user_id = u.id) as enrollment_count,
          (SELECT COUNT(*) FROM lms_enrollments e WHERE e.user_id = u.id AND e.completed_at IS NOT NULL) as completion_count
        FROM users u
        WHERE ${statusFilter} AND ${searchFilter}
        ORDER BY u.created_at DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;

      const [countRow] = await db.execute(sql`
        SELECT COUNT(*) as total FROM users u WHERE ${statusFilter} AND ${searchFilter}
      `) as any;
      const total = Number(toArr2(countRow)[0]?.total ?? 0);

      return {
        members: toArr2(rows).map((r: any) => ({
          id: Number(r.id),
          name: r.name ?? r.email ?? 'Unknown',
          email: r.email ?? '',
          avatarUrl: r.avatar_url ?? null,
          createdAt: r.created_at,
          lastSignedIn: r.last_signed_in ?? null,
          role: r.role ?? 'user',
          enrollmentCount: Number(r.enrollment_count ?? 0),
          completionCount: Number(r.completion_count ?? 0),
          progress: Number(r.enrollment_count ?? 0) > 0 ? Math.round((Number(r.completion_count ?? 0) / Number(r.enrollment_count)) * 100) : 0,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),
});
