import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getUserRoles } from "../db";
import { quizCardLibrary } from "../../drizzle/schema";

const brandSchema = z.enum(["aaus", "iheartecho"]);
const templateSchema = z.enum(["clinical-white", "clinical-aqua", "clinical-teal", "clinical-dark"]);
const variantSchema = z.enum(["question", "answer", "combined"]);
const mediaSchema = z.object({ kind: z.enum(["image", "video", "none"]), url: z.string().url().optional() });

const platformAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role === "admin") return next();
  const roles = await getUserRoles(ctx.user.id);
  if (roles.includes("platform_admin") || roles.includes("platform_owner")) return next();
  throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
});

function activeRow(id: number) {
  return and(eq(quizCardLibrary.id, id), isNull(quizCardLibrary.deletedAt));
}

/** Durable, shared Platform Admin Quiz Card presentation snapshots. */
export const quizCardLibraryRouter = router({
  list: platformAdminProcedure
    .input(z.object({ brand: brandSchema.optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [isNull(quizCardLibrary.deletedAt)];
      if (input?.brand) conditions.push(eq(quizCardLibrary.brand, input.brand));
      return db.select().from(quizCardLibrary).where(and(...conditions)).orderBy(desc(quizCardLibrary.updatedAt), desc(quizCardLibrary.id));
    }),

  save: platformAdminProcedure
    .input(z.object({
      brand: brandSchema,
      questionBankId: z.number().int().positive().optional(),
      questionSnapshot: z.record(z.string(), z.any()),
      cardTemplate: templateSchema,
      cardVariant: variantSchema,
      media: mediaSchema,
      sourceFolderLabel: z.string().trim().max(255).optional(),
      customCardLabel: z.string().trim().max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const inserted = await db.insert(quizCardLibrary).values({
        brand: input.brand,
        questionBankId: input.questionBankId ?? null,
        questionSnapshot: input.questionSnapshot,
        cardTemplate: input.cardTemplate,
        cardVariant: input.cardVariant,
        mediaKind: input.media.kind,
        mediaUrl: input.media.kind === "none" ? null : input.media.url ?? null,
        sourceFolderLabel: input.sourceFolderLabel || null,
        customCardLabel: input.customCardLabel || null,
        createdByUserId: ctx.user.id,
      }).$returningId();
      const id = Number(inserted[0]?.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Quiz Card Library save did not return a record ID. Please try again.",
        });
      }

      const [saved] = await db
        .select({ id: quizCardLibrary.id })
        .from(quizCardLibrary)
        .where(eq(quizCardLibrary.id, id))
        .limit(1);
      if (!saved) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Quiz Card Library save could not be verified. Please try again.",
        });
      }

      return { id: saved.id };
    }),

  publish: platformAdminProcedure
    .input(z.object({ id: z.number().int().positive(), published: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(quizCardLibrary).set(input.published
        ? { status: "published", publishedAt: new Date(), publishedByUserId: ctx.user.id }
        : { status: "draft", publishedAt: null, publishedByUserId: null },
      ).where(activeRow(input.id));
      return { success: true };
    }),

  flag: platformAdminProcedure
    .input(z.object({ id: z.number().int().positive(), comment: z.string().trim().min(1).max(2_000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(quizCardLibrary).set({ flaggedAt: new Date(), flaggedByUserId: ctx.user.id, flagComment: input.comment, flagResolvedAt: null }).where(activeRow(input.id));
      return { success: true };
    }),

  resolveFlag: platformAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(quizCardLibrary).set({ flagResolvedAt: new Date() }).where(activeRow(input.id));
      return { success: true };
    }),

  delete: platformAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(quizCardLibrary).set({ deletedAt: new Date(), deletedByUserId: ctx.user.id }).where(activeRow(input.id));
      return { success: true };
    }),
});
