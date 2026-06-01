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
  lmsGroupSeats,
  lmsGroupCourses,
  lmsGroups,
  userLoginEvents,
  userActivityLogs,
  emailSendLog,
  userEmailAliases,
  userRoles,
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
        .orderBy(desc(funnelPurchases.purchasedAt));

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

      // Team / group memberships — find all groups this user has a seat in
      const teamSeats = await db.execute(sql`
        SELECT
          gs.id AS seatId,
          gs.group_id AS groupId,
          gs.status AS seatStatus,
          gs.assigned_at AS assignedAt,
          gs.accepted_at AS acceptedAt,
          gs.enrollment_id AS enrollmentId,
          g.name AS groupName,
          g.org_name AS orgName,
          g.admin_email AS adminEmail,
          g.admin_phone AS adminPhone,
          g.website AS orgWebsite,
          g.notes AS groupNotes,
          g.created_at AS groupCreatedAt,
          c.title AS courseTitle,
          c.id AS courseId
        FROM lms_group_seats gs
        JOIN lms_groups g ON g.id = gs.group_id
        LEFT JOIN lms_enrollments e ON e.id = gs.enrollment_id
        LEFT JOIN lms_courses c ON c.id = e.course_id
        WHERE gs.email = (SELECT email FROM users WHERE id = ${input.userId} LIMIT 1)
           OR gs.enrollment_id IN (SELECT id FROM lms_enrollments WHERE user_id = ${input.userId})
        ORDER BY gs.assigned_at DESC
      `);

      // Native membership subscriptions (membership_plans)
      const nativeMemberships = await db.execute(sql`
        SELECT
          ms.id,
          ms.status,
          ms.created_at AS createdAt,
          ms.current_period_start AS currentPeriodStart,
          ms.current_period_end AS currentPeriodEnd,
          ms.stripe_subscription_id AS stripeSubscriptionId,
          mp.id AS planId,
          mp.title AS planTitle,
          mp.slug AS planSlug,
          mp.billing_interval AS billingInterval,
          mp.price,
          mp.currency,
          mp.brand
        FROM membership_subscriptions ms
        JOIN membership_plans mp ON mp.id = ms.plan_id
        WHERE ms.user_id = ${input.userId}
        ORDER BY ms.created_at DESC
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
        teamSeats: (teamSeats as any[]).map(r => ({
          seatId: Number(r.seatId),
          groupId: Number(r.groupId),
          seatStatus: String(r.seatStatus ?? "pending"),
          assignedAt: r.assignedAt,
          acceptedAt: r.acceptedAt ?? null,
          enrollmentId: r.enrollmentId ? Number(r.enrollmentId) : null,
          groupName: String(r.groupName ?? ""),
          orgName: r.orgName ? String(r.orgName) : null,
          adminEmail: r.adminEmail ? String(r.adminEmail) : null,
          adminPhone: r.adminPhone ? String(r.adminPhone) : null,
          orgWebsite: r.orgWebsite ? String(r.orgWebsite) : null,
          groupNotes: r.groupNotes ? String(r.groupNotes) : null,
          groupCreatedAt: r.groupCreatedAt,
          courseTitle: r.courseTitle ? String(r.courseTitle) : null,
          courseId: r.courseId ? Number(r.courseId) : null,
        })),
        nativeMemberships: (nativeMemberships as any[]).map(r => ({
          id: Number(r.id),
          status: String(r.status ?? "active"),
          createdAt: r.createdAt,
          currentPeriodStart: r.currentPeriodStart ? Number(r.currentPeriodStart) : null,
          currentPeriodEnd: r.currentPeriodEnd ? Number(r.currentPeriodEnd) : null,
          stripeSubscriptionId: r.stripeSubscriptionId ? String(r.stripeSubscriptionId) : null,
          planId: Number(r.planId),
          planTitle: String(r.planTitle ?? ""),
          planSlug: String(r.planSlug ?? ""),
          billingInterval: String(r.billingInterval ?? "one_time"),
          price: Number(r.price ?? 0),
          currency: String(r.currency ?? "usd"),
          brand: r.brand ? String(r.brand) : null,
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
          WHERE 1=1
          ${statusFilter ? sql`AND status = ${statusFilter}` : sql``}
          ${dateFrom ? sql`AND purchased_at >= ${dateFrom}` : sql``}
          ${dateTo ? sql`AND purchased_at <= ${dateTo}` : sql``}
          UNION ALL
          SELECT id FROM lms_orders
          WHERE 1=1
          ${statusFilter && statusFilter !== 'paid' ? sql`AND status = ${statusFilter}` : sql``}
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
          SELECT COALESCE(c.title,'Course'), 'course', lo.amount/100.0, lo.created_at
          FROM lms_orders lo LEFT JOIN lms_courses c ON lo.course_id = c.id WHERE lo.status = 'paid'
          UNION ALL
          SELECT COALESCE(prod.title,'Download'), 'download', COALESCE(dp.amount_paid,0)/100.0, dp.purchased_at
          FROM digital_purchases dp LEFT JOIN digital_products prod ON dp.product_id = prod.id
          UNION ALL
          SELECT COALESCE(b.title,'Bundle'), 'bundle', COALESCE(b.discount_price, b.original_price, 0)/100.0, dbp.purchased_at
          FROM digital_bundle_purchases dbp LEFT JOIN digital_bundles b ON dbp.bundle_id = b.id
          UNION ALL
          SELECT COALESCE(mp.title,'Membership'), 'membership', COALESCE(mp.price,0)/100.0, ms.created_at
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
          date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date ?? ''),
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

    // NOTE: users table stores columns as camelCase in DB (createdAt, lastSignedIn, avatarUrl)
    // lms_enrollments uses snake_case (enrolled_at, completed_at)
    const [activeRow] = await db.execute(sql`SELECT COUNT(*) as total FROM users WHERE lastSignedIn >= DATE_SUB(NOW(), INTERVAL 30 DAY)`) as any;
    const activeMembers = Number(toArr2(activeRow)[0]?.total ?? 0);

    const [newRow] = await db.execute(sql`SELECT COUNT(*) as total FROM users WHERE createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01')`) as any;
    const newThisMonth = Number(toArr2(newRow)[0]?.total ?? 0);

    const [newLastRow] = await db.execute(sql`SELECT COUNT(*) as total FROM users WHERE createdAt >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND createdAt < DATE_FORMAT(NOW(), '%Y-%m-01')`) as any;
    const newLastMonth = Number(toArr2(newLastRow)[0]?.total ?? 0);

    const [completionRow] = await db.execute(sql`SELECT COUNT(*) as total FROM lms_enrollments WHERE completed_at IS NOT NULL`) as any;
    const totalCompletions = Number(toArr2(completionRow)[0]?.total ?? 0);

    // Revenue from all sources
    const [revenueRow] = await db.execute(sql`SELECT COALESCE(SUM(amount_paid),0) as total FROM funnel_purchases WHERE status = 'paid'`) as any;
    const totalRevenueCents = Number(toArr2(revenueRow)[0]?.total ?? 0);

    const [growthRows] = await db.execute(sql`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, COUNT(*) as count
      FROM users
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `) as any;
    const memberGrowth = toArr2(growthRows).map((r: any) => ({ month: r.month, count: Number(r.count) }));

    const [recentRows] = await db.execute(sql`
      SELECT u.id, u.name, u.email, u.avatarUrl, u.createdAt, u.lastSignedIn,
        (SELECT COUNT(*) FROM lms_enrollments e WHERE e.user_id = u.id) as enrollment_count,
        (SELECT COUNT(*) FROM lms_enrollments e WHERE e.user_id = u.id AND e.completed_at IS NOT NULL) as completion_count
      FROM users u
      ORDER BY u.createdAt DESC
      LIMIT 10
    `) as any;
    const recentMembers = toArr2(recentRows).map((r: any) => ({
      id: Number(r.id),
      name: r.name ?? r.email ?? 'Unknown',
      email: r.email ?? '',
      avatarUrl: r.avatarUrl ?? null,
      createdAt: r.createdAt,
      lastSignedIn: r.lastSignedIn ?? null,
      enrollmentCount: Number(r.enrollment_count ?? 0),
      completionCount: Number(r.completion_count ?? 0),
      progress: Number(r.enrollment_count ?? 0) > 0 ? Math.round((Number(r.completion_count ?? 0) / Number(r.enrollment_count)) * 100) : 0,
    }));

    const [activityRows] = await db.execute(sql`
      SELECT 'enrollment' as type, u.name as user_name, u.avatarUrl as avatar_url, c.title as subject, e.enrolled_at as occurred_at
      FROM lms_enrollments e
      JOIN users u ON u.id = e.user_id
      JOIN lms_courses c ON c.id = e.course_id
      UNION ALL
      SELECT 'completion' as type, u.name as user_name, u.avatarUrl as avatar_url, c.title as subject, e.completed_at as occurred_at
      FROM lms_enrollments e
      JOIN users u ON u.id = e.user_id
      JOIN lms_courses c ON c.id = e.course_id
      WHERE e.completed_at IS NOT NULL
      UNION ALL
      SELECT 'certificate' as type, u.name as user_name, u.avatarUrl as avatar_url, c.title as subject, cert.issued_at as occurred_at
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
        totalRevenueCents,
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
          u.name AS user_name, u.email AS user_email, u.avatarUrl,
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
          avatarUrl: r.avatarUrl ?? null,
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
        WHERE c.status IN ('public', 'hidden', 'private', 'archived')
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
      limit: z.number().int().min(1).max(500).default(100),
      type: z.enum(['all', 'enrollment', 'completion', 'certificate', 'login']).default('all'),
      search: z.string().optional(),
      dateFrom: z.string().optional(), // ISO date string YYYY-MM-DD
      dateTo: z.string().optional(),   // ISO date string YYYY-MM-DD
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);

      const typeFilter = input.type !== 'all' ? sql`AND event_type = ${input.type}` : sql``;
      const searchFilter = input.search?.trim()
        ? sql`AND (user_name LIKE ${'%' + input.search.trim() + '%'} OR user_email LIKE ${'%' + input.search.trim() + '%'})`
        : sql``;
      const dateFromFilter = input.dateFrom
        ? sql`AND occurred_at >= ${input.dateFrom + ' 00:00:00'}`
        : sql``;
      const dateToFilter = input.dateTo
        ? sql`AND occurred_at <= ${input.dateTo + ' 23:59:59'}`
        : sql``;
      // Only restrict logins to 7 days when no date filter is applied
      const loginDateFilter = (input.dateFrom || input.dateTo)
        ? sql`1=1`
        : sql`u.lastSignedIn >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;

      const [rows] = await db.execute(sql`
        SELECT * FROM (
          SELECT 'enrollment' AS event_type, u.id AS user_id, u.name AS user_name, u.email AS user_email, u.avatarUrl,
            c.title AS subject, NULL AS subject2, e.enrolled_at AS occurred_at
          FROM lms_enrollments e
          JOIN users u ON u.id = e.user_id
          JOIN lms_courses c ON c.id = e.course_id

          UNION ALL

          SELECT 'completion' AS event_type, u.id, u.name, u.email, u.avatarUrl,
            c.title, NULL, e.completed_at
          FROM lms_enrollments e
          JOIN users u ON u.id = e.user_id
          JOIN lms_courses c ON c.id = e.course_id
          WHERE e.completed_at IS NOT NULL

          UNION ALL

          SELECT 'certificate' AS event_type, u.id, u.name, u.email, u.avatarUrl,
            c.title, NULL, cert.issued_at
          FROM lms_certificates cert
          JOIN users u ON u.id = cert.user_id
          JOIN lms_courses c ON c.id = cert.course_id

          UNION ALL

          SELECT 'login' AS event_type, u.id, u.name, u.email, u.avatarUrl,
            NULL, NULL, u.lastSignedIn
          FROM users u
          WHERE ${loginDateFilter}
        ) AS feed
        WHERE 1=1 ${typeFilter} ${searchFilter} ${dateFromFilter} ${dateToFilter}
        ORDER BY occurred_at DESC
        LIMIT ${input.limit}
      `) as any;

      return toArr2(rows).map((r: any) => ({
        type: r.event_type as string,
        userId: Number(r.user_id),
        userName: r.user_name ?? r.user_email ?? 'Unknown',
        userEmail: r.user_email ?? '',
        avatarUrl: r.avatarUrl ?? null,
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
        statusFilter = sql`u.lastSignedIn >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
      } else if (input.status === 'inactive') {
        statusFilter = sql`(u.lastSignedIn < DATE_SUB(NOW(), INTERVAL 30 DAY) OR u.lastSignedIn IS NULL)`;
      }

      let searchFilter = sql`1=1`;
      if (input.search) {
        const s = `%${input.search}%`;
        searchFilter = sql`(u.name LIKE ${s} OR u.email LIKE ${s})`;
      }

      const [rows] = await db.execute(sql`
        SELECT u.id, u.name, u.email, u.avatarUrl, u.createdAt, u.lastSignedIn, u.role,
          (SELECT COUNT(*) FROM lms_enrollments e WHERE e.user_id = u.id) as enrollment_count,
          (SELECT COUNT(*) FROM lms_enrollments e WHERE e.user_id = u.id AND e.completed_at IS NOT NULL) as completion_count
        FROM users u
        WHERE ${statusFilter} AND ${searchFilter}
        ORDER BY u.createdAt DESC
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
          avatarUrl: r.avatarUrl ?? null,
          createdAt: r.createdAt,
          lastSignedIn: r.lastSignedIn ?? null,
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

  /** Get email history for a specific user */
  getUserEmailHistory: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);
      const offset = (input.page - 1) * input.pageSize;
      // Get user email to also match by email (for pre-registration sends)
      const [userRow] = await db.execute(sql`SELECT email FROM users WHERE id = ${input.userId} LIMIT 1`) as any;
      const userEmail = toArr2(userRow)[0]?.email ?? '';
      const [rows] = await db.execute(sql`
        SELECT
          esl.id, esl.email_type AS emailType, esl.subject, esl.status,
          esl.sent_at AS sentAt, esl.campaign_id AS campaignId,
          ec.subject AS campaignSubject
        FROM email_send_log esl
        LEFT JOIN emailCampaigns ec ON ec.id = esl.campaign_id
        WHERE esl.user_id = ${input.userId} OR esl.recipient_email = ${userEmail}
        ORDER BY esl.sent_at DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;
      const [countRow] = await db.execute(sql`
        SELECT COUNT(*) as total FROM email_send_log
        WHERE user_id = ${input.userId} OR recipient_email = ${userEmail}
      `) as any;
      const total = Number(toArr2(countRow)[0]?.total ?? 0);
      return {
        emails: toArr2(rows).map((r: any) => ({
          id: Number(r.id),
          emailType: String(r.emailType ?? 'other'),
          subject: String(r.subject ?? ''),
          status: String(r.status ?? 'sent'),
          sentAt: r.sentAt,
          campaignId: r.campaignId ? Number(r.campaignId) : null,
          campaignSubject: r.campaignSubject ? String(r.campaignSubject) : null,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /** Platform-wide email send log with filters */
  listEmailSendLog: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      emailType: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);
      const offset = (input.page - 1) * input.pageSize;
      let whereClause = sql`1=1`;
      if (input.search) {
        const s = `%${input.search}%`;
        whereClause = sql`(esl.recipient_email LIKE ${s} OR esl.subject LIKE ${s} OR esl.recipient_name LIKE ${s})`;
      }
      if (input.emailType && input.emailType !== 'all') {
        whereClause = sql`${whereClause} AND esl.email_type = ${input.emailType}`;
      }
      const [rows] = await db.execute(sql`
        SELECT
          esl.id, esl.user_id AS userId, esl.recipient_email AS recipientEmail,
          esl.recipient_name AS recipientName, esl.email_type AS emailType,
          esl.subject, esl.status, esl.sent_at AS sentAt,
          esl.campaign_id AS campaignId,
          ec.subject AS campaignSubject
        FROM email_send_log esl
        LEFT JOIN emailCampaigns ec ON ec.id = esl.campaign_id
        WHERE ${whereClause}
        ORDER BY esl.sent_at DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;
      const [countRow] = await db.execute(sql`
        SELECT COUNT(*) as total FROM email_send_log esl WHERE ${whereClause}
      `) as any;
      const total = Number(toArr2(countRow)[0]?.total ?? 0);
      // Summary stats
      const [statsRow] = await db.execute(sql`
        SELECT
          COUNT(*) as total_sent,
          SUM(CASE WHEN email_type = 'campaign' THEN 1 ELSE 0 END) as campaign_count,
          SUM(CASE WHEN email_type != 'campaign' THEN 1 ELSE 0 END) as transactional_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
        FROM email_send_log
      `) as any;
      const stats = toArr2(statsRow)[0] ?? {};
      return {
        emails: toArr2(rows).map((r: any) => ({
          id: Number(r.id),
          userId: r.userId ? Number(r.userId) : null,
          recipientEmail: String(r.recipientEmail ?? ''),
          recipientName: r.recipientName ? String(r.recipientName) : null,
          emailType: String(r.emailType ?? 'other'),
          subject: String(r.subject ?? ''),
          status: String(r.status ?? 'sent'),
          sentAt: r.sentAt,
          campaignId: r.campaignId ? Number(r.campaignId) : null,
          campaignSubject: r.campaignSubject ? String(r.campaignSubject) : null,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
        stats: {
          totalSent: Number(stats.total_sent ?? 0),
          campaignCount: Number(stats.campaign_count ?? 0),
          transactionalCount: Number(stats.transactional_count ?? 0),
          failedCount: Number(stats.failed_count ?? 0),
        },
      };
    }),

  /** Revenue overview for member dashboard */
  getRevenueOverview: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    const toArr2 = (r: any) => Array.isArray(r) ? r : (r?.[0] ?? []);
    // Total revenue from funnel purchases
    const [funnelRow] = await db.execute(sql`
      SELECT COALESCE(SUM(amount_paid), 0) as total FROM funnel_purchases WHERE status = 'paid'
    `) as any;
    const funnelRevenue = Number(toArr2(funnelRow)[0]?.total ?? 0);
    // Revenue from LMS orders (amount_paid is in cents)
    const [lmsRow] = await db.execute(sql`
      SELECT COALESCE(SUM(amount_paid), 0) / 100.0 as total FROM lms_orders WHERE status = 'paid'
    `) as any;
    const lmsRevenue = Number(toArr2(lmsRow)[0]?.total ?? 0);
    // Revenue from digital purchases (amount_paid is in cents)
    const [digitalRow] = await db.execute(sql`
      SELECT COALESCE(SUM(dp.amount_paid), 0) / 100.0 as total FROM digital_purchases dp
    `) as any;
    const digitalRevenue = Number(toArr2(digitalRow)[0]?.total ?? 0);
    // Monthly revenue trend (last 6 months) from funnel_purchases
    const [monthlyRows] = await db.execute(sql`
      SELECT DATE_FORMAT(purchased_at, '%Y-%m') as month, COALESCE(SUM(amount_paid), 0) as revenue
      FROM funnel_purchases
      WHERE status = 'paid' AND purchased_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month ASC
    `) as any;
    const monthlyRevenue = toArr2(monthlyRows).map((r: any) => ({
      month: String(r.month),
      revenue: Number(r.revenue ?? 0),
    }));
    // Recent purchases
    const [recentRows] = await db.execute(sql`
      SELECT fp.id, fp.email, fp.name, fp.amount_paid AS amountPaid, fp.purchased_at AS createdAt,
        fp.product_name AS productName, fp.status, u.id AS userId
      FROM funnel_purchases fp
      LEFT JOIN users u ON u.email = fp.email
      ORDER BY fp.purchased_at DESC
      LIMIT 10
    `) as any;
    return {
      totalRevenue: funnelRevenue + lmsRevenue + digitalRevenue,
      funnelRevenue,
      lmsRevenue,
      digitalRevenue,
      monthlyRevenue,
      recentPurchases: toArr2(recentRows).map((r: any) => ({
        id: Number(r.id),
        email: String(r.email ?? ''),
        name: r.name ? String(r.name) : null,
        amountPaid: Number(r.amountPaid ?? 0),
        createdAt: r.createdAt,
        productName: r.productName ? String(r.productName) : null,
        status: String(r.status ?? 'paid'),
        userId: r.userId ? Number(r.userId) : null,
      })),
    };
  }),

  /** Update a user's profile fields (admin only) */
  updateUserProfile: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      displayName: z.string().max(100).optional(),
      firstName: z.string().max(100).optional(),
      lastName: z.string().max(100).optional(),
      email: z.string().email().optional(),
      bio: z.string().max(2000).optional(),
      specialty: z.string().max(100).optional(),
      credentials: z.string().max(200).optional(),
      location: z.string().max(150).optional(),
      website: z.string().max(255).optional(),
      timezone: z.string().max(64).optional(),
      isDemo: z.boolean().optional(),
      isPremium: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { userId, ...fields } = input;
      const updateData: Record<string, any> = {};
      if (fields.displayName !== undefined) updateData.displayName = fields.displayName || null;
      if (fields.firstName !== undefined) updateData.firstName = fields.firstName || null;
      if (fields.lastName !== undefined) updateData.lastName = fields.lastName || null;
      if (fields.email !== undefined) updateData.email = fields.email;
      if (fields.bio !== undefined) updateData.bio = fields.bio || null;
      if (fields.specialty !== undefined) updateData.specialty = fields.specialty || null;
      if (fields.credentials !== undefined) updateData.credentials = fields.credentials || null;
      if (fields.location !== undefined) updateData.location = fields.location || null;
      if (fields.website !== undefined) updateData.website = fields.website || null;
      if (fields.timezone !== undefined) updateData.timezone = fields.timezone || null;
      if (fields.isDemo !== undefined) updateData.isDemo = fields.isDemo;
      if (fields.isPremium !== undefined) updateData.isPremium = fields.isPremium;
      if (Object.keys(updateData).length === 0) return { success: true };
      await db.update(users).set(updateData).where(eq(users.id, userId));
      return { success: true };
    }),

  /** Get login history for a user */
  getUserLoginHistory: protectedProcedure
    .input(z.object({ userId: z.number().int(), page: z.number().int().default(1), pageSize: z.number().int().default(25) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const [countRow] = await db.execute(sql`
        SELECT COUNT(*) as total FROM user_login_events WHERE user_id = ${input.userId}
      `) as any;
      const total = Number(Array.isArray(countRow) ? countRow[0]?.total : countRow?.total ?? 0);
      const [rows] = await db.execute(sql`
        SELECT id, ip_address AS ipAddress, user_agent AS userAgent, country, created_at AS createdAt
        FROM user_login_events
        WHERE user_id = ${input.userId}
        ORDER BY created_at DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;
      const logins = (Array.isArray(rows) ? rows : []).map((r: any) => ({
        id: Number(r.id),
        ipAddress: r.ipAddress as string | null,
        userAgent: r.userAgent as string | null,
        country: r.country as string | null,
        createdAt: r.createdAt,
      }));
      return { logins, total, totalPages: Math.ceil(total / input.pageSize) };
    }),

  /** Get activity log for a user (all event types) */
  getUserActivityLog: protectedProcedure
    .input(z.object({ userId: z.number().int(), page: z.number().int().default(1), pageSize: z.number().int().default(50) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const [countRow] = await db.execute(sql`
        SELECT COUNT(*) as total FROM user_activity_logs WHERE user_id = ${input.userId}
      `) as any;
      const total = Number(Array.isArray(countRow) ? countRow[0]?.total : countRow?.total ?? 0);
      const [rows] = await db.execute(sql`
        SELECT id, event_type AS eventType, description, path, ip_address AS ipAddress, metadata, created_at AS createdAt
        FROM user_activity_logs
        WHERE user_id = ${input.userId}
        ORDER BY created_at DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;
      const events = (Array.isArray(rows) ? rows : []).map((r: any) => ({
        id: Number(r.id),
        eventType: String(r.eventType),
        description: String(r.description),
        path: r.path as string | null,
        ipAddress: r.ipAddress as string | null,
        metadata: r.metadata,
        createdAt: r.createdAt,
      }));
      return { events, total, totalPages: Math.ceil(total / input.pageSize) };
    }),

  /** Get all purchases for a user (funnel + LMS orders + digital + physical) */
  getUserPurchases: protectedProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Funnel purchases
      const [funnelRows] = await db.execute(sql`
        SELECT id, product_name AS productName, amount_paid AS amountPaid, currency, status,
          stripe_payment_intent_id AS stripePaymentIntentId, purchased_at AS createdAt
        FROM funnel_purchases WHERE user_id = ${input.userId} ORDER BY purchased_at DESC
      `) as any;
      // LMS orders
      const [lmsRows] = await db.execute(sql`
        SELECT lo.id, c.title AS productName, lo.amount_paid/100.0 AS amountPaid, lo.currency, lo.status,
          lo.stripe_payment_intent_id AS stripePaymentIntentId, lo.created_at AS createdAt
        FROM lms_orders lo
        JOIN lms_courses c ON c.id = lo.course_id
        WHERE lo.user_id = ${input.userId} ORDER BY lo.created_at DESC
      `) as any;
      // Digital purchases
      const [digitalRows] = await db.execute(sql`
        SELECT dp.id, dprod.title AS productName, dp.amount_paid/100.0 AS amountPaid, 'usd' AS currency, 'paid' AS status,
          dp.stripe_payment_intent_id AS stripePaymentIntentId, dp.purchased_at AS createdAt
        FROM digital_purchases dp
        JOIN digital_products dprod ON dprod.id = dp.product_id
        WHERE dp.user_id = ${input.userId} ORDER BY dp.purchased_at DESC
      `) as any;
      // Physical orders
      const [physicalRows] = await db.execute(sql`
        SELECT po.id, pp.title AS productName, po.amount_paid/100.0 AS amountPaid, po.currency,
          po.fulfillment_status AS status, po.stripe_payment_intent_id AS stripePaymentIntentId,
          po.created_at AS createdAt
        FROM physical_product_orders po
        JOIN physical_products pp ON pp.id = po.product_id
        WHERE po.user_id = ${input.userId} ORDER BY po.created_at DESC
      `) as any;
      const toList = (rows: any, type: string) =>
        (Array.isArray(rows) ? rows : []).map((r: any) => ({
          id: Number(r.id),
          type,
          productName: String(r.productName ?? ''),
          amountPaid: Number(r.amountPaid ?? 0),
          currency: String(r.currency ?? 'usd'),
          status: String(r.status ?? 'paid'),
          stripePaymentIntentId: r.stripePaymentIntentId as string | null,
          createdAt: r.createdAt,
        }));
      const all = [
        ...toList(funnelRows, 'funnel'),
        ...toList(lmsRows, 'course'),
        ...toList(digitalRows, 'digital'),
        ...toList(physicalRows, 'physical'),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const totalRevenue = all.filter(p => p.status === 'paid' || p.status === 'fulfilled' || p.status === 'pending').reduce((s, p) => s + p.amountPaid, 0);
      return { purchases: all, totalRevenue };
    }),

  /** List all email aliases for a user */
  listEmailAliases: protectedProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const aliases = await db
        .select()
        .from(userEmailAliases)
        .where(eq(userEmailAliases.userId, input.userId))
        .orderBy(desc(userEmailAliases.createdAt));
      return aliases;
    }),

  /** Add an email alias to a user account */
  addEmailAlias: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      email: z.string().email(),
      label: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const normalised = input.email.trim().toLowerCase();
      // Check not already a primary email
      const [existingPrimary] = await db.execute(sql`SELECT id FROM users WHERE LOWER(email) = ${normalised} LIMIT 1`) as any;
      if (Array.isArray(existingPrimary) && existingPrimary.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "This email is already the primary email of another account." });
      }
      // Check not already an alias
      const [existingAlias] = await db.execute(sql`SELECT id FROM user_email_aliases WHERE LOWER(email) = ${normalised} LIMIT 1`) as any;
      if (Array.isArray(existingAlias) && existingAlias.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "This email is already registered as an alias." });
      }
      await db.insert(userEmailAliases).values({
        userId: input.userId,
        email: normalised,
        label: input.label ?? null,
        source: 'admin_added',
      });
      return { success: true };
    }),

  /** Remove an email alias */
  removeEmailAlias: protectedProcedure
    .input(z.object({ aliasId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(userEmailAliases).where(eq(userEmailAliases.id, input.aliasId));
      return { success: true };
    }),

  /**
   * Merge two user accounts.
   * - All data from `sourceUserId` is re-pointed to `targetUserId`.
   * - The source user's email is added as an alias on the target account.
   * - The source user account is soft-deleted (isPending=true, email cleared).
   * Magic links always go to the target (primary) user's email.
   */
  mergeUsers: protectedProcedure
    .input(z.object({
      targetUserId: z.number().int(),  // the account to keep
      sourceUserId: z.number().int(),  // the duplicate to absorb
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      if (input.targetUserId === input.sourceUserId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot merge a user with themselves." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch both users
      const [targetRows, sourceRows] = await Promise.all([
        db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, input.targetUserId)).limit(1),
        db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, input.sourceUserId)).limit(1),
      ]);
      if (!targetRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Target user not found." });
      if (!sourceRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Source user not found." });
      const sourceEmail = sourceRows[0].email;

      // Tables to re-point userId from source → target
      const tablesToUpdate = [
        "lms_enrollments", "lms_orders", "lms_certificates", "lms_lesson_notes",
        "lms_lesson_bookmarks", "lms_video_events", "lms_quiz_attempts",
        "digital_purchases", "digital_download_events", "digital_bundle_purchases",
        "physical_product_orders", "funnel_purchases", "order_bump_conversions",
        "brandMemberships", "membershipSubscriptions",
        "userRoles", "userPointsLog",
        "user_login_events", "user_activity_logs",
        "email_send_log",
        "ip_access_logs", "sharing_abuse_flags",
        "quickfireAttempts", "echoLibraryCaseAttempts", "userCaseViews",
        "cmeEnrollmentCache",
        "accreditationReadiness", "accreditationReadinessNavigator",
        "user_email_aliases",
      ];

      // Re-point each table — skip rows that would create a duplicate (e.g. unique userId)
      for (const table of tablesToUpdate) {
        try {
          const col = table === 'email_send_log' || table === 'ip_access_logs' ||
            table === 'sharing_abuse_flags' || table === 'user_login_events' ||
            table === 'user_activity_logs' || table === 'physical_product_orders' ||
            table === 'digital_purchases' || table === 'digital_download_events' ||
            table === 'digital_bundle_purchases' || table === 'funnel_purchases' ||
            table === 'order_bump_conversions' || table === 'lms_enrollments' ||
            table === 'lms_orders' || table === 'lms_certificates' ||
            table === 'lms_lesson_notes' || table === 'lms_lesson_bookmarks' ||
            table === 'lms_video_events' || table === 'lms_quiz_attempts' ||
            table === 'user_email_aliases'
            ? 'user_id' : 'userId';
          await db.execute(sql.raw(
            `UPDATE \`${table}\` SET \`${col}\` = ${input.targetUserId} WHERE \`${col}\` = ${input.sourceUserId}`
          ));
        } catch (_e) {
          // Ignore duplicate key errors — the target already has that record
          console.warn(`[mergeUsers] Skipped table ${table}:`, (_e as Error).message?.slice(0, 80));
        }
      }

      // Add source email as alias on target (if not already there and not null)
      if (sourceEmail) {
        const normalised = sourceEmail.trim().toLowerCase();
        try {
          await db.insert(userEmailAliases).values({
            userId: input.targetUserId,
            email: normalised,
            label: `Merged from account #${input.sourceUserId}`,
            source: 'account_merge',
          });
        } catch (_e) {
          // Alias already exists — that's fine
        }
      }

      // Soft-delete the source account: clear email + mark as pending so it can't be logged into
      await db.update(users).set({
        email: null,
        openId: `merged_${input.sourceUserId}_${Date.now()}`,
        isPending: true,
        name: `[Merged into #${input.targetUserId}] ${sourceRows[0].name ?? ''}`,
      }).where(eq(users.id, input.sourceUserId));

      return { success: true, message: `Account #${input.sourceUserId} merged into #${input.targetUserId}. Source email added as alias.` };
    }),

  /** Search users by name or email (for merge dialog) */
  searchUsersForMerge: protectedProcedure
    .input(z.object({
      query: z.string().min(2).max(100),
      excludeUserId: z.number().int(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const q = `%${input.query.trim()}%`;
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl, createdAt: users.createdAt })
        .from(users)
        .where(and(
          sql`(LOWER(${users.email}) LIKE LOWER(${q}) OR LOWER(${users.name}) LIKE LOWER(${q}))`,
          sql`${users.id} != ${input.excludeUserId}`,
          eq(users.isPending, false),
        ))
        .limit(10);
      return rows;
    }),

  /** Get all app roles assigned to a user */
  getUserAppRoles: protectedProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(userRoles).where(eq(userRoles.userId, input.userId));
      return rows;
    }),

  /** Grant an app role to a user (idempotent) */
  grantAppRole: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      role: z.enum(["user", "premium_user", "diy_admin", "diy_user", "platform_admin", "accreditation_manager", "education_manager", "education_admin", "education_student", "platform_owner", "platform_moderator", "instructor", "team_admin", "affiliate"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select().from(userRoles)
        .where(and(eq(userRoles.userId, input.userId), eq(userRoles.role, input.role))).limit(1);
      if (existing.length === 0) {
        await db.insert(userRoles).values({ userId: input.userId, role: input.role, assignedByUserId: ctx.user.id });
      }
      return { success: true };
    }),

  /** Revoke an app role from a user */
  revokeAppRole: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      role: z.enum(["user", "premium_user", "diy_admin", "diy_user", "platform_admin", "accreditation_manager", "education_manager", "education_admin", "education_student", "platform_owner", "platform_moderator", "instructor", "team_admin", "affiliate"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.role === "user") throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove the base user role" });
      await db.delete(userRoles).where(and(eq(userRoles.userId, input.userId), eq(userRoles.role, input.role)));
      return { success: true };
    }),
});
