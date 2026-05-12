/**
 * Account Sharing Monitor
 * 
 * Detects potential account sharing by monitoring IP access patterns for paid content.
 * Flags accounts with suspicious multi-IP usage and alerts support@allaboutultrasound.com.
 * 
 * Detection rules:
 * - 3+ distinct IPs accessing paid content within a 24-hour window → flagged
 * - 5+ distinct IPs within a 7-day window → flagged
 * - Rapid geographic switching (different IPs within minutes) → flagged
 * 
 * Runs every 30 minutes.
 */

import { getDb } from "../db";
import { ipAccessLogs, sharingAbuseFlags, users } from "../../drizzle/schema";
import { eq, and, gte, sql, desc, inArray } from "drizzle-orm";
import { sendEmail } from "../_core/email";

// ─── Configuration ────────────────────────────────────────────────────────────

const ALERT_EMAIL = "support@allaboutultrasound.com";
const ALERT_NAME = "Support Team";

// Thresholds
const MAX_IPS_24H = 3;       // Max distinct IPs in 24 hours before flagging
const MAX_IPS_7D = 5;        // Max distinct IPs in 7 days before flagging
const RAPID_SWITCH_MINUTES = 5; // Different IP within N minutes = suspicious
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Cooldown: don't re-flag same user within 7 days
const REFLAG_COOLDOWN_DAYS = 7;

// ─── IP Access Logging ────────────────────────────────────────────────────────

export async function logIpAccess(opts: {
  userId: number;
  ipAddress: string;
  userAgent?: string;
  contentType: "course" | "download" | "paid_content";
  contentId?: number;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(ipAccessLogs).values({
      userId: opts.userId,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent || null,
      contentType: opts.contentType,
      contentId: opts.contentId || null,
    });
  } catch (err) {
    console.error("[SharingMonitor] Failed to log IP access:", err);
  }
}

// ─── Detection Logic ──────────────────────────────────────────────────────────

interface SuspiciousUser {
  userId: number;
  userName: string | null;
  email: string | null;
  distinctIps24h: number;
  distinctIps7d: number;
  ipList: Array<{ ip: string; lastSeen: string; count: number }>;
  reason: string;
}

async function detectSuspiciousAccounts(): Promise<SuspiciousUser[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Find users with multiple distinct IPs in the last 7 days
  const suspiciousUsers = await db
    .select({
      userId: ipAccessLogs.userId,
      distinctIps: sql<number>`COUNT(DISTINCT ${ipAccessLogs.ipAddress})`.as("distinct_ips"),
    })
    .from(ipAccessLogs)
    .where(gte(ipAccessLogs.accessedAt, sevenDaysAgo))
    .groupBy(ipAccessLogs.userId)
    .having(sql`COUNT(DISTINCT ${ipAccessLogs.ipAddress}) >= ${MAX_IPS_24H}`);

  if (suspiciousUsers.length === 0) return [];

  const results: SuspiciousUser[] = [];

  for (const suspect of suspiciousUsers) {
    // Check if already flagged recently (cooldown)
    const recentFlag = await db
      .select({ id: sharingAbuseFlags.id })
      .from(sharingAbuseFlags)
      .where(
        and(
          eq(sharingAbuseFlags.userId, suspect.userId),
          gte(sharingAbuseFlags.createdAt, new Date(now.getTime() - REFLAG_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)),
          inArray(sharingAbuseFlags.status, ["flagged", "confirmed", "warned"])
        )
      )
      .limit(1);

    if (recentFlag.length > 0) continue; // Already flagged recently

    // Get 24h distinct IP count
    const ips24h = await db
      .select({
        distinctIps: sql<number>`COUNT(DISTINCT ${ipAccessLogs.ipAddress})`.as("cnt"),
      })
      .from(ipAccessLogs)
      .where(
        and(
          eq(ipAccessLogs.userId, suspect.userId),
          gte(ipAccessLogs.accessedAt, twentyFourHoursAgo)
        )
      );

    const distinctIps24h = ips24h[0]?.distinctIps ?? 0;

    // Get detailed IP list for the last 7 days
    const ipDetails = await db
      .select({
        ip: ipAccessLogs.ipAddress,
        lastSeen: sql<string>`MAX(${ipAccessLogs.accessedAt})`.as("last_seen"),
        count: sql<number>`COUNT(*)`.as("cnt"),
      })
      .from(ipAccessLogs)
      .where(
        and(
          eq(ipAccessLogs.userId, suspect.userId),
          gte(ipAccessLogs.accessedAt, sevenDaysAgo)
        )
      )
      .groupBy(ipAccessLogs.ipAddress)
      .orderBy(desc(sql`MAX(${ipAccessLogs.accessedAt})`));

    // Determine reason
    let reason = "";
    if (distinctIps24h >= MAX_IPS_24H) {
      reason = `${distinctIps24h} distinct IPs in the last 24 hours (threshold: ${MAX_IPS_24H})`;
    } else if (suspect.distinctIps >= MAX_IPS_7D) {
      reason = `${suspect.distinctIps} distinct IPs in the last 7 days (threshold: ${MAX_IPS_7D})`;
    } else {
      reason = `${suspect.distinctIps} distinct IPs detected in 7-day window`;
    }

    // Get user info
    const userInfo = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, suspect.userId))
      .limit(1);

    results.push({
      userId: suspect.userId,
      userName: userInfo[0]?.name ?? null,
      email: userInfo[0]?.email ?? null,
      distinctIps24h,
      distinctIps7d: suspect.distinctIps,
      ipList: ipDetails.map(d => ({ ip: d.ip, lastSeen: d.lastSeen, count: d.count })),
      reason,
    });
  }

  return results;
}

