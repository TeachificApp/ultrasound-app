import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";

/**
 * Durable delivery state for transactional purchase notifications.
 *
 * Stripe retries webhooks and the checkout-complete page can also reconcile a
 * paid session. Entitlement creation must be repeatable, but an access email
 * should be delivered once for each completed checkout. This module reserves a
 * notification before it is sent and allows a failed/stale reservation to be
 * retried after a short cooling period.
 */
export type PurchaseNotificationType =
  | "lms_access"
  | "download_access"
  | "bundle_access"
  | "workshop_registration"
  | "webinar_registration"
  | "membership_access"
  | "physical_order"
  | "unmatched_payment_alert"
  | "sponsorship_thank_you"
  | "sponsorship_admin_alert";

export type DeliveryClaim = {
  claimed: boolean;
  reason: "new" | "retry" | "already_sent" | "in_progress" | "untracked";
};

const RETRY_AFTER_MINUTES = 15;

type DeliveryDb = MySql2Database<typeof schema>;

function affectedRows(result: unknown): number {
  if (Array.isArray(result) && result[0] && typeof result[0] === "object") {
    return Number((result[0] as { affectedRows?: number }).affectedRows ?? 0);
  }
  if (result && typeof result === "object") {
    return Number((result as { affectedRows?: number }).affectedRows ?? 0);
  }
  return 0;
}

/**
 * Reserve a delivery exactly once per checkout session and notification type.
 * Empty/non-Stripe identifiers are deliberately untracked rather than blocked;
 * callers may still deliver a manually fulfilled purchase.
 */
export async function claimPurchaseNotificationDelivery(
  db: DeliveryDb,
  input: {
    checkoutSessionId?: string | null;
    notificationType: PurchaseNotificationType;
  }
): Promise<DeliveryClaim> {
  const checkoutSessionId = input.checkoutSessionId?.trim();
  if (!checkoutSessionId) return { claimed: true, reason: "untracked" };

  const inserted = await db.execute(sql`
    INSERT IGNORE INTO purchase_notification_deliveries
      (checkout_session_id, notification_type, status, attempts, created_at, updated_at)
    VALUES (${checkoutSessionId}, ${input.notificationType}, 'sending', 1, NOW(), NOW())
  `);
  if (affectedRows(inserted) === 1) return { claimed: true, reason: "new" };

  // A delivery can retry only after a failure or a stale in-progress claim.
  // This prevents each checkout-page poll and webhook retry from mailing again.
  const retried = await db.execute(sql`
    UPDATE purchase_notification_deliveries
    SET status = 'sending',
        attempts = attempts + 1,
        last_error = NULL,
        updated_at = NOW()
    WHERE checkout_session_id = ${checkoutSessionId}
      AND notification_type = ${input.notificationType}
      AND (
        (status = 'failed' AND updated_at < DATE_SUB(NOW(), INTERVAL ${RETRY_AFTER_MINUTES} MINUTE))
        OR (status = 'sending' AND updated_at < DATE_SUB(NOW(), INTERVAL ${RETRY_AFTER_MINUTES} MINUTE))
      )
  `);
  if (affectedRows(retried) === 1) return { claimed: true, reason: "retry" };

  const [existing] = (await db.execute(sql`
    SELECT status
    FROM purchase_notification_deliveries
    WHERE checkout_session_id = ${checkoutSessionId}
      AND notification_type = ${input.notificationType}
    LIMIT 1
  `)) as unknown as [{ status?: string }[], unknown];

  return {
    claimed: false,
    reason: existing?.[0]?.status === "sent" ? "already_sent" : "in_progress",
  };
}

export async function completePurchaseNotificationDelivery(
  db: DeliveryDb,
  input: {
    checkoutSessionId?: string | null;
    notificationType: PurchaseNotificationType;
    delivered: boolean;
    error?: unknown;
  }
): Promise<void> {
  const checkoutSessionId = input.checkoutSessionId?.trim();
  if (!checkoutSessionId) return;

  const error = input.delivered
    ? null
    : String(
        input.error instanceof Error
          ? input.error.message
          : (input.error ?? "Email provider did not accept delivery")
      ).slice(0, 4000);

  await db.execute(sql`
    UPDATE purchase_notification_deliveries
    SET status = ${input.delivered ? "sent" : "failed"},
        last_error = ${error},
        sent_at = ${input.delivered ? sql`NOW()` : null},
        updated_at = NOW()
    WHERE checkout_session_id = ${checkoutSessionId}
      AND notification_type = ${input.notificationType}
  `);
}

/** Runs a sender only when this checkout session has reserved delivery. */
export async function sendPurchaseNotificationOnce(
  db: DeliveryDb,
  input: {
    checkoutSessionId?: string | null;
    notificationType: PurchaseNotificationType;
    send: () => Promise<boolean>;
  }
): Promise<{
  attempted: boolean;
  delivered: boolean;
  reason: DeliveryClaim["reason"];
}> {
  const claim = await claimPurchaseNotificationDelivery(db, input);
  if (!claim.claimed)
    return {
      attempted: false,
      delivered: claim.reason === "already_sent",
      reason: claim.reason,
    };

  try {
    const delivered = await input.send();
    await completePurchaseNotificationDelivery(db, {
      checkoutSessionId: input.checkoutSessionId,
      notificationType: input.notificationType,
      delivered,
    });
    return { attempted: true, delivered, reason: claim.reason };
  } catch (error) {
    await completePurchaseNotificationDelivery(db, {
      checkoutSessionId: input.checkoutSessionId,
      notificationType: input.notificationType,
      delivered: false,
      error,
    }).catch(() => {});
    throw error;
  }
}
