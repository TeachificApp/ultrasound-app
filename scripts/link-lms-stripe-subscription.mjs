#!/usr/bin/env node
/**
 * Link an existing manual enrollment to a Stripe subscription (post-admin setup).
 *
 * DB columns updated:
 *   lms_orders.stripe_subscription_id, stripe_payment_intent_id, stripe_session_id, status
 *   lms_enrollments.stripe_subscription_id, access_expires_at, source, order_id
 *
 * Usage (after creating user + enrollment in admin):
 *   DATABASE_URL=... STRIPE_SECRET_KEY=... JWT_SECRET=... \
 *     node scripts/link-lms-stripe-subscription.mjs \
 *       --user-id 123 --course-id 630002 \
 *       --subscription sub_1ThKcMBj9HgnkZLK0ZelVzOX \
 *       --payment-intent pi_3ThKcNBj9HgnkZLK0uFuy6IC
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "user-id": { type: "string" },
    "course-id": { type: "string" },
    "enrollment-id": { type: "string" },
    subscription: { type: "string" },
    "payment-intent": { type: "string" },
    session: { type: "string" },
    amount: { type: "string" },
  },
});

for (const key of ["DATABASE_URL", "STRIPE_SECRET_KEY", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`${key} is required`);
    process.exit(1);
  }
}

if (!values.subscription) {
  console.error("--subscription is required");
  process.exit(1);
}

const userId = values["user-id"] ? parseInt(values["user-id"], 10) : undefined;
const courseId = values["course-id"] ? parseInt(values["course-id"], 10) : undefined;
const enrollmentId = values["enrollment-id"] ? parseInt(values["enrollment-id"], 10) : undefined;

if (!enrollmentId && !(userId && courseId)) {
  console.error("Provide --enrollment-id OR both --user-id and --course-id");
  process.exit(1);
}

const { getDb } = await import("../server/db.ts");
const { linkLmsEnrollmentToStripeSubscription } = await import("../server/lib/lmsCheckoutFulfillment.ts");

const db = await getDb();
if (!db) {
  console.error("DB unavailable");
  process.exit(1);
}

const result = await linkLmsEnrollmentToStripeSubscription(db, {
  stripeSubscriptionId: values.subscription,
  userId,
  courseId,
  enrollmentId,
  stripePaymentIntentId: values["payment-intent"] ?? null,
  stripeCheckoutSessionId: values.session ?? null,
  amountCents: values.amount ? parseInt(values.amount, 10) : null,
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.success ? 0 : 1);
