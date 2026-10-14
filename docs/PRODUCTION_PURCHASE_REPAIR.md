# Production purchase access repair (Platform Admin)

Use **Platform Admin → Users → [student] → Subscriptions → Stripe purchase repair** after deploy. This panel loads Stripe customers/subs/sessions for the user email and runs reconcile mutations.

Requires production `DATABASE_URL` (Railway MySQL) and `STRIPE_SECRET_KEY` on the app service.

## Access emails (consent gate)

Automatic enrollment / purchase access emails are **off** unless Railway has:

`ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS=true`

While that variable is unset, Stripe webhooks and reconcile flows still grant access in MySQL but **do not email** learners. To email:

- Use **Resend enrollment email** on a specific enrollment, or  
- **Repair Access** with “Resend access emails” checked, or  
- Set the env var when templates and dates are verified.

## Before you start

1. Confirm the app uses Railway MySQL (`RAILWAY_MYSQL_URL` / `DATABASE_URL`) — not a stale TiDB URL.
2. In Stripe Dashboard, find the payer email and copy `cus_…`, `sub_…`, and/or `cs_…` from the successful payment.
3. Open the learner in Platform Admin and note **user id** and **account email** (may differ from Stripe receipt email).

## Membership / standing subscription (e.g. double charge)

1. **Subscriptions tab** → **Refresh Stripe snapshot** — check for duplicate active `sub_…` on the same price.
2. Keep the subscription that matches the plan the learner should have; in Stripe Dashboard **cancel** the extra sub(s) and **refund** the duplicate invoice (finance — not automatic in app).
3. **Run reconcile** → product type **Membership** → paste the kept `sub_…` (or paid `cs_…`) → **Run reconcile**.  
   Equivalent API: `membership.reconcileStripeMembership` with `stripeSubscriptionId` or `stripeCheckoutSessionId`, plus `email` and optional `userId` if emails differ.
4. **Flag duplicate subscriptions**: enter `cus_…` and the kept `sub_…` — sends admin alert email (does not cancel in Stripe).
5. Confirm one row in `membership_subscriptions` with the kept `stripe_subscription_id`.

## LMS course / quiz (learn / app)

1. Product type **LMS course / quiz** → paste paid `cs_…` or recurring `sub_…` → optional **Course ID** if auto-detect fails.
2. If the student was enrolled manually first: check **Link Stripe only** to attach Stripe IDs without resending enrollment email.  
   Or use **Link Stripe subscription** API: `lmsEnrollmentAdmin.linkStripeSubscription` (`userId`, `courseId`, `stripeSubscriptionId`).
3. Equivalent: `lmsEnrollmentAdmin.reconcileStripeLmsCheckout`.

## Workshop

1. Product type **Workshop** → paste paid checkout **`cs_…`** (metadata must include `type=workshop`, `workshop_id`, `instance_id`).
2. Equivalent: `workshopAdmin.reconcileStripeWorkshopCheckout`.
3. Fallback for the learner: `/checkout/complete?session_id=cs_…&type=workshop` while logged out or as the user.

## Email / login still broken

**Profile tab → Repair Access** (clears suppressions, fixes openId, regenerates access token, resends enrollment emails). This does not replay Stripe fulfillment.

## CLI (Railway one-off)

From a shell with production env:

```bash
export JWT_SECRET="…"
export STRIPE_SECRET_KEY="sk_live_…"
export DATABASE_URL="mysql://…"

pnpm exec tsx server/ops/repairUserStripeAccess.ts --email learner@example.com --list

pnpm exec tsx server/ops/repairUserStripeAccess.ts --email learner@example.com --membership-sub sub_xxx

pnpm exec tsx server/ops/repairUserStripeAccess.ts --email learner@example.com --lms-session cs_xxx

pnpm exec tsx server/ops/repairUserStripeAccess.ts --email learner@example.com --workshop-session cs_xxx
```
