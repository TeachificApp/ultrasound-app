import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { ENV } from "../_core/env";
import { PLATFORM_OWNER_EMAILS } from "../../shared/platformOwnerAccess";
import {
  platformAdminAccountEmailSqlList,
} from "../../shared/platformAdminAccess";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type UserAccessAudit = {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  usersMissingOpenId: number;
  usersMissingBaseRole: number;
  adminUsersMissingPlatformAdmin: number;
  platformOwnersMissingOwnerRole: number;
  platformOwnersMissingPlatformAdmin: number;
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
  platformOwnerRolesBackfilled: number;
  platformOwnerAdminRolesBackfilled: number;
  platformOwnerAdminFlagsSet: number;
  openIdsBackfilled: number;
  openIdBackfillSkipped: number;
  openIdBackfillErrors: number;
};

async function scalarCount(db: Db, query: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute(query);
  const row = extractExecuteRows<{ c?: number }>(result)[0];
  return Number(row?.c ?? 0);
}

function platformOwnerEmailSqlList(): string {
  return PLATFORM_OWNER_EMAILS.map((email) => `'${email.replace(/'/g, "''")}'`).join(", ");
}

function platformOwnerMatchClause(): ReturnType<typeof sql> {
  const ownerOpenId = ENV.ownerOpenId.trim();
  const emailList = platformOwnerEmailSqlList();
  if (ownerOpenId) {
    return sql.raw(
      `(LOWER(u.email) IN (${emailList}) OR u.openId = '${ownerOpenId.replace(/'/g, "''")}')`,
    );
  }
  return sql.raw(`LOWER(u.email) IN (${emailList})`);
}

function platformAdminAccountMatchClause(): ReturnType<typeof sql> {
  return sql.raw(`LOWER(u.email) IN (${platformAdminAccountEmailSqlList()})`);
}

/** Idempotent: platform admin inbox accounts always get users.role=admin and platform_admin. */
export async function ensurePlatformAdminAccountAccess(
  db: Db | null | undefined,
): Promise<{ adminFlagsSet: number; adminRolesBackfilled: number; usersEnsured: number }> {
  if (!db) return { adminFlagsSet: 0, adminRolesBackfilled: 0, usersEnsured: 0 };

  const { upsertUser, getUserByEmail } = await import("../db");
  const { PLATFORM_ADMIN_ACCOUNT_EMAILS } = await import("../../shared/platformAdminAccess");
  let usersEnsured = 0;
  for (const email of PLATFORM_ADMIN_ACCOUNT_EMAILS) {
    let user = await getUserByEmail(email);
    if (!user) {
      await upsertUser({
        openId: `email:${email}`,
        email,
        name: "Platform Admin",
        loginMethod: "email",
        lastSignedIn: new Date(),
      });
      user = await getUserByEmail(email);
      if (user) usersEnsured += 1;
    }
  }

  const adminMatch = platformAdminAccountMatchClause();
  const beforeMissingAdmin = await scalarCount(
    db,
    sql`SELECT COUNT(*) AS c FROM users u
        WHERE ${adminMatch}
          AND NOT EXISTS (
            SELECT 1 FROM userRoles ur
            WHERE ur.userId = u.id AND ur.role = 'platform_admin'
          )`,
  );

  const adminUpdate = await db.execute(sql`
    UPDATE users u
    SET role = 'admin'
    WHERE ${adminMatch}
      AND (u.role IS NULL OR u.role != 'admin')
  `);
  const adminFlagsSet = Number((adminUpdate as { affectedRows?: number }).affectedRows ?? 0);

  await db.execute(sql`
    INSERT INTO userRoles (userId, role, assignedByUserId, createdAt)
    SELECT u.id, 'platform_admin', u.id, NOW()
    FROM users u
    WHERE ${adminMatch}
      AND NOT EXISTS (
        SELECT 1 FROM userRoles ur
        WHERE ur.userId = u.id AND ur.role = 'platform_admin'
      )
  `);

  const afterMissingAdmin = await scalarCount(
    db,
    sql`SELECT COUNT(*) AS c FROM users u
        WHERE ${adminMatch}
          AND NOT EXISTS (
            SELECT 1 FROM userRoles ur
            WHERE ur.userId = u.id AND ur.role = 'platform_admin'
          )`,
  );

  return {
    adminFlagsSet,
    adminRolesBackfilled: Math.max(0, beforeMissingAdmin - afterMissingAdmin),
    usersEnsured,
  };
}

