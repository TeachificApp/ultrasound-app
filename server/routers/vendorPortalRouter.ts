import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  eventPartnershipPackages,
  ultrasoundExpoBoothRequests,
  ultrasoundExpoBooths,
  ultrasoundExpoEvents,
  ultrasoundExpoPackages,
  ultrasoundExpoPartnerResources,
  vendorPartnerApplications,
  webinarRegistrations,
  webinars,
  workshopInstances,
  workshops,
} from "../../drizzle/schema";
import { SPONSORSHIP_TIERS } from "../../shared/sponsorship";
import {
  VENDOR_PARTNER_SCOPES,
  VENDOR_PARTNER_TYPES,
  isApprovedVendorForScope,
  parseVendorPartnerValues,
  type VendorPartnerScope,
} from "../../shared/vendorPartner";
import { getDb, getOrCreateUserByEmail, getUserRoles } from "../db";
import { sendEmail } from "../_core/email";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getPlatformAdminRecipient } from "../lib/platformAdminNotification";
import { requireApprovedVendorApplication } from "../lib/vendorPartnerAccess";
import { addExpoPartnerToEmailList } from "../lib/emailListHelper";
import {
  buildVendorApplicationAdminAlertEmail,
  buildVendorApplicationReceivedEmail,
  buildVendorApprovedEmail,
  buildVendorRejectedEmail,
} from "../lib/vendorPartnerEmail";
import { storagePut } from "../storage";

