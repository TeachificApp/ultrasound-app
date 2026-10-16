import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  ultrasoundExpoAgendaItems,
  ultrasoundExpoEvents,
  ultrasoundExpoEventPages,
  ultrasoundExpoPackages,
  ultrasoundExpoPartnerDocuments,
  ultrasoundExpoPartnerProfiles,
  ultrasoundExpoRecordings,
  ultrasoundExpoRegistrations,
  users,
  vendorPartnerApplications,
} from "../../drizzle/schema";
import {
  buildUltrasoundExpoAgendaIcs,
  ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS,
  ULTRASOUND_EXPO_EVENT_PAGE_TYPES,
} from "../../shared/ultrasoundExpoEvent";
import { getDb, getUserRoles } from "../db";
import { getStripeClient } from "../lib/stripeClient";
import { grantUltrasoundExpoEventCommunityAccess } from "../lib/ultrasoundExpoCommunity";
import { storagePut } from "../storage";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { ULTRASOUND_EXPO_ORIGIN } from "../../shared/ultrasoundExpo";

const pageTypeInput = z.enum(ULTRASOUND_EXPO_EVENT_PAGE_TYPES);
const accessLevelInput = z.enum(ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS);
const allowedDocumentMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function toSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 255);
}

async function assertExpoAdmin(user: { id: number; role: string }) {
  const roles = await getUserRoles(user.id);
  if (user.role !== "admin" && !roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access is required." });
  }
}

async function isExpoAdmin(user: { id: number; role: string }) {
  const roles = await getUserRoles(user.id);
  return user.role === "admin" || roles.includes("platform_admin");
}

function safeExpoOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") return url.origin;
  } catch {
    // Use the official event site if an untrusted source was supplied.
  }
  return ULTRASOUND_EXPO_ORIGIN;
}

async function getEventById(db: any, eventId: number) {
  const [event] = await db.select().from(ultrasoundExpoEvents).where(eq(ultrasoundExpoEvents.id, eventId)).limit(1);
  if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "The UltrasoundExpo™ event was not found." });
  return event;
}

async function getEventBySlug(db: any, eventSlug: string) {
  const [event] = await db.select().from(ultrasoundExpoEvents)
    .where(and(eq(ultrasoundExpoEvents.slug, eventSlug), eq(ultrasoundExpoEvents.status, "published"))).limit(1);
  if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "This UltrasoundExpo™ event is not currently available." });
  return event;
}

type EventAccess = {
  event: typeof ultrasoundExpoEvents.$inferSelect;
  isAdmin: boolean;
  isRegistered: boolean;
  isPartner: boolean;
  vendorApplicationId: number | null;
  registrationTypes: string[];
};

/**
 * A page, community, partner profile, or recording checkout always begins here.
 * Email alone, a pending application, and a vendor approval alone do not grant
 * event access: an event-specific paid registration is required.
 */
async function assertPaidEventAccess(
  db: any,
  user: { id: number; role: string },
  eventId: number,
  requirement: "registered" | "partner" = "registered",
): Promise<EventAccess> {
  const event = await getEventById(db, eventId);
  const admin = await isExpoAdmin(user);
  if (admin) return { event, isAdmin: true, isRegistered: true, isPartner: true, vendorApplicationId: null, registrationTypes: ["admin"] };

  const rows = await db.select({
    registrationId: ultrasoundExpoRegistrations.id,
    vendorApplicationId: ultrasoundExpoRegistrations.vendorApplicationId,
    packageType: ultrasoundExpoPackages.packageType,
  }).from(ultrasoundExpoRegistrations)
    .innerJoin(ultrasoundExpoPackages, eq(ultrasoundExpoRegistrations.packageId, ultrasoundExpoPackages.id))
    .where(and(
      eq(ultrasoundExpoRegistrations.eventId, eventId),
      eq(ultrasoundExpoRegistrations.userId, user.id),
      eq(ultrasoundExpoRegistrations.paymentStatus, "paid"),
      inArray(ultrasoundExpoPackages.packageType, ["registrant", "exhibitor", "sponsor"]),
    ));
  const partnerRow = rows.find((row: any) => row.packageType === "exhibitor" || row.packageType === "sponsor");
  if (!rows.length || (requirement === "partner" && !partnerRow)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: requirement === "partner"
        ? "A paid exhibitor or sponsor selection for this UltrasoundExpo™ event is required."
        : "A completed registration for this UltrasoundExpo™ event is required.",
    });
  }
  return {
    event,
    isAdmin: false,
    isRegistered: true,
    isPartner: !!partnerRow,
    vendorApplicationId: partnerRow?.vendorApplicationId ?? null,
    registrationTypes: [...new Set<string>(rows.map((row: any) => String(row.packageType)) as string[])],
  };
}

