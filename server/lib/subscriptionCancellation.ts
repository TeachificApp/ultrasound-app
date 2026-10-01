import { TRPCError } from "@trpc/server";

type StripeSubscriptionLike = {
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: number | null;
  trial_end?: number | null;
  ended_at?: number | null;
};

type StripeSubscriptionClient = {
  subscriptions: {
    retrieve: (subscriptionId: string) => Promise<StripeSubscriptionLike>;
    update: (
      subscriptionId: string,
      options: { cancel_at_period_end: boolean },
    ) => Promise<StripeSubscriptionLike>;
  };
};

export type SubscriptionCancellationResult = {
  outcome: "scheduled" | "already_scheduled" | "already_ended";
  periodEnd: Date | null;
  trialEnd: Date | null;
  status: string | null;
};

function unixSecondsToDate(value: number | null | undefined): Date | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? new Date(value * 1_000)
    : null;
}

function toResult(
  outcome: SubscriptionCancellationResult["outcome"],
  subscription: StripeSubscriptionLike,
): SubscriptionCancellationResult {
  return {
    outcome,
    periodEnd: unixSecondsToDate(subscription.current_period_end)
      ?? unixSecondsToDate(subscription.ended_at),
    trialEnd: unixSecondsToDate(subscription.trial_end),
    status: subscription.status ?? null,
  };
}

/** Returns true only when Stripe confirms that the referenced subscription does not exist. */
export function isStripeSubscriptionMissingError(error: unknown): boolean {
  const candidate = error as { code?: unknown; statusCode?: unknown; message?: unknown } | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  return candidate?.code === "resource_missing"
    || candidate?.statusCode === 404
    || /no such subscription/i.test(message);
}

/**
 * Schedules a Stripe subscription to end without exposing a raw Stripe error.
 * A missing or already-ended Stripe record is a successful, idempotent outcome:
 * it cannot bill the learner again and the caller should reconcile local access.
 */
export async function scheduleStripeSubscriptionCancellation(
  stripe: StripeSubscriptionClient,
  subscriptionId: string,
): Promise<SubscriptionCancellationResult> {
  try {
    const liveSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    const status = liveSubscription.status?.toLowerCase();

    if (status === "canceled" || status === "cancelled" || liveSubscription.ended_at) {
      return toResult("already_ended", liveSubscription);
    }

    if (liveSubscription.cancel_at_period_end) {
      return toResult("already_scheduled", liveSubscription);
    }

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    const updatedStatus = updatedSubscription.status?.toLowerCase();
    return toResult(
      updatedStatus === "canceled" || updatedStatus === "cancelled" || updatedSubscription.ended_at
        ? "already_ended"
        : "scheduled",
      updatedSubscription,
    );
  } catch (error) {
    if (isStripeSubscriptionMissingError(error)) {
      return { outcome: "already_ended", periodEnd: null, trialEnd: null, status: "canceled" };
    }
    console.error("[SubscriptionCancellation] Unable to schedule cancellation:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "We could not update your subscription right now. Please try again in a few minutes.",
    });
  }
}

/**
 * Reactivates a previously scheduled subscription. A missing Stripe record cannot
 * be reactivated, but is not an internal error because it is already ended.
 */
export async function reactivateStripeSubscription(
  stripe: StripeSubscriptionClient,
  subscriptionId: string,
): Promise<{ reactivated: boolean }> {
  try {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    return { reactivated: true };
  } catch (error) {
    if (isStripeSubscriptionMissingError(error)) return { reactivated: false };
    console.error("[SubscriptionCancellation] Unable to reactivate subscription:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "We could not reactivate your subscription right now. Please try again in a few minutes.",
    });
  }
}
