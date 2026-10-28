import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  ultrasoundExpoAgendaItems,
  ultrasoundExpoCheckoutGroups,
  ultrasoundExpoEvents,
  ultrasoundExpoEventPages,
  ultrasoundExpoPackages,
  ultrasoundExpoRecordings,
  ultrasoundExpoRegistrations,
} from "../../drizzle/schema";
import { calculateExpoCombinedOfferPricing } from "../../shared/expoCombinedOffer";
import { ULTRASOUND_EXPO_ORIGIN } from "../../shared/ultrasoundExpo";
import { EXPO_EVENT_TENANTS } from "../../shared/expoTenant";
import { getDb, getUserRoles } from "../db";
import { getStripeClient } from "../lib/stripeClient";
import { requireApprovedVendorApplication } from "../lib/vendorPartnerAccess";
import {
  expoTenantSchemaAvailable,
  getCompatibleExpoEventById,
  listCompatibleExpoEvents,
} from "../lib/expoEventSchemaCompatibility";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const EXPO_ORIGINS = new Set([
  "ultrasoundexpo.com",
  "www.ultrasoundexpo.com",
  "echocardiographyexpo.com",
  "www.echocardiographyexpo.com",
  "app.allaboutultrasound.com",
  "learn.allaboutultrasound.com",
  "members.allaboutultrasound.com",
  "localhost",
  "127.0.0.1",
]);

const packageTypeInput = z.enum(["registrant", "exhibitor", "sponsor", "product", "other"]);
const eventTenantInput = z.enum(EXPO_EVENT_TENANTS);

function safeExpoOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if ((url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") && EXPO_ORIGINS.has(url.hostname)) {
      return url.origin;
    }
  } catch {
    // Fall through to the canonical Expo domain.
  }
  return ULTRASOUND_EXPO_ORIGIN;
}

async function assertExpoAdmin(user: { id: number; role: string }) {
  const roles = await getUserRoles(user.id);
  if (user.role !== "admin" && !roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access is required." });
  }
}

const eventUpdateInput = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(255),
  slug: z.string().trim().min(2).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only."),
  startsAt: z.date(),
  endsAt: z.date().nullable().optional(),
  timezone: z.string().trim().min(2).max(64),
  locationLabel: z.string().trim().max(512).optional().or(z.literal("")),
  description: z.string().trim().max(8_000).optional().or(z.literal("")),
  heroImageUrl: z.string().trim().url().max(2048).optional().or(z.literal("")),
  registrationTerms: z.string().trim().max(12_000).optional().or(z.literal("")),
  attendeeInstructions: z.string().trim().max(12_000).optional().or(z.literal("")),
  partnerInstructions: z.string().trim().max(12_000).optional().or(z.literal("")),
  status: z.enum(["draft", "published", "archived"]),
});

const eventCreateInput = eventUpdateInput.omit({ id: true }).extend({
  tenant: eventTenantInput.default("ultrasound_expo"),
});

const packageInput = z.object({
  id: z.number().int().positive().optional(),
  eventId: z.number().int().positive(),
  packageType: packageTypeInput,
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(8_000).optional().or(z.literal("")),
  benefits: z.string().trim().max(16_000).optional().or(z.literal("")),
  amountCents: z.number().int().min(50).max(10_000_000),
  currency: z.string().trim().toLowerCase().length(3).default("usd"),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
  combinedWithPackageId: z.number().int().positive().nullable().optional(),
});

