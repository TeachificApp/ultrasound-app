import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { lmsInterests, userInterests, users } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

function assertAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const interestsRouter = router({
  /** Get all active interests, filtered by brand context */
  getInterests: publicProcedure
    .input(z.object({
      brand: z.enum(["aaus", "iheartecho", "both"]).optional().default("both"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(lmsInterests)
        .where(
          and(
            eq(lmsInterests.isActive, true),
            input.brand === "both"
              ? undefined
              : or(
                  eq(lmsInterests.brandFilter, input.brand),
                  eq(lmsInterests.brandFilter, "both")
                )
          )
        )
        .orderBy(asc(lmsInterests.sortOrder), asc(lmsInterests.name));

      return rows;
    }),

  /** Get all interests (including inactive) for admin management */
  adminGetAllInterests: protectedProcedure
    .query(async ({ ctx }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return db
        .select()
        .from(lmsInterests)
        .orderBy(asc(lmsInterests.sortOrder), asc(lmsInterests.name));
    }),

  /** Create a new interest */
  adminCreateInterest: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(100),
      category: z.enum(["general", "echo", "both"]).default("general"),
      brandFilter: z.enum(["aaus", "iheartecho", "both"]).default("both"),
      iconEmoji: z.string().max(10).optional(),
      sortOrder: z.number().int().default(0),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result] = await db.insert(lmsInterests).values({
        name: input.name,
        slug: input.slug,
        category: input.category,
        brandFilter: input.brandFilter,
        iconEmoji: input.iconEmoji ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      }).$returningId();

      return { id: result.id };
    }),

  /** Update an interest */
  adminUpdateInterest: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().min(1).max(100).optional(),
      slug: z.string().min(1).max(100).optional(),
      category: z.enum(["general", "echo", "both"]).optional(),
      brandFilter: z.enum(["aaus", "iheartecho", "both"]).optional(),
      iconEmoji: z.string().max(10).nullable().optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...updates } = input;
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined)
      );
      if (Object.keys(filtered).length === 0) return { success: true };

      await db.update(lmsInterests).set(filtered).where(eq(lmsInterests.id, id));
      return { success: true };
    }),

  /** Delete an interest */
  adminDeleteInterest: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Remove all user associations first
      await db.delete(userInterests).where(eq(userInterests.interestId, input.id));
      await db.delete(lmsInterests).where(eq(lmsInterests.id, input.id));
      return { success: true };
    }),

  /** Reorder interests (admin) */
  adminReorderInterests: protectedProcedure
    .input(z.object({
      orderedIds: z.array(z.number().int()),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      for (let i = 0; i < input.orderedIds.length; i++) {
        await db.update(lmsInterests)
          .set({ sortOrder: i + 1 })
          .where(eq(lmsInterests.id, input.orderedIds[i]));
      }
      return { success: true };
    }),

  /** Get current user's selected interests */
  getMyInterests: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({
          id: lmsInterests.id,
          name: lmsInterests.name,
          slug: lmsInterests.slug,
          category: lmsInterests.category,
          brandFilter: lmsInterests.brandFilter,
          iconEmoji: lmsInterests.iconEmoji,
          sortOrder: lmsInterests.sortOrder,
        })
        .from(userInterests)
        .innerJoin(lmsInterests, eq(userInterests.interestId, lmsInterests.id))
        .where(eq(userInterests.userId, ctx.user.id))
        .orderBy(asc(lmsInterests.sortOrder));

      return rows;
    }),

  /** Update current user's selected interests (replace all) */
  updateMyInterests: protectedProcedure
    .input(z.object({
      interestIds: z.array(z.number().int()),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Delete all existing interests for this user
      await db.delete(userInterests).where(eq(userInterests.userId, ctx.user.id));

      // Insert new interests
      if (input.interestIds.length > 0) {
        await db.insert(userInterests).values(
          input.interestIds.map(interestId => ({
            userId: ctx.user.id,
            interestId,
          }))
        );
      }

      return { success: true };
    }),

  /** Get a specific user's interests (for community profile) */
  getUserInterests: publicProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({
          id: lmsInterests.id,
          name: lmsInterests.name,
          slug: lmsInterests.slug,
          category: lmsInterests.category,
          brandFilter: lmsInterests.brandFilter,
          iconEmoji: lmsInterests.iconEmoji,
        })
        .from(userInterests)
        .innerJoin(lmsInterests, eq(userInterests.interestId, lmsInterests.id))
        .where(
          and(
            eq(userInterests.userId, input.userId),
            eq(lmsInterests.isActive, true)
          )
        )
        .orderBy(asc(lmsInterests.sortOrder));

      return rows;
    }),

  /** Set community role for a user (admin only) */
  setCommunityRole: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      communityRole: z.enum(["member", "moderator", "admin"]),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(users)
        .set({ communityRole: input.communityRole })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),
});