function decodeDocument(dataUri: string, mimeType: string) {
  if (!allowedDocumentMimeTypes.has(mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a PDF, Office document, PNG, JPEG, or WebP file." });
  const prefix = `data:${mimeType};base64,`;
  if (!dataUri.startsWith(prefix)) throw new TRPCError({ code: "BAD_REQUEST", message: "The document upload is invalid." });
  const buffer = Buffer.from(dataUri.slice(prefix.length), "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a file no larger than 10 MB." });
  return buffer;
}

function fileExtension(mimeType: string) {
  return ({
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  } as Record<string, string>)[mimeType] ?? "bin";
}

const agendaInput = z.object({
  id: z.number().int().positive().optional(),
  eventId: z.number().int().positive(),
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(12_000).optional().or(z.literal("")),
  startsAt: z.date(),
  endsAt: z.date().nullable().optional(),
  locationLabel: z.string().trim().max(512).optional().or(z.literal("")),
  speakerNames: z.string().trim().max(2_000).optional().or(z.literal("")),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  status: z.enum(["draft", "published", "cancelled"]),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

const eventPageInput = z.object({
  id: z.number().int().positive().optional(),
  eventId: z.number().int().positive(),
  title: z.string().trim().min(2).max(255),
  slug: z.string().trim().min(2).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only."),
  pageType: pageTypeInput,
  accessLevel: accessLevelInput,
  blocksJson: z.string().max(400_000).optional().or(z.literal("")),
  status: z.enum(["draft", "published", "archived"]),
  seoTitle: z.string().trim().max(255).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(4_000).optional().or(z.literal("")),
  seoKeywords: z.string().trim().max(4_000).optional().or(z.literal("")),
  seoImage: z.string().trim().max(512).optional().or(z.literal("")),
});

const recordingInput = z.object({
  id: z.number().int().positive().optional(),
  eventId: z.number().int().positive(),
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(12_000).optional().or(z.literal("")),
  videoUrl: z.string().trim().url().max(2_048).optional().or(z.literal("")),
  thumbnailUrl: z.string().trim().url().max(2_048).optional().or(z.literal("")),
  durationSeconds: z.number().int().positive().max(172_800).nullable().optional(),
  status: z.enum(["draft", "published", "archived"]),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const ultrasoundExpoEventRouter = router({
  /** Public schedule facts deliberately exclude unpublished items and member-only pages. */
  publicEvent: publicProcedure.input(z.object({ eventSlug: z.string().min(2).max(255) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const event = await getEventBySlug(db, input.eventSlug);
    const agenda = await db.select().from(ultrasoundExpoAgendaItems)
      .where(and(eq(ultrasoundExpoAgendaItems.eventId, event.id), eq(ultrasoundExpoAgendaItems.status, "published")))
      .orderBy(asc(ultrasoundExpoAgendaItems.startsAt), asc(ultrasoundExpoAgendaItems.sortOrder));
    const pages = await db.select({ id: ultrasoundExpoEventPages.id, title: ultrasoundExpoEventPages.title, slug: ultrasoundExpoEventPages.slug, pageType: ultrasoundExpoEventPages.pageType })
      .from(ultrasoundExpoEventPages)
      .where(and(eq(ultrasoundExpoEventPages.eventId, event.id), eq(ultrasoundExpoEventPages.status, "published"), eq(ultrasoundExpoEventPages.accessLevel, "public")))
      .orderBy(asc(ultrasoundExpoEventPages.id));
    return { event, agenda, pages };
  }),

  getEventPage: publicProcedure.input(z.object({ eventSlug: z.string().min(2).max(255), pageSlug: z.string().min(2).max(255) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [event] = await db.select().from(ultrasoundExpoEvents).where(eq(ultrasoundExpoEvents.slug, input.eventSlug)).limit(1);
    if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "This UltrasoundExpo™ event is not currently available." });
    const admin = ctx.user ? await isExpoAdmin(ctx.user) : false;
    if (event.status !== "published" && !admin) throw new TRPCError({ code: "NOT_FOUND", message: "This UltrasoundExpo™ event is not currently available." });
    const [page] = await db.select().from(ultrasoundExpoEventPages)
      .where(and(eq(ultrasoundExpoEventPages.eventId, event.id), eq(ultrasoundExpoEventPages.slug, input.pageSlug), ...(admin ? [] : [eq(ultrasoundExpoEventPages.status, "published")]))).limit(1);
    if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "This event page is not currently available." });
    if (page.accessLevel !== "public" && !ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in with your UltrasoundExpo™ event account to access this page." });
    }
    const access = page.accessLevel === "public"
      ? null
      : await assertPaidEventAccess(db, ctx.user!, event.id, page.accessLevel === "partners" ? "partner" : "registered");
    return { event, page, access: access ? { isPartner: access.isPartner, registrationTypes: access.registrationTypes } : null };
  }),

  getMyEventHub: protectedProcedure.input(z.object({ eventSlug: z.string().min(2).max(255) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const event = await getEventBySlug(db, input.eventSlug);
    const access = await assertPaidEventAccess(db, ctx.user, event.id);
    const community = await grantUltrasoundExpoEventCommunityAccess(db, event, ctx.user.id, access.isAdmin ? "admin" : "member");
    const [agenda, pages, recordingProducts, recordings, partnerProfiles] = await Promise.all([
      db.select().from(ultrasoundExpoAgendaItems).where(and(eq(ultrasoundExpoAgendaItems.eventId, event.id), eq(ultrasoundExpoAgendaItems.status, "published"))).orderBy(asc(ultrasoundExpoAgendaItems.startsAt), asc(ultrasoundExpoAgendaItems.sortOrder)),
      db.select({ id: ultrasoundExpoEventPages.id, title: ultrasoundExpoEventPages.title, slug: ultrasoundExpoEventPages.slug, pageType: ultrasoundExpoEventPages.pageType, accessLevel: ultrasoundExpoEventPages.accessLevel })
        .from(ultrasoundExpoEventPages).where(and(eq(ultrasoundExpoEventPages.eventId, event.id), eq(ultrasoundExpoEventPages.status, "published")))
        .orderBy(asc(ultrasoundExpoEventPages.id)),
      db.select().from(ultrasoundExpoPackages).where(and(eq(ultrasoundExpoPackages.eventId, event.id), eq(ultrasoundExpoPackages.packageType, "product"), eq(ultrasoundExpoPackages.isActive, true))).orderBy(asc(ultrasoundExpoPackages.sortOrder)),
      db.select().from(ultrasoundExpoRecordings).where(and(eq(ultrasoundExpoRecordings.eventId, event.id), eq(ultrasoundExpoRecordings.status, "published"))).orderBy(asc(ultrasoundExpoRecordings.sortOrder)),
      db.select({ id: ultrasoundExpoPartnerProfiles.id, displayName: ultrasoundExpoPartnerProfiles.displayName, summary: ultrasoundExpoPartnerProfiles.summary, websiteUrl: ultrasoundExpoPartnerProfiles.websiteUrl, logoUrl: ultrasoundExpoPartnerProfiles.logoUrl, contactEmail: ultrasoundExpoPartnerProfiles.contactEmail, contactPhone: ultrasoundExpoPartnerProfiles.contactPhone })
        .from(ultrasoundExpoPartnerProfiles).where(and(eq(ultrasoundExpoPartnerProfiles.eventId, event.id), eq(ultrasoundExpoPartnerProfiles.isPublished, true))).orderBy(asc(ultrasoundExpoPartnerProfiles.displayName)),
    ]);
    const recordingOrders = await db.select({ id: ultrasoundExpoRegistrations.id }).from(ultrasoundExpoRegistrations)
      .innerJoin(ultrasoundExpoPackages, eq(ultrasoundExpoRegistrations.packageId, ultrasoundExpoPackages.id))
      .where(and(eq(ultrasoundExpoRegistrations.eventId, event.id), eq(ultrasoundExpoRegistrations.userId, ctx.user.id), eq(ultrasoundExpoRegistrations.paymentStatus, "paid"), eq(ultrasoundExpoPackages.packageType, "product")));
    const profilesWithDocuments = await Promise.all(partnerProfiles.map(async (profile: any) => ({
      ...profile,
      documents: await db.select({ id: ultrasoundExpoPartnerDocuments.id, title: ultrasoundExpoPartnerDocuments.title, fileUrl: ultrasoundExpoPartnerDocuments.fileUrl, fileName: ultrasoundExpoPartnerDocuments.fileName })
        .from(ultrasoundExpoPartnerDocuments).where(and(eq(ultrasoundExpoPartnerDocuments.partnerProfileId, profile.id), eq(ultrasoundExpoPartnerDocuments.isPublished, true))).orderBy(asc(ultrasoundExpoPartnerDocuments.title)),
    })));
    return {
      event,
      access,
      community: { id: community.id, slug: community.slug, title: community.title },
      agenda,
      pages: pages.filter((page: any) => page.accessLevel === "public" || page.accessLevel === "registered" || access.isPartner),
      recordingProducts,
      recordings: recordingOrders.length || access.isAdmin ? recordings : [],
      recordingsAvailable: recordings.length > 0,
      hasRecordingAccess: recordingOrders.length > 0 || access.isAdmin,
      partnerProfiles: profilesWithDocuments,
    };
  }),

  downloadAgendaIcs: protectedProcedure.input(z.object({ eventSlug: z.string().min(2).max(255) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const event = await getEventBySlug(db, input.eventSlug);
    await assertPaidEventAccess(db, ctx.user, event.id);
    const agenda = await db.select().from(ultrasoundExpoAgendaItems).where(and(eq(ultrasoundExpoAgendaItems.eventId, event.id), eq(ultrasoundExpoAgendaItems.status, "published"))).orderBy(asc(ultrasoundExpoAgendaItems.startsAt));
    return { filename: `${event.slug}-agenda.ics`, ics: buildUltrasoundExpoAgendaIcs(`${event.name} Schedule`, agenda) };
  }),

  /** Recordings can be sold only after the visitor has an event-specific registration. */
  createRecordingCheckout: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), origin: z.string().max(2_048) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "UltrasoundExpo™ checkout is temporarily unavailable." });
    const [selection] = await db.select({ packageId: ultrasoundExpoPackages.id, eventId: ultrasoundExpoEvents.id, eventSlug: ultrasoundExpoEvents.slug, eventName: ultrasoundExpoEvents.name, eventStatus: ultrasoundExpoEvents.status, packageType: ultrasoundExpoPackages.packageType, packageName: ultrasoundExpoPackages.name, amountCents: ultrasoundExpoPackages.amountCents, currency: ultrasoundExpoPackages.currency, isActive: ultrasoundExpoPackages.isActive })
      .from(ultrasoundExpoPackages).innerJoin(ultrasoundExpoEvents, eq(ultrasoundExpoPackages.eventId, ultrasoundExpoEvents.id)).where(eq(ultrasoundExpoPackages.id, input.packageId)).limit(1);
    if (!selection || selection.eventStatus !== "published" || !selection.isActive || selection.packageType !== "product") throw new TRPCError({ code: "NOT_FOUND", message: "This UltrasoundExpo™ recording option is not available." });
    await assertPaidEventAccess(db, ctx.user, selection.eventId);
    const [account] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    const email = account?.email || ctx.user.email;
    if (!email) throw new TRPCError({ code: "BAD_REQUEST", message: "A verified account email is required for secure checkout." });
    const created = await db.insert(ultrasoundExpoRegistrations).values({ eventId: selection.eventId, packageId: selection.packageId, userId: ctx.user.id, vendorApplicationId: null, attendeeName: account?.name || "UltrasoundExpo™ participant", attendeeEmail: email, amountCents: selection.amountCents, currency: selection.currency, paymentStatus: "pending", status: "pending" }).$returningId();
    const registrationId = created[0]?.id;
    if (!registrationId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to save the recording selection." });
    try {
      const origin = safeExpoOrigin(input.origin);
      const session = await getStripeClient().checkout.sessions.create({
        mode: "payment", customer_email: email, client_reference_id: String(ctx.user.id), billing_address_collection: "auto", allow_promotion_codes: false,
        line_items: [{ price_data: { currency: selection.currency, product_data: { name: `${selection.eventName} — ${selection.packageName}`, description: "UltrasoundExpo™ post-event recording access" }, unit_amount: selection.amountCents }, quantity: 1 }],
        metadata: { type: "ultrasound_expo", ultrasound_expo_registration_id: String(registrationId), ultrasound_expo_event_id: String(selection.eventId), ultrasound_expo_package_type: "product", user_id: String(ctx.user.id), attendee_email: email },
        payment_intent_data: { description: `UltrasoundExpo™ — ${selection.packageName}` },
        success_url: `${origin}/events/${selection.eventSlug}?status=complete&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/events/${selection.eventSlug}?status=cancelled`,
      }, { idempotencyKey: `ultrasound-expo-recording:${registrationId}` });
      await db.update(ultrasoundExpoRegistrations).set({ stripeSessionId: session.id }).where(eq(ultrasoundExpoRegistrations.id, registrationId));
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      return { checkoutUrl: session.url };
    } catch {
      await db.update(ultrasoundExpoRegistrations).set({ paymentStatus: "failed", status: "payment_failed" }).where(eq(ultrasoundExpoRegistrations.id, registrationId));
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to start secure UltrasoundExpo™ checkout. Please try again." });
    }
  }),

  getMyPartnerProfile: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const access = await assertPaidEventAccess(db, ctx.user, input.eventId, "partner");
    if (!access.vendorApplicationId) throw new TRPCError({ code: "FORBIDDEN" });
    const [profile] = await db.select().from(ultrasoundExpoPartnerProfiles).where(and(eq(ultrasoundExpoPartnerProfiles.eventId, input.eventId), eq(ultrasoundExpoPartnerProfiles.vendorApplicationId, access.vendorApplicationId))).limit(1);
    const documents = profile ? await db.select().from(ultrasoundExpoPartnerDocuments).where(eq(ultrasoundExpoPartnerDocuments.partnerProfileId, profile.id)).orderBy(desc(ultrasoundExpoPartnerDocuments.createdAt)) : [];
    return { event: access.event, profile: profile ?? null, documents };
  }),

  saveMyPartnerProfile: protectedProcedure.input(z.object({ eventId: z.number().int().positive(), displayName: z.string().trim().min(2).max(255), summary: z.string().trim().max(8_000).optional().or(z.literal("")), websiteUrl: z.string().trim().url().max(1_024).optional().or(z.literal("")), logoUrl: z.string().trim().url().max(2_048).optional().or(z.literal("")), logoDataUri: z.string().min(1).max(4_500_000).optional(), logoMimeType: z.string().max(100).optional(), contactEmail: z.string().trim().email().max(320).optional().or(z.literal("")), contactPhone: z.string().trim().max(60).optional().or(z.literal("")), isPublished: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const access = await assertPaidEventAccess(db, ctx.user, input.eventId, "partner");
    if (!access.vendorApplicationId) throw new TRPCError({ code: "FORBIDDEN" });
    let uploadedLogoUrl: string | null = null;
    if (input.logoDataUri || input.logoMimeType) {
      if (!input.logoDataUri || !input.logoMimeType || !["image/jpeg", "image/png", "image/webp"].includes(input.logoMimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a PNG, JPEG, or WebP organization logo." });
      const logo = decodeDocument(input.logoDataUri, input.logoMimeType);
      try { uploadedLogoUrl = (await storagePut(`ultrasound-expo/partner-logos/${randomBytes(16).toString("hex")}.${fileExtension(input.logoMimeType)}`, logo, input.logoMimeType)).url; }
      catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The organization logo could not be uploaded. Please try again." }); }
    }
    const [existingProfile] = await db.select({ id: ultrasoundExpoPartnerProfiles.id, logoUrl: ultrasoundExpoPartnerProfiles.logoUrl }).from(ultrasoundExpoPartnerProfiles).where(and(eq(ultrasoundExpoPartnerProfiles.eventId, input.eventId), eq(ultrasoundExpoPartnerProfiles.vendorApplicationId, access.vendorApplicationId))).limit(1);
    const values = { eventId: input.eventId, vendorApplicationId: access.vendorApplicationId, displayName: input.displayName, summary: input.summary || null, websiteUrl: input.websiteUrl || null, logoUrl: uploadedLogoUrl || input.logoUrl || existingProfile?.logoUrl || null, contactEmail: input.contactEmail || null, contactPhone: input.contactPhone || null, isPublished: input.isPublished };
    if (existingProfile) { await db.update(ultrasoundExpoPartnerProfiles).set(values).where(eq(ultrasoundExpoPartnerProfiles.id, existingProfile.id)); return { id: existingProfile.id, updated: true }; }
    const created = await db.insert(ultrasoundExpoPartnerProfiles).values(values).$returningId();
    return { id: created[0]?.id ?? null, updated: false };
  }),

  uploadPartnerDocument: protectedProcedure.input(z.object({ eventId: z.number().int().positive(), title: z.string().trim().min(2).max(255), fileName: z.string().trim().min(1).max(255), mimeType: z.string().max(100), dataUri: z.string().min(1).max(14_000_000), isPublished: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const access = await assertPaidEventAccess(db, ctx.user, input.eventId, "partner");
    if (!access.vendorApplicationId) throw new TRPCError({ code: "FORBIDDEN" });
    const [profile] = await db.select({ id: ultrasoundExpoPartnerProfiles.id }).from(ultrasoundExpoPartnerProfiles).where(and(eq(ultrasoundExpoPartnerProfiles.eventId, input.eventId), eq(ultrasoundExpoPartnerProfiles.vendorApplicationId, access.vendorApplicationId))).limit(1);
    if (!profile) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Save your organization profile before adding product documents." });
    const file = decodeDocument(input.dataUri, input.mimeType);
    let fileUrl: string;
    try {
      fileUrl = (await storagePut(`ultrasound-expo/partner-documents/${randomBytes(16).toString("hex")}.${fileExtension(input.mimeType)}`, file, input.mimeType)).url;
    } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The product document could not be uploaded. Please try again." }); }
    const created = await db.insert(ultrasoundExpoPartnerDocuments).values({ partnerProfileId: profile.id, title: input.title, fileUrl, fileName: input.fileName, mimeType: input.mimeType, isPublished: input.isPublished }).$returningId();
    return { id: created[0]?.id ?? null, fileUrl };
  }),

  adminEventWorkspace: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const event = await getEventById(db, input.eventId);
    const [agenda, pages, recordings, registrations, profiles] = await Promise.all([
      db.select().from(ultrasoundExpoAgendaItems).where(eq(ultrasoundExpoAgendaItems.eventId, event.id)).orderBy(asc(ultrasoundExpoAgendaItems.startsAt), asc(ultrasoundExpoAgendaItems.sortOrder)),
      db.select().from(ultrasoundExpoEventPages).where(eq(ultrasoundExpoEventPages.eventId, event.id)).orderBy(asc(ultrasoundExpoEventPages.createdAt)),
      db.select().from(ultrasoundExpoRecordings).where(eq(ultrasoundExpoRecordings.eventId, event.id)).orderBy(asc(ultrasoundExpoRecordings.sortOrder)),
      db.select({ id: ultrasoundExpoRegistrations.id, attendeeName: ultrasoundExpoRegistrations.attendeeName, attendeeEmail: ultrasoundExpoRegistrations.attendeeEmail, organizationName: ultrasoundExpoRegistrations.organizationName, packageType: ultrasoundExpoPackages.packageType, packageName: ultrasoundExpoPackages.name, paymentStatus: ultrasoundExpoRegistrations.paymentStatus, status: ultrasoundExpoRegistrations.status, paidAt: ultrasoundExpoRegistrations.paidAt, createdAt: ultrasoundExpoRegistrations.createdAt }).from(ultrasoundExpoRegistrations).innerJoin(ultrasoundExpoPackages, eq(ultrasoundExpoRegistrations.packageId, ultrasoundExpoPackages.id)).where(eq(ultrasoundExpoRegistrations.eventId, event.id)).orderBy(desc(ultrasoundExpoRegistrations.createdAt)),
      db.select().from(ultrasoundExpoPartnerProfiles).where(eq(ultrasoundExpoPartnerProfiles.eventId, event.id)).orderBy(asc(ultrasoundExpoPartnerProfiles.displayName)),
    ]);
    const community = await grantUltrasoundExpoEventCommunityAccess(db, event, ctx.user.id, "admin");
    return {
      event, agenda, pages, recordings, profiles, community: { id: community.id, slug: community.slug },
      attendeeRegistrations: registrations.filter((item: any) => item.packageType === "registrant"),
      partnerRegistrations: registrations.filter((item: any) => item.packageType === "exhibitor" || item.packageType === "sponsor"),
      recordingOrders: registrations.filter((item: any) => item.packageType === "product"),
    };
  }),

  adminSaveAgendaItem: protectedProcedure.input(agendaInput).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); await getEventById(db, input.eventId);
    const values = { eventId: input.eventId, title: input.title, description: input.description || null, startsAt: input.startsAt, endsAt: input.endsAt ?? null, locationLabel: input.locationLabel || null, speakerNames: input.speakerNames || null, category: input.category || null, status: input.status, sortOrder: input.sortOrder };
    if (input.id) { await db.update(ultrasoundExpoAgendaItems).set(values).where(and(eq(ultrasoundExpoAgendaItems.id, input.id), eq(ultrasoundExpoAgendaItems.eventId, input.eventId))); return { id: input.id, updated: true }; }
    const created = await db.insert(ultrasoundExpoAgendaItems).values(values).$returningId(); return { id: created[0]?.id ?? null, updated: false };
  }),

  adminSaveEventPage: protectedProcedure.input(eventPageInput).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); await getEventById(db, input.eventId);
    let blocksJson = input.blocksJson || "[]";
    try { if (!Array.isArray(JSON.parse(blocksJson))) throw new Error("not an array"); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Event page content must be valid page blocks." }); }
    const values = { eventId: input.eventId, title: input.title, slug: toSlug(input.slug), pageType: input.pageType, accessLevel: input.accessLevel, blocksJson, status: input.status, seoTitle: input.seoTitle || null, seoDescription: input.seoDescription || null, seoKeywords: input.seoKeywords || null, seoImage: input.seoImage || null, updatedByUserId: ctx.user.id };
    try {
      if (input.id) { await db.update(ultrasoundExpoEventPages).set(values).where(and(eq(ultrasoundExpoEventPages.id, input.id), eq(ultrasoundExpoEventPages.eventId, input.eventId))); return { id: input.id, updated: true }; }
      const created = await db.insert(ultrasoundExpoEventPages).values({ ...values, createdByUserId: ctx.user.id }).$returningId(); return { id: created[0]?.id ?? null, updated: false };
    } catch (error: any) { if (error?.code === "ER_DUP_ENTRY" || error?.message?.includes("Duplicate entry")) throw new TRPCError({ code: "CONFLICT", message: "This event already has a page with that URL slug." }); throw error; }
  }),

  adminSaveRecording: protectedProcedure.input(recordingInput).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); await getEventById(db, input.eventId);
    const values = { eventId: input.eventId, title: input.title, description: input.description || null, videoUrl: input.videoUrl || null, thumbnailUrl: input.thumbnailUrl || null, durationSeconds: input.durationSeconds ?? null, status: input.status, sortOrder: input.sortOrder };
    if (input.id) { await db.update(ultrasoundExpoRecordings).set(values).where(and(eq(ultrasoundExpoRecordings.id, input.id), eq(ultrasoundExpoRecordings.eventId, input.eventId))); return { id: input.id, updated: true }; }
    const created = await db.insert(ultrasoundExpoRecordings).values({ ...values, createdByUserId: ctx.user.id }).$returningId(); return { id: created[0]?.id ?? null, updated: false };
  }),
});
