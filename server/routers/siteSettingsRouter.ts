import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { siteSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const ALLOWED_KEYS = [
  "meta_pixel_id_aaus",
  "meta_pixel_id_ihe",
  "meta_pixel_id_learn",
] as const;

type SettingKey = (typeof ALLOWED_KEYS)[number];

async function getSetting(key: SettingKey): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ settingValue: siteSettings.settingValue })
    .from(siteSettings)
    .where(eq(siteSettings.settingKey, key))
    .limit(1);
  return row?.settingValue ?? null;
}

async function upsertSetting(key: SettingKey, value: string | null, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(siteSettings)
    .values({ settingKey: key, settingValue: value, updatedAt: Date.now(), updatedBy: userId })
    .onDuplicateKeyUpdate({
      set: { settingValue: value, updatedAt: Date.now(), updatedBy: userId },
    });
}

export const siteSettingsRouter = router({
  /** Public: fetch all pixel IDs so the frontend can inject the right one */
  getPixelIds: publicProcedure.query(async () => {
    const [aaus, ihe, learn] = await Promise.all([
      getSetting("meta_pixel_id_aaus"),
      getSetting("meta_pixel_id_ihe"),
      getSetting("meta_pixel_id_learn"),
    ]);
    return { aaus, ihe, learn };
  }),

  /** Admin: update a single pixel ID (pass null to clear) */
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
      const key = `meta_pixel_id_${input.brand}` as SettingKey;
      await upsertSetting(key, input.pixelId || null, ctx.user.id);
      return { success: true };
    }),
});
