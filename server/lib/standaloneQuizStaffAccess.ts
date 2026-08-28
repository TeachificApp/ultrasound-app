const STANDALONE_QUIZ_STAFF_ROLES = new Set(["platform_admin", "platform_owner"]);

export function isLegacyOwner(role: string) {
  return role === "admin";
}

/** Legacy owner or platform staff who manage Quiz Creator content. */
export function isStandaloneQuizStaff(legacyRole: string, appRoles: string[] = []) {
  return isLegacyOwner(legacyRole) || appRoles.some((role) => STANDALONE_QUIZ_STAFF_ROLES.has(role));
}

/**
 * Staff preview bypasses published status and embedded assignment checks.
 * Legacy owners always preview; platform staff must explicitly request preview.
 */
export function resolveStandaloneQuizAdminPreview(
  legacyRole: string,
  isStaff: boolean,
  requestedPreview: boolean,
) {
  if (!isStaff) return false;
  return requestedPreview || isLegacyOwner(legacyRole);
}
