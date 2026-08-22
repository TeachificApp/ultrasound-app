import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const OUTPUT_PATH = "/tmp/railway-next-batch-dry-run.json";

const nextBatchManifest = [
  {
    tableName: "users",
    order: 1,
    purpose: "Learner and educator identity records required by Teach ownership references.",
    dependencies: [],
    identitySensitive: true,
    migrationRule: "excluded_pending_identity_and_auth_plan",
  },
  {
    tableName: "userRoles",
    order: 2,
    purpose: "Supplemental platform-role assignments.",
    dependencies: ["users"],
    migrationRule: "excluded_with_users",
  },
  {
    tableName: "teach_folders",
    order: 3,
    purpose: "Teacher-owned material folders.",
    dependencies: ["users"],
    userReferences: ["owner_user_id"],
    migrationRule: "blocked_pending_identity_mapping",
  },
  {
    tableName: "teach_slide_masters",
    order: 4,
    purpose: "Teacher-owned slide master layouts.",
    dependencies: ["users"],
    userReferences: ["owner_user_id"],
    migrationRule: "blocked_pending_identity_mapping",
  },
  {
    tableName: "teach_materials",
    order: 5,
    purpose: "Teacher-owned presentations, media, and documents.",
    dependencies: ["users", "teach_folders", "teach_slide_masters"],
    userReferences: ["owner_user_id", "trashed_by"],
    migrationRule: "blocked_pending_identity_mapping",
  },
  {
    tableName: "teach_material_permissions",
    order: 6,
    purpose: "Material sharing grants.",
    dependencies: ["users", "teach_materials"],
    userReferences: ["grantee_user_id", "granted_by_user_id"],
    migrationRule: "blocked_pending_identity_mapping",
  },
  {
    tableName: "sonoQuizzes",
    order: 7,
    purpose: "Teacher-authored live Teach/SonoQuiz games.",
    dependencies: ["users"],
    userReferences: ["createdByUserId"],
    migrationRule: "blocked_pending_identity_mapping",
  },
  {
    tableName: "sonoQuizQuestions",
    order: 8,
    purpose: "Mixed interactive live-game slides.",
    dependencies: ["sonoQuizzes"],
    migrationRule: "eligible_after_parent_and_schema_approval",
  },
  {
    tableName: "sonoQuizSessions",
    order: 9,
    purpose: "Live game sessions.",
    dependencies: ["users", "sonoQuizzes"],
    userReferences: ["hostUserId"],
    migrationRule: "blocked_pending_identity_mapping",
  },
  {
    tableName: "sonoQuizParticipants",
    order: 10,
    purpose: "Live session participants.",
    dependencies: ["sonoQuizSessions", "users"],
    userReferences: ["userId"],
    migrationRule: "blocked_pending_identity_mapping",
  },
  {
    tableName: "sonoQuizAnswers",
    order: 11,
    purpose: "Participant responses and scored/collaborative interactions.",
    dependencies: ["sonoQuizSessions", "sonoQuizParticipants", "sonoQuizQuestions"],
    migrationRule: "eligible_after_parent_and_schema_approval",
  },
];

const excludedTables = [
  {
    category: "identity_and_authorization",
    tables: ["userRoles"],
    rationale: "Depends on the separately governed user identity migration and should not be copied without a role and authorization review.",
  },
  {
    category: "active_or_sensitive_learner_records",
    tables: ["lms_enrollments", "lms_orders", "lms_lesson_progress", "lms_certificates", "digital_purchases"],
    rationale: "These shared tables were handled in the approved initial insert-only batch or require a new scoped reconciliation rather than inclusion in the Teach schema batch.",
  },
  {
    category: "unreviewed_source_only_tables",
    tables: ["userRoles"],
    rationale: "Only tables enumerated in the explicit next-batch manifest are assessed by this artifact; every other Manus-only table remains out of scope.",
  },
];

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replaceAll("`", "``")}\``;
}

function piiSafeId(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

async function connect(url) {
  if (!url) throw new Error("Required database connection is unavailable");
  return mysql.createConnection({ uri: url, connectTimeout: 10_000 });
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [tableName],
  );
  return Boolean(rows[0]?.count);
}

async function columns(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT column_name AS columnName, column_type AS columnType, is_nullable AS isNullable, column_default AS columnDefault, extra
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ?
     ORDER BY ordinal_position`,
    [tableName],
  );
  return rows;
}

async function primaryKey(connection, tableName) {
  const [rows] = await connection.query(
    "SELECT column_name AS columnName FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = 'PRIMARY' ORDER BY seq_in_index",
    [tableName],
  );
  return rows.map((row) => row.columnName);
}

async function foreignKeys(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT column_name AS columnName, referenced_table_name AS referencedTableName, referenced_column_name AS referencedColumnName
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE() AND table_name = ? AND referenced_table_name IS NOT NULL
     ORDER BY ordinal_position`,
    [tableName],
  );
  return rows;
}

