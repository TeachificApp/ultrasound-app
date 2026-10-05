/**
 * SendGrid Event Webhook Handler
 *
 * Handles inbound event notifications from SendGrid's Event Webhook.
 * Endpoint: POST /api/webhooks/sendgrid
 *
 * Events handled:
 *  - unsubscribe   → user clicked SendGrid's unsubscribe link (e.g. Gmail footer)
 *  - spamreport    → user marked email as spam
 *  - group_unsubscribe → user unsubscribed from a specific unsubscribe group
 *
 * For each event, this handler:
 *  1. Verifies the SendGrid webhook signature (ECDSA, using SENDGRID_WEBHOOK_PUBLIC_KEY)
 *  2. Finds the matching user by email in the DB
 *  3. Sets unsubscribedAt + disables dailyChallenge in notificationPrefs
 *  4. Logs the event to the webhookEvents table
 *
 * SendGrid signature verification:
 *   Header: X-Twilio-Email-Event-Webhook-Signature (ECDSA P-256 base64)
 *   Header: X-Twilio-Email-Event-Webhook-Timestamp
 *   Signed payload: timestamp + rawBody
 *   Public key: from SendGrid dashboard → Settings → Mail Settings → Event Webhook
 *
 * If SENDGRID_WEBHOOK_PUBLIC_KEY is not set, signature verification is skipped
 * (useful for local dev / testing).
 *
 * Setup in SendGrid dashboard:
 *   Settings → Mail Settings → Event Webhook
 *   HTTP Post URL: https://app.allaboutultrasound.com/api/webhooks/sendgrid
 *   Events: Unsubscribes, Spam Reports, Group Unsubscribes
 *   Signed Event Webhook: Enable and copy the public key to SENDGRID_WEBHOOK_PUBLIC_KEY
 */

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { getDb } from "../db";
import { users, webhookEvents } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { addToSendGridGlobalUnsubscribes } from "../lib/sendgridSuppressions";
import { recordEmailCampaignEvent, type CampaignEventType } from "../lib/emailCampaignTracking";
import { buildRecipientTrackingKey } from "../../shared/emailCampaignAudience";

const SENDGRID_WEBHOOK_PUBLIC_KEY = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY ?? "";

// Events that indicate the user no longer wants emails
const UNSUBSCRIBE_EVENTS = new Set(["unsubscribe", "spamreport", "group_unsubscribe"]);
const CAMPAIGN_DELIVERY_EVENTS = new Set([
  "processed", "delivered", "deferred", "bounce", "blocked", "dropped", "spamreport",
] as const);

interface SendGridEvent {
  email: string;
  event: string;
  timestamp: number;
  sg_event_id?: string;
  sg_message_id?: string;
  asm_group_id?: number;
  [key: string]: unknown;
}

