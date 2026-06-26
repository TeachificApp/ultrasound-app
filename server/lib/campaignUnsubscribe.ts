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
  return `${appUrl}/api/email/campaign-unsubscribe?${params.toString()}`;
}
const EVENTS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS emailCampaignEvents (
  id int NOT NULL AUTO_INCREMENT,
  campaignId int NOT NULL,
  userId int DEFAULT NULL,
  recipientKey varchar(128) NOT NULL,
  eventType enum('open','click','unsubscribe') NOT NULL,
  metadata text,
  country varchar(100) DEFAULT NULL,
  region varchar(100) DEFAULT NULL,
  city varchar(100) DEFAULT NULL,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_campaign_events_campaign (campaignId, eventType),
  KEY idx_email_campaign_events_recipient (campaignId, recipientKey)
)`;

let eventsTableEnsured = false;

/** Idempotent bootstrap — ensures tracking works even if migration was not run manually. */
export async function ensureEmailCampaignEventsTable(db: DbClient): Promise<void> {
  if (eventsTableEnsured) return;
  try {
    await db.execute(sql.raw(EVENTS_TABLE_DDL));
    eventsTableEnsured = true;
  } catch (err) {
    console.error("[EmailCampaign] Failed to ensure emailCampaignEvents table:", err);
  }
}
/** Process an unsubscribe request given a JWT token (stored in users.unsubscribeToken). */
export async function processCampaignUnsubscribe(
  db: DbClient,
  token: string,
  campaignId?: number,
): Promise<CampaignUnsubscribeResult> {
  const [u] = await db
    .select({ id: users.id, email: users.email, unsubscribedAt: users.unsubscribedAt })
    .from(users)
    .where(eq(users.unsubscribeToken, token))
    .limit(1);

  if (!u) return { ok: false, reason: "not_found" };

  const alreadyUnsubscribed = !!u.unsubscribedAt;

  if (!alreadyUnsubscribed) {
    await db
      .update(users)
      .set({ unsubscribedAt: new Date() })
      .where(eq(users.id, u.id));
    if (u.email) {
      await addToSendGridGlobalUnsubscribes([u.email]).catch((err) =>
        console.error("[CampaignUnsubscribe] SendGrid error:", err),
      );
    }
  }

  if (campaignId) {
    try {
      await recordEmailCampaignEvent(db, {
        campaignId,
        recipientKey: `u${u.id}`,
        userId: u.id,
        eventType: "unsubscribe",
      });
    } catch (err) {
      console.error("[EmailCampaign] Failed to record unsubscribe event:", err);
    }
  }

  return { ok: true, userId: u.id, alreadyUnsubscribed };
}
