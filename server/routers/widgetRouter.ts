import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc, and, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { embedWidgets, lmsCourses } from "../../drizzle/schema";

function assertAdmin(ctx: any) {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
}

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

const widgetItemSchema = z.object({
  type: z.enum(["course", "quiz"]),
  id: z.number().int().positive(),
});

const widgetInputSchema = z.object({
  name: z.string().min(1).max(255),
  title: z.string().max(255).optional(),
  subtitle: z.string().max(500).optional(),
  layout: z.enum(["grid", "carousel", "list"]).default("grid"),
  theme: z.enum(["light", "dark", "brand"]).default("light"),
  cardStyle: z.enum(["standard", "compact", "minimal"]).default("standard"),
  showPrice: z.boolean().default(true),
  showEnrollButton: z.boolean().default(true),
  buttonText: z.string().max(100).default("Enroll Now"),
  buttonUrl: z.string().max(500).optional(),
  maxCards: z.number().int().min(1).max(50).default(6),
  items: z.array(widgetItemSchema).default([]),
  isActive: z.boolean().default(true),
});

export const widgetAdminRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(embedWidgets).orderBy(desc(embedWidgets.createdAt));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [widget] = await db.select().from(embedWidgets).where(eq(embedWidgets.id, input.id));
      if (!widget) throw new TRPCError({ code: "NOT_FOUND" });
      return widget;
    }),

  create: protectedProcedure
    .input(widgetInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const token = generateToken();
      const [result] = await db.insert(embedWidgets).values({
        token,
        name: input.name,
        title: input.title ?? null,
        subtitle: input.subtitle ?? null,
        layout: input.layout,
        theme: input.theme,
        cardStyle: input.cardStyle,
        showPrice: input.showPrice,
        showEnrollButton: input.showEnrollButton,
        buttonText: input.buttonText,
        buttonUrl: input.buttonUrl ?? null,
        maxCards: input.maxCards,
        items: JSON.stringify(input.items),
        isActive: input.isActive,
      });
      const [widget] = await db.select().from(embedWidgets).where(eq(embedWidgets.id, (result as any).insertId));
      return widget;
    }),

  update: protectedProcedure
    .input(widgetInputSchema.extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, items, ...rest } = input;
      await db.update(embedWidgets).set({
        ...rest,
        items: JSON.stringify(items),
      }).where(eq(embedWidgets.id, id));
      const [widget] = await db.select().from(embedWidgets).where(eq(embedWidgets.id, id));
      return widget;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(embedWidgets).where(eq(embedWidgets.id, input.id));
      return { success: true };
    }),

  regenerateToken: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const token = generateToken();
      await db.update(embedWidgets).set({ token }).where(eq(embedWidgets.id, input.id));
      return { token };
    }),
});

export const widgetPublicRouter = router({
  /** Public endpoint: fetch widget config + card data by token */
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [widget] = await db
        .select()
        .from(embedWidgets)
        .where(and(eq(embedWidgets.token, input.token), eq(embedWidgets.isActive, true)));
      if (!widget) throw new TRPCError({ code: "NOT_FOUND", message: "Widget not found or inactive" });

      // Parse items and fetch course/quiz data
      let items: Array<{ type: string; id: number }> = [];
      try { items = JSON.parse(widget.items || "[]"); } catch {}

      const courseIds = items.filter(i => i.type === "course" || i.type === "quiz").map(i => i.id);
      let cards: any[] = [];
      if (courseIds.length > 0) {
        const courses = await db
          .select({
            id: lmsCourses.id,
            slug: lmsCourses.slug,
            title: lmsCourses.title,
            subtitle: lmsCourses.subtitle,
            coverImageUrl: lmsCourses.coverImageUrl,
            type: lmsCourses.type,
            price: lmsCourses.price,
            isFree: lmsCourses.isFree,
            pricingType: lmsCourses.pricingType,
            subscriptionInterval: lmsCourses.subscriptionInterval,
            currency: lmsCourses.currency,
            brand: lmsCourses.brand,
            status: lmsCourses.status,
          })
          .from(lmsCourses)
          .where(and(inArray(lmsCourses.id, courseIds), eq(lmsCourses.status, "public")));

        // Preserve the admin-specified order
        const courseMap = new Map(courses.map(c => [c.id, c]));
        cards = items
          .filter(i => courseMap.has(i.id))
          .map(i => ({ ...courseMap.get(i.id)!, itemType: i.type }))
          .slice(0, widget.maxCards);
      }

      return {
        widget: {
          id: widget.id,
          name: widget.name,
          title: widget.title,
          subtitle: widget.subtitle,
          layout: widget.layout,
          theme: widget.theme,
          cardStyle: widget.cardStyle,
          showPrice: widget.showPrice,
          showEnrollButton: widget.showEnrollButton,
          buttonText: widget.buttonText,
          buttonUrl: widget.buttonUrl,
        },
        cards,
      };
    }),
});
