/**
 * challengeCron.ts
 *
 * Runs every 5 minutes to:
 *  1. Archive any "live" challenges whose 24-hour window has expired.
 *  2. At 6 AM Eastern Time: auto-publish the next queued challenge from EACH
 *     category (ACS, Adult Echo, Pediatric Echo, Fetal Echo, POCUS) — picking the
 *     lowest queuePosition per category. No publishDate required from admin.
 *  3. Send a SendGrid notification email to opted-in users at 6 AM ET when
 *     new challenges go live.
 *
 * Admin workflow:
 *  - Set challenge status = "queued", assign a category, set queuePosition.
 *  - The cron does the rest automatically every day at 6 AM ET.
 *
 * Deduplication is DB-backed (users.lastChallengeNotifDate = "YYYY-MM-DD" ET).
 */

import { getDb } from "../db";
import { quickfireChallenges, users } from "../../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import sgMail from "@sendgrid/mail";
import { generateUnsubscribeToken } from "../routes/unsubscribe";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? "";
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "noreply@iheartecho.com";
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME ?? "iHeartEcho™";
const APP_URL = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

let cronRunning = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date string in YYYY-MM-DD format in Eastern Time. */
function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

/** Returns current hour (0–23) in Eastern Time. */
function hourET(): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date()),
    10
  );
}

/** Returns current minute (0–59). */
function minuteNow(): number {
  return new Date().getMinutes();
}

// ── Main Cron ─────────────────────────────────────────────────────────────────

export async function runChallengeCron() {
  if (cronRunning) return; // prevent overlapping runs
  cronRunning = true;
  try {
    const db = await getDb();
    if (!db) return;

    const now = new Date();
    const todayStr = todayET();

    // ── Step 1: Archive expired live challenges (24 h window) ─────────────────
    const liveChallenges = await db
      .select()
      .from(quickfireChallenges)
      .where(eq(quickfireChallenges.status, "live"));

    for (const liveChallenge of liveChallenges) {
      if (liveChallenge.publishedAt) {
        const publishedAt = new Date(liveChallenge.publishedAt);
        const expiresAt = new Date(publishedAt.getTime() + 24 * 60 * 60 * 1000);
        if (now >= expiresAt) {
          await db
            .update(quickfireChallenges)
            .set({ status: "archived", archivedAt: now })
            .where(eq(quickfireChallenges.id, liveChallenge.id));
          console.log(`[ChallengeCron] Archived challenge #${liveChallenge.id}: "${liveChallenge.title}"`);
        }
      }
    }

    // ── Step 2: Check if it's the 6 AM ET publish window (6:00–6:09 AM ET) ───
    const currentHourET = hourET();
    const currentMinute = minuteNow();
    const isPublishWindow = currentHourET === 6 && currentMinute < 10;

    if (!isPublishWindow) return;

    // ── Step 3: Check if we already published today (any live challenge today) ─
    const alreadyPublishedToday = await db
      .select({ id: quickfireChallenges.id })
      .from(quickfireChallenges)
      .where(
        and(
          eq(quickfireChallenges.status, "live"),
          eq(quickfireChallenges.publishDate, todayStr)
        )
      )
      .limit(1);

    // Also check archived challenges published today (in case they already expired)
    const archivedToday = await db
      .select({ id: quickfireChallenges.id })
      .from(quickfireChallenges)
      .where(
        and(
          eq(quickfireChallenges.status, "archived"),
          eq(quickfireChallenges.publishDate, todayStr)
        )
      )
      .limit(1);

    if (alreadyPublishedToday.length > 0 || archivedToday.length > 0) {
      console.log(`[ChallengeCron] Already published challenges for ${todayStr}, skipping.`);
      return;
    }

    // ── Step 4: Pick the next queued challenge per category ───────────────────
    const categories = ["ACS", "Adult Echo", "Pediatric Echo", "Fetal Echo", "POCUS"] as const;
    const toPublish: typeof quickfireChallenges.$inferSelect[] = [];

    for (const category of categories) {
      const [next] = await db
        .select()
        .from(quickfireChallenges)
        .where(
          and(
            eq(quickfireChallenges.status, "queued"),
            eq(quickfireChallenges.category, category)
          )
        )
        // Challenges with explicit position come first; null positions fall back to createdAt
        .orderBy(asc(quickfireChallenges.queuePosition), asc(quickfireChallenges.createdAt))
        .limit(1);

      if (next) {
        toPublish.push(next);
      }
    }

    // Also include any "scheduled" challenges with publishDate <= today (legacy support)
    const scheduledChallenges = await db
      .select()
      .from(quickfireChallenges)
      .where(
        and(
          eq(quickfireChallenges.status, "scheduled"),
          // publishDate <= todayStr
        )
      )
      .orderBy(asc(quickfireChallenges.priority), asc(quickfireChallenges.createdAt))
      .limit(4);

    // Merge scheduled into toPublish (avoid duplicates)
    for (const sc of scheduledChallenges) {
      if (sc.publishDate && sc.publishDate <= todayStr && !toPublish.find(p => p.id === sc.id)) {
        toPublish.push(sc);
      }
    }

    if (toPublish.length === 0) {
      console.log(`[ChallengeCron] No queued challenges found for ${todayStr}.`);
      return;
    }

    // ── Step 5: Publish all selected challenges ───────────────────────────────
    for (const challenge of toPublish) {
      await db
        .update(quickfireChallenges)
        .set({
          status: "live",
          publishedAt: now,
          publishDate: todayStr,
          queuePosition: null, // remove from queue
        })
        .where(eq(quickfireChallenges.id, challenge.id));

      console.log(`[ChallengeCron] Published challenge #${challenge.id}: "${challenge.title}" (${challenge.category})`);
    }

    // ── Step 6: Send notification emails at 6 AM ET ───────────────────────────
    await sendChallengeNotifications(db, toPublish, todayStr);

  } catch (err) {
    console.error("[ChallengeCron] Error:", err);
  } finally {
    cronRunning = false;
  }
}

