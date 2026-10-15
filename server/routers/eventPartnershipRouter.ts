import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { eventPartnershipOrders, eventPartnershipPackages, webinars, workshopInstances, workshops } from "../../drizzle/schema";
import { EVENT_PARTNERSHIP_TYPES, type EventPartnershipType } from "../../shared/eventPartnership";
import { getDb, getUserRoles } from "../db";
import { getStripeClient } from "../lib/stripeClient";
import { requireApprovedVendorApplication } from "../lib/vendorPartnerAccess";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const PUBLIC_ORIGINS = new Set([
  "learn.allaboutultrasound.com", "learn.iheartecho.com", "app.allaboutultrasound.com", "app.iheartecho.com",
  "www.allaboutultrasound.com", "allaboutultrasound.com", "www.allaboutultrasound.net", "allaboutultrasound.net",
  "www.iheartecho.com", "iheartecho.com", "www.iheartecho.net", "iheartecho.net",
]);
const targetTypeInput = z.enum(["workshop_exhibit", "webinar_sponsor"]);

function safeOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if ((url.protocol === "https:" && PUBLIC_ORIGINS.has(url.hostname)) || ["localhost", "127.0.0.1"].includes(url.hostname)) return url.origin;
  } catch { /* use the safe Learn default */ }
  return "https://learn.allaboutultrasound.com";
}

async function assertAdmin(user: { id: number; role: string }) {
  const roles = await getUserRoles(user.id);
  if (user.role !== "admin" && !roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access is required." });
  }
}

