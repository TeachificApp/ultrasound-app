import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  ultrasoundExpoEvents,
  ultrasoundExpoPackages,
  ultrasoundExpoRegistrations,
} from "../../drizzle/schema";
import { isExpoPackageType, isExpoPublicRegistrationType, ULTRASOUND_EXPO_ORIGIN } from "../../shared/ultrasoundExpo";
import { getDb, getUserRoles } from "../db";
import { getStripeClient } from "../lib/stripeClient";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const EXPO_ORIGINS = new Set([
  "ultrasoundexpo.com",
  "www.ultrasoundexpo.com",
  "app.allaboutultrasound.com",
  "learn.allaboutultrasound.com",
  "members.allaboutultrasound.com",
  "localhost",
  "127.0.0.1",
]);

const packageTypeInput = z.enum(["registrant", "exhibitor", "sponsor", "product", "other"]);

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
  status: z.enum(["draft", "published", "archived"]),
});

const eventCreateInput = eventUpdateInput.omit({ id: true });

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
});

export const ultrasoundExpoRouter = router({
  publicLaunch: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "UltrasoundExpo™ is temporarily unavailable." });
    const [event] = await db.select().from(ultrasoundExpoEvents)
      .where(eq(ultrasoundExpoEvents.status, "published"))
      .orderBy(asc(ultrasoundExpoEvents.startsAt))
      .limit(1);
    if (!event) return { event: null, packages: [] };
    const packages = (await db.select().from(ultrasoundExpoPackages)
      .where(and(eq(ultrasoundExpoPackages.eventId, event.id), eq(ultrasoundExpoPackages.isActive, true)))
      .orderBy(asc(ultrasoundExpoPackages.sortOrder), asc(ultrasoundExpoPackages.id)))
      .filter(item => isExpoPublicRegistrationType(item.packageType));
    return { event, packages };
  }),

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
    .mutation(async ({ input }) => {
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
      if (!isExpoPackageType(selection.packageType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That UltrasoundExpo™ opportunity has an invalid category." });
      }
      if (!isExpoPublicRegistrationType(selection.packageType)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That UltrasoundExpo™ opportunity is not currently available for registration." });
      }
      const created = await db.insert(ultrasoundExpoRegistrations).values({
        eventId: selection.eventId,
        packageId: selection.packageId,
        attendeeName: input.attendeeName,
        attendeeEmail: input.attendeeEmail.toLowerCase(),
        attendeePhone: input.attendeePhone || null,
        organizationName: input.organizationName || null,
        organizationWebsite: input.organizationWebsite || null,
        notes: input.notes || null,
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
          customer_email: input.attendeeEmail.toLowerCase(),
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
            attendee_email: input.attendeeEmail.toLowerCase(),
          },
          payment_intent_data: { description: `UltrasoundExpo™ — ${selection.packageName}` },
          success_url: `${origin}/expo-dashboard?status=complete&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/register?status=cancelled`,
        }, { idempotencyKey: `ultrasound-expo:${registrationId}` });
        await db.update(ultrasoundExpoRegistrations).set({ stripeSessionId: session.id })
          .where(eq(ultrasoundExpoRegistrations.id, registrationId));
        if (!session.url) throw new Error("Stripe did not return a checkout URL.");
        return { checkoutUrl: session.url };
      } catch (error) {
        await db.update(ultrasoundExpoRegistrations).set({ paymentStatus: "failed", status: "payment_failed" })
          .where(eq(ultrasoundExpoRegistrations.id, registrationId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to start secure UltrasoundExpo™ checkout. Please try again." });
      }
    }),

  myDashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Your UltrasoundExpo™ Dashboard is temporarily unavailable." });
    const rows = await db.select({
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
      eventName: ultrasoundExpoEvents.name,
      startsAt: ultrasoundExpoEvents.startsAt,
      endsAt: ultrasoundExpoEvents.endsAt,
      locationLabel: ultrasoundExpoEvents.locationLabel,
      packageName: ultrasoundExpoPackages.name,
      packageType: ultrasoundExpoPackages.packageType,
    }).from(ultrasoundExpoRegistrations)
      .innerJoin(ultrasoundExpoEvents, eq(ultrasoundExpoRegistrations.eventId, ultrasoundExpoEvents.id))
      .innerJoin(ultrasoundExpoPackages, eq(ultrasoundExpoRegistrations.packageId, ultrasoundExpoPackages.id))
      .where(eq(ultrasoundExpoRegistrations.userId, ctx.user.id))
      .orderBy(desc(ultrasoundExpoRegistrations.createdAt));
    return rows;
  }),

  adminSnapshot: protectedProcedure.query(async ({ ctx }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const events = await db.select().from(ultrasoundExpoEvents).orderBy(asc(ultrasoundExpoEvents.startsAt));
    const packages = await db.select().from(ultrasoundExpoPackages).orderBy(asc(ultrasoundExpoPackages.eventId), asc(ultrasoundExpoPackages.sortOrder));
    const registrations = await db.select({
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
      eventId: ultrasoundExpoEvents.id,
      eventName: ultrasoundExpoEvents.name,
      packageName: ultrasoundExpoPackages.name,
      packageType: ultrasoundExpoPackages.packageType,
    }).from(ultrasoundExpoRegistrations)
      .innerJoin(ultrasoundExpoEvents, eq(ultrasoundExpoRegistrations.eventId, ultrasoundExpoEvents.id))
      .innerJoin(ultrasoundExpoPackages, eq(ultrasoundExpoRegistrations.packageId, ultrasoundExpoPackages.id))
      .orderBy(desc(ultrasoundExpoRegistrations.createdAt))
      .limit(1000);
    const paidTotal = registrations.filter(row => row.paymentStatus === "paid").reduce((sum, row) => sum + Number(row.amountCents), 0);
    return { events, packages, registrations, paidTotal };
  }),

  createEvent: protectedProcedure.input(eventCreateInput).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const created = await db.insert(ultrasoundExpoEvents).values({
      name: input.name,
      slug: input.slug,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      timezone: input.timezone,
      locationLabel: input.locationLabel || null,
      description: input.description || null,
      heroImageUrl: input.heroImageUrl || null,
      status: input.status,
    }).$returningId();
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
    const [source] = await db.select().from(ultrasoundExpoEvents).where(eq(ultrasoundExpoEvents.id, input.sourceEventId)).limit(1);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "The source UltrasoundExpo™ event no longer exists." });
    const created = await db.insert(ultrasoundExpoEvents).values({
      name: input.name,
      slug: input.slug,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      timezone: source.timezone,
      locationLabel: source.locationLabel,
      description: source.description,
      heroImageUrl: source.heroImageUrl,
      status: input.status,
    }).$returningId();
    const newEventId = created[0]?.id;
    if (!newEventId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to duplicate this UltrasoundExpo™ event." });
    const packages = await db.select().from(ultrasoundExpoPackages).where(eq(ultrasoundExpoPackages.eventId, source.id));
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
      })));
    }
    return { id: newEventId, copiedPackages: packages.length };
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
      status: input.status,
    }).where(eq(ultrasoundExpoEvents.id, input.id));
    return { success: true };
  }),

  savePackage: protectedProcedure.input(packageInput).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
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
    };
    if (input.id) {
      await db.update(ultrasoundExpoPackages).set(values).where(eq(ultrasoundExpoPackages.id, input.id));
      return { id: input.id, updated: true };
    }
    const created = await db.insert(ultrasoundExpoPackages).values(values).$returningId();
    return { id: created[0]?.id ?? null, updated: false };
  }),
});
