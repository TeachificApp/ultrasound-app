/** Platform / site owners who must always have admin, platform_owner, and platform_admin. */
export const PLATFORM_OWNER_EMAILS = ["larawilliams0501@gmail.com"] as const;

export function normalizeOwnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlatformOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (PLATFORM_OWNER_EMAILS as readonly string[]).includes(normalizeOwnerEmail(email));
}