function targetWhere(input: { targetType: EventPartnershipType; workshopInstanceId?: number; webinarId?: number }) {
  if (input.targetType === "workshop_exhibit") {
    if (!input.workshopInstanceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a workshop instance." });
    return eq(eventPartnershipPackages.workshopInstanceId, input.workshopInstanceId);
  }
  if (!input.webinarId) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a webinar." });
  return eq(eventPartnershipPackages.webinarId, input.webinarId);
}

async function getTarget(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, input: { targetType: EventPartnershipType; workshopInstanceId?: number; webinarId?: number }, publicOnly = false) {
  if (input.targetType === "workshop_exhibit") {
    if (!input.workshopInstanceId) return null;
    const [target] = await db.select({ id: workshopInstances.id, title: workshopInstances.title, details: workshopInstances.exhibitorDetails, workshopTitle: workshops.title, status: workshopInstances.status, workshopStatus: workshops.status })
      .from(workshopInstances).innerJoin(workshops, eq(workshopInstances.workshopId, workshops.id))
      .where(eq(workshopInstances.id, input.workshopInstanceId)).limit(1);
    if (!target || (publicOnly && (target.workshopStatus !== "public" || !["published", "presale"].includes(target.status)))) return null;
    return { id: target.id, title: `${target.workshopTitle} — ${target.title}`, details: publicOnly ? null : target.details, type: input.targetType };
  }
  if (!input.webinarId) return null;
  const [target] = await db.select({ id: webinars.id, title: webinars.title, details: webinars.sponsorDetails, status: webinars.status })
    .from(webinars).where(eq(webinars.id, input.webinarId)).limit(1);
  if (!target || (publicOnly && !["published", "presale"].includes(target.status))) return null;
  return { id: target.id, title: target.title, details: publicOnly ? null : target.details, type: input.targetType };
}

export const eventPartnershipRouter = router({
  getPublicTarget: publicProcedure
    .input(z.object({ targetType: targetTypeInput, workshopInstanceId: z.number().int().positive().optional(), webinarId: z.number().int().positive().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Event partnership options are temporarily unavailable." });
      const target = await getTarget(db, input, true);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "This event partnership opportunity is not currently available." });
      return target;
    }),

  /** Packages, benefits, prices, and package IDs are intentionally never returned to public visitors. */
  listPublicPackages: publicProcedure
    .input(z.object({ targetType: targetTypeInput, workshopInstanceId: z.number().int().positive().optional(), webinarId: z.number().int().positive().optional() }))
    .query(async () => [] as const),

  createCheckout: protectedProcedure
    .input(z.object({
      targetType: targetTypeInput,
      workshopInstanceId: z.number().int().positive().optional(),
      webinarId: z.number().int().positive().optional(),
      packageId: z.number().int().positive(),
      notes: z.string().trim().max(4_000).optional(),
      origin: z.string().max(2_048),
    }))
    .mutation(async ({ ctx, input }) => {
      const application = await requireApprovedVendorApplication(ctx.user.id, "aaus_ihe");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Event partnership checkout is temporarily unavailable." });
      const target = await getTarget(db, input, true);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "This event partnership opportunity is not currently available." });
      const [pkg] = await db.select().from(eventPartnershipPackages)
        .where(and(eq(eventPartnershipPackages.id, input.packageId), eq(eventPartnershipPackages.targetType, input.targetType), targetWhere(input), eq(eventPartnershipPackages.isActive, true)))
        .limit(1);
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "That option is no longer available." });
      const created = await db.insert(eventPartnershipOrders).values({
        vendorApplicationId: application.id,
        targetType: input.targetType,
        workshopInstanceId: input.targetType === "workshop_exhibit" ? input.workshopInstanceId! : null,
        webinarId: input.targetType === "webinar_sponsor" ? input.webinarId! : null,
        packageId: pkg.id,
        contactName: application.contactName,
        contactEmail: application.contactEmail,
        contactPhone: application.contactPhone,
        organizationName: application.organizationName,
        organizationWebsite: application.organizationWebsite,
        notes: input.notes?.trim() || null,
        amountCents: pkg.amountCents,
        currency: pkg.currency,
        paymentStatus: "pending",
        status: "pending",
      }).$returningId();
      const orderId = created[0]?.id;
      if (!orderId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create the event partnership record." });
      try {
        const label = EVENT_PARTNERSHIP_TYPES[input.targetType].label;
        const session = await getStripeClient().checkout.sessions.create({
          mode: "payment",
          customer_email: application.contactEmail,
          client_reference_id: String(ctx.user.id),
          allow_promotion_codes: false,
          billing_address_collection: "auto",
          line_items: [{
            price_data: {
              currency: pkg.currency,
              product_data: { name: `${pkg.name} — ${target.title}`, description: `${label} with All About Ultrasound™ | iHeartEcho™` },
              unit_amount: pkg.amountCents,
            },
            quantity: 1,
          }],
          metadata: {
            type: "event_partnership",
            event_partnership_order_id: String(orderId),
            vendor_application_id: String(application.id),
            user_id: String(ctx.user.id),
            target_type: input.targetType,
            package_id: String(pkg.id),
            workshop_instance_id: input.workshopInstanceId ? String(input.workshopInstanceId) : "",
            webinar_id: input.webinarId ? String(input.webinarId) : "",
            organization_name: application.organizationName.slice(0, 255),
          },
          payment_intent_data: { description: `${pkg.name} — ${application.organizationName}` },
          success_url: `${safeOrigin(input.origin)}/vendor-portal?status=complete&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${safeOrigin(input.origin)}/vendor-portal?status=cancelled`,
        }, { idempotencyKey: `event-partnership:${orderId}` });
        await db.update(eventPartnershipOrders).set({ stripeSessionId: session.id }).where(eq(eventPartnershipOrders.id, orderId));
        if (!session.url) throw new Error("Stripe checkout URL unavailable.");
        return { checkoutUrl: session.url };
      } catch {
        await db.update(eventPartnershipOrders).set({ paymentStatus: "failed", status: "payment_failed" }).where(eq(eventPartnershipOrders.id, orderId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to start secure checkout. Please try again." });
      }
    }),

  adminList: protectedProcedure
    .input(z.object({ targetType: targetTypeInput, workshopInstanceId: z.number().int().positive().optional(), webinarId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const target = await getTarget(db, input, false);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      const condition = targetWhere(input);
      const [packages, orders] = await Promise.all([
        db.select().from(eventPartnershipPackages).where(and(eq(eventPartnershipPackages.targetType, input.targetType), condition)).orderBy(eventPartnershipPackages.sortOrder, eventPartnershipPackages.id),
        db.select({
          id: eventPartnershipOrders.id,
          vendorApplicationId: eventPartnershipOrders.vendorApplicationId,
          packageName: eventPartnershipPackages.name,
          contactName: eventPartnershipOrders.contactName,
          contactEmail: eventPartnershipOrders.contactEmail,
          organizationName: eventPartnershipOrders.organizationName,
          amountCents: eventPartnershipOrders.amountCents,
          currency: eventPartnershipOrders.currency,
          paymentStatus: eventPartnershipOrders.paymentStatus,
          status: eventPartnershipOrders.status,
          paidAt: eventPartnershipOrders.paidAt,
          createdAt: eventPartnershipOrders.createdAt,
        }).from(eventPartnershipOrders).leftJoin(eventPartnershipPackages, eq(eventPartnershipOrders.packageId, eventPartnershipPackages.id))
          .where(and(eq(eventPartnershipOrders.targetType, input.targetType), input.targetType === "workshop_exhibit" ? eq(eventPartnershipOrders.workshopInstanceId, input.workshopInstanceId!) : eq(eventPartnershipOrders.webinarId, input.webinarId!)))
          .orderBy(desc(eventPartnershipOrders.createdAt)),
      ]);
      return { target, packages, orders };
    }),

  adminCreatePackage: protectedProcedure
    .input(z.object({ targetType: targetTypeInput, workshopInstanceId: z.number().int().positive().optional(), webinarId: z.number().int().positive().optional(), name: z.string().trim().min(2).max(255), description: z.string().trim().max(4_000).optional(), benefits: z.string().trim().max(8_000).optional(), amountCents: z.number().int().min(50).max(20_000_000), currency: z.string().trim().length(3).default("usd"), sortOrder: z.number().int().min(0).max(10_000).default(0), isActive: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const target = await getTarget(db, input, false);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      const result = await db.insert(eventPartnershipPackages).values({ targetType: input.targetType, workshopInstanceId: input.targetType === "workshop_exhibit" ? input.workshopInstanceId! : null, webinarId: input.targetType === "webinar_sponsor" ? input.webinarId! : null, name: input.name, description: input.description || null, benefits: input.benefits || null, amountCents: input.amountCents, currency: input.currency.toLowerCase(), sortOrder: input.sortOrder, isActive: input.isActive }).$returningId();
      return { id: result[0]?.id };
    }),

  adminUpdatePackage: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), targetType: targetTypeInput, workshopInstanceId: z.number().int().positive().optional(), webinarId: z.number().int().positive().optional(), name: z.string().trim().min(2).max(255).optional(), description: z.string().trim().max(4_000).nullable().optional(), benefits: z.string().trim().max(8_000).nullable().optional(), amountCents: z.number().int().min(50).max(20_000_000).optional(), currency: z.string().trim().length(3).optional(), sortOrder: z.number().int().min(0).max(10_000).optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const target = await getTarget(db, input, false);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      const [pkg] = await db.select({ id: eventPartnershipPackages.id }).from(eventPartnershipPackages).where(and(eq(eventPartnershipPackages.id, input.id), eq(eventPartnershipPackages.targetType, input.targetType), targetWhere(input))).limit(1);
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "This package does not belong to the selected event." });
      const { id, targetType, workshopInstanceId, webinarId, ...update } = input;
      const data = Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined));
      if (Object.keys(data).length) await db.update(eventPartnershipPackages).set(data).where(eq(eventPartnershipPackages.id, id));
      return { success: true };
    }),
});
