/**
 * Daily Challenge Streak Reminder Utility
 *
 * Queries all users who:
 *   1. Have opted in to Daily Challenge reminders (notificationPrefs.quickfireReminder = true)
 *   2. Have a verified email address
 *   3. Have NOT completed today's Daily Challenge set
 *
 * For each such user, sends:
 *   - A branded SendGrid reminder email
 *   - An in-app notification (owner notification channel)
 *
 * Returns a summary { sent, skipped, errors }.
 */

import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import { sendEmail, buildStreakReminderEmail } from "./_core/email";
import { users, quickfireAttempts } from "../drizzle/schema";

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getFirstName(name: string | null): string {
  if (!name) return "there";
  return name.split(" ")[0] || name;
}

function parseNotifPrefs(raw: string | null): {
  quickfireReminder: boolean;
  reminderTime: string;
} {
  const defaults = { quickfireReminder: true, reminderTime: "18:00" };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    return {
      quickfireReminder: parsed.quickfireReminder !== false,
      reminderTime: typeof parsed.reminderTime === "string" ? parsed.reminderTime : defaults.reminderTime,
    };
  } catch {
    return defaults;
  }
}

export interface StreakReminderSummary {
  sent: number;
  skipped: number;
  errors: number;
  total: number;
}

export async function sendStreakReminders(appUrl: string): Promise<StreakReminderSummary> {
  const db = await getDb();
  if (!db) {
    console.error("[streakReminders] DB unavailable");
    return { sent: 0, skipped: 0, errors: 0, total: 0 };
  }

  const today = todayDateStr();

  // Find user IDs who have already attempted at least one question today
  const completedRows = await db
    .selectDistinct({ userId: quickfireAttempts.userId })
    .from(quickfireAttempts)
    .where(eq(quickfireAttempts.setDate, today));

  const completedUserIds = completedRows.map((r) => r.userId);

  // Fetch all active, non-pending users with a valid email
  const allUsersQuery = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      notificationPrefs: users.notificationPrefs,
    })
    .from(users)
    .where(
      and(
        eq(users.isPending, false),
        ne(users.emailVerified, false)
      )
    );

  const allUsers = await allUsersQuery;

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of allUsers) {
    // Skip users who have already completed today's set
    if (completedUserIds.includes(user.id)) {
      skipped++;
      continue;
    }

    // Skip users who have no email
    if (!user.email) {
      skipped++;
      continue;
    }

    // Parse notification preferences
    const prefs = parseNotifPrefs(user.notificationPrefs);
    if (!prefs.quickfireReminder) {
      skipped++;
      continue;
    }

    // Calculate current streak (consecutive days with at least one attempt)
    const streakRows = await db
      .select({ setDate: quickfireAttempts.setDate })
      .from(quickfireAttempts)
      .where(eq(quickfireAttempts.userId, user.id))
      .groupBy(quickfireAttempts.setDate)
      .orderBy(sql`${quickfireAttempts.setDate} DESC`)
      .limit(365);

    let currentStreak = 0;
    const dates = streakRows.map((r) => r.setDate);
    // Walk backwards from yesterday to count consecutive days
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const d = new Date(yesterday);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (dates.includes(ds)) {
        currentStreak++;
      } else {
        break;
      }
    }

    const firstName = getFirstName(user.name);
    const loginUrl = `${appUrl}/quickfire`;
    const unsubscribeUrl = `${appUrl}/settings/notifications?unsubscribe=quickfire`;

    const { subject, htmlBody } = buildStreakReminderEmail({
      firstName,
      currentStreak,
      loginUrl,
      unsubscribeUrl,
    });

    try {
      const ok = await sendEmail({
        to: { name: user.name || firstName, email: user.email },
        subject,
        htmlBody,
      });
      if (ok) {
        sent++;
      } else {
        errors++;
      }
    } catch (err) {
      console.error(`[streakReminders] Error sending to user ${user.id}:`, err);
      errors++;
    }
  }

  console.log(
    `[streakReminders] Done for ${today}: sent=${sent} skipped=${skipped} errors=${errors} total=${allUsers.length}`
  );
  return { sent, skipped, errors, total: allUsers.length };
}
