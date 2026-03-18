/**
 * emailCampaignRouter — Platform email campaigns and user interest preferences
 *
 * Procedures:
 *   getInterestPrefs        — get current user's interest preferences
 *   updateInterestPrefs     — update current user's interest preferences
 *   unsubscribe             — public: one-click unsubscribe via token
 *   listTemplates           — list all saved email templates (admin)
 *   saveTemplate            — create or update an email template (admin)
 *   deleteTemplate          — delete an email template (admin)
 *   previewAudience         — count recipients matching a filter (admin, dry-run)
 *   sendCampaign            — send a campaign immediately (admin)
 *   scheduleCampaign        — save a campaign for future send (admin)
 *   listCampaigns           — list sent/scheduled/draft campaigns (admin)
 *   cancelScheduled         — cancel a scheduled campaign (admin)
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, lte, isNull, isNotNull } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  users,
  emailTemplates,
  emailCampaigns,
  userRoles,
} from "../../drizzle/schema";
import { sendEmail } from "../_core/email";
import { randomBytes } from "crypto";

// ─── Shared Zod schemas ───────────────────────────────────────────────────────

const InterestPrefsSchema = z.object({
  acs: z.boolean().default(false),
  adultEcho: z.boolean().default(false),
  pediatricEcho: z.boolean().default(false),
  fetalEcho: z.boolean().default(false),
  pocus: z.boolean().default(false),
});

const AudienceFilterSchema = z.object({
  /** Interest categories — only users who have at least one of these selected */
  interests: z.array(z.enum(["acs", "adultEcho", "pediatricEcho", "fetalEcho", "pocus"])).default([]),
  /** App roles to filter by — empty means all roles */
  roles: z.array(z.string()).default([]),
  /** Subscription type: "all" | "premium" | "free" */
  subscriptionType: z.enum(["all", "premium", "free"]).default("all"),
  /** User status: "active" = verified non-pending, "pending" = pending/unverified, "all" = both */
  userStatus: z.enum(["all", "active", "pending"]).default("all"),
  /** Specific email addresses — overrides all other filters when non-empty */
  specificEmails: z.array(z.string().email()).default([]),
});

// ─── Unsubscribe token helper ─────────────────────────────────────────────────

function generateUnsubscribeToken(): string {
  return randomBytes(32).toString("hex");
}

/** Get or create an unsubscribe token for a user. Returns the token. */
async function ensureUnsubscribeToken(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [u] = await db
    .select({ unsubscribeToken: users.unsubscribeToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (u?.unsubscribeToken) return u.unsubscribeToken;
  const token = generateUnsubscribeToken();
  await db.update(users).set({ unsubscribeToken: token }).where(eq(users.id, userId));
  return token;
}

/** Build the unsubscribe URL for a given token */
function buildUnsubscribeUrl(token: string): string {
  const appUrl = process.env.VITE_APP_URL || "https://app.iheartecho.com";
  return `${appUrl}/unsubscribe?token=${token}`;
}

/** Inject an unsubscribe footer block into HTML email body */
function injectUnsubscribeFooter(htmlBody: string, unsubscribeUrl: string): string {
  const footerBlock = `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
        You are receiving this email because you have an account on iHeartEcho™.<br/>
        <a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Unsubscribe from platform emails</a>
      </p>
    </div>`;
  // Insert before closing </body> tag if present, otherwise append
  if (htmlBody.includes("</body>")) {
    return htmlBody.replace("</body>", `${footerBlock}</body>`);
  }
  return htmlBody + footerBlock;
}

// ─── Admin guard helper ───────────────────────────────────────────────────────

async function assertAdmin(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const adminRole = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.role, "platform_admin" as any),
      ),
    )
    .limit(1);
  const user = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const isAdmin = adminRole.length > 0 || user[0]?.role === "admin";
  if (!isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required." });
  }
}

// ─── Audience resolver ────────────────────────────────────────────────────────

