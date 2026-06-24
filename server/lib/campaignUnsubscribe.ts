/**
 * Shared campaign unsubscribe processing + events table bootstrap.
 */
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import type { getDb } from "../db";
import { addToSendGridGlobalUnsubscribes } from "./sendgridSuppressions";
import {
  getEmailCampaignAppUrl,
  recordEmailCampaignEvent,
} from "./emailCampaignTracking";
type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type CampaignUnsubscribeResult =
  | { ok: true; userId: number; alreadyUnsubscribed: boolean }
  | { ok: false; reason: "invalid" | "not_found" | "db_unavailable" };
/** Human-facing unsubscribe page (footer link in email body). */
export function buildUnsubscribePageUrl(token: string, campaignId?: number): string {
  const appUrl = getEmailCampaignAppUrl();
  const params = new URLSearchParams({ token });
  if (campaignId) params.set("campaignId", String(campaignId));
  return `${appUrl}/unsubscribe?${params.toString()}`;
}
/** RFC 8058 one-click unsubscribe API URL (List-Unsubscribe header). */
export function buildListUnsubscribeApiUrl(token: string, campaignId?: number): string {
  const appUrl = getEmailCampaignAppUrl();
  const params = new URLSearchParams({ token });
  if (campaignId) params.set("campaignId", String(campaignId));
  return `${appUrl}/api/campaign-unsubscribe?${params.toString()}`;
}
/** Ensure the emailCampaignEvents table exists (idempotent). */
export async function ensureEmailCampaignEventsTable(db: DbClient): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS emailCampaignEvents (
      id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      campaignId  INT NOT NULL,
      recipientKey VARCHAR(191) NOT NULL,
      userId      INT NULL,
      eventType   ENUM('open','click','unsubscribe') NOT NULL,
      metadata    JSON NULL,
      createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_campaign (campaignId),
      INDEX idx_recipient (recipientKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
/** Process an unsubscribe request given a JWT token. */
export async function processCampaignUnsubscribe(
  db: DbClient,
  token: string,
  campaignId?: number,
): Promise<CampaignUnsubscribeResult> {
  // Decode the token (base64url-encoded email)
  let email: string;
  try {
    const decoded = Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    email = decoded.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("invalid");
  } catch {
    return { ok: false, reason: "invalid" };
  }
  // Find the user
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return { ok: false, reason: "not_found" };
  const alreadyUnsubscribed = user.emailUnsubscribed === true;
  if (!alreadyUnsubscribed) {
    await db.update(users).set({ emailUnsubscribed: true }).where(eq(users.id, user.id));
    await addToSendGridGlobalUnsubscribes(email).catch((err) =>
      console.error("[CampaignUnsubscribe] SendGrid error:", err),
    );
    // Record the event
    if (campaignId) {
      const recipientKey = `u${user.id}`;
      await recordEmailCampaignEvent(db, {
        campaignId,
        recipientKey,
        userId: user.id,
        eventType: "unsubscribe",
      }).catch((err) => console.error("[CampaignUnsubscribe] recordEvent error:", err));
    }
  }
  return { ok: true, userId: user.id, alreadyUnsubscribed };
}
