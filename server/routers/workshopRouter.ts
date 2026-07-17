import { getStripeClient } from "../lib/stripeClient";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, gt, gte, like, lte, or, sql, isNull } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { syncStripeProduct } from "../stripeSync";
import { buildOrderBumpCheckoutLine } from "../lib/orderBumpCheckout";
import {
  workshops,
  workshopInstances,
  workshopResources,
  workshopEnrollments,
  workshopPricingOptions,
  workshopWaitlistEntries,
  users,
  lmsEnrollments,
  lmsSections,
  lmsLessons,
} from "../../drizzle/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if a workshop instance is currently available for purchase */
function isInstanceOnSale(instance: {
  availableForPurchase: boolean;
  status: string;
  salesOpenDate: Date | null;
  salesCloseDate: Date | null;
  startDate: Date;
  capacity?: number | null;
  enrolledCount?: number | null;
}): boolean {
  if (!instance.availableForPurchase) return false;
  if (instance.status !== "published") return false;
  const now = new Date();
  // Check sales open date
  if (instance.salesOpenDate && now < instance.salesOpenDate) return false;
  // Check sales close date — if set by admin, use it; otherwise auto-close at startDate
  const closeDate = instance.salesCloseDate ?? instance.startDate;
  if (now >= closeDate) return false;
  // Capacity check — if capacity is set and fully enrolled, not on sale
  if (instance.capacity != null && (instance.enrolledCount ?? 0) >= instance.capacity) return false;
  return true;
}

/** Returns true when an instance is date-valid but at capacity (sold out) */
function isInstanceSoldOut(instance: {
  availableForPurchase: boolean;
  status: string;
  salesOpenDate: Date | null;
  salesCloseDate: Date | null;
  startDate: Date;
  capacity?: number | null;
  enrolledCount?: number | null;
}): boolean {
  if (!instance.availableForPurchase) return false;
  if (instance.status !== "published") return false;
  const now = new Date();
  if (instance.salesOpenDate && now < instance.salesOpenDate) return false;
  const closeDate = instance.salesCloseDate ?? instance.startDate;
  if (now >= closeDate) return false;
  // Must have capacity set and be at/over it
  return instance.capacity != null && (instance.enrolledCount ?? 0) >= instance.capacity;
}