async function rowCount(connection, tableName) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`);
  return Number(rows[0]?.count ?? 0);
}

async function freshness(connection, tableName, tableColumns) {
  const names = new Set(tableColumns.map((column) => column.columnName));
  const candidates = ["updatedAt", "updated_at", "createdAt", "created_at", "issuedAt", "issued_at", "joinedAt", "joined_at", "answeredAt", "answered_at"];
  const marker = candidates.find((column) => names.has(column));
  if (!marker) return { marker: null, maxValue: null };
  const [rows] = await connection.query(`SELECT MAX(${quoteIdentifier(marker)}) AS \`max_value\` FROM ${quoteIdentifier(tableName)}`);
  return {
    marker,
    maxValue: rows[0]?.max_value ? new Date(rows[0].max_value).toISOString() : null,
  };
}

async function showCreateTable(connection, tableName) {
  const [rows] = await connection.query(`SHOW CREATE TABLE ${quoteIdentifier(tableName)}`);
  const createTable = rows[0]?.["Create Table"];
  return typeof createTable === "string" ? createTable : null;
}

async function keySet(connection, tableName, primaryKeyColumns) {
  if (!primaryKeyColumns.length) return null;
  const selected = primaryKeyColumns.map(quoteIdentifier).join(", ");
  const [rows] = await connection.query(`SELECT ${selected} FROM ${quoteIdentifier(tableName)}`);
  return new Set(rows.map((row) => primaryKeyColumns.map((column) => String(row[column] ?? "")).join("\u001f")));
}

function missingColumns(sourceColumns, targetColumns) {
  const targetByName = new Map(targetColumns.map((column) => [column.columnName, column]));
  return sourceColumns
    .filter((sourceColumn) => !targetByName.has(sourceColumn.columnName))
    .map((column) => ({
      columnName: column.columnName,
      sourceColumnType: column.columnType,
      sourceNullable: column.isNullable,
      sourceDefault: column.columnDefault,
      sourceExtra: column.extra,
    }));
}

function incompatibleColumns(sourceColumns, targetColumns) {
  const targetByName = new Map(targetColumns.map((column) => [column.columnName, column]));
  return sourceColumns.flatMap((sourceColumn) => {
    const targetColumn = targetByName.get(sourceColumn.columnName);
    if (!targetColumn) return [];
    const differs = sourceColumn.columnType !== targetColumn.columnType || sourceColumn.isNullable !== targetColumn.isNullable;
    return differs
      ? [{
        columnName: sourceColumn.columnName,
        source: { columnType: sourceColumn.columnType, isNullable: sourceColumn.isNullable },
        target: { columnType: targetColumn.columnType, isNullable: targetColumn.isNullable },
      }]
      : [];
  });
}

