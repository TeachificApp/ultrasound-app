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
import { eq, and, desc, lte, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  users,
  emailTemplates,
  emailCampaigns,
  emailSenderProfiles,
  userRoles,
  lmsEnrollments,
  digitalPurchases,
  digitalDownloadEvents,
  lmsGroupSeats,
  lmsCohortGroupEnrollments,
  generalFormSubmissions,
  lmsGroups,
  lmsCohortGroups,
  emailLists,
  emailListSubscribers,
  leadCaptureWidgets,
} from "../../drizzle/schema";
import { addToEmailList, ensureAllContactsList } from "../lib/emailListHelper";
import { sendEmail } from "../_core/email";
import { randomBytes } from "crypto";
import { addToSendGridGlobalUnsubscribes } from "../lib/sendgridSuppressions";

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
  /** Filter to users enrolled in specific course IDs */
  enrolledInCourseIds: z.array(z.number().int()).default([]),
  /** Filter to users who purchased specific digital product IDs */
  purchasedProductIds: z.array(z.number().int()).default([]),
  /** Filter to users who downloaded specific digital product IDs */
  downloadedProductIds: z.array(z.number().int()).default([]),
  /** Filter to users in specific team/group IDs (lmsGroups) */
  inGroupIds: z.array(z.number().int()).default([]),
  /** Filter to users in specific cohort group IDs (lmsCohortGroups) */
  inCohortGroupIds: z.array(z.number().int()).default([]),
  /** Filter to users who submitted a specific general form ID */
  submittedFormIds: z.array(z.number().int()).default([]),
  /** Filter to users who completed a course (progressPct = 100) */
  completedCourseIds: z.array(z.number().int()).default([]),
  /** AND/OR logic between filter groups: "and" = must match all, "or" = match any */
  logic: z.enum(["and", "or"]).default("and"),
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
  const appUrl = process.env.VITE_APP_URL || "https://app.allaboutultrasound.com";
  return `${appUrl}/unsubscribe?token=${token}`;
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

  // Apply course enrollment filter
  if (filter.enrolledInCourseIds && filter.enrolledInCourseIds.length > 0) {
    const enrolledUserIds = new Set<number>();
    for (const courseId of filter.enrolledInCourseIds) {
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(eq(lmsEnrollments.courseId, courseId));
      rows.forEach(r => enrolledUserIds.add(r.userId));
    }
    allUsers = allUsers.filter(u => enrolledUserIds.has(u.id));
  }

  // Apply completed course filter
  if (filter.completedCourseIds && filter.completedCourseIds.length > 0) {
    const completedUserIds = new Set<number>();
    for (const courseId of filter.completedCourseIds) {
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.courseId, courseId), isNotNull(lmsEnrollments.completedAt)));
      rows.forEach(r => completedUserIds.add(r.userId));
    }
    allUsers = allUsers.filter(u => completedUserIds.has(u.id));
  }

  // Apply digital product purchase filter
  if (filter.purchasedProductIds && filter.purchasedProductIds.length > 0) {
    const purchasedUserIds = new Set<number>();
    for (const productId of filter.purchasedProductIds) {
      const rows = await db
        .select({ userId: digitalPurchases.userId })
        .from(digitalPurchases)
        .where(eq(digitalPurchases.productId, productId));
      rows.forEach(r => purchasedUserIds.add(r.userId));
    }
    allUsers = allUsers.filter(u => purchasedUserIds.has(u.id));
  }

  // Apply digital download filter
  if (filter.downloadedProductIds && filter.downloadedProductIds.length > 0) {
    const downloadedUserIds = new Set<number>();
    for (const productId of filter.downloadedProductIds) {
      const rows = await db
        .select({ userId: digitalDownloadEvents.userId })
        .from(digitalDownloadEvents)
        .where(eq(digitalDownloadEvents.productId, productId));
      rows.forEach(r => downloadedUserIds.add(r.userId));
    }
    allUsers = allUsers.filter(u => downloadedUserIds.has(u.id));
  }

  // Apply team/group filter (lmsGroupSeats — match by email)
  if (filter.inGroupIds && filter.inGroupIds.length > 0) {
    const groupEmails = new Set<string>();
    for (const groupId of filter.inGroupIds) {
      const rows = await db
        .select({ email: lmsGroupSeats.email })
        .from(lmsGroupSeats)
        .where(and(eq(lmsGroupSeats.groupId, groupId), eq(lmsGroupSeats.status, "active")));
      rows.forEach(r => { if (r.email) groupEmails.add(r.email.toLowerCase()); });
    }
    allUsers = allUsers.filter(u => u.email && groupEmails.has(u.email.toLowerCase()));
  }

  // Apply cohort group filter (lmsCohortGroupEnrollments)
  if (filter.inCohortGroupIds && filter.inCohortGroupIds.length > 0) {
    const cohortUserIds = new Set<number>();
    for (const cohortGroupId of filter.inCohortGroupIds) {
      const rows = await db
        .select({ userId: lmsCohortGroupEnrollments.userId })
        .from(lmsCohortGroupEnrollments)
        .where(eq(lmsCohortGroupEnrollments.cohortGroupId, cohortGroupId));
      rows.forEach(r => cohortUserIds.add(r.userId));
    }
    allUsers = allUsers.filter(u => cohortUserIds.has(u.id));
  }

  // Apply form submission filter
  if (filter.submittedFormIds && filter.submittedFormIds.length > 0) {
    const formUserEmails = new Set<string>();
    for (const formId of filter.submittedFormIds) {
      const rows = await db
        .select({ userEmail: generalFormSubmissions.userEmail })
        .from(generalFormSubmissions)
        .where(and(eq(generalFormSubmissions.formId, formId), isNotNull(generalFormSubmissions.userEmail)));
      rows.forEach(r => { if (r.userEmail) formUserEmails.add(r.userEmail.toLowerCase()); });
    }
    allUsers = allUsers.filter(u => u.email && formUserEmails.has(u.email.toLowerCase()));
  }

  return allUsers.map((u) => ({
    id: u.id,
    email: u.email!,
    displayName: u.displayName,
    name: u.name,
  }));
}

