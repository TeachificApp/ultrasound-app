import { describe, expect, it } from "vitest";
import { formatStripeSubscriptionSyncReport, isAccountAddedSincePreviousSync } from "./scheduled/stripeSubscriptionSyncReport";

describe("Stripe subscription sync report", () => {
  it("counts only newly observed accounts after a prior sync baseline exists", () => {
    expect(isAccountAddedSincePreviousSync({ hasPreviousSync: false, wasPreviouslyObserved: false })).toBe(false);
    expect(isAccountAddedSincePreviousSync({ hasPreviousSync: true, wasPreviouslyObserved: true })).toBe(false);
    expect(isAccountAddedSincePreviousSync({ hasPreviousSync: true, wasPreviouslyObserved: false })).toBe(true);
  });

  it("reports added accounts and identifies every access removal by account and course without exposing email or payment identifiers", () => {
    const report = formatStripeSubscriptionSyncReport({
      totalSubscriptions: 39,
      accountsAdded: 3,
      accessRevoked: 2,
      revokedAccounts: [
        { userId: 1204, displayName: "Taylor Learner", courseTitle: "All About LV Mechanical Support", reason: "Subscription canceled" },
        { userId: 1205, displayName: "Morgan Learner", courseTitle: "Vascular Review", reason: "Grace period expired" },
      ],
      warningEmailsSent: 1,
      errors: 0,
    });

    expect(report).toContain("Accounts added since the previous sync: 3.");
    expect(report).toContain("Access removed: 2 enrollment(s).");
    expect(report).toContain("Taylor Learner (Account 1204) — All About LV Mechanical Support: Subscription canceled.");
    expect(report).toContain("Morgan Learner (Account 1205) — Vascular Review: Grace period expired.");
    expect(report).not.toMatch(/@|pi_|cus_|sub_/);
  });
});