/** Idempotent: platform/site owners always get users.role=admin, platform_owner, and platform_admin. */
export async function ensurePlatformOwnerAccess(
  db: Db | null | undefined,
): Promise<{
  adminFlagsSet: number;
  ownerRolesBackfilled: number;
  adminRolesBackfilled: number;
}> {
  if (!db) return { adminFlagsSet: 0, ownerRolesBackfilled: 0, adminRolesBackfilled: 0 };

  const ownerMatch = platformOwnerMatchClause();
  const beforeMissingOwner = await scalarCount(
    db,
    sql`SELECT COUNT(*) AS c FROM users u
        WHERE ${ownerMatch}
          AND NOT EXISTS (
            SELECT 1 FROM userRoles ur
            WHERE ur.userId = u.id AND ur.role = 'platform_owner'
          )`,
  );
  const beforeMissingAdmin = await scalarCount(
    db,
    sql`SELECT COUNT(*) AS c FROM users u
        WHERE ${ownerMatch}
          AND NOT EXISTS (
            SELECT 1 FROM userRoles ur
            WHERE ur.userId = u.id AND ur.role = 'platform_admin'
          )`,
  );

  const adminUpdate = await db.execute(sql`
    UPDATE users u
    SET role = 'admin'
    WHERE ${ownerMatch}
      AND (u.role IS NULL OR u.role != 'admin')
  `);
  const adminFlagsSet = Number((adminUpdate as { affectedRows?: number }).affectedRows ?? 0);

  await db.execute(sql`
    INSERT INTO userRoles (userId, role, assignedByUserId, createdAt)
    SELECT u.id, 'platform_owner', u.id, NOW()
    FROM users u
    WHERE ${ownerMatch}
      AND NOT EXISTS (
        SELECT 1 FROM userRoles ur
        WHERE ur.userId = u.id AND ur.role = 'platform_owner'
      )
  `);

  await db.execute(sql`
    INSERT INTO userRoles (userId, role, assignedByUserId, createdAt)
    SELECT u.id, 'platform_admin', u.id, NOW()
    FROM users u
    WHERE ${ownerMatch}
      AND NOT EXISTS (
        SELECT 1 FROM userRoles ur
        WHERE ur.userId = u.id AND ur.role = 'platform_admin'
      )
  `);

  const afterMissingOwner = await scalarCount(
    db,
    sql`SELECT COUNT(*) AS c FROM users u
        WHERE ${ownerMatch}
          AND NOT EXISTS (
            SELECT 1 FROM userRoles ur
            WHERE ur.userId = u.id AND ur.role = 'platform_owner'
          )`,
  );
  const afterMissingAdmin = await scalarCount(
    db,
    sql`SELECT COUNT(*) AS c FROM users u
        WHERE ${ownerMatch}
          AND NOT EXISTS (
            SELECT 1 FROM userRoles ur
            WHERE ur.userId = u.id AND ur.role = 'platform_admin'
          )`,
  );

  return {
    adminFlagsSet,
    ownerRolesBackfilled: Math.max(0, beforeMissingOwner - afterMissingOwner),
    adminRolesBackfilled: Math.max(0, beforeMissingAdmin - afterMissingAdmin),
  };
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
    platformOwnersMissingOwnerRole,
    platformOwnersMissingPlatformAdmin,
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
      sql`SELECT COUNT(*) AS c FROM users u
          WHERE ${platformOwnerMatchClause()}
            AND NOT EXISTS (
              SELECT 1 FROM userRoles ur
              WHERE ur.userId = u.id AND ur.role = 'platform_owner'
            )`,
    ),
    scalarCount(
      db,
      sql`SELECT COUNT(*) AS c FROM users u
          WHERE ${platformOwnerMatchClause()}
            AND NOT EXISTS (
              SELECT 1 FROM userRoles ur
              WHERE ur.userId = u.id AND ur.role = 'platform_admin'
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
    platformOwnersMissingOwnerRole,
    platformOwnersMissingPlatformAdmin,
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

  const ownerAccess = await ensurePlatformOwnerAccess(db);
  const platformAdminAccess = await ensurePlatformAdminAccountAccess(db);

  const { backfillUserOpenIds } = await import("./backfillUserOpenIds");
  const openIdResult = await backfillUserOpenIds(db);

  if (
    baseRolesBackfilled > 0 ||
    platformAdminRolesBackfilled > 0 ||
    ownerAccess.ownerRolesBackfilled > 0 ||
    ownerAccess.adminRolesBackfilled > 0 ||
    ownerAccess.adminFlagsSet > 0 ||
    platformAdminAccess.adminRolesBackfilled > 0 ||
    platformAdminAccess.adminFlagsSet > 0 ||
    platformAdminAccess.usersEnsured > 0 ||
    openIdResult.updated > 0
  ) {
    console.log(
      `[ensureUserAccessAccounting] baseRoles=${baseRolesBackfilled}, platformAdmin=${platformAdminRolesBackfilled}, platformOwner=${ownerAccess.ownerRolesBackfilled}, ownerPlatformAdmin=${ownerAccess.adminRolesBackfilled}, ownerAdminFlags=${ownerAccess.adminFlagsSet}, platformAdminAccounts=${platformAdminAccess.adminRolesBackfilled}, platformAdminUsersEnsured=${platformAdminAccess.usersEnsured}, openIds=${openIdResult.updated}`,
    );
  }

  return {
    baseRolesBackfilled,
    platformAdminRolesBackfilled,
    platformOwnerRolesBackfilled: ownerAccess.ownerRolesBackfilled,
    platformOwnerAdminRolesBackfilled: ownerAccess.adminRolesBackfilled,
    platformOwnerAdminFlagsSet: ownerAccess.adminFlagsSet,
    openIdsBackfilled: openIdResult.updated,
    openIdBackfillSkipped: openIdResult.skipped,
    openIdBackfillErrors: openIdResult.errors,
  };
}
