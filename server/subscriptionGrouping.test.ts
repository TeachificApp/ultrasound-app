import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("subscription display grouping", () => {
  const learnerView = readFileSync(new URL("../client/src/pages/StudentDashboardPage.tsx", import.meta.url), "utf8");
  const administratorView = readFileSync(new URL("../client/src/pages/admin/AdminUserDetailPage.tsx", import.meta.url), "utf8");

  it("puts Learn subscriptions and Learn content ahead of apps in the learner view", () => {
    expect(learnerView).toContain('className="order-1"');
    expect(learnerView).toContain('className="order-2"');
    expect(learnerView).toContain('className="order-3 space-y-6"');
    expect(learnerView).toContain("Learn Subscriptions ({courseSubscriptions.length + enrollmentSubscriptions.length})");
    expect(learnerView).toContain("Learn Content Access");
    expect(learnerView).toContain("Apps");
  });

  it("puts Learn subscriptions and Learn content ahead of apps in the administrator view", () => {
    expect(administratorView).toContain('className="order-1"');
    expect(administratorView).toContain('className="order-2"');
    expect(administratorView).toContain('className="order-3"');
    expect(administratorView).toContain("Learn Subscriptions (${nativeMemberships.length + contentEnrollments.length})");
    expect(administratorView).toContain("Learn Content Access (${contentEnrollments.length})");
    expect(administratorView).toContain("Apps (${memberships.length})");
  });
});
