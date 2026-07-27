/**
 * Sharing Monitor Router
 * Admin-only procedures for viewing and managing account sharing abuse flags.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { ipAccessLogs, sharingAbuseFlags, users, lmsEnrollments, lmsCourses, brandMemberships, membershipSubscriptions, labSubscriptions, teamSubscriptions, employerProfiles, employerSubscriptions } from "../../drizzle/schema";
import { eq, and, gte, desc, sql, inArray, or } from "drizzle-orm";
import { runSharingMonitor } from "../jobs/sharingMonitor";
import { sendEmail } from "../_core/email";
import { getStripeClient } from "../lib/stripeClient";

const SUPPORT_EMAIL = "support@allaboutultrasound.com";
const SUPPORT_NAME = "All About Ultrasound Support";

/**
 * Cancel all active Stripe subscriptions for a user across all subscription tables.
 * Returns a summary of what was cancelled.
 */
async function cancelAllUserStripeSubscriptions(userId: number): Promise<{
  cancelled: string[];
  errors: string[];
}> {
  const db = await getDb();
  if (!db) return { cancelled: [], errors: ["DB unavailable"] };

  const stripe = getStripeClient();
  const cancelled: string[] = [];
  const errors: string[] = [];

  async function cancelSub(subId: string | null | undefined, source: string): Promise<void> {
    if (!subId) return;
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      if (sub.status !== "canceled") {
        await stripe.subscriptions.cancel(subId);
        cancelled.push(`${source}:${subId}`);
        console.log(`[SuspendUser] Cancelled Stripe subscription ${subId} (${source}) for user ${userId}`);
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      errors.push(`${source}:${subId} — ${msg}`);
      console.error(`[SuspendUser] Failed to cancel ${subId} (${source}):`, msg);
    }
  }

  // 1. brandMemberships — per-brand premium subscriptions
  const brandSubs = await db
    .select({ id: brandMemberships.id, subId: brandMemberships.stripeSubscriptionId })
    .from(brandMemberships)
    .where(eq(brandMemberships.userId, userId));
  for (const row of brandSubs) {
    await cancelSub(row.subId, "brandMembership");
    if (row.subId) {
      await db.update(brandMemberships)
        .set({ status: "cancelled" })
        .where(eq(brandMemberships.id, row.id));
    }
  }

  // 2. membershipSubscriptions — plan-based subscriptions
  const memberSubs = await db
    .select({ id: membershipSubscriptions.id, subId: membershipSubscriptions.stripeSubscriptionId })
    .from(membershipSubscriptions)
    .where(and(
      eq(membershipSubscriptions.userId, userId),
      or(
        eq(membershipSubscriptions.status, "active"),
        eq(membershipSubscriptions.status, "trialing"),
        eq(membershipSubscriptions.status, "past_due")
      )
    ));
  for (const row of memberSubs) {
    await cancelSub(row.subId, "membershipSubscription");
    if (row.subId) {
      await db.update(membershipSubscriptions)
        .set({ status: "cancelled" })
        .where(eq(membershipSubscriptions.id, row.id));
    }
  }

  // 3. labSubscriptions — lab admin billing (user is the billing admin)
  const labSubs = await db
    .select({ id: labSubscriptions.id, subId: labSubscriptions.stripeSubscriptionId })
    .from(labSubscriptions)
    .where(eq(labSubscriptions.adminUserId, userId));
  for (const row of labSubs) {
    await cancelSub(row.subId, "labSubscription");
    if (row.subId) {
      await db.update(labSubscriptions)
        .set({ status: "canceled", canceledAt: new Date() })
        .where(eq(labSubscriptions.id, row.id));
    }
  }

  // 4. teamSubscriptions — team/institution billing admin
  const teamSubs = await db
    .select({ id: teamSubscriptions.id, subId: teamSubscriptions.stripeSubscriptionId })
    .from(teamSubscriptions)
    .where(eq(teamSubscriptions.adminUserId, userId));
  for (const row of teamSubs) {
    await cancelSub(row.subId, "teamSubscription");
    if (row.subId) {
      await db.update(teamSubscriptions)
        .set({ status: "canceled", canceledAt: new Date() })
        .where(eq(teamSubscriptions.id, row.id));
    }
  }

  // 5. employerSubscriptions — job board / employer billing
  //    employerSubscriptions links via employerProfiles.userId → employerProfiles.id → employerSubscriptions.employerId
  const empProfiles = await db
    .select({ id: employerProfiles.id })
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, userId));
  if (empProfiles.length > 0) {
    const empProfileIds = empProfiles.map(p => p.id);
    const empSubs = await db
      .select({ id: employerSubscriptions.id, subId: employerSubscriptions.stripeSubscriptionId })
      .from(employerSubscriptions)
      .where(and(
        inArray(employerSubscriptions.employerId, empProfileIds),
        or(
          eq(employerSubscriptions.status, "active"),
          eq(employerSubscriptions.status, "trialing" as any)
        )
      ));
    for (const row of empSubs) {
      await cancelSub(row.subId, "employerSubscription");
      if (row.subId) {
        await db.update(employerSubscriptions)
          .set({ status: "cancelled" })
          .where(eq(employerSubscriptions.id, row.id));
      }
    }
  }

  return { cancelled, errors };
}

function assertAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
}

function buildStudentAlertEmail(userName: string, userEmail: string, ipCount: number, reason: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto;">
      <div style="background: #0d4f4f; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ Account Security Notice</h1>
        <p style="color: #94d2bd; margin: 8px 0 0; font-size: 14px;">Important information about your account activity</p>
      </div>
      <div style="padding: 28px; background: white; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #374151; font-size: 15px; margin-bottom: 16px;">Dear ${userName},</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          We are writing to inform you that our automated security system has detected unusual access patterns on your account.
          Specifically, your account has been accessed from <strong>${ipCount} different IP addresses</strong> in a short period of time.
        </p>
        <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #92400e;">
            <strong>Detection reason:</strong> ${reason}
          </p>
        </div>
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          Per our Terms of Service, each subscription is for individual use only and may not be shared with others.
          Account sharing is a violation of our Terms of Service and may result in suspension or termination of your account.
        </p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          <strong>Your account is currently being monitored for adherence to our Terms of Service.</strong>
          If this activity was caused by you (for example, using a VPN, traveling, or accessing from multiple personal devices),
          no action is required — please continue enjoying your membership.
        </p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          If you believe this notice was sent in error, or if you have questions about our Terms of Service,
          please reply to this email or contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #0d4f4f;">${SUPPORT_EMAIL}</a>.
        </p>
        <p style="color: #374151; font-size: 14px;">Thank you for being part of our community.</p>
        <p style="color: #374151; font-size: 14px; margin-top: 8px;">The All About Ultrasound Team</p>
      </div>
      <div style="padding: 16px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
          This notice was sent to ${userEmail} | All About Ultrasound™
        </p>
      </div>
    </div>
  `;
}

function buildSuspensionEmail(userName: string, userEmail: string, reason: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto;">
      <div style="background: #7f1d1d; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">&#10060; Account Suspension Notice</h1>
        <p style="color: #fca5a5; margin: 8px 0 0; font-size: 14px;">Your account access has been suspended</p>
      </div>
      <div style="padding: 28px; background: white; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #374151; font-size: 15px; margin-bottom: 16px;">Dear ${userName},</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          After reviewing your account activity, we have determined that your account has been used in violation of our Terms of Service.
          As a result, your account has been <strong>suspended effective immediately</strong>.
        </p>
        <div style="background: #fee2e2; border: 1px solid #f87171; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b;">
            <strong>Reason for suspension:</strong> ${reason}
          </p>
        </div>
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          If you believe this suspension was made in error, or if you would like to appeal this decision,
          please contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #7f1d1d;">${SUPPORT_EMAIL}</a>.
        </p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          Please include your registered email address and any relevant context in your appeal.
        </p>
        <p style="color: #374151; font-size: 14px;">The All About Ultrasound Team</p>
      </div>
      <div style="padding: 16px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
          This notice was sent to ${userEmail} | All About Ultrasound&#8482;
        </p>
      </div>
    </div>
  `;
}

