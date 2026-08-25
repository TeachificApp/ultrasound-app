import type { users } from "../../drizzle/schema";

type UserRow = typeof users.$inferSelect;

/**
 * Pick the address we should deliver auth emails to for a user lookup.
 * Always prefer the email the user typed — including verified aliases — so
 * login links are not misrouted to the account primary (e.g. platform owner).
 */
export function resolveAuthDeliveryEmail(
  user: Pick<UserRow, "email">,
  requestedEmail: string,
): string | null {
  const normalizedRequest = requestedEmail.trim().toLowerCase();
  if (normalizedRequest) return normalizedRequest;
  const normalizedUserEmail = user.email?.trim().toLowerCase() ?? "";
  return normalizedUserEmail || null;
}