// ─── Public Router ────────────────────────────────────────────────────────────
export const workshopPublicRouter = router({
  /** Get a workshop landing page (slug-based, public) */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [workshop] = await db
        .select()
        .from(workshops)
        .where(
          and(
            eq(workshops.slug, input.slug),
            or(
              eq(workshops.status, "public"),
              eq(workshops.status, "hidden")
            )
          )
        )
        .limit(1);
      if (!workshop) throw new TRPCError({ code: "NOT_FOUND" });

      // Get all published instances
      const allInstances = await db
        .select()
        .from(workshopInstances)
        .where(
          and(
            eq(workshopInstances.workshopId, workshop.id),
            eq(workshopInstances.status, "published")
          )
        )
        .orderBy(asc(workshopInstances.startDate));

      // Filter to those currently on sale (not full)
      const availableInstances = allInstances.filter(isInstanceOnSale);
      // Instances that are date-valid but sold out (at capacity)
      const soldOutInstances = allInstances.filter(isInstanceSoldOut);

      // Get pricing options
      const pricingOptions = await db
        .select()
        .from(workshopPricingOptions)
        .where(
          and(
            eq(workshopPricingOptions.workshopId, workshop.id),
            eq(workshopPricingOptions.isActive, true)
          )
        )
        .orderBy(asc(workshopPricingOptions.sortOrder));

      // Get published resources (workshop-level, not instance-specific)
      const resources = await db
        .select()
        .from(workshopResources)
        .where(
          and(
            eq(workshopResources.workshopId, workshop.id),
            eq(workshopResources.status, "published"),
            isNull(workshopResources.instanceId)
          )
        )
        .orderBy(asc(workshopResources.position));

      return {
        workshop,
        availableInstances,
        soldOutInstances,
        allInstances,
        pricingOptions,
        resources,
      };
    }),

  /** List workshops for the Education Library */
  list: publicProcedure
    .input(
      z.object({
        brand: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [
        eq(workshops.status, "public"),
        eq(workshops.showInLibrary, true),
      ];
      if (input.brand) conditions.push(eq(workshops.brand, input.brand as any));
      const rows = await db
        .select()
        .from(workshops)
        .where(and(...conditions))
        .orderBy(asc(workshops.libraryOrder), desc(workshops.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Attach next upcoming published instance for each workshop
      if (rows.length === 0) return rows;
      const now = new Date();
      const workshopIds = rows.map(r => r.id);
      const instances = await db
        .select({
          workshopId: workshopInstances.workshopId,
          startDate: workshopInstances.startDate,
          endDate: workshopInstances.endDate,
          locationType: workshopInstances.locationType,
          venueName: workshopInstances.venueName,
          venueCity: workshopInstances.venueCity,
          venueState: workshopInstances.venueState,
        })
        .from(workshopInstances)
        .where(
          and(
            sql`${workshopInstances.workshopId} IN (${sql.join(workshopIds.map(id => sql`${id}`), sql`, `)})`,
            eq(workshopInstances.status, "published"),
            gte(workshopInstances.startDate, now),
          )
        )
        .orderBy(asc(workshopInstances.startDate));

      // Map: workshopId -> first upcoming instance
      const instanceMap = new Map<number, typeof instances[0]>();
      for (const inst of instances) {
        if (!instanceMap.has(inst.workshopId)) instanceMap.set(inst.workshopId, inst);
      }

      return rows.map(r => ({ ...r, nextInstance: instanceMap.get(r.id) ?? null }));
    }),

  /** Public: get workshop instances by their IDs — used by cohort_instance_cards_auto block on course landing pages */
  getInstancesByIds: publicProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .query(async ({ input }) => {
      if (input.ids.length === 0) return [];
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          id: workshopInstances.id,
          workshopId: workshopInstances.workshopId,
          title: workshopInstances.title,
          status: workshopInstances.status,
          startDate: workshopInstances.startDate,
          endDate: workshopInstances.endDate,
          timezone: workshopInstances.timezone,
          durationMinutes: workshopInstances.durationMinutes,
          locationType: workshopInstances.locationType,
          venueName: workshopInstances.venueName,
          venueCity: workshopInstances.venueCity,
          venueState: workshopInstances.venueState,
          description: workshopInstances.description,
          capacity: workshopInstances.capacity,
          enrolledCount: workshopInstances.enrolledCount,
          workshopTitle: workshops.title,
        })
        .from(workshopInstances)
        .innerJoin(workshops, eq(workshopInstances.workshopId, workshops.id))
        .where(sql`${workshopInstances.id} IN (${sql.join(input.ids.map(id => sql`${id}`), sql`, `)})`);
      return rows;
    }),

  /** Public: get all upcoming published instances for a specific workshop (used by CICA block when no specific instances are selected) */
  getInstancesByWorkshopId: publicProcedure
    .input(z.object({ workshopId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          id: workshopInstances.id,
          workshopId: workshopInstances.workshopId,
          title: workshopInstances.title,
          status: workshopInstances.status,
          startDate: workshopInstances.startDate,
          endDate: workshopInstances.endDate,
          timezone: workshopInstances.timezone,
          durationMinutes: workshopInstances.durationMinutes,
          locationType: workshopInstances.locationType,
          venueName: workshopInstances.venueName,
          venueCity: workshopInstances.venueCity,
          venueState: workshopInstances.venueState,
          description: workshopInstances.description,
          capacity: workshopInstances.capacity,
          enrolledCount: workshopInstances.enrolledCount,
          workshopTitle: workshops.title,
        })
        .from(workshopInstances)
        .innerJoin(workshops, eq(workshopInstances.workshopId, workshops.id))
        .where(
          sql`${workshopInstances.workshopId} = ${input.workshopId} AND ${workshopInstances.status} IN ('published', 'open', 'active')`
        )
        .orderBy(workshopInstances.startDate);
      return rows;
    }),
  /** Public: get live seat availability for a workshop instance (no cache — real-time) */
  getSeatAvailability: publicProcedure
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [instance] = await db
        .select({
          id: workshopInstances.id,
          title: workshopInstances.title,
          capacity: workshopInstances.capacity,
          enrolledCount: workshopInstances.enrolledCount,
        })
        .from(workshopInstances)
        .where(eq(workshopInstances.id, input.instanceId))
        .limit(1);
      if (!instance) throw new TRPCError({ code: "NOT_FOUND" });
      const capacity = instance.capacity ?? null;
      const enrolled = instance.enrolledCount ?? 0;
      const remaining = capacity !== null ? Math.max(0, capacity - enrolled) : null;
      return {
        instanceId: instance.id,
        title: instance.title,
        capacity,
        enrolled,
        remaining, // null = unlimited
        isFull: capacity !== null && enrolled >= capacity,
      };
    }),


  /** Public: get landing blocks + basic info for a specific workshop instance */
  getInstancePage: publicProcedure
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const row = await db
        .select()
        .from(workshopInstances)
        .where(eq(workshopInstances.id, input.instanceId))
        .then(r => r[0] ?? null);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      // Count active enrollments for real-time seat availability
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(workshopEnrollments)
        .where(and(
          eq(workshopEnrollments.instanceId, input.instanceId),
          eq(workshopEnrollments.status, "active")
        ));
      const enrolledCount = Number(countRow?.count ?? row.enrolledCount ?? 0);
      const capacity = row.capacity ?? null;
      const seatsRemaining = capacity !== null ? Math.max(0, capacity - enrolledCount) : null;
      const isSoldOut = capacity !== null && enrolledCount >= capacity;
      return {
        id: row.id,
        title: row.title,
        startDate: row.startDate,
        endDate: row.endDate,
        timezone: row.timezone,
        durationMinutes: row.durationMinutes,
        locationType: row.locationType,
        venueName: row.venueName,
        venueCity: row.venueCity,
        venueState: row.venueState,
        venueAddress: row.venueAddress,
        meetingUrl: row.meetingUrl,
        description: row.description,
        instanceContent: row.instanceContent,
        landingBlocks: row.landingBlocks ? JSON.parse(row.landingBlocks) : [],
        capacity,
        enrolledCount,
        seatsRemaining,
        isSoldOut,
      };
    }),
});

