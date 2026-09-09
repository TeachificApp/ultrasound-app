import { describe, expect, it } from "vitest";

describe("platform admin legacy users.role sync", () => {
  it("syncs users.role when platform_admin or platform_owner is assigned or revoked", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./db.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("PLATFORM_LEGACY_ADMIN_ROLES");
    expect(source).toContain('export async function syncLegacyAdminRole');
    expect(source).toContain("if (PLATFORM_LEGACY_ADMIN_ROLES.includes(role))");
    expect(source).toContain("await syncLegacyAdminRole(userId)");
  });

  it("backfills users.role=admin for existing platform staff on startup reconcile", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./lib/ensureUserAccessAccounting.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("ensurePlatformStaffLegacyAdminRole");
    expect(source).toContain("platformStaffMissingLegacyAdminRole");
    expect(source).toContain("SET role = 'admin'");
    expect(source).toContain("ur.role IN ('platform_admin', 'platform_owner')");
  });

  it("routes grantAppRole and revokeAppRole through assignRole/removeRole", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("await assignRole(input.userId, input.role, ctx.user.id)");
    expect(source).toContain("await removeRole(input.userId, input.role)");
  });
});
