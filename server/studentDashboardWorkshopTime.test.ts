import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveDashboardSubscriptionCancelledAt } from "../client/src/pages/StudentDashboardPage";

const source = readFileSync(new URL("../client/src/pages/StudentDashboardPage.tsx", import.meta.url), "utf8");

describe("learner workshop schedule timezone presentation", () => {
  it("renders enrolled workshop instance dates through the shared Eastern formatter", () => {
    expect(source).toContain('from "@shared/platformTime"');
    expect(source).toContain('formatInTimeZone(w.instanceStartDate, { year: "numeric", month: "short", day: "numeric" }, PLATFORM_TIMEZONE)');
    expect(source).toContain('resolveDashboardSubscriptionCancelledAt((c as any).stripeSubscriptionId, (c as any).accessExpiresAt)');
    expect(source).toContain('resolveDashboardSubscriptionCancelledAt((q as any).stripeSubscriptionId, (q as any).accessExpiresAt)');
  });

  it("uses the dashboard subscription decision boundary to distinguish active from expired access", () => {
    const now = Date.now();
    expect(resolveDashboardSubscriptionCancelledAt("sub_active", new Date(now + 60_000))).toBeNull();
    expect(resolveDashboardSubscriptionCancelledAt("sub_expired", new Date(now - 60_000))?.getTime()).toBe(now - 60_000);
    expect(resolveDashboardSubscriptionCancelledAt(null, new Date(now - 60_000))).toBeNull();
  });
});