// ─── Learner Router ───────────────────────────────────────────────────────────
export const workshopLearnerRouter = router({
  /** Get the learner's enrolled workshops */
  myEnrollments: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const enrollments = await db
      .select({
        enrollment: workshopEnrollments,
        workshop: workshops,
        instance: workshopInstances,
      })
      .from(workshopEnrollments)
      .innerJoin(workshops, eq(workshopEnrollments.workshopId, workshops.id))
      .innerJoin(
        workshopInstances,
        eq(workshopEnrollments.instanceId, workshopInstances.id)
      )
      .where(
        and(
          eq(workshopEnrollments.userId, ctx.user.id),
          eq(workshopEnrollments.status, "active")
        )
      )
      .orderBy(desc(workshopEnrollments.createdAt));
    return enrollments;
  }),

  /** Get full workshop detail for an enrolled learner */
  getEnrolledWorkshop: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [workshop] = await db
        .select()
        .from(workshops)
        .where(eq(workshops.slug, input.slug))
        .limit(1);
      if (!workshop) throw new TRPCError({ code: "NOT_FOUND" });

      // Check enrollment
      const [enrollment] = await db
        .select()
        .from(workshopEnrollments)
        .where(
          and(
            eq(workshopEnrollments.workshopId, workshop.id),
            eq(workshopEnrollments.userId, ctx.user.id),
            eq(workshopEnrollments.status, "active")
          )
        )
        .orderBy(desc(workshopEnrollments.createdAt))
        .limit(1);
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled" });

      // Get instance
      const [instance] = await db
        .select()
        .from(workshopInstances)
        .where(eq(workshopInstances.id, enrollment.instanceId))
        .limit(1);

      // Get resources (workshop-level + instance-specific)
      const resources = await db
        .select()
        .from(workshopResources)
        .where(
          and(
            eq(workshopResources.workshopId, workshop.id),
            eq(workshopResources.status, "published"),
            or(
              isNull(workshopResources.instanceId),
              instance
                ? eq(workshopResources.instanceId, instance.id)
                : isNull(workshopResources.instanceId)
            )
          )
        )
        .orderBy(asc(workshopResources.position));

      // Get curriculum if enabled (reuse lms_sections + lms_lessons via courseId stored in workshop)
      let sections: any[] = [];
      let lessons: any[] = [];
      if (workshop.curriculumEnabled) {
        // Workshops share the lms_sections/lms_lessons tables via a courseId
        // The courseId is stored in workshop.curriculumCourseId (we'll use a convention:
        // workshop.id + 900000 offset to avoid collision, or we store it separately)
        // For now, return empty — admin wires curriculum via LMS course linkage
        sections = [];
        lessons = [];
      }

      return { workshop, enrollment, instance: instance ?? null, resources, sections, lessons };
    }),

  /**
   * Free self-enrollment — grants access to a workshop without payment.
   * Used by the CTA builder "free_enrollment" action when productType = "workshop".
   * Enrolls into the first upcoming (or any active) instance of the workshop.
   */
  enrollFree: protectedProcedure
    .input(z.object({ workshopId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [workshop] = await db.select().from(workshops)
        .where(eq(workshops.id, input.workshopId)).limit(1);
      if (!workshop) throw new TRPCError({ code: "NOT_FOUND", message: "Workshop not found" });
      // Pick the best instance: first upcoming, else first active, else any
      const allInstances = await db.select().from(workshopInstances)
        .where(eq(workshopInstances.workshopId, input.workshopId))
        .orderBy(asc(workshopInstances.startDate));
      const now = new Date();
      const instance = allInstances.find(i => i.startDate && new Date(i.startDate) >= now)
        ?? allInstances.find(i => i.status === "active")
        ?? allInstances[0];
      if (!instance) throw new TRPCError({ code: "NOT_FOUND", message: "No available instance for this workshop" });
      // Idempotent: skip if already enrolled
      const [existing] = await db.select({ id: workshopEnrollments.id }).from(workshopEnrollments)
        .where(and(
          eq(workshopEnrollments.workshopId, input.workshopId),
          eq(workshopEnrollments.instanceId, instance.id),
          eq(workshopEnrollments.userId, ctx.user.id)
        )).limit(1);
      if (existing) return { success: true, alreadyEnrolled: true, instanceId: instance.id };
      await db.insert(workshopEnrollments).values({
        workshopId: input.workshopId,
        instanceId: instance.id,
        userId: ctx.user.id,
        amountPaid: 0,
        currency: "usd",
        status: "active",
      });
      await db.update(workshopInstances)
        .set({ enrolledCount: sql`enrolled_count + 1` })
        .where(eq(workshopInstances.id, instance.id));
      return { success: true, alreadyEnrolled: false, instanceId: instance.id };
    }),

  /** Create an embedded checkout session for a workshop instance */
  createEmbeddedCheckoutSession: publicProcedure
    .input(
      z.object({
        workshopSlug: z.string(),
        instanceId: z.number(),
        origin: z.string(),
        orderBumpId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id ?? 0;
      const userEmail = ctx.user?.email ?? undefined;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [workshop] = await db
        .select()
        .from(workshops)
        .where(eq(workshops.slug, input.workshopSlug))
        .limit(1);
      if (!workshop) throw new TRPCError({ code: "NOT_FOUND", message: "Workshop not found" });

      const [instance] = await db
        .select()
        .from(workshopInstances)
        .where(eq(workshopInstances.id, input.instanceId))
        .limit(1);
      if (!instance) throw new TRPCError({ code: "NOT_FOUND", message: "Workshop instance not found" });

      // Verify still on sale (includes capacity check)
      if (!isInstanceOnSale(instance)) {
        // Distinguish sold-out from date-closed for a better error message
        if (isInstanceSoldOut(instance)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This workshop session is sold out." });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: "This workshop is no longer available for purchase." });
      }

      // Check for existing enrollment (only for authenticated users — guests have userId=0
      // and we must not block them with a false "already enrolled" match)
      if (userId) {
        const [existing] = await db
          .select()
          .from(workshopEnrollments)
          .where(
            and(
              eq(workshopEnrollments.workshopId, workshop.id),
              eq(workshopEnrollments.instanceId, instance.id),
              eq(workshopEnrollments.userId, userId),
              eq(workshopEnrollments.status, "active")
            )
          )
          .limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "You are already enrolled in this workshop." });
      }

      // Determine price (instance override or workshop default)
      // Both instance.price and workshop.price are stored in cents (int)
      const priceInCents =
        instance.price != null
          ? Math.round(Number(instance.price))
          : Math.round(Number(workshop.price));

      const { platformSettings } = await import("../../drizzle/schema");
      const [settings] = await db
        .select({ termsUrl: platformSettings.termsUrl, privacyUrl: platformSettings.privacyUrl })
        .from(platformSettings)
        .limit(1);

      if (priceInCents === 0 || workshop.isFree) {
        // Free enrollment — only if user is logged in
        if (userId) await db.insert(workshopEnrollments).values({
          workshopId: workshop.id,
          instanceId: instance.id,
          userId,
          amountPaid: 0,
          currency: workshop.currency,
          status: "active",
        });
        if (userId) await db
          .update(workshopInstances)
          .set({ enrolledCount: sql`enrolled_count + 1` })
          .where(eq(workshopInstances.id, instance.id));
        return {
          clientSecret: null,
          free: true,
          workshopTitle: workshop.title,
          instanceTitle: instance.title,
          workshopThumbnail: workshop.thumbnailUrl ?? null,
          primaryColor: workshop.primaryColor ?? "#179ca3",
          accentColor: workshop.accentColor ?? "#0d9488",
          productName: `${workshop.title} — ${instance.title}`,
          displayPrice: 0,
          currency: workshop.currency,
          termsUrl: settings?.termsUrl ?? "",
          privacyUrl: settings?.privacyUrl ?? "",
        };
      }

      const stripe = getStripeClient();

      // Build order bump line item if provided
      const orderBumpCheckout = await buildOrderBumpCheckoutLine(db, {
        orderBumpId: input.orderBumpId,
        triggerType: "workshop",
        triggerProductId: workshop.id,
        currency: workshop.currency,
      });

      const instanceTitle = instance.title || workshop.title;
      const primaryLineItem = {
        price_data: {
          currency: workshop.currency,
          product_data: {
            name: `${workshop.title} — ${instanceTitle}`,
            description: instance.description ?? workshop.subtitle ?? undefined,
            images: workshop.thumbnailUrl ? [workshop.thumbnailUrl] : undefined,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      };
      const isUpgradeBump = orderBumpCheckout?.bumpMode === "upgrade";
      const workshopIdempotencyDate = new Date().toISOString().slice(0, 10);
      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode: "payment",
        customer_email: userEmail,
        client_reference_id: userId ? userId.toString() : undefined,
        allow_promotion_codes: true,
        line_items: isUpgradeBump
          ? [orderBumpCheckout!.lineItem]
          : [primaryLineItem, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
        metadata: {
          type: "workshop",
          workshop_id: workshop.id.toString(),
          instance_id: instance.id.toString(),
          user_id: userId ? userId.toString() : "",
          customer_email: userEmail ?? "",
          ...(isUpgradeBump ? { bump_mode: "upgrade" } : {}),
          ...orderBumpCheckout?.metadata,
        },
        payment_intent_data: { description: `${workshop.title} — Workshop Registration` },
        return_url: `${input.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&type=workshop`,
      }, { idempotencyKey: `workshop-checkout-${userId}-${workshop.id}-${instance.id}-${workshopIdempotencyDate}` });

      return {
        clientSecret: session.client_secret!,
        free: false,
        workshopTitle: workshop.title,
        instanceTitle: instance.title,
        workshopThumbnail: workshop.thumbnailUrl ?? null,
        primaryColor: workshop.primaryColor ?? "#179ca3",
        accentColor: workshop.accentColor ?? "#0d9488",
        productName: `${workshop.title} — ${instanceTitle}`,
        displayPrice: Math.round(priceInCents / 100),
        currency: workshop.currency,
        termsUrl: settings?.termsUrl ?? "",
        privacyUrl: settings?.privacyUrl ?? "",
      };
    }),

  /** Complete enrollment after successful Stripe payment */
  completeEnrollment: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(input.sessionId);

      if (session.payment_status !== "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payment not completed." });
      }

      const workshopId = parseInt(session.metadata?.workshop_id ?? "0");
      const instanceId = parseInt(session.metadata?.instance_id ?? "0");
      const userId = parseInt(session.metadata?.user_id ?? "0");

      if (!workshopId || !instanceId || !userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid session metadata." });
      }

      // Idempotent: check if already enrolled
      const [existing] = await db
        .select()
        .from(workshopEnrollments)
        .where(
          and(
            eq(workshopEnrollments.workshopId, workshopId),
            eq(workshopEnrollments.instanceId, instanceId),
            eq(workshopEnrollments.userId, userId),
            eq(workshopEnrollments.status, "active")
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(workshopEnrollments).values({
          workshopId,
          instanceId,
          userId,
          stripeSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
          amountPaid: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          status: "active",
        });
        // Increment enrolled count
        await db
          .update(workshopInstances)
          .set({ enrolledCount: sql`enrolled_count + 1` })
          .where(eq(workshopInstances.id, instanceId));
      }

      const [workshop] = await db.select().from(workshops).where(eq(workshops.id, workshopId)).limit(1);
      return { success: true, workshopSlug: workshop?.slug ?? "" };
    }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────
