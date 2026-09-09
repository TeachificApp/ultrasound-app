/**
 * Platform media access — upload/list/manage Media Repository and campaign assets.
 * Matches mediaRepoRouter.assertPlatformAdmin role checks.
 */
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { getDb, getUserRoles } from "../db";
import { users } from "../../drizzle/schema";
import { hasPlatformManagerAccess } from "../../shared/platformManagerAccess";

export type PlatformMediaUser = { id: number; role: string };

export async function userHasPlatformMediaAccess(
  userId: number,
  legacyRole: string,
): Promise<boolean> {
  if (legacyRole === "admin") return true;

  const appRoles = await getUserRoles(userId);
  if (hasPlatformManagerAccess(legacyRole, appRoles)) return true;

  const ownerId = process.env.OWNER_OPEN_ID;
  if (!ownerId) return false;

  const db = await getDb();
  if (!db) return false;
  const [user] = await db
    .select({ openId: users.openId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.openId === ownerId;
}

/** REST routes: authenticate cookie session and verify platform media access. */
export async function authenticatePlatformMediaAdmin(
  req: Request,
): Promise<PlatformMediaUser | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) return null;
    if (await userHasPlatformMediaAccess(user.id, user.role)) {
      return { id: user.id, role: user.role };
    }
  } catch {
    // not authenticated
  }
  return null;
}