// ── Email Notifications ───────────────────────────────────────────────────────

async function sendChallengeNotifications(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  publishedChallenges: typeof quickfireChallenges.$inferSelect[],
  todayStr: string
) {
  if (!SENDGRID_API_KEY) {
    console.log("[ChallengeCron] SendGrid not configured, skipping notifications.");
    return;
  }

  // Get users who opted in and haven't been notified today
  const eligibleUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      name: users.name,
      lastChallengeNotifDate: users.lastChallengeNotifDate,
      notificationPrefs: users.notificationPrefs,
      unsubscribeToken: users.unsubscribeToken,
    })
    .from(users)
    .where(eq(users.isDemo, false));

  const usersToNotify = eligibleUsers.filter((u) => {
    if (!u.email) return false;
    if (u.lastChallengeNotifDate === todayStr) return false;
    // Check notification prefs — default to opted in if not set
    if (u.notificationPrefs) {
      try {
        const prefs = typeof u.notificationPrefs === "string"
          ? JSON.parse(u.notificationPrefs)
          : u.notificationPrefs;
        if (prefs.dailyChallenge === false) return false;
      } catch {
        // malformed prefs, default to opted in
      }
    }
    return true;
  });

  if (usersToNotify.length === 0) {
    console.log("[ChallengeCron] No users to notify.");
    return;
  }

  // Build a summary of today's challenges for the email
  const challengeSummary = publishedChallenges
    .map(c => `${c.category}: ${c.title}`)
    .join(" · ");

  const primaryChallenge = publishedChallenges[0];
  let notifiedCount = 0;

  for (const user of usersToNotify) {
    try {
      const userName = user.displayName || user.name || "Echo Enthusiast";
      const unsubToken = user.unsubscribeToken || generateUnsubscribeToken(user.id);
      const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${unsubToken}&type=challenge`;
      const challengeUrl = `${APP_URL}/quickfire`;

      const html = buildEmailHtml({
        userName,
        challengeCount: publishedChallenges.length,
        challengeSummary,
        primaryTitle: primaryChallenge.title,
        primaryCategory: primaryChallenge.category || "Echo",
        challengeUrl,
        appUrl: APP_URL,
        unsubscribeUrl,
      });

      await sgMail.send({
        to: user.email!,
        from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
        subject: `🔥 Today's Echo Challenges Are Live — ${todayStr}`,
        html,
      });

      // Mark as notified
      await db
        .update(users)
        .set({ lastChallengeNotifDate: todayStr })
        .where(eq(users.id, user.id));

      notifiedCount++;
    } catch (err) {
      console.error(`[ChallengeCron] Email failed for user ${user.id}:`, err);
    }
  }

  console.log(`[ChallengeCron] Sent challenge notifications to ${notifiedCount} users.`);
}

