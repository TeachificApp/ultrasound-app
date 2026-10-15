import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { sponsorships, workshopInstances, workshops } from "../../drizzle/schema";
import {
  isSponsorshipScope,
  isSponsorshipTier,
  resolveSponsorshipAmountCents,
  SPONSORSHIP_SCOPE_LABELS,
  SPONSORSHIP_TIERS,
  type SponsorshipScope,
  type SponsorshipTier,
} from "../../shared/sponsorship";
import { getDb, getUserRoles } from "../db";
import { getStripeClient } from "../lib/stripeClient";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { randomBytes } from "node:crypto";

const PUBLIC_SPONSOR_ORIGINS = new Set([
  "learn.allaboutultrasound.com",
  "learn.iheartecho.com",
  "app.allaboutultrasound.com",
  "app.iheartecho.com",
  "www.allaboutultrasound.com",
  "allaboutultrasound.com",
  "www.allaboutultrasound.net",
  "allaboutultrasound.net",
  "www.iheartecho.com",
  "iheartecho.com",
  "www.iheartecho.net",
  "iheartecho.net",
]);

function resolveSafeSponsorOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((url.protocol === "https:" && PUBLIC_SPONSOR_ORIGINS.has(url.hostname)) || isLocal) {
      return url.origin;
    }
  } catch {
    // A canonical public origin is used below for invalid input.
  }
  return "https://learn.allaboutultrasound.com";
}

async function assertSponsorshipAdmin(user: { id: number; role: string }) {
  const roles = await getUserRoles(user.id);
  if (user.role !== "admin" && !roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access is required." });
  }
}