async function resolveRecipients(
  filter: z.infer<typeof AudienceFilterSchema>,
): Promise<{ id: number; email: string; displayName: string | null; name: string | null }[]> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  // If specific emails are provided, use those directly (still respect unsubscribe)
  if (filter.specificEmails.length > 0) {
    const results: { id: number; email: string; displayName: string | null; name: string | null }[] = [];
    for (const email of filter.specificEmails) {
      const found = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          name: users.name,
          unsubscribedAt: users.unsubscribedAt,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (found[0]?.email && !found[0]?.unsubscribedAt) {
        results.push({
          id: found[0].id,
          email: found[0].email,
          displayName: found[0].displayName,
          name: found[0].name,
        });
      }
    }
    return results;
  }

  // Fetch users based on userStatus filter
  let allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      name: users.name,
      isPremium: users.isPremium,
      interestPrefs: users.interestPrefs,
      isPending: users.isPending,
      unsubscribedAt: users.unsubscribedAt,
    })
    .from(users);

  // Apply user status filter
  if (filter.userStatus === "active") {
    allUsers = allUsers.filter((u) => !u.isPending);
  } else if (filter.userStatus === "pending") {
    allUsers = allUsers.filter((u) => u.isPending);
  }
  // "all" = include both active and pending

  // Filter: must have email, must not have unsubscribed
  allUsers = allUsers.filter(
    (u) => u.email && u.email.trim() !== "" && !u.unsubscribedAt,
  );

  // Apply subscription filter
  if (filter.subscriptionType === "premium") {
    allUsers = allUsers.filter((u) => u.isPremium);
  } else if (filter.subscriptionType === "free") {
    allUsers = allUsers.filter((u) => !u.isPremium);
  }

  // Apply role filter
  if (filter.roles.length > 0) {
    const roleUserIds = new Set<number>();
    for (const role of filter.roles) {
      const roleRows = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(eq(userRoles.role, role as any));
      roleRows.forEach((r) => roleUserIds.add(r.userId));
    }
    allUsers = allUsers.filter((u) => roleUserIds.has(u.id));
  }

  // Apply interest filter
  if (filter.interests.length > 0) {
    allUsers = allUsers.filter((u) => {
      if (!u.interestPrefs) return false;
      try {
        const prefs = JSON.parse(u.interestPrefs) as Record<string, boolean>;
        return filter.interests.some((interest) => prefs[interest] === true);
      } catch {
        return false;
      }
    });
  }

  return allUsers.map((u) => ({
    id: u.id,
    email: u.email!,
    displayName: u.displayName,
    name: u.name,
  }));
}

// ─── Core send function (shared by immediate and scheduled sends) ─────────────

export async function executeCampaignSend(campaignId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) return;

  let filter: z.infer<typeof AudienceFilterSchema>;
  try {
    filter = AudienceFilterSchema.parse(JSON.parse(campaign.audienceFilter));
  } catch {
    await db
      .update(emailCampaigns)
      .set({ status: "failed", errorMessage: "Invalid audience filter JSON." })
      .where(eq(emailCampaigns.id, campaignId));
    return;
  }

  await db
    .update(emailCampaigns)
    .set({ status: "sending" })
    .where(eq(emailCampaigns.id, campaignId));

  const recipients = await resolveRecipients(filter);
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    // Ensure unsubscribe token exists for this user
    const token = await ensureUnsubscribeToken(recipient.id);
    const unsubscribeUrl = buildUnsubscribeUrl(token);
    const htmlWithFooter = injectUnsubscribeFooter(campaign.htmlBody, unsubscribeUrl);

    const displayName = recipient.displayName || recipient.name || recipient.email;
    const ok = await sendEmail({
      to: { name: displayName, email: recipient.email },
      subject: campaign.subject,
      htmlBody: htmlWithFooter,
      previewText: campaign.previewText ?? undefined,
    });
    if (ok) sent++;
    else failed++;
  }

  await db
    .update(emailCampaigns)
    .set({
      status: failed === recipients.length && recipients.length > 0 ? "failed" : "sent",
      sentAt: new Date(),
      recipientCount: recipients.length,
      errorMessage:
        failed > 0 ? `${failed} of ${recipients.length} emails failed to send.` : null,
    })
    .where(eq(emailCampaigns.id, campaignId));
}

// ─── Scheduled campaign cron ──────────────────────────────────────────────────

let schedulerStarted = false;

