/**
 * Navigator Admin Router
 * Procedures:
 *   listSections(module)                 — list all sections for a module (DB overrides, or empty)
 *   upsertSection(input)                 — create or update a section (probe + items JSON)
 *   deleteSection(id)                    — delete a section override row
 *   reorderSections(module, orderedIds)  — update sortOrder for all sections in a module
 *   listModules()                        — return all known navigator module keys
 */
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { navigatorOverrides } from "../../drizzle/schema";

async function assertPlatformAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
}

// All navigator module keys
export const NAVIGATOR_MODULES = [
  "abdominal",
  "abdominal_vascular",
  "aorta",
  "arterial",
  "breast",
  "carotid",
  "fetal",
  "msk",
  "ob1",
  "ob23",
  "pelvic_gyn",
  "pocus_cardiac",
  "pocus_efast",
  "pocus_lung",
  "pocus_rush",
  "scrotum",
  "tcd",
  "thyroid",
  "venous",
] as const;

export type NavigatorModule = (typeof NAVIGATOR_MODULES)[number];
export const NAVIGATOR_MODULE_VALUES = NAVIGATOR_MODULES as unknown as [string, ...string[]];

const ChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string().optional().default(""),
  critical: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

export const navigatorAdminRouter = router({
  /**
   * List all section overrides for a given navigator module.
   * Returns an empty array if no overrides exist yet.
   */
  listSections: publicProcedure
    .input(z.object({ module: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(navigatorOverrides)
        .where(eq(navigatorOverrides.module, input.module))
        .orderBy(navigatorOverrides.sortOrder, navigatorOverrides.id);
      return rows.map((r) => ({
        id: r.id,
        module: r.module,
        sectionName: r.sectionName,
        probe: r.probe ?? "",
        items: r.items ? (JSON.parse(r.items) as z.infer<typeof ChecklistItemSchema>[]) : [],
        sortOrder: r.sortOrder ?? 0,
        updatedAt: r.updatedAt,
      }));
    }),

  /**
   * Create or update a section for a module.
   * If a row with (module, sectionName) already exists, it is updated.
   */
  upsertSection: protectedProcedure
    .input(
      z.object({
        module: z.string().min(1).max(64),
        sectionName: z.string().min(1).max(128),
        probe: z.string().optional().default(""),
        items: z.array(ChecklistItemSchema),
        sortOrder: z.number().int().optional().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const itemsJson = JSON.stringify(
        input.items.map((item, idx) => ({ ...item, sortOrder: item.sortOrder ?? idx }))
      );

      const existing = await db
        .select({ id: navigatorOverrides.id })
        .from(navigatorOverrides)
        .where(
          and(
            eq(navigatorOverrides.module, input.module),
            eq(navigatorOverrides.sectionName, input.sectionName)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(navigatorOverrides)
          .set({
            probe: input.probe,
            items: itemsJson,
            sortOrder: input.sortOrder,
            updatedByUserId: ctx.user.id,
          })
          .where(eq(navigatorOverrides.id, existing[0].id));
        return { id: existing[0].id, created: false };
      } else {
        const [result] = await db.insert(navigatorOverrides).values({
          module: input.module,
          sectionName: input.sectionName,
          probe: input.probe,
          items: itemsJson,
          sortOrder: input.sortOrder,
          updatedByUserId: ctx.user.id,
        });
        return { id: (result as any).insertId as number, created: true };
      }
    }),

  /**
   * Delete a section override row by ID.
   */
  deleteSection: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(navigatorOverrides).where(eq(navigatorOverrides.id, input.id));
      return { deleted: true };
    }),

  /**
   * Bulk-update sortOrder for all sections in a module.
   * orderedIds: section IDs in the desired display order.
   */
  reorderSections: protectedProcedure
    .input(
      z.object({
        module: z.string().min(1).max(64),
        orderedIds: z.array(z.number().int().positive()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      for (let i = 0; i < input.orderedIds.length; i++) {
        await db
          .update(navigatorOverrides)
          .set({ sortOrder: i, updatedByUserId: ctx.user.id })
          .where(
            and(
              eq(navigatorOverrides.id, input.orderedIds[i]),
              eq(navigatorOverrides.module, input.module)
            )
          );
      }
      return { reordered: input.orderedIds.length };
    }),

  /**
   * Return all known navigator module keys with display labels.
   */
  listModules: publicProcedure.query(() => {
    return [
      { key: "abdominal",         label: "Abdominal Ultrasound" },
      { key: "abdominal_vascular",label: "Abdominal Vascular (Liver/Mesenteric/Renal)" },
      { key: "aorta",             label: "Aorta" },
      { key: "arterial",          label: "Peripheral Arterial" },
      { key: "breast",            label: "Breast" },
      { key: "carotid",           label: "Extracranial Carotid / Subclavian" },
      { key: "fetal",             label: "Fetal Echo" },
      { key: "msk",               label: "MSK Ultrasound" },
      { key: "ob1",               label: "OB 1st Trimester" },
      { key: "ob23",              label: "OB 2nd/3rd Trimester" },
      { key: "pelvic_gyn",        label: "Pelvic / Gynecologic" },
      { key: "pocus_cardiac",     label: "POCUS Cardiac" },
      { key: "pocus_efast",       label: "POCUS eFAST" },
      { key: "pocus_lung",        label: "POCUS Lung" },
      { key: "pocus_rush",        label: "POCUS RUSH" },
      { key: "scrotum",           label: "Scrotum / Testicular" },
      { key: "tcd",               label: "Intracranial TCD" },
      { key: "thyroid",           label: "Thyroid / Parathyroid" },
      { key: "venous",            label: "Peripheral Venous" },
    ];
  }),
});
