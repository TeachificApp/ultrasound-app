import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const overviewSource = readFileSync(resolve(root, "server/routers/adminUserRouter.ts"), "utf8");
const enrollmentSource = readFileSync(resolve(root, "server/routers/lmsEnrollmentAdminRouter.ts"), "utf8");
const hubSource = readFileSync(resolve(root, "client/src/pages/admin/MembersHub.tsx"), "utf8");

describe("Members Hub analytics and direct access workflow", () => {
  it("calculates activity and verified growth from activated accounts rather than migrated records", () => {
    expect(overviewSource).toContain("WHERE isPending = 0 AND emailVerified = 1 AND lastSignedIn >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    expect(overviewSource).toContain("WHERE isPending = 0 AND emailVerified = 1 AND createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)");
    expect(overviewSource).toContain("migratedRecords");
  });

  it("includes paid LMS orders and paid checkout purchases in recorded revenue", () => {
    expect(overviewSource).toContain("SUM(amount) FROM lms_orders WHERE status = 'paid'");
    expect(overviewSource).toContain("SUM(amount_paid) FROM funnel_purchases WHERE status = 'paid'");
  });

  it("creates or reuses an email identity before allowing course and product grants", () => {
    expect(enrollmentSource).toContain("createMember: protectedProcedure");
    expect(enrollmentSource).toContain("grantMembershipAccess: protectedProcedure");
    expect(enrollmentSource).toContain("membershipSubscriptions");
    expect(enrollmentSource).toContain("openId: `email:${email}`");
    expect(hubSource).toContain("New Member & Access");
    expect(hubSource).toContain('setActiveNav("all-members")');
    expect(hubSource).toContain("setNewMemberRequest(Date.now())");
    expect(hubSource).toContain("createAndEnroll.mutateAsync");
    expect(hubSource).toContain("grantAccess.mutateAsync");
    expect(hubSource).toContain("grantMembership.mutateAsync");
  });
});