export function startEmailCampaignScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

  const check = async () => {
    try {
      const db = await getDb();
      if (!db) return;

      const now = new Date();
      // Find campaigns that are scheduled and due
      const due = await db
        .select({ id: emailCampaigns.id })
        .from(emailCampaigns)
        .where(
          and(
            eq(emailCampaigns.status, "scheduled"),
            lte(emailCampaigns.scheduledAt, now),
          ),
        );

      for (const c of due) {
        console.log(`[EmailScheduler] Sending scheduled campaign #${c.id}`);
        await executeCampaignSend(c.id);
      }
    } catch (err) {
      console.error("[EmailScheduler] Error:", err);
    }
  };

  // Run immediately on start, then every 5 minutes
  check();
  setInterval(check, CHECK_INTERVAL_MS);
  console.log("[EmailScheduler] Started — checking every 5 minutes for scheduled campaigns.");
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const emailCampaignRouter = router({
  // ── User: interest preferences ────────────────────────────────────────────

  getInterestPrefs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [u] = await db
      .select({ interestPrefs: users.interestPrefs })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (!u?.interestPrefs) {
      return { acs: false, adultEcho: false, pediatricEcho: false, fetalEcho: false, pocus: false };
    }
    try {
      return InterestPrefsSchema.parse(JSON.parse(u.interestPrefs));
    } catch {
      return { acs: false, adultEcho: false, pediatricEcho: false, fetalEcho: false, pocus: false };
    }
  }),

  updateInterestPrefs: protectedProcedure
    .input(InterestPrefsSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(users)
        .set({ interestPrefs: JSON.stringify(input) })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  // ── Public: unsubscribe via token ─────────────────────────────────────────

  unsubscribe: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [u] = await db
        .select({ id: users.id, unsubscribedAt: users.unsubscribedAt })
        .from(users)
        .where(eq(users.unsubscribeToken, input.token))
        .limit(1);
      if (!u) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired unsubscribe link." });
      }
      if (!u.unsubscribedAt) {
        await db
          .update(users)
          .set({ unsubscribedAt: new Date() })
          .where(eq(users.id, u.id));
      }
      return { success: true, alreadyUnsubscribed: !!u.unsubscribedAt };
    }),

  // ── Admin: email templates ────────────────────────────────────────────────

  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    return db
      .select()
      .from(emailTemplates)
      .orderBy(desc(emailTemplates.updatedAt));
  }),

  saveTemplate: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(200),
        subject: z.string().min(1).max(500),
        htmlBody: z.string().min(1),
        previewText: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      if (input.id) {
        await db
          .update(emailTemplates)
          .set({
            name: input.name,
            subject: input.subject,
            htmlBody: input.htmlBody,
            previewText: input.previewText ?? null,
          })
          .where(eq(emailTemplates.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(emailTemplates).values({
          createdByUserId: ctx.user.id,
          name: input.name,
          subject: input.subject,
          htmlBody: input.htmlBody,
          previewText: input.previewText ?? null,
        });
        return { id: (result as any).insertId as number };
      }
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(emailTemplates).where(eq(emailTemplates.id, input.id));
      return { success: true };
    }),

  // ── Admin: audience preview ───────────────────────────────────────────────

  previewAudience: protectedProcedure
    .input(AudienceFilterSchema)
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const recipients = await resolveRecipients(input);
      return {
        count: recipients.length,
        sampleEmails: recipients.slice(0, 5).map((r) => r.email),
      };
    }),

  // ── Admin: send campaign immediately ─────────────────────────────────────

  sendCampaign: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(1).max(500),
        htmlBody: z.string().min(1),
        previewText: z.string().max(300).optional(),
        audienceFilter: AudienceFilterSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Resolve recipients to validate audience
      const recipients = await resolveRecipients(input.audienceFilter);
      if (recipients.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No recipients match the selected audience filters.",
        });
      }

      // Create campaign record in "sending" state
      const [result] = await db.insert(emailCampaigns).values({
        sentByUserId: ctx.user.id,
        subject: input.subject,
        htmlBody: input.htmlBody,
        previewText: input.previewText ?? null,
        audienceFilter: JSON.stringify(input.audienceFilter),
        recipientCount: recipients.length,
        status: "sending",
      });
      const campaignId = (result as any).insertId as number;

      // Send (fire and forget — status updated inside executeCampaignSend)
      executeCampaignSend(campaignId).catch((err) =>
        console.error(`[EmailCampaign] Send error for campaign #${campaignId}:`, err),
      );

      return { campaignId, recipientCount: recipients.length };
    }),

  // ── Admin: schedule campaign for future send ──────────────────────────────

  scheduleCampaign: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(1).max(500),
        htmlBody: z.string().min(1),
        previewText: z.string().max(300).optional(),
        audienceFilter: AudienceFilterSchema,
        scheduledAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (input.scheduledAt <= new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Scheduled time must be in the future.",
        });
      }

      // Estimate recipient count (dry-run)
      const recipients = await resolveRecipients(input.audienceFilter);

      const [result] = await db.insert(emailCampaigns).values({
        sentByUserId: ctx.user.id,
        subject: input.subject,
        htmlBody: input.htmlBody,
        previewText: input.previewText ?? null,
        audienceFilter: JSON.stringify(input.audienceFilter),
        recipientCount: recipients.length,
        status: "scheduled",
        scheduledAt: input.scheduledAt,
      });
      return { campaignId: (result as any).insertId as number, recipientCount: recipients.length, scheduledAt: input.scheduledAt };
    }),

  // ── Admin: cancel a scheduled campaign ───────────────────────────────────

  cancelScheduled: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(emailCampaigns)
        .set({ status: "draft" })
        .where(and(eq(emailCampaigns.id, input.id), eq(emailCampaigns.status, "scheduled")));
      return { success: true };
    }),

  // ── Admin: list campaigns ─────────────────────────────────────────────────

  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    return db
      .select()
      .from(emailCampaigns)
      .orderBy(desc(emailCampaigns.createdAt))
      .limit(100);
  }),
});
