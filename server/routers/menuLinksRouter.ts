/**
 * menuLinksRouter — manage the three "Learn" sidebar link URLs
 * Keys stored in appSettings: learnFetalEchoUrl | learnEchoUrl | learnPocusUrl
 */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { appSettings } from "../../drizzle/schema";
import { inArray } from "drizzle-orm";

const LEARN_KEYS = ["learnFetalEchoUrl", "learnEchoUrl", "learnPocusUrl"] as const;
type LearnKey = (typeof LEARN_KEYS)[number];

const DEFAULTS: Record<LearnKey, string> = {
  learnFetalEchoUrl: "https://www.allaboutultrasound.net/fetal-echo-preview-access-pass",
  learnEchoUrl: "",
  learnPocusUrl: "",
};

async function getLearnLinks() {
  const db = await getDb();
  if (!db) return { learnFetalEchoUrl: DEFAULTS.learnFetalEchoUrl, learnEchoUrl: DEFAULTS.learnEchoUrl, learnPocusUrl: DEFAULTS.learnPocusUrl };
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [...LEARN_KEYS]));

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  return {
    learnFetalEchoUrl: map["learnFetalEchoUrl"] ?? DEFAULTS.learnFetalEchoUrl,
    learnEchoUrl: map["learnEchoUrl"] ?? DEFAULTS.learnEchoUrl,
    learnPocusUrl: map["learnPocusUrl"] ?? DEFAULTS.learnPocusUrl,
  };
}

export const menuLinksRouter = router({
  /** Public — used by the sidebar to fetch current URLs */
  getLearnLinks: publicProcedure.query(async () => {
    return getLearnLinks();
  }),

  /** Admin-only — update one or more Learn link URLs */
  updateLearnLinks: protectedProcedure
    .input(
      z.object({
        learnFetalEchoUrl: z.string().url().or(z.literal("")).optional(),
        learnEchoUrl: z.string().url().or(z.literal("")).optional(),
        learnPocusUrl: z.string().url().or(z.literal("")).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only platform admins / owners may update
      const isAdmin = (ctx.user as any)?.role === "admin";
      const appRoles: string[] = (ctx.user as any)?.appRoles ?? [];
      if (!isAdmin && !appRoles.includes("platform_admin")) {
        throw new Error("Forbidden");
      }

      const updates: { key: string; value: string }[] = [];
      if (input.learnFetalEchoUrl !== undefined)
        updates.push({ key: "learnFetalEchoUrl", value: input.learnFetalEchoUrl });
      if (input.learnEchoUrl !== undefined)
        updates.push({ key: "learnEchoUrl", value: input.learnEchoUrl });
      if (input.learnPocusUrl !== undefined)
        updates.push({ key: "learnPocusUrl", value: input.learnPocusUrl });

      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      for (const { key, value } of updates) {
        await db
          .insert(appSettings)
          .values({ key, value })
          .onDuplicateKeyUpdate({ set: { value } });
      }

      return getLearnLinks();
    }),
});