function getCampaignId(event: SendGridEvent): number | null {
  const candidate = event.campaignId ?? event.campaign_id;
  const value = typeof candidate === "string" || typeof candidate === "number"
    ? Number(candidate)
    : Number.NaN;
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function getCampaignDeliveryEventType(event: SendGridEvent): CampaignEventType | null {
  const raw = event.event?.toLowerCase();
  const subtype = typeof event.type === "string" ? event.type.toLowerCase() : "";
  const normalized = raw === "bounce" && subtype === "blocked" ? "blocked" : raw;
  return CAMPAIGN_DELIVERY_EVENTS.has(normalized as "processed" | "delivered" | "deferred" | "bounce" | "blocked" | "dropped" | "spamreport")
    ? normalized as CampaignEventType
    : null;
}

async function recordCampaignDeliveryEvent(event: SendGridEvent): Promise<void> {
  const campaignId = getCampaignId(event);
  const eventType = getCampaignDeliveryEventType(event);
  const email = event.email?.toLowerCase().trim();
  if (!campaignId || !eventType || !email) return;

  const db = await getDb();
  if (!db) return;
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(TRIM(${users.email})) = ${email}`)
    .limit(1);
  const recipientKey = buildRecipientTrackingKey({ userId: user?.id ?? null, email });

  await recordEmailCampaignEvent(db, {
    campaignId,
    recipientKey,
    eventType,
    providerEventId: typeof event.sg_event_id === "string" ? event.sg_event_id : undefined,
    metadata: {
      provider: "sendgrid",
      sgMessageId: typeof event.sg_message_id === "string" ? event.sg_message_id : undefined,
      response: typeof event.response === "string" ? event.response : undefined,
      reason: typeof event.reason === "string" ? event.reason : undefined,
      attempt: typeof event.attempt === "string" || typeof event.attempt === "number" ? event.attempt : undefined,
      bounceClassification: typeof event.bounce_classification === "string" ? event.bounce_classification : undefined,
    },
  });
}

/**
 * Verify SendGrid ECDSA webhook signature.
 * Returns true if valid, false if invalid or key not configured.
 */
function verifySendGridSignature(
  publicKey: string,
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  if (!publicKey) return true; // skip verification if key not configured
  try {
    // SendGrid signs: timestamp + rawBody
    const signedPayload = timestamp + payload;
    const verify = crypto.createVerify("SHA256");
    verify.update(signedPayload);
    // Public key is base64-encoded DER — convert to PEM
    const pem = `-----BEGIN PUBLIC KEY-----\n${publicKey.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`;
    return verify.verify(pem, Buffer.from(signature, "base64"));
  } catch (err) {
    console.error("[SendGridWebhook] Signature verification error:", err);
    return false;
  }
}

/**
 * Process a single SendGrid event: mark user as unsubscribed in DB.
 */
async function processUnsubscribeEvent(event: SendGridEvent): Promise<void> {
  const email = event.email?.toLowerCase().trim();
  if (!email) return;

  const db = await getDb();
  if (!db) return;

  // Look up user by email
  const [user] = await db
    .select({
      id: users.id,
      unsubscribedAt: users.unsubscribedAt,
      notificationPrefs: users.notificationPrefs,
    })
    .from(users)
    .where(sql`LOWER(TRIM(${users.email})) = ${email}`)
    .limit(1);

  if (!user) {
    console.log(`[SendGridWebhook] ${event.event} for unknown email: ${email}`);
    return;
  }

  // Already unsubscribed — nothing to do
  if (user.unsubscribedAt) {
    console.log(`[SendGridWebhook] ${event.event} — already unsubscribed: ${email}`);
    return;
  }

  // Disable dailyChallenge in notificationPrefs
  let prefs: Record<string, unknown> = {};
  try {
    prefs = JSON.parse((user.notificationPrefs as string) ?? "{}");
  } catch {
    prefs = {};
  }
  prefs.dailyChallenge = false;

  await db
    .update(users)
    .set({
      unsubscribedAt: new Date(),
      notificationPrefs: JSON.stringify(prefs),
    })
    .where(eq(users.id, user.id));

  // Also ensure they're on the SendGrid global suppression list
  await addToSendGridGlobalUnsubscribes([email]);

  console.log(`[SendGridWebhook] ${event.event} — unsubscribed user #${user.id}: ${email}`);
}

/**
 * Log a raw webhook event to the webhookEvents table for audit trail.
 */
async function logWebhookEvent(
  source: string,
  eventType: string,
  payload: string
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(webhookEvents).values({
      source,          // e.g. "sendgrid"
      resource: source, // reuse source as resource (schema requires it)
      action: eventType, // e.g. "unsubscribe", "spamreport"
      outcome: "ignored",
      rawPayload: payload,
    });
  } catch {
    // Non-critical — don't let logging failure break the handler
  }
}

export function registerSendGridWebhook(app: Express) {
  app.post(
    "/api/webhooks/sendgrid",
    // Collect raw body for signature verification
    (req: Request, _res: Response, next) => {
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (chunk: string) => { data += chunk; });
      req.on("end", () => {
        (req as Request & { rawBody: string }).rawBody = data;
        next();
      });
    },
    async (req: Request & { rawBody?: string }, res: Response) => {
      const rawBody = req.rawBody ?? "";
      const signature = req.headers["x-twilio-email-event-webhook-signature"] as string | undefined;
      const timestamp = req.headers["x-twilio-email-event-webhook-timestamp"] as string | undefined;

      // Verify signature if public key is configured
      if (SENDGRID_WEBHOOK_PUBLIC_KEY) {
        if (!signature || !timestamp) {
          console.warn("[SendGridWebhook] Missing signature headers — rejecting request.");
          res.status(403).json({ error: "Missing signature headers" });
          return;
        }
        const valid = verifySendGridSignature(SENDGRID_WEBHOOK_PUBLIC_KEY, rawBody, signature, timestamp);
        if (!valid) {
          console.warn("[SendGridWebhook] Invalid signature — rejecting request.");
          res.status(403).json({ error: "Invalid signature" });
          return;
        }
      }

      // Parse event array
      let events: SendGridEvent[];
      try {
        events = JSON.parse(rawBody) as SendGridEvent[];
        if (!Array.isArray(events)) throw new Error("Expected array");
      } catch {
        res.status(400).json({ error: "Invalid JSON payload" });
        return;
      }

      // Respond immediately — process asynchronously to avoid SendGrid timeout
      res.status(200).json({ received: events.length });

      // Process each event
      for (const event of events) {
        try {
          const eventType = event.event?.toLowerCase();

          // Log all events for audit trail
          await logWebhookEvent("sendgrid", eventType, JSON.stringify(event));

          // SendGrid custom_args carry only the campaign ID. Persist its delivery
          // lifecycle events separately from first-party opens and clicks.
          await recordCampaignDeliveryEvent(event);

          // Handle unsubscribe-type events
          if (UNSUBSCRIBE_EVENTS.has(eventType)) {
            await processUnsubscribeEvent(event);
          }
        } catch (err) {
          console.error(`[SendGridWebhook] Error processing event for ${event.email}:`, err);
        }
      }
    }
  );

  console.log("[SendGridWebhook] Registered at /api/webhooks/sendgrid");
}
