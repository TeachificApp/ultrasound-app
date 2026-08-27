/** App-level RBAC roles stored in userRoles.role */
export const APP_ROLES = [
  "user",
  "premium_user",
  "diy_admin",
  "diy_user",
  "platform_admin",
  "accreditation_manager",
  "education_manager",
  "education_admin",
  "education_student",
  "platform_owner",
  "platform_moderator",
  "customer_support",
  "instructor",
  "team_admin",
  "affiliate",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** Staff roles assignable from Members Hub by platform admins */
export const MEMBER_HUB_STAFF_ROLES = [
  "platform_admin",
  "customer_support",
] as const satisfies readonly AppRole[];

export type MemberHubStaffRole = (typeof MEMBER_HUB_STAFF_ROLES)[number];

export const MEMBER_HUB_STAFF_ROLE_LABELS: Record<MemberHubStaffRole, string> = {
  platform_admin: "Platform Admin",
  customer_support: "Customer Support",
};

/** Roles that grant access to the Members Hub admin UI */
export const MEMBER_HUB_ACCESS_ROLES: AppRole[] = [
  "platform_admin",
  "platform_owner",
  "customer_support",
];
