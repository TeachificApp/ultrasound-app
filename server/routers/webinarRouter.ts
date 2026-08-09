import { getStripeClient } from "../lib/stripeClient";
import { resolveCheckoutTerms } from "./checkoutTermsHelper";
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
  webinars, webinarRegistrations, webinarComments, webinarSessions, webinarFunnelSteps, users, cmeActivityForms,
} from "../../drizzle/schema";
import { nanoid } from "nanoid";

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
async function assertAdmin(ctx: any) { if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" }); }

/** Checkout page config is stored in salesPageBlocksJson (no dedicated schema column). */
function webinarCheckoutConfigToString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

type WebinarPricingOption = { id?: string; price?: number; label?: string; type?: string };

function parseWebinarPricingOptions(raw: string | null): WebinarPricingOption[] {
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

function resolveWebinarPricing(
  webinar: { accessType: string; pricingOptions: string | null },
  pricingOptionId?: string,
) {
  if (webinar.accessType === "free") {
    return { isFree: true, priceCents: 0, selectedOption: null as WebinarPricingOption | null };
  }
  const options = parseWebinarPricingOptions(webinar.pricingOptions);
  const selected = pricingOptionId
    ? options.find(p => p.id === pricingOptionId)
    : options[0];
  if (!selected && options.length === 0) {
    return { isFree: true, priceCents: 0, selectedOption: null as WebinarPricingOption | null };
  }
  const priceCents = Math.round(Number(selected?.price ?? 0) * 100);
  return { isFree: priceCents <= 0, priceCents, selectedOption: selected ?? null };
}
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
    .input(z.object({ page: z.number().default(1), pageSize: z.number().max(200).default(20), search: z.string().optional(), status: z.enum(["draft","published","ended","enrollment_closed"]).optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return { webinars: [], total: 0 };
      const page = input?.page ?? 1, limit = input?.pageSize ?? 20, offset = (page-1)*limit;
      const conds: any[] = [];
      if (input?.search) conds.push(sql`${webinars.title} LIKE ${"%" + input.search + "%"}`);
      if (input?.status) conds.push(eq(webinars.status, input.status));
      if (input?.brand) conds.push(eq(webinars.brand, input.brand));
      const where = conds.length ? and(...conds) : undefined;
      const [rows, cnt] = await Promise.all([
        db.select({
          id: webinars.id, slug: webinars.slug, title: webinars.title, brand: webinars.brand,
          type: webinars.type, status: webinars.status, scheduledAt: webinars.scheduledAt,
          durationMinutes: webinars.durationMinutes, accessType: webinars.accessType,
          price: webinars.price, thumbnailUrl: webinars.thumbnailUrl, coverImage: webinars.coverImage,
          hasCertificate: webinars.hasCertificate, creditHours: webinars.creditHours,
          createdAt: webinars.createdAt, updatedAt: webinars.updatedAt,
          cmeStatus: cmeActivityForms.cmeStatus,
          libraryOrder: webinars.libraryOrder,
        }).from(webinars).leftJoin(cmeActivityForms, eq(cmeActivityForms.courseId, webinars.id)).where(where).orderBy(asc(webinars.libraryOrder), desc(webinars.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(webinars).where(where),
      ]);
      return { webinars: rows, total: cnt[0]?.count ?? 0 };
    }),

  reorder: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number(), libraryOrder: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.items.map(item =>
        db.update(webinars).set({ libraryOrder: item.libraryOrder }).where(eq(webinars.id, item.id))
      ));
      return { success: true };
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
      type: z.enum(["live","prerecorded"]).optional(), status: z.enum(["draft","published","ended","enrollment_closed"]).optional(),
      description: z.string().optional(), coverImage: z.string().optional(), thumbnailUrl: z.string().optional(),
      scheduledAt: z.number().optional(), durationMinutes: z.number().optional(), timezone: z.string().optional(),
      meetingUrl: z.string().optional(), meetingId: z.string().optional(), replayUrl: z.string().optional(),
      replayEnabled: z.boolean().optional(), replayDelayMinutes: z.number().optional(),
      videoSource: z.enum(["upload","youtube","vimeo","zoom","teams","embed"]).optional(),
      videoUrl: z.string().optional(), videoFileUrl: z.string().optional(), videoFileKey: z.string().optional(),
      accessType: z.enum(["free","paid","restricted"]).optional(),
      pricingOptions: z.string().optional(), landingPageBlocks: z.string().optional(),
      // Structured pricing fields
      pricingType: z.enum(["free","one_time","subscription","payment_plan","trial_then_subscription"]).optional(),
      price: z.number().optional(),
      isFree: z.boolean().optional(),
      subscriptionInterval: z.enum(["monthly","quarterly","annual"]).nullable().optional(),
      trialDays: z.number().nullable().optional(),
      downPayment: z.number().nullable().optional(),
      installmentCount: z.number().nullable().optional(),
      installmentAmount: z.number().nullable().optional(),
      installmentIntervalDays: z.number().nullable().optional(),
      hostName: z.string().optional(), hostTitle: z.string().optional(), hostAvatar: z.string().optional(), maxAttendees: z.number().optional(),
      requireRegistration: z.boolean().optional(), registrationFormFields: z.any().optional(),
      aiViewersEnabled: z.boolean().optional(), aiViewersMin: z.number().optional(), aiViewersMax: z.number().optional(), aiViewersPeakAt: z.number().optional(),
      postWebinarAction: z.enum(["product","url","thankyou","none"]).optional(),
      postWebinarProductId: z.number().optional(), postWebinarUrl: z.string().optional(),
      postWebinarMessage: z.string().optional(), postWebinarDelaySeconds: z.number().optional(),
      sortOrder: z.number().optional(), iconImage: z.string().optional(), linkedAccessItems: z.string().optional(),
      publishDomain: z.string().optional(),
      playerPageBlocks: z.string().optional(),
      subtitle: z.string().optional(),
      slug: z.string().optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      purchaseTermsText: z.string().max(2000).nullable().optional(),
      purchaseTermsLinkText1: z.string().max(255).nullable().optional(),
      purchaseTermsLinkUrl1: z.string().max(2048).nullable().optional(),
      purchaseTermsLinkText2: z.string().max(255).nullable().optional(),
      purchaseTermsLinkUrl2: z.string().max(2048).nullable().optional(),
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
        db.select({ id: webinarRegistrations.id, userId: webinarRegistrations.userId, registeredAt: webinarRegistrations.registeredAt, attendedAt: webinarRegistrations.attendedAt, watchedReplayAt: webinarRegistrations.watchedReplayAt, attended: webinarRegistrations.attended, watchedSeconds: webinarRegistrations.watchedSeconds, convertedAt: webinarRegistrations.convertedAt, firstName: webinarRegistrations.firstName, lastName: webinarRegistrations.lastName, email: webinarRegistrations.email, userName: users.name, userEmail: users.email })
          .from(webinarRegistrations).leftJoin(users, eq(webinarRegistrations.userId, users.id))
          .where(eq(webinarRegistrations.webinarId, input.webinarId)).orderBy(desc(webinarRegistrations.registeredAt)).limit(input.pageSize).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(webinarRegistrations).where(eq(webinarRegistrations.webinarId, input.webinarId)),
      ]);
      return { registrations: rows, total: cnt[0]?.count ?? 0 };
    }),

  getStats: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return { totalRegistrations: 0, attended: 0, converted: 0, conversionRate: 0, avgWatchMinutes: 0 };
      const [regs, sessions] = await Promise.all([
        db.select().from(webinarRegistrations).where(eq(webinarRegistrations.webinarId, input.webinarId)),
        db.select().from(webinarSessions).where(eq(webinarSessions.webinarId, input.webinarId)),
      ]);
      const attended = regs.filter(r => r.attended).length;
      const converted = regs.filter(r => r.convertedAt).length;
      const totalWatchSeconds = sessions.reduce((s, r) => s + (r.watchedSeconds ?? 0), 0);
      return {
        totalRegistrations: regs.length, attended, converted,
        conversionRate: regs.length > 0 ? Math.round((converted / regs.length) * 100) : 0,
        avgWatchMinutes: sessions.length > 0 ? Math.round(totalWatchSeconds / sessions.length / 60) : 0,
      };
    }),

  getFunnelSteps: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return [];
      return db.select().from(webinarFunnelSteps).where(eq(webinarFunnelSteps.webinarId, input.webinarId)).orderBy(asc(webinarFunnelSteps.stepOrder));
    }),

  saveFunnelSteps: protectedProcedure
    .input(z.object({ webinarId: z.number(), steps: z.array(z.object({ stepType: z.enum(["registration","confirmation","reminder","watch","offer","thankyou"]), title: z.string().optional(), pageBlocksJson: z.any().optional(), emailSubject: z.string().optional(), emailBody: z.string().optional(), triggerType: z.enum(["immediate","delay","scheduled"]).optional(), triggerDelayMinutes: z.number().optional(), isActive: z.boolean().optional() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(webinarFunnelSteps).where(eq(webinarFunnelSteps.webinarId, input.webinarId));
      if (input.steps.length > 0) {
        await db.insert(webinarFunnelSteps).values(input.steps.map((s, i) => ({ ...s, webinarId: input.webinarId, stepOrder: i })));
      }
      return { success: true };
    }),

  getAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [w] = await db.select({ id: webinars.id, afterPurchaseWorkflow: webinars.afterPurchaseWorkflow })
        .from(webinars).where(eq(webinars.id, input.webinarId)).limit(1);
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      return { afterPurchaseWorkflow: w.afterPurchaseWorkflow ?? null };
    }),

  updateAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ webinarId: z.number(), workflow: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(webinars).set({ afterPurchaseWorkflow: input.workflow }).where(eq(webinars.id, input.webinarId));
      return { success: true };
    }),

  getHidePricingOptions: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [w] = await db.select({ id: webinars.id, hidePricingOptions: webinars.hidePricingOptions })
        .from(webinars).where(eq(webinars.id, input.webinarId)).limit(1);
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      return { hidePricingOptions: w.hidePricingOptions ?? false };
    }),

  updateHidePricingOptions: protectedProcedure
    .input(z.object({ webinarId: z.number(), hidePricingOptions: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(webinars).set({ hidePricingOptions: input.hidePricingOptions }).where(eq(webinars.id, input.webinarId));
      return { success: true };
    }),
});

