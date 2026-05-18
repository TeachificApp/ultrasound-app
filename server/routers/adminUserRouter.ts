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
} from "../../drizzle/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { storagePut } from "../storage";
import { generateCertificatePdf } from "../lib/certificateGenerator";
import { sendCertificateEmail } from "../lib/certificateEmail";

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
});
