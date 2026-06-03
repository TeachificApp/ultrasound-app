/**
 * dashboardRouter.ts
 * Student/user dashboard — profile, my content, subscriptions, certificates.
 *
 * Procedures:
 *   dashboard.getProfile          — return full user profile
 *   dashboard.updateProfile       — update displayName, bio, credentials, specialty, location, website
 *   dashboard.getMyContent        — enrolled courses, digital purchases, physical orders, quiz enrollments
 *   dashboard.getMySubscriptions  — native brandMemberships + Thinkific membership links
 *   dashboard.getMyCertificates   — earned LMS certificates with download URLs
 *   dashboard.cancelSubscription  — cancel a native Stripe subscription
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  users,
  lmsEnrollments,
  lmsCourses,
  lmsCertificates,
  digitalPurchases,
  digitalProducts,
  physicalProductOrders,
  physicalProducts,
  brandMemberships,
  funnelPurchases,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-06-20" as any });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map brand to Thinkific membership management URLs */
const THINKIFIC_MANAGE_URLS: Record<string, string> = {
  aaus: "https://allaboutultrasound.thinkific.com/users/sign_in",
  iheartecho: "https://iheartecho.thinkific.com/users/sign_in",
};

/** Map brand to Thinkific site base URL */
const THINKIFIC_SITE_URLS: Record<string, string> = {
  aaus: "https://allaboutultrasound.thinkific.com",
  iheartecho: "https://iheartecho.thinkific.com",
};

// ─── Router ───────────────────────────────────────────────────────────────────

