/**
 * Authorization for LMS / campaign content uploads (images, rich-text assets).
 */
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { getUserAppRoles } from "./teachAccess";

const CONTENT_UPLOAD_APP_ROLES = new Set([
  "platform_admin",
  "platform_owner",
  "education_manager",
  "instructor",
]);

export type ContentUploadUser = { id: number; role: string };

export async function canUploadCourseContent(user: ContentUploadUser): Promise<boolean> {
  if (user.role === "admin") return true;

  const db = await getDb();
  if (db) {
    const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);
    if (row?.role === "admin") return true;
  }

  const appRoles = await getUserAppRoles(user.id);
  return appRoles.some((role) => CONTENT_UPLOAD_APP_ROLES.has(role));
}

/** Authenticate request and verify the caller may upload course/campaign media. */
export async function authenticateContentUploader(
  req: Request,
): Promise<ContentUploadUser | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) return null;
    const uploader = { id: user.id, role: user.role };
    return (await canUploadCourseContent(uploader)) ? uploader : null;
  } catch {
    return null;
  }
}
