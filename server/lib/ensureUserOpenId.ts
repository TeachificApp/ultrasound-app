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

/** Stub openIds from admin pre-registration or legacy imports — not valid session keys long-term. */
export function isStaleSyntheticOpenId(openId: string | null | undefined): boolean {
  if (!openId?.trim()) return false;
  return openId.startsWith("pending_");
}

export async function ensureUserOpenId(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>,
  user: { id: number; openId: string | null; email: string | null },
): Promise<string> {
  if (user.openId && !isStaleSyntheticOpenId(user.openId)) {
    return user.openId;
  }

  const openId = user.email ? emailOpenId(user.email) : `user:${user.id}`;
  await db.update(users).set({ openId }).where(eq(users.id, user.id));
  return openId;
}
