import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type UserAccessAudit = {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  usersMissingOpenId: number;
  usersMissingBaseRole: number;
  adminUsersMissingPlatformAdmin: number;
  activeEnrollments: number;
  enrollmentsMissingUser: number;
  activeMembershipSubscriptions: number;
  activeBrandMemberships: number;
  userRolesRows: number;
  usersWithActiveEnrollmentMissingBaseRole: number;
};

export type UserAccessReconcileResult = {
  baseRolesBackfilled: number;
  platformAdminRolesBackfilled: number;
  openIdsBackfilled: number;
  openIdBackfillSkipped: number;
  openIdBackfillErrors: number;
};

async function scalarCount(db: Db, query: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute(query);
  const row = extractExecuteRows<{ c?: number }>(result)[0];
  return Number(row?.c ?? 0);
}

/** Read-only snapshot of user identity + entitlement coverage on Railway. */
export async function auditUserAccess(db: Db | null | undefined): Promise<UserAccessAudit | null> {
  if (!db) return null;

  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    usersMissingOpenId,
    usersMissingBaseRole,
    adminUsersMissingPlatformAdmin,
    activeEnrollments,
    enrollmentsMissingUser,
    activeMembershipSubscriptions,
    activeBrandMemberships,
    userRolesRows,
    usersWithActiveEnrollmentMissingBaseRole,
  ] = await Promise.all([
    scalarCount(db, sql`SELECT COUNT(*) AS c FROM users`),
    scalarCount(db, sql`SELECT COUNT(*) AS c FROM users WHERE isPending = 0 AND name NOT LIKE '[Merged into #%'`),
    scalarCount(db, sql`SELECT COUNT(*) AS c FROM users WHERE isPending = 1`),
    scalarCount(
      db,
      sql`SELECT COUNT(*) AS c FROM users
          WHERE isPending = 0
            AND (openId IS NULL OR openId = '')`,
    ),
    scalarCount(
      db,
      sql`SELECT COUNT(*) AS c FROM users u
          WHERE u.isPending = 0
            AND u.name NOT LIKE '[Merged into #%'
            AND NOT EXISTS (
              SELECT 1 FROM userRoles ur
              WHERE ur.userId = u.id AND ur.role = 'user'
            )`,
    ),
    scalarCount(
      db,
      sql`SELECT COUNT(*) AS c FROM users u
          WHERE u.role = 'admin'
            AND NOT EXISTS (
              SELECT 1 FROM userRoles ur
              WHERE ur.userId = u.id AND ur.role IN ('platform_admin', 'platform_owner')
            )`,
    ),
    scalarCount(
      db,
      sql`SELECT COUNT(*) AS c FROM lms_enrollments
          WHERE (access_expires_at IS NULL OR access_expires_at > NOW())`,
    ),
    scalarCount(
      db,
      sql`SELECT COUNT(*) AS c FROM lms_enrollments e
          LEFT JOIN users u ON u.id = e.user_id
          WHERE u.id IS NULL`,
    ),
    scalarCount(
      db,
      sql`SELECT COUNT(*) AS c FROM membership_subscriptions
          WHERE status = 'active'`,
    ),
    scalarCount(
      db,
      sql`SELECT COUNT(*) AS c FROM brandMemberships
          WHERE status = 'active'`,
    ),
    scalarCount(db, sql`SELECT COUNT(*) AS c FROM userRoles`),
    scalarCount(
      db,
      sql`SELECT COUNT(DISTINCT e.user_id) AS c
          FROM lms_enrollments e
          INNER JOIN users u ON u.id = e.user_id
          WHERE u.isPending = 0
            AND (e.access_expires_at IS NULL OR e.access_expires_at > NOW())
            AND NOT EXISTS (
              SELECT 1 FROM userRoles ur
              WHERE ur.userId = e.user_id AND ur.role = 'user'
            )`,
    ),
  ]);

  return {
    totalUsers,
    activeUsers,
    pendingUsers,
    usersMissingOpenId,
    usersMissingBaseRole,
    adminUsersMissingPlatformAdmin,
    activeEnrollments,
    enrollmentsMissingUser,
    activeMembershipSubscriptions,
    activeBrandMemberships,
    userRolesRows,
    usersWithActiveEnrollmentMissingBaseRole,
  };
}

/** Idempotent fixes for identity gaps that block login or base platform access. */
export async function ensureUserAccessAccounting(
  db: Db | null | undefined,
): Promise<UserAccessReconcileResult | null> {
  if (!db) return null;

  const before = await auditUserAccess(db);

  let baseRolesBackfilled = 0;
  if (before && before.usersMissingBaseRole > 0) {
    await db.execute(sql`
      INSERT INTO userRoles (userId, role, assignedByUserId, createdAt)
      SELECT u.id, 'user', u.id, NOW()
      FROM users u
      WHERE u.isPending = 0
        AND u.name NOT LIKE '[Merged into #%'
        AND NOT EXISTS (
          SELECT 1 FROM userRoles ur
          WHERE ur.userId = u.id AND ur.role = 'user'
        )
    `);
    const afterBase = await auditUserAccess(db);
    baseRolesBackfilled = Math.max(
      0,
      (before.usersMissingBaseRole ?? 0) - (afterBase?.usersMissingBaseRole ?? 0),
    );
  }

  let platformAdminRolesBackfilled = 0;
  if (before && before.adminUsersMissingPlatformAdmin > 0) {
    await db.execute(sql`
      INSERT INTO userRoles (userId, role, assignedByUserId, createdAt)
      SELECT u.id, 'platform_admin', u.id, NOW()
      FROM users u
      WHERE u.role = 'admin'
        AND NOT EXISTS (
          SELECT 1 FROM userRoles ur
          WHERE ur.userId = u.id AND ur.role IN ('platform_admin', 'platform_owner')
        )
    `);
    const afterAdmin = await auditUserAccess(db);
    platformAdminRolesBackfilled = Math.max(
      0,
      (before.adminUsersMissingPlatformAdmin ?? 0) - (afterAdmin?.adminUsersMissingPlatformAdmin ?? 0),
    );
  }

  const { backfillUserOpenIds } = await import("./backfillUserOpenIds");
  const openIdResult = await backfillUserOpenIds(db);

  if (baseRolesBackfilled > 0 || platformAdminRolesBackfilled > 0 || openIdResult.updated > 0) {
    console.log(
      `[ensureUserAccessAccounting] baseRoles=${baseRolesBackfilled}, platformAdmin=${platformAdminRolesBackfilled}, openIds=${openIdResult.updated}`,
    );
  }

  return {
    baseRolesBackfilled,
    platformAdminRolesBackfilled,
    openIdsBackfilled: openIdResult.updated,
    openIdBackfillSkipped: openIdResult.skipped,
    openIdBackfillErrors: openIdResult.errors,
  };
}
