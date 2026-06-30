/**
 * logAdminNotification — writes an admin notification to the admin_notifications table.
 *
 * Call this from any server-side event that admins should be aware of:
 * fulfillment completions, payment alerts, enrollment events, BookVault status, etc.
 *
 * This is a fire-and-forget helper — it never throws; errors are logged to console only.
 */

import { getDb } from "../db";
import { adminNotifications } from "../../drizzle/schema";

export async function logAdminNotification(opts: {
  title: string;
  content: string;
  /** Source tag for filtering in the admin UI. Use snake_case: "lms_checkout", "membership", "physical_order", "bookvault", "system" */
  source?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(adminNotifications).values({
      title: opts.title,
      content: opts.content,
      source: opts.source ?? "system",
      isRead: false,
    });
  } catch (err) {
    console.error("[logAdminNotification] Failed to log notification:", err);
  }
}
