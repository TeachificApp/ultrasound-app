import { TRPCError } from "@trpc/server";
import type { AppRole } from "../../shared/appRoles";
import { MEMBER_HUB_ACCESS_ROLES } from "../../shared/appRoles";
import { getUserRoles } from "../db";

export type MemberManagementAccess = {
  isOwner: boolean;
  roles: AppRole[];
  /** May grant/revoke app roles (platform_admin, customer_support, etc.) */
  canAssignRoles: boolean;
  /** May grant platform_admin / platform_owner */
  canAssignPlatformAdmin: boolean;
};

const PLATFORM_ADMIN_ROLES = new Set<AppRole>(["platform_admin", "platform_owner"]);

export function buildMemberManagementAccess(
  roles: AppRole[],
  legacyRole: string,
): MemberManagementAccess {
  if (legacyRole === "admin") {
    return {
      isOwner: true,
      roles,
      canAssignRoles: true,
      canAssignPlatformAdmin: true,
    };
  }

  if (roles.includes("platform_owner")) {
    return {
      isOwner: false,
      roles,
      canAssignRoles: true,
      canAssignPlatformAdmin: true,
    };
  }

  if (roles.includes("platform_admin")) {
    return {
      isOwner: false,
      roles,
      canAssignRoles: true,
      canAssignPlatformAdmin: false,
    };
  }

  if (roles.includes("customer_support")) {
    return {
      isOwner: false,
      roles,
      canAssignRoles: false,
      canAssignPlatformAdmin: false,
    };
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Member management access required",
  });
}

export async function getMemberManagementAccess(ctx: {
  user: { id: number; role: string };
}): Promise<MemberManagementAccess> {
  if (ctx.user.role === "admin") {
    return buildMemberManagementAccess([], ctx.user.role);
  }

  const roles = await getUserRoles(ctx.user.id);
  return buildMemberManagementAccess(roles, ctx.user.role);
}

export async function assertMemberHubAccess(ctx: {
  user: { id: number; role: string };
}): Promise<MemberManagementAccess> {
  if (ctx.user.role === "admin") {
    return getMemberManagementAccess(ctx);
  }

  const roles = await getUserRoles(ctx.user.id);
  if (MEMBER_HUB_ACCESS_ROLES.some((role) => roles.includes(role))) {
    return getMemberManagementAccess(ctx);
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Member management access required",
  });
}

export async function assertRoleAssignmentAccess(ctx: {
  user: { id: number; role: string };
}): Promise<MemberManagementAccess> {
  const access = await getMemberManagementAccess(ctx);
  if (!access.canAssignRoles) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to assign staff roles",
    });
  }
  return access;
}

export function assertCanAssignAppRole(
  access: MemberManagementAccess,
  role: AppRole,
): void {
  if (PLATFORM_ADMIN_ROLES.has(role) && !access.canAssignPlatformAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the platform owner can assign Platform Admin roles",
    });
  }
}
