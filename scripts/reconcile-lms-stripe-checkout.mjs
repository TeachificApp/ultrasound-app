#!/usr/bin/env node
/**
 * Manually fulfill an LMS Stripe checkout (guest or logged-in) when webhook missed.
 *
 * Usage:
 *   DATABASE_URL=... STRIPE_SECRET_KEY=... JWT_SECRET=... \
 *     node scripts/reconcile-lms-stripe-checkout.mjs \
 *       --subscription sub_xxx --email user@example.com
 *
 *   node scripts/reconcile-lms-stripe-checkout.mjs --session cs_xxx
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    session: { type: "string" },
    subscription: { type: "string" },
    email: { type: "string" },
  },
});

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is required (db module)");
  process.exit(1);
}

if (!values.session && !values.subscription) {
  console.error("Provide --session or --subscription");
  process.exit(1);
}

const Stripe = (await import("stripe")).default;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

let session;
if (values.session) {
  session = await stripe.checkout.sessions.retrieve(values.session, { expand: ["line_items"] });
} else {
  const sessions = await stripe.checkout.sessions.list({
    subscription: values.subscription,
    limit: 1,
  });
  if (sessions.data[0]) {
    session = await stripe.checkout.sessions.retrieve(sessions.data[0].id, {
      expand: ["line_items"],
    });
  } else {
    const sub = await stripe.subscriptions.retrieve(values.subscription);
    session = {
      id: `reconcile_sub_${values.subscription}`,
      metadata: sub.metadata ?? {},
      subscription: sub.id,
      customer: sub.customer,
      customer_email: values.email ?? undefined,
      amount_total: sub.items?.data?.[0]?.price?.unit_amount ?? 0,
      currency: sub.currency ?? "usd",
      status: "complete",
      line_items: {
        data: sub.items?.data?.map((item) => ({ price: { id: item.price.id } })) ?? [],
      },
    };
  }
}

console.log("Stripe session:", session.id);
console.log("Metadata:", JSON.stringify(session.metadata, null, 2));
console.log("Customer email:", session.customer_details?.email ?? session.customer_email ?? values.email);

const { getDb } = await import("../server/db.ts");
const { reconcileLmsCheckoutFromStripeSession } = await import("../server/lib/lmsCheckoutFulfillment.ts");

const db = await getDb();
if (!db) {
  console.error("DB unavailable");
  process.exit(1);
}

const result = await reconcileLmsCheckoutFromStripeSession(db, session);
console.log("\nResult:", JSON.stringify(result, null, 2));
process.exit(result.success ? 0 : 1);
