import { describe, expect, it } from "vitest";
import {
  isProtectedAccountEmail,
  protectedAccountEmailSqlList,
} from "../shared/protectedAccountEmails";

describe("protectedAccountEmails", () => {
  it("treats platform owner and admin inboxes as protected", () => {
    expect(isProtectedAccountEmail("larawilliams0501@gmail.com")).toBe(true);
    expect(isProtectedAccountEmail("admin@allaboutultrasound.com")).toBe(true);
    expect(isProtectedAccountEmail("student@example.com")).toBe(false);
  });

  it("builds a SQL IN list for protected emails", () => {
    expect(protectedAccountEmailSqlList()).toContain("larawilliams0501@gmail.com");
    expect(protectedAccountEmailSqlList()).toContain("admin@allaboutultrasound.com");
  });
});

describe("ensureEmailAliasIntegrity", () => {
  it("audits stray owner aliases and conflicting primaries", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./lib/ensureEmailAliasIntegrity.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("auditEmailAliasIntegrity");
    expect(source).toContain("stray_on_platform_owner");
    expect(source).toContain("conflicts_with_primary");
    expect(source).toContain("ensureEmailAliasIntegrity");
    expect(source).toContain("restoreMergedSourceUser");
  });

  it("is wired into startup and debug endpoints", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./_core/index.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("ensureEmailAliasIntegrity");
    expect(source).toContain("/api/debug/email-alias-audit");
    expect(source).toContain("/api/debug/email-alias-reconcile");
  });

  it("blocks learner merges onto the platform owner account", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("Cannot merge a learner account into the platform owner account");
    expect(source).toContain("Cannot add learner emails as aliases on the platform owner account");
  });
});