const tierInput = z.enum(["silver", "gold", "platinum", "other"]);
const scopeInput = z.enum(["workshop_instance", "website", "app", "podcast", "other"]);
const SPONSOR_LOGO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function decodeSponsorLogo(dataUri: string, mimeType: string): Buffer {
  if (!SPONSOR_LOGO_MIME_TYPES.has(mimeType)) {
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

export const sponsorshipRouter = router({
  listWorkshopInstances: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sponsorship options are temporarily unavailable." });

    return db
      .select({
        id: workshopInstances.id,
        title: workshopInstances.title,
        startDate: workshopInstances.startDate,
        timezone: workshopInstances.timezone,
        venueCity: workshopInstances.venueCity,
        venueState: workshopInstances.venueState,
        workshopId: workshops.id,
        workshopTitle: workshops.title,
        workshopBrand: workshops.brand,
      })
      .from(workshopInstances)
      .innerJoin(workshops, eq(workshopInstances.workshopId, workshops.id))
      .where(and(
        eq(workshops.status, "public"),
        inArray(workshopInstances.status, ["published", "presale"]),
      ))
      .orderBy(asc(workshopInstances.startDate));
  }),

  createCheckout: publicProcedure
    .input(z.object({
      contactName: z.string().trim().min(2).max(255),
      contactEmail: z.string().trim().email().max(320),
      contactPhone: z.string().trim().max(60).optional(),
      organizationName: z.string().trim().min(2).max(255),
      organizationWebsite: z.string().trim().url().max(1024).optional().or(z.literal("")),
      organizationLogoDataUri: z.string().min(1).max(4_500_000).optional(),
      organizationLogoMimeType: z.string().max(100).optional(),
      organizationLogoFileName: z.string().trim().max(255).optional(),
      tier: tierInput,
      scope: scopeInput,
      workshopInstanceId: z.number().int().positive().optional(),
      otherPurpose: z.string().trim().max(1000).optional(),
      customAmountCents: z.number().int().min(100).max(10_000_000).optional(),
      notes: z.string().trim().max(4000).optional(),
      origin: z.string().max(2048),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sponsorship checkout is temporarily unavailable." });

      const tier = input.tier as SponsorshipTier;
      const scope = input.scope as SponsorshipScope;
      if (!isSponsorshipTier(tier) || !isSponsorshipScope(scope)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid sponsorship option." });
      }
      if (scope === "workshop_instance" && !input.workshopInstanceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose the workshop instance you would like to support." });
      }
      if (scope === "other" && !input.otherPurpose?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please describe the sponsorship you would like to support." });
      }

      const amountCents = resolveSponsorshipAmountCents({ tier, customAmountCents: input.customAmountCents });
      if (amountCents < 100) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a sponsorship amount of at least $1.00." });
      }

      let organizationLogoUrl: string | null = null;
      if (input.organizationLogoDataUri || input.organizationLogoMimeType || input.organizationLogoFileName) {
        if (!input.organizationLogoDataUri || !input.organizationLogoMimeType || !input.organizationLogoFileName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The organization logo upload is incomplete." });
        }
        const logo = decodeSponsorLogo(input.organizationLogoDataUri, input.organizationLogoMimeType);
        const extension = input.organizationLogoMimeType === "image/png" ? "png" : input.organizationLogoMimeType === "image/webp" ? "webp" : "jpg";
        try {
          organizationLogoUrl = (await storagePut(`sponsorships/logos/${randomBytes(16).toString("hex")}.${extension}`, logo, input.organizationLogoMimeType)).url;
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The organization logo could not be uploaded. Please try again." });
        }
      }

      let workshopInstanceId: number | null = null;
      if (scope === "workshop_instance") {
        const [instance] = await db
          .select({ id: workshopInstances.id })
          .from(workshopInstances)
          .innerJoin(workshops, eq(workshopInstances.workshopId, workshops.id))
          .where(and(
            eq(workshopInstances.id, input.workshopInstanceId!),
            eq(workshops.status, "public"),
            inArray(workshopInstances.status, ["published", "presale"]),
          ))
          .limit(1);
        if (!instance) {
          throw new TRPCError({ code: "NOT_FOUND", message: "That workshop instance is no longer available for sponsorship." });
        }
        workshopInstanceId = instance.id;
      }

      const created = await db.insert(sponsorships).values({
        contactName: input.contactName,
        contactEmail: input.contactEmail.toLowerCase(),
        contactPhone: input.contactPhone || null,
        organizationName: input.organizationName,
        organizationWebsite: input.organizationWebsite || null,
        organizationLogoUrl,
        sponsorshipTier: tier,
        sponsorshipScope: scope,
        workshopInstanceId,
        otherPurpose: input.otherPurpose || null,
        amountCents,
        currency: "usd",
        paymentStatus: "pending",
        status: "pending",
        notes: input.notes || null,
      }).$returningId();
      const sponsorshipId = created[0]?.id;
      if (!sponsorshipId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create the sponsorship record." });

      const origin = resolveSafeSponsorOrigin(input.origin);
      try {
        const session = await getStripeClient().checkout.sessions.create({
          mode: "payment",
          customer_email: input.contactEmail.toLowerCase(),
          allow_promotion_codes: false,
          billing_address_collection: "auto",
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: {
                name: `${SPONSORSHIP_TIERS[tier].label} Sponsorship — ${SPONSORSHIP_SCOPE_LABELS[scope]}`,
                description: `All About Ultrasound™ | iHeartEcho™ sponsorship from ${input.organizationName}`,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          }],
          metadata: {
            type: "sponsorship",
            sponsorship_id: String(sponsorshipId),
            sponsorship_tier: tier,
            sponsorship_scope: scope,
            workshop_instance_id: workshopInstanceId ? String(workshopInstanceId) : "",
            organization_name: input.organizationName.slice(0, 255),
          },
          payment_intent_data: {
            description: `${SPONSORSHIP_TIERS[tier].label} sponsorship — ${input.organizationName}`,
          },
          success_url: `${origin}/sponsorships?status=complete&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/sponsorships?status=cancelled`,
        }, { idempotencyKey: `sponsorship:${sponsorshipId}` });

        await db.update(sponsorships).set({ stripeSessionId: session.id }).where(eq(sponsorships.id, sponsorshipId));
        if (!session.url) throw new Error("Stripe did not return a checkout URL.");
        return { checkoutUrl: session.url };
      } catch (error) {
        await db.update(sponsorships)
          .set({ paymentStatus: "failed", status: "payment_failed" })
          .where(eq(sponsorships.id, sponsorshipId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to start the secure sponsorship checkout. Please try again." });
      }
    }),

  adminList: protectedProcedure
    .input(z.object({ status: z.enum(["all", "pending", "paid", "payment_failed", "cancelled"]).default("all") }))
    .query(async ({ ctx, input }) => {
      await assertSponsorshipAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          id: sponsorships.id,
          contactName: sponsorships.contactName,
          contactEmail: sponsorships.contactEmail,
          contactPhone: sponsorships.contactPhone,
          organizationName: sponsorships.organizationName,
          organizationWebsite: sponsorships.organizationWebsite,
          organizationLogoUrl: sponsorships.organizationLogoUrl,
          sponsorshipTier: sponsorships.sponsorshipTier,
          sponsorshipScope: sponsorships.sponsorshipScope,
          otherPurpose: sponsorships.otherPurpose,
          amountCents: sponsorships.amountCents,
          currency: sponsorships.currency,
          paymentStatus: sponsorships.paymentStatus,
          status: sponsorships.status,
          notes: sponsorships.notes,
          createdAt: sponsorships.createdAt,
          paidAt: sponsorships.paidAt,
          workshopTitle: workshops.title,
          workshopInstanceTitle: workshopInstances.title,
        })
        .from(sponsorships)
        .leftJoin(workshopInstances, eq(sponsorships.workshopInstanceId, workshopInstances.id))
        .leftJoin(workshops, eq(workshopInstances.workshopId, workshops.id))
        .where(input.status === "all" ? undefined : eq(sponsorships.status, input.status))
        .orderBy(desc(sponsorships.createdAt))
        .limit(500);
      const paidTotal = rows
        .filter((row) => row.paymentStatus === "paid")
        .reduce((sum, row) => sum + Number(row.amountCents ?? 0), 0);
      return { rows, paidTotal, paidCount: rows.filter((row) => row.paymentStatus === "paid").length };
    }),
});
