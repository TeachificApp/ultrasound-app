/**
 * newsletterRouter.ts
 * Handles newsletter subscription management.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { newsletterSubscribers } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

export const newsletterRouter = router({
  // ── Public: subscribe ──────────────────────────────────────────────────────
  subscribe: publicProcedure
    .input(z.object({
      email: z.string().email().max(255),
      firstName: z.string().max(128).optional(),
      lastName: z.string().max(128).optional(),
      profession: z.string().max(128).optional(),
      interests: z.array(z.string()).optional(),
      source: z.string().max(64).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = Date.now();
      const email = input.email.toLowerCase().trim();

      // Check if already subscribed
      const existing = await db
        .select({ id: newsletterSubscribers.id, isActive: newsletterSubscribers.isActive })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, email))
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].isActive) {
          // Already active — return success silently (don't reveal subscriber status)
          return { success: true, alreadySubscribed: true };
        }
        // Re-subscribe
        await db
          .update(newsletterSubscribers)
          .set({ isActive: 1, subscribedAt: now, unsubscribedAt: null, updatedAt: new Date() })
          .where(eq(newsletterSubscribers.email, email));
        return { success: true, alreadySubscribed: false };
      }

      // New subscriber
      await db.insert(newsletterSubscribers).values({
        email,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        profession: input.profession ?? null,
        interests: input.interests ?? null,
        source: input.source ?? "subscribe_page",
        subscribedAt: now,
        isActive: 1,
      });

      // Notify owner of new subscriber
      const name = [input.firstName, input.lastName].filter(Boolean).join(" ") || email;
      await notifyOwner({
        title: "New Newsletter Subscriber",
        content: `${name} (${email}) subscribed to the newsletter${input.profession ? ` — ${input.profession}` : ""}.`,
      }).catch(() => {/* non-blocking */});

      return { success: true, alreadySubscribed: false };
    }),

  // ── Public: unsubscribe via token (email link) ─────────────────────────────
  unsubscribe: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const email = input.email.toLowerCase().trim();
      await db
        .update(newsletterSubscribers)
        .set({ isActive: 0, unsubscribedAt: Date.now(), updatedAt: new Date() })
        .where(eq(newsletterSubscribers.email, email));
      return { success: true };
    }),

  // ── Admin: list all subscribers ────────────────────────────────────────────
  listSubscribers: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(newsletterSubscribers)
        .orderBy(newsletterSubscribers.createdAt);
    }),
});
