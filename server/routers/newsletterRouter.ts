/**
 * newsletterRouter.ts
 * Handles newsletter subscription management.
 * Unsubscribe tokens are for marketing emails only — transactional emails are unaffected.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { newsletterSubscribers } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { addToAllContacts } from "../lib/emailListHelper";
import {
  upsertSendGridContacts,
  getOrCreateSendGridList,
  removeSendGridContactFromList,
} from "../lib/sendgridContacts";

/** Generate a URL-safe 32-byte random token */
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

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
        .select({
          id: newsletterSubscribers.id,
          isActive: newsletterSubscribers.isActive,
          unsubscribeToken: newsletterSubscribers.unsubscribeToken,
        })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, email))
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].isActive) {
          // Already active — return success silently (don't reveal subscriber status)
          return {
            success: true,
            alreadySubscribed: true,
            unsubscribeToken: existing[0].unsubscribeToken,
          };
        }
        // Re-subscribe — generate a fresh token
        const token = generateToken();
        await db
          .update(newsletterSubscribers)
          .set({
            isActive: 1,
            subscribedAt: now,
            unsubscribedAt: null,
            unsubscribeToken: token,
            updatedAt: new Date(),
          })
          .where(eq(newsletterSubscribers.email, email));
        return { success: true, alreadySubscribed: false, unsubscribeToken: token };
      }

      // New subscriber — generate token
      const token = generateToken();
      await db.insert(newsletterSubscribers).values({
        email,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        profession: input.profession ?? null,
        interests: input.interests ?? null,
        source: input.source ?? "subscribe_page",
        subscribedAt: now,
        isActive: 1,
        unsubscribeToken: token,
      });

      // Sync to SendGrid Marketing Contacts and internal email list (fire-and-forget)
      const name = [input.firstName, input.lastName].filter(Boolean).join(" ") || email;
      (async () => {
        try {
          await addToAllContacts(email, name || null, { source: "newsletter_subscribe" });
          const listId = await getOrCreateSendGridList("Newsletter Subscribers");
          await upsertSendGridContacts(
            [{
              email,
              first_name: input.firstName,
              last_name: input.lastName,
              list_ids: listId ? [listId] : undefined,
            }],
            listId ? [listId] : undefined,
          );
        } catch (err) {
          console.error("[newsletter] SendGrid/list sync error:", err);
        }
      })();

      // Notify owner of new subscriber
      await notifyOwner({
        title: "New Newsletter Subscriber",
        content: `${name} (${email}) subscribed to the newsletter${input.profession ? ` — ${input.profession}` : ""}.`,
      }).catch(() => {/* non-blocking */});

      return { success: true, alreadySubscribed: false, unsubscribeToken: token };
    }),

  // ── Public: unsubscribe via signed token (marketing emails only) ───────────
  unsubscribeByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({
          id: newsletterSubscribers.id,
          email: newsletterSubscribers.email,
          isActive: newsletterSubscribers.isActive,
        })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.unsubscribeToken, input.token))
        .limit(1);

      if (rows.length === 0) {
        // Invalid or already-used token — return success to avoid enumeration
        return { success: true, alreadyUnsubscribed: true };
      }

      const row = rows[0];
      if (!row.isActive) {
        return { success: true, alreadyUnsubscribed: true };
      }

      // Mark inactive in DB
      await db
        .update(newsletterSubscribers)
        .set({ isActive: 0, unsubscribedAt: Date.now(), updatedAt: new Date() })
        .where(eq(newsletterSubscribers.id, row.id));

      // Remove from SendGrid "Newsletter Subscribers" list (marketing only — not global delete)
      (async () => {
        try {
          const listId = await getOrCreateSendGridList("Newsletter Subscribers");
          if (listId) {
            await removeSendGridContactFromList(row.email, listId);
          }
        } catch (err) {
          console.error("[newsletter] SendGrid unsubscribe error:", err);
        }
      })();

      return { success: true, alreadyUnsubscribed: false };
    }),

  // ── Public: unsubscribe via email (legacy / direct) ───────────────────────
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
