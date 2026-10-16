import { and, eq, sql } from "drizzle-orm";
import {
  workshopEnrollments,
  workshopInstances,
} from "../../drizzle/schema";
import { getOrCreateUserByEmail } from "../db";
import { grantScheduledContentAccess } from "./scheduledContentLinks";

export type WorkshopCheckoutFulfillmentResult = {
  success: boolean;
  created: boolean;
  /** True when this checkout session owns the existing enrollment. */
  isCurrentCheckout: boolean;
  userId: number | null;
  workshopId: number | null;
  instanceId: number | null;
  recipientEmail: string | null;
  recipientName: string | null;
  error?: string;
};

type CheckoutRecipient = { email: string | null; name: string | null };

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInteger(value: string | null | undefined): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** True only for a workshop Checkout session containing both entitlement ids. */
export function isWorkshopCheckoutMetadata(meta: Record<string, string>): boolean {
  return meta.type === "workshop"
    && positiveInteger(meta.workshop_id) !== null
    && positiveInteger(meta.instance_id) !== null;
}

/** Explicit learner metadata takes priority over the person who paid. */
export function getWorkshopCheckoutRecipient(
  session: Record<string, unknown>,
  meta: Record<string, string>,
): CheckoutRecipient {
  const customerDetails = (session.customer_details ?? {}) as Record<string, unknown>;
  return {
    email: stringValue(meta.recipient_email)
      ?? stringValue(meta.customer_email)
      ?? stringValue(session.customer_email)
      ?? stringValue(customerDetails.email),
    name: stringValue(meta.recipient_name)
      ?? stringValue(meta.customer_name)
      ?? stringValue(customerDetails.name),
  };
}

/**
 * Resolve the learner for a Workshop Checkout session without sending email.
 * An emailed learner always wins over a historical/stale numeric user id.
 */
export async function resolveWorkshopCheckoutUser(
  session: Record<string, unknown>,
  meta: Record<string, string>,
): Promise<{ userId: number | null; recipient: CheckoutRecipient }> {
  const recipient = getWorkshopCheckoutRecipient(session, meta);
  if (recipient.email) {
    const nameParts = (recipient.name ?? "").split(" ").filter(Boolean);
    const resolved = await getOrCreateUserByEmail({
      email: recipient.email,
      name: recipient.name ?? undefined,
      firstName: nameParts[0] || undefined,
      lastName: nameParts.slice(1).join(" ") || undefined,
    });
    return { userId: resolved.user.id, recipient };
  }

  const metadataUserId = positiveInteger(meta.user_id);
  if (metadataUserId) return { userId: metadataUserId, recipient };

  const clientReferenceId = stringValue(session.client_reference_id);
  return { userId: positiveInteger(clientReferenceId), recipient };
}

/**
 * Idempotently create a paid workshop enrollment and its linked access.
 * This is shared by the Stripe webhook and the checkout-complete recovery path.
 * It deliberately does not dispatch an email.
 */
export async function fulfillWorkshopCheckoutFromStripeSession(
  db: any,
  session: Record<string, unknown>,
): Promise<WorkshopCheckoutFulfillmentResult> {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  const workshopId = positiveInteger(meta.workshop_id);
  const instanceId = positiveInteger(meta.instance_id);
  const sessionId = stringValue(session.id);
  const emptyResult = {
    created: false,
    isCurrentCheckout: false,
    userId: null,
    workshopId,
    instanceId,
    recipientEmail: null,
    recipientName: null,
  };

  if (!isWorkshopCheckoutMetadata(meta) || !workshopId || !instanceId) {
    return { success: false, ...emptyResult, error: "not_workshop_checkout" };
  }

  // A webhook retry or the checkout-complete recovery request must retain the
  // original learner that was already bound to this immutable Stripe session.
  if (sessionId) {
    const [sameSession] = await db.select({
      userId: workshopEnrollments.userId,
    }).from(workshopEnrollments).where(and(
      eq(workshopEnrollments.instanceId, instanceId),
      eq(workshopEnrollments.stripeSessionId, sessionId),
    )).limit(1);
    if (sameSession) {
      return {
        success: true,
        created: false,
        isCurrentCheckout: true,
        userId: sameSession.userId,
        workshopId,
        instanceId,
        recipientEmail: null,
        recipientName: null,
      };
    }
  }

  const { userId, recipient } = await resolveWorkshopCheckoutUser(session, meta);
  const resultBase = {
    userId,
    workshopId,
    instanceId,
    recipientEmail: recipient.email,
    recipientName: recipient.name,
  };
  if (!userId) {
    return { success: false, created: false, isCurrentCheckout: false, ...resultBase, error: "missing_recipient" };
  }

  const [instance] = await db.select({
    id: workshopInstances.id,
    workshopId: workshopInstances.workshopId,
    status: workshopInstances.status,
  }).from(workshopInstances).where(eq(workshopInstances.id, instanceId)).limit(1);
  if (!instance || instance.workshopId !== workshopId) {
    return { success: false, created: false, isCurrentCheckout: false, ...resultBase, error: "invalid_workshop_instance" };
  }

  // A second paid attempt for the same learner/run does not create an extra
  // enrollment or consume another seat. It also never reopens an email send.
  const [activeEnrollment] = await db.select({ id: workshopEnrollments.id })
    .from(workshopEnrollments)
    .where(and(
      eq(workshopEnrollments.userId, userId),
      eq(workshopEnrollments.workshopId, workshopId),
      eq(workshopEnrollments.instanceId, instanceId),
      eq(workshopEnrollments.status, "active"),
    ))
    .limit(1);
  if (activeEnrollment) {
    return { success: true, created: false, isCurrentCheckout: false, ...resultBase };
  }

  await db.insert(workshopEnrollments).values({
    workshopId,
    instanceId,
    userId,
    stripeSessionId: sessionId,
    stripePaymentIntentId: stringValue(session.payment_intent),
    amountPaid: typeof session.amount_total === "number" ? session.amount_total : 0,
    currency: stringValue(session.currency) ?? "usd",
    status: "active",
    accessLevel: instance.status === "presale" ? "presale" : "full",
    accessGrantedAt: new Date(),
  });
  await db.update(workshopInstances)
    .set({ enrolledCount: sql`enrolled_count + 1` })
    .where(eq(workshopInstances.id, instanceId));
  await grantScheduledContentAccess(db, {
    userId,
    sourceType: "workshop_instance",
    sourceId: instanceId,
  });
  import("./emailAutomation").then(({ fireEmailAutomationEvent }) =>
    fireEmailAutomationEvent({
      type: "workshop_registration", scope: "learn", userId, email: recipient.email, name: recipient.name,
      targetId: workshopId, contentName: `Workshop #${workshopId}`,
      sourceKey: `workshop-registration:${sessionId ?? `${userId}:${instanceId}`}`,
    }),
  ).catch(() => {});

  return { success: true, created: true, isCurrentCheckout: true, ...resultBase };
}
