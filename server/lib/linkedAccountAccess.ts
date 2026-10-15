import { eq, inArray, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import { userEmailAliases, users } from "../../drizzle/schema";

type Db = MySql2Database<typeof schema>;

export function normalizeLinkedAccountEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

export function mergeLinkedAccountUserIds(
  requestedUserId: number,
  candidateUserIds: Array<number | null | undefined>,
): number[] {
  return [...new Set([requestedUserId, ...candidateUserIds].filter((id): id is number =>
    Number.isInteger(id) && id > 0,
  ))];
}

async function getUserIdsForEmails(db: Db, normalizedEmails: string[]): Promise<number[]> {
  if (normalizedEmails.length === 0) return [];

  const [primaryMatches, aliasMatches] = await Promise.all([
    db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.email}) IN (${sql.join(normalizedEmails.map((email) => sql`${email}`), sql`, `)})`),
    db
      .select({ userId: userEmailAliases.userId })
      .from(userEmailAliases)
      .where(sql`LOWER(${userEmailAliases.email}) IN (${sql.join(normalizedEmails.map((email) => sql`${email}`), sql`, `)})`),
  ]);

  return mergeLinkedAccountUserIds(0, [
    ...primaryMatches.map((row) => row.id),
    ...aliasMatches.map((row) => row.userId),
  ]).filter((id) => id > 0);
}

/**
 * Resolves all database rows that represent the authenticated learner.
 *
 * Historical imports and pre-registration could create more than one users row
 * for the same verified email. Entitlements remain attached to their original
 * rows for audit integrity, so access checks must read the complete account
 * family instead of silently treating a paid learner as new.
 */
export async function getLinkedAccountUserIds(db: Db, userId: number): Promise<number[]> {
  if (!Number.isInteger(userId) || userId <= 0) return [];

  const [currentUser] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!currentUser) return [userId];

  const ownAliases = await db
    .select({ email: userEmailAliases.email })
    .from(userEmailAliases)
    .where(eq(userEmailAliases.userId, userId));

  const seedEmails = [currentUser.email, ...ownAliases.map((row) => row.email)]
    .map(normalizeLinkedAccountEmail)
    .filter((email): email is string => Boolean(email));
  if (seedEmails.length === 0) return [userId];

  const directlyLinkedIds = mergeLinkedAccountUserIds(
    userId,
    await getUserIdsForEmails(db, seedEmails),
  );

  // Expand once through the matching rows' primary and alias emails. This
  // safely joins a legacy row whose email was later stored as an alias, while
  // staying constrained to mailboxes already verified for this account family.
  const [linkedUsers, linkedAliases] = await Promise.all([
    db
      .select({ email: users.email })
      .from(users)
      .where(inArray(users.id, directlyLinkedIds)),
    db
      .select({ email: userEmailAliases.email })
      .from(userEmailAliases)
      .where(inArray(userEmailAliases.userId, directlyLinkedIds)),
  ]);
  const expandedEmails = [...new Set([
    ...seedEmails,
    ...linkedUsers.map((row) => normalizeLinkedAccountEmail(row.email)),
    ...linkedAliases.map((row) => normalizeLinkedAccountEmail(row.email)),
  ].filter((email): email is string => Boolean(email)))];

  return mergeLinkedAccountUserIds(
    userId,
    await getUserIdsForEmails(db, expandedEmails),
  );
}
