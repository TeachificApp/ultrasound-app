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
import { resolveAssetUrl, resolveAssetUrls } from "../lib/resolveAssetUrl";
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
  bundleItems,
  communityMembers,
  communities,
  workshopEnrollments,
  workshopInstances,
  workshops,
  workshopPricingOptions,
  membershipSubscriptions,
  membershipPlans,
  membershipPlanAccess,
  digitalBundlePurchases,
  digitalBundles,
  manualInvoices,
  deferredCheckoutSessions,
} from "../../drizzle/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
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
        thinkificEnrolledAt: users.thinkificEnrolledAt,
        createdAt: users.createdAt,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    return {
      ...user,
      avatarUrl: resolveAssetUrl(user.avatarUrl),
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
        stripeSubscriptionId: lmsEnrollments.stripeSubscriptionId,
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

    // 7. Workshop enrollments
    const workshopRegs = await db
      .select({
        enrollmentId: workshopEnrollments.id,
        workshopId: workshopEnrollments.workshopId,
        instanceId: workshopEnrollments.instanceId,
        enrolledAt: workshopEnrollments.accessGrantedAt,
        attended: workshopEnrollments.attended,
        status: workshopEnrollments.status,
        workshopTitle: workshops.title,
        workshopSlug: workshops.slug,
        workshopBrand: workshops.brand,
        workshopCover: workshops.coverImageUrl,
        workshopStatus: workshops.status,
        instanceTitle: workshopInstances.title,
        instanceStartDate: workshopInstances.startDate,
        instanceEndDate: workshopInstances.endDate,
        instanceLocationType: workshopInstances.locationType,
        instanceVenueCity: workshopInstances.venueCity,
        instanceVenueState: workshopInstances.venueState,
      })
      .from(workshopEnrollments)
      .innerJoin(workshops, eq(workshopEnrollments.workshopId, workshops.id))
      .innerJoin(workshopInstances, eq(workshopEnrollments.instanceId, workshopInstances.id))
      .where(and(eq(workshopEnrollments.userId, ctx.user.id), eq(workshopEnrollments.status, "active")))
      .orderBy(desc(workshopEnrollments.accessGrantedAt));

    // 8. Community memberships
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

    // Enrich enrollments that have a stripeSubscriptionId with live Stripe data (cancelAtPeriodEnd, currentPeriodEnd)
    const enrichedEnrollments = await Promise.all(
      activeEnrollments.map(async (e) => {
        if (!e.stripeSubscriptionId) return { ...e, cancelAtPeriodEnd: false, stripePeriodEnd: null as Date | null };
        try {
          const sub = await getStripeClient().subscriptions.retrieve(e.stripeSubscriptionId) as any;
          return {
            ...e,
            cancelAtPeriodEnd: sub.cancel_at_period_end as boolean,
            stripePeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null as Date | null,
          };
        } catch {
          return { ...e, cancelAtPeriodEnd: false, stripePeriodEnd: null as Date | null };
        }
      })
    );

    const courses = enrichedEnrollments.filter(e => e.courseType === "course" || e.courseType === "cohort");
    const quizzes = enrichedEnrollments.filter(e => e.courseType === "quiz");
    const downloads = enrichedEnrollments.filter(e => e.courseType === "download");

    // ── 9. Items from active membership subscriptions ─────────────────────────
    const activeMembershipSubs = await db
      .select({
        subId: membershipSubscriptions.id,
        planId: membershipSubscriptions.planId,
        planTitle: membershipPlans.title,
        planCoverImage: membershipPlans.coverImage,
        planSlug: membershipPlans.slug,
        status: membershipSubscriptions.status,
        currentPeriodEnd: membershipSubscriptions.currentPeriodEnd,
      })
      .from(membershipSubscriptions)
      .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
      .where(and(
        eq(membershipSubscriptions.userId, ctx.user.id),
        inArray(membershipSubscriptions.status, ["active", "trialing"]),
      ));

    // Collect all membership-included items
    const membershipCourses: any[] = [];
    const membershipQuizzes: any[] = [];
    const membershipDownloads: any[] = [];
    const membershipWebinars: any[] = [];
    const membershipCommunities: any[] = [];

    for (const sub of activeMembershipSubs) {
      const accessItems = await db
        .select()
        .from(membershipPlanAccess)
        .where(eq(membershipPlanAccess.planId, sub.planId));

      const sourceTag = `Included with ${sub.planTitle}`;

      for (const item of accessItems) {
        if (!item.itemId) continue; // skip wildcard types like all_courses

        if (item.itemType === "course" || item.itemType === "quiz") {
          // Check not already enrolled (LMS courses and quizzes only — downloads are digital products handled below)
          const alreadyEnrolled = activeEnrollments.some(e => e.courseId === item.itemId);
          if (alreadyEnrolled) continue;

          const [course] = await db
            .select({
              id: lmsCourses.id,
              title: lmsCourses.title,
              slug: lmsCourses.slug,
              type: lmsCourses.type,
              brand: lmsCourses.brand,
              thumbnailUrl: lmsCourses.thumbnailUrl,
              status: lmsCourses.status,
            })
            .from(lmsCourses)
            .where(and(eq(lmsCourses.id, item.itemId), eq(lmsCourses.status, "published")))
            .limit(1);

          if (!course) continue;

          const entry = {
            courseId: course.id,
            courseTitle: course.title,
            courseSlug: course.slug,
            courseType: course.type,
            courseBrand: course.brand,
            courseThumbnail: course.thumbnailUrl,
            accessSource: sourceTag,
            enrollmentId: null,
            enrolledAt: null,
            completedAt: null,
            progressPct: null,
            accessExpiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
            enrollmentSource: "membership" as const,
          };

          if (course.type === "quiz") membershipQuizzes.push(entry);
          else if (course.type === "download") membershipDownloads.push(entry);
          else membershipCourses.push(entry);

        } else if (item.itemType === "download") {
          // digital product download
          const alreadyPurchased = digitalPurchaseRows.some(d => d.productId === item.itemId);
          if (alreadyPurchased) continue;

          const [product] = await db
            .select({
              id: digitalProducts.id,
              title: digitalProducts.title,
              slug: digitalProducts.slug,
              thumbnailUrl: digitalProducts.thumbnailUrl,
            })
            .from(digitalProducts)
            .where(and(eq(digitalProducts.id, item.itemId), eq(digitalProducts.status, "published")))
            .limit(1);

          if (!product) continue;
          membershipDownloads.push({
            purchaseId: null,
            productId: product.id,
            purchasedAt: null,
            productTitle: product.title,
            productSlug: product.slug,
            productThumbnail: product.thumbnailUrl,
            accessSource: sourceTag,
          });

        } else if (item.itemType === "webinar") {
          const alreadyRegistered = webinarRegs.some(w => w.webinarId === item.itemId);
          if (alreadyRegistered) continue;

          const [webinar] = await db
            .select({
              id: webinars.id,
              title: webinars.title,
              slug: webinars.slug,
              brand: webinars.brand,
              coverImage: webinars.coverImage,
              type: webinars.type,
              status: webinars.status,
              scheduledAt: webinars.scheduledAt,
            })
            .from(webinars)
            .where(eq(webinars.id, item.itemId))
            .limit(1);

          if (!webinar) continue;
          membershipWebinars.push({
            registrationId: null,
            webinarId: webinar.id,
            registeredAt: null,
            attended: false,
            webinarTitle: webinar.title,
            webinarSlug: webinar.slug,
            webinarBrand: webinar.brand,
            webinarCover: webinar.coverImage,
            webinarType: webinar.type,
            webinarStatus: webinar.status,
            scheduledAt: webinar.scheduledAt,
            accessSource: sourceTag,
          });

        } else if (item.itemType === "community") {
          const alreadyMember = communityRegs.some(c => c.communityId === item.itemId);
          if (alreadyMember) continue;

          const [community] = await db
            .select({
              id: communities.id,
              title: communities.title,
              slug: communities.slug,
              brand: communities.brand,
              coverImage: communities.coverImage,
              status: communities.status,
            })
            .from(communities)
            .where(eq(communities.id, item.itemId))
            .limit(1);

          if (!community) continue;
          membershipCommunities.push({
            memberId: null,
            communityId: community.id,
            joinedAt: null,
            role: "member",
            communityTitle: community.title,
            communitySlug: community.slug,
            communityBrand: community.brand,
            communityCover: community.coverImage,
            communityStatus: community.status,
            accessSource: sourceTag,
          });
        }
      }
    }

    // ── 10. Items from active bundle enrollments ──────────────────────────────
    const bundleCourses: any[] = [];
    const bundleQuizzes: any[] = [];
    const bundleDownloads: any[] = [];
    const bundleWebinars: any[] = [];

    for (const bundleReg of bundleRegs) {
      const bundleAccessItems = await db
        .select()
        .from(bundleItems)
        .where(eq(bundleItems.bundleId, bundleReg.bundleId));

      const sourceTag = `Included with ${bundleReg.bundleTitle}`;

      for (const item of bundleAccessItems) {
        if (item.itemType === "course" || item.itemType === "quiz") {
          // LMS courses and quizzes only — digital product downloads handled below
          const alreadyEnrolled = activeEnrollments.some(e => e.courseId === item.itemId)
            || membershipCourses.some(e => e.courseId === item.itemId)
            || membershipQuizzes.some(e => e.courseId === item.itemId);
          if (alreadyEnrolled) continue;

          const [course] = await db
            .select({
              id: lmsCourses.id,
              title: lmsCourses.title,
              slug: lmsCourses.slug,
              type: lmsCourses.type,
              brand: lmsCourses.brand,
              thumbnailUrl: lmsCourses.thumbnailUrl,
              status: lmsCourses.status,
            })
            .from(lmsCourses)
            .where(and(eq(lmsCourses.id, item.itemId), eq(lmsCourses.status, "published")))
            .limit(1);

          if (!course) continue;

          const entry = {
            courseId: course.id,
            courseTitle: course.title,
            courseSlug: course.slug,
            courseType: course.type,
            courseBrand: course.brand,
            courseThumbnail: course.thumbnailUrl,
            accessSource: sourceTag,
            enrollmentId: null,
            enrolledAt: null,
            completedAt: null,
            progressPct: null,
            accessExpiresAt: null,
            enrollmentSource: "bundle" as const,
          };

          if (course.type === "quiz") bundleQuizzes.push(entry);
          else if (course.type === "download") bundleDownloads.push(entry);
          else bundleCourses.push(entry);

        } else if (item.itemType === "webinar") {
          const alreadyRegistered = webinarRegs.some(w => w.webinarId === item.itemId)
            || membershipWebinars.some(w => w.webinarId === item.itemId);
          if (alreadyRegistered) continue;

          const [webinar] = await db
            .select({
              id: webinars.id,
              title: webinars.title,
              slug: webinars.slug,
              brand: webinars.brand,
              coverImage: webinars.coverImage,
              type: webinars.type,
              status: webinars.status,
              scheduledAt: webinars.scheduledAt,
            })
            .from(webinars)
            .where(eq(webinars.id, item.itemId))
            .limit(1);

          if (!webinar) continue;
          bundleWebinars.push({
            registrationId: null,
            webinarId: webinar.id,
            registeredAt: null,
            attended: false,
            webinarTitle: webinar.title,
            webinarSlug: webinar.slug,
            webinarBrand: webinar.brand,
            webinarCover: webinar.coverImage,
            webinarType: webinar.type,
            webinarStatus: webinar.status,
            scheduledAt: webinar.scheduledAt,
            accessSource: sourceTag,
          });

        } else if (item.itemType === "download") {
          // Digital product download included in bundle
          const alreadyPurchased = digitalPurchaseRows.some(d => d.productId === item.itemId)
            || membershipDownloads.some(d => d.productId === item.itemId);
          if (alreadyPurchased) continue;

          const [product] = await db
            .select({
              id: digitalProducts.id,
              title: digitalProducts.title,
              slug: digitalProducts.slug,
              thumbnailUrl: digitalProducts.thumbnailUrl,
            })
            .from(digitalProducts)
            .where(and(eq(digitalProducts.id, item.itemId), eq(digitalProducts.status, "published")))
            .limit(1);

          if (!product) continue;
          bundleDownloads.push({
            purchaseId: null,
            productId: product.id,
            purchasedAt: null,
            productTitle: product.title,
            productSlug: product.slug,
            productThumbnail: product.thumbnailUrl,
            accessSource: sourceTag,
          });
        }
      }
    }

    // ── 11. Build memberships array for the Memberships tab ─────────────────────
    // Include native plan subscriptions (active/trialing)
    const membershipCards = activeMembershipSubs.map(sub => ({
      type: "plan" as const,
      id: sub.subId,
      planId: sub.planId,
      title: sub.planTitle,
      coverImage: sub.planCoverImage ?? null,
      slug: sub.planSlug ?? null,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
    }));

    // Also include brand memberships (Thinkific / legacy Stripe brand memberships)
    const brandMembershipRows = await db
      .select({
        id: brandMemberships.id,
        brand: brandMemberships.brand,
        tier: brandMemberships.tier,
        status: brandMemberships.status,
        source: brandMemberships.source,
        grantedAt: brandMemberships.grantedAt,
        expiresAt: brandMemberships.expiresAt,
      })
      .from(brandMemberships)
      .where(eq(brandMemberships.userId, ctx.user.id))
      .orderBy(desc(brandMemberships.createdAt));

    // Map brand + tier to human-readable display names
    const BRAND_MEMBERSHIP_NAMES: Record<string, Record<string, string>> = {
      aaus: { premium: "UltrasoundAssist™ Premium", free: "UltrasoundAssist™ Free", basic: "UltrasoundAssist™ Basic" },
      iheartecho: { premium: "EchoAssist™ Premium", free: "EchoAssist™ Free", basic: "EchoAssist™ Basic" },
    };
    const BRAND_COVER_IMAGES: Record<string, string> = {
      aaus: resolveAssetUrl(
        "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/ultrasound-hero-probe-3bWMAQMJw9YFHoPXwbt8bZ.webp",
      )!,
      iheartecho: resolveAssetUrl(
        "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp",
      )!,
    };
    const brandMembershipCards = brandMembershipRows.map(m => ({
      type: "brand" as const,
      id: m.id,
      title: BRAND_MEMBERSHIP_NAMES[m.brand]?.[m.tier] ?? `${m.tier.charAt(0).toUpperCase() + m.tier.slice(1)} Membership`,
      coverImage: BRAND_COVER_IMAGES[m.brand] ?? null,
      brand: m.brand,
      status: m.status,
      source: m.source,
      grantedAt: m.grantedAt,
      expiresAt: m.expiresAt,
    }));

    return resolveAssetUrls({
      courses: [...courses, ...membershipCourses, ...bundleCourses],
      quizzes: [...quizzes, ...membershipQuizzes, ...bundleQuizzes],
      downloads: [
        ...downloads,
        ...digitalPurchaseRows,
        ...membershipDownloads,
        ...bundleDownloads,
      ],
      webinars: [...webinarRegs, ...membershipWebinars, ...bundleWebinars],
      physicalProducts: physicalOrders,
      bundles: bundleRegs,
      workshops: workshopRegs,
      communities: [...communityRegs, ...membershipCommunities],
      funnelPurchases: funnelPurchaseRows,
      memberships: [...membershipCards, ...brandMembershipCards],
    });
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

        if (m.stripeSubscriptionId) {
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
              const sub = await getStripeClient().subscriptions.retrieve(o.stripeSubscriptionId) as any;
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

    // Also fetch enrollment-based subscriptions (stripeSubscriptionId on lms_enrollments directly,
    // not via an lms_orders row — e.g. admin-granted recurring subscriptions)
    const enrollmentSubs = await db.execute(
      sql`
        SELECT
          e.id AS enrollmentId,
          e.stripe_subscription_id AS stripeSubscriptionId,
          e.enrolled_at AS createdAt,
          e.access_expires_at AS accessExpiresAt,
          c.id AS courseId,
          c.title AS courseTitle,
          c.slug AS courseSlug
        FROM lms_enrollments e
        JOIN lms_courses c ON c.id = e.course_id
        WHERE e.user_id = ${ctx.user.id}
          AND e.stripe_subscription_id IS NOT NULL
          AND (
            e.order_id IS NULL
            OR e.order_id NOT IN (
              SELECT id FROM lms_orders WHERE stripe_subscription_id IS NOT NULL
            )
          )
        ORDER BY e.enrolled_at DESC
      `
    );

    const enrichedEnrollmentSubs = await Promise.all(
      (enrollmentSubs[0] as any[]).map(async (e: any) => {
        let stripeData: {
          status: string;
          currentPeriodEnd: Date | null;
          cancelAtPeriodEnd: boolean;
          interval: string | null;
          amount: number | null;
          currency: string | null;
        } | null = null;

        if (e.stripeSubscriptionId) {
          try {
            const sub = await getStripeClient().subscriptions.retrieve(e.stripeSubscriptionId) as any;
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
            console.warn("[Dashboard] Failed to fetch Stripe subscription for enrollment:", e.enrollmentId, err);
          }
        }

        return {
          enrollmentId: e.enrollmentId as number,
          type: "enrollment" as const,
          courseTitle: (e.courseTitle as string) ?? "Course Subscription",
          courseSlug: (e.courseSlug as string) ?? null,
          stripeSubscriptionId: e.stripeSubscriptionId as string,
          createdAt: e.createdAt as Date,
          stripe: stripeData,
        };
      })
    );

    return { memberships: enriched, courseSubscriptions: enrichedCourseOrders, enrollmentSubscriptions: enrichedEnrollmentSubs };
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
      const updatedSub = await getStripeClient().subscriptions.update(order.stripeSubscriptionId, { cancel_at_period_end: true });

      // Set access_expires_at on the enrollment to the Stripe period end date
      const periodEnd = new Date(updatedSub.current_period_end * 1000);
      await db.update(lmsEnrollments)
        .set({ accessExpiresAt: periodEnd })
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.orderId, input.orderId)));

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

      await getStripeClient().subscriptions.update(order.stripeSubscriptionId, { cancel_at_period_end: false });

      return { success: true, message: "Your subscription has been reactivated." };
    }),

  // ── Cancel Enrollment Subscription (student-accessible, for enrollment-based subs) ──────────────

  cancelEnrollmentSubscription: protectedProcedure
    .input(z.object({ enrollmentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify ownership — student can only cancel their own enrollment
      const [enrollment] = await db
        .select()
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.id, input.enrollmentId), eq(lmsEnrollments.userId, ctx.user.id)))
        .limit(1);

      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

      // Resolve stripeSubscriptionId — from enrollment directly, or via linked order
      let stripeSubId = enrollment.stripeSubscriptionId;
      if (!stripeSubId && enrollment.orderId) {
        const [order] = await db.select({ stripeSubscriptionId: lmsOrders.stripeSubscriptionId })
          .from(lmsOrders).where(eq(lmsOrders.id, enrollment.orderId)).limit(1);
        stripeSubId = order?.stripeSubscriptionId ?? null;
      }

      if (!stripeSubId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Stripe subscription linked to this enrollment" });

      // Cancel at period end — student keeps access until billing period ends
      const updatedSub = await getStripeClient().subscriptions.update(stripeSubId, { cancel_at_period_end: true }) as any;
      const periodEnd = new Date(updatedSub.current_period_end * 1000);
      await db.update(lmsEnrollments)
        .set({ accessExpiresAt: periodEnd })
        .where(eq(lmsEnrollments.id, input.enrollmentId));

      return { success: true, message: "Your subscription will be cancelled at the end of the current billing period. You will retain access until then." };
    }),

  // ── Reactivate Enrollment Subscription (student-accessible) ──────────────────

  reactivateEnrollmentSubscription: protectedProcedure
    .input(z.object({ enrollmentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [enrollment] = await db
        .select()
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.id, input.enrollmentId), eq(lmsEnrollments.userId, ctx.user.id)))
        .limit(1);

      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

      let stripeSubId = enrollment.stripeSubscriptionId;
      if (!stripeSubId && enrollment.orderId) {
        const [order] = await db.select({ stripeSubscriptionId: lmsOrders.stripeSubscriptionId })
          .from(lmsOrders).where(eq(lmsOrders.id, enrollment.orderId)).limit(1);
        stripeSubId = order?.stripeSubscriptionId ?? null;
      }

      if (!stripeSubId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active Stripe subscription linked to this enrollment" });

      await getStripeClient().subscriptions.update(stripeSubId, { cancel_at_period_end: false });
      // Clear the access_expires_at that was set when cancellation was scheduled
      await db.update(lmsEnrollments)
        .set({ accessExpiresAt: null })
        .where(eq(lmsEnrollments.id, input.enrollmentId));

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

    return resolveAssetUrls(certs);
  }),

  // ── Purchases (all one-time transactions + subscription invoice payments) ────

  getMyPurchases: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const userId = ctx.user.id;

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
        stripePaymentIntentId: funnelPurchases.stripePaymentIntentId,
        stripeCheckoutSessionId: funnelPurchases.stripeCheckoutSessionId,
        cardLast4: funnelPurchases.cardLast4,
        cardBrand: funnelPurchases.cardBrand,
      })
      .from(funnelPurchases)
      .where(eq(funnelPurchases.userId, userId))
      .orderBy(desc(funnelPurchases.purchasedAt));

    // 2. LMS orders (one-time course purchases)
    const oneTimeOrders = await db
      .select({
        id: lmsOrders.id,
        courseTitle: lmsCourses.title,
        courseBrand: lmsCourses.brand,
        amount: lmsOrders.amount,
        currency: lmsOrders.currency,
        status: lmsOrders.status,
        createdAt: lmsOrders.createdAt,
        stripePaymentIntentId: lmsOrders.stripePaymentIntentId,
        stripeSessionId: lmsOrders.stripeSessionId,
      })
      .from(lmsOrders)
      .leftJoin(lmsCourses, eq(lmsOrders.courseId, lmsCourses.id))
      .where(and(eq(lmsOrders.userId, userId), eq(lmsOrders.status, "paid")))
      .orderBy(desc(lmsOrders.createdAt));

    // 3. Digital download purchases
    const downloadRows = await db
      .select({
        id: digitalPurchases.id,
        productTitle: digitalProducts.title,
        amount: digitalPurchases.amount,
        currency: digitalPurchases.currency,
        purchasedAt: digitalPurchases.purchasedAt,
        stripePaymentIntentId: digitalPurchases.stripePaymentIntentId,
      })
      .from(digitalPurchases)
      .leftJoin(digitalProducts, eq(digitalPurchases.productId, digitalProducts.id))
      .where(eq(digitalPurchases.userId, userId))
      .orderBy(desc(digitalPurchases.purchasedAt));

    // 4. Digital bundle purchases
    const bundlePurchaseRows = await db
      .select({
        id: digitalBundlePurchases.id,
        bundleTitle: digitalBundles.title,
        discountPrice: digitalBundles.discountPrice,
        originalPrice: digitalBundles.originalPrice,
        currency: digitalBundles.currency,
        purchasedAt: digitalBundlePurchases.purchasedAt,
        stripeCheckoutSessionId: digitalBundlePurchases.stripeCheckoutSessionId,
      })
      .from(digitalBundlePurchases)
      .leftJoin(digitalBundles, eq(digitalBundlePurchases.bundleId, digitalBundles.id))
      .where(eq(digitalBundlePurchases.userId, userId))
      .orderBy(desc(digitalBundlePurchases.purchasedAt));

    // 5. Workshop enrollments (paid)
    const workshopRows = await db
      .select({
        id: workshopEnrollments.id,
        workshopTitle: workshops.title,
        workshopBrand: workshops.brand,
        amountPaid: workshopEnrollments.amountPaid,
        currency: workshopEnrollments.currency,
        createdAt: workshopEnrollments.createdAt,
        status: workshopEnrollments.status,
        stripePaymentIntentId: workshopEnrollments.stripePaymentIntentId,
        stripeSessionId: workshopEnrollments.stripeSessionId,
      })
      .from(workshopEnrollments)
      .leftJoin(workshops, eq(workshopEnrollments.workshopId, workshops.id))
      .where(and(eq(workshopEnrollments.userId, userId), eq(workshopEnrollments.status, "active")))
      .orderBy(desc(workshopEnrollments.createdAt));

    // 6. Webinar registrations (paid — filter by stripePaymentIntentId present)
    const webinarRows = await db
      .select({
        id: webinarRegistrations.id,
        webinarTitle: webinars.title,
        webinarBrand: webinars.brand,
        webinarPrice: webinars.price,
        registeredAt: webinarRegistrations.registeredAt,
        stripePaymentIntentId: webinarRegistrations.stripePaymentIntentId,
      })
      .from(webinarRegistrations)
      .leftJoin(webinars, eq(webinarRegistrations.webinarId, webinars.id))
      .where(eq(webinarRegistrations.userId, userId))
      .orderBy(desc(webinarRegistrations.registeredAt));

    // 7. Physical product orders
    const physicalRows = await db
      .select({
        id: physicalProductOrders.id,
        productTitle: physicalProducts.title,
        amountPaid: physicalProductOrders.amountPaid,
        currency: physicalProductOrders.currency,
        orderedAt: physicalProductOrders.orderedAt,
        fulfillmentStatus: physicalProductOrders.fulfillmentStatus,
        stripePaymentIntentId: physicalProductOrders.stripePaymentIntentId,
      })
      .from(physicalProductOrders)
      .leftJoin(physicalProducts, eq(physicalProductOrders.productId, physicalProducts.id))
      .where(eq(physicalProductOrders.userId, userId))
      .orderBy(desc(physicalProductOrders.orderedAt));

    // 8. Membership subscriptions (native membership plans)
    const membershipSubRows = await db
      .select({
        id: membershipSubscriptions.id,
        planTitle: membershipPlans.title,
        planPrice: membershipPlans.price,
        planCurrency: membershipPlans.currency,
        createdAt: membershipSubscriptions.createdAt,
        status: membershipSubscriptions.status,
        stripeCustomerId: membershipSubscriptions.stripeCustomerId,
      })
      .from(membershipSubscriptions)
      .leftJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
      .where(eq(membershipSubscriptions.userId, userId));

    // 9. Collect ALL Stripe customer IDs across all subscription sources
    const brandMembershipRows = await db
      .select({ stripeCustomerId: brandMemberships.stripeCustomerId })
      .from(brandMemberships)
      .where(eq(brandMemberships.userId, userId));

    // Also look up Stripe customer ID from lms_orders subscription charges
    // (course subscriptions store stripeSubscriptionId but not customerId directly;
    //  we retrieve the customer from Stripe using the subscription ID)
    const courseSubOrders = await db
      .select({ stripeSubscriptionId: lmsOrders.stripeSubscriptionId })
      .from(lmsOrders)
      .where(and(eq(lmsOrders.userId, userId), eq(lmsOrders.status, "paid")))
      .orderBy(desc(lmsOrders.createdAt));

    const allCustomerIds = [...new Set([
      ...brandMembershipRows.map(m => m.stripeCustomerId),
      ...membershipSubRows.map(m => m.stripeCustomerId),
    ].filter(Boolean) as string[])];

    // For course subscriptions, fetch invoices directly via subscription ID
    const courseSubIds = [...new Set(
      courseSubOrders.map(o => o.stripeSubscriptionId).filter(Boolean) as string[]
    )];

    // Fetch manual invoices (admin-created off-platform records)
    let manualInvoiceRows: typeof manualInvoices.$inferSelect[] = [];
    try {
      manualInvoiceRows = await db.select().from(manualInvoices).where(eq(manualInvoices.userId, ctx.user.id));
      console.log(`[Dashboard] manualInvoices for user ${ctx.user.id}: ${manualInvoiceRows.length} rows`);
    } catch (err) {
      console.warn("[Dashboard] Failed to fetch manualInvoices:", err);
    }

    // Fetch deferred checkout sessions (pending delayed-payment methods — ACH, bank debit, etc.)
    let deferredRows: Array<{
      id: number;
      stripeSessionId: string;
      productName: string | null;
      paymentStatus: string;
      status: "pending" | "completed" | "failed";
      createdAt: Date;
    }> = [];
    try {
      deferredRows = await db
        .select({
          id: deferredCheckoutSessions.id,
          stripeSessionId: deferredCheckoutSessions.stripeSessionId,
          productName: deferredCheckoutSessions.productName,
          paymentStatus: deferredCheckoutSessions.paymentStatus,
          status: deferredCheckoutSessions.status,
          createdAt: deferredCheckoutSessions.createdAt,
        })
        .from(deferredCheckoutSessions)
        .where(and(
          eq(deferredCheckoutSessions.userId, userId),
          eq(deferredCheckoutSessions.status, "pending"),
        ))
        .orderBy(desc(deferredCheckoutSessions.createdAt));
    } catch (err) {
      console.warn("[Dashboard] Failed to fetch deferredCheckoutSessions:", err);
    }

    // Fetch recent paid invoices from Stripe for all subscription customers
    let stripeInvoices: Array<{
      id: string;
      description: string;
      amount: number;
      currency: string;
      date: Date;
      type: "subscription_payment";
      invoiceUrl: string | null;
      paymentIntentId: string | null;
    }> = [];

    for (const custId of allCustomerIds) {
      try {
        const invoices = await getStripeClient().invoices.list({
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
            paymentIntentId: typeof inv.payment_intent === "string" ? inv.payment_intent : (inv.payment_intent as any)?.id ?? null,
          });
        }
      } catch (err) {
        console.warn("[Dashboard] Failed to fetch Stripe invoices for customer:", custId, err);
      }
    }

    // Also fetch invoices for course subscriptions by subscription ID
    for (const subId of courseSubIds) {
      try {
        const invoices = await getStripeClient().invoices.list({
          subscription: subId,
          status: "paid",
          limit: 50,
        });
        for (const inv of invoices.data) {
          // Avoid duplicates if customer was already fetched above
          if (!stripeInvoices.find(i => i.id === inv.id)) {
            stripeInvoices.push({
              id: inv.id,
              description: inv.lines?.data?.[0]?.description ?? inv.description ?? "Course subscription renewal",
              amount: inv.amount_paid,
              currency: inv.currency,
              date: new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000),
              type: "subscription_payment",
              invoiceUrl: inv.hosted_invoice_url ?? null,
              paymentIntentId: typeof inv.payment_intent === "string" ? inv.payment_intent : (inv.payment_intent as any)?.id ?? null,
            });
          }
        }
      } catch (err) {
        console.warn("[Dashboard] Failed to fetch Stripe invoices for subscription:", subId, err);
      }
    }

    // Combine all into a unified timeline
    const allPurchases = [
      ...funnelRows.map(p => ({
        id: `funnel-${p.id}`,
        description: p.productName,
        type: "one_time" as const,
        productType: p.productType ?? "other",
        amount: p.amountPaid,
        currency: p.currency,
        date: p.purchasedAt,
        status: p.status,
        sourceType: p.sourceType,
        orderBumps: p.orderBumps,
        invoiceUrl: null as string | null,
        transactionId: p.stripePaymentIntentId ?? p.stripeCheckoutSessionId ?? null as string | null,
        brand: null as string | null,
        fulfillmentStatus: null as string | null,
        cardLast4: p.cardLast4 ?? null as string | null,
        cardBrand: p.cardBrand ?? null as string | null,
      })),
      ...oneTimeOrders.map(o => ({
        id: `order-${o.id}`,
        description: o.courseTitle ?? "Course Purchase",
        type: "one_time" as const,
        productType: "course",
        amount: o.amount,
        currency: o.currency,
        date: o.createdAt,
        status: o.status,
        sourceType: null as string | null,
        orderBumps: null as string | null,
        invoiceUrl: null as string | null,
        transactionId: o.stripePaymentIntentId ?? o.stripeSessionId ?? null as string | null,
        brand: o.courseBrand ?? null as string | null,
        fulfillmentStatus: null as string | null,
      })),
      ...downloadRows
        .filter(d => (d.amount ?? 0) > 0) // only paid downloads
        .map(d => ({
          id: `download-${d.id}`,
          description: d.productTitle ?? "Download Purchase",
          type: "one_time" as const,
          productType: "download",
          amount: d.amount ?? 0,
          currency: d.currency,
          date: d.purchasedAt,
          status: "paid" as const,
          sourceType: null as string | null,
          orderBumps: null as string | null,
          invoiceUrl: null as string | null,
          transactionId: d.stripePaymentIntentId ?? null as string | null,
          brand: null as string | null,
          fulfillmentStatus: null as string | null,
        })),
      ...bundlePurchaseRows.map(b => ({
        id: `bundle-${b.id}`,
        description: b.bundleTitle ?? "Bundle Purchase",
        type: "one_time" as const,
        productType: "bundle",
        amount: b.discountPrice ?? b.originalPrice ?? 0,
        currency: b.currency ?? "usd",
        date: b.purchasedAt,
        status: "paid" as const,
        sourceType: null as string | null,
        orderBumps: null as string | null,
        invoiceUrl: null as string | null,
        transactionId: b.stripeCheckoutSessionId ?? null as string | null,
        brand: null as string | null,
        fulfillmentStatus: null as string | null,
      })),
      ...workshopRows
        .filter(w => w.amountPaid > 0) // only paid workshops
        .map(w => ({
          id: `workshop-${w.id}`,
          description: w.workshopTitle ?? "Workshop",
          type: "one_time" as const,
          productType: "workshop",
          amount: w.amountPaid,
          currency: w.currency,
          date: w.createdAt,
          status: w.status === "active" ? "paid" : w.status,
          sourceType: null as string | null,
          orderBumps: null as string | null,
          invoiceUrl: null as string | null,
          transactionId: w.stripePaymentIntentId ?? w.stripeSessionId ?? null as string | null,
          brand: w.workshopBrand ?? null as string | null,
          fulfillmentStatus: null as string | null,
        })),
      ...webinarRows
        .filter(w => !!w.stripePaymentIntentId && (w.webinarPrice ?? 0) > 0) // only paid webinars
        .map(w => ({
          id: `webinar-${w.id}`,
          description: w.webinarTitle ?? "Webinar",
          type: "one_time" as const,
          productType: "webinar",
          amount: w.webinarPrice ?? 0,
          currency: "usd",
          date: w.registeredAt,
          status: "paid" as const,
          sourceType: null as string | null,
          orderBumps: null as string | null,
          invoiceUrl: null as string | null,
          transactionId: w.stripePaymentIntentId ?? null as string | null,
          brand: w.webinarBrand ?? null as string | null,
          fulfillmentStatus: null as string | null,
        })),
      ...physicalRows.map(p => ({
        id: `physical-${p.id}`,
        description: p.productTitle ?? "Physical Product",
        type: "one_time" as const,
        productType: "physical",
        amount: p.amountPaid,
        currency: p.currency,
        date: p.orderedAt,
        status: p.fulfillmentStatus === "cancelled" || p.fulfillmentStatus === "refunded" ? p.fulfillmentStatus : "paid",
        sourceType: null as string | null,
        orderBumps: null as string | null,
        invoiceUrl: null as string | null,
        transactionId: p.stripePaymentIntentId ?? null as string | null,
        brand: null as string | null,
        fulfillmentStatus: p.fulfillmentStatus ?? null as string | null,
      })),
      ...stripeInvoices.map(inv => ({
        id: `invoice-${inv.id}`,
        description: inv.description,
        type: "subscription_payment" as const,
        productType: "subscription",
        amount: inv.amount,
        currency: inv.currency,
        date: inv.date,
        status: "paid" as const,
        sourceType: null as string | null,
        orderBumps: null as string | null,
        invoiceUrl: inv.invoiceUrl,
        transactionId: inv.paymentIntentId ?? inv.id ?? null as string | null,
        brand: null as string | null,
        fulfillmentStatus: null as string | null,
      })),
      // Pending delayed-payment sessions (ACH, bank debit — awaiting payment confirmation)
      ...deferredRows.map(d => ({
        id: `deferred-${d.id}`,
        description: d.productName ?? "Purchase (payment pending)",
        type: "one_time" as const,
        productType: "pending" as string,
        amount: 0,
        currency: "usd",
        date: d.createdAt,
        status: "payment_pending" as string,
        sourceType: null as string | null,
        orderBumps: null as string | null,
        invoiceUrl: null as string | null,
        transactionId: d.stripeSessionId ?? null as string | null,
        brand: null as string | null,
        fulfillmentStatus: "awaiting_payment" as string | null,
      })),
      // Manual invoices (admin-created records for off-platform payments)
      ...manualInvoiceRows.map(inv => ({
        id: `manual-${inv.id}`,
        description: inv.description,
        type: "manual_invoice" as const,
        productType: "manual",
        amount: inv.amountPaid,
        currency: inv.currency,
        date: inv.paidAt,
        status: "paid" as const,
        sourceType: inv.paymentSource ?? null as string | null,
        orderBumps: inv.lineItems ? JSON.stringify(inv.lineItems) : null as string | null,
        invoiceUrl: null as string | null,
        transactionId: inv.invoiceNumber ?? null as string | null,
        brand: null as string | null,
        fulfillmentStatus: null as string | null,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return allPurchases;
  }),

  // Fetch card last4 for a specific payment intent (called lazily when receipt modal opens)
  getPaymentMethodDetails: protectedProcedure
    .input(z.object({ paymentIntentId: z.string() }))
    .query(async ({ input }) => {
      try {
        const pi = await getStripeClient().paymentIntents.retrieve(input.paymentIntentId, {
          expand: ["payment_method"],
        }) as any;
        const pm = pi.payment_method;
        const card = pm?.card ?? pm?.card_present ?? null;
        return {
          cardLast4: card?.last4 ?? null as string | null,
          cardBrand: card?.brand ?? null as string | null,
        };
      } catch {
        return { cardLast4: null, cardBrand: null };
      }
    }),
});
