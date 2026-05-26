/**
 * bundleRouter.ts — Bundles: sell multiple items as one package
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, sql, asc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb } from "../db";
import {
  bundles, bundleItems, bundleEnrollments, users,
  lmsCourses, lmsEnrollments, lmsQuizzes,
} from "../../drizzle/schema";

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
async function assertAdmin(ctx: any) { if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" }); }
async function uniqueSlug(db: any, base: string) {
  let slug = base, i = 0;
  while (true) {
    const [ex] = await db.select({ id: bundles.id }).from(bundles).where(eq(bundles.slug, slug)).limit(1);
    if (!ex) return slug;
    slug = `${base}-${++i}`;
  }
}

export const bundlePublicRouter = router({
  list: publicProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().max(50).default(12), search: z.string().optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) return { bundles: [], total: 0 };
      const page = input?.page ?? 1, limit = input?.limit ?? 12, offset = (page-1)*limit;
      const conds: any[] = [eq(bundles.status, "published")];
      if (input?.search) conds.push(sql`${bundles.title} LIKE ${"%" + input.search + "%"}`);
      if (input?.brand) conds.push(eq(bundles.brand, input.brand));
      const [rows, cnt] = await Promise.all([
        db.select().from(bundles).where(and(...conds)).orderBy(desc(bundles.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(bundles).where(and(...conds)),
      ]);
      return { bundles: rows, total: cnt[0]?.count ?? 0 };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db.select().from(bundles).where(eq(bundles.slug, input.slug)).limit(1);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      const isAdmin = (ctx.user as any)?.role === "admin";
      if (bundle.status !== "published" && !input.preview && !isAdmin) throw new TRPCError({ code: "NOT_FOUND" });
      const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundle.id)).orderBy(asc(bundleItems.sortOrder));
      let isEnrolled = false;
      if ((ctx.user as any)?.id) {
        const [enr] = await db.select({ id: bundleEnrollments.id }).from(bundleEnrollments)
          .where(and(eq(bundleEnrollments.bundleId, bundle.id), eq(bundleEnrollments.userId, (ctx.user as any).id))).limit(1);
        isEnrolled = !!enr;
      }
      return { bundle, items, isEnrolled };
    }),
});

export const bundleLearnerRouter = router({
  enroll: protectedProcedure
    .input(z.object({ bundleId: z.number(), pricingOptionId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db.select().from(bundles).where(eq(bundles.id, input.bundleId)).limit(1);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      const [ex] = await db.select({ id: bundleEnrollments.id }).from(bundleEnrollments)
        .where(and(eq(bundleEnrollments.bundleId, input.bundleId), eq(bundleEnrollments.userId, ctx.user.id))).limit(1);
      if (!ex) {
        await db.insert(bundleEnrollments).values({ bundleId: input.bundleId, userId: ctx.user.id, pricingOptionId: input.pricingOptionId });
        // Auto-enroll in all contained courses
        const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, input.bundleId));
        for (const item of items) {
          if (item.itemType === "course") {
            const [courseEnr] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
              .where(and(eq(lmsEnrollments.courseId, item.itemId), eq(lmsEnrollments.userId, ctx.user.id))).limit(1);
            if (!courseEnr) {
              await db.insert(lmsEnrollments).values({ courseId: item.itemId, userId: ctx.user.id, source: "bundle" });
            }
          }
        }
      }
      return { success: true };
    }),

  myBundles: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); if (!db) return [];
    const enrollments = await db.select({ bundleId: bundleEnrollments.bundleId, enrolledAt: bundleEnrollments.enrolledAt })
      .from(bundleEnrollments).where(eq(bundleEnrollments.userId, ctx.user.id));
    if (!enrollments.length) return [];
    const bundleIds = enrollments.map(e => e.bundleId);
    const bundleRows = await db.select().from(bundles).where(sql`${bundles.id} IN (${bundleIds.join(",")})`);
    return bundleRows;
  }),
});

export const bundleAdminRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().default(1), pageSize: z.number().max(200).default(20), search: z.string().optional(), status: z.enum(["draft","published"]).optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return { bundles: [], total: 0 };
      const page = input?.page ?? 1, limit = input?.pageSize ?? 20, offset = (page-1)*limit;
      const conds: any[] = [];
      if (input?.search) conds.push(sql`${bundles.title} LIKE ${"%" + input.search + "%"}`);
      if (input?.status) conds.push(eq(bundles.status, input.status));
      if (input?.brand) conds.push(eq(bundles.brand, input.brand));
      const where = conds.length ? and(...conds) : undefined;
      const [rows, cnt] = await Promise.all([
        db.select().from(bundles).where(where).orderBy(desc(bundles.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(bundles).where(where),
      ]);
      return { bundles: rows, total: cnt[0]?.count ?? 0 };
    }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [bundle] = await db.select().from(bundles).where(eq(bundles.id, input.id)).limit(1);
    if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
    const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, input.id)).orderBy(asc(bundleItems.sortOrder));
    return { bundle, items };
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(255), brand: z.enum(["all_about_ultrasound","iheartecho"]).default("all_about_ultrasound"), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const slug = await uniqueSlug(db, slugify(input.title));
      const [ins] = await db.insert(bundles).values({ title: input.title, slug, brand: input.brand, description: input.description }).$returningId();
      return { id: ins.id, slug };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(), title: z.string().optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional(),
      status: z.enum(["draft","published"]).optional(), description: z.string().optional(),
      coverImage: z.string().optional(), accessType: z.enum(["free","paid"]).optional(),
      pricingOptions: z.string().optional(), landingPageBlocks: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      const upd: any = {};
      Object.entries(rest).forEach(([k, v]) => { if (v !== undefined) upd[k] = v; });
      if (Object.keys(upd).length) await db.update(bundles).set(upd).where(eq(bundles.id, id));
      return { success: true };
    }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(bundleItems).where(eq(bundleItems.bundleId, input.id));
    await db.delete(bundleEnrollments).where(eq(bundleEnrollments.bundleId, input.id));
    await db.delete(bundles).where(eq(bundles.id, input.id));
    return { success: true };
  }),

  addItem: protectedProcedure
    .input(z.object({ bundleId: z.number(), itemType: z.enum(["course","quiz","download","product","webinar"]), itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ex] = await db.select({ id: bundleItems.id }).from(bundleItems)
        .where(and(eq(bundleItems.bundleId, input.bundleId), eq(bundleItems.itemType, input.itemType), eq(bundleItems.itemId, input.itemId))).limit(1);
      if (!ex) {
        const [maxOrder] = await db.select({ max: sql<number>`MAX(sort_order)` }).from(bundleItems).where(eq(bundleItems.bundleId, input.bundleId));
        await db.insert(bundleItems).values({ bundleId: input.bundleId, itemType: input.itemType, itemId: input.itemId, sortOrder: (maxOrder?.max ?? 0) + 1 });
      }
      return { success: true };
    }),

  removeItem: protectedProcedure.input(z.object({ itemId: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(bundleItems).where(eq(bundleItems.id, input.itemId));
    return { success: true };
  }),

  reorderItems: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number(), sortOrder: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (const item of input.items) await db.update(bundleItems).set({ sortOrder: item.sortOrder }).where(eq(bundleItems.id, item.id));
      return { success: true };
    }),

  getEnrollments: protectedProcedure
    .input(z.object({ bundleId: z.number(), page: z.number().default(1), pageSize: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return { enrollments: [], total: 0 };
      const offset = (input.page-1)*input.pageSize;
      const [rows, cnt] = await Promise.all([
        db.select({ id: bundleEnrollments.id, userId: bundleEnrollments.userId, enrolledAt: bundleEnrollments.enrolledAt, userName: users.name, userEmail: users.email })
          .from(bundleEnrollments).leftJoin(users, eq(bundleEnrollments.userId, users.id))
          .where(eq(bundleEnrollments.bundleId, input.bundleId)).orderBy(desc(bundleEnrollments.enrolledAt)).limit(input.pageSize).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(bundleEnrollments).where(eq(bundleEnrollments.bundleId, input.bundleId)),
      ]);
      return { enrollments: rows, total: cnt[0]?.count ?? 0 };
    }),
});
