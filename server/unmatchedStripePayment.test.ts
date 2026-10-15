import { describe, expect, it } from "vitest";
import {
  UNMATCHED_STRIPE_PAYMENT_MARKER,
  hasKnownStripeCheckoutRoute,
  hasUnmatchedPlatformPaymentIntentMetadata,
  isUnmatchedStripePaymentException,
  unmatchedStripePaymentMessage,
} from "./lib/unmatchedStripePayment";

describe("unmatched successful Stripe payment safeguards", () => {
  it.each([
    { type: "lms_course", course_id: "60001" },
    { type: "digital_download", product_id: "42" },
    { type: "digital_bundle", bundle_id: "9" },
    { type: "physical_product", product_id: "12" },
    { type: "workshop", workshop_id: "10", instance_id: "22" },
    { type: "webinar", webinar_id: "7" },
    { type: "membership", plan_id: "3" },
    { type: "brand_membership_upgrade", brand: "aaus" },
    { type: "dual_membership" },
    { type: "dual_membership_lifetime" },
    { type: "team_subscription" },
    { type: "funnel_form_purchase", product_type: "course" },
    { type: "embedded_checkout_purchase", product_type: "download" },
    { purchase_type: "bundle_purchase", bundle_id: "13" },
    { product_type: "diy_accreditation", diy_plan: "starter" },
    { product_type: "employer_subscription" },
    { checkout_type: "study_group_content", study_group_id: "8" },
    { course_id: "100", source: "hosted_checkout_course" },
  ])("recognizes the supported platform checkout route %#", (metadata) => {
    expect(hasKnownStripeCheckoutRoute({ amount_total: 4999 }, metadata)).toBe(true);
  });

  it("recognizes the legacy Concierge checkout link", () => {
    expect(hasKnownStripeCheckoutRoute({
      amount_total: 4_997_00,
      payment_link: "https://buy.stripe.com/7sYcN475Lcs94Nm3hH9R604",
    }, {})).toBe(true);
  });

  it("flags an unknown positive platform payment route for review", () => {
    expect(hasKnownStripeCheckoutRoute({ amount_total: 12_500 }, { type: "retired_unmapped_product" })).toBe(false);
    expect(hasUnmatchedPlatformPaymentIntentMetadata({ type: "retired_unmapped_product" })).toBe(true);
  });

  it("does not classify generic Stripe payment intents as platform exceptions", () => {
    expect(hasUnmatchedPlatformPaymentIntentMetadata({})).toBe(false);
  });

  it("marks only the dedicated exception record as not safely retryable", () => {
    const errorMessage = unmatchedStripePaymentMessage("No recognized routing metadata was supplied.");
    expect(errorMessage).toContain(UNMATCHED_STRIPE_PAYMENT_MARKER);
    expect(isUnmatchedStripePaymentException({ productType: "other", errorMessage })).toBe(true);
    expect(isUnmatchedStripePaymentException({ productType: "course", errorMessage })).toBe(false);
    expect(isUnmatchedStripePaymentException({ productType: "other", errorMessage: "Other error" })).toBe(false);
  });
});