export const sharingMonitorRouter = router({
  /** Get all abuse flags with user info */
  getFlags: protectedProcedure
    .input(z.object({
      status: z.enum(["flagged", "confirmed", "dismissed", "warned", "all"]).default("all"),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.status !== "all") {
        conditions.push(eq(sharingAbuseFlags.status, input.status));
      }

      const flags = await db
        .select({
          id: sharingAbuseFlags.id,
          userId: sharingAbuseFlags.userId,
          status: sharingAbuseFlags.status,
          distinctIpCount: sharingAbuseFlags.distinctIpCount,
          ipAddresses: sharingAbuseFlags.ipAddresses,
          detectionReason: sharingAbuseFlags.detectionReason,
          alertSentAt: sharingAbuseFlags.alertSentAt,
          reviewedAt: sharingAbuseFlags.reviewedAt,
          reviewedBy: sharingAbuseFlags.reviewedBy,
          notes: sharingAbuseFlags.notes,
          createdAt: sharingAbuseFlags.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(sharingAbuseFlags)
        .leftJoin(users, eq(users.id, sharingAbuseFlags.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sharingAbuseFlags.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(sharingAbuseFlags)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { flags, total: countResult?.total ?? 0 };
    }),

  /** Get full student detail for a flagged user: profile + all flags + recent access logs */
  getStudentDetail: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // User profile
      const [userRow] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isPremium: users.isPremium,
          premiumSource: users.premiumSource,
          specialty: users.specialty,
          credentials: users.credentials,
          location: users.location,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          loginMethod: users.loginMethod,
          suspendedAt: users.suspendedAt,
          suspensionReason: users.suspensionReason,
          suspendedBy: users.suspendedBy,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRow) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // All flags for this user
      const allFlags = await db
        .select()
        .from(sharingAbuseFlags)
        .where(eq(sharingAbuseFlags.userId, input.userId))
        .orderBy(desc(sharingAbuseFlags.createdAt));

      // Recent access logs (last 30 days)
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const logs = await db
        .select()
        .from(ipAccessLogs)
        .where(and(eq(ipAccessLogs.userId, input.userId), gte(ipAccessLogs.accessedAt, since)))
        .orderBy(desc(ipAccessLogs.accessedAt))
        .limit(300);

      // IP summary
      const ipSummary = await db
        .select({
          ip: ipAccessLogs.ipAddress,
          count: sql<number>`COUNT(*)`.as("cnt"),
          firstSeen: sql<string>`MIN(${ipAccessLogs.accessedAt})`.as("first_seen"),
          lastSeen: sql<string>`MAX(${ipAccessLogs.accessedAt})`.as("last_seen"),
        })
        .from(ipAccessLogs)
        .where(and(eq(ipAccessLogs.userId, input.userId), gte(ipAccessLogs.accessedAt, since)))
        .groupBy(ipAccessLogs.ipAddress)
        .orderBy(desc(sql`COUNT(*)`));

      // Enrollments with per-IP access breakdown
      const enrollments = await db
        .select({
          enrollmentId: lmsEnrollments.id,
          courseId: lmsEnrollments.courseId,
          courseTitle: lmsCourses.title,
          enrolledAt: lmsEnrollments.enrolledAt,
          progressPct: lmsEnrollments.progressPct,
          completedAt: lmsEnrollments.completedAt,
          enrollmentType: lmsEnrollments.enrollmentType,
          accessExpiresAt: lmsEnrollments.accessExpiresAt,
          source: lmsEnrollments.source,
        })
        .from(lmsEnrollments)
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsEnrollments.courseId))
        .where(eq(lmsEnrollments.userId, input.userId))
        .orderBy(desc(lmsEnrollments.enrolledAt));

      // Per-enrollment IP access breakdown (from ip_access_logs where contentType='course')
      const courseIds = enrollments.map(e => e.courseId).filter(Boolean);
      let enrollmentIpBreakdown: Array<{
        courseId: number;
        ip: string;
        count: number;
        firstSeen: string;
        lastSeen: string;
      }> = [];

      if (courseIds.length > 0) {
        enrollmentIpBreakdown = await db
          .select({
            courseId: ipAccessLogs.contentId,
            ip: ipAccessLogs.ipAddress,
            count: sql<number>`COUNT(*)`.as("cnt"),
            firstSeen: sql<string>`MIN(${ipAccessLogs.accessedAt})`.as("first_seen"),
            lastSeen: sql<string>`MAX(${ipAccessLogs.accessedAt})`.as("last_seen"),
          })
          .from(ipAccessLogs)
          .where(
            and(
              eq(ipAccessLogs.userId, input.userId),
              eq(ipAccessLogs.contentType, "course"),
              inArray(ipAccessLogs.contentId, courseIds as number[]),
              gte(ipAccessLogs.accessedAt, since)
            )
          )
          .groupBy(ipAccessLogs.contentId, ipAccessLogs.ipAddress)
          .orderBy(ipAccessLogs.contentId, desc(sql`COUNT(*)`)) as any;
      }

      return { user: userRow, flags: allFlags, logs, ipSummary, enrollments, enrollmentIpBreakdown };
    }),

  /** Send automated alert email to the student and mark flag as warned */
  sendStudentAlert: protectedProcedure
    .input(z.object({
      flagId: z.number(),
      userId: z.number(),
      customMessage: z.string().max(2000).optional(),
      customSubject: z.string().max(200).optional(),
      customHtmlBody: z.string().max(50000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get user and flag details
      const [userRow] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRow || !userRow.email) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User or email not found" });
      }

      const [flag] = await db
        .select()
        .from(sharingAbuseFlags)
        .where(eq(sharingAbuseFlags.id, input.flagId))
        .limit(1);

      if (!flag) throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found" });

      const htmlBody = input.customHtmlBody ?? buildStudentAlertEmail(
        userRow.name ?? "Member",
        userRow.email,
        flag.distinctIpCount,
        flag.detectionReason ?? "Multiple IP addresses detected accessing paid content"
      );
      const subject = input.customSubject ?? "⚠️ Account Security Notice — Account Sharing Alert";

      const sent = await sendEmail({
        to: { name: userRow.name ?? "Member", email: userRow.email },
        subject,
        htmlBody,
        previewText: "Your account has been flagged for unusual access patterns. Please review.",
      });

      if (!sent) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send email" });
      }

      // Update flag status to warned and record who sent it
      await db.update(sharingAbuseFlags)
        .set({
          status: "warned",
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          alertSentAt: new Date(),
          notes: input.customMessage
            ? `[Admin alert sent by ${ctx.user.id}] ${input.customMessage}`
            : `[Admin alert sent by ${ctx.user.id}]`,
        })
        .where(eq(sharingAbuseFlags.id, input.flagId));

      return { success: true, sentTo: userRow.email };
    }),

  /** Export access logs for a user as CSV data */
  exportUserLogs: protectedProcedure
    .input(z.object({
      userId: z.number(),
      days: z.number().int().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [userRow] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const logs = await db
        .select()
        .from(ipAccessLogs)
        .where(and(eq(ipAccessLogs.userId, input.userId), gte(ipAccessLogs.accessedAt, since)))
        .orderBy(desc(ipAccessLogs.accessedAt))
        .limit(1000);

      // Build CSV with course titles
      const courseIds2 = [...new Set(logs.filter(l => l.contentType === 'course' && l.contentId).map(l => l.contentId as number))];
      const courseMap: Record<number, string> = {};
      if (courseIds2.length > 0) {
        const courses = await db
          .select({ id: lmsCourses.id, title: lmsCourses.title })
          .from(lmsCourses)
          .where(inArray(lmsCourses.id, courseIds2));
        courses.forEach(c => { courseMap[c.id] = c.title; });
      }

      const header = "Timestamp,IP Address,Content Type,Content ID,Content Title,User Agent";
      const rows = logs.map(l =>
        [
          new Date(l.accessedAt).toISOString(),
          l.ipAddress,
          l.contentType,
          l.contentId ?? "",
          `"${(l.contentId && courseMap[l.contentId] ? courseMap[l.contentId] : "").replace(/"/g, "'")}"`,
          `"${(l.userAgent ?? "").replace(/"/g, "'")}"`,
        ].join(",")
      );

      const csv = [header, ...rows].join("\n");
      return {
        csv,
        fileName: `sharing-monitor-${userRow?.email ?? input.userId}-${new Date().toISOString().slice(0, 10)}.csv`,
        rowCount: logs.length,
        userName: userRow?.name ?? String(input.userId),
        userEmail: userRow?.email ?? "",
      };
    }),

  /** Get IP access history for a specific user */
  getUserIpHistory: protectedProcedure
    .input(z.object({
      userId: z.number(),
      days: z.number().int().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const logs = await db
        .select()
        .from(ipAccessLogs)
        .where(
          and(
            eq(ipAccessLogs.userId, input.userId),
            gte(ipAccessLogs.accessedAt, since)
          )
        )
        .orderBy(desc(ipAccessLogs.accessedAt))
        .limit(200);

      // Aggregate by IP
      const ipSummary = await db
        .select({
          ip: ipAccessLogs.ipAddress,
          count: sql<number>`COUNT(*)`.as("cnt"),
          firstSeen: sql<string>`MIN(${ipAccessLogs.accessedAt})`.as("first_seen"),
          lastSeen: sql<string>`MAX(${ipAccessLogs.accessedAt})`.as("last_seen"),
        })
        .from(ipAccessLogs)
        .where(
          and(
            eq(ipAccessLogs.userId, input.userId),
            gte(ipAccessLogs.accessedAt, since)
          )
        )
        .groupBy(ipAccessLogs.ipAddress)
        .orderBy(desc(sql`COUNT(*)`));

      return { logs, ipSummary };
    }),

  /** Update flag status (confirm, dismiss, warn) */
  updateFlagStatus: protectedProcedure
    .input(z.object({
      flagId: z.number(),
      status: z.enum(["confirmed", "dismissed", "warned"]),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(sharingAbuseFlags)
        .set({
          status: input.status,
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          notes: input.notes ?? null,
        })
        .where(eq(sharingAbuseFlags.id, input.flagId));

      return { success: true };
    }),

  /** Get dashboard stats */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [flagged] = await db.select({ count: sql<number>`COUNT(*)` }).from(sharingAbuseFlags).where(eq(sharingAbuseFlags.status, "flagged"));
    const [confirmed] = await db.select({ count: sql<number>`COUNT(*)` }).from(sharingAbuseFlags).where(eq(sharingAbuseFlags.status, "confirmed"));
    const [warned] = await db.select({ count: sql<number>`COUNT(*)` }).from(sharingAbuseFlags).where(eq(sharingAbuseFlags.status, "warned"));
    const [dismissed] = await db.select({ count: sql<number>`COUNT(*)` }).from(sharingAbuseFlags).where(eq(sharingAbuseFlags.status, "dismissed"));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentLogs] = await db.select({ count: sql<number>`COUNT(*)` }).from(ipAccessLogs).where(gte(ipAccessLogs.accessedAt, sevenDaysAgo));
    const [uniqueUsers] = await db.select({ count: sql<number>`COUNT(DISTINCT ${ipAccessLogs.userId})` }).from(ipAccessLogs).where(gte(ipAccessLogs.accessedAt, sevenDaysAgo));

    return {
      flagged: flagged?.count ?? 0,
      confirmed: confirmed?.count ?? 0,
      warned: warned?.count ?? 0,
      dismissed: dismissed?.count ?? 0,
      recentAccessLogs: recentLogs?.count ?? 0,
      uniqueUsersTracked: uniqueUsers?.count ?? 0,
    };
  }),

  /** Manually trigger a scan */
  triggerScan: protectedProcedure.mutation(async ({ ctx }) => {
    assertAdmin(ctx);
    // Run in background
    runSharingMonitor().catch(err => console.error("[SharingMonitor] Manual scan failed:", err));
    return { started: true };
  }),

  /** Get the alert email HTML preview (with optional custom body) for editing before send */
  getAlertEmailPreview: protectedProcedure
    .input(z.object({
      flagId: z.number(),
      userId: z.number(),
      customSubject: z.string().max(200).optional(),
      customHtmlBody: z.string().max(50000).optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [userRow] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRow) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const [flag] = await db
        .select()
        .from(sharingAbuseFlags)
        .where(eq(sharingAbuseFlags.id, input.flagId))
        .limit(1);

      if (!flag) throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found" });

      const defaultSubject = "⚠️ Account Security Notice — Account Sharing Alert";
      const defaultHtmlBody = buildStudentAlertEmail(
        userRow.name ?? "Member",
        userRow.email ?? "",
        flag.distinctIpCount,
        flag.detectionReason ?? "Multiple IP addresses detected accessing paid content"
      );

      return {
        subject: input.customSubject ?? defaultSubject,
        htmlBody: input.customHtmlBody ?? defaultHtmlBody,
        recipientName: userRow.name ?? "Member",
        recipientEmail: userRow.email ?? "",
        defaultSubject,
        defaultHtmlBody,
      };
    }),

  /** Suspend a user account and optionally send a suspension notice email */
  suspendUser: protectedProcedure
    .input(z.object({
      userId: z.number(),
      flagId: z.number().optional(),
      reason: z.string().max(500),
      sendEmail: z.boolean().default(true),
      customSubject: z.string().max(200).optional(),
      customHtmlBody: z.string().max(50000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [userRow] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRow) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // Set suspension on the user
      await db.update(users)
        .set({
          suspendedAt: new Date(),
          suspensionReason: input.reason,
          suspendedBy: ctx.user.id,
        })
        .where(eq(users.id, input.userId));

      // Update the flag to confirmed if provided
      if (input.flagId) {
        await db.update(sharingAbuseFlags)
          .set({
            status: "confirmed",
            reviewedAt: new Date(),
            reviewedBy: ctx.user.id,
            notes: `[Suspended by admin ${ctx.user.id}] ${input.reason}`,
          })
          .where(eq(sharingAbuseFlags.id, input.flagId));
      }

      // Cancel all Stripe subscriptions for the user
      const stripeResult = await cancelAllUserStripeSubscriptions(input.userId).catch(err => {
        console.error("[SuspendUser] Stripe cancellation error:", err);
        return { cancelled: [], errors: [String(err)] };
      });
      console.log(`[SuspendUser] Stripe cancellation result for user ${input.userId}:`, stripeResult);

      // Send suspension notice email if requested
      let emailSent = false;
      if (input.sendEmail && userRow.email) {
        const subject = input.customSubject ?? "❌ Account Suspension Notice";
        const htmlBody = input.customHtmlBody ?? buildSuspensionEmail(
          userRow.name ?? "Member",
          userRow.email,
          input.reason
        );

        emailSent = await sendEmail({
          to: { name: userRow.name ?? "Member", email: userRow.email },
          subject,
          htmlBody,
          previewText: "Your account has been suspended for violation of our Terms of Service.",
        });
      }

      return {
        success: true,
        emailSent,
        suspendedUser: userRow.email,
        subscriptionsCancelled: stripeResult.cancelled,
        subscriptionErrors: stripeResult.errors,
      };
    }),

  /** Bulk update flag status for multiple flags at once */
  bulkUpdateFlagStatus: protectedProcedure
    .input(z.object({
      flagIds: z.array(z.number()).min(1).max(200),
      status: z.enum(["confirmed", "dismissed", "warned"]),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(sharingAbuseFlags)
        .set({
          status: input.status,
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          notes: input.notes ?? null,
        })
        .where(inArray(sharingAbuseFlags.id, input.flagIds));

      return { success: true, updatedCount: input.flagIds.length };
    }),

  /** Lift a suspension from a user account */
  unsuspendUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(users)
        .set({
          suspendedAt: null,
          suspensionReason: null,
          suspendedBy: null,
        })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),
});
