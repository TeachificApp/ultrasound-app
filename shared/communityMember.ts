/** True when a string looks like an email address (must not be shown in public member UI). */
export function isEmailLike(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Strip Thinkific account-merge prefixes like "[Merged into #5940650] "
 * that should never appear in the public UI.
 */
export function stripMergePrefix(value: string): string {
  return value.replace(/^\[Merged into #\d+\]\s*/i, "").trim();
}

/**
 * Staff / system accounts excluded from the public XP leaderboard only.
 * They remain visible in member search, profiles, and the members sidebar.
 */
export const COMMUNITY_LEADERBOARD_EXCLUDED_EMAILS = [
  "larawilliams0501@gmail.com",
  "admin@allaboutultrasound.com",
  "support@allaboutultrasound.com",
] as const;

export function isLeaderboardExcludedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (COMMUNITY_LEADERBOARD_EXCLUDED_EMAILS as readonly string[]).includes(normalized);
}

/**
 * Extract a readable username from an email address.
 * e.g. "john.doe@example.com" → "john.doe", "j_smith123@mail.org" → "j_smith123"
 */
export function usernameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.trim() || "Member";
}

/** Safe display label for members in public community surfaces. Never returns an email. */
export function publicMemberDisplayName(member: {
  displayName?: string | null;
  name?: string | null;
}): string {
  const display = member.displayName?.trim();
  if (display && !isEmailLike(display)) return stripMergePrefix(display);
  const name = member.name?.trim();
  if (name && !isEmailLike(name)) return stripMergePrefix(name);
  // Fall back to username portion of email if available
  if (display && isEmailLike(display)) return usernameFromEmail(display);
  if (name && isEmailLike(name)) return usernameFromEmail(name);
  return "Member";
}
