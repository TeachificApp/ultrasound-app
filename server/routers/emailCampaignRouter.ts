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
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  users,
  emailTemplates,
  emailCampaigns,
  emailSenderProfiles,
  userRoles,
  emailLists,
  emailListSubscribers,
  leadCaptureWidgets,
  lmsInterests,
  membershipPlans,
  lmsCohortGroups,
  lmsCourses,
  workshopInstances,
  workshops,
  bundles,
} from "../../drizzle/schema";
import { addToEmailList, ensureAllContactsList } from "../lib/emailListHelper";
import { resolveRecipients } from "../lib/emailCampaignAudienceResolver";
import {
  AudienceFilterSchema,
  buildRecipientTrackingKey,
  pickAbVariant,
  type AudienceFilter,
} from "../../shared/emailCampaignAudience";
import { sendEmail } from "../_core/email";
import { randomBytes } from "crypto";
import { addToSendGridGlobalUnsubscribes } from "../lib/sendgridSuppressions";
import { normalizeCampaignEmailHtml } from "../../shared/emailCampaignLayout";
import {
  injectTrackingPixel,
  wrapLinksForTracking,
  recordEmailCampaignEvent,
} from "../lib/emailCampaignTracking";
import {
  buildListUnsubscribeApiUrl,
  buildUnsubscribePageUrl,
  ensureEmailCampaignEventsTable,
} from "../lib/campaignUnsubscribe";

// ─── Campaign metrics helper ──────────────────────────────────────────────────

type CampaignMetricsRow = {
  campaignId: number;
  openCount: number;
  clickCount: number;
  unsubscribeCount: number;
  uniqueOpenCount: number;
  uniqueClickCount: number;
  uniqueUnsubscribeCount: number;
};

/** Load engagement metrics; never throw — campaigns list must still render if events table is missing. */
async function loadCampaignMetricsMap(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  campaignIds: number[],
): Promise<Map<number, CampaignMetricsRow>> {
  const empty = new Map<number, CampaignMetricsRow>();
  if (campaignIds.length === 0) return empty;
  try {
    await ensureEmailCampaignEventsTable(db);
    const [metricsRaw] = (await db.execute(sql`
      SELECT
        campaignId,
        SUM(CASE WHEN eventType = 'open' THEN 1 ELSE 0 END) as openCount,
        SUM(CASE WHEN eventType = 'click' THEN 1 ELSE 0 END) as clickCount,
        SUM(CASE WHEN eventType = 'unsubscribe' THEN 1 ELSE 0 END) as unsubscribeCount,
        COUNT(DISTINCT CASE WHEN eventType = 'open' THEN recipientKey END) as uniqueOpenCount,
        COUNT(DISTINCT CASE WHEN eventType = 'click' THEN recipientKey END) as uniqueClickCount,
        COUNT(DISTINCT CASE WHEN eventType = 'unsubscribe' THEN recipientKey END) as uniqueUnsubscribeCount
      FROM emailCampaignEvents
      WHERE campaignId IN (${sql.join(campaignIds.map((id) => sql`${id}`), sql`, `)})
      GROUP BY campaignId
    `)) as [CampaignMetricsRow[], unknown];
    return new Map(
      (Array.isArray(metricsRaw) ? metricsRaw : []).map((m) => [m.campaignId, m]),
    );
  } catch (err) {
    console.error("[EmailCampaign] Failed to load campaign metrics:", err);
    return empty;
  }
}

/** Run one audience-options query without failing the whole builder. */
async function safeAudienceSqlRows<T>(
  label: string,
  query: () => Promise<[{ id: number; title?: string; name?: string; label?: string }[], unknown]>,
): Promise<T[]> {
  try {
    const [rows] = await query();
    return (Array.isArray(rows) ? rows : []) as T[];
  } catch (err) {
    console.error(`[EmailCampaign] getAudienceOptions ${label}:`, err);
    return [];
  }
}

// ─── Shared Zod schemas ───────────────────────────────────────────────────────