async function summarizeIdentityConflicts(source, target, sourceExists, targetExists) {
  const unavailable = {
    status: "not_comparable",
    reason: !sourceExists ? "Source users table is absent." : "Railway users table is absent; direct identity conflict comparison cannot run.",
    sourceOnlyUsers: null,
    primaryKeyOverlaps: null,
    emailConflicts: null,
    openIdConflicts: null,
    samples: [],
  };
  if (!sourceExists || !targetExists) return unavailable;

  const [sourceColumns, targetColumns] = await Promise.all([columns(source, "users"), columns(target, "users")]);
  const sourceNames = new Set(sourceColumns.map((column) => column.columnName));
  const targetNames = new Set(targetColumns.map((column) => column.columnName));
  const sharedIdentityColumns = ["id", "email", "openId"].filter((column) => sourceNames.has(column) && targetNames.has(column));
  if (!sharedIdentityColumns.includes("id")) {
    return { ...unavailable, reason: "Source and Railway users tables do not share a usable id column." };
  }

  const selectColumns = ["id", "email", "openId"].filter((column) => sourceNames.has(column));
  const targetSelectColumns = ["id", "email", "openId"].filter((column) => targetNames.has(column));
  const [sourceRows] = await source.query(`SELECT ${selectColumns.map(quoteIdentifier).join(", ")} FROM \`users\``);
  const [targetRows] = await target.query(`SELECT ${targetSelectColumns.map(quoteIdentifier).join(", ")} FROM \`users\``);
  const targetById = new Map(targetRows.map((row) => [String(row.id), row]));
  const targetByEmail = new Map(targetRows.filter((row) => row.email).map((row) => [String(row.email).trim().toLowerCase(), row]));
  const targetByOpenId = new Map(targetRows.filter((row) => row.openId).map((row) => [String(row.openId), row]));

  const primaryKeyOverlaps = [];
  const emailConflicts = [];
  const openIdConflicts = [];
  let sourceOnlyUsers = 0;
  for (const sourceUser of sourceRows) {
    const targetBySameId = targetById.get(String(sourceUser.id));
    const targetBySameEmail = sourceUser.email ? targetByEmail.get(String(sourceUser.email).trim().toLowerCase()) : null;
    const targetBySameOpenId = sourceUser.openId ? targetByOpenId.get(String(sourceUser.openId)) : null;
    if (!targetBySameId && !targetBySameEmail && !targetBySameOpenId) sourceOnlyUsers += 1;
    if (targetBySameId && ((sourceUser.email && targetBySameId.email && String(sourceUser.email).trim().toLowerCase() !== String(targetBySameId.email).trim().toLowerCase()) || (sourceUser.openId && targetBySameId.openId && sourceUser.openId !== targetBySameId.openId))) {
      primaryKeyOverlaps.push({ sourceUserId: sourceUser.id, railwayUserId: targetBySameId.id, conflict: "same_id_different_identity" });
    }
    if (targetBySameEmail && Number(targetBySameEmail.id) !== Number(sourceUser.id)) {
      emailConflicts.push({ sourceUserId: sourceUser.id, railwayUserId: targetBySameEmail.id, conflict: "same_email_different_id" });
    }
    if (targetBySameOpenId && Number(targetBySameOpenId.id) !== Number(sourceUser.id)) {
      openIdConflicts.push({ sourceUserId: sourceUser.id, railwayUserId: targetBySameOpenId.id, conflict: "same_open_id_different_id" });
    }
  }
  const anonymize = (item) => ({
    sourceUser: piiSafeId(item.sourceUserId),
    railwayUser: piiSafeId(item.railwayUserId),
    conflict: item.conflict,
  });
  return {
    status: "compared",
    sourceOnlyUsers,
    primaryKeyOverlaps: primaryKeyOverlaps.length,
    emailConflicts: emailConflicts.length,
    openIdConflicts: openIdConflicts.length,
    samples: [...primaryKeyOverlaps, ...emailConflicts, ...openIdConflicts].slice(0, 10).map(anonymize),
  };
}

