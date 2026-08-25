import { PLATFORM_OWNER_EMAILS, normalizeOwnerEmail } from "./platformOwnerAccess";
import {
  PLATFORM_ADMIN_ACCOUNT_EMAILS,
  normalizePlatformAdminEmail,
} from "./platformAdminAccess";

/** Emails that may legitimately share or alias the platform owner / admin inboxes. */
export function isProtectedAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    (PLATFORM_OWNER_EMAILS as readonly string[]).includes(normalized) ||
    (PLATFORM_ADMIN_ACCOUNT_EMAILS as readonly string[]).includes(normalized)
  );
}

export function protectedAccountEmailSqlList(): string {
  const all = [
    ...(PLATFORM_OWNER_EMAILS as readonly string[]),
    ...(PLATFORM_ADMIN_ACCOUNT_EMAILS as readonly string[]),
  ].map((email) => `'${email.replace(/'/g, "''")}'`);
  return [...new Set(all)].join(", ");
}

export { normalizeOwnerEmail, normalizePlatformAdminEmail };