// ── Public session tracking (no auth required) ────────────────────────────────
export const webinarSessionRouter = router({
  startSession: publicProcedure
    .input(z.object({ webinarId: z.number(), registrationId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const token = nanoid(32);
      await db.insert(webinarSessions).values({ webinarId: input.webinarId, registrationId: input.registrationId, sessionToken: token, ipAddress: (ctx as any).req?.ip, userAgent: (ctx as any).req?.headers?.['user-agent'] });
      return { sessionToken: token };
    }),

  heartbeat: publicProcedure
    .input(z.object({ sessionToken: z.string(), watchedSeconds: z.number(), currentViewerCount: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb(); if (!db) return { ok: false };
      const [session] = await db.select().from(webinarSessions).where(eq(webinarSessions.sessionToken, input.sessionToken)).limit(1);
      if (!session) return { ok: false };
      await db.update(webinarSessions).set({ watchedSeconds: input.watchedSeconds, lastHeartbeatAt: new Date(), peakViewerCount: Math.max(session.peakViewerCount ?? 0, input.currentViewerCount ?? 0) }).where(eq(webinarSessions.id, session.id));
      if (session.registrationId && input.watchedSeconds > 60) {
        await db.update(webinarRegistrations).set({ attended: true, watchedSeconds: input.watchedSeconds }).where(eq(webinarRegistrations.id, session.registrationId));
      }
      return { ok: true };
    }),

  markConverted: publicProcedure
    .input(z.object({ registrationId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb(); if (!db) return { ok: false };
      await db.update(webinarRegistrations).set({ convertedAt: new Date() }).where(eq(webinarRegistrations.id, input.registrationId));
      return { ok: true };
    }),

  getAiViewerCount: publicProcedure
    .input(z.object({ webinarId: z.number(), elapsedMinutes: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) return { count: 0 };
      const [w] = await db.select().from(webinars).where(eq(webinars.id, input.webinarId)).limit(1);
      if (!w || !w.aiViewersEnabled) return { count: 0 };
      const min = w.aiViewersMin ?? 50, max = w.aiViewersMax ?? 300, peak = w.aiViewersPeakAt ?? 30;
      const elapsed = input.elapsedMinutes, duration = w.durationMinutes ?? 60;
      let ratio = elapsed <= peak ? elapsed / peak : 1 - ((elapsed - peak) / (duration - peak)) * 0.4;
      ratio = Math.max(0.1, Math.min(1, ratio));
      const base = Math.round(min + (max - min) * ratio);
      const jitter = Math.round(base * 0.05 * (Math.random() * 2 - 1));
      return { count: Math.max(1, base + jitter) };
    }),

  // ─── Checkout Page Config ──────────────────────────────────────────────────
  getCheckoutPageConfig: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [w] = await db.select({ salesPageBlocksJson: webinars.salesPageBlocksJson }).from(webinars).where(eq(webinars.id, input.webinarId)).limit(1);
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      return { config: webinarCheckoutConfigToString(w.salesPageBlocksJson) };
    }),

  saveCheckoutPageConfig: protectedProcedure
    .input(z.object({ webinarId: z.number(), config: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let parsed: unknown;
      try { parsed = JSON.parse(input.config); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON config" }); }
      await db.update(webinars).set({ salesPageBlocksJson: parsed }).where(eq(webinars.id, input.webinarId));
      return { success: true };
    }),

  // ─── Embedded Checkout Session ────────────────────────────────────────────
  createEmbeddedCheckoutSession: publicProcedure
    .input(z.object({ webinarSlug: z.string(), origin: z.string(), pricingOptionId: z.string().optional(), promoCode: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [webinar] = await db.select().from(webinars).where(eq(webinars.slug, input.webinarSlug)).limit(1);
      if (!webinar) throw new TRPCError({ code: "NOT_FOUND", message: "Webinar not found" });
      const { isFree, priceCents } = resolveWebinarPricing(webinar, input.pricingOptionId);
      const subtitle = webinar.hostTitle ?? null;
      const userId = ctx.user?.id ?? 0;
      if (isFree) {
        return { clientSecret: null, free: true, courseTitle: webinar.title, courseSubtitle: subtitle, courseDescription: webinar.description ?? null, courseThumbnail: webinar.thumbnailUrl ?? null, primaryColor: "#189aa1", accentColor: "#4ad9e0", gradientFrom: "#189aa1", gradientTo: "#4ad9e0", gradientDirection: "135deg", playerTheme: "light", termsUrl: "", privacyUrl: "", productName: webinar.title, displayPrice: 0, pricingType: "free", isSubscription: false, billingLabel: null, currency: "usd", minSeats: null, discountPercent: null, brand: webinar.brand ?? "all_about_ultrasound" };
      }
      const { platformSettings } = await import("../../drizzle/schema");
      const [settings] = await db.select().from(platformSettings).limit(1);
      const webTerms = resolveCheckoutTerms(webinar, settings);
      const stripe = getStripeClient();
      // ── 100% promo intercept for webinars ────────────────────────────────
      if (input.promoCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (promoCodes.data.length > 0) {
            const coupon = promoCodes.data[0].coupon as any;
            let discountedCents = priceCents;
            if (coupon.percent_off) discountedCents -= Math.round(priceCents * (coupon.percent_off / 100));
            else if (coupon.amount_off) discountedCents -= Math.min(coupon.amount_off, priceCents);
            if (discountedCents <= 0) {
              // 100% off — register directly without Stripe (only if user is logged in)
              if (userId) {
                const [ex] = await db.select({ id: webinarRegistrations.id }).from(webinarRegistrations)
                  .where(and(eq(webinarRegistrations.webinarId, webinar.id), eq(webinarRegistrations.userId, userId))).limit(1);
                if (!ex) await db.insert(webinarRegistrations).values({ webinarId: webinar.id, userId, registrationSource: "promo_free", email: ctx.user?.email ?? "" });
              }
              return { clientSecret: null, free: true, courseTitle: webinar.title, courseSubtitle: subtitle, courseDescription: webinar.description ?? null, courseThumbnail: webinar.thumbnailUrl ?? null, primaryColor: "#189aa1", accentColor: "#4ad9e0", gradientFrom: "#189aa1", gradientTo: "#4ad9e0", gradientDirection: "135deg", playerTheme: "light", termsUrl: "", privacyUrl: "", productName: webinar.title, displayPrice: 0, pricingType: "free", isSubscription: false, billingLabel: null, currency: "usd", minSeats: null, discountPercent: 100, brand: webinar.brand ?? "all_about_ultrasound" };
            }
          }
        } catch { /* ignore, fall through to Stripe */ }
      }

      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode: "payment",
        customer_email: ctx.user?.email ?? undefined,
        client_reference_id: userId ? userId.toString() : undefined,
        allow_promotion_codes: true,
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: webinar.title,
              description: subtitle ?? undefined,
              images: webinar.thumbnailUrl ? [webinar.thumbnailUrl] : undefined,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        }],
        metadata: { type: "webinar", webinar_id: webinar.id.toString(), user_id: userId.toString(), customer_email: ctx.user?.email ?? "" },
        payment_intent_data: { description: `${webinar.title} — Webinar Registration` },
        return_url: `${input.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&type=webinar`,
      } as any);
      return {
        clientSecret: session.client_secret!,
        free: false,
        courseTitle: webinar.title,
        courseSubtitle: subtitle,
        courseDescription: webinar.description ?? null,
        courseThumbnail: webinar.thumbnailUrl ?? null,
        primaryColor: "#189aa1",
        accentColor: "#4ad9e0",
        gradientFrom: "#189aa1",
        gradientTo: "#4ad9e0",
        gradientDirection: "135deg",
        playerTheme: "light",
        ...webTerms,
        productName: webinar.title,
        displayPrice: priceCents,
        pricingType: "one_time",
        isSubscription: false,
        billingLabel: null,
        currency: "usd",
        minSeats: null,
        discountPercent: null,
        brand: webinar.brand ?? "all_about_ultrasound",
      };
    }),
});

// ─── Public: checkout page config for webinars ──────────────────────────────
export const webinarCheckoutPublicRouter = router({
  getPublicCheckoutPageConfig: publicProcedure
    .input(z.object({ webinarSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [webinar] = await db.select({ salesPageBlocksJson: webinars.salesPageBlocksJson }).from(webinars).where(eq(webinars.slug, input.webinarSlug)).limit(1);
      if (!webinar) throw new TRPCError({ code: "NOT_FOUND" });
      return { config: webinarCheckoutConfigToString(webinar.salesPageBlocksJson), courseStats: { totalLessons: 0, totalSections: 0, hasCertificate: false } };
    }),
});
