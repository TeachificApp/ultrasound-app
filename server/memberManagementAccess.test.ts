import { describe, it, expect } from "vitest";
import {
  assertCanAssignAppRole,
  buildMemberManagementAccess,
} from "./lib/memberManagementAccess";

describe("memberManagementAccess", () => {
  it("grants full role assignment to legacy owner", () => {
    const access = buildMemberManagementAccess([], "admin");
    expect(access.canAssignRoles).toBe(true);
    expect(access.canAssignPlatformAdmin).toBe(true);
  });

  it("allows platform_admin to assign customer_support but not platform_admin", () => {
    const access = buildMemberManagementAccess(["platform_admin"], "user");
    expect(access.canAssignRoles).toBe(true);
    expect(access.canAssignPlatformAdmin).toBe(false);
    expect(() => assertCanAssignAppRole(access, "customer_support")).not.toThrow();
    expect(() => assertCanAssignAppRole(access, "platform_admin")).toThrow(/owner/i);
  });

  it("allows customer_support hub access without role assignment", () => {
    const access = buildMemberManagementAccess(["customer_support"], "user");
    expect(access.canAssignRoles).toBe(false);
    expect(access.canAssignPlatformAdmin).toBe(false);
  });
});
