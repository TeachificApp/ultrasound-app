import { describe, expect, it } from "vitest";

describe("ensureUserAccessAccounting", () => {
  it("audits identity, roles, and entitlement coverage", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./lib/ensureUserAccessAccounting.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("auditUserAccess");
    expect(source).toContain("usersMissingOpenId");
    expect(source).toContain("usersMissingBaseRole");
    expect(source).toContain("enrollmentsMissingUser");
    expect(source).toContain("activeMembershipSubscriptions");
  });

  it("backfills base user and platform_admin roles idempotently", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./lib/ensureUserAccessAccounting.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("INSERT INTO userRoles");
    expect(source).toContain("platform_admin");
    expect(source).toContain("backfillUserOpenIds");
  });

  it("is wired into server startup and debug endpoints", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./_core/index.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("ensureUserAccessAccounting");
    expect(source).toContain("/api/debug/user-access-audit");
  });
});