async function summarizeTable(source, target, definition, identitySummary) {
  const sourceExists = await tableExists(source, definition.tableName);
  const targetExists = await tableExists(target, definition.tableName);
  const base = {
    tableName: definition.tableName,
    order: definition.order,
    purpose: definition.purpose,
    dependencies: definition.dependencies,
    userReferences: definition.userReferences ?? [],
    sourceExists,
    railwayExists: targetExists,
    migrationRule: definition.migrationRule,
  };
  if (!sourceExists) return { ...base, status: "excluded_source_missing", rationale: "The source table is not present." };

  const isExplicitlyExcluded = definition.migrationRule.startsWith("excluded_");

  const [sourceColumns, sourcePrimaryKey, sourceForeignKeys, sourceRows, sourceFreshness] = await Promise.all([
    columns(source, definition.tableName),
    primaryKey(source, definition.tableName),
    foreignKeys(source, definition.tableName),
    rowCount(source, definition.tableName),
    (async () => freshness(source, definition.tableName, await columns(source, definition.tableName)))(),
  ]);
  if (!targetExists) {
    return {
      ...base,
      status: definition.identitySensitive ? "excluded_identity_schema_absent" : "railway_schema_missing",
      sourceRows,
      sourcePrimaryKey,
      sourceForeignKeys,
      sourceFreshness,
      railwayRows: 0,
      railwayPrimaryKey: [],
      railwayFreshness: { marker: null, maxValue: null },
      requiredAdditiveDdl: [await showCreateTable(source, definition.tableName)],
      requiredColumnAdds: [],
      incompatibleColumns: [],
      primaryKeyOverlap: null,
      candidateSourceOnlyRows: sourceRows,
      proposedInsertRows: isExplicitlyExcluded || definition.identitySensitive || definition.userReferences?.length ? 0 : sourceRows,
      blockingReason: isExplicitlyExcluded
        ? "This table is deliberately excluded from the next batch and is not proposed for schema or data migration."
        : definition.identitySensitive
        ? "Do not create or copy users until a separate identity, authentication, credential-exclusion, and ID-mapping plan is explicitly approved."
        : definition.userReferences?.length
          ? "Rows reference user identifiers. Do not copy them until the users mapping plan is approved and reconciled."
          : "Railway schema creation requires separate explicit approval; this artifact does not execute DDL.",
    };
  }

  const [targetColumns, targetPrimaryKey, targetForeignKeys, targetRows] = await Promise.all([
    columns(target, definition.tableName),
    primaryKey(target, definition.tableName),
    foreignKeys(target, definition.tableName),
    rowCount(target, definition.tableName),
  ]);
  const [sourceKeys, targetKeys, targetFreshness] = await Promise.all([
    keySet(source, definition.tableName, sourcePrimaryKey),
    keySet(target, definition.tableName, targetPrimaryKey),
    freshness(target, definition.tableName, targetColumns),
  ]);
  const matchingPrimaryKey = JSON.stringify(sourcePrimaryKey) === JSON.stringify(targetPrimaryKey) && sourcePrimaryKey.length > 0;
  const sourceOnlyKeys = matchingPrimaryKey && sourceKeys && targetKeys ? [...sourceKeys].filter((key) => !targetKeys.has(key)) : [];
  const targetOnlyKeys = matchingPrimaryKey && sourceKeys && targetKeys ? [...targetKeys].filter((key) => !sourceKeys.has(key)) : [];
  const identityBlocked = isExplicitlyExcluded || definition.identitySensitive || (definition.userReferences?.length && identitySummary.status !== "compared");
  return {
    ...base,
    status: matchingPrimaryKey ? (identityBlocked ? "blocked_identity_mapping" : "schema_and_key_reconciliation_ready") : "manual_primary_key_review_required",
    sourceRows,
    railwayRows: targetRows,
    sourceColumns,
    railwayColumns: targetColumns,
    sourcePrimaryKey,
    railwayPrimaryKey: targetPrimaryKey,
    sourceForeignKeys,
    railwayForeignKeys: targetForeignKeys,
    sourceFreshness,
    railwayFreshness: targetFreshness,
    requiredAdditiveDdl: [],
    requiredColumnAdds: missingColumns(sourceColumns, targetColumns),
    incompatibleColumns: incompatibleColumns(sourceColumns, targetColumns),
    primaryKeyOverlap: matchingPrimaryKey && sourceKeys && targetKeys ? sourceKeys.size - sourceOnlyKeys.length : null,
    candidateSourceOnlyRows: matchingPrimaryKey ? sourceOnlyKeys.length : null,
    proposedInsertRows: identityBlocked ? 0 : sourceOnlyKeys.length,
    targetOnlyRowsRetained: matchingPrimaryKey ? targetOnlyKeys.length : null,
  };
}

const source = await connect(process.env.DATABASE_URL);
const target = await connect(process.env.RAILWAY_MYSQL_URL);
try {
  const [sourceUsersExists, targetUsersExists] = await Promise.all([tableExists(source, "users"), tableExists(target, "users")]);
  const identitySummary = await summarizeIdentityConflicts(source, target, sourceUsersExists, targetUsersExists);
  const tables = [];
  for (const definition of nextBatchManifest) {
    tables.push(await summarizeTable(source, target, definition, identitySummary));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    scope: "Read-only next Manus-to-Railway dry run. No tables were created, altered, backed up, inserted, updated, deleted, or exported.",
    approvalGate: "No Railway change is authorized by this report. A separate explicit approval is required after review; any approved execution must create a new Railway backup manifest immediately before its first write.",
    identityReconciliation: identitySummary,
    dependencyOrder: nextBatchManifest.map(({ tableName, order, dependencies }) => ({ tableName, order, dependencies })),
    tables,
    excludedTables,
    decision: {
      recommendedExecutionScope: "No data migration is currently recommended. Identity-dependent Teach records remain blocked until an approved user-ID mapping plan exists. Zero-row SonoQuiz child tables may be considered later for additive schema-only approval, not this report.",
      existingRailwayRowsPolicy: "Retain all Railway rows. This future workflow may only use approved additive DDL and insert-only data operations; it must never update or delete existing Railway rows.",
    },
  };
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outputPath: OUTPUT_PATH, generatedAt: report.generatedAt, identityReconciliation: identitySummary, tables: tables.map((table) => ({ tableName: table.tableName, status: table.status, sourceRows: table.sourceRows ?? 0, railwayRows: table.railwayRows ?? 0, proposedInsertRows: table.proposedInsertRows ?? 0 })) }, null, 2));
} finally {
  // This report never mutates either connection. Destroying after all result sets are
  // consumed avoids a driver close handshake hanging the operator-run dry-run process.
  source.destroy();
  target.destroy();
}
