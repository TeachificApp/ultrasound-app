import { eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { userEmailAliases, users } from "../../drizzle/schema";
import { PLATFORM_OWNER_EMAILS } from "../../shared/platformOwnerAccess";
import {
  isProtectedAccountEmail,
  protectedAccountEmailSqlList,
} from "../../shared/protectedAccountEmails";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type EmailAliasIssue = {
  aliasId: number;
  aliasEmail: string;
  userId: number;
  userPrimaryEmail: string | null;
  source: string;
  label: string | null;
  issue:
    | "stray_on_platform_owner"
    | "conflicts_with_primary"
    | "orphan_alias_no_user";
  primaryUserId?: number;
  mergedSourceUserId?: number;
};

export type EmailAliasAudit = {
  totalAliases: number;
  strayAliasesOnPlatformOwner: number;
  conflictingAliases: number;
  pendingMergedIntoOwner: number;
  issues: EmailAliasIssue[];
};

export type EmailAliasReconcileResult = {
  conflictingAliasesRemoved: number;
  mergedAccountsRestored: number;
  strayOwnerAliasesRemoved: number;
  usersCreatedFromStrayAliases: number;
  entitlementsRepointed: number;
  baseRolesBackfilled: number;
  skipped: Array<{ aliasId: number; aliasEmail: string; reason: string }>;
};

const MERGE_SOURCE_LABEL_RE = /Merged from account #(\d+)/i;
const MERGED_NAME_RE = /^\[Merged into #(\d+)\]/;

const ENTITLEMENT_TABLES: Array<{ table: string; column: string; dateColumn: string }> = [
  { table: "lms_enrollments", column: "user_id", dateColumn: "enrolled_at" },
  { table: "lms_orders", column: "user_id", dateColumn: "created_at" },
  { table: "lms_certificates", column: "user_id", dateColumn: "created_at" },
  { table: "lms_lesson_notes", column: "user_id", dateColumn: "created_at" },
  { table: "lms_lesson_bookmarks", column: "user_id", dateColumn: "created_at" },
  { table: "lms_video_events", column: "user_id", dateColumn: "created_at" },
  { table: "lms_quiz_attempts", column: "user_id", dateColumn: "created_at" },
  { table: "digital_purchases", column: "user_id", dateColumn: "created_at" },
  { table: "digital_download_events", column: "user_id", dateColumn: "created_at" },
  { table: "digital_bundle_purchases", column: "user_id", dateColumn: "created_at" },
  { table: "physical_product_orders", column: "user_id", dateColumn: "created_at" },
  { table: "funnel_purchases", column: "user_id", dateColumn: "created_at" },
  { table: "order_bump_conversions", column: "user_id", dateColumn: "created_at" },
  { table: "brandMemberships", column: "userId", dateColumn: "createdAt" },
  { table: "membership_subscriptions", column: "user_id", dateColumn: "created_at" },
  { table: "user_login_events", column: "user_id", dateColumn: "created_at" },
  { table: "user_activity_logs", column: "user_id", dateColumn: "created_at" },
  { table: "email_send_log", column: "user_id", dateColumn: "created_at" },
];

async function scalarCount(db: Db, query: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute(query);
  const row = extractExecuteRows<{ c?: number }>(result)[0];
  return Number(row?.c ?? 0);
}

function parseMergedSourceUserId(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(MERGE_SOURCE_LABEL_RE);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parseMergedTargetUserId(name: string | null | undefined): number | null {
  if (!name) return null;
  const match = name.match(MERGED_NAME_RE);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function getPlatformOwnerUserIds(db: Db): Promise<number[]> {
  const ownerEmails = (PLATFORM_OWNER_EMAILS as readonly string[]).map((e) =>
    e.replace(/'/g, "''"),
  );
  const emailClause = ownerEmails.map((e) => `'${e}'`).join(", ");
  const rows = extractExecuteRows<{ id: number }>(
    await db.execute(
      sql.raw(`SELECT id FROM users WHERE LOWER(email) IN (${emailClause})`),
    ),
  );
  return rows.map((r) => r.id);
}

/** Read-only audit of alias rows that can misroute auth or access. */
export async function auditEmailAliasIntegrity(
  db: Db | null | undefined,
): Promise<EmailAliasAudit | null> {
  if (!db) return null;

  const ownerIds = await getPlatformOwnerUserIds(db);
  const ownerIdSet = new Set(ownerIds);
  const protectedList = protectedAccountEmailSqlList();

  const aliasRows = extractExecuteRows<{
    id: number;
    userId: number;
    email: string;
    source: string;
    label: string | null;
    userPrimaryEmail: string | null;
  }>(
    await db.execute(sql`
      SELECT
        a.id,
        a.user_id AS userId,
        LOWER(a.email) AS email,
        a.source,
        a.label,
        LOWER(u.email) AS userPrimaryEmail
      FROM user_email_aliases a
      INNER JOIN users u ON u.id = a.user_id
      ORDER BY a.user_id, a.id
    `),
  );

  const issues: EmailAliasIssue[] = [];

  for (const row of aliasRows) {
    const mergedSourceUserId = parseMergedSourceUserId(row.label);

    if (ownerIdSet.has(row.userId) && !isProtectedAccountEmail(row.email)) {
      issues.push({
        aliasId: row.id,
        aliasEmail: row.email,
        userId: row.userId,
        userPrimaryEmail: row.userPrimaryEmail,
        source: row.source,
        label: row.label,
        issue: "stray_on_platform_owner",
        mergedSourceUserId: mergedSourceUserId ?? undefined,
      });
    }

    const primaryConflict = extractExecuteRows<{ id: number }>(
      await db.execute(sql`
        SELECT id FROM users
        WHERE LOWER(email) = ${row.email}
          AND id != ${row.userId}
          AND isPending = 0
          AND name NOT LIKE '[Merged into #%'
        LIMIT 1
      `),
    )[0];

    if (primaryConflict) {
      issues.push({
        aliasId: row.id,
        aliasEmail: row.email,
        userId: row.userId,
        userPrimaryEmail: row.userPrimaryEmail,
        source: row.source,
        label: row.label,
        issue: "conflicts_with_primary",
        primaryUserId: primaryConflict.id,
        mergedSourceUserId: mergedSourceUserId ?? undefined,
      });
    }
  }

  const pendingMergedIntoOwner =
    ownerIds.length === 0
      ? 0
      : await scalarCount(
          db,
          sql.raw(
            `SELECT COUNT(*) AS c FROM users
             WHERE isPending = 1
               AND name REGEXP '^\\\\[Merged into #(${ownerIds.join("|")})\\\\]'`,
          ),
        );

  return {
    totalAliases: aliasRows.length,
    strayAliasesOnPlatformOwner: issues.filter((i) => i.issue === "stray_on_platform_owner")
      .length,
    conflictingAliases: issues.filter((i) => i.issue === "conflicts_with_primary").length,
    pendingMergedIntoOwner,
    issues,
  };
}

async function ensureBaseUserRole(db: Db, userId: number): Promise<boolean> {
  const before = await scalarCount(
    db,
    sql`SELECT COUNT(*) AS c FROM userRoles WHERE userId = ${userId} AND role = 'user'`,
  );
  if (before > 0) return false;
  await db.execute(sql`
    INSERT INTO userRoles (userId, role, assignedByUserId, createdAt)
    VALUES (${userId}, 'user', ${userId}, NOW())
  `);
  return true;
}

async function repointEntitlementsBeforeMerge(
  db: Db,
  ownerId: number,
  sourceUserId: number,
  aliasCreatedAt: Date | null,
): Promise<number> {
  if (!aliasCreatedAt) return 0;
  let moved = 0;
  const cutoff = aliasCreatedAt.toISOString().slice(0, 19).replace("T", " ");

  for (const { table, column, dateColumn } of ENTITLEMENT_TABLES) {
    try {
      const result = await db.execute(sql.raw(
        `UPDATE \`${table}\`
         SET \`${column}\` = ${sourceUserId}
         WHERE \`${column}\` = ${ownerId}
           AND \`${dateColumn}\` <= '${cutoff.replace(/'/g, "''")}'`,
      ));
      moved += Number((result as { affectedRows?: number }).affectedRows ?? 0);
    } catch {
      // Table/column may differ on older schemas — skip silently
    }
  }

  return moved;
}

async function restoreMergedSourceUser(
  db: Db,
  sourceUserId: number,
  aliasEmail: string,
  ownerId: number,
): Promise<{ restored: boolean; reason?: string }> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isPending: users.isPending,
    })
    .from(users)
    .where(eq(users.id, sourceUserId))
    .limit(1);

  const source = rows[0];
  if (!source) {
    return { restored: false, reason: "merged_source_user_not_found" };
  }

  const mergedTargetId = parseMergedTargetUserId(source.name);
  if (!source.isPending || mergedTargetId !== ownerId) {
    return { restored: false, reason: "source_user_not_pending_merge_into_owner" };
  }

  const restoredName =
    source.name?.replace(MERGED_NAME_RE, "").trim() ||
    aliasEmail.split("@")[0] ||
    "Learner";

  await db
    .update(users)
    .set({
      email: aliasEmail,
      openId: `email:${aliasEmail}`,
      isPending: false,
      name: restoredName,
      loginMethod: "email",
      lastSignedIn: new Date(),
    })
    .where(eq(users.id, sourceUserId));

  await ensureBaseUserRole(db, sourceUserId);
  return { restored: true };
}

async function createStandaloneUserForAlias(
  db: Db,
  aliasEmail: string,
): Promise<number> {
  const existing = extractExecuteRows<{ id: number }>(
    await db.execute(sql`
      SELECT id FROM users
      WHERE LOWER(email) = ${aliasEmail}
        AND isPending = 0
        AND name NOT LIKE '[Merged into #%'
      LIMIT 1
    `),
  )[0];
  if (existing) return existing.id;

  const insertResult = await db.insert(users).values({
    openId: `email:${aliasEmail}`,
    email: aliasEmail,
    name: aliasEmail.split("@")[0] || "Learner",
    loginMethod: "email",
    role: "user",
    isPending: false,
    lastSignedIn: new Date(),
  });

  const insertId = Number((insertResult as { insertId?: number }).insertId ?? 0);
  if (insertId > 0) return insertId;

  const created = extractExecuteRows<{ id: number }>(
    await db.execute(sql`SELECT id FROM users WHERE LOWER(email) = ${aliasEmail} LIMIT 1`),
  )[0];
  if (!created) throw new Error(`Failed to create user for ${aliasEmail}`);
  return created.id;
}

/**
 * Idempotent cleanup:
 * - Remove aliases that duplicate an active primary email on another account
 * - Restore merged learner accounts incorrectly aliased on the platform owner
 * - Remove stray owner aliases so auth resolves to the correct user row
 */
export async function ensureEmailAliasIntegrity(
  db: Db | null | undefined,
): Promise<EmailAliasReconcileResult | null> {
  if (!db) return null;

  const before = await auditEmailAliasIntegrity(db);
  if (!before) return null;

  const ownerIds = await getPlatformOwnerUserIds(db);
  const ownerIdSet = new Set(ownerIds);
  const processedAliasIds = new Set<number>();

  let conflictingAliasesRemoved = 0;
  let mergedAccountsRestored = 0;
  let strayOwnerAliasesRemoved = 0;
  let usersCreatedFromStrayAliases = 0;
  let entitlementsRepointed = 0;
  let baseRolesBackfilled = 0;
  const skipped: EmailAliasReconcileResult["skipped"] = [];

  const aliasRows = await db.select().from(userEmailAliases);

  for (const issue of before.issues.filter((i) => i.issue === "conflicts_with_primary")) {
    if (processedAliasIds.has(issue.aliasId)) continue;
    await db.delete(userEmailAliases).where(eq(userEmailAliases.id, issue.aliasId));
    processedAliasIds.add(issue.aliasId);
    conflictingAliasesRemoved += 1;
  }

  for (const alias of aliasRows) {
    if (processedAliasIds.has(alias.id)) continue;
    if (!ownerIdSet.has(alias.userId)) continue;

    const aliasEmail = alias.email.trim().toLowerCase();
    if (isProtectedAccountEmail(aliasEmail)) continue;

    const primaryElsewhere = extractExecuteRows<{ id: number }>(
      await db.execute(sql`
        SELECT id FROM users
        WHERE LOWER(email) = ${aliasEmail}
          AND id != ${alias.userId}
          AND isPending = 0
          AND name NOT LIKE '[Merged into #%'
        LIMIT 1
      `),
    )[0];

    if (primaryElsewhere) {
      await db.delete(userEmailAliases).where(eq(userEmailAliases.id, alias.id));
      processedAliasIds.add(alias.id);
      strayOwnerAliasesRemoved += 1;
      continue;
    }

    const mergedSourceUserId = parseMergedSourceUserId(alias.label);
    let resolvedUserId: number | null = null;

    if (mergedSourceUserId) {
      const restore = await restoreMergedSourceUser(
        db,
        mergedSourceUserId,
        aliasEmail,
        alias.userId,
      );
      if (restore.restored) {
        mergedAccountsRestored += 1;
        resolvedUserId = mergedSourceUserId;
        entitlementsRepointed += await repointEntitlementsBeforeMerge(
          db,
          alias.userId,
          mergedSourceUserId,
          alias.createdAt,
        );
        if (await ensureBaseUserRole(db, mergedSourceUserId)) {
          baseRolesBackfilled += 1;
        }
      } else {
        skipped.push({
          aliasId: alias.id,
          aliasEmail,
          reason: restore.reason ?? "merge_restore_failed",
        });
      }
    }

    if (!resolvedUserId) {
      try {
        resolvedUserId = await createStandaloneUserForAlias(db, aliasEmail);
        usersCreatedFromStrayAliases += 1;
        if (await ensureBaseUserRole(db, resolvedUserId)) {
          baseRolesBackfilled += 1;
        }
      } catch (err) {
        skipped.push({
          aliasId: alias.id,
          aliasEmail,
          reason: err instanceof Error ? err.message : "create_user_failed",
        });
        continue;
      }
    }

    await db.delete(userEmailAliases).where(eq(userEmailAliases.id, alias.id));
    processedAliasIds.add(alias.id);
    strayOwnerAliasesRemoved += 1;
  }

  if (
    conflictingAliasesRemoved > 0 ||
    mergedAccountsRestored > 0 ||
    strayOwnerAliasesRemoved > 0 ||
    usersCreatedFromStrayAliases > 0
  ) {
    console.log(
      `[ensureEmailAliasIntegrity] conflictsRemoved=${conflictingAliasesRemoved}, mergedRestored=${mergedAccountsRestored}, ownerAliasesRemoved=${strayOwnerAliasesRemoved}, usersCreated=${usersCreatedFromStrayAliases}, entitlementsRepointed=${entitlementsRepointed}`,
    );
  }

  return {
    conflictingAliasesRemoved,
    mergedAccountsRestored,
    strayOwnerAliasesRemoved,
    usersCreatedFromStrayAliases,
    entitlementsRepointed,
    baseRolesBackfilled,
    skipped,
  };
}