export const dashboardRouter = router({

  // ── Profile ──────────────────────────────────────────────────────────────────

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        displayName: users.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        credentials: users.credentials,
        specialty: users.specialty,
        yearsExperience: users.yearsExperience,
        location: users.location,
        website: users.website,
        loginMethod: users.loginMethod,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    return {
      ...user,
      hasPassword: !!user.passwordHash,
      passwordHash: undefined, // never expose hash
    };
  }),

  // ── My Content ───────────────────────────────────────────────────────────────

  getMyContent: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // 1. LMS enrollments (courses + quiz-type courses)
    const enrollments = await db
      .select({
        enrollmentId: lmsEnrollments.id,
        courseId: lmsEnrollments.courseId,
        enrolledAt: lmsEnrollments.enrolledAt,
        completedAt: lmsEnrollments.completedAt,
        progressPct: lmsEnrollments.progressPct,
        courseTitle: lmsCourses.title,
        courseSlug: lmsCourses.slug,
        courseType: lmsCourses.type,
        courseBrand: lmsCourses.brand,
        courseThumbnail: lmsCourses.thumbnailUrl,
        courseStatus: lmsCourses.status,
      })
      .from(lmsEnrollments)
      .innerJoin(lmsCourses, eq(lmsEnrollments.courseId, lmsCourses.id))
      .where(eq(lmsEnrollments.userId, ctx.user.id))
      .orderBy(desc(lmsEnrollments.enrolledAt));

    // 2. Digital purchases
    const digitalPurchaseRows = await db
      .select({
        purchaseId: digitalPurchases.id,
        productId: digitalPurchases.productId,
        purchasedAt: digitalPurchases.purchasedAt,
        productTitle: digitalProducts.title,
        productSlug: digitalProducts.slug,
        productThumbnail: digitalProducts.thumbnailUrl,
        productStatus: digitalProducts.status,
      })
      .from(digitalPurchases)
      .innerJoin(digitalProducts, eq(digitalPurchases.productId, digitalProducts.id))
      .where(eq(digitalPurchases.userId, ctx.user.id))
      .orderBy(desc(digitalPurchases.purchasedAt));

    // 3. Physical product orders
    const physicalOrders = await db
      .select({
        orderId: physicalProductOrders.id,
        productId: physicalProductOrders.productId,
        orderedAt: physicalProductOrders.orderedAt,
        amountPaid: physicalProductOrders.amountPaid,
        currency: physicalProductOrders.currency,
        fulfillmentStatus: physicalProductOrders.fulfillmentStatus,
        trackingNumber: physicalProductOrders.trackingNumber,
        trackingCarrier: physicalProductOrders.trackingCarrier,
        productTitle: physicalProducts.title,
        productSlug: physicalProducts.slug,
        productThumbnail: physicalProducts.thumbnailUrl,
      })
      .from(physicalProductOrders)
      .innerJoin(physicalProducts, eq(physicalProductOrders.productId, physicalProducts.id))
      .where(eq(physicalProductOrders.userId, ctx.user.id))
      .orderBy(desc(physicalProductOrders.orderedAt));

    // 4. Funnel / embedded-checkout purchases
    const funnelPurchaseRows = await db
      .select({
        id: funnelPurchases.id,
        productName: funnelPurchases.productName,
        productType: funnelPurchases.productType,
        amountPaid: funnelPurchases.amountPaid,
        currency: funnelPurchases.currency,
        purchasedAt: funnelPurchases.purchasedAt,
        orderBumps: funnelPurchases.orderBumps,
        status: funnelPurchases.status,
        sourceType: funnelPurchases.sourceType,
      })
      .from(funnelPurchases)
      .where(eq(funnelPurchases.userId, ctx.user.id))
      .orderBy(desc(funnelPurchases.purchasedAt));

    // Separate courses from quiz-type LMS items
    // "cohort" courses are live/scheduled cohort courses — include them alongside regular courses
    const courses = enrollments.filter(e => e.courseType === "course" || e.courseType === "cohort");
    const quizzes = enrollments.filter(e => e.courseType === "quiz");
    const downloads = enrollments.filter(e => e.courseType === "download");

    return {
      courses,
      quizzes,
      downloads: [
        ...downloads,
        ...digitalPurchaseRows,
      ],
      physicalProducts: physicalOrders,
      funnelPurchases: funnelPurchaseRows,
    };
  }),

  // ── Subscriptions ─────────────────────────────────────────────────────────────

  getMySubscriptions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Fetch all brand memberships for this user
    const memberships = await db
      .select()
      .from(brandMemberships)
      .where(eq(brandMemberships.userId, ctx.user.id))
      .orderBy(desc(brandMemberships.createdAt));

    // For native Stripe subscriptions, fetch live subscription data
    const enriched = await Promise.all(
      memberships.map(async (m) => {
        let stripeData: {
          status: string;
          currentPeriodEnd: Date | null;
          cancelAtPeriodEnd: boolean;
          interval: string | null;
          amount: number | null;
          currency: string | null;
        } | null = null;

        if (m.stripeSubscriptionId && m.source && ["stripe", "stripe_dual"].includes(m.source)) {
          try {
            const sub = await stripe.subscriptions.retrieve(m.stripeSubscriptionId) as any;
            const item = sub.items?.data?.[0];
            stripeData = {
              status: sub.status,
              currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              interval: item?.price?.recurring?.interval ?? null,
              amount: item?.price?.unit_amount ?? null,
              currency: item?.price?.currency ?? null,
            };
          } catch (err) {
            console.warn("[Dashboard] Failed to fetch Stripe subscription:", m.stripeSubscriptionId, err);
          }
        }

        // Determine if this is a Thinkific-sourced membership
        const isThinkific = m.source === "thinkific";
        const thinkificManageUrl = THINKIFIC_MANAGE_URLS[m.brand] ?? THINKIFIC_MANAGE_URLS.aaus;

        return {
          id: m.id,
          brand: m.brand,
          tier: m.tier,
          status: m.status,
          source: m.source,
          grantedAt: m.grantedAt,
          expiresAt: m.expiresAt,
          stripeSubscriptionId: m.stripeSubscriptionId,
          isThinkific,
          thinkificManageUrl,
          stripe: stripeData,
        };
      })
    );

    return enriched;
  }),

  // ── Cancel Subscription ───────────────────────────────────────────────────────

  cancelSubscription: protectedProcedure
    .input(z.object({
      membershipId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify ownership
      const [membership] = await db
        .select()
        .from(brandMemberships)
        .where(and(eq(brandMemberships.id, input.membershipId), eq(brandMemberships.userId, ctx.user.id)))
        .limit(1);

      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
      }

      if (!membership.stripeSubscriptionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This subscription cannot be cancelled here. Please contact support." });
      }

      // Cancel at period end (not immediately)
      await stripe.subscriptions.update(membership.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      return { success: true, message: "Your subscription will be cancelled at the end of the current billing period." };
    }),

  // ── Reactivate Subscription ───────────────────────────────────────────────────

  reactivateSubscription: protectedProcedure
    .input(z.object({
      membershipId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [membership] = await db
        .select()
        .from(brandMemberships)
        .where(and(eq(brandMemberships.id, input.membershipId), eq(brandMemberships.userId, ctx.user.id)))
        .limit(1);

      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
      }

      if (!membership.stripeSubscriptionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This subscription cannot be managed here." });
      }

      await stripe.subscriptions.update(membership.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      return { success: true, message: "Your subscription has been reactivated." };
    }),

  // ── Certificates ─────────────────────────────────────────────────────────────

  getMyCertificates: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const certs = await db
      .select({
        id: lmsCertificates.id,
        courseId: lmsCertificates.courseId,
        enrollmentId: lmsCertificates.enrollmentId,
        certificateUrl: lmsCertificates.certificateUrl,
        issuedAt: lmsCertificates.issuedAt,
        courseTitle: lmsCourses.title,
        courseSlug: lmsCourses.slug,
        courseThumbnail: lmsCourses.thumbnailUrl,
        courseBrand: lmsCourses.brand,
      })
      .from(lmsCertificates)
      .innerJoin(lmsCourses, eq(lmsCertificates.courseId, lmsCourses.id))
      .where(eq(lmsCertificates.userId, ctx.user.id))
      .orderBy(desc(lmsCertificates.issuedAt));

    return certs;
  }),
});
