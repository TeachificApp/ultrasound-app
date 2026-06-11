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
  lmsOrders,
  webinarRegistrations,
  webinars,
  bundleEnrollments,
  bundles,
  communityMembers,
  communities,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getStripeClient } from "../lib/stripeClient";

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
        accessExpiresAt: lmsEnrollments.accessExpiresAt,
        enrollmentSource: lmsEnrollments.source,
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

    // 5. Webinar registrations
    const webinarRegs = await db
      .select({
        registrationId: webinarRegistrations.id,
        webinarId: webinarRegistrations.webinarId,
        registeredAt: webinarRegistrations.registeredAt,
        attended: webinarRegistrations.attended,
        webinarTitle: webinars.title,
        webinarSlug: webinars.slug,
        webinarBrand: webinars.brand,
        webinarCover: webinars.coverImage,
        webinarType: webinars.type,
        webinarStatus: webinars.status,
        scheduledAt: webinars.scheduledAt,
      })
      .from(webinarRegistrations)
      .innerJoin(webinars, eq(webinarRegistrations.webinarId, webinars.id))
      .where(eq(webinarRegistrations.userId, ctx.user.id))
      .orderBy(desc(webinarRegistrations.registeredAt));

    // 6. Bundle enrollments
    const bundleRegs = await db
      .select({
        enrollmentId: bundleEnrollments.id,
        bundleId: bundleEnrollments.bundleId,
        enrolledAt: bundleEnrollments.enrolledAt,
        bundleTitle: bundles.title,
        bundleSlug: bundles.slug,
        bundleBrand: bundles.brand,
        bundleCover: bundles.coverImage,
        bundleStatus: bundles.status,
      })
      .from(bundleEnrollments)
      .innerJoin(bundles, eq(bundleEnrollments.bundleId, bundles.id))
      .where(eq(bundleEnrollments.userId, ctx.user.id))
      .orderBy(desc(bundleEnrollments.enrolledAt));

    // 7. Community memberships
    const communityRegs = await db
      .select({
        memberId: communityMembers.id,
        communityId: communityMembers.communityId,
        joinedAt: communityMembers.joinedAt,
        role: communityMembers.role,
        communityTitle: communities.title,
        communitySlug: communities.slug,
        communityBrand: communities.brand,
        communityCover: communities.coverImage,
        communityStatus: communities.status,
      })
      .from(communityMembers)
      .innerJoin(communities, eq(communityMembers.communityId, communities.id))
      .where(eq(communityMembers.userId, ctx.user.id))
      .orderBy(desc(communityMembers.joinedAt));

    // Separate courses from quiz-type LMS items
    // "cohort" courses are live/scheduled cohort courses — include them alongside regular courses
    const { isEnrollmentAccessActive } = await import("../lib/enrollmentAccess");
    const activeEnrollments = enrollments.filter((e) =>
      isEnrollmentAccessActive({ enrollmentType: "full", accessExpiresAt: e.accessExpiresAt }),
    );
    const courses = activeEnrollments.filter(e => e.courseType === "course" || e.courseType === "cohort");
    const quizzes = activeEnrollments.filter(e => e.courseType === "quiz");
    const downloads = activeEnrollments.filter(e => e.courseType === "download");

    return {
      courses,
      quizzes,
      downloads: [
        ...downloads,
        ...digitalPurchaseRows,
      ],
      webinars: webinarRegs,
      physicalProducts: physicalOrders,
      bundles: bundleRegs,
      communities: communityRegs,
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
            const sub = await getStripeClient().subscriptions.retrieve(m.stripeSubscriptionId) as any;
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

    // Also fetch LMS course subscriptions (orders with a stripeSubscriptionId)
    const courseOrders = await db
      .select({
        id: lmsOrders.id,
        courseId: lmsOrders.courseId,
        stripeSubscriptionId: lmsOrders.stripeSubscriptionId,
        stripeSessionId: lmsOrders.stripeSessionId,
        amount: lmsOrders.amount,
        currency: lmsOrders.currency,
        status: lmsOrders.status,
        createdAt: lmsOrders.createdAt,
        courseTitle: lmsCourses.title,
        courseSlug: lmsCourses.slug,
      })
      .from(lmsOrders)
      .leftJoin(lmsCourses, eq(lmsOrders.courseId, lmsCourses.id))
      .where(and(eq(lmsOrders.userId, ctx.user.id)))
      .orderBy(desc(lmsOrders.createdAt));

    const enrichedCourseOrders = await Promise.all(
      courseOrders
        .filter(o => o.stripeSubscriptionId != null)
        .map(async (o) => {
          let stripeData: {
            status: string;
            currentPeriodEnd: Date | null;
            cancelAtPeriodEnd: boolean;
            interval: string | null;
            amount: number | null;
            currency: string | null;
          } | null = null;

          if (o.stripeSubscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(o.stripeSubscriptionId) as any;
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
              console.warn("[Dashboard] Failed to fetch Stripe subscription for order:", o.id, err);
            }
          }

          return {
            id: o.id,
            type: "course" as const,
            courseTitle: o.courseTitle ?? "Course Subscription",
            courseSlug: o.courseSlug ?? null,
            stripeSubscriptionId: o.stripeSubscriptionId,
            status: o.status,
            createdAt: o.createdAt,
            stripe: stripeData,
          };
        })
    );

    return { memberships: enriched, courseSubscriptions: enrichedCourseOrders };
  }),

  // ── Cancel Course Subscription (student-accessible) ───────────────────────────

  cancelCourseSubscription: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify ownership — student can only cancel their own orders
      const [order] = await db
        .select()
        .from(lmsOrders)
        .where(and(eq(lmsOrders.id, input.orderId), eq(lmsOrders.userId, ctx.user.id)))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
      if (!order.stripeSubscriptionId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription found for this order" });

      // Cancel at period end — student keeps access until billing period ends
      await stripe.subscriptions.update(order.stripeSubscriptionId, { cancel_at_period_end: true });

      return { success: true, message: "Your subscription will be cancelled at the end of the current billing period. You will retain access until then." };
    }),

  // ── Reactivate Course Subscription (student-accessible) ───────────────────────

  reactivateCourseSubscription: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [order] = await db
        .select()
        .from(lmsOrders)
        .where(and(eq(lmsOrders.id, input.orderId), eq(lmsOrders.userId, ctx.user.id)))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
      if (!order.stripeSubscriptionId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription found" });

      await stripe.subscriptions.update(order.stripeSubscriptionId, { cancel_at_period_end: false });

      return { success: true, message: "Your subscription has been reactivated." };
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
      await getStripeClient().subscriptions.update(membership.stripeSubscriptionId, {
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

      await getStripeClient().subscriptions.update(membership.stripeSubscriptionId, {
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

  // ── Purchases (all one-time transactions + subscription invoice payments) ────

  getMyPurchases: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // 1. Funnel / embedded-checkout purchases (one-time)
    const funnelRows = await db
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

    // 2. LMS orders (one-time course purchases — exclude subscription orders)
    const oneTimeOrders = await db
      .select({
        id: lmsOrders.id,
        courseTitle: lmsCourses.title,
        amount: lmsOrders.amount,
        currency: lmsOrders.currency,
        status: lmsOrders.status,
        createdAt: lmsOrders.createdAt,
      })
      .from(lmsOrders)
      .leftJoin(lmsCourses, eq(lmsOrders.courseId, lmsCourses.id))
      .where(and(eq(lmsOrders.userId, ctx.user.id), eq(lmsOrders.status, "paid")))
      .orderBy(desc(lmsOrders.createdAt));

    // 3. Fetch Stripe payment history for subscription invoices
    // Find all stripeCustomerIds associated with this user
    const membershipRows = await db
      .select({ stripeCustomerId: brandMemberships.stripeCustomerId })
      .from(brandMemberships)
      .where(eq(brandMemberships.userId, ctx.user.id));

    const customerIds = [...new Set(
      membershipRows.map(m => m.stripeCustomerId).filter(Boolean) as string[]
    )];

    // Fetch recent paid invoices from Stripe for these customers
    let stripeInvoices: Array<{
      id: string;
      description: string;
      amount: number;
      currency: string;
      date: Date;
      type: "subscription_payment";
      invoiceUrl: string | null;
    }> = [];

    for (const custId of customerIds) {
      try {
        const invoices = await stripe.invoices.list({
          customer: custId,
          status: "paid",
          limit: 50,
        });
        for (const inv of invoices.data) {
          stripeInvoices.push({
            id: inv.id,
            description: inv.lines?.data?.[0]?.description ?? inv.description ?? "Subscription payment",
            amount: inv.amount_paid,
            currency: inv.currency,
            date: new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000),
            type: "subscription_payment",
            invoiceUrl: inv.hosted_invoice_url ?? null,
          });
        }
      } catch (err) {
        console.warn("[Dashboard] Failed to fetch Stripe invoices for customer:", custId, err);
      }
    }

    // Combine all into a unified timeline
    const allPurchases = [
      ...funnelRows.map(p => ({
        id: `funnel-${p.id}`,
        description: p.productName,
        type: "one_time" as const,
        productType: p.productType,
        amount: p.amountPaid,
        currency: p.currency,
        date: p.purchasedAt,
        status: p.status,
        sourceType: p.sourceType,
        orderBumps: p.orderBumps,
        invoiceUrl: null as string | null,
      })),
      ...oneTimeOrders
        .filter(o => !membershipRows.length || true) // include all one-time orders
        .map(o => ({
          id: `order-${o.id}`,
          description: o.courseTitle ?? "Course Purchase",
          type: "one_time" as const,
          productType: "course" as const,
          amount: o.amount,
          currency: o.currency,
          date: o.createdAt,
          status: o.status,
          sourceType: null as string | null,
          orderBumps: null as string | null,
          invoiceUrl: null as string | null,
        })),
      ...stripeInvoices.map(inv => ({
        id: `invoice-${inv.id}`,
        description: inv.description,
        type: "subscription_payment" as const,
        productType: "subscription" as const,
        amount: inv.amount,
        currency: inv.currency,
        date: inv.date,
        status: "paid" as const,
        sourceType: null as string | null,
        orderBumps: null as string | null,
        invoiceUrl: inv.invoiceUrl,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return allPurchases;
  }),
});
