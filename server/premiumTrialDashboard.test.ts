import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isActiveBrandPremiumTrialSubscription } from "./lib/brandMembershipTrial";
import {
  formatPremiumTrialCountdown,
  getActivePremiumTrial,
} from "../client/src/lib/premiumTrialCountdown";

const root = new URL(".", import.meta.url).pathname;
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");

describe("Premium trial dashboard experience", () => {
  const now = new Date("2026-09-17T12:00:00.000Z").getTime();

  it("identifies only live Stripe trialing subscriptions with a future trial end", () => {
    expect(isActiveBrandPremiumTrialSubscription({
      status: "trialing",
      trialEnd: new Date(now + 60_000),
    }, now)).toBe(true);
    expect(isActiveBrandPremiumTrialSubscription({
      status: "active",
      trialEnd: new Date(now + 60_000),
    }, now)).toBe(false);
    expect(isActiveBrandPremiumTrialSubscription({
      status: "trialing",
      trialEnd: new Date(now - 60_000),
    }, now)).toBe(false);
  });

  it("calculates a readable countdown and final-day state from only the live trial response", () => {
    const trial = getActivePremiumTrial([
      null,
      undefined,
      { status: "active", trialEnd: new Date(now + 10 * 60_000) },
      { status: "trialing", trialEnd: new Date(now + 23 * 60 * 60_000 + 59 * 60_000) },
    ], now);
    expect(trial).toMatchObject({ isFinalDay: true });
    expect(formatPremiumTrialCountdown(trial!.remainingMs)).toBe("23h 59m");
    expect(getActivePremiumTrial([{ status: "trialing", trialEnd: new Date(now - 1) }], now)).toBeNull();
    expect(getActivePremiumTrial([null, undefined], now)).toBeNull();
  });

  it("exposes only a trial expiry timestamp for dashboard membership timing", () => {
    const dashboardRouter = read("routers/dashboardRouter.ts");
    expect(dashboardRouter).toContain("trialEnd: sub.trial_end");
    expect(dashboardRouter).toContain("isActiveBrandPremiumTrialSubscription");
  });

  it("presents the countdown, final-day alert, and feedback dialog in the student dashboard", () => {
    const dashboard = read("../client/src/pages/StudentDashboardPage.tsx");
    expect(dashboard).toContain("PremiumTrialCountdownBanner");
    expect(dashboard).toContain("Less than 24 hours remain");
    expect(dashboard).toContain("Before you cancel your free trial");
    expect(dashboard).toContain("TRIAL_CANCELLATION_REASONS");
    expect(dashboard).toContain('type="radio"');
    expect(dashboard).toContain('role="radiogroup"');
    expect(dashboard).not.toContain('<select\n                id="trial-cancellation-reason"');
  });

  it("alerts Platform Admin only for a newly scheduled active Premium trial cancellation", () => {
    const dashboardRouter = read("routers/dashboardRouter.ts");
    expect(dashboardRouter).toContain("trialFeedback");
    expect(dashboardRouter).toContain("Premium trial cancellation feedback");
    expect(dashboardRouter).toContain("const isNewTrialCancellation = isTrialCancellation && !wasAlreadyScheduledForCancellation");
    expect(dashboardRouter).toContain("notifyOwner({");
  });

  it("retains structured trial feedback and exposes admin-only cancellation-reason insights", () => {
    const schema = read("../drizzle/schema.ts");
    const migration = read("../drizzle/0068_premium_trial_cancellation_feedback.sql");
    const dashboardRouter = read("routers/dashboardRouter.ts");
    const notificationsRouter = read("routers/adminNotificationsRouter.ts");
    const notificationsPage = read("../client/src/pages/admin/AdminNotifications.tsx");

    expect(schema).toContain('premiumTrialCancellationFeedback = mysqlTable("premium_trial_cancellation_feedback"');
    expect(migration).toContain('UNIQUE KEY `premium_trial_feedback_subscription_unique`');
    expect(dashboardRouter).toContain("db.insert(premiumTrialCancellationFeedback).values");
    expect(notificationsRouter).toContain("trialCancellationInsights: protectedProcedure.query");
    expect(notificationsRouter).toContain("requireAdmin(ctx.user.role, ctx.user.roles ?? [])");
    expect(notificationsRouter).toContain("groupBy(premiumTrialCancellationFeedback.reason)");
    expect(notificationsPage).toContain("Premium Trial Cancellation Insights");
    expect(notificationsPage).toContain("<BarChart data={trialReasonData} layout=\"vertical\"");
  });
});
