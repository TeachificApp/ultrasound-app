/**
 * webinarRouter.ts — Live & prerecorded webinars with discussions
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, sql, asc, isNull } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb } from "../db";
import {
  webinars, webinarRegistrations, webinarComments, users,
} from "../../drizzle/schema";

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
async function assertAdmin(ctx: any) { if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" }); }
async function uniqueSlug(db: any, base: string) {
  let slug = base, i = 0;
  while (true) {
    const [ex] = await db.select({ id: webinars.id }).from(webinars).where(eq(webinars.slug, slug)).limit(1);
    if (!ex) return slug;
    slug = `${base}-${++i}`;
  }
}

export const webinarPublicRouter = router({
  list: publicProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().max(50).default(12), search: z.string().optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional(), type: z.enum(["live","prerecorded"]).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) return { webinars: [], total: 0 };
      const page = input?.page ?? 1, limit = input?.limit ?? 12, offset = (page-1)*limit;
      const conds: any[] = [eq(webinars.status, "published")];
      if (input?.search) conds.push(sql`${webinars.title} LIKE ${"%" + input.search + "%"}`);
      if (input?.brand) conds.push(eq(webinars.brand, input.brand));
      if (input?.type) conds.push(eq(webinars.type, input.type));
      const [rows, cnt] = await Promise.all([
        db.select().from(webinars).where(and(...conds)).orderBy(desc(webinars.scheduledAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(webinars).where(and(...conds)),
      ]);
      return { webinars: rows, total: cnt[0]?.count ?? 0 };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [w] = await db.select().from(webinars).where(eq(webinars.slug, input.slug)).limit(1);
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      const isAdmin = (ctx.user as any)?.role === "admin";
      if (w.status !== "published" && !input.preview && !isAdmin) throw new TRPCError({ code: "NOT_FOUND" });
      let isRegistered = false;
      if ((ctx.user as any)?.id) {
        const [reg] = await db.select({ id: webinarRegistrations.id }).from(webinarRegistrations)
          .where(and(eq(webinarRegistrations.webinarId, w.id), eq(webinarRegistrations.userId, (ctx.user as any).id))).limit(1);
        isRegistered = !!reg;
      }
      return { webinar: w, isRegistered };
    }),
});

export const webinarLearnerRouter = router({
  register: protectedProcedure
    .input(z.object({ webinarId: z.number(), pricingOptionId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ex] = await db.select({ id: webinarRegistrations.id }).from(webinarRegistrations)
        .where(and(eq(webinarRegistrations.webinarId, input.webinarId), eq(webinarRegistrations.userId, ctx.user.id))).limit(1);
      if (!ex) await db.insert(webinarRegistrations).values({ webinarId: input.webinarId, userId: ctx.user.id, pricingOptionId: input.pricingOptionId });
      return { success: true };
    }),

  markAttended: protectedProcedure.input(z.object({ webinarId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(webinarRegistrations).set({ attendedAt: new Date() }).where(and(eq(webinarRegistrations.webinarId, input.webinarId), eq(webinarRegistrations.userId, ctx.user.id)));
    return { success: true };
  }),

  markWatchedReplay: protectedProcedure.input(z.object({ webinarId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(webinarRegistrations).set({ watchedReplayAt: new Date() }).where(and(eq(webinarRegistrations.webinarId, input.webinarId), eq(webinarRegistrations.userId, ctx.user.id)));
    return { success: true };
  }),

  addComment: protectedProcedure
    .input(z.object({ webinarId: z.number(), body: z.string().min(1).max(5000), parentId: z.number().optional(), isLive: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ins] = await db.insert(webinarComments).values({ webinarId: input.webinarId, userId: ctx.user.id, body: input.body, parentId: input.parentId, isLive: input.isLive ?? false }).$returningId();
      return { id: ins.id };
    }),

  listComments: publicProcedure
    .input(z.object({ webinarId: z.number(), isLive: z.boolean().optional() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) return [];
      const conds: any[] = [eq(webinarComments.webinarId, input.webinarId), isNull(webinarComments.parentId)];
      if (input.isLive !== undefined) conds.push(eq(webinarComments.isLive, input.isLive));
      return db.select({ id: webinarComments.id, body: webinarComments.body, parentId: webinarComments.parentId, isLive: webinarComments.isLive, createdAt: webinarComments.createdAt, userId: webinarComments.userId, userName: users.name, userAvatar: users.avatarUrl })
        .from(webinarComments).leftJoin(users, eq(webinarComments.userId, users.id)).where(and(...conds)).orderBy(asc(webinarComments.createdAt));
    }),

  deleteComment: protectedProcedure.input(z.object({ commentId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [c] = await db.select().from(webinarComments).where(eq(webinarComments.id, input.commentId)).limit(1);
    if (!c) throw new TRPCError({ code: "NOT_FOUND" });
    if (c.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    await db.delete(webinarComments).where(eq(webinarComments.id, input.commentId));
    return { success: true };
  }),
});

export const webinarAdminRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().default(1), pageSize: z.number().max(200).default(20), search: z.string().optional(), status: z.enum(["draft","published","ended"]).optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return { webinars: [], total: 0 };
      const page = input?.page ?? 1, limit = input?.pageSize ?? 20, offset = (page-1)*limit;
      const conds: any[] = [];
      if (input?.search) conds.push(sql`${webinars.title} LIKE ${"%" + input.search + "%"}`);
      if (input?.status) conds.push(eq(webinars.status, input.status));
      if (input?.brand) conds.push(eq(webinars.brand, input.brand));
      const where = conds.length ? and(...conds) : undefined;
      const [rows, cnt] = await Promise.all([
        db.select().from(webinars).where(where).orderBy(desc(webinars.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(webinars).where(where),
      ]);
      return { webinars: rows, total: cnt[0]?.count ?? 0 };
    }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [w] = await db.select().from(webinars).where(eq(webinars.id, input.id)).limit(1);
    if (!w) throw new TRPCError({ code: "NOT_FOUND" }); return w;
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(255), brand: z.enum(["all_about_ultrasound","iheartecho"]).default("all_about_ultrasound"), type: z.enum(["live","prerecorded"]).default("live"), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const slug = await uniqueSlug(db, slugify(input.title));
      const [ins] = await db.insert(webinars).values({ title: input.title, slug, brand: input.brand, type: input.type, description: input.description }).$returningId();
      return { id: ins.id, slug };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(), title: z.string().optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional(),
      type: z.enum(["live","prerecorded"]).optional(), status: z.enum(["draft","published","ended"]).optional(),
      description: z.string().optional(), coverImage: z.string().optional(), scheduledAt: z.number().optional(),
      durationMinutes: z.number().optional(), meetingUrl: z.string().optional(), replayUrl: z.string().optional(),
      replayEnabled: z.boolean().optional(), accessType: z.enum(["free","paid"]).optional(),
      pricingOptions: z.string().optional(), landingPageBlocks: z.string().optional(),
      hostName: z.string().optional(), hostTitle: z.string().optional(), hostAvatar: z.string().optional(), maxAttendees: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      const upd: any = {};
      Object.entries(rest).forEach(([k, v]) => { if (v !== undefined) upd[k] = v; });
      if (Object.keys(upd).length) await db.update(webinars).set(upd).where(eq(webinars.id, id));
      return { success: true };
    }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(webinarRegistrations).where(eq(webinarRegistrations.webinarId, input.id));
    await db.delete(webinarComments).where(eq(webinarComments.webinarId, input.id));
    await db.delete(webinars).where(eq(webinars.id, input.id));
    return { success: true };
  }),

  getRegistrations: protectedProcedure
    .input(z.object({ webinarId: z.number(), page: z.number().default(1), pageSize: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return { registrations: [], total: 0 };
      const offset = (input.page-1)*input.pageSize;
      const [rows, cnt] = await Promise.all([
        db.select({ id: webinarRegistrations.id, userId: webinarRegistrations.userId, registeredAt: webinarRegistrations.registeredAt, attendedAt: webinarRegistrations.attendedAt, watchedReplayAt: webinarRegistrations.watchedReplayAt, userName: users.name, userEmail: users.email })
          .from(webinarRegistrations).leftJoin(users, eq(webinarRegistrations.userId, users.id))
          .where(eq(webinarRegistrations.webinarId, input.webinarId)).orderBy(desc(webinarRegistrations.registeredAt)).limit(input.pageSize).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(webinarRegistrations).where(eq(webinarRegistrations.webinarId, input.webinarId)),
      ]);
      return { registrations: rows, total: cnt[0]?.count ?? 0 };
    }),
});
