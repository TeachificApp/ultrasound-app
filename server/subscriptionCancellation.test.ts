import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  isStripeSubscriptionMissingError,
  reactivateStripeSubscription,
  scheduleStripeSubscriptionCancellation,
} from "./lib/subscriptionCancellation";

function stripeStub(overrides?: {
  retrieve?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
}) {
  return {
    subscriptions: {
      retrieve: overrides?.retrieve ?? vi.fn(),
      update: overrides?.update ?? vi.fn(),
    },
  };
}

describe("learner subscription cancellation", () => {
  it("recognizes only Stripe's missing-subscription errors", () => {
    expect(isStripeSubscriptionMissingError({ code: "resource_missing" })).toBe(true);
    expect(isStripeSubscriptionMissingError({ statusCode: 404 })).toBe(true);
    expect(isStripeSubscriptionMissingError({ message: "No such subscription: 'sub_old'" })).toBe(true);
    expect(isStripeSubscriptionMissingError({ statusCode: 500, message: "Stripe is temporarily unavailable" })).toBe(false);
  });

  it("schedules an active subscription at its live period end", async () => {
    const periodEndSeconds = 1_800_000_000;
    const stripe = stripeStub({
      retrieve: vi.fn().mockResolvedValue({ status: "active", cancel_at_period_end: false }),
      update: vi.fn().mockResolvedValue({
        status: "active",
        cancel_at_period_end: true,
        current_period_end: periodEndSeconds,
      }),
    });

    const result = await scheduleStripeSubscriptionCancellation(stripe, "sub_active");

    expect(result.outcome).toBe("scheduled");
    expect(result.periodEnd).toEqual(new Date(periodEndSeconds * 1_000));
    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_active", { cancel_at_period_end: true });
  });

  it("treats an already scheduled cancellation as successful without a duplicate Stripe update", async () => {
    const stripe = stripeStub({
      retrieve: vi.fn().mockResolvedValue({
        status: "active",
        cancel_at_period_end: true,
        current_period_end: 1_800_000_000,
      }),
    });

    const result = await scheduleStripeSubscriptionCancellation(stripe, "sub_pending");

    expect(result.outcome).toBe("already_scheduled");
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it("treats a missing Stripe subscription as already ended instead of returning Stripe's raw error", async () => {
    const stripe = stripeStub({
      retrieve: vi.fn().mockRejectedValue({
        code: "resource_missing",
        statusCode: 404,
        message: "No such subscription: 'sub_removed'",
      }),
    });

    const result = await scheduleStripeSubscriptionCancellation(stripe, "sub_removed");

    expect(result).toMatchObject({ outcome: "already_ended", status: "canceled", periodEnd: null });
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it("returns a clear safe error for temporary Stripe failures", async () => {
    const stripe = stripeStub({
      retrieve: vi.fn().mockRejectedValue(new Error("Stripe connection timeout")),
    });

    await expect(scheduleStripeSubscriptionCancellation(stripe, "sub_retry")).rejects.toMatchObject<Partial<TRPCError>>({
      code: "INTERNAL_SERVER_ERROR",
      message: "We could not update your subscription right now. Please try again in a few minutes.",
    });
  });

  it("does not try to reactivate a missing Stripe subscription", async () => {
    const stripe = stripeStub({
      update: vi.fn().mockRejectedValue({ code: "resource_missing", message: "No such subscription" }),
    });

    await expect(reactivateStripeSubscription(stripe, "sub_removed")).resolves.toEqual({ reactivated: false });
  });
});
