/**
 * newsletterRouter.ts
 * Handles newsletter subscription management.
 * Unsubscribe tokens are for marketing emails only — transactional emails are unaffected.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { newsletterSubscribers } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { buildNewsletterWelcomeEmail, sendEmail } from "../_core/email";
import { addToAllContacts, unsubscribeFromAllContacts } from "../lib/emailListHelper";
import {
  upsertSendGridContacts,
  getOrCreateSendGridList,
  removeSendGridContactFromList,
} from "../lib/sendgridContacts";

/** Generate a URL-safe 32-byte random token */
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

const NEWSLETTER_APP_URL = "https://learn.allaboutultrasound.com";

/**
 * Atomically claims and sends the opt-in confirmation only once per subscriber.
 * A failed provider attempt releases the claim, so the recipient can retry by
 * submitting the subscribe form again without receiving duplicate welcomes.
 */
async function sendNewsletterWelcomeIfNeeded(input: {
  id: number;
  email: string;
  firstName: string;
  unsubscribeToken: string;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const claimedAt = Date.now();
  const [claim] = await db
    .update(newsletterSubscribers)
    .set({ welcomeEmailSentAt: claimedAt })
    .where(
      and(
        eq(newsletterSubscribers.id, input.id),
        isNull(newsletterSubscribers.welcomeEmailSentAt),
      ),
    );

  if (claim.affectedRows !== 1) return false;

  const welcome = buildNewsletterWelcomeEmail({
    firstName: input.firstName,
    unsubscribeUrl: `${NEWSLETTER_APP_URL}/unsubscribe?nltoken=${encodeURIComponent(input.unsubscribeToken)}`,
    brandMode: "combined",
  });

  try {
    const sent = await sendEmail({
      to: { name: input.firstName, email: input.email },
      subject: welcome.subject,
      htmlBody: welcome.htmlBody,
      previewText: welcome.previewText,
      brandMode: "combined",
      listUnsubscribeUrl: `${NEWSLETTER_APP_URL}/unsubscribe?nltoken=${encodeURIComponent(input.unsubscribeToken)}`,
    });
    if (sent) return true;
  } catch (err) {
    console.error(`[newsletter] Welcome email error for ${input.email}:`, err);
  }

  await db
    .update(newsletterSubscribers)
    .set({ welcomeEmailSentAt: null })
    .where(
      and(
        eq(newsletterSubscribers.id, input.id),
        eq(newsletterSubscribers.welcomeEmailSentAt, claimedAt),
      ),
    );
  return false;
}

export const newsletterRouter = router({
  // ── Public: subscribe ──────────────────────────────────────────────────────
  subscribe: publicProcedure
    .input(z.object({
      email: z.string().email().max(255),
      firstName: z.string().trim().min(1, "First name is required").max(128),
      lastName: z.string().trim().min(1, "Last name is required").max(128),
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
          await addToAllContacts(email, `${input.firstName} ${input.lastName}`, { source: "newsletter_subscribe" });
          const unsubscribeToken = existing[0].unsubscribeToken ?? generateToken();
          if (!existing[0].unsubscribeToken) {
            await db
              .update(newsletterSubscribers)
              .set({ unsubscribeToken })
              .where(eq(newsletterSubscribers.id, existing[0].id));
          }
          const welcomeEmailSent = await sendNewsletterWelcomeIfNeeded({
            id: existing[0].id,
            email,
            firstName: input.firstName,
            unsubscribeToken,
          });
          // Already active — return success silently (don't reveal subscriber status)
          return {
            success: true,
            alreadySubscribed: true,
            unsubscribeToken,
            welcomeEmailSent,
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
        await addToAllContacts(email, `${input.firstName} ${input.lastName}`, { source: "newsletter_subscribe", resubscribe: true });
        const welcomeEmailSent = await sendNewsletterWelcomeIfNeeded({
          id: existing[0].id,
          email,
          firstName: input.firstName,
          unsubscribeToken: token,
        });
        return { success: true, alreadySubscribed: false, unsubscribeToken: token, welcomeEmailSent };
      }

      // New subscriber — generate token
      const token = generateToken();
      await db.insert(newsletterSubscribers).values({
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        profession: null,
        interests: null,
        source: input.source ?? "subscribe_page",
        subscribedAt: now,
        isActive: 1,
        unsubscribeToken: token,
      });

      // Persist to the campaign-visible All Contacts list before reporting success.
      const name = `${input.firstName} ${input.lastName}`;
      await addToAllContacts(email, name || null, { source: "newsletter_subscribe", resubscribe: true });

      const [newSubscriber] = await db
        .select({ id: newsletterSubscribers.id })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, email))
        .limit(1);
      const welcomeEmailSent = newSubscriber
        ? await sendNewsletterWelcomeIfNeeded({
            id: newSubscriber.id,
            email,
            firstName: input.firstName,
            unsubscribeToken: token,
          })
        : false;

      // Sync to SendGrid Marketing Contacts separately (fire-and-forget).
      (async () => {
        try {
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
        content: `${name} (${email}) subscribed to the newsletter.`,
      }).catch(() => {/* non-blocking */});

      return { success: true, alreadySubscribed: false, unsubscribeToken: token, welcomeEmailSent };
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
      await unsubscribeFromAllContacts(row.email);

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
      await unsubscribeFromAllContacts(email);
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
