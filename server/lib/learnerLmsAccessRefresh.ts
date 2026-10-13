import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import { getStripeClient } from "./stripeClient";
import { refreshLearnerLmsAccessFromStripe } from "./lmsSubscriptionReconciliation";

/**
 * Best-effort Stripe ↔ LMS enrollment sync before learner-facing reads.
 * Safe to call on every dashboard / course-player load; failures are logged inside refresh.
 */
export async function maybeRefreshLearnerLmsAccessFromStripe(
  db: MySql2Database<typeof schema>,
  userId: number,
  options?: { role?: string },
): Promise<void> {
  if (options?.role === "admin") return;
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return;
  await refreshLearnerLmsAccessFromStripe(db, getStripeClient(), userId);
}
