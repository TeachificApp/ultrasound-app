/**
 * Resolve a DB user from a session JWT openId claim.
 * Handles legacy sessions where openId was String(user.id) while DB openId was null.
 */
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { ensureUserOpenId } from "./ensureUserOpenId";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export async function resolveUserFromSessionOpenId(
  db: Db,
  sessionOpenId: string,
): Promise<(typeof users.$inferSelect & { openId: string }) | null> {
  const [byOpenId] = await db
    .select()
    .from(users)
    .where(eq(users.openId, sessionOpenId))
    .limit(1);

  let user = byOpenId;
  if (!user && /^\d+$/.test(sessionOpenId)) {
    const [byId] = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(sessionOpenId)))
      .limit(1);
    user = byId;
  }

  if (!user) return null;

  const openId = await ensureUserOpenId(db, user);
  return { ...user, openId };
}
