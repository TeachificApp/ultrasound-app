/**
 * Persist flagged duplicate-payment events to webhookEvents for admin review.
 */
import { getDb } from "../db";

export type DuplicatePaymentKind =
  | "lms_duplicate_payment"
  | "membership_duplicate_subscription"
  | "already_purchased_download"
  | "already_purchased_bundle"
  | "already_purchased_brand_membership"
  | "already_purchased_physical";

export async function logDuplicatePaymentFlag(opts: {
  kind: DuplicatePaymentKind;
  email?: string | null;
  productName?: string | null;
  message: string;
  rawPayload?: Record<string, unknown> | string;
  stripePaymentIntentId?: string | null;
  stripeSessionId?: string | null;
  stripeSubscriptionId?: string | null;
  userId?: number | null;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const { webhookEvents } = await import("../../drizzle/schema");

    const detailParts = [
      opts.message,
      opts.userId != null ? `userId=${opts.userId}` : null,
      opts.stripePaymentIntentId ? `pi=${opts.stripePaymentIntentId}` : null,
      opts.stripeSessionId ? `session=${opts.stripeSessionId}` : null,
      opts.stripeSubscriptionId ? `sub=${opts.stripeSubscriptionId}` : null,
    ].filter(Boolean);

    await db.insert(webhookEvents).values({
      source: "stripe",
      resource: "duplicate_payment",
      action: opts.kind,
      email: opts.email ?? undefined,
      productName: opts.productName ?? undefined,
      httpStatus: 200,
      outcome: "duplicate_flagged",
      message: detailParts.join(" | "),
      rawPayload:
        typeof opts.rawPayload === "string"
          ? opts.rawPayload
          : opts.rawPayload
            ? JSON.stringify(opts.rawPayload)
            : undefined,
    });
  } catch (err) {
    console.warn("[duplicatePaymentLog] Failed to log duplicate payment flag:", err);
  }
}
