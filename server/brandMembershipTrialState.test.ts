import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Brand Membership Premium Trial state", () => {
  it("defines an additive persisted trial marker and trial-end time", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/0090_brand_membership_trial_state.sql");

    expect(schema).toContain('isTrial: boolean("isTrial").notNull().default(false)');
    expect(schema).toContain('trialEndsAt: timestamp("trialEndsAt")');
    expect(migration).toContain('ADD COLUMN `isTrial` BOOLEAN NOT NULL DEFAULT FALSE');
    expect(migration).toContain('ADD COLUMN `trialEndsAt` TIMESTAMP NULL');
  });

  it("persists and synchronizes Stripe trial state instead of treating it as paid Premium", () => {
    const webhook = read("server/webhooks/stripe.ts");
    const dashboard = read("server/routers/dashboardRouter.ts");
    const adminRouter = read("server/routers/adminUserRouter.ts");

    expect(webhook).toContain("resolveBrandPremiumTrialEnd(subscriptionId, isTrial)");
    expect(webhook).toContain("isTrial,");
    expect(webhook).toContain("trialEndsAt,");
    expect(webhook).toContain('Premium TRIAL');
    expect(dashboard).toContain("isTrial: m.isTrial");
    expect(dashboard).toContain("trialEndsAt: m.trialEndsAt");
    expect(adminRouter).toContain("const isTrial = stripeStatus === \"trialing\" && !!trialEndsAt;");
  });

  it("uses Stripe recurring subscriptions so each uncancelled three-day trial converts to the selected paid plan", () => {
    const memberships = read("server/routers/brandMembershipRouter.ts");

    expect(memberships).toContain('mode: "subscription"');
    expect(memberships).toContain("trial_period_days: BRAND_PREMIUM_TRIAL_DAYS");
    expect(memberships).toContain("recurringLineItem");
    expect(memberships).toContain("dualMonthlyLineItem");
    expect(memberships).toContain("dualAnnualLineItem");
  });

  it("uses clear labels and friendly fallback messaging in admin and learner views", () => {
    const adminPage = read("client/src/pages/admin/AdminUserDetailPage.tsx");
    const studentPage = read("client/src/pages/StudentDashboardPage.tsx");

    expect(adminPage).toContain('m.isTrial ? "Premium TRIAL"');
    expect(adminPage).toContain("We could not load this member profile just now");
    expect(studentPage).toContain('activeTrial ? "Premium TRIAL"');
    expect(studentPage).toContain("Cancel Free Trial");
    expect(studentPage).toContain("Cancel before the trial ends and you will not be charged.");
  });
});