export const ultrasoundExpoRouter = router({
  publicLaunch: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "UltrasoundExpo™ is temporarily unavailable." });
    const [event] = await listCompatibleExpoEvents(db, { publishedOnly: true });
    if (!event) return { event: null, packages: [] };
    // Attendee registration is intentionally paused. Partner pricing is available only
    // through the separately authorized partner portal and never through this endpoint.
    return { event, packages: [] };
  }),

  /** Attendee registration is paused; no public data, sign-in, or checkout flow is available. */
  createCheckout: publicProcedure
    .input(z.object({
      packageId: z.number().int().positive(),
      attendeeName: z.string().trim().min(2).max(255),
      attendeeEmail: z.string().trim().email().max(320),
      attendeePhone: z.string().trim().max(60).optional().or(z.literal("")),
      organizationName: z.string().trim().max(255).optional().or(z.literal("")),
      organizationWebsite: z.string().trim().url().max(1024).optional().or(z.literal("")),
      notes: z.string().trim().max(4_000).optional().or(z.literal("")),
      origin: z.string().max(2048),
    }))
    .mutation(() => {
      throw new TRPCError({ code: "FORBIDDEN", message: "Attendee registration is coming soon." });
    }),

  /** Exhibitor and sponsor pricing/checkouts remain inside the approved partner portal. */
  createPartnerCheckout: protectedProcedure
    .input(z.object({
      packageId: z.number().int().positive(),
      notes: z.string().trim().max(4_000).optional().or(z.literal("")),
      origin: z.string().max(2_048),
    }))
    .mutation(async ({ ctx, input }) => {
      const application = await requireApprovedVendorApplication(ctx.user.id, "ultrasound_expo");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "UltrasoundExpo™ checkout is temporarily unavailable." });
      const [selection] = await db.select({
        packageId: ultrasoundExpoPackages.id,
        eventId: ultrasoundExpoEvents.id,
        eventName: ultrasoundExpoEvents.name,
        eventStatus: ultrasoundExpoEvents.status,
        packageType: ultrasoundExpoPackages.packageType,
        packageName: ultrasoundExpoPackages.name,
        amountCents: ultrasoundExpoPackages.amountCents,
        currency: ultrasoundExpoPackages.currency,
        isActive: ultrasoundExpoPackages.isActive,
      }).from(ultrasoundExpoPackages)
        .innerJoin(ultrasoundExpoEvents, eq(ultrasoundExpoPackages.eventId, ultrasoundExpoEvents.id))
        .where(eq(ultrasoundExpoPackages.id, input.packageId))
        .limit(1);
      if (!selection || selection.eventStatus !== "published" || !selection.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That UltrasoundExpo™ opportunity is no longer available." });
      }
      if (selection.packageType !== "exhibitor" && selection.packageType !== "sponsor") {
        throw new TRPCError({ code: "NOT_FOUND", message: "That UltrasoundExpo™ opportunity is not available through the partner portal." });
      }

      const created = await db.insert(ultrasoundExpoRegistrations).values({
        eventId: selection.eventId,
        packageId: selection.packageId,
        userId: ctx.user.id,
        vendorApplicationId: application.id,
        attendeeName: application.contactName,
        attendeeEmail: application.contactEmail,
        attendeePhone: application.contactPhone,
        organizationName: application.organizationName,
        organizationWebsite: application.organizationWebsite,
        notes: input.notes?.trim() || null,
        amountCents: selection.amountCents,
        currency: selection.currency,
        paymentStatus: "pending",
        status: "pending",
      }).$returningId();
      const registrationId = created[0]?.id;
      if (!registrationId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to save the UltrasoundExpo™ selection." });

      try {
        const origin = safeExpoOrigin(input.origin);
        const session = await getStripeClient().checkout.sessions.create({
          mode: "payment",
          customer_email: application.contactEmail,
          client_reference_id: String(ctx.user.id),
          billing_address_collection: "auto",
          allow_promotion_codes: false,
          line_items: [{
            price_data: {
              currency: selection.currency,
              product_data: {
                name: `${selection.eventName} — ${selection.packageName}`,
                description: `UltrasoundExpo™ ${selection.packageType} selection`,
              },
              unit_amount: selection.amountCents,
            },
            quantity: 1,
          }],
          metadata: {
            type: "ultrasound_expo",
            ultrasound_expo_registration_id: String(registrationId),
            ultrasound_expo_event_id: String(selection.eventId),
            ultrasound_expo_package_type: selection.packageType,
            vendor_application_id: String(application.id),
            user_id: String(ctx.user.id),
            attendee_email: application.contactEmail,
          },
          payment_intent_data: { description: `UltrasoundExpo™ — ${selection.packageName}` },
          success_url: `${origin}/vendor-portal?status=complete&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/vendor-portal?status=cancelled`,
        }, { idempotencyKey: `ultrasound-expo:${registrationId}` });
        await db.update(ultrasoundExpoRegistrations).set({ stripeSessionId: session.id }).where(eq(ultrasoundExpoRegistrations.id, registrationId));
        if (!session.url) throw new Error("Stripe did not return a checkout URL.");
        return { checkoutUrl: session.url };
      } catch {
        await db.update(ultrasoundExpoRegistrations).set({ paymentStatus: "failed", status: "payment_failed" }).where(eq(ultrasoundExpoRegistrations.id, registrationId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to start secure UltrasoundExpo™ checkout. Please try again." });
      }
    }),

  /**
   * Creates one Stripe Checkout Session for two explicitly paired exhibitor or
   * sponsor packages. The user receives an independent registration/access
   * record for each event after Stripe confirms payment.
   */
  createCombinedPartnerCheckout: protectedProcedure
    .input(z.object({
      primaryPackageId: z.number().int().positive(),
      companionPackageId: z.number().int().positive(),
      notes: z.string().trim().max(4_000).optional().or(z.literal("")),
      origin: z.string().max(2_048),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.primaryPackageId === input.companionPackageId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose one package from each event for the combined Expo offer." });
      }
      const application = await requireApprovedVendorApplication(ctx.user.id, "ultrasound_expo");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "UltrasoundExpo™ checkout is temporarily unavailable." });

      const selections = await db.select({
        packageId: ultrasoundExpoPackages.id,
        combinedWithPackageId: ultrasoundExpoPackages.combinedWithPackageId,
        eventId: ultrasoundExpoEvents.id,
        eventName: ultrasoundExpoEvents.name,
        eventTenant: ultrasoundExpoEvents.tenant,
        eventStatus: ultrasoundExpoEvents.status,
        eventStartsAt: ultrasoundExpoEvents.startsAt,
        eventEndsAt: ultrasoundExpoEvents.endsAt,
        packageType: ultrasoundExpoPackages.packageType,
        packageName: ultrasoundExpoPackages.name,
        amountCents: ultrasoundExpoPackages.amountCents,
        currency: ultrasoundExpoPackages.currency,
        isActive: ultrasoundExpoPackages.isActive,
      }).from(ultrasoundExpoPackages)
        .innerJoin(ultrasoundExpoEvents, eq(ultrasoundExpoPackages.eventId, ultrasoundExpoEvents.id))
        .where(inArray(ultrasoundExpoPackages.id, [input.primaryPackageId, input.companionPackageId]));
      if (selections.length !== 2) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or both selected Expo opportunities are no longer available." });
      }
      const primary = selections.find(item => item.packageId === input.primaryPackageId)!;
      const companion = selections.find(item => item.packageId === input.companionPackageId)!;
      const allowedTypes = ["exhibitor", "sponsor"] as const;
      const isConfiguredPair = primary.combinedWithPackageId === companion.packageId || companion.combinedWithPackageId === primary.packageId;
      const [firstEvent, secondEvent] = [primary, companion].sort((left, right) => left.eventStartsAt.getTime() - right.eventStartsAt.getTime());
      const hoursBetweenEvents = firstEvent.eventEndsAt
        ? (secondEvent.eventStartsAt.getTime() - firstEvent.eventEndsAt.getTime()) / 3_600_000
        : Number.POSITIVE_INFINITY;
      if (
        !primary.isActive || !companion.isActive ||
        primary.eventStatus !== "published" || companion.eventStatus !== "published" ||
        !allowedTypes.includes(primary.packageType as typeof allowedTypes[number]) ||
        primary.packageType !== companion.packageType ||
        primary.eventId === companion.eventId ||
        primary.eventTenant === companion.eventTenant ||
        primary.currency.toLowerCase() !== companion.currency.toLowerCase() ||
        !isConfiguredPair ||
        hoursBetweenEvents < 0 || hoursBetweenEvents > 48
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "These Expo packages are not configured as an eligible combined event offer." });
      }

      let pricing;
      try {
        pricing = calculateExpoCombinedOfferPricing(primary.amountCents, companion.amountCents);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The combined Expo offer cannot be priced securely." });
      }

      const groupInsert = await db.insert(ultrasoundExpoCheckoutGroups).values({
        userId: ctx.user.id,
        vendorApplicationId: application.id,
        packageType: primary.packageType as "exhibitor" | "sponsor",
        subtotalCents: pricing.baseTotalCents,
        discountCents: pricing.discountCents,
        amountCents: pricing.totalCents,
        currency: primary.currency.toLowerCase(),
        paymentStatus: "pending",
      }).$returningId();
      const checkoutGroupId = groupInsert[0]?.id;
      if (!checkoutGroupId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to save the combined Expo selection." });

      const registrationRows = [primary, companion].map((selection, index) => ({
        eventId: selection.eventId,
        packageId: selection.packageId,
        userId: ctx.user.id,
        vendorApplicationId: application.id,
        checkoutGroupId,
        attendeeName: application.contactName,
        attendeeEmail: application.contactEmail,
        attendeePhone: application.contactPhone,
        organizationName: application.organizationName,
        organizationWebsite: application.organizationWebsite,
        notes: input.notes?.trim() || null,
        amountCents: pricing.discountedLineAmounts[index],
        currency: selection.currency.toLowerCase(),
        paymentStatus: "pending" as const,
        status: "pending" as const,
      }));
      const registrations = await db.insert(ultrasoundExpoRegistrations).values(registrationRows).$returningId();
      const primaryRegistrationId = registrations[0]?.id;
      const companionRegistrationId = registrations[1]?.id;
      if (!primaryRegistrationId || !companionRegistrationId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to save the combined Expo registrations." });
      }

      try {
        const origin = safeExpoOrigin(input.origin);
        const session = await getStripeClient().checkout.sessions.create({
          mode: "payment",
          customer_email: application.contactEmail,
          client_reference_id: String(ctx.user.id),
          billing_address_collection: "auto",
          allow_promotion_codes: false,
          line_items: [primary, companion].map((selection, index) => ({
            price_data: {
              currency: selection.currency.toLowerCase(),
              product_data: {
                name: `${selection.eventName} — ${selection.packageName}`,
                description: `Combined Expo offer · 20% off when attending or exhibiting at both events`,
              },
              unit_amount: pricing.discountedLineAmounts[index],
            },
            quantity: 1,
          })),
          metadata: {
            type: "ultrasound_expo_combined",
            ultrasound_expo_checkout_group_id: String(checkoutGroupId),
            ultrasound_expo_registration_id: String(primaryRegistrationId),
            ultrasound_expo_companion_registration_id: String(companionRegistrationId),
            ultrasound_expo_package_type: primary.packageType,
            ultrasound_expo_discount_basis_points: "2000",
            vendor_application_id: String(application.id),
            user_id: String(ctx.user.id),
            attendee_email: application.contactEmail,
          },
          payment_intent_data: { description: `Combined Expo offer — ${primary.eventName} + ${companion.eventName}` },
          success_url: `${origin}/vendor-portal?status=complete&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/vendor-portal?status=cancelled`,
        }, { idempotencyKey: `ultrasound-expo-combined:${checkoutGroupId}` });
        if (!session.url) throw new Error("Stripe did not return a checkout URL.");
        await db.update(ultrasoundExpoCheckoutGroups).set({ stripeSessionId: session.id }).where(eq(ultrasoundExpoCheckoutGroups.id, checkoutGroupId));
        return {
          checkoutUrl: session.url,
          subtotalCents: pricing.baseTotalCents,
          discountCents: pricing.discountCents,
          totalCents: pricing.totalCents,
        };
      } catch {
        await Promise.all([
          db.update(ultrasoundExpoCheckoutGroups).set({ paymentStatus: "failed" }).where(eq(ultrasoundExpoCheckoutGroups.id, checkoutGroupId)),
          db.update(ultrasoundExpoRegistrations).set({ paymentStatus: "failed", status: "payment_failed" }).where(eq(ultrasoundExpoRegistrations.checkoutGroupId, checkoutGroupId)),
        ]);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to start secure combined Expo checkout. Please try again." });
      }
    }),

  myDashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Your UltrasoundExpo™ Dashboard is temporarily unavailable." });
    const events = await listCompatibleExpoEvents(db);
    const eventById = new Map(events.map(event => [event.id, event]));
    const registrationRows = await db.select({
      id: ultrasoundExpoRegistrations.id,
      attendeeName: ultrasoundExpoRegistrations.attendeeName,
      attendeeEmail: ultrasoundExpoRegistrations.attendeeEmail,
      organizationName: ultrasoundExpoRegistrations.organizationName,
      ticketCode: ultrasoundExpoRegistrations.ticketCode,
      amountCents: ultrasoundExpoRegistrations.amountCents,
      currency: ultrasoundExpoRegistrations.currency,
      status: ultrasoundExpoRegistrations.status,
      paymentStatus: ultrasoundExpoRegistrations.paymentStatus,
      paidAt: ultrasoundExpoRegistrations.paidAt,
      createdAt: ultrasoundExpoRegistrations.createdAt,
      eventId: ultrasoundExpoRegistrations.eventId,
      packageName: ultrasoundExpoPackages.name,
      packageType: ultrasoundExpoPackages.packageType,
    }).from(ultrasoundExpoRegistrations)
      .innerJoin(ultrasoundExpoPackages, eq(ultrasoundExpoRegistrations.packageId, ultrasoundExpoPackages.id))
      .where(and(eq(ultrasoundExpoRegistrations.userId, ctx.user.id), eq(ultrasoundExpoPackages.packageType, "registrant")))
      .orderBy(desc(ultrasoundExpoRegistrations.createdAt));
    return registrationRows.map(row => {
      const event = eventById.get(row.eventId);
      return {
        ...row,
        eventName: event?.name ?? "UltrasoundExpo™ event",
        eventSlug: event?.slug ?? "ultrasoundexpo",
        startsAt: event?.startsAt ?? null,
        endsAt: event?.endsAt ?? null,
        eventTenant: event?.tenant ?? "ultrasound_expo",
        locationLabel: event?.locationLabel ?? null,
      };
    });
  }),

  adminSnapshot: protectedProcedure.query(async ({ ctx }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [events, tenantSchemaAvailable] = await Promise.all([
      listCompatibleExpoEvents(db),
      expoTenantSchemaAvailable(db),
    ]);
    const eventById = new Map(events.map(event => [event.id, event]));
    const packages = await db.select().from(ultrasoundExpoPackages).orderBy(asc(ultrasoundExpoPackages.eventId), asc(ultrasoundExpoPackages.sortOrder));
    const registrationRows = await db.select({
      id: ultrasoundExpoRegistrations.id,
      attendeeName: ultrasoundExpoRegistrations.attendeeName,
      attendeeEmail: ultrasoundExpoRegistrations.attendeeEmail,
      organizationName: ultrasoundExpoRegistrations.organizationName,
      ticketCode: ultrasoundExpoRegistrations.ticketCode,
      amountCents: ultrasoundExpoRegistrations.amountCents,
      currency: ultrasoundExpoRegistrations.currency,
      paymentStatus: ultrasoundExpoRegistrations.paymentStatus,
      status: ultrasoundExpoRegistrations.status,
      paidAt: ultrasoundExpoRegistrations.paidAt,
      createdAt: ultrasoundExpoRegistrations.createdAt,
      eventId: ultrasoundExpoRegistrations.eventId,
      packageName: ultrasoundExpoPackages.name,
      packageType: ultrasoundExpoPackages.packageType,
    }).from(ultrasoundExpoRegistrations)
      .innerJoin(ultrasoundExpoPackages, eq(ultrasoundExpoRegistrations.packageId, ultrasoundExpoPackages.id))
      .orderBy(desc(ultrasoundExpoRegistrations.createdAt))
      .limit(1000);
    const registrations = registrationRows.map(row => {
      const event = eventById.get(row.eventId);
      return { ...row, eventName: event?.name ?? "UltrasoundExpo™ event", eventTenant: event?.tenant ?? "ultrasound_expo" };
    });
    const paidTotal = registrations.filter(row => row.paymentStatus === "paid").reduce((sum, row) => sum + Number(row.amountCents), 0);
    return { events, packages, registrations, paidTotal, tenantSchemaAvailable };
  }),

  createEvent: protectedProcedure.input(eventCreateInput).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const hasTenant = await expoTenantSchemaAvailable(db);
    if (!hasTenant && input.tenant === "echo_expo") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "EchoExpo™ event instances require the pending additive Railway database migration. Existing UltrasoundExpo™ events remain available." });
    }
    const eventValues = {
      name: input.name,
      slug: input.slug,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      timezone: input.timezone,
      locationLabel: input.locationLabel || null,
      description: input.description || null,
      heroImageUrl: input.heroImageUrl || null,
      registrationTerms: input.registrationTerms || null,
      attendeeInstructions: input.attendeeInstructions || null,
      partnerInstructions: input.partnerInstructions || null,
      status: input.status,
    };
    const created = await db.insert(ultrasoundExpoEvents).values(hasTenant ? { ...eventValues, tenant: input.tenant } : eventValues).$returningId();
    return { id: created[0]?.id ?? null };
  }),

  duplicateEvent: protectedProcedure.input(z.object({
    sourceEventId: z.number().int().positive(),
    name: z.string().trim().min(2).max(255),
    slug: z.string().trim().min(2).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only."),
    startsAt: z.date(),
    endsAt: z.date().nullable().optional(),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
  })).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const source = await getCompatibleExpoEventById(db, input.sourceEventId);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "The source UltrasoundExpo™ event no longer exists." });
    const hasTenant = await expoTenantSchemaAvailable(db);
    if (!hasTenant && source.tenant === "echo_expo") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "EchoExpo™ event instances require the pending additive Railway database migration." });
    }
    const duplicateValues = {
      name: input.name,
      slug: input.slug,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      timezone: source.timezone,
      locationLabel: source.locationLabel,
      description: source.description,
      heroImageUrl: source.heroImageUrl,
      registrationTerms: source.registrationTerms,
      attendeeInstructions: source.attendeeInstructions,
      partnerInstructions: source.partnerInstructions,
      status: input.status,
    };
    const created = await db.insert(ultrasoundExpoEvents).values(hasTenant ? { ...duplicateValues, tenant: source.tenant } : duplicateValues).$returningId();
    const newEventId = created[0]?.id;
    if (!newEventId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to duplicate this UltrasoundExpo™ event." });
    const packages = await db.select().from(ultrasoundExpoPackages).where(eq(ultrasoundExpoPackages.eventId, source.id));
    const [agenda, pages, recordings] = await Promise.all([
      db.select().from(ultrasoundExpoAgendaItems).where(eq(ultrasoundExpoAgendaItems.eventId, source.id)),
      db.select().from(ultrasoundExpoEventPages).where(eq(ultrasoundExpoEventPages.eventId, source.id)),
      db.select().from(ultrasoundExpoRecordings).where(eq(ultrasoundExpoRecordings.eventId, source.id)),
    ]);
    if (packages.length) {
      await db.insert(ultrasoundExpoPackages).values(packages.map(item => ({
        eventId: newEventId,
        packageType: item.packageType,
        name: item.name,
        description: item.description,
        benefits: item.benefits,
        amountCents: item.amountCents,
        currency: item.currency,
        sortOrder: item.sortOrder,
        isActive: false,
        // Pairing is an intentional relationship between the two current-year
        // events and must be configured anew after an annual event is copied.
        combinedWithPackageId: null,
      })));
    }
    if (agenda.length) {
      await db.insert(ultrasoundExpoAgendaItems).values(agenda.map(item => ({
        eventId: newEventId, title: item.title, description: item.description,
        startsAt: input.startsAt, endsAt: null, locationLabel: source.locationLabel,
        speakerNames: item.speakerNames, category: item.category, status: "draft" as const, sortOrder: item.sortOrder,
      })));
    }
    if (pages.length) {
      await db.insert(ultrasoundExpoEventPages).values(pages.map(item => ({
        eventId: newEventId, title: item.title, slug: item.slug, pageType: item.pageType,
        accessLevel: item.accessLevel, blocksJson: item.blocksJson, status: "draft" as const,
        seoTitle: item.seoTitle, seoDescription: item.seoDescription, seoKeywords: item.seoKeywords,
        seoImage: item.seoImage, createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id,
      })));
    }
    if (recordings.length) {
      await db.insert(ultrasoundExpoRecordings).values(recordings.map(item => ({
        eventId: newEventId, title: item.title, description: item.description, videoUrl: null,
        thumbnailUrl: item.thumbnailUrl, durationSeconds: item.durationSeconds, status: "draft" as const,
        sortOrder: item.sortOrder, createdByUserId: ctx.user.id,
      })));
    }
    return { id: newEventId, copiedPackages: packages.length, copiedAgendaItems: agenda.length, copiedPages: pages.length, copiedRecordingShells: recordings.length };
  }),

  updateEvent: protectedProcedure.input(eventUpdateInput).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(ultrasoundExpoEvents).set({
      name: input.name,
      slug: input.slug,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      timezone: input.timezone,
      locationLabel: input.locationLabel || null,
      description: input.description || null,
      heroImageUrl: input.heroImageUrl || null,
      registrationTerms: input.registrationTerms || null,
      attendeeInstructions: input.attendeeInstructions || null,
      partnerInstructions: input.partnerInstructions || null,
      status: input.status,
    }).where(eq(ultrasoundExpoEvents.id, input.id));
    return { success: true };
  }),

  savePackage: protectedProcedure.input(packageInput).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const combinedWithPackageId = input.combinedWithPackageId ?? null;
    if (combinedWithPackageId) {
      if (input.id === combinedWithPackageId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "An Expo package cannot be paired with itself." });
      }
      const [[sourceEvent], [companion]] = await Promise.all([
        db.select({ id: ultrasoundExpoEvents.id, tenant: ultrasoundExpoEvents.tenant }).from(ultrasoundExpoEvents).where(eq(ultrasoundExpoEvents.id, input.eventId)).limit(1),
        db.select().from(ultrasoundExpoPackages).where(eq(ultrasoundExpoPackages.id, combinedWithPackageId)).limit(1),
      ]);
      if (!sourceEvent || !companion) {
        throw new TRPCError({ code: "NOT_FOUND", message: "The selected companion Expo package no longer exists." });
      }
      const [companionEvent] = await db.select({ id: ultrasoundExpoEvents.id, tenant: ultrasoundExpoEvents.tenant })
        .from(ultrasoundExpoEvents).where(eq(ultrasoundExpoEvents.id, companion.eventId)).limit(1);
      if (
        !companionEvent ||
        companion.eventId === input.eventId ||
        companionEvent.tenant === sourceEvent.tenant ||
        companion.packageType !== input.packageType ||
        companion.currency.toLowerCase() !== input.currency.toLowerCase()
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A combined Expo offer must pair matching package types and currencies across UltrasoundExpo™ and EchoExpo™." });
      }
    }
    const values = {
      eventId: input.eventId,
      packageType: input.packageType,
      name: input.name,
      description: input.description || null,
      benefits: input.benefits || null,
      amountCents: input.amountCents,
      currency: input.currency,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      combinedWithPackageId,
    };
    if (input.id) {
      await db.update(ultrasoundExpoPackages).set(values).where(eq(ultrasoundExpoPackages.id, input.id));
      return { id: input.id, updated: true };
    }
    const created = await db.insert(ultrasoundExpoPackages).values(values).$returningId();
    return { id: created[0]?.id ?? null, updated: false };
  }),
});
