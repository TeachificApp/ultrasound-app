import {
  DEFAULT_PLATFORM_ADMIN_EMAIL,
  resolvePlatformAdminEmail,
} from "./platformAdminEmail";

/** Accounts that must always have users.role=admin and platform_admin. */
export const PLATFORM_ADMIN_ACCOUNT_EMAILS = [DEFAULT_PLATFORM_ADMIN_EMAIL] as const;

export function normalizePlatformAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlatformAdminAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (PLATFORM_ADMIN_ACCOUNT_EMAILS as readonly string[]).includes(
    normalizePlatformAdminEmail(email),
  );
}

export function platformAdminAccountEmailSqlList(): string {
  return PLATFORM_ADMIN_ACCOUNT_EMAILS.map((email) => `'${email.replace(/'/g, "''")}'`).join(", ");
}

export { resolvePlatformAdminEmail, DEFAULT_PLATFORM_ADMIN_EMAIL };