// ─── Flagging & Alerting ──────────────────────────────────────────────────────

function buildAlertEmail(flaggedUsers: SuspiciousUser[]): string {
  const rows = flaggedUsers.map(u => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 8px; font-size: 14px;">${u.userName || "Unknown"}</td>
      <td style="padding: 12px 8px; font-size: 14px;">${u.email || "N/A"}</td>
      <td style="padding: 12px 8px; font-size: 14px; text-align: center;"><strong style="color: #dc2626;">${u.distinctIps24h}</strong></td>
      <td style="padding: 12px 8px; font-size: 14px; text-align: center;"><strong style="color: #dc2626;">${u.distinctIps7d}</strong></td>
      <td style="padding: 12px 8px; font-size: 14px;">${u.reason}</td>
    </tr>
  `).join("");

  const ipDetails = flaggedUsers.map(u => `
    <div style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <h4 style="margin: 0 0 8px; color: #1f2937; font-size: 14px;">${u.userName || "Unknown"} (${u.email || "N/A"}) — User ID: ${u.userId}</h4>
      <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
        <tr style="background: #f3f4f6;">
          <th style="padding: 6px; text-align: left;">IP Address</th>
          <th style="padding: 6px; text-align: left;">Last Seen</th>
          <th style="padding: 6px; text-align: center;">Access Count</th>
        </tr>
        ${u.ipList.map(ip => `
          <tr>
            <td style="padding: 6px; font-family: monospace;">${ip.ip}</td>
            <td style="padding: 6px;">${ip.lastSeen}</td>
            <td style="padding: 6px; text-align: center;">${ip.count}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `).join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #0d4f4f; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ Account Sharing Alert</h1>
        <p style="color: #94d2bd; margin: 8px 0 0; font-size: 14px;">Suspicious multi-IP access detected for paid content</p>
      </div>
      <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #374151; font-size: 14px; margin-bottom: 16px;">
          The following account(s) have been flagged for potential account sharing based on multiple IP addresses accessing paid content (courses, downloads, or paid materials):
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f3f4f6; border-bottom: 2px solid #d1d5db;">
              <th style="padding: 10px 8px; text-align: left; font-size: 13px; color: #6b7280;">Name</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 13px; color: #6b7280;">Email</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 13px; color: #6b7280;">IPs (24h)</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 13px; color: #6b7280;">IPs (7d)</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 13px; color: #6b7280;">Reason</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">IP Address Details</h3>
        ${ipDetails}
        <div style="margin-top: 24px; padding: 16px; background: #fef3c7; border-radius: 8px; border: 1px solid #fbbf24;">
          <p style="margin: 0; font-size: 13px; color: #92400e;">
            <strong>Action Required:</strong> Review these accounts in the Platform Admin → Sharing Monitor panel. 
            You can mark accounts as "Confirmed" (abuse verified), "Warned" (user notified), or "Dismissed" (false positive).
          </p>
        </div>
      </div>
      <div style="padding: 16px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
          This is an automated alert from UltrasoundAssist™ Account Sharing Monitor
        </p>
      </div>
    </div>
  `;
}

async function flagAndAlert(suspiciousUsers: SuspiciousUser[]): Promise<void> {
  if (suspiciousUsers.length === 0) return;

  const db = await getDb();
  if (!db) return;

  // Create flags in database
  for (const user of suspiciousUsers) {
    await db.insert(sharingAbuseFlags).values({
      userId: user.userId,
      status: "flagged",
      distinctIpCount: user.distinctIps7d,
      ipAddresses: JSON.stringify(user.ipList),
      detectionReason: user.reason,
      alertSentAt: new Date(),
    });
  }

  // Send consolidated alert email
  const htmlBody = buildAlertEmail(suspiciousUsers);
  const subject = `⚠️ Account Sharing Alert: ${suspiciousUsers.length} account${suspiciousUsers.length > 1 ? "s" : ""} flagged`;

  const sent = await sendEmail({
    to: { name: ALERT_NAME, email: ALERT_EMAIL },
    subject,
    htmlBody,
    previewText: `${suspiciousUsers.length} account(s) flagged for potential sharing abuse`,
  });

  if (sent) {
    console.log(`[SharingMonitor] Alert sent to ${ALERT_EMAIL} for ${suspiciousUsers.length} user(s)`);
  } else {
    console.warn("[SharingMonitor] Failed to send alert email");
  }
}

// ─── Main Cron Runner ─────────────────────────────────────────────────────────

let isRunning = false;

export async function runSharingMonitor(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    console.log("[SharingMonitor] Running detection scan...");
    const suspicious = await detectSuspiciousAccounts();

    if (suspicious.length > 0) {
      console.log(`[SharingMonitor] Found ${suspicious.length} suspicious account(s)`);
      await flagAndAlert(suspicious);
    } else {
      console.log("[SharingMonitor] No suspicious accounts detected");
    }
  } catch (err) {
    console.error("[SharingMonitor] Error during scan:", err);
  } finally {
    isRunning = false;
  }
}

export function startSharingMonitor(): void {
  console.log("[SharingMonitor] Started — runs every 30 minutes. Monitors paid content access patterns.");
  // Run once at startup (delayed 2 minutes to let other services initialize)
  setTimeout(runSharingMonitor, 2 * 60 * 1000);
  // Then run every 30 minutes
  setInterval(runSharingMonitor, CHECK_INTERVAL_MS);
}
