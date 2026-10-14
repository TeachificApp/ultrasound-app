/**
 * Production ops: reconcile Stripe purchases for one learner email.
 * Requires DATABASE_URL + STRIPE_SECRET_KEY + JWT_SECRET (same as app).
 *
 * Usage:
 *   pnpm exec tsx server/ops/repairUserStripeAccess.ts --email user@example.com --list
 *   pnpm exec tsx server/ops/repairUserStripeAccess.ts --email user@example.com --membership-sub sub_xxx
 *   pnpm exec tsx server/ops/repairUserStripeAccess.ts --email user@example.com --lms-session cs_xxx [--course-id 123] [--link-only]
 *   pnpm exec tsx server/ops/repairUserStripeAccess.ts --email user@example.com --workshop-session cs_xxx
 */

import { getDb, getUserByEmail } from "../db";
import { buildAdminStripeRepairSnapshot } from "../lib/adminStripeRepairSnapshot";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i === process.argv.length - 1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const email = arg("--email")?.trim().toLowerCase();
  if (!email) {
    console.error("Missing --email");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL unavailable");
    process.exit(1);
  }

  const user = await getUserByEmail(email);
  if (!user) {
    console.error(`No user for ${email}`);
    process.exit(1);
  }

  const listOnly = process.argv.includes("--list");
  const membershipSub = arg("--membership-sub");
  const lmsSession = arg("--lms-session");
  const lmsSub = arg("--lms-sub");
  const workshopSession = arg("--workshop-session");
  const courseId = arg("--course-id") ? parseInt(arg("--course-id")!, 10) : undefined;
  const linkOnly = process.argv.includes("--link-only");

  if (listOnly || (!membershipSub && !lmsSession && !lmsSub && !workshopSession)) {
    const snap = await buildAdminStripeRepairSnapshot(db, user.id);
    console.log(JSON.stringify(snap, null, 2));
    return;
  }

  if (membershipSub) {
    const { reconcileMembershipFromStripeSession } = await import("../lib/membershipFulfillment");
    const { getStripeClient } = await import("../lib/stripeClient");
    const stripe = getStripeClient();
    const sub = await stripe.subscriptions.retrieve(membershipSub);
    const sessions = await stripe.checkout.sessions.list({ subscription: membershipSub, limit: 1 });
    let session: Record<string, unknown>;
    if (sessions.data[0]) {
      session = sessions.data[0] as unknown as Record<string, unknown>;
    } else {
      session = {
        id: `reconcile_sub_${membershipSub}`,
        metadata: { ...(sub.metadata ?? {}), type: "membership", user_id: String(user.id) },
        subscription: sub.id,
        customer: sub.customer,
        customer_email: email,
        amount_total: sub.items?.data?.[0]?.price?.unit_amount ?? 0,
        status: "complete",
        line_items: { data: [{ price: { id: sub.items?.data?.[0]?.price?.id } }] },
      };
    }
    const meta = { ...(session.metadata as Record<string, string>), user_id: String(user.id) };
    session.metadata = meta;
    const result = await reconcileMembershipFromStripeSession(db as any, session);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (lmsSession || lmsSub) {
    const { reconcileLmsCheckoutFromStripeSession } = await import("../lib/lmsCheckoutFulfillment");
    const { getStripeClient } = await import("../lib/stripeClient");
    const stripe = getStripeClient();
    let session: Record<string, unknown>;
    if (lmsSession) {
      session = (await stripe.checkout.sessions.retrieve(lmsSession, { expand: ["line_items"] })) as unknown as Record<string, unknown>;
    } else {
      const sub = await stripe.subscriptions.retrieve(lmsSub!);
      session = {
        id: `reconcile_sub_${lmsSub}`,
        metadata: sub.metadata ?? {},
        subscription: sub.id,
        customer_email: email,
        amount_total: sub.items?.data?.[0]?.price?.unit_amount ?? 0,
        currency: sub.currency ?? "usd",
        status: "complete",
        line_items: { data: sub.items?.data?.map((item) => ({ price: { id: item.price.id } })) ?? [] },
      };
    }
    const result = await reconcileLmsCheckoutFromStripeSession(db as any, session, {
      userId: user.id,
      courseId,
      linkOnly,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (workshopSession) {
    const { fulfillWorkshopCheckoutFromStripeSession } = await import("../lib/workshopCheckoutFulfillment");
    const { getStripeClient } = await import("../lib/stripeClient");
    const stripe = getStripeClient();
    const session = (await stripe.checkout.sessions.retrieve(workshopSession)) as unknown as Record<string, unknown>;
    const meta = { ...(session.metadata as Record<string, string>), user_id: String(user.id), customer_email: email };
    session.metadata = meta;
    const result = await fulfillWorkshopCheckoutFromStripeSession(db as any, session);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
