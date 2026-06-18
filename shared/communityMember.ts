/** True when a string looks like an email address (must not be shown in public member UI). */
export function isEmailLike(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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

/** Safe display label for members in public community surfaces. Never returns an email. */
export function publicMemberDisplayName(member: {
  displayName?: string | null;
  name?: string | null;
}): string {
  const display = member.displayName?.trim();
  if (display && !isEmailLike(display)) return display;
  const name = member.name?.trim();
  if (name && !isEmailLike(name)) return name;
  return "Community Member";
}
