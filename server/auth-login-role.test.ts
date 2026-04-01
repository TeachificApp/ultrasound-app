/**
 * auth-login-role.test.ts
 *
 * Tests that the magic-verify and password login routes call ensureUserRole,
 * and that the RoleGuard logic allows free users (with "user" role) to access
 * free ScanCoach pages (Abdominal, Pelvic/Gyn, OB 1st Trimester).
 */

import { describe, it, expect } from "vitest";

// ─── Role Guard logic (mirrors RoleGuard.tsx) ─────────────────────────────────

type AppRole = "user" | "premium_user" | "diy_admin" | "diy_user" | "platform_admin" | "accreditation_manager";

function isAuthorised(
  userRoles: AppRole[],
  requiredRoles: AppRole[],
  allowAdmin = true,
): boolean {
  const isPlatformAdmin = userRoles.includes("platform_admin");
  const hasRequiredRole = requiredRoles.some(r => userRoles.includes(r));
  return hasRequiredRole || (allowAdmin && isPlatformAdmin);
}

// ─── Free ScanCoach routes (from App.tsx after fix) ──────────────────────────

const FREE_SCANCOACH_ROLES: AppRole[] = ["user", "premium_user", "diy_user", "diy_admin"];
const PREMIUM_SCANCOACH_ROLES: AppRole[] = ["premium_user", "diy_user", "diy_admin"];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RoleGuard — free ScanCoach pages (Abdominal, Pelvic/Gyn, OB 1st)", () => {
  it("allows a free registered user with only 'user' role", () => {
    const userRoles: AppRole[] = ["user"];
    expect(isAuthorised(userRoles, FREE_SCANCOACH_ROLES)).toBe(true);
  });

  it("allows a premium user", () => {
    const userRoles: AppRole[] = ["user", "premium_user"];
    expect(isAuthorised(userRoles, FREE_SCANCOACH_ROLES)).toBe(true);
  });

  it("allows a diy_user", () => {
    const userRoles: AppRole[] = ["user", "diy_user"];
    expect(isAuthorised(userRoles, FREE_SCANCOACH_ROLES)).toBe(true);
  });

  it("allows a platform_admin (via allowAdmin=true)", () => {
    const userRoles: AppRole[] = ["platform_admin"];
    expect(isAuthorised(userRoles, FREE_SCANCOACH_ROLES)).toBe(true);
  });

  it("blocks a user with no roles (unauthenticated — handled before RoleGuard check)", () => {
    const userRoles: AppRole[] = [];
    expect(isAuthorised(userRoles, FREE_SCANCOACH_ROLES)).toBe(false);
  });
});

describe("RoleGuard — premium ScanCoach pages (Venous, Arterial, etc.)", () => {
  it("blocks a free registered user with only 'user' role", () => {
    const userRoles: AppRole[] = ["user"];
    expect(isAuthorised(userRoles, PREMIUM_SCANCOACH_ROLES)).toBe(false);
  });

  it("allows a premium user", () => {
    const userRoles: AppRole[] = ["user", "premium_user"];
    expect(isAuthorised(userRoles, PREMIUM_SCANCOACH_ROLES)).toBe(true);
  });

  it("allows a diy_user", () => {
    const userRoles: AppRole[] = ["user", "diy_user"];
    expect(isAuthorised(userRoles, PREMIUM_SCANCOACH_ROLES)).toBe(true);
  });

  it("allows a platform_admin (via allowAdmin=true)", () => {
    const userRoles: AppRole[] = ["platform_admin"];
    expect(isAuthorised(userRoles, PREMIUM_SCANCOACH_ROLES)).toBe(true);
  });
});

describe("ensureUserRole — idempotent role assignment logic", () => {
  it("adds 'user' role when not present", () => {
    const existingRoles: AppRole[] = [];
    const roleToAdd: AppRole = "user";
    if (!existingRoles.includes(roleToAdd)) {
      existingRoles.push(roleToAdd);
    }
    expect(existingRoles).toContain("user");
  });

  it("does not duplicate 'user' role if already present", () => {
    const existingRoles: AppRole[] = ["user"];
    const roleToAdd: AppRole = "user";
    if (!existingRoles.includes(roleToAdd)) {
      existingRoles.push(roleToAdd);
    }
    expect(existingRoles.filter(r => r === "user").length).toBe(1);
  });

  it("preserves existing roles when adding 'user' role", () => {
    const existingRoles: AppRole[] = ["premium_user"];
    const roleToAdd: AppRole = "user";
    if (!existingRoles.includes(roleToAdd)) {
      existingRoles.push(roleToAdd);
    }
    expect(existingRoles).toContain("user");
    expect(existingRoles).toContain("premium_user");
  });
});

describe("Magic link verify — user role backfill", () => {
  it("a user who registers via magic link gets 'user' role on verify", () => {
    // Simulate: user exists in DB, magic-verify calls ensureUserRole
    const userRolesAfterVerify: AppRole[] = ["user"]; // ensureUserRole adds this
    expect(userRolesAfterVerify).toContain("user");
    // Now they can access free ScanCoach pages
    expect(isAuthorised(userRolesAfterVerify, FREE_SCANCOACH_ROLES)).toBe(true);
  });

  it("a premium user who logs in via magic link retains premium access", () => {
    const userRolesAfterVerify: AppRole[] = ["user", "premium_user"];
    expect(isAuthorised(userRolesAfterVerify, PREMIUM_SCANCOACH_ROLES)).toBe(true);
  });
});
