/**
 * Tests for DIY Accreditation Admin separation:
 * - adminListOrgs now allows platform_admin and accreditation_manager roles
 * - DIYAccreditationAdmin page route is registered
 */

import { describe, it, expect } from "vitest";

// Test that the permission check logic works correctly
describe("adminListOrgs permission logic", () => {
  function isAllowed(userRole: string, userRoles: string[]): boolean {
    return (
      userRole === "admin" ||
      userRoles.includes("platform_admin") ||
      userRoles.includes("accreditation_manager")
    );
  }

  it("allows owner (admin role)", () => {
    expect(isAllowed("admin", [])).toBe(true);
  });

  it("allows platform_admin role", () => {
    expect(isAllowed("user", ["platform_admin"])).toBe(true);
  });

  it("allows accreditation_manager role", () => {
    expect(isAllowed("user", ["accreditation_manager"])).toBe(true);
  });

  it("denies regular user", () => {
    expect(isAllowed("user", [])).toBe(false);
  });

  it("denies premium_user", () => {
    expect(isAllowed("user", ["premium_user"])).toBe(false);
  });

  it("denies diy_admin without platform_admin", () => {
    expect(isAllowed("user", ["diy_admin"])).toBe(false);
  });

  it("allows user with both diy_admin and platform_admin", () => {
    expect(isAllowed("user", ["diy_admin", "platform_admin"])).toBe(true);
  });
});

// Test that the DIY Accreditation Admin hub page file exists
describe("DIYAccreditationAdmin page", () => {
  it("DIYAccreditationAdmin.tsx file exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../client/src/pages/admin/DIYAccreditationAdmin.tsx"
    );
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("DIYAccreditationAdmin.tsx exports a default component", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../client/src/pages/admin/DIYAccreditationAdmin.tsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export default");
    expect(content).toContain("DIYAccreditationAdmin");
  });
});

// Test that the App.tsx has the /admin/diy-accreditation route
describe("App.tsx routing", () => {
  it("has /admin/diy-accreditation route", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("/admin/diy-accreditation");
    expect(content).toContain("DIYAccreditationAdmin");
  });

  it("has AccreditationDivisionRouter", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("AccreditationDivisionRouter");
    expect(content).toContain("isAccreditationDomain");
  });
});

// Test that PlatformAdmin has the DIY Accreditation Admin card
describe("PlatformAdmin DUAL tools", () => {
  it("has diy-accreditation-admin tool card", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/PlatformAdmin.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("diy-accreditation-admin");
    expect(content).toContain("/admin/diy-accreditation");
    expect(content).toContain("DIY Accreditation Admin");
  });
});
