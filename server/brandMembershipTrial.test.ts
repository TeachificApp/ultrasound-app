import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BRAND_PREMIUM_TRIAL_DAYS,
  hasBrandMembershipTrial,
  hasPriorStripeBrandMembership,
  isBrandMembershipTrialCheckout,
} from "./lib/brandMembershipTrial";

const root = new URL(".", import.meta.url).pathname;
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");

describe("brand Premium introductory trial rules", () => {
  it("recognizes only the intended app checkout trial metadata", () => {
    expect(hasBrandMembershipTrial({ type: "brand_membership_upgrade", trial_days: "3" })).toBe(true);
    expect(hasBrandMembershipTrial({ type: "dual_membership", trial_days: BRAND_PREMIUM_TRIAL_DAYS })).toBe(true);
    expect(hasBrandMembershipTrial({ type: "membership", trial_days: "3" })).toBe(false);
    expect(hasBrandMembershipTrial({ type: "brand_membership_upgrade", trial_days: "7" })).toBe(false);
  });

  it("allows an entitlement for Stripe's no-payment-required trial checkout only", () => {
    expect(isBrandMembershipTrialCheckout({
      payment_status: "no_payment_required",
      metadata: { type: "brand_membership_upgrade", trial_days: "3" },
    })).toBe(true);
    expect(isBrandMembershipTrialCheckout({
      payment_status: "unpaid",
      metadata: { type: "brand_membership_upgrade", trial_days: "3" },
    })).toBe(false);
    expect(isBrandMembershipTrialCheckout({
      payment_status: "no_payment_required",
      metadata: { type: "course", trial_days: "3" },
    })).toBe(false);
  });

  it("blocks repeat introductory trials for existing Stripe app members", () => {
    expect(hasPriorStripeBrandMembership({ stripeSubscriptionId: "sub_previous" })).toBe(true);
    expect(hasPriorStripeBrandMembership({ stripeCustomerId: "cus_previous" })).toBe(true);
    expect(hasPriorStripeBrandMembership({ source: "stripe_dual" })).toBe(true);
    expect(hasPriorStripeBrandMembership({ source: "admin" })).toBe(false);
    expect(hasPriorStripeBrandMembership(null)).toBe(false);
  });

  it("uses Stripe's trial field and preserves trial metadata on every app Premium checkout", () => {
    const router = read("routers/brandMembershipRouter.ts");
    expect(router.match(/trial_period_days: BRAND_PREMIUM_TRIAL_DAYS/g)).toHaveLength(3);
    expect(router.match(/trial_days: String\(BRAND_PREMIUM_TRIAL_DAYS\)/g)).toHaveLength(6);
    expect(router).toContain("isEligibleForBrandPremiumTrial");
  });

  it("does not defer a valid app trial while retaining the non-paid checkout safeguard", () => {
    const webhook = read("webhooks/stripe.ts");
    expect(webhook).toContain("isBrandMembershipTrialCheckout");
    expect(webhook).toContain('sessionPaymentStatus !== "paid" && !isBrandMembershipTrialCheckout');
    expect(webhook).toContain("Your paid subscription begins automatically after the 3-day trial");
  });

  it("advertises the three-day trial in shared and primary Premium prompts", () => {
    const files = [
      "../client/src/pages/Premium.tsx",
      "../client/src/components/PremiumPearlGate.tsx",
      "../client/src/components/PremiumModal.tsx",
      "../client/src/components/UpgradePrompt.tsx",
    ];
    for (const file of files) {
      expect(readFileSync(new URL(file, import.meta.url), "utf8")).toContain("PREMIUM_TRIAL");
    }
  });
});
