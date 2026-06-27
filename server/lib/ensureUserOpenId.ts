/**
 * Ensure every user has a stable openId for JWT sessions.
 * Email/password users without openId cannot authenticate after magic link / SSO
 * if the session JWT uses String(user.id) while the DB row still has openId = null.
 */
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";

export function emailOpenId(email: string): string {
  return `email:${email.toLowerCase().trim()}`;
}

export async function ensureUserOpenId(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>,
  user: { id: number; openId: string | null; email: string | null },
): Promise<string> {
  if (user.openId) return user.openId;
  const openId = user.email ? emailOpenId(user.email) : `user:${user.id}`;
  await db.update(users).set({ openId }).where(eq(users.id, user.id));
  return openId;
}
