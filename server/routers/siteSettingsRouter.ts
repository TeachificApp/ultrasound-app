import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { siteSettings, platformSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Key-value helpers for site_settings table (used for pixel IDs) ───────────

async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ value: siteSettings.settingValue })
    .from(siteSettings)
    .where(eq(siteSettings.settingKey, key))
    .limit(1);
  return row?.value ?? null;
}

async function upsertSetting(key: string, value: string | null, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  if (value === null || value === "") {
    await db.delete(siteSettings).where(eq(siteSettings.settingKey, key));
  } else {
    await db
      .insert(siteSettings)
      .values({ settingKey: key, settingValue: value, updatedAt: now, updatedBy: userId })
      .onDuplicateKeyUpdate({ set: { settingValue: value, updatedAt: now, updatedBy: userId } });
  }
}

export const siteSettingsRouter = router({
  /** Public: get pixel IDs for tracking */
  getPixelIds: publicProcedure.query(async () => {
    const [aaus, ihe, learn] = await Promise.all([
      getSetting("meta_pixel_aaus"),
      getSetting("meta_pixel_ihe"),
      getSetting("meta_pixel_learn"),
    ]);
    return { aaus, ihe, learn };
  }),

  /** Admin: update a pixel ID for a brand */
  updatePixelId: protectedProcedure
    .input(
      z.object({
        brand: z.enum(["aaus", "ihe", "learn"]),
        pixelId: z.string().max(64).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await upsertSetting(`meta_pixel_${input.brand}`, input.pixelId, ctx.user.id);
      return { success: true };
    }),

  /** Public: get site-level checkout terms defaults (used as fallback in all checkout flows) */
  getCheckoutTerms: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        termsText: "I have reviewed and agree to the",
        termsLink1Text: "Terms of Service",
        termsLink1Url: "",
        termsLink2Text: "Privacy Policy",
        termsLink2Url: "",
      };
    }
    const [row] = await db
      .select({
        checkoutTermsText: platformSettings.checkoutTermsText,
        checkoutTermsLinkText1: platformSettings.checkoutTermsLinkText1,
        checkoutTermsLinkUrl1: platformSettings.checkoutTermsLinkUrl1,
        checkoutTermsLinkText2: platformSettings.checkoutTermsLinkText2,
        checkoutTermsLinkUrl2: platformSettings.checkoutTermsLinkUrl2,
        termsUrl: platformSettings.termsUrl,
        privacyUrl: platformSettings.privacyUrl,
      })
      .from(platformSettings)
      .where(eq(platformSettings.id, 1))
      .limit(1);

    return {
      termsText: row?.checkoutTermsText ?? "I have reviewed and agree to the",
      termsLink1Text: row?.checkoutTermsLinkText1 ?? "Terms of Service",
      termsLink1Url: row?.checkoutTermsLinkUrl1 ?? row?.termsUrl ?? "",
      termsLink2Text: row?.checkoutTermsLinkText2 ?? "Privacy Policy",
      termsLink2Url: row?.checkoutTermsLinkUrl2 ?? row?.privacyUrl ?? "",
    };
  }),

  /** Admin: get CME auto-enroll email list */
  getCmeAutoEnrollEmails: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return { emails: ["don@cardioserv.net"] };
    const [row] = await db.select({ cmeAutoEnrollEmails: platformSettings.cmeAutoEnrollEmails }).from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    const emails: string[] = row?.cmeAutoEnrollEmails ? JSON.parse(row.cmeAutoEnrollEmails) : ["don@cardioserv.net"];
    return { emails };
  }),

  /** Admin: update CME auto-enroll email list */
  updateCmeAutoEnrollEmails: protectedProcedure
    .input(z.object({ emails: z.array(z.string().email()).min(0) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(platformSettings).values({ id: 1, cmeAutoEnrollEmails: JSON.stringify(input.emails) })
        .onDuplicateKeyUpdate({ set: { cmeAutoEnrollEmails: JSON.stringify(input.emails) } });
      return { success: true };
    }),

  /** Admin: update site-level checkout terms defaults */
  updateCheckoutTerms: protectedProcedure
    .input(
      z.object({
        termsText: z.string().max(1000).nullable(),
        termsLink1Text: z.string().max(255).nullable(),
        termsLink1Url: z.string().max(2048).nullable(),
        termsLink2Text: z.string().max(255).nullable(),
        termsLink2Url: z.string().max(2048).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .insert(platformSettings)
        .values({
          id: 1,
          checkoutTermsText: input.termsText ?? undefined,
          checkoutTermsLinkText1: input.termsLink1Text ?? undefined,
          checkoutTermsLinkUrl1: input.termsLink1Url ?? undefined,
          checkoutTermsLinkText2: input.termsLink2Text ?? undefined,
          checkoutTermsLinkUrl2: input.termsLink2Url ?? undefined,
        })
        .onDuplicateKeyUpdate({
          set: {
            checkoutTermsText: input.termsText ?? undefined,
            checkoutTermsLinkText1: input.termsLink1Text ?? undefined,
            checkoutTermsLinkUrl1: input.termsLink1Url ?? undefined,
            checkoutTermsLinkText2: input.termsLink2Text ?? undefined,
            checkoutTermsLinkUrl2: input.termsLink2Url ?? undefined,
          },
        });

      return { success: true };
    }),
});