export const workshopAdminRouter = router({
  /** List all workshops */
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        // Support both page/pageSize (client) and limit/offset (legacy)
        page: z.number().default(1),
        pageSize: z.number().default(20),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const limit = input.limit ?? input.pageSize;
      const offset = input.offset ?? (input.page - 1) * limit;
      const conditions: any[] = [];
      if (input.status) conditions.push(eq(workshops.status, input.status as any));
      if (input.search) conditions.push(like(workshops.title, `%${input.search}%`));
      const [rows, countRows] = await Promise.all([
        db.select().from(workshops)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(workshops.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(workshops)
          .where(conditions.length ? and(...conditions) : undefined),
      ]);
      // Fetch instances for each workshop
      const workshopsWithInstances = await Promise.all(
        rows.map(async (w) => {
          const instances = await db
            .select()
            .from(workshopInstances)
            .where(eq(workshopInstances.workshopId, w.id))
            .orderBy(asc(workshopInstances.startDate));
          return { ...w, instances };
        })
      );
      
      return { workshops: workshopsWithInstances, total: Number(countRows[0]?.count ?? 0) };
    }),

  /** Get a single workshop by id */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [workshop] = await db
        .select()
        .from(workshops)
        .where(eq(workshops.id, input.id))
        .limit(1);
      if (!workshop) throw new TRPCError({ code: "NOT_FOUND" });
      const instances = await db
        .select()
        .from(workshopInstances)
        .where(eq(workshopInstances.workshopId, workshop.id))
        .orderBy(asc(workshopInstances.startDate));
      const resources = await db
        .select()
        .from(workshopResources)
        .where(eq(workshopResources.workshopId, workshop.id))
        .orderBy(asc(workshopResources.position));
      const pricingOptions = await db
        .select()
        .from(workshopPricingOptions)
        .where(eq(workshopPricingOptions.workshopId, workshop.id))
        .orderBy(asc(workshopPricingOptions.sortOrder));
      return { workshop, instances, resources, pricingOptions };
    }),

  /** Create a new workshop */
  create: protectedProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        title: z.string().min(1),
        subtitle: z.string().optional(),
        brand: z.enum(["aaus", "iheartecho"]).default("aaus"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ins] = await db.insert(workshops).values({
        slug: input.slug,
        title: input.title,
        subtitle: input.subtitle,
        brand: input.brand,
        createdByUserId: ctx.user.id,
        status: "draft",
        price: 0,
        isFree: false,
        currency: "usd",
        pricingType: "one_time",
        curriculumEnabled: true,
        showInLibrary: true,
        libraryOrder: 0,
        isFeatured: false,
        hidePricingOptions: false,
        customThankYouEnabled: false,
        welcomeEmailEnabled: true,
      }).$returningId();
      return { id: ins.id };
    }),

  /** Update workshop settings */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        slug: z.string().optional(),
        title: z.string().optional(),
        subtitle: z.string().nullish(),
        description: z.string().nullish(),
        coverImageUrl: z.string().nullish(),
        thumbnailUrl: z.string().nullish(),
        status: z.enum(["draft", "public", "hidden", "private", "archived"]).optional(),
        brand: z.enum(["aaus", "iheartecho"]).optional(),
        price: z.number().optional(),
        compareAtPrice: z.number().nullish(),
        isFree: z.boolean().optional(),
        currency: z.string().optional(),
        pricingType: z.enum(["free", "one_time"]).optional(),
        curriculumEnabled: z.boolean().optional(),
        landingBlocks: z.string().nullish(),
        landingHeadline: z.string().nullish(),
        landingBody: z.string().nullish(),
        metaTitle: z.string().nullish(),
        metaDescription: z.string().nullish(),
        metaKeywords: z.string().nullish(),
        seoTitle: z.string().nullish(),
        seoDescription: z.string().nullish(),
        seoImage: z.string().nullish(),
        customThankYouEnabled: z.boolean().optional(),
        customThankYouBlocks: z.string().nullish(),
        postPurchaseRedirectUrl: z.string().nullish(),
        welcomeEmailEnabled: z.boolean().optional(),
        welcomeEmailSubject: z.string().nullish(),
        welcomeEmailBody: z.string().nullish(),
        hidePricingOptions: z.boolean().optional(),
        primaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        showInLibrary: z.boolean().optional(),
        libraryOrder: z.number().optional(),
        isFeatured: z.boolean().optional(),
        publishDomain: z.string().nullish(),
        afterPurchaseWorkflow: z.string().nullish(),
        checkoutPageConfig: z.string().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) updateData[k] = v === null ? null : v;
      }
      await db.update(workshops).set(updateData).where(eq(workshops.id, id));
      return { success: true };
    }),

  /** Delete a workshop */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(workshopEnrollments).where(eq(workshopEnrollments.workshopId, input.id));
      await db.delete(workshopResources).where(eq(workshopResources.workshopId, input.id));
      await db.delete(workshopInstances).where(eq(workshopInstances.workshopId, input.id));
      await db.delete(workshopPricingOptions).where(eq(workshopPricingOptions.workshopId, input.id));
      await db.delete(workshops).where(eq(workshops.id, input.id));
      return { success: true };
    }),

  /** Duplicate a workshop (creates a draft copy with all settings but no instances) */
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [src] = await db.select().from(workshops).where(eq(workshops.id, input.id)).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND", message: "Workshop not found" });

      // Generate a unique slug for the copy
      const newTitle = `${src.title} [Copy]`;
      const baseSlug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
      let slug = baseSlug;
      let attempt = 0;
      while (true) {
        const [existing] = await db.select({ id: workshops.id }).from(workshops).where(eq(workshops.slug, slug)).limit(1);
        if (!existing) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = src as any;
      const [ins] = await db.insert(workshops).values({
        ...rest,
        slug,
        title: newTitle,
        status: "draft",
        createdByUserId: ctx.user.id,
      }).$returningId();

      // Copy pricing options (but not instances — those are time-specific)
      const pricingOptions = await db.select().from(workshopPricingOptions)
        .where(eq(workshopPricingOptions.workshopId, input.id))
        .orderBy(asc(workshopPricingOptions.sortOrder));
      for (const opt of pricingOptions) {
        const { id: _oid, workshopId: _wid, createdAt: _oca, updatedAt: _oua, ...optRest } = opt as any;
        await db.insert(workshopPricingOptions).values({ ...optRest, workshopId: ins.id });
      }

      return { id: ins.id, slug, title: newTitle };
    }),

  // ── Instances ──────────────────────────────────────────────────────────────

  /** Create a workshop instance */
  createInstance: protectedProcedure
    .input(
      z.object({
        workshopId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        startDate: z.string(), // ISO string
        endDate: z.string().optional(),
        timezone: z.string().default("America/New_York"),
        durationMinutes: z.number().default(480),
        locationType: z.enum(["in_person", "virtual", "hybrid"]).default("in_person"),
        venueName: z.string().optional(),
        venueAddress: z.string().optional(),
        venueCity: z.string().optional(),
        venueState: z.string().optional(),
        venueCountry: z.string().optional(),
        meetingUrl: z.string().optional(),
        capacity: z.number().nullish(),
        price: z.number().nullish(),
        compareAtPrice: z.number().nullish(),
        availableForPurchase: z.boolean().default(false),
        salesCloseDate: z.string().nullish(),
        salesOpenDate: z.string().nullish(),
        enrollmentCloseDate: z.string().nullish(),
        status: z.enum(["draft", "published", "cancelled", "completed"]).default("draft"),
        instanceContent: z.string().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ins] = await db.insert(workshopInstances).values({
        workshopId: input.workshopId,
        title: input.title,
        description: input.description,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        timezone: input.timezone,
        durationMinutes: input.durationMinutes,
        locationType: input.locationType,
        venueName: input.venueName,
        venueAddress: input.venueAddress,
        venueCity: input.venueCity,
        venueState: input.venueState,
        venueCountry: input.venueCountry,
        meetingUrl: input.meetingUrl,
        capacity: input.capacity ?? undefined,
        price: input.price ?? undefined,
        compareAtPrice: input.compareAtPrice ?? undefined,
        availableForPurchase: input.availableForPurchase,
        salesCloseDate: input.salesCloseDate ? new Date(input.salesCloseDate) : undefined,
        salesOpenDate: input.salesOpenDate ? new Date(input.salesOpenDate) : undefined,
        enrollmentCloseDate: input.enrollmentCloseDate ? new Date(input.enrollmentCloseDate) : undefined,
        status: input.status,
        enrolledCount: 0,
        instanceContent: input.instanceContent ?? undefined,
      }).$returningId();
      return { id: ins.id };
    }),

  /** Update a workshop instance */
  updateInstance: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().nullish(),
        startDate: z.string().optional(),
        endDate: z.string().nullish(),
        timezone: z.string().optional(),
        durationMinutes: z.number().optional(),
        locationType: z.enum(["in_person", "virtual", "hybrid"]).optional(),
        venueName: z.string().nullish(),
        venueAddress: z.string().nullish(),
        venueCity: z.string().nullish(),
        venueState: z.string().nullish(),
        venueCountry: z.string().nullish(),
        meetingUrl: z.string().nullish(),
        capacity: z.number().nullish(),
        price: z.number().nullish(),
        compareAtPrice: z.number().nullish(),
        availableForPurchase: z.boolean().optional(),
        salesCloseDate: z.string().nullish(),
        salesOpenDate: z.string().nullish(),
        enrollmentCloseDate: z.string().nullish(),
        status: z.enum(["draft", "published", "cancelled", "completed"]).optional(),
        instanceContent: z.string().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, startDate, endDate, salesCloseDate, salesOpenDate, enrollmentCloseDate, ...rest } = input;
      const updateData: Record<string, any> = { ...rest };
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
      if (salesCloseDate !== undefined) updateData.salesCloseDate = salesCloseDate ? new Date(salesCloseDate) : null;
      if (salesOpenDate !== undefined) updateData.salesOpenDate = salesOpenDate ? new Date(salesOpenDate) : null;
      if (enrollmentCloseDate !== undefined) updateData.enrollmentCloseDate = enrollmentCloseDate ? new Date(enrollmentCloseDate) : null;
      await db.update(workshopInstances).set(updateData).where(eq(workshopInstances.id, id));
      return { success: true };
    }),

  /** Delete a workshop instance */
  deleteInstance: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(workshopEnrollments).where(eq(workshopEnrollments.instanceId, input.id));
      await db.delete(workshopResources).where(eq(workshopResources.instanceId, input.id));
      await db.delete(workshopInstances).where(eq(workshopInstances.id, input.id));
      return { success: true };
    }),

  // ── Resources ──────────────────────────────────────────────────────────────

  /** Create a workshop resource */
  createResource: protectedProcedure
    .input(
      z.object({
        workshopId: z.number(),
        instanceId: z.number().nullish(),
        title: z.string().min(1),
        description: z.string().optional(),
        cardImageUrl: z.string().optional(),
        actionType: z.enum(["link", "download"]).default("link"),
        linkUrl: z.string().optional(),
        fileUrl: z.string().optional(),
        fileKey: z.string().optional(),
        fileName: z.string().optional(),
        status: z.enum(["draft", "published"]).default("published"),
        position: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ins] = await db.insert(workshopResources).values({
        workshopId: input.workshopId,
        instanceId: input.instanceId ?? undefined,
        title: input.title,
        description: input.description,
        cardImageUrl: input.cardImageUrl,
        actionType: input.actionType,
        linkUrl: input.linkUrl,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        fileName: input.fileName,
        status: input.status,
        position: input.position,
      }).$returningId();
      return { id: ins.id };
    }),

  /** Update a workshop resource */
  updateResource: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().nullish(),
        cardImageUrl: z.string().nullish(),
        actionType: z.enum(["link", "download"]).optional(),
        linkUrl: z.string().nullish(),
        fileUrl: z.string().nullish(),
        fileKey: z.string().nullish(),
        fileName: z.string().nullish(),
        status: z.enum(["draft", "published"]).optional(),
        position: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) updateData[k] = v;
      }
      await db.update(workshopResources).set(updateData).where(eq(workshopResources.id, id));
      return { success: true };
    }),

  /** Delete a workshop resource */
  deleteResource: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(workshopResources).where(eq(workshopResources.id, input.id));
      return { success: true };
    }),

  // ── Enrollments ────────────────────────────────────────────────────────────

  /** List enrollments for a workshop (admin) */
  listEnrollments: protectedProcedure
    .input(z.object({ workshopId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          enrollment: workshopEnrollments,
          user: { id: users.id, name: users.name, email: users.email },
          instance: workshopInstances,
        })
        .from(workshopEnrollments)
        .innerJoin(users, eq(workshopEnrollments.userId, users.id))
        .innerJoin(workshopInstances, eq(workshopEnrollments.instanceId, workshopInstances.id))
        .where(eq(workshopEnrollments.workshopId, input.workshopId))
        .orderBy(desc(workshopEnrollments.createdAt));
      return rows;
    }),

  /** Manually grant enrollment */
  grantEnrollment: protectedProcedure
    .input(
      z.object({
        workshopId: z.number(),
        instanceId: z.number(),
        userId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db
        .select()
        .from(workshopEnrollments)
        .where(
          and(
            eq(workshopEnrollments.workshopId, input.workshopId),
            eq(workshopEnrollments.instanceId, input.instanceId),
            eq(workshopEnrollments.userId, input.userId)
          )
        )
        .limit(1);
      if (existing) return { success: true, alreadyEnrolled: true };
      await db.insert(workshopEnrollments).values({
        workshopId: input.workshopId,
        instanceId: input.instanceId,
        userId: input.userId,
        amountPaid: 0,
        currency: "usd",
        status: "active",
      });
      await db
        .update(workshopInstances)
        .set({ enrolledCount: sql`enrolled_count + 1` })
        .where(eq(workshopInstances.id, input.instanceId));
      return { success: true, alreadyEnrolled: false };
    }),

  /** Revoke enrollment */
  revokeEnrollment: protectedProcedure
    .input(z.object({ enrollmentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(workshopEnrollments)
        .set({ status: "cancelled" })
        .where(eq(workshopEnrollments.id, input.enrollmentId));
      return { success: true };
    }),

  // ── Pricing Options ────────────────────────────────────────────────────────

  /** Save pricing options for a workshop */
  savePricingOptions: protectedProcedure
    .input(
      z.object({
        workshopId: z.number(),
        options: z.array(
          z.object({
            id: z.number().optional(),
            label: z.string(),
            sublabel: z.string().optional(),
            pricingType: z.enum(["one_time", "free"]).default("one_time"),
            price: z.number().default(0),
            compareAtPrice: z.number().nullish(),
            ctaLabel: z.string().optional(),
            sortOrder: z.number().default(0),
            isActive: z.boolean().default(true),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Fetch workshop title for Stripe product name
      const [wk] = await db.select({ title: workshops.title }).from(workshops).where(eq(workshops.id, input.workshopId));
      const workshopTitle = wk?.title ?? "Workshop";
      // Delete existing and re-insert with Stripe sync
      await db.delete(workshopPricingOptions).where(eq(workshopPricingOptions.workshopId, input.workshopId));
      if (input.options.length > 0) {
        const syncedOptions = await Promise.all(
          input.options.map(async (o) => {
            const stripeSync = o.pricingType === "one_time" && o.price > 0
              ? await syncStripeProduct({
                  name: `${workshopTitle} — ${o.label}`,
                  price: o.price,
                  billingInterval: "one_time",
                  metadata: { product_type: "workshop", workshop_id: String(input.workshopId) },
                })
              : { stripeProductId: null, stripePriceId: null };
            return {
              workshopId: input.workshopId,
              label: o.label,
              sublabel: o.sublabel,
              pricingType: o.pricingType,
              price: o.price,
              compareAtPrice: o.compareAtPrice ?? undefined,
              stripePriceId: stripeSync.stripePriceId ?? undefined,
              ctaLabel: o.ctaLabel,
              sortOrder: o.sortOrder,
              isActive: o.isActive,
            };
          })
        );
        await db.insert(workshopPricingOptions).values(syncedOptions);
      }
      return { success: true };
    }),

    // ── Landing Page ───────────────────────────────────────────────────────────
  /** Save landing page blocks */
  saveLandingBlocks: protectedProcedure
    .input(z.object({ id: z.number(), blocks: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(workshops)
        .set({ landingBlocks: input.blocks })
        .where(eq(workshops.id, input.id));
      return { success: true };
    }),

  // ── After Purchase ─────────────────────────────────────────────────────────
  getAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ workshopId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [w] = await db.select({ id: workshops.id, afterPurchaseWorkflow: workshops.afterPurchaseWorkflow })
        .from(workshops).where(eq(workshops.id, input.workshopId)).limit(1);
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      return { afterPurchaseWorkflow: w.afterPurchaseWorkflow ?? null };
    }),

  updateAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ workshopId: z.number(), workflow: z.string().nullable() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(workshops).set({ afterPurchaseWorkflow: input.workflow }).where(eq(workshops.id, input.workshopId));
      return { success: true };
    }),

  getHidePricingOptions: protectedProcedure
    .input(z.object({ workshopId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [w] = await db.select({ id: workshops.id, hidePricingOptions: workshops.hidePricingOptions })
        .from(workshops).where(eq(workshops.id, input.workshopId)).limit(1);
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      return { hidePricingOptions: w.hidePricingOptions ?? false };
    }),

  updateHidePricingOptions: protectedProcedure
    .input(z.object({ workshopId: z.number(), hidePricingOptions: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(workshops).set({ hidePricingOptions: input.hidePricingOptions }).where(eq(workshops.id, input.workshopId));
      return { success: true };
    }),

  // ── Waitlist Settings ─────────────────────────────────────────────────────
  getWaitlistSettings: protectedProcedure
    .input(z.object({ workshopId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [w] = await db.select({
        waitlistEnabled: workshops.waitlistEnabled,
        waitlistHeading: workshops.waitlistHeading,
        waitlistBody: workshops.waitlistBody,
        waitlistCtaLabel: workshops.waitlistCtaLabel,
        waitlistCtaUrl: workshops.waitlistCtaUrl,
        waitlistRedirectUrl: workshops.waitlistRedirectUrl,
        waitlistContentBlocks: workshops.waitlistContentBlocks,
        waitlistSuccessMessage: workshops.waitlistSuccessMessage,
      }).from(workshops).where(eq(workshops.id, input.workshopId)).limit(1);
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      return w;
    }),

  saveWaitlistSettings: protectedProcedure
    .input(z.object({
      workshopId: z.number(),
      waitlistEnabled: z.boolean(),
      waitlistHeading: z.string().nullish(),
      waitlistBody: z.string().nullish(),
      waitlistCtaLabel: z.string().nullish(),
      waitlistCtaUrl: z.string().nullish(),
      waitlistRedirectUrl: z.string().nullish(),
      waitlistContentBlocks: z.string().nullish(),
      waitlistSuccessMessage: z.string().nullish(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { workshopId, ...data } = input;
      await db.update(workshops).set(data).where(eq(workshops.id, workshopId));
      return { success: true };
    }),

  getWaitlistEntries: protectedProcedure
    .input(z.object({ workshopId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const entries = await db.select().from(workshopWaitlistEntries)
        .where(eq(workshopWaitlistEntries.workshopId, input.workshopId))
        .orderBy(desc(workshopWaitlistEntries.createdAt));
      return entries;
    }),
  exportWaitlistCsv: protectedProcedure
    .input(z.object({ workshopId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const entries = await db.select().from(workshopWaitlistEntries)
        .where(eq(workshopWaitlistEntries.workshopId, input.workshopId))
        .orderBy(desc(workshopWaitlistEntries.createdAt));
      const header = "Name,Email,Phone,Message,Date";
      const rows = entries.map(e => [
        `"${(e.name || "").replace(/"/g, '""')}"`,
        `"${(e.email || "").replace(/"/g, '""')}"`,
        `"${(e.phone || "").replace(/"/g, '""')}"`,
        `"${(e.message || "").replace(/"/g, '""')}"`,
        `"${new Date(e.createdAt).toISOString()}"`,
      ].join(","));
      return { csv: [header, ...rows].join("\n") };
    }),

  grantWaitlistAccess: protectedProcedure
    .input(z.object({
      entryId: z.number(),
      workshopId: z.number(),
      accessType: z.enum(["free", "paid"]),
      priceOverrideCents: z.number().int().min(0).optional(),
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [entry] = await db.select().from(workshopWaitlistEntries)
        .where(eq(workshopWaitlistEntries.id, input.entryId)).limit(1);
      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Waitlist entry not found" });
      const [workshop] = await db.select().from(workshops)
        .where(eq(workshops.id, input.workshopId)).limit(1);
      if (!workshop) throw new TRPCError({ code: "NOT_FOUND", message: "Workshop not found" });

      let userId: number;
      const [existingUser] = await db.select({ id: users.id })
        .from(users).where(eq(users.email, entry.email)).limit(1);
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const [newUser] = await db.insert(users).values({
          email: entry.email,
          name: entry.name,
          role: "user" as any,
        }).$returningId();
        userId = newUser.id;
      }

      const { sendEmail } = await import("../_core/email");

      if (input.accessType === "free") {
        const [existing] = await db.select({ id: workshopEnrollments.id })
          .from(workshopEnrollments)
          .where(and(eq(workshopEnrollments.userId, userId), eq(workshopEnrollments.workshopId, input.workshopId)))
          .limit(1);
        if (!existing) {
          await db.insert(workshopEnrollments).values({ userId, workshopId: input.workshopId, enrollmentType: "full" as any });
        }
        await sendEmail({
          to: { name: entry.name, email: entry.email },
          subject: `You've been granted access to ${workshop.title}`,
          htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#189aa1">Welcome to ${workshop.title}!</h2><p>Hi ${entry.name},</p><p>You've been granted free access to <strong>${workshop.title}</strong>.</p><p style="text-align:center;margin:30px 0"><a href="${input.origin}/workshops/${workshop.slug}" style="background:#189aa1;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Access Your Workshop</a></p></div>`,
        });
        return { success: true, type: "free", message: `Free access granted and email sent to ${entry.email}` };
      } else {
        const stripe = getStripeClient();
        const priceInCents = input.priceOverrideCents !== undefined ? input.priceOverrideCents : (workshop.price ?? 0);
        if (priceInCents === 0) {
          const [existing] = await db.select({ id: workshopEnrollments.id }).from(workshopEnrollments)
            .where(and(eq(workshopEnrollments.userId, userId), eq(workshopEnrollments.workshopId, input.workshopId))).limit(1);
          if (!existing) {
            await db.insert(workshopEnrollments).values({ userId, workshopId: input.workshopId, enrollmentType: "full" as any });
          }
          await sendEmail({
            to: { name: entry.name, email: entry.email },
            subject: `You've been granted access to ${workshop.title}`,
            htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#189aa1">Welcome to ${workshop.title}!</h2><p>Hi ${entry.name},</p><p>You've been granted free access to <strong>${workshop.title}</strong>.</p><p style="text-align:center;margin:30px 0"><a href="${input.origin}/workshops/${workshop.slug}" style="background:#189aa1;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Access Your Workshop</a></p></div>`,
          });
          return { success: true, type: "free", message: `Zero-price access granted and email sent to ${entry.email}` };
        }
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: entry.email,
          line_items: [{ price_data: { currency: "usd", product_data: { name: workshop.title }, unit_amount: priceInCents }, quantity: 1 }],
          success_url: `${input.origin}/workshops/${workshop.slug}?enrolled=1`,
          cancel_url: `${input.origin}/workshops/${workshop.slug}`,
          metadata: { workshopId: String(input.workshopId), waitlistEntryId: String(input.entryId), grantedByAdminId: String(ctx.user.id) },
          payment_intent_data: { description: `${workshop.title} — Workshop Registration` },
          client_reference_id: String(userId),
          allow_promotion_codes: true,
        });
        await sendEmail({
          to: { name: entry.name, email: entry.email },
          subject: `Your spot in ${workshop.title} — Complete your enrollment`,
          htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#189aa1">You've been granted access to ${workshop.title}</h2><p>Hi ${entry.name},</p><p>Great news! You've been selected from the waitlist for <strong>${workshop.title}</strong>.</p><p>Please complete your enrollment:</p><p style="text-align:center;margin:30px 0"><a href="${session.url}" style="background:#189aa1;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Complete Enrollment — $${(priceInCents / 100).toFixed(2)}</a></p></div>`,
        });
        return { success: true, type: "paid", checkoutUrl: session.url, message: `Checkout link sent to ${entry.email}` };
      }
    }),

  // ── Instance Landing Page Builder ─────────────────────────────────────────
  getInstanceLandingBlocks: protectedProcedure
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [inst] = await db
        .select({ id: workshopInstances.id, workshopId: workshopInstances.workshopId, title: workshopInstances.title, landingBlocks: workshopInstances.landingBlocks })
        .from(workshopInstances)
        .where(eq(workshopInstances.id, input.instanceId))
        .limit(1);
      if (!inst) throw new TRPCError({ code: "NOT_FOUND" });
      return inst;
    }),
  saveInstanceLandingBlocks: protectedProcedure
    .input(z.object({ instanceId: z.number(), blocks: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(workshopInstances)
        .set({ landingBlocks: input.blocks })
        .where(eq(workshopInstances.id, input.instanceId));
      return { success: true };
    }),

  /** List pricing options for a workshop (for CTA action pickers) */
  listPricingOptions: protectedProcedure
    .input(z.object({ workshopId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(workshopPricingOptions)
        .where(eq(workshopPricingOptions.workshopId, input.workshopId))
        .orderBy(asc(workshopPricingOptions.sortOrder));
    }),
});
// ── Public waitlist router ────────────────────────────────────────────────────
export const workshopWaitlistRouter = router({
  join: publicProcedure
    .input(z.object({
      workshopId: z.number(),
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check if already on waitlist
      const [existing] = await db.select({ id: workshopWaitlistEntries.id })
        .from(workshopWaitlistEntries)
        .where(and(
          eq(workshopWaitlistEntries.workshopId, input.workshopId),
          eq(workshopWaitlistEntries.email, input.email)
        )).limit(1);
      if (existing) return { success: true, alreadyRegistered: true };
      await db.insert(workshopWaitlistEntries).values({
        workshopId: input.workshopId,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        message: input.message ?? null,
        createdAt: Date.now(),
      });
      // Notify admin of new waitlist signup
      try {
        const { sendEmail } = await import("../_core/email");
        await sendEmail({
          to: "admin@allaboutultrasound.com",
          subject: `New Waitlist Signup — Workshop #${input.workshopId}`,
          html: `<h2>New Workshop Waitlist Lead</h2><p><strong>Name:</strong> ${input.name}</p><p><strong>Email:</strong> ${input.email}</p>${input.phone ? `<p><strong>Phone:</strong> ${input.phone}</p>` : ""}<p><strong>Workshop ID:</strong> ${input.workshopId}</p>${input.message ? `<p><strong>Message:</strong> ${input.message}</p>` : ""}<p><em>Signed up at ${new Date().toUTCString()}</em></p>`,
          text: `New Workshop Waitlist Lead\nName: ${input.name}\nEmail: ${input.email}${input.phone ? `\nPhone: ${input.phone}` : ""}\nWorkshop ID: ${input.workshopId}${input.message ? `\nMessage: ${input.message}` : ""}`,
        });
      } catch (e) {
        console.error("[waitlist] Failed to send admin notification:", e);
      }
      return { success: true, alreadyRegistered: false };
    }),
});
