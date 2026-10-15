import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mergeLinkedAccountUserIds,
  normalizeLinkedAccountEmail,
} from "./lib/linkedAccountAccess";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("linked learner account access", () => {
  it("normalizes verified mailbox identities before linking accounts", () => {
    expect(normalizeLinkedAccountEmail("  Learner@Example.com ")).toBe("learner@example.com");
    expect(normalizeLinkedAccountEmail("   ")).toBeNull();
    expect(normalizeLinkedAccountEmail(null)).toBeNull();
  });

  it("retains the signed-in identity while de-duplicating linked entitlement owners", () => {
    expect(mergeLinkedAccountUserIds(42, [11, 42, null, 11, 0, undefined, 73])).toEqual([42, 11, 73]);
  });

  it("uses the account family for course player access and dashboard content", () => {
    const enrollmentAccess = readProjectFile("server/lib/enrollmentAccess.ts");
    const dashboard = readProjectFile("server/routers/dashboardRouter.ts");

    expect(enrollmentAccess).toContain("getLinkedAccountUserIds");
    expect(enrollmentAccess).toContain("inArray(lmsEnrollments.userId, linkedUserIds)");
    expect(dashboard).toContain("const linkedUserIds = await getLinkedAccountUserIds(db, ctx.user.id);");
    expect(dashboard).toContain("inArray(lmsEnrollments.userId, linkedUserIds)");
    expect(dashboard).toContain("inArray(workshopEnrollments.userId, linkedUserIds)");
    expect(dashboard).toContain("inArray(webinarRegistrations.userId, linkedUserIds)");
  });

  it("checks every credential-bearing account for a verified mailbox at sign-in", () => {
    const directLogin = readProjectFile("server/routes/authLogin.ts");
    const emailAuth = readProjectFile("server/routers/emailAuthRouter.ts");

    expect(directLogin).toContain("getUsersByEmail");
    expect(directLogin).toContain("for (const candidate of credentialCandidates)");
    expect(emailAuth).toContain("getUsersByEmail");
    expect(emailAuth).toContain("for (const candidate of credentialCandidates)");
  });
});
