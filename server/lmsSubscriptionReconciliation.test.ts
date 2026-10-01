import { describe, expect, it } from "vitest";
import {
  shouldMirrorLmsSubscriptionInvoice,
  stripeResourceId,
  subscriptionMatchesOrder,
} from "./lib/lmsSubscriptionReconciliation";

describe("LMS recurring subscription invoice reconciliation", () => {
  it("records paid renewals while leaving the original Checkout invoice in lms_orders", () => {
    expect(shouldMirrorLmsSubscriptionInvoice({
      id: "in_renewal",
      amount_paid: 3997,
      billing_reason: "subscription_cycle",
    })).toBe(true);

    expect(shouldMirrorLmsSubscriptionInvoice({
      id: "in_initial",
      amount_paid: 3997,
      billing_reason: "subscription_create",
    })).toBe(false);
  });

  it("does not create financial transaction rows for zero-dollar invoices", () => {
    expect(shouldMirrorLmsSubscriptionInvoice({
      id: "in_zero",
      amount_paid: 0,
      billing_reason: "subscription_cycle",
    })).toBe(false);
  });

  it("normalizes expanded and string Stripe resource references", () => {
    expect(stripeResourceId("pi_payment")).toBe("pi_payment");
    expect(stripeResourceId({ id: "pi_expanded" })).toBe("pi_expanded");
    expect(stripeResourceId(null)).toBeNull();
  });

  it("recovers a legacy subscription reference from the recurring Stripe price", () => {
    expect(subscriptionMatchesOrder({
      id: "sub_actual",
      items: { data: [{ price: { id: "price_course_subscription" } }] },
    }, {
      id: 1,
      userId: 2,
      courseId: 3,
      stripeSubscriptionId: "sub_corrupted",
      stripeSessionId: null,
      email: "learner@example.com",
      courseTitle: "Course",
      pricingType: "subscription",
      stripePriceId: "price_course_subscription",
    })).toBe(true);
  });

  it("recovers a legacy subscription after the recurring price changes on the same Stripe product", () => {
    expect(subscriptionMatchesOrder({
      id: "sub_legacy_price",
      items: { data: [{ price: { id: "price_retired", product: "prod_course" } }] },
    }, {
      id: 1,
      userId: 2,
      courseId: 3,
      stripeSubscriptionId: "sub_truncated",
      stripeSessionId: null,
      email: "learner@example.com",
      courseTitle: "Course",
      pricingType: "subscription",
      stripePriceId: "price_current",
    }, "prod_course")).toBe(true);
  });
});