const InterestPrefsSchema = z.object({
  acs: z.boolean().default(false),
  adultEcho: z.boolean().default(false),
  pediatricEcho: z.boolean().default(false),
  fetalEcho: z.boolean().default(false),
  pocus: z.boolean().default(false),
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

/** Build the unsubscribe URL for a given token (footer link in email body). */
function buildUnsubscribeUrl(token: string, campaignId?: number): string {
  return buildUnsubscribePageUrl(token, campaignId);
}

/** Inject an unsubscribe footer block into HTML email body */
function injectUnsubscribeFooter(htmlBody: string, unsubscribeUrl: string): string {
  const footerBlock = `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
        You are receiving this email because you have an account on All About Ultrasound™.<br/>
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

  let filter: AudienceFilter;
  try {
    filter = AudienceFilterSchema.parse(JSON.parse(campaign.audienceFilter));
  } catch {
    await db
      .update(emailCampaigns)
      .set({ status: "failed", errorMessage: "Invalid audience filter JSON." })
      .where(eq(emailCampaigns.id, campaignId));
    return;
  }

  // Load sender profile if set
  let senderName: string | undefined;
  let senderEmail: string | undefined;
  if (campaign.senderProfileId) {
    const [sp] = await db
      .select()
      .from(emailSenderProfiles)
      .where(eq(emailSenderProfiles.id, campaign.senderProfileId))
      .limit(1);
    if (sp) { senderName = sp.name; senderEmail = sp.email; }
  } else if (campaign.fromName || campaign.fromEmail) {
    senderName = campaign.fromName ?? undefined;
    senderEmail = campaign.fromEmail ?? undefined;
  }

  await db
    .update(emailCampaigns)
    .set({ status: "sending" })
    .where(eq(emailCampaigns.id, campaignId));

  const recipients = await resolveRecipients(filter, campaignId);
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const variant = pickAbVariant(recipient.email, filter.abTest, campaignId);
    const subject = variant?.subject?.trim() || campaign.subject;
    let html = normalizeCampaignEmailHtml(variant?.htmlBody?.trim() || campaign.htmlBody);

    let unsubscribePageUrl: string | undefined;
    let listUnsubscribeApiUrl: string | undefined;
    if (recipient.userId) {
      const token = await ensureUnsubscribeToken(recipient.userId);
      unsubscribePageUrl = buildUnsubscribeUrl(token, campaignId);
      listUnsubscribeApiUrl = buildListUnsubscribeApiUrl(token, campaignId);
      if (html.includes("{{UNSUBSCRIBE_URL}}")) {
        html = html.replaceAll("{{UNSUBSCRIBE_URL}}", unsubscribePageUrl);
      } else {
        html = injectUnsubscribeFooter(html, unsubscribePageUrl);
      }
    } else if (html.includes("{{UNSUBSCRIBE_URL}}")) {
      html = html.replaceAll(
        "{{UNSUBSCRIBE_URL}}",
        "mailto:support@allaboutultrasound.com?subject=Unsubscribe",
      );
    }

    const recipientKey = buildRecipientTrackingKey(recipient);
    const variantKey = recipient.abVariant ?? variant?.key;
    html = injectTrackingPixel(html, campaignId, recipientKey, variantKey);
    html = wrapLinksForTracking(html, campaignId, recipientKey, variantKey);

    const displayName = recipient.displayName || recipient.name || recipient.email;
    const ok = await sendEmail({
      to: { name: displayName, email: recipient.email },
      subject,
      htmlBody: html,
      previewText: campaign.previewText ?? undefined,
      fromName: senderName,
      fromEmail: senderEmail,
      listUnsubscribeUrl: listUnsubscribeApiUrl,
    });
    if (ok) {
      sent++;
      // Tag this log entry with the campaign ID
      try {
        await db.execute(sql`
          UPDATE email_send_log SET campaign_id = ${campaignId}
          WHERE recipient_email = ${recipient.email} AND campaign_id IS NULL
          ORDER BY sent_at DESC LIMIT 1
        `);
      } catch { /* ignore */ }
    } else failed++;
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
    .input(z.object({
      token: z.string().min(1),
      campaignId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [u] = await db
        .select({ id: users.id, email: users.email, unsubscribedAt: users.unsubscribedAt })
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
        if (u.email) {
          await addToSendGridGlobalUnsubscribes([u.email]);
        }
      }
      if (input.campaignId) {
        try {
          await recordEmailCampaignEvent(db, {
            campaignId: input.campaignId,
            recipientKey: `u${u.id}`,
            eventType: "unsubscribe",
          });
        } catch (err) {
          console.error("[EmailCampaign] Failed to record unsubscribe event:", err);
        }
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
        subject: z.string().max(500).default(""),
        htmlBody: z.string().min(1),
        blocksJson: z.string().optional(),
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
            blocksJson: input.blocksJson ?? null,
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
          blocksJson: input.blocksJson ?? null,
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
        blocksJson: z.string().optional(),
        previewText: z.string().max(300).optional(),
        audienceFilter: AudienceFilterSchema,
        headerTitle: z.string().max(300).optional(),
        headerSubtext: z.string().max(500).optional(),
        headerColor: z.string().max(20).optional(),
        headerEnabled: z.boolean().optional(),
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
      const htmlBody = normalizeCampaignEmailHtml(input.htmlBody);
      const [result] = await db.insert(emailCampaigns).values({
        sentByUserId: ctx.user.id,
        subject: input.subject,
        htmlBody,
        blocksJson: input.blocksJson ?? null,
        previewText: input.previewText ?? null,
        audienceFilter: JSON.stringify(input.audienceFilter),
        recipientCount: recipients.length,
        status: "sending",
        headerTitle: input.headerTitle ?? null,
        headerSubtext: input.headerSubtext ?? null,
        headerColor: input.headerColor ?? null,
        headerEnabled: input.headerEnabled ?? true,
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
        blocksJson: z.string().optional(),
        previewText: z.string().max(300).optional(),
        audienceFilter: AudienceFilterSchema,
        scheduledAt: z.date(),
        headerTitle: z.string().max(300).optional(),
        headerSubtext: z.string().max(500).optional(),
        headerColor: z.string().max(20).optional(),
        headerEnabled: z.boolean().optional(),
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

      const htmlBodyScheduled = normalizeCampaignEmailHtml(input.htmlBody);
      const [result] = await db.insert(emailCampaigns).values({
        sentByUserId: ctx.user.id,
        subject: input.subject,
        htmlBody: htmlBodyScheduled,
        blocksJson: input.blocksJson ?? null,
        previewText: input.previewText ?? null,
        audienceFilter: JSON.stringify(input.audienceFilter),
        recipientCount: recipients.length,
        status: "scheduled",
        scheduledAt: input.scheduledAt,
        headerTitle: input.headerTitle ?? null,
        headerSubtext: input.headerSubtext ?? null,
        headerColor: input.headerColor ?? null,
        headerEnabled: input.headerEnabled ?? true,
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

  // ── Admin: sender profiles ───────────────────────────────────────────────

  listSenderProfiles: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    return db.select().from(emailSenderProfiles).orderBy(desc(emailSenderProfiles.createdAt));
  }),

  saveSenderProfile: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1).max(200),
      email: z.string().email().max(300),
      replyTo: z.string().email().max(300).optional(),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      if (input.isDefault) {
        // Unset other defaults
        await db.update(emailSenderProfiles).set({ isDefault: false });
      }
      if (input.id) {
        await db.update(emailSenderProfiles).set({
          name: input.name, email: input.email,
          replyTo: input.replyTo ?? null, isDefault: input.isDefault,
        }).where(eq(emailSenderProfiles.id, input.id));
        return { id: input.id };
      } else {
        const [r] = await db.insert(emailSenderProfiles).values({
          name: input.name, email: input.email,
          replyTo: input.replyTo ?? null, isDefault: input.isDefault,
        });
        return { id: (r as any).insertId as number };
      }
    }),

  deleteSenderProfile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(emailSenderProfiles).where(eq(emailSenderProfiles.id, input.id));
      return { success: true };
    }),

  // ── Admin: delete campaign ──────────────────────────────────────────────────

  deleteCampaign: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Only allow deleting drafts and scheduled campaigns, not sent ones
      const [campaign] = await db.select({ status: emailCampaigns.status }).from(emailCampaigns).where(eq(emailCampaigns.id, input.id)).limit(1);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      if (campaign.status === "sending") throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete a campaign that is currently sending" });
      await db.delete(emailCampaigns).where(eq(emailCampaigns.id, input.id));
      return { success: true };
    }),

  // ── Admin: option lists for audience builder ──────────────────────────────

  getAudienceOptions: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [
      courses,
      quizzes,
      products,
      groups,
      cohortGroups,
      forms,
      interests,
      lists,
      membershipPlans,
      bundles,
      digitalBundles,
      webinars,
      workshopsList,
      communities,
      workshopInstanceRows,
      physicalProducts,
      sentCampaigns,
    ] = await Promise.all([
      safeAudienceSqlRows<{ id: number; title: string }>("courses", () =>
        db.execute(sql`SELECT id, title FROM lms_courses WHERE status != 'archived' AND type IN ('course', 'cohort') ORDER BY title LIMIT 500`),
      ),
      safeAudienceSqlRows<{ id: number; title: string }>("quizzes", () =>
        db.execute(sql`SELECT id, title FROM lms_courses WHERE status != 'archived' AND type = 'quiz' ORDER BY title LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; title: string }>("products", () =>
        db.execute(sql`SELECT id, title FROM digital_products WHERE status != 'archived' ORDER BY title LIMIT 500`),
      ),
      safeAudienceSqlRows<{ id: number; name: string }>("groups", () =>
        db.execute(sql`SELECT id, name FROM lms_groups ORDER BY name LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; name: string }>("cohortGroups", () =>
        db.execute(sql`SELECT id, name FROM lms_cohort_groups ORDER BY name LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; title: string }>("forms", () =>
        db.execute(sql`SELECT id, title FROM generalFormTemplates WHERE status != 'archived' ORDER BY title LIMIT 200`),
      ),
      (async () => {
        try {
          return await db
            .select({ id: lmsInterests.id, name: lmsInterests.name, category: lmsInterests.category })
            .from(lmsInterests)
            .where(eq(lmsInterests.isActive, true))
            .orderBy(lmsInterests.sortOrder)
            .limit(200);
        } catch (err) {
          console.error("[EmailCampaign] getAudienceOptions interests:", err);
          return [];
        }
      })(),
      (async () => {
        try {
          return await db
            .select({ id: emailLists.id, name: emailLists.name, subscriberCount: emailLists.subscriberCount })
            .from(emailLists)
            .where(eq(emailLists.isActive, true))
            .orderBy(desc(emailLists.createdAt))
            .limit(200);
        } catch (err) {
          console.error("[EmailCampaign] getAudienceOptions lists:", err);
          return [];
        }
      })(),
      safeAudienceSqlRows<{ id: number; title: string }>("membershipPlans", () =>
        db.execute(sql`SELECT id, title FROM membership_plans WHERE status != 'archived' ORDER BY title LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; title: string }>("bundles", () =>
        db.execute(sql`SELECT id, title FROM bundles ORDER BY title LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; title: string }>("digitalBundles", () =>
        db.execute(sql`SELECT id, title FROM digital_bundles WHERE status != 'archived' ORDER BY title LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; title: string }>("webinars", () =>
        db.execute(sql`SELECT id, title FROM webinars ORDER BY title LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; title: string }>("workshops", () =>
        db.execute(sql`SELECT id, title FROM workshops WHERE status != 'archived' ORDER BY title LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; title: string }>("communities", () =>
        db.execute(sql`SELECT id, title FROM communities WHERE status != 'archived' ORDER BY title LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; label: string }>("workshopInstances", () =>
        db.execute(sql`
          SELECT wi.id,
            CONCAT(w.title, ' — ', COALESCE(NULLIF(wi.title, ''), DATE_FORMAT(wi.start_date, '%b %d, %Y'))) as label
          FROM workshop_instances wi
          INNER JOIN workshops w ON w.id = wi.workshop_id
          WHERE wi.status != 'archived'
          ORDER BY wi.start_date DESC
          LIMIT 300
        `),
      ),
      safeAudienceSqlRows<{ id: number; title: string }>("physicalProducts", () =>
        db.execute(sql`SELECT id, title FROM physical_products WHERE status != 'archived' ORDER BY title LIMIT 200`),
      ),
      safeAudienceSqlRows<{ id: number; subject: string; sentAt: Date | null }>("sentCampaigns", () =>
        db.execute(sql`SELECT id, subject, sent_at as sentAt FROM email_campaigns WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 200`),
      ),
    ]);

    let roleRows: { role: string }[] = [];
    try {
      roleRows = await db.selectDistinct({ role: userRoles.role }).from(userRoles).limit(50);
    } catch (err) {
      console.error("[EmailCampaign] getAudienceOptions roles:", err);
    }

    return {
      courses: courses.map((r) => ({ id: r.id, label: r.title })),
      quizzes: quizzes.map((r) => ({ id: r.id, label: r.title })),
      products: products.map((r) => ({ id: r.id, label: r.title })),
      groups: groups.map((r) => ({ id: r.id, label: r.name })),
      cohortGroups: cohortGroups.map((r) => ({ id: r.id, label: r.name })),
      forms: forms.map((r) => ({ id: r.id, label: r.title })),
      interests: interests.map((r) => ({ id: r.id, label: r.name, category: r.category })),
      lists: lists.map((r) => ({ id: r.id, label: r.name, subscriberCount: r.subscriberCount })),
      roles: roleRows.map((r) => ({ id: r.role, label: r.role.replace(/_/g, " ") })),
      membershipPlans: membershipPlans.map((r) => ({ id: r.id, label: r.title })),
      bundles: bundles.map((r) => ({ id: r.id, label: r.title })),
      digitalBundles: digitalBundles.map((r) => ({ id: r.id, label: r.title })),
      webinars: webinars.map((r) => ({ id: r.id, label: r.title })),
      workshops: workshopsList.map((r) => ({ id: r.id, label: r.title })),
      communities: communities.map((r) => ({ id: r.id, label: r.title })),
      workshopInstances: workshopInstanceRows.map((r) => ({ id: r.id, label: r.label })),
      physicalProducts: physicalProducts.map((r) => ({ id: r.id, label: r.title })),
      sentCampaigns: (sentCampaigns as Array<{ id: number; subject: string; sentAt: Date | null }>).map((r) => ({ id: r.id, label: r.subject || `Campaign #${r.id}` })),
    };
  }),

  // ── Email block dynamic data ──────────────────────────────────────────────

  /**
   * Returns live data for the three dynamic email auto-content block types:
   * - membershipPlans: published plans with featureBullets
   * - cohortGroups: open/active cohort groups with course title and dates
   * - workshopInstances: upcoming available workshop instances with parent title
   * - bundles: published bundles
   */
  getEmailBlockOptions: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const now = new Date();

    const [plans, cohortGroupRows, instanceRows, bundleRows] = await Promise.all([
      db
        .select({
          id: membershipPlans.id,
          title: membershipPlans.title,
          subtitle: membershipPlans.subtitle,
          price: membershipPlans.price,
          compareAtPrice: membershipPlans.compareAtPrice,
          billingInterval: membershipPlans.billingInterval,
          coverImage: membershipPlans.coverImage,
          accentColor: membershipPlans.accentColor,
          featureBullets: membershipPlans.featureBullets,
          brand: membershipPlans.brand,
          slug: membershipPlans.slug,
        })
        .from(membershipPlans)
        .where(eq(membershipPlans.status, "published"))
        .orderBy(membershipPlans.sortOrder)
        .limit(50),

      db
        .select({
          id: lmsCohortGroups.id,
          name: lmsCohortGroups.name,
          description: lmsCohortGroups.description,
          startDate: lmsCohortGroups.startDate,
          endDate: lmsCohortGroups.endDate,
          location: lmsCohortGroups.location,
          status: lmsCohortGroups.status,
          courseId: lmsCohortGroups.courseId,
          courseTitle: lmsCourses.title,
          courseCoverImageUrl: lmsCourses.coverImageUrl,
          courseSlug: lmsCourses.slug,
          courseBrand: lmsCourses.brand,
          coursePrice: lmsCourses.price,
        })
        .from(lmsCohortGroups)
        .innerJoin(lmsCourses, eq(lmsCohortGroups.courseId, lmsCourses.id))
        .where(
          sql`${lmsCohortGroups.status} IN ('open','active') AND (${lmsCohortGroups.startDate} IS NULL OR ${lmsCohortGroups.startDate} >= ${now})`
        )
        .orderBy(lmsCohortGroups.startDate)
        .limit(50),

      db
        .select({
          id: workshopInstances.id,
          title: workshopInstances.title,
          description: workshopInstances.description,
          startDate: workshopInstances.startDate,
          endDate: workshopInstances.endDate,
          locationType: workshopInstances.locationType,
          venueCity: workshopInstances.venueCity,
          venueState: workshopInstances.venueState,
          price: workshopInstances.price,
          compareAtPrice: workshopInstances.compareAtPrice,
          workshopId: workshopInstances.workshopId,
          workshopTitle: workshops.title,
          workshopCoverImageUrl: workshops.coverImageUrl,
          workshopSlug: workshops.slug,
          workshopBrand: workshops.brand,
          workshopPrice: workshops.price,
        })
        .from(workshopInstances)
        .innerJoin(workshops, eq(workshopInstances.workshopId, workshops.id))
        .where(
          sql`${workshopInstances.status} = 'published' AND ${workshopInstances.availableForPurchase} = 1 AND ${workshopInstances.startDate} >= ${now}`
        )
        .orderBy(workshopInstances.startDate)
        .limit(50),

      db
        .select({
          id: bundles.id,
          title: bundles.title,
          subtitle: bundles.subtitle,
          price: bundles.price,
          coverImage: bundles.coverImage,
          brand: bundles.brand,
          slug: bundles.slug,
        })
        .from(bundles)
        .where(eq(bundles.status, "published"))
        .orderBy(bundles.title)
        .limit(50),
    ]);

    return {
      membershipPlans: plans.map((p) => ({
        ...p,
        featureBullets: p.featureBullets ? (() => { try { return JSON.parse(p.featureBullets as string); } catch { return []; } })() : [],
      })),
      cohortGroups: cohortGroupRows,
      workshopInstances: instanceRows,
      bundles: bundleRows,
    };
  }),

  // ── Admin: list campaigns ─────────────────────────────────────────────────

  getCampaign: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, input.id)).limit(1);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      return campaign;
    }),

  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const campaigns = await db
      .select()
      .from(emailCampaigns)
      .orderBy(desc(emailCampaigns.createdAt))
      .limit(100);
    if (campaigns.length === 0) return [];

    const metricsMap = await loadCampaignMetricsMap(db, campaigns.map((c) => c.id));

    return campaigns.map((c) => {
      const m = metricsMap.get(c.id);
      const sent = c.recipientCount ?? 0;
      const openCount = Number(m?.openCount ?? 0);
      const clickCount = Number(m?.clickCount ?? 0);
      const uniqueOpenCount = Number(m?.uniqueOpenCount ?? 0);
      const uniqueClickCount = Number(m?.uniqueClickCount ?? 0);
      const unsubscribeCount = Number(m?.unsubscribeCount ?? 0);
      return {
        ...c,
        openCount,
        clickCount,
        uniqueOpenCount,
        uniqueClickCount,
        unsubscribeCount,
        openRate: sent > 0 ? Math.round((uniqueOpenCount / sent) * 100) : 0,
        clickRate: sent > 0 ? Math.round((uniqueClickCount / sent) * 100) : 0,
      };
    });
  }),

  // ── Admin: campaign analytics ─────────────────────────────────────────────

  getCampaignAnalytics: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [campaign] = await db
        .select()
        .from(emailCampaigns)
        .where(eq(emailCampaigns.id, input.campaignId))
        .limit(1);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      const [eventsRaw] = (await db.execute(sql`
        SELECT eventType, COUNT(*) as cnt
        FROM emailCampaignEvents
        WHERE campaignId = ${input.campaignId}
        GROUP BY eventType
      `)) as [{ eventType: string; cnt: number }[], unknown];

      const [uniqueRaw] = (await db.execute(sql`
        SELECT
          eventType,
          COUNT(DISTINCT recipientKey) as uniqueCnt
        FROM emailCampaignEvents
        WHERE campaignId = ${input.campaignId}
        GROUP BY eventType
      `)) as [{ eventType: string; uniqueCnt: number }[], unknown];

      const [topLinksRaw] = (await db.execute(sql`
        SELECT
          CASE
            WHEN metadata LIKE '{%' THEN JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.url'))
            ELSE metadata
          END as url,
          COUNT(*) as clicks
        FROM emailCampaignEvents
        WHERE campaignId = ${input.campaignId} AND eventType = 'click' AND metadata IS NOT NULL
        GROUP BY url
        ORDER BY clicks DESC
        LIMIT 10
      `)) as [{ url: string; clicks: number }[], unknown];

      let ordersRaw: { orderCount: number; revenueCents: number }[] = [];
      try {
        const [_ordersRaw] = (await db.execute(sql`
          SELECT COUNT(DISTINCT lo.id) as orderCount, COALESCE(SUM(lo.amount), 0) as revenueCents
          FROM lms_orders lo
          INNER JOIN users u ON u.id = lo.user_id
          INNER JOIN emailCampaignEvents e ON e.userId = u.id
            AND e.campaignId = ${input.campaignId}
            AND e.eventType = 'click'
          WHERE lo.status = 'paid'
            AND lo.created_at >= (
              SELECT MIN(createdAt) FROM emailCampaignEvents WHERE campaignId = ${input.campaignId}
            )
        `)) as [{ orderCount: number; revenueCents: number }[], unknown];
        ordersRaw = Array.isArray(_ordersRaw) ? _ordersRaw : [];
      } catch (err) {
        console.error("[EmailCampaign] orders attribution query failed (non-fatal):", err);
      }

      let variantRaw: { variant: string; eventType: string; cnt: number }[] = [];
      try {
        const [_variantRaw] = (await db.execute(sql`
          SELECT
            JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.variant')) as variant,
            eventType,
            COUNT(*) as cnt
          FROM emailCampaignEvents
          WHERE campaignId = ${input.campaignId}
            AND metadata LIKE '%"variant"%'
          GROUP BY variant, eventType
        `)) as [{ variant: string; eventType: string; cnt: number }[], unknown];
        variantRaw = Array.isArray(_variantRaw) ? _variantRaw : [];
      } catch (err) {
        console.error("[EmailCampaign] variant stats query failed (non-fatal):", err);
      }

      const events = Array.isArray(eventsRaw) ? eventsRaw : [];
      const uniqueEvents = Array.isArray(uniqueRaw) ? uniqueRaw : [];
      const totalOpens = Number(events.find((e) => e.eventType === "open")?.cnt ?? 0);
      const totalClicks = Number(events.find((e) => e.eventType === "click")?.cnt ?? 0);
      const totalUnsubscribes = Number(events.find((e) => e.eventType === "unsubscribe")?.cnt ?? 0);
      const uniqueOpens = Number(uniqueEvents.find((e) => e.eventType === "open")?.uniqueCnt ?? 0);
      const uniqueClicks = Number(uniqueEvents.find((e) => e.eventType === "click")?.uniqueCnt ?? 0);
      const sent = campaign.recipientCount ?? 0;

      const variantStats: Record<string, { opens: number; clicks: number }> = {};
      for (const row of Array.isArray(variantRaw) ? variantRaw : []) {
        if (!row.variant) continue;
        if (!variantStats[row.variant]) variantStats[row.variant] = { opens: 0, clicks: 0 };
        if (row.eventType === "open") variantStats[row.variant].opens += Number(row.cnt);
        if (row.eventType === "click") variantStats[row.variant].clicks += Number(row.cnt);
      }

      const openRate = sent > 0 ? Math.round((uniqueOpens / sent) * 100) : 0;
      const clickRate = sent > 0 ? Math.round((uniqueClicks / sent) * 100) : 0;
      const unsubscribeRate = sent > 0 ? Math.round((totalUnsubscribes / sent) * 100) : 0;

      return {
        campaignId: campaign.id,
        subject: campaign.subject,
        status: campaign.status,
        sentAt: campaign.sentAt,
        recipientCount: sent,
        totalSent: sent,
        totalOpens,
        totalClicks,
        totalUnsubscribes,
        uniqueOpens,
        uniqueClicks,
        openCount: totalOpens,
        clickCount: totalClicks,
        unsubscribeCount: totalUnsubscribes,
        openRate,
        clickRate,
        unsubscribeRate,
        topLinks: (Array.isArray(topLinksRaw) ? topLinksRaw : []).map((r) => ({
          url: r.url,
          clicks: Number(r.clicks),
        })),
        orders: {
          count: Number(ordersRaw[0]?.orderCount ?? 0),
          revenueCents: Number(ordersRaw[0]?.revenueCents ?? 0),
        },
        variantStats,
      };
    }),

  // ── Admin: deep analytics — per-recipient list ────────────────────────────

  getCampaignRecipients: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      eventType: z.enum(["open", "click", "unsubscribe"]).optional(),
      limit: z.number().min(1).max(500).default(200),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const eventFilter = input.eventType
        ? sql`AND e.eventType = ${input.eventType}`
        : sql``;

      const [rows] = (await db.execute(sql`
        SELECT
          e.recipientKey,
          e.eventType,
          e.country,
          e.region,
          e.city,
          e.createdAt,
          COALESCE(u.name, u.email, JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.recipient'))) as displayName,
          COALESCE(u.email, JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.recipient'))) as email,
          u.id as userId
        FROM emailCampaignEvents e
        LEFT JOIN users u ON u.id = e.userId
        WHERE e.campaignId = ${input.campaignId}
          ${eventFilter}
        ORDER BY e.createdAt DESC
        LIMIT ${input.limit} OFFSET ${input.offset}
      `)) as [{
        recipientKey: string; eventType: string; country: string | null; region: string | null;
        city: string | null; createdAt: Date; displayName: string | null; email: string | null; userId: number | null;
      }[], unknown];

      const [countRaw] = (await db.execute(sql`
        SELECT COUNT(*) as total
        FROM emailCampaignEvents e
        WHERE e.campaignId = ${input.campaignId}
          ${eventFilter}
      `)) as [{ total: number }[], unknown];

      return {
        recipients: (Array.isArray(rows) ? rows : []).map((r) => ({
          recipientKey: r.recipientKey,
          eventType: r.eventType,
          displayName: r.displayName ?? r.email ?? r.recipientKey,
          email: r.email,
          userId: r.userId,
          country: r.country,
          region: r.region,
          city: r.city,
          timestamp: r.createdAt,
        })),
        total: Number((Array.isArray(countRaw) ? countRaw[0] : null)?.total ?? 0),
      };
    }),

  // ── Admin: deep analytics — geo breakdown ────────────────────────────────

  getCampaignGeo: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [byCountry] = (await db.execute(sql`
        SELECT country, COUNT(DISTINCT recipientKey) as uniqueRecipients, COUNT(*) as totalEvents
        FROM emailCampaignEvents
        WHERE campaignId = ${input.campaignId} AND country IS NOT NULL AND country != ''
        GROUP BY country
        ORDER BY uniqueRecipients DESC
        LIMIT 50
      `)) as [{ country: string; uniqueRecipients: number; totalEvents: number }[], unknown];

      const [byRegion] = (await db.execute(sql`
        SELECT country, region, COUNT(DISTINCT recipientKey) as uniqueRecipients, COUNT(*) as totalEvents
        FROM emailCampaignEvents
        WHERE campaignId = ${input.campaignId} AND region IS NOT NULL AND region != ''
        GROUP BY country, region
        ORDER BY uniqueRecipients DESC
        LIMIT 100
      `)) as [{ country: string; region: string; uniqueRecipients: number; totalEvents: number }[], unknown];

      return {
        byCountry: (Array.isArray(byCountry) ? byCountry : []).map((r) => ({
          country: r.country,
          uniqueRecipients: Number(r.uniqueRecipients),
          totalEvents: Number(r.totalEvents),
        })),
        byRegion: (Array.isArray(byRegion) ? byRegion : []).map((r) => ({
          country: r.country,
          region: r.region,
          uniqueRecipients: Number(r.uniqueRecipients),
          totalEvents: Number(r.totalEvents),
        })),
      };
    }),

  // ── Admin: create email list segment from campaign engagement ─────────────

  createSegmentFromCampaign: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      eventType: z.enum(["open", "click", "unsubscribe"]),
      listName: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Create the new email list
      const [listResult] = await db.insert(emailLists).values({
        name: input.listName,
        description: `Auto-created from campaign #${input.campaignId} ${input.eventType}s`,
        isActive: true,
        subscriberCount: 0,
      });
      const listId = (listResult as any).insertId as number;

      // Get unique recipients who performed the event
      const [recipientsRaw] = (await db.execute(sql`
        SELECT DISTINCT
          e.recipientKey,
          COALESCE(u.email, JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.recipient'))) as email,
          COALESCE(u.name, u.email) as name,
          u.id as userId
        FROM emailCampaignEvents e
        LEFT JOIN users u ON u.id = e.userId
        WHERE e.campaignId = ${input.campaignId}
          AND e.eventType = ${input.eventType}
          AND (u.email IS NOT NULL OR JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.recipient')) IS NOT NULL)
      `)) as [{ recipientKey: string; email: string | null; name: string | null; userId: number | null }[], unknown];

      const recipients = Array.isArray(recipientsRaw) ? recipientsRaw : [];
      let added = 0;

      for (const r of recipients) {
        if (!r.email) continue;
        try {
          await db.insert(emailListSubscribers).values({
            listId,
            email: r.email,
            name: r.name ?? undefined,
            userId: r.userId ?? undefined,
            source: "campaign_segment",
            sourceId: String(input.campaignId),
            status: "subscribed",
          });
          added++;
        } catch { /* skip duplicates */ }
      }

      // Update subscriber count
      await db.update(emailLists).set({ subscriberCount: added }).where(eq(emailLists.id, listId));

      return { listId, listName: input.listName, added };
    }),

  // ── Admin: duplicate campaign ─────────────────────────────────────────────

  duplicateCampaign: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [orig] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, input.id)).limit(1);
      if (!orig) throw new TRPCError({ code: "NOT_FOUND" });
      const [r] = await db.insert(emailCampaigns).values({
        sentByUserId: ctx.user.id,
        subject: `Copy of ${orig.subject}`,
        htmlBody: orig.htmlBody,
        previewText: orig.previewText,
        audienceFilter: orig.audienceFilter,
        status: "draft",
        senderProfileId: orig.senderProfileId,
        fromName: orig.fromName,
        fromEmail: orig.fromEmail,
      });
      return { id: (r as any).insertId as number };
    }),

  // ── Admin: email lists CRUD ───────────────────────────────────────────────

  listEmailLists: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    return db.select().from(emailLists).orderBy(desc(emailLists.createdAt));
  }),

  createEmailList: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [r] = await db.insert(emailLists).values({
        name: input.name,
        description: input.description ?? null,
        isActive: true,
        subscriberCount: 0,
      });
      return { id: (r as any).insertId as number };
    }),

  updateEmailList: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.isActive !== undefined) updates.isActive = input.isActive;
      if (Object.keys(updates).length > 0) {
        await db.update(emailLists).set(updates as any).where(eq(emailLists.id, input.id));
      }
      return { success: true };
    }),

  deleteEmailList: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Prevent deleting the master All Contacts list
      const [list] = await db.select({ name: emailLists.name }).from(emailLists).where(eq(emailLists.id, input.id)).limit(1);
      if (list?.name === "All Contacts") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The \"All Contacts\" list cannot be deleted." });
      }
      await db.delete(emailListSubscribers).where(eq(emailListSubscribers.listId, input.id));
      await db.delete(emailLists).where(eq(emailLists.id, input.id));
      return { success: true };
    }),

  getEmailListSubscribers: protectedProcedure
    .input(z.object({
      listId: z.number(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(200).default(50),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const offset = (input.page - 1) * input.pageSize;
      let rows;
      if (input.search) {
        const pattern = `%${input.search}%`;
        rows = await db.execute(sql`
          SELECT * FROM emailListSubscribers
          WHERE listId = ${input.listId}
            AND (email LIKE ${pattern} OR name LIKE ${pattern})
          ORDER BY subscribedAt DESC
          LIMIT ${input.pageSize} OFFSET ${offset}
        `);
      } else {
        rows = await db.execute(sql`
          SELECT * FROM emailListSubscribers
          WHERE listId = ${input.listId}
          ORDER BY subscribedAt DESC
          LIMIT ${input.pageSize} OFFSET ${offset}
        `);
      }
      const [countRaw] = await db.execute(sql`SELECT COUNT(*) as cnt FROM emailListSubscribers WHERE listId = ${input.listId}`) as any;
      const total = Number((countRaw as any[])[0]?.cnt ?? 0);
      return { subscribers: (rows[0] as any[]) ?? [], total, page: input.page, pageSize: input.pageSize };
    }),

  removeSubscriber: protectedProcedure
    .input(z.object({ subscriberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Mark as unsubscribed (soft delete)
      await db.update(emailListSubscribers)
        .set({ status: "unsubscribed", unsubscribedAt: new Date() })
        .where(eq(emailListSubscribers.id, input.subscriberId));
      // Decrement subscriber count
      const [sub] = await db.select({ listId: emailListSubscribers.listId })
        .from(emailListSubscribers).where(eq(emailListSubscribers.id, input.subscriberId)).limit(1);
      if (sub) {
        await db.update(emailLists)
          .set({ subscriberCount: sql`GREATEST(0, subscriberCount - 1)` })
          .where(eq(emailLists.id, sub.listId));
      }
      return { success: true };
    }),

  addSubscriberManually: protectedProcedure
    .input(z.object({
      listId: z.number(),
      email: z.string().email(),
      name: z.string().max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      await addToEmailList(input.listId, input.email, input.name ?? null, { source: "manual" });
      return { success: true };
    }),

  // ── Admin: save draft campaign ────────────────────────────────────────────

  saveDraft: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      subject: z.string().max(500).default(""),
      htmlBody: z.string().default(""),
      blocksJson: z.string().optional(),
      previewText: z.string().max(300).optional(),
      audienceFilter: AudienceFilterSchema.optional(),
      senderProfileId: z.number().optional(),
      fromName: z.string().max(200).optional(),
      fromEmail: z.string().max(300).optional(),
      headerTitle: z.string().max(300).optional(),
      headerSubtext: z.string().max(500).optional(),
      headerColor: z.string().max(20).optional(),
      headerEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const vals = {
        subject: input.subject,
        htmlBody: input.htmlBody ? normalizeCampaignEmailHtml(input.htmlBody) : input.htmlBody,
        blocksJson: input.blocksJson ?? null,
        previewText: input.previewText ?? null,
        audienceFilter: JSON.stringify(input.audienceFilter ?? {}),
        status: "draft" as const,
        senderProfileId: input.senderProfileId ?? null,
        fromName: input.fromName ?? null,
        fromEmail: input.fromEmail ?? null,
        headerTitle: input.headerTitle ?? null,
        headerSubtext: input.headerSubtext ?? null,
        headerColor: input.headerColor ?? null,
        headerEnabled: input.headerEnabled ?? true,
      };
      if (input.id) {
        await db.update(emailCampaigns).set(vals).where(eq(emailCampaigns.id, input.id));
        return { id: input.id };
      } else {
        const [r] = await db.insert(emailCampaigns).values({ ...vals, sentByUserId: ctx.user.id });
        return { id: (r as any).insertId as number };
      }
    }),

  // ─── Lead Capture Widgets ────────────────────────────────────────────────────

  listLeadCaptureWidgets: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    return db.select().from(leadCaptureWidgets).orderBy(desc(leadCaptureWidgets.createdAt));
  }),

  saveLeadCaptureWidget: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1).max(255),
      headline: z.string().max(500).optional(),
      subtext: z.string().max(1000).optional(),
      emailPlaceholder: z.string().max(200).optional(),
      namePlaceholder: z.string().max(200).optional(),
      buttonText: z.string().max(200).optional(),
      buttonColor: z.string().max(20).optional(),
      buttonTextColor: z.string().max(20).optional(),
      bgColor: z.string().max(20).optional(),
      textColor: z.string().max(20).optional(),
      borderRadius: z.number().min(0).max(50).optional(),
      showNameField: z.boolean().optional(),
      listId: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const vals = {
        name: input.name,
        headline: input.headline ?? "Stay in the loop",
        subtext: input.subtext ?? null,
        emailPlaceholder: input.emailPlaceholder ?? "Enter your email",
        namePlaceholder: input.namePlaceholder ?? "Your name (optional)",
        buttonText: input.buttonText ?? "Subscribe",
        buttonColor: input.buttonColor ?? "#189aa1",
        buttonTextColor: input.buttonTextColor ?? "#ffffff",
        bgColor: input.bgColor ?? "#f0fbfc",
        textColor: input.textColor ?? "#0e1e2e",
        borderRadius: input.borderRadius ?? 8,
        showNameField: input.showNameField ?? false,
        listId: input.listId ?? null,
      };
      if (input.id) {
        await db.update(leadCaptureWidgets).set(vals as any).where(eq(leadCaptureWidgets.id, input.id));
        return { id: input.id };
      } else {
        const [r] = await db.insert(leadCaptureWidgets).values(vals as any);
        return { id: (r as any).insertId as number };
      }
    }),

  deleteLeadCaptureWidget: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(leadCaptureWidgets).where(eq(leadCaptureWidgets.id, input.id));
      return { ok: true };
    }),

  // ─── Email List: CSV Import ────────────────────────────────────────────────────
  importSubscribersFromCsv: protectedProcedure
    .input(z.object({
      listId: z.number(),
      rows: z.array(z.object({
        email: z.string().email(),
        name: z.string().max(300).optional(),
      })).min(1).max(10000),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [list] = await db.select({ id: emailLists.id }).from(emailLists).where(eq(emailLists.id, input.listId)).limit(1);
      if (!list) throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      let imported = 0;
      let skipped = 0;
      for (const row of input.rows) {
        try {
          await addToEmailList(input.listId, row.email.trim().toLowerCase(), row.name?.trim(), { source: "csv_import" });
          imported++;
        } catch { skipped++; }
      }
      return { imported, skipped, total: input.rows.length };
    }),

  // ─── Email List: Generate / Rotate Webhook Token ─────────────────────────────
  generateWebhookToken: protectedProcedure
    .input(z.object({ listId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const token = randomBytes(32).toString("hex");
      await db.update(emailLists).set({ webhookToken: token } as any).where(eq(emailLists.id, input.listId));
      return { token };
    }),

  // ─── Email List: Get connected sources (forms + widgets) ─────────────────────
  getListConnectedSources: protectedProcedure
    .input(z.object({ listId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const widgets = await db.select({ id: leadCaptureWidgets.id, name: leadCaptureWidgets.name })
        .from(leadCaptureWidgets).where(eq(leadCaptureWidgets.listId, input.listId));
      return { widgets, forms: [] as { id: number; name: string }[] };
    }),

  // ─── Email List: Bulk remove subscribers ─────────────────────────────────────
  bulkRemoveSubscribers: protectedProcedure
    .input(z.object({
      listId: z.number(),
      subscriberIds: z.array(z.number()).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(emailListSubscribers)
        .set({ status: "unsubscribed", unsubscribedAt: new Date() })
        .where(and(
          eq(emailListSubscribers.listId, input.listId),
          inArray(emailListSubscribers.id, input.subscriberIds),
        ));
      await db.update(emailLists)
        .set({ subscriberCount: sql`GREATEST(subscriberCount - ${input.subscriberIds.length}, 0)` })
        .where(eq(emailLists.id, input.listId));
      return { removed: input.subscriberIds.length };
    }),

  // ── Admin: per-link click breakdown ─────────────────────────────────────────
  getClickLinkBreakdown: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Per-link aggregate: URL, total clicks, unique clickers
      const [linksRaw] = (await db.execute(sql`
        SELECT
          CASE
            WHEN metadata LIKE '{%' THEN JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.url'))
            ELSE metadata
          END as url,
          COUNT(*) as totalClicks,
          COUNT(DISTINCT recipientKey) as uniqueClickers
        FROM emailCampaignEvents
        WHERE campaignId = ${input.campaignId}
          AND eventType = 'click'
          AND metadata IS NOT NULL
        GROUP BY url
        ORDER BY totalClicks DESC
      `)) as [{ url: string; totalClicks: number; uniqueClickers: number }[], unknown];
      // Per-click detail: who clicked what and when
      const [detailRaw] = (await db.execute(sql`
        SELECT
          e.recipientKey,
          CASE
            WHEN e.metadata LIKE '{%' THEN JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.url'))
            ELSE e.metadata
          END as url,
          e.createdAt,
          e.country,
          e.region,
          e.city,
          COALESCE(u.name, u.email, JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.recipient'))) as displayName,
          COALESCE(u.email, JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.recipient'))) as email,
          u.id as userId
        FROM emailCampaignEvents e
        LEFT JOIN users u ON u.id = e.userId
        WHERE e.campaignId = ${input.campaignId}
          AND e.eventType = 'click'
          AND e.metadata IS NOT NULL
        ORDER BY e.createdAt DESC
        LIMIT 2000
      `)) as [{
        recipientKey: string; url: string; createdAt: Date;
        country: string | null; region: string | null; city: string | null;
        displayName: string | null; email: string | null; userId: number | null;
      }[], unknown];
      const links = (Array.isArray(linksRaw) ? linksRaw : []).map((r) => ({
        url: r.url ?? "(unknown)",
        totalClicks: Number(r.totalClicks),
        uniqueClickers: Number(r.uniqueClickers),
      }));
      const detail = (Array.isArray(detailRaw) ? detailRaw : []).map((r) => ({
        url: r.url ?? "(unknown)",
        recipientKey: r.recipientKey,
        displayName: r.displayName ?? r.email ?? r.recipientKey,
        email: r.email ?? null,
        userId: r.userId ?? null,
        country: r.country ?? null,
        region: r.region ?? null,
        city: r.city ?? null,
        timestamp: r.createdAt,
      }));
      return { links, detail };
    }),

  // ── Admin: export click events as CSV rows ────────────────────────────────
  exportClickEvents: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [rows] = (await db.execute(sql`
        SELECT
          COALESCE(u.name, u.email, JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.recipient')), e.recipientKey) as displayName,
          COALESCE(u.email, JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.recipient'))) as email,
          CASE
            WHEN e.metadata LIKE '{%' THEN JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.url'))
            ELSE e.metadata
          END as url,
          e.createdAt,
          e.country,
          e.region,
          e.city
        FROM emailCampaignEvents e
        LEFT JOIN users u ON u.id = e.userId
        WHERE e.campaignId = ${input.campaignId}
          AND e.eventType = 'click'
          AND e.metadata IS NOT NULL
        ORDER BY e.createdAt DESC
        LIMIT 10000
      `)) as [{
        displayName: string | null; email: string | null; url: string | null;
        createdAt: Date; country: string | null; region: string | null; city: string | null;
      }[], unknown];
      return {
        rows: (Array.isArray(rows) ? rows : []).map((r) => ({
          displayName: r.displayName ?? "",
          email: r.email ?? "",
          url: r.url ?? "(unknown)",
          timestamp: r.createdAt,
          country: r.country ?? "",
          region: r.region ?? "",
          city: r.city ?? "",
        })),
      };
    }),

  // Public: submit a lead capture widget form (embedded on external sites)
  submitLeadCaptureWidget: publicProcedure
    .input(z.object({
      widgetId: z.number(),
      email: z.string().email(),
      name: z.string().max(300).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [widget] = await db.select().from(leadCaptureWidgets).where(eq(leadCaptureWidgets.id, input.widgetId)).limit(1);
      if (!widget) throw new TRPCError({ code: "NOT_FOUND", message: "Widget not found" });
      // Add to All Contacts
      await ensureAllContactsList();
      const allContactsList = await db.select({ id: emailLists.id }).from(emailLists).where(eq(emailLists.name, "All Contacts")).limit(1);
      if (allContactsList.length > 0) {
        await addToEmailList(allContactsList[0].id, input.email, input.name, { source: "lead_capture_widget", sourceId: String(input.widgetId) });
      }
      // Add to specific list if configured
      if (widget.listId) {
        await addToEmailList(widget.listId, input.email, input.name, { source: "lead_capture_widget", sourceId: String(input.widgetId) });
      }
      return { ok: true };
    }),
});
