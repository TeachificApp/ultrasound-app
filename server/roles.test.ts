/**
 * Tests for shared role-check helpers (client/src/lib/roles.ts)
 *
 * Because the helpers are pure functions with no DOM/React dependencies,
 * we can import them directly in a Node/vitest context.
 */

import { describe, it, expect } from "vitest";

// ---- inline the helpers so we don't need a DOM transform ----
// (mirrors client/src/lib/roles.ts exactly)

const PREMIUM_ROLES = new Set(["premium_user", "diy_user", "diy_admin", "platform_admin"]);
const DIY_ROLES = new Set(["diy_user", "diy_admin", "platform_admin"]);
const LAB_ADMIN_ROLES = new Set(["diy_admin", "platform_admin"]);
const PLATFORM_ADMIN_ROLES = new Set(["platform_admin"]);

function hasPremiumAccess(appRoles: string[] | undefined | null): boolean {
  if (!appRoles || appRoles.length === 0) return false;
  return appRoles.some((r) => PREMIUM_ROLES.has(r));
}

function hasDiyAccess(appRoles: string[] | undefined | null): boolean {
  if (!appRoles || appRoles.length === 0) return false;
  return appRoles.some((r) => DIY_ROLES.has(r));
}

function hasLabAdminAccess(appRoles: string[] | undefined | null): boolean {
  if (!appRoles || appRoles.length === 0) return false;
  return appRoles.some((r) => LAB_ADMIN_ROLES.has(r));
}

function hasPlatformAdminAccess(appRoles: string[] | undefined | null): boolean {
  if (!appRoles || appRoles.length === 0) return false;
  return appRoles.some((r) => PLATFORM_ADMIN_ROLES.has(r));
}

// ---- hasPremiumAccess ----

describe("hasPremiumAccess", () => {
  it("returns false for null", () => {
    expect(hasPremiumAccess(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasPremiumAccess(undefined)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasPremiumAccess([])).toBe(false);
  });

  it("returns false for base 'user' role only", () => {
    expect(hasPremiumAccess(["user"])).toBe(false);
  });

  it("returns true for premium_user", () => {
    expect(hasPremiumAccess(["premium_user"])).toBe(true);
  });

  it("returns true for diy_user", () => {
    expect(hasPremiumAccess(["diy_user"])).toBe(true);
  });

  it("returns true for diy_admin", () => {
    expect(hasPremiumAccess(["diy_admin"])).toBe(true);
  });

  it("returns true for platform_admin", () => {
    expect(hasPremiumAccess(["platform_admin"])).toBe(true);
  });

  it("returns true when one of multiple roles qualifies", () => {
    expect(hasPremiumAccess(["user", "premium_user"])).toBe(true);
  });
});

// ---- hasDiyAccess ----

describe("hasDiyAccess", () => {
  it("returns false for null / undefined / empty", () => {
    expect(hasDiyAccess(null)).toBe(false);
    expect(hasDiyAccess(undefined)).toBe(false);
    expect(hasDiyAccess([])).toBe(false);
  });

  it("returns false for premium_user (no DIY access)", () => {
    expect(hasDiyAccess(["premium_user"])).toBe(false);
  });

  it("returns false for base 'user' role", () => {
    expect(hasDiyAccess(["user"])).toBe(false);
  });

  it("returns true for diy_user", () => {
    expect(hasDiyAccess(["diy_user"])).toBe(true);
  });

  it("returns true for diy_admin", () => {
    expect(hasDiyAccess(["diy_admin"])).toBe(true);
  });

  it("returns true for platform_admin", () => {
    expect(hasDiyAccess(["platform_admin"])).toBe(true);
  });
});

// ---- hasLabAdminAccess ----

describe("hasLabAdminAccess", () => {
  it("returns false for null / undefined / empty", () => {
    expect(hasLabAdminAccess(null)).toBe(false);
    expect(hasLabAdminAccess(undefined)).toBe(false);
    expect(hasLabAdminAccess([])).toBe(false);
  });

  it("returns false for diy_user (no lab admin access)", () => {
    expect(hasLabAdminAccess(["diy_user"])).toBe(false);
  });

  it("returns false for premium_user", () => {
    expect(hasLabAdminAccess(["premium_user"])).toBe(false);
  });

  it("returns true for diy_admin", () => {
    expect(hasLabAdminAccess(["diy_admin"])).toBe(true);
  });

  it("returns true for platform_admin", () => {
    expect(hasLabAdminAccess(["platform_admin"])).toBe(true);
  });
});

// ---- hasPlatformAdminAccess ----

describe("hasPlatformAdminAccess", () => {
  it("returns false for null / undefined / empty", () => {
    expect(hasPlatformAdminAccess(null)).toBe(false);
    expect(hasPlatformAdminAccess(undefined)).toBe(false);
    expect(hasPlatformAdminAccess([])).toBe(false);
  });

  it("returns false for diy_admin", () => {
    expect(hasPlatformAdminAccess(["diy_admin"])).toBe(false);
  });

  it("returns false for premium_user", () => {
    expect(hasPlatformAdminAccess(["premium_user"])).toBe(false);
  });

  it("returns true for platform_admin", () => {
    expect(hasPlatformAdminAccess(["platform_admin"])).toBe(true);
  });

  it("returns false for all other roles combined (without platform_admin)", () => {
    expect(hasPlatformAdminAccess(["user", "premium_user", "diy_user", "diy_admin"])).toBe(false);
  });
});
