/**
 * One-time / idempotent backfill: assign stable openId to users missing it.
 *
 * Required for SSO bridge + magic link when legacy rows have openId = NULL.
 * Matches server/lib/ensureUserOpenId.ts: email:{lowercase-email} or user:{id}.
 */
import { eq, isNull, or, sql } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { emailOpenId } from "./ensureUserOpenId";

export type BackfillUserOpenIdsResult = {
  updated: number;
  skipped: number;
  errors: number;
};

export async function backfillUserOpenIds(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>,
): Promise<BackfillUserOpenIdsResult> {
  const rows = await db
    .select({ id: users.id, email: users.email, openId: users.openId })
    .from(users)
    .where(
      or(
        isNull(users.openId),
        sql`${users.openId} = ''`,
      ),
    );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of rows) {
    const targetOpenId = user.email?.trim()
      ? emailOpenId(user.email)
      : `user:${user.id}`;

    try {
      const [conflict] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, targetOpenId))
        .limit(1);

      if (conflict && conflict.id !== user.id) {
        console.warn(
          `[backfillUserOpenIds] Skipping user ${user.id}: openId ${targetOpenId} already used by user ${conflict.id}`,
        );
        skipped++;
        continue;
      }

      await db.update(users).set({ openId: targetOpenId }).where(eq(users.id, user.id));
      updated++;
    } catch (err) {
      console.error(`[backfillUserOpenIds] Failed for user ${user.id}:`, err);
      errors++;
    }
  }

  if (updated > 0) {
    console.log(
      `[backfillUserOpenIds] Updated ${updated} user(s) (skipped=${skipped}, errors=${errors})`,
    );
  }

  return { updated, skipped, errors };
}
