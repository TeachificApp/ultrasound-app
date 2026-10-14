import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import {
  workshopEnrollments,
  workshopInstances,
  workshops,
} from "../../drizzle/schema";
import { getOrCreateUserByEmail } from "../db";
import { grantScheduledContentAccess } from "./scheduledContentLinks";

export type WorkshopCheckoutFulfillmentResult = {
  success: boolean;
  created: boolean;
  userId: number | null;
  workshopId: number | null;
  instanceId: number | null;
  error?: string;
};

export function isWorkshopCheckoutMetadata(meta: Record<string, string>): boolean {
  return meta.type === "workshop" && !!meta.workshop_id && !!meta.instance_id;
}

/** Resolve purchaser user id from Stripe session (logged-in, client_reference_id, or email). */
export async function resolveWorkshopCheckoutUserId(
  session: Record<string, unknown>,
): Promise<number | null> {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  const fromMeta = parseInt(meta.user_id ?? "", 10);
  if (fromMeta && !Number.isNaN(fromMeta)) return fromMeta;

  const ref = session.client_reference_id as string | undefined;
  if (ref) {
    const fromRef = parseInt(ref, 10);
    if (fromRef && !Number.isNaN(fromRef)) return fromRef;
  }

  const email =
    meta.customer_email?.trim()
    || (session.customer_details as { email?: string } | undefined)?.email?.trim()
    || (session.customer_email as string | undefined)?.trim()
    || "";

  if (!email) return null;

  const created = await getOrCreateUserByEmail({
    email,
    name: meta.customer_name?.trim() || email.split("@")[0],
  });
  return created.user.id ?? null;
}

/**
 * Idempotent workshop enrollment from a completed Stripe Checkout session.
 * Used by webhooks and the checkout completion page fallback.
 */
export async function fulfillWorkshopCheckoutFromStripeSession(
  db: MySql2Database<typeof schema>,
  session: Record<string, unknown>,
): Promise<WorkshopCheckoutFulfillmentResult> {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (!isWorkshopCheckoutMetadata(meta)) {
    return { success: false, created: false, userId: null, workshopId: null, instanceId: null, error: "not_workshop" };
  }

  const workshopId = parseInt(meta.workshop_id, 10);
  const instanceId = parseInt(meta.instance_id, 10);
  const userId = await resolveWorkshopCheckoutUserId(session);

  if (!workshopId || !instanceId || !userId) {
    return {
      success: false,
      created: false,
      userId: userId ?? null,
      workshopId: workshopId || null,
      instanceId: instanceId || null,
      error: "missing_workshop_instance_or_user",
    };
  }

  const sessionId = session.id as string | undefined;
  const [existing] = await db
    .select({ id: workshopEnrollments.id })
    .from(workshopEnrollments)
    .where(
      and(
        eq(workshopEnrollments.userId, userId),
        eq(workshopEnrollments.instanceId, instanceId),
        sessionId ? eq(workshopEnrollments.stripeSessionId, sessionId) : eq(workshopEnrollments.workshopId, workshopId),
      ),
    )
    .limit(1);

  if (existing) {
    return { success: true, created: false, userId, workshopId, instanceId };
  }

  const [duplicateActive] = await db
    .select({ id: workshopEnrollments.id })
    .from(workshopEnrollments)
    .where(
      and(
        eq(workshopEnrollments.userId, userId),
        eq(workshopEnrollments.workshopId, workshopId),
        eq(workshopEnrollments.instanceId, instanceId),
        eq(workshopEnrollments.status, "active"),
      ),
    )
    .limit(1);
  if (duplicateActive) {
    return { success: true, created: false, userId, workshopId, instanceId };
  }

  const [instanceAvailability] = await db
    .select({ status: workshopInstances.status })
    .from(workshopInstances)
    .where(eq(workshopInstances.id, instanceId))
    .limit(1);

  const amountPaid = (session.amount_total as number) ?? 0;
  await db.insert(workshopEnrollments).values({
    workshopId,
    instanceId,
    userId,
    stripeSessionId: sessionId ?? null,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    amountPaid,
    currency: (session.currency as string) ?? "usd",
    status: "active",
    accessLevel: instanceAvailability?.status === "presale" ? "presale" : "full",
    accessGrantedAt: new Date(),
  });

  await grantScheduledContentAccess(db, {
    userId,
    sourceType: "workshop_instance",
    sourceId: instanceId,
  });

  return { success: true, created: true, userId, workshopId, instanceId };
}