const scopeInput = z.enum(VENDOR_PARTNER_SCOPES);
const partnerTypeInput = z.enum(VENDOR_PARTNER_TYPES);
const logoMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function normalizeOrganizationWebsiteInput(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getVerifiedSharedAccountLink(
  contactEmail: string,
  user: { id: number; email?: string | null } | null | undefined,
): number | null {
  const signedInEmail = user?.email?.trim().toLowerCase();
  return signedInEmail && signedInEmail === contactEmail.trim().toLowerCase() ? user?.id ?? null : null;
}

function decodeOrganizationLogo(dataUri: string, mimeType: string): Buffer {
  if (!logoMimeTypes.has(mimeType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a PNG, JPEG, or WebP organization logo." });
  }
  const prefix = `data:${mimeType};base64,`;
  if (!dataUri.startsWith(prefix)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The organization logo upload is invalid." });
  }
  const file = Buffer.from(dataUri.slice(prefix.length), "base64");
  if (!file.length || file.length > 3 * 1024 * 1024) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an organization logo no larger than 3 MB." });
  }
  return file;
}

async function assertPartnerAdmin(user: { id: number; role: string }) {
  const roles = await getUserRoles(user.id);
  if (user.role !== "admin" && !roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access is required." });
  }
}

function asApplication(row: typeof vendorPartnerApplications.$inferSelect) {
  return {
    ...row,
    requestedScopes: parseVendorPartnerValues(row.requestedScopes, VENDOR_PARTNER_SCOPES),
    partnerTypes: parseVendorPartnerValues(row.partnerTypes, VENDOR_PARTNER_TYPES),
  };
}

const applicationInput = z.object({
  organizationName: z.string().trim().min(2).max(255),
  organizationWebsite: z.preprocess(
    normalizeOrganizationWebsiteInput,
    z.string().trim().url().max(1024).refine(value => {
      try {
        const parsed = new URL(value);
        return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
      } catch {
        return false;
      }
    }, "Enter a valid website address, such as yourorganization.com.").optional().or(z.literal("")),
  ),
  organizationLogoDataUri: z.string().min(1).max(4_500_000).optional(),
  organizationLogoMimeType: z.string().max(100).optional(),
  organizationLogoFileName: z.string().trim().max(255).optional(),
  contactName: z.string().trim().min(2).max(255),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().min(7).max(60),
  message: z.string().trim().max(4_000).optional(),
  requestedScopes: z.array(scopeInput).min(1).max(2),
  partnerTypes: z.array(partnerTypeInput).min(1).max(3),
  eventFocus: z.enum(["ultrasound_expo", "echo_expo"]).optional(),
});

export const vendorPortalRouter = router({
  submitApplication: publicProcedure
    .input(applicationInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Partner applications are temporarily unavailable." });

      const contactEmail = input.contactEmail.trim().toLowerCase();
      const organizationName = input.organizationName.trim();
      // A signed-in Learn/app member may apply as an attendee and an exhibitor.
      // Link only an exact, authenticated mailbox match; approval is still required
      // before this application grants any vendor, exhibitor, or sponsor access.
      const verifiedSharedUserId = getVerifiedSharedAccountLink(contactEmail, ctx.user);
      let existingPending: { id: number } | undefined;
      try {
        [existingPending] = await db.select({ id: vendorPartnerApplications.id })
          .from(vendorPartnerApplications)
          .where(and(
            eq(vendorPartnerApplications.contactEmail, contactEmail),
            eq(vendorPartnerApplications.organizationName, organizationName),
            eq(vendorPartnerApplications.status, "pending"),
          ))
          .limit(1);
      } catch (error) {
        // A transient duplicate-check failure must not block an otherwise valid
        // public application. The failed query is logged only on the server.
        console.error("[vendor-partner] Pending-application check failed; continuing to save application.", error);
      }
      if (existingPending) {
        return { success: true, duplicatePending: true };
      }

      let organizationLogoUrl: string | null = null;
      if (input.organizationLogoDataUri || input.organizationLogoMimeType || input.organizationLogoFileName) {
        if (!input.organizationLogoDataUri || !input.organizationLogoMimeType || !input.organizationLogoFileName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The organization logo upload is incomplete." });
        }
        const logo = decodeOrganizationLogo(input.organizationLogoDataUri, input.organizationLogoMimeType);
        const extension = input.organizationLogoMimeType === "image/png" ? "png" : input.organizationLogoMimeType === "image/webp" ? "webp" : "jpg";
        try {
          organizationLogoUrl = (await storagePut(`vendor-partners/logos/${randomBytes(16).toString("hex")}.${extension}`, logo, input.organizationLogoMimeType)).url;
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The organization logo could not be uploaded. Please try again." });
        }
      }

      try {
        const [createdApplication] = await db.insert(vendorPartnerApplications).values({
          organizationName,
          organizationWebsite: input.organizationWebsite?.trim() || null,
          organizationLogoUrl,
          contactName: input.contactName.trim(),
          contactEmail,
          contactPhone: input.contactPhone.trim(),
          message: input.message?.trim() || null,
          requestedScopes: JSON.stringify([...new Set(input.requestedScopes)]),
          partnerTypes: JSON.stringify([...new Set(input.partnerTypes)]),
          eventFocus: input.eventFocus ?? null,
          linkedUserId: verifiedSharedUserId,
          status: "pending",
        });
        const applicationId = Number((createdApplication as { insertId?: number }).insertId ?? 0) || null;
        void addExpoPartnerToEmailList({
          applicationId,
          userId: verifiedSharedUserId,
          email: contactEmail,
          name: input.contactName.trim(),
          partnerTypes: [...new Set(input.partnerTypes)],
          requestedScopes: [...new Set(input.requestedScopes)],
          eventFocus: input.eventFocus ?? null,
          status: "pending",
        });
      } catch (error) {
        console.error("[vendor-partner] Application save failed", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We could not submit your application right now. Please try again shortly or contact support@allaboutultrasound.com." });
      }

      const record = {
        organizationName,
        contactName: input.contactName.trim(),
        contactEmail,
        contactPhone: input.contactPhone.trim(),
        organizationWebsite: input.organizationWebsite?.trim() || null,
        message: input.message?.trim() || null,
        requestedScopes: [...new Set(input.requestedScopes)],
        partnerTypes: [...new Set(input.partnerTypes)],
      };
      const receivedEmail = buildVendorApplicationReceivedEmail(record);
      const adminAlertEmail = buildVendorApplicationAdminAlertEmail(record);
      const [received, alerted] = await Promise.allSettled([
        sendEmail({ to: { name: record.contactName, email: record.contactEmail }, subject: receivedEmail.subject, htmlBody: receivedEmail.htmlBody }),
        sendEmail({ to: getPlatformAdminRecipient("Partner Applications"), subject: adminAlertEmail.subject, htmlBody: adminAlertEmail.htmlBody }),
      ]);
      if (received.status === "rejected" || alerted.status === "rejected") {
        console.error("[vendor-partner] Application saved but one or more notification attempts failed.");
      }
      return { success: true };
    }),

  myAccess: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Partner access is temporarily unavailable." });

    const approved = await db.select().from(vendorPartnerApplications)
      .where(and(eq(vendorPartnerApplications.linkedUserId, ctx.user.id), eq(vendorPartnerApplications.status, "approved")))
      .orderBy(desc(vendorPartnerApplications.reviewedAt), desc(vendorPartnerApplications.id));
    const scoped = approved.filter(item => item.linkedUserId === ctx.user.id && item.status === "approved");
    const aausApplication = scoped.find(item => isApprovedVendorForScope(item, ctx.user.id, "aaus_ihe")) ?? null;
    const expoApplication = scoped.find(item => isApprovedVendorForScope(item, ctx.user.id, "ultrasound_expo")) ?? null;

    // Pending/rejected status may be shown only for the signed-in account's own verified email;
    // it never confers access and is not used by checkout authorization.
    const email = ctx.user.email?.trim().toLowerCase();
    const [ownApplication] = email
      ? await db.select().from(vendorPartnerApplications)
        .where(eq(vendorPartnerApplications.contactEmail, email))
        .orderBy(desc(vendorPartnerApplications.createdAt))
        .limit(1)
      : [];

    return {
      approved: {
        aausIHeartEcho: aausApplication ? asApplication(aausApplication) : null,
        ultrasoundExpo: expoApplication ? asApplication(expoApplication) : null,
      },
      applicationStatus: ownApplication && ownApplication.linkedUserId !== ctx.user.id && ownApplication.status !== "approved"
        ? { status: ownApplication.status, organizationName: ownApplication.organizationName, createdAt: ownApplication.createdAt }
        : null,
    };
  }),

  myPortal: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Partner access is temporarily unavailable." });

    const aausApplication = await requireApprovedVendorApplication(ctx.user.id, "aaus_ihe").catch((error: unknown) => {
      if (error instanceof TRPCError && error.code === "FORBIDDEN") return null;
      throw error;
    });
    const expoApplication = await requireApprovedVendorApplication(ctx.user.id, "ultrasound_expo").catch((error: unknown) => {
      if (error instanceof TRPCError && error.code === "FORBIDDEN") return null;
      throw error;
    });

    const [generalOpportunities, expoEvents] = await Promise.all([
      aausApplication
        ? db.select({
          id: eventPartnershipPackages.id,
          targetType: eventPartnershipPackages.targetType,
          name: eventPartnershipPackages.name,
          description: eventPartnershipPackages.description,
          benefits: eventPartnershipPackages.benefits,
          amountCents: eventPartnershipPackages.amountCents,
          currency: eventPartnershipPackages.currency,
          workshopInstanceId: eventPartnershipPackages.workshopInstanceId,
          webinarId: eventPartnershipPackages.webinarId,
          workshopTitle: workshops.title,
          workshopInstanceTitle: workshopInstances.title,
          webinarTitle: webinars.title,
        }).from(eventPartnershipPackages)
          .leftJoin(workshopInstances, eq(eventPartnershipPackages.workshopInstanceId, workshopInstances.id))
          .leftJoin(workshops, eq(workshopInstances.workshopId, workshops.id))
          .leftJoin(webinars, eq(eventPartnershipPackages.webinarId, webinars.id))
          .where(eq(eventPartnershipPackages.isActive, true))
          .orderBy(asc(eventPartnershipPackages.targetType), asc(eventPartnershipPackages.sortOrder), asc(eventPartnershipPackages.id))
        : Promise.resolve([]),
      expoApplication
        ? db.select().from(ultrasoundExpoEvents).where(eq(ultrasoundExpoEvents.status, "published")).orderBy(asc(ultrasoundExpoEvents.startsAt))
        : Promise.resolve([]),
    ]);

    const eventIds = expoEvents.map(item => item.id);
    const [expoPackages, resources, booths, boothRequests] = expoApplication && eventIds.length
      ? await Promise.all([
        db.select().from(ultrasoundExpoPackages)
          .where(and(inArray(ultrasoundExpoPackages.eventId, eventIds), inArray(ultrasoundExpoPackages.packageType, ["exhibitor", "sponsor"]), eq(ultrasoundExpoPackages.isActive, true)))
          .orderBy(asc(ultrasoundExpoPackages.eventId), asc(ultrasoundExpoPackages.sortOrder), asc(ultrasoundExpoPackages.id)),
        db.select().from(ultrasoundExpoPartnerResources)
          .where(and(inArray(ultrasoundExpoPartnerResources.eventId, eventIds), eq(ultrasoundExpoPartnerResources.isPublished, true)))
          .orderBy(asc(ultrasoundExpoPartnerResources.eventId), asc(ultrasoundExpoPartnerResources.sortOrder), asc(ultrasoundExpoPartnerResources.id)),
        db.select().from(ultrasoundExpoBooths)
          .where(and(inArray(ultrasoundExpoBooths.eventId, eventIds), eq(ultrasoundExpoBooths.availabilityStatus, "available")))
          .orderBy(asc(ultrasoundExpoBooths.eventId), asc(ultrasoundExpoBooths.sortOrder), asc(ultrasoundExpoBooths.boothCode)),
        db.select().from(ultrasoundExpoBoothRequests)
          .where(eq(ultrasoundExpoBoothRequests.vendorApplicationId, expoApplication.id))
          .orderBy(desc(ultrasoundExpoBoothRequests.createdAt)),
      ])
      : [[], [], [], []] as const;

    return {
      aausIHeartEcho: aausApplication ? {
        application: asApplication(aausApplication),
        sponsorshipTiers: Object.entries(SPONSORSHIP_TIERS).map(([key, value]) => ({ key, ...value })),
        eventOpportunities: generalOpportunities,
      } : null,
      ultrasoundExpo: expoApplication ? {
        application: asApplication(expoApplication),
        events: expoEvents,
        packages: expoPackages,
        resources,
        booths,
        boothRequests,
      } : null,
    };
  }),

  requestExpoBooth: protectedProcedure
    .input(z.object({ boothId: z.number().int().positive(), vendorNote: z.string().trim().max(2_000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const application = await requireApprovedVendorApplication(ctx.user.id, "ultrasound_expo");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [booth] = await db.select().from(ultrasoundExpoBooths).where(eq(ultrasoundExpoBooths.id, input.boothId)).limit(1);
      if (!booth || booth.availabilityStatus !== "available") {
        throw new TRPCError({ code: "NOT_FOUND", message: "That booth is no longer available for a selection request." });
      }
      const [existing] = await db.select({ id: ultrasoundExpoBoothRequests.id })
        .from(ultrasoundExpoBoothRequests)
        .where(and(eq(ultrasoundExpoBoothRequests.boothId, booth.id), eq(ultrasoundExpoBoothRequests.vendorApplicationId, application.id), eq(ultrasoundExpoBoothRequests.status, "requested")))
        .limit(1);
      if (existing) return { success: true, requestId: existing.id, duplicate: true };
      const created = await db.insert(ultrasoundExpoBoothRequests).values({
        eventId: booth.eventId,
        boothId: booth.id,
        vendorApplicationId: application.id,
        status: "requested",
        vendorNote: input.vendorNote?.trim() || null,
      }).$returningId();
      return { success: true, requestId: created[0]?.id ?? null, duplicate: false };
    }),

  adminListApplications: protectedProcedure
    .input(z.object({ status: z.enum(["all", "pending", "approved", "rejected", "suspended"]).default("all") }))
    .query(async ({ ctx, input }) => {
      await assertPartnerAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(vendorPartnerApplications)
        .where(input.status === "all" ? undefined : eq(vendorPartnerApplications.status, input.status))
        .orderBy(desc(vendorPartnerApplications.createdAt))
        .limit(500);
      return rows.map(asApplication);
    }),

  adminReviewApplication: protectedProcedure
    .input(z.object({
      applicationId: z.number().int().positive(),
      action: z.enum(["approve", "reject", "suspend"]),
      aausAccess: z.boolean().optional(),
      expoAccess: z.boolean().optional(),
      reviewerNotes: z.string().trim().max(4_000).optional().or(z.literal("")),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPartnerAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [application] = await db.select().from(vendorPartnerApplications).where(eq(vendorPartnerApplications.id, input.applicationId)).limit(1);
      if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Partner application not found." });
      const reviewerNotes = input.reviewerNotes?.trim() || null;

      if (input.action === "approve") {
        const aausAccess = input.aausAccess === true;
        const expoAccess = input.expoAccess === true;
        if (!aausAccess && !expoAccess) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Approve access to at least one partner area." });
        }
        const nameParts = application.contactName.split(" ").filter(Boolean);
        const resolved = await getOrCreateUserByEmail({
          email: application.contactEmail,
          name: application.contactName,
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(" ") || undefined,
        });
        await db.update(vendorPartnerApplications).set({
          status: "approved",
          linkedUserId: resolved.user.id,
          aausAccess,
          expoAccess,
          reviewerNotes,
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
        }).where(eq(vendorPartnerApplications.id, application.id));
        void addExpoPartnerToEmailList({
          applicationId: application.id,
          userId: resolved.user.id,
          email: application.contactEmail,
          name: application.contactName,
          partnerTypes: parseVendorPartnerValues(application.partnerTypes, VENDOR_PARTNER_TYPES),
          requestedScopes: parseVendorPartnerValues(application.requestedScopes, VENDOR_PARTNER_SCOPES),
          eventFocus: application.eventFocus,
          status: "approved",
        });
        if (application.status !== "approved") {
          const approvedScopes: VendorPartnerScope[] = [aausAccess ? "aaus_ihe" : null, expoAccess ? "ultrasound_expo" : null].filter((value): value is VendorPartnerScope => !!value);
          const email = buildVendorApprovedEmail({ organizationName: application.organizationName, contactName: application.contactName, approvedScopes });
          await sendEmail({ to: { name: application.contactName, email: application.contactEmail }, subject: email.subject, htmlBody: email.htmlBody }).catch(error => console.error("[vendor-partner] Approval email failed", error));
          if (expoAccess) {
            import("../lib/emailAutomation").then(({ fireEmailAutomationEvent }) =>
              fireEmailAutomationEvent({
                type: "expo_vendor_approved", scope: "expo", userId: resolved.user.id,
                email: application.contactEmail, name: application.contactName,
                contentName: application.organizationName, eventName: "UltrasoundExpo™",
                sourceKey: `vendor-approval:${application.id}`,
              }),
            ).catch(() => {});
          }
        }
        return { success: true, status: "approved" as const, linkedUserId: resolved.user.id };
      }

      const nextStatus = input.action === "reject" ? "rejected" : "suspended";
      await db.update(vendorPartnerApplications).set({
        status: nextStatus,
        aausAccess: false,
        expoAccess: false,
        reviewerNotes,
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
      }).where(eq(vendorPartnerApplications.id, application.id));
      void addExpoPartnerToEmailList({
        applicationId: application.id,
        userId: application.linkedUserId,
        email: application.contactEmail,
        name: application.contactName,
        partnerTypes: parseVendorPartnerValues(application.partnerTypes, VENDOR_PARTNER_TYPES),
        requestedScopes: parseVendorPartnerValues(application.requestedScopes, VENDOR_PARTNER_SCOPES),
        eventFocus: application.eventFocus,
        status: nextStatus,
      });
      if (nextStatus === "rejected" && application.status !== "rejected") {
        const email = buildVendorRejectedEmail({ organizationName: application.organizationName, contactName: application.contactName, note: reviewerNotes });
        await sendEmail({ to: { name: application.contactName, email: application.contactEmail }, subject: email.subject, htmlBody: email.htmlBody }).catch(error => console.error("[vendor-partner] Rejection email failed", error));
      }
      return { success: true, status: nextStatus };
    }),

  adminSaveExpoResource: protectedProcedure
    .input(z.object({
      id: z.number().int().positive().optional(),
      eventId: z.number().int().positive(),
      resourceType: z.enum(["floor_plan", "booth_setup", "logistics", "document", "other"]),
      title: z.string().trim().min(2).max(255),
      description: z.string().trim().max(8_000).optional().or(z.literal("")),
      resourceUrl: z.string().trim().url().max(2_048).optional().or(z.literal("")),
      isPublished: z.boolean(),
      sortOrder: z.number().int().min(0).max(10_000),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPartnerAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const values = {
        eventId: input.eventId,
        resourceType: input.resourceType,
        title: input.title,
        description: input.description || null,
        resourceUrl: input.resourceUrl || null,
        isPublished: input.isPublished,
        sortOrder: input.sortOrder,
      };
      if (input.id) {
        await db.update(ultrasoundExpoPartnerResources).set(values).where(eq(ultrasoundExpoPartnerResources.id, input.id));
        return { id: input.id, updated: true };
      }
      const created = await db.insert(ultrasoundExpoPartnerResources).values(values).$returningId();
      return { id: created[0]?.id ?? null, updated: false };
    }),

  adminSaveExpoBooth: protectedProcedure
    .input(z.object({
      id: z.number().int().positive().optional(),
      eventId: z.number().int().positive(),
      boothCode: z.string().trim().min(1).max(100),
      zoneLabel: z.string().trim().max(255).optional().or(z.literal("")),
      dimensions: z.string().trim().max(100).optional().or(z.literal("")),
      description: z.string().trim().max(4_000).optional().or(z.literal("")),
      mapReference: z.string().trim().max(255).optional().or(z.literal("")),
      availabilityStatus: z.enum(["available", "reserved", "sold", "unavailable"]),
      sortOrder: z.number().int().min(0).max(10_000),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPartnerAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const values = {
        eventId: input.eventId,
        boothCode: input.boothCode,
        zoneLabel: input.zoneLabel || null,
        dimensions: input.dimensions || null,
        description: input.description || null,
        mapReference: input.mapReference || null,
        availabilityStatus: input.availabilityStatus,
        sortOrder: input.sortOrder,
      };
      try {
        if (input.id) {
          await db.update(ultrasoundExpoBooths).set(values).where(eq(ultrasoundExpoBooths.id, input.id));
          return { id: input.id, updated: true };
        }
        const created = await db.insert(ultrasoundExpoBooths).values(values).$returningId();
        return { id: created[0]?.id ?? null, updated: false };
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY" || error?.message?.includes("Duplicate entry")) {
          throw new TRPCError({ code: "CONFLICT", message: "This event already has that booth code." });
        }
        throw error;
      }
    }),

  adminReviewExpoBoothRequest: protectedProcedure
    .input(z.object({
      requestId: z.number().int().positive(),
      status: z.enum(["confirmed", "declined", "cancelled"]),
      adminNote: z.string().trim().max(4_000).optional().or(z.literal("")),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPartnerAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [request] = await db.select().from(ultrasoundExpoBoothRequests).where(eq(ultrasoundExpoBoothRequests.id, input.requestId)).limit(1);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Booth request not found." });
      if (input.status === "confirmed") {
        const [booth] = await db.select().from(ultrasoundExpoBooths).where(eq(ultrasoundExpoBooths.id, request.boothId)).limit(1);
        if (!booth || booth.availabilityStatus !== "available") {
          throw new TRPCError({ code: "CONFLICT", message: "This booth is no longer available to confirm." });
        }
        await db.update(ultrasoundExpoBooths).set({ availabilityStatus: "reserved" }).where(eq(ultrasoundExpoBooths.id, booth.id));
      }
      await db.update(ultrasoundExpoBoothRequests).set({
        status: input.status,
        adminNote: input.adminNote?.trim() || null,
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
      }).where(eq(ultrasoundExpoBoothRequests.id, request.id));
      return { success: true };
    }),

  adminExpoOperations: protectedProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPartnerAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [resources, booths, boothRequests] = await Promise.all([
        db.select().from(ultrasoundExpoPartnerResources).where(eq(ultrasoundExpoPartnerResources.eventId, input.eventId)).orderBy(asc(ultrasoundExpoPartnerResources.sortOrder), asc(ultrasoundExpoPartnerResources.id)),
        db.select().from(ultrasoundExpoBooths).where(eq(ultrasoundExpoBooths.eventId, input.eventId)).orderBy(asc(ultrasoundExpoBooths.sortOrder), asc(ultrasoundExpoBooths.boothCode)),
        db.select({
          id: ultrasoundExpoBoothRequests.id,
          boothId: ultrasoundExpoBoothRequests.boothId,
          boothCode: ultrasoundExpoBooths.boothCode,
          organizationName: vendorPartnerApplications.organizationName,
          contactName: vendorPartnerApplications.contactName,
          contactEmail: vendorPartnerApplications.contactEmail,
          status: ultrasoundExpoBoothRequests.status,
          vendorNote: ultrasoundExpoBoothRequests.vendorNote,
          adminNote: ultrasoundExpoBoothRequests.adminNote,
          createdAt: ultrasoundExpoBoothRequests.createdAt,
        }).from(ultrasoundExpoBoothRequests)
          .innerJoin(ultrasoundExpoBooths, eq(ultrasoundExpoBoothRequests.boothId, ultrasoundExpoBooths.id))
          .innerJoin(vendorPartnerApplications, eq(ultrasoundExpoBoothRequests.vendorApplicationId, vendorPartnerApplications.id))
          .where(eq(ultrasoundExpoBoothRequests.eventId, input.eventId))
          .orderBy(desc(ultrasoundExpoBoothRequests.createdAt)),
      ]);
      return { resources, booths, boothRequests };
    }),
});
