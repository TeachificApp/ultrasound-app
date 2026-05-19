import { z } from "zod";
import { eq, desc, like, or, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { blockTemplates } from "../../drizzle/schema";

export const blockTemplatesRouter = router({
  /** List all saved block templates, optionally filtered by search query */
  list: protectedProcedure
    .input(z.object({ search: z.string().optional(), blockType: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.blockType) {
        conditions.push(eq(blockTemplates.blockType, input.blockType));
      }
      if (input.search && input.search.trim()) {
        const q = `%${input.search.trim()}%`;
        conditions.push(or(like(blockTemplates.name, q), like(blockTemplates.tags, q), like(blockTemplates.blockType, q)));
      }

      const rows = conditions.length > 0
        ? await db.select().from(blockTemplates).where(conditions.length === 1 ? conditions[0] : and(...conditions)).orderBy(desc(blockTemplates.createdAt))
        : await db.select().from(blockTemplates).orderBy(desc(blockTemplates.createdAt));

      return rows;
    }),

  /** Save a block as a template */
  save: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      blockType: z.string().min(1).max(80),
      blockData: z.record(z.any()),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [inserted] = await db.insert(blockTemplates).values({
        name: input.name,
        description: input.description ?? null,
        blockType: input.blockType,
        blockData: JSON.stringify(input.blockData),
        tags: input.tags ?? null,
        createdByUserId: ctx.user.id,
      });

      return { id: (inserted as any).insertId };
    }),

  /** Delete a saved template */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db.select().from(blockTemplates).where(eq(blockTemplates.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.createdByUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.delete(blockTemplates).where(eq(blockTemplates.id, input.id));
      return { success: true };
    }),

  /** Update a template's name/description/tags */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db.select().from(blockTemplates).where(eq(blockTemplates.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.createdByUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const updates: Partial<typeof blockTemplates.$inferInsert> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.tags !== undefined) updates.tags = input.tags;

      await db.update(blockTemplates).set(updates).where(eq(blockTemplates.id, input.id));
      return { success: true };
    }),
});
