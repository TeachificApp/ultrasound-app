import type { users } from "../../drizzle/schema";

type UserRow = typeof users.$inferSelect;

/** Pick the address we should deliver auth emails to for a user lookup. */
export function resolveAuthDeliveryEmail(
  user: Pick<UserRow, "email">,
  requestedEmail: string,
): string | null {
  const normalizedRequest = requestedEmail.trim().toLowerCase();
  const normalizedUserEmail = user.email?.trim().toLowerCase() ?? "";
  return normalizedUserEmail || normalizedRequest || null;
}