// ── Email Template ────────────────────────────────────────────────────────────

function buildEmailHtml({
  userName,
  challengeCount,
  challengeSummary,
  primaryTitle,
  primaryCategory,
  challengeUrl,
  appUrl,
  unsubscribeUrl,
}: {
  userName: string;
  challengeCount: number;
  challengeSummary: string;
  primaryTitle: string;
  primaryCategory: string;
  challengeUrl: string;
  appUrl: string;
  unsubscribeUrl: string;
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Echo Challenges</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0e1e2e 0%,#0e4a50 60%,#189aa1 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:900;letter-spacing:-0.5px;">iHeartEcho™</h1>
              <p style="margin:4px 0 0;color:#4ad9e0;font-size:14px;font-weight:600;">Daily Challenges</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">Hi ${userName},</p>
              <h2 style="margin:0 0 16px;color:#0e1e2e;font-size:22px;font-weight:800;">🔥 ${challengeCount} new challenge${challengeCount > 1 ? 's are' : ' is'} live today!</h2>
              <!-- Challenge summary card -->
              <div style="background:#f0fbfc;border:1px solid #4ad9e0;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
                <div style="display:inline-block;background:#189aa1;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:10px;letter-spacing:0.5px;">${primaryCategory.toUpperCase()}</div>
                <h3 style="margin:0 0 8px;color:#0e1e2e;font-size:18px;font-weight:800;">${primaryTitle}</h3>
                ${challengeCount > 1 ? `<p style="margin:0;color:#4b5563;font-size:13px;line-height:1.6;">Also today: ${challengeSummary}</p>` : ""}
              </div>
              <p style="margin:0 0 8px;color:#4b5563;font-size:14px;">You have <strong>24 hours</strong> to complete today's challenges and make the leaderboard.</p>
              <p style="margin:0 0 24px;color:#4b5563;font-size:14px;"><strong>Premium members</strong> can replay all past challenges in the archive — free members access today's challenges only.</p>
              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#189aa1;">
                    <a href="${challengeUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;" target="_blank" rel="noopener noreferrer">
                      Take Today's Challenges →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                You're receiving this because you opted in to Daily Challenge notifications.<br/>
                <a href="${appUrl}/profile#notifications" style="color:#189aa1;text-decoration:none;" target="_blank" rel="noopener noreferrer">Manage notification preferences</a>
                &nbsp;·&nbsp;
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${appUrl}" style="color:#189aa1;text-decoration:none;" target="_blank" rel="noopener noreferrer">iHeartEcho™</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Starts the challenge cron job — runs every 5 minutes.
 * Called once at server startup.
 */
export function startChallengeCron() {
  console.log("[ChallengeCron] Started — runs every 5 minutes. Publishes at 6 AM ET daily.");
  // Run immediately on startup to catch any missed publishes
  runChallengeCron();
  // Then run every 5 minutes
  setInterval(runChallengeCron, 5 * 60 * 1000);
}