// ─── Core send function (shared by immediate and scheduled sends) ─────────────

/** Inject a 1x1 tracking pixel into an HTML email body */
function injectTrackingPixel(html: string, campaignId: number, userId: number): string {
  const appUrl = process.env.CANONICAL_ROOT_DOMAIN || "https://app.allaboutultrasound.com";
  const pixelUrl = `${appUrl}/api/email/track/open/${campaignId}/${userId}.gif`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;" />`;
  if (html.includes("</body>")) return html.replace("</body>", `${pixel}</body>`);
  return html + pixel;
}

/** Wrap all <a href="..."> links in the email with click-tracking redirect */
function wrapLinksForTracking(html: string, campaignId: number, userId: number): string {
  const appUrl = process.env.CANONICAL_ROOT_DOMAIN || "https://app.allaboutultrasound.com";
  // Use a string-based approach to avoid regex literal issues with esbuild
  const hrefPattern = new RegExp('href="(https?://[^"]+)"', 'gi');
  return html.replace(hrefPattern, (_, url: string) => {
    if (url.includes("/api/email/track/") || url.includes("/unsubscribe")) return `href="${url}"`;
    const encoded = encodeURIComponent(url);
    return `href="${appUrl}/api/email/track/click/${campaignId}/${userId}?url=${encoded}"`;
  });
}

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

  const recipients = await resolveRecipients(filter);
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    // Ensure unsubscribe token exists for this user
    const token = await ensureUnsubscribeToken(recipient.id);
    const unsubscribeUrl = buildUnsubscribeUrl(token);
    // Inject footer, tracking pixel, and wrap links
    let html = injectUnsubscribeFooter(campaign.htmlBody, unsubscribeUrl);
    html = injectTrackingPixel(html, campaignId, recipient.id);
    html = wrapLinksForTracking(html, campaignId, recipient.id);

    const displayName = recipient.displayName || recipient.name || recipient.email;
    const ok = await sendEmail({
      to: { name: displayName, email: recipient.email },
      subject: campaign.subject,
      htmlBody: html,
      previewText: campaign.previewText ?? undefined,
      fromName: senderName,
      fromEmail: senderEmail,
      listUnsubscribeUrl: unsubscribeUrl,
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
    .input(z.object({ token: z.string().min(1) }))
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
        // Add to SendGrid Global Unsubscribe list — blocks delivery across all apps
        if (u.email) {
          await addToSendGridGlobalUnsubscribes([u.email]);
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
        subject: z.string().min(1).max(500),
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
        blocksJson: input.blocksJson ?? null,
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
        blocksJson: z.string().optional(),
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
        blocksJson: input.blocksJson ?? null,
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

  // ── Admin: option lists for audience builder ──────────────────────────────

  getAudienceOptions: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [courses, products, groups, cohortGroups, forms] = await Promise.all([
      db.execute(sql`SELECT id, title FROM lms_courses WHERE status='published' ORDER BY title LIMIT 200`),
      db.execute(sql`SELECT id, title FROM digital_products WHERE is_active=1 ORDER BY title LIMIT 200`),
      db.execute(sql`SELECT id, name FROM lms_groups ORDER BY name LIMIT 200`),
      db.execute(sql`SELECT id, name FROM lmsCohortGroups ORDER BY name LIMIT 200`),
      db.execute(sql`SELECT id, title FROM generalFormTemplates WHERE status='open' ORDER BY title LIMIT 200`),
    ]);
    return {
      courses: (courses[0] as any[]).map((r: any) => ({ id: r.id, label: r.title })),
      products: (products[0] as any[]).map((r: any) => ({ id: r.id, label: r.title })),
      groups: (groups[0] as any[]).map((r: any) => ({ id: r.id, label: r.name })),
      cohortGroups: (cohortGroups[0] as any[]).map((r: any) => ({ id: r.id, label: r.name })),
      forms: (forms[0] as any[]).map((r: any) => ({ id: r.id, label: r.title })),
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
    return db
      .select()
      .from(emailCampaigns)
      .orderBy(desc(emailCampaigns.createdAt))
      .limit(100);
  }),

  // ── Admin: campaign analytics ─────────────────────────────────────────────

  getCampaignAnalytics: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, input.campaignId)).limit(1);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      // Count events from emailCampaignEvents table
      const [eventsRaw] = await db.execute(sql`
        SELECT eventType, COUNT(*) as cnt
        FROM emailCampaignEvents
        WHERE campaignId = ${input.campaignId}
        GROUP BY eventType
      `) as any;
      const events = Array.isArray(eventsRaw) ? eventsRaw : [];
      const opens = events.find((e: any) => e.eventType === 'open')?.cnt ?? 0;
      const clicks = events.find((e: any) => e.eventType === 'click')?.cnt ?? 0;
      const unsubs = events.find((e: any) => e.eventType === 'unsubscribe')?.cnt ?? 0;
      const sent = campaign.recipientCount ?? 0;
      return {
        campaignId: campaign.id,
        subject: campaign.subject,
        status: campaign.status,
        sentAt: campaign.sentAt,
        recipientCount: sent,
        openCount: Number(opens),
        clickCount: Number(clicks),
        unsubscribeCount: Number(unsubs),
        openRate: sent > 0 ? Math.round((Number(opens) / sent) * 100) : 0,
        clickRate: sent > 0 ? Math.round((Number(clicks) / sent) * 100) : 0,
        unsubscribeRate: sent > 0 ? Math.round((Number(unsubs) / sent) * 100) : 0,
      };
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
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const vals = {
        subject: input.subject,
        htmlBody: input.htmlBody,
        blocksJson: input.blocksJson ?? null,
        previewText: input.previewText ?? null,
        audienceFilter: JSON.stringify(input.audienceFilter ?? {}),
        status: "draft" as const,
        senderProfileId: input.senderProfileId ?? null,
        fromName: input.fromName ?? null,
        fromEmail: input.fromEmail ?? null,
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
