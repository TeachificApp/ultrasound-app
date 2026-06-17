/**
 * teachAccess.ts — permission helpers for the TEACH workspace.
 * Used by LMS Instructors and EducatorAssist™ educators.
 */

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  educatorOrgMembers,
  lmsInstructors,
  teachMaterialPermissions,
  teachMaterials,
  userRoles,
  type TeachMaterial,
} from "../../drizzle/schema";

export type TeachAction = "view" | "present" | "edit" | "manage" | "copy" | "download";

export type TeachUserContext = {
  userId: number;
  appRoles: string[];
  isPlatformAdmin: boolean;
  isEducationManager: boolean;
  lmsInstructor: { id: number; name: string } | null;
  educatorOrgs: Array<{ orgId: number; orgName: string; orgRole: string }>;
  canAccessTeach: boolean;
  educatorAssistPreview: boolean;
};

export function teachFolderSlug(userId: number): string {
  return `Teach/user-${userId}`;
}

export async function getUserAppRoles(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

export async function getTeachUserContext(userId: number): Promise<TeachUserContext> {
  const db = await getDb();
  const appRoles = await getUserAppRoles(userId);
  const isPlatformAdmin = appRoles.includes("platform_admin") || appRoles.includes("platform_owner");
  const isEducationManager = appRoles.includes("education_manager");

  let lmsInstructor: { id: number; name: string } | null = null;
  let educatorOrgs: TeachUserContext["educatorOrgs"] = [];

  if (db) {
    const [ins] = await db
      .select({ id: lmsInstructors.id, name: lmsInstructors.name })
      .from(lmsInstructors)
      .where(and(eq(lmsInstructors.userId, userId), eq(lmsInstructors.isActive, true)))
      .limit(1);
    if (ins) lmsInstructor = ins;

    const orgRows = await db
      .select({
        orgId: educatorOrgMembers.orgId,
        orgRole: educatorOrgMembers.orgRole,
      })
      .from(educatorOrgMembers)
      .where(and(eq(educatorOrgMembers.userId, userId), eq(educatorOrgMembers.status, "active")));
    educatorOrgs = orgRows.map((r) => ({
      orgId: r.orgId,
      orgName: `Org #${r.orgId}`,
      orgRole: r.orgRole,
    }));
  }

  const hasInstructorRole = appRoles.includes("instructor");
  const hasEducatorAdmin = educatorOrgs.some((o) => o.orgRole === "education_admin");
  const canAccessTeach =
    isPlatformAdmin ||
    isEducationManager ||
    hasInstructorRole ||
    !!lmsInstructor ||
    hasEducatorAdmin;

  return {
    userId,
    appRoles,
    isPlatformAdmin,
    isEducationManager,
    lmsInstructor,
    educatorOrgs,
    canAccessTeach,
    educatorAssistPreview: hasEducatorAdmin || isEducationManager,
  };
}

export async function canPerformTeachAction(
  userId: number,
  material: TeachMaterial,
  action: TeachAction,
  appRoles?: string[],
): Promise<boolean> {
  const roles = appRoles ?? (await getUserAppRoles(userId));
  if (roles.includes("platform_admin") || roles.includes("platform_owner") || roles.includes("education_manager")) {
    return true;
  }
  if (material.ownerUserId === userId) return true;

  const db = await getDb();
  if (!db) return false;

  const [perm] = await db
    .select()
    .from(teachMaterialPermissions)
    .where(
      and(
        eq(teachMaterialPermissions.materialId, material.id),
        eq(teachMaterialPermissions.granteeUserId, userId),
      ),
    )
    .limit(1);

  if (!perm) return false;

  switch (action) {
    case "view":
      return perm.canView;
    case "present":
      return perm.canPresent || perm.canView;
    case "edit":
      return perm.canEdit || perm.canManage;
    case "manage":
      return perm.canManage;
    case "copy":
      return perm.canCopy || perm.canManage;
    case "download":
      return perm.canDownload || perm.canManage;
    default:
      return false;
  }
}

import { parseTeachSlides, type TeachSlide } from "../../shared/teachPresentation";

export function parseSlidesData(raw: string | null | undefined): TeachSlide[] {
  return parseTeachSlides(raw);
}

export async function listAccessibleMaterials(userId: number, opts?: { ownerOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const ctx = await getTeachUserContext(userId);

  if ((ctx.isPlatformAdmin || ctx.isEducationManager) && !opts?.ownerOnly) {
    const { desc } = await import("drizzle-orm");
    return db.select().from(teachMaterials).where(isNull(teachMaterials.trashedAt)).orderBy(desc(teachMaterials.updatedAt));
  }

  const owned = await db.select().from(teachMaterials).where(and(eq(teachMaterials.ownerUserId, userId), isNull(teachMaterials.trashedAt)));

  if (opts?.ownerOnly) return owned;

  const sharedIds = await db
    .select({ materialId: teachMaterialPermissions.materialId })
    .from(teachMaterialPermissions)
    .where(and(eq(teachMaterialPermissions.granteeUserId, userId), eq(teachMaterialPermissions.canView, true)));

  const { inArray } = await import("drizzle-orm");
  const ids = sharedIds.map((s) => s.materialId);
  const sharedMaterials =
    ids.length > 0
      ? await db.select().from(teachMaterials).where(inArray(teachMaterials.id, ids))
      : [];

  const byId = new Map<number, TeachMaterial>();
  for (const m of [...owned, ...sharedMaterials]) byId.set(m.id, m);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}
