import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  EXPO_COMBINED_GROUP_TABLE_DDL,
  EXPO_COMBINED_SCHEMA_ADDITIONS,
  ensureExpoCombinedOfferSchema,
  shouldRunExpoCombinedOfferStartupMigration,
} from "./ensureExpoCombinedOfferSchema";
import {
  expoCombinedCheckoutSchemaAvailable,
  inspectExpoCombinedOfferSchema,
} from "./expoCombinedOfferSchema";
import { shouldRunExpoTenantStartupMigration } from "./ensureExpoTenantSchema";

const packages = "ultrasound_expo_packages";
const registrations = "ultrasound_expo_registrations";
const groups = "ultrasound_expo_checkout_groups";
const tables = [packages, registrations, groups];
const railwayUrl = "mysql://migration_user:fake-test-password@mysql.railway.internal:3306/railway";
const legacyUrl = "mysql://legacy:fake-legacy-password@gateway06.us-east-1.prod.aws.tidbcloud.com:4000/legacy";
const productionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production", RAILWAY_PRIMARY: "true", RAILWAY_MYSQL_URL: railwayUrl,
};
const expectedGroupDdl = `CREATE TABLE IF NOT EXISTS \`ultrasound_expo_checkout_groups\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`user_id\` INT NOT NULL,
  \`vendor_application_id\` INT NULL,
  \`package_type\` ENUM('registrant','exhibitor','sponsor') NOT NULL,
  \`subtotal_cents\` INT NOT NULL,
  \`discount_cents\` INT NOT NULL,
  \`amount_cents\` INT NOT NULL,
  \`currency\` VARCHAR(8) NOT NULL DEFAULT 'usd',
  \`stripe_session_id\` VARCHAR(255) NULL,
  \`stripe_payment_intent_id\` VARCHAR(255) NULL,
  \`payment_status\` ENUM('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  \`paid_at\` TIMESTAMP NULL,
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`ultrasound_expo_checkout_groups_session_unique\` (\`stripe_session_id\`),
  KEY \`ultrasound_expo_checkout_groups_user_status_idx\` (\`user_id\`, \`payment_status\`),
  KEY \`ultrasound_expo_checkout_groups_vendor_application_idx\` (\`vendor_application_id\`)
)`;

type Column = { TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string };
type Index = { TABLE_NAME: string; INDEX_NAME: string; COLUMN_NAME: string; SEQ_IN_INDEX: number; NON_UNIQUE: number };
type Metadata = { columns: Column[]; indexes: Index[] };
type Addition = (typeof EXPO_COMBINED_SCHEMA_ADDITIONS)[number];
type MockDb = NonNullable<Parameters<typeof ensureExpoCombinedOfferSchema>[0]> & {
  execute: ReturnType<typeof vi.fn>;
};
type QueryContext = {
  query: { sql: string; params: unknown[] };
  kind: "columns" | "indexes" | "create" | "addition";
  addition?: Addition;
  state: Metadata;
};
type QueryHook = (context: QueryContext) => void | "ignore-ddl";

function column(table: string, name: string, type = "int", nullable = "YES"): Column {
  return { TABLE_NAME: table, COLUMN_NAME: name, DATA_TYPE: type, IS_NULLABLE: nullable };
}
function index(table: string, name: string, names: string[], unique = false): Index[] {
  return names.map((COLUMN_NAME, offset) => ({
    TABLE_NAME: table, INDEX_NAME: name, COLUMN_NAME,
    SEQ_IN_INDEX: offset + 1, NON_UNIQUE: unique ? 0 : 1,
  }));
}
// Independent fixtures mirror the already-authored Drizzle schema, rather than
// deriving a 'complete' schema from whichever requirements the helper exports.
const groupColumns = [
  column(groups, "id", "int", "NO"),
  column(groups, "user_id", "int", "NO"),
  column(groups, "vendor_application_id"),
  column(groups, "package_type", "enum", "NO"),
  column(groups, "subtotal_cents", "int", "NO"),
  column(groups, "discount_cents", "int", "NO"),
  column(groups, "amount_cents", "int", "NO"),
  column(groups, "currency", "varchar", "NO"),
  column(groups, "stripe_session_id", "varchar"),
  column(groups, "stripe_payment_intent_id", "varchar"),
  column(groups, "payment_status", "enum", "NO"),
  column(groups, "paid_at", "timestamp"),
  column(groups, "created_at", "timestamp", "NO"),
  column(groups, "updated_at", "timestamp", "NO"),
];
const requiredIndexes = [
  ...index(packages, "ultrasound_expo_packages_combined_with_idx", ["combined_with_package_id"]),
  ...index(registrations, "ultrasound_expo_registrations_checkout_group_idx", ["checkout_group_id"]),
  ...index(groups, "PRIMARY", ["id"], true),
  ...index(groups, "ultrasound_expo_checkout_groups_session_unique", ["stripe_session_id"], true),
  ...index(groups, "ultrasound_expo_checkout_groups_user_status_idx", ["user_id", "payment_status"]),
  ...index(groups, "ultrasound_expo_checkout_groups_vendor_application_idx", ["vendor_application_id"]),
];
const requiredColumns = [
  column(packages, "combined_with_package_id"),
  column(registrations, "checkout_group_id"),
  ...groupColumns,
];
function baseMetadata(): Metadata {
  return {
    columns: [column(packages, "id", "int", "NO"), column(packages, "name", "varchar", "NO"),
      column(packages, "amount_cents", "int", "NO"), column(packages, "is_active", "tinyint", "NO"),
      column(registrations, "id", "int", "NO"), column(registrations, "vendor_application_id")],
    indexes: [...index(packages, "PRIMARY", ["id"], true), ...index(registrations, "PRIMARY", ["id"], true)],
  };
}
function completeMetadata(): Metadata {
  const base = baseMetadata();
  return { columns: [...base.columns, ...structuredClone(requiredColumns)], indexes: [...base.indexes, ...structuredClone(requiredIndexes)] };
}
function removeIndex(state: Metadata, table: string, name: string) {
  state.indexes = state.indexes.filter(row => row.TABLE_NAME !== table || row.INDEX_NAME !== name);
}
function applyAddition(state: Metadata, addition: Addition) {
  if (addition.kind === "column") {
    if (!state.columns.some(row => row.TABLE_NAME === addition.table && row.COLUMN_NAME === addition.column)) {
      state.columns.push(column(addition.table, addition.column!));
    }
  } else if (!state.indexes.some(row => row.TABLE_NAME === addition.table && row.INDEX_NAME === addition.index)) {
    state.indexes.push(...index(addition.table, addition.index!, [...addition.columns!], addition.unique));
  }
}
function createGroup(state: Metadata) {
  if (state.columns.some(row => row.TABLE_NAME === groups)) return;
  state.columns.push(...structuredClone(groupColumns));
  state.indexes.push(...structuredClone(requiredIndexes.filter(row => row.TABLE_NAME === groups)));
}
const dialect = new MySqlDialect();
function compileStatement(statement: unknown): { sql: string; params: unknown[] } {
  expect(statement).toBeInstanceOf(SQL);
  return dialect.sqlToQuery(statement as SQL);
}
let databases: MockDb[] = [];
function mockDatabase(initial: Metadata = baseMetadata(), hook?: QueryHook) {
  const state = structuredClone(initial);
  // No mysql client, getDb call, application import, or connection is created.
  // Every metadata query AND every DDL statement is executed only by this mock.
  const db = { execute: vi.fn(async (statement: unknown) => {
    const query = compileStatement(statement);
    const addition = EXPO_COMBINED_SCHEMA_ADDITIONS.find(item => item.ddl === query.sql);
    const kind = /INFORMATION_SCHEMA\s*\.\s*COLUMNS/i.test(query.sql) ? "columns"
      : /INFORMATION_SCHEMA\s*\.\s*STATISTICS/i.test(query.sql) ? "indexes"
      : query.sql === EXPO_COMBINED_GROUP_TABLE_DDL ? "create" : "addition";
    const behavior = hook?.({ query, kind, addition, state });
    if (kind === "columns") return [structuredClone(state.columns), []];
    if (kind === "indexes") return [structuredClone(state.indexes), []];
    if (kind === "create") {
      if (behavior !== "ignore-ddl") createGroup(state);
    } else {
      expect(addition, `Unapproved SQL: ${query.sql}`).toBeDefined();
      if (behavior !== "ignore-ddl") applyAddition(state, addition!);
    }
    return [{ affectedRows: 0 }, []];
  }) } as unknown as MockDb;
  databases.push(db);
  return { db, state };
}
function ddlStatements(db: MockDb): string[] {
  return db.execute.mock.calls.map(([statement]) => compileStatement(statement).sql)
    .filter(statement => !/^\s*SELECT\b/i.test(statement));
}
function expectInspection(statement: unknown) {
  const query = compileStatement(statement);
  expect(query.sql).toMatch(/^\s*SELECT\b/i);
  expect(query.sql).toMatch(/TABLE_SCHEMA\s*=\s*DATABASE\(\)/i);
  expect(query.sql).toMatch(/TABLE_NAME\s+IN\s*\(/i);
  for (const table of tables) expect(`${query.sql} ${JSON.stringify(query.params)}`).toContain(table);
  if (/INFORMATION_SCHEMA\s*\.\s*COLUMNS/i.test(query.sql)) {
    expect(query.sql).toMatch(/SELECT\s+TABLE_NAME\s*,\s*COLUMN_NAME\s*,\s*DATA_TYPE\s*,\s*IS_NULLABLE\s+FROM\s+INFORMATION_SCHEMA\s*\.\s*COLUMNS/i);
  } else {
    expect(query.sql).toMatch(/SELECT\s+TABLE_NAME\s*,\s*INDEX_NAME\s*,\s*COLUMN_NAME\s*,\s*SEQ_IN_INDEX\s*,\s*NON_UNIQUE\s+FROM\s+INFORMATION_SCHEMA\s*\.\s*STATISTICS/i);
  }
}
function expectFailed(result: Awaited<ReturnType<typeof ensureExpoCombinedOfferSchema>>) {
  expect(result).toMatchObject({ status: "failed", applied: false });
  expect(result.error).toEqual(expect.any(String));
  expect(result.error!.length).toBeGreaterThan(0);
}
function expectFinalMetadataInspection(db: MockDb) {
  const statements = db.execute.mock.calls.map(([statement]) => compileStatement(statement).sql);
  const lastDdl = statements.findLastIndex(statement => !/^\s*SELECT\b/i.test(statement));
  const finalReads = statements.slice(lastDdl + 1);
  expect(finalReads.some(statement => /INFORMATION_SCHEMA\s*\.\s*COLUMNS/i.test(statement))).toBe(true);
  expect(finalReads.some(statement => /INFORMATION_SCHEMA\s*\.\s*STATISTICS/i.test(statement))).toBe(true);
}

beforeEach(() => { databases = []; });
afterEach(() => {
  // Independent audit applies even to failure/race tests. A mock accepting a
  // statement cannot hide a seed, row update, destructive DDL, or extra query.
  const allowed = new Set([EXPO_COMBINED_GROUP_TABLE_DDL, ...EXPO_COMBINED_SCHEMA_ADDITIONS.map(item => item.ddl)]);
  for (const db of databases) for (const [statement] of db.execute.mock.calls) {
    const query = compileStatement(statement);
    if (/^\s*SELECT\b/i.test(query.sql)) expectInspection(statement);
    else {
      expect(allowed.has(query.sql), `Unapproved DDL: ${query.sql}`).toBe(true);
      expect(query.params).toEqual([]);
      expect(query.sql).not.toMatch(/;|\b(?:DROP|TRUNCATE|RENAME|MODIFY|CHANGE|DELETE|INSERT|REPLACE)\b/i);
      expect(query.sql).toMatch(/^CREATE TABLE IF NOT EXISTS `ultrasound_expo_checkout_groups`|^ALTER TABLE `ultrasound_expo_(?:packages|registrations)` ADD COLUMN |^CREATE (?:UNIQUE )?INDEX `ultrasound_expo_[a-z_]+` ON `ultrasound_expo_(?:packages|registrations|checkout_groups)`/);
    }
    expect(query.sql).not.toMatch(/^\s*(?:UPDATE|DELETE|INSERT|REPLACE|DROP|TRUNCATE|RENAME)\b/i);
    expect(query.sql).not.toContain("ultrasound_expo_events");
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const guardCases: Array<{ name: string; env: NodeJS.ProcessEnv; allowed: boolean }> = [
  { name: "explicit production primary", env: productionEnv, allowed: true },
  ...["RAILWAY_SERVICE_ID", "RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID"].map(key => ({ name: key, env: { NODE_ENV: "production", [key]: "test-id", MYSQL_URL: railwayUrl }, allowed: true })),
  { name: "production Railway environment", env: { NODE_ENV: "production", RAILWAY_ENVIRONMENT: "production", MYSQL_URL: railwayUrl }, allowed: true },
  { name: "native URL overrides retired database", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true", MYSQL_URL: railwayUrl, DATABASE_URL: legacyUrl }, allowed: true },
  { name: "Railway DATABASE_URL fallback", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true", DATABASE_URL: railwayUrl }, allowed: true },
  { name: "public Railway URL", env: { ...productionEnv, RAILWAY_MYSQL_URL: "mysql://migration_user:fake-test-password@viaduct.proxy.rlwy.net:37790/railway" }, allowed: true },
  { name: "development", env: { ...productionEnv, NODE_ENV: "development" }, allowed: false },
  { name: "test", env: { ...productionEnv, NODE_ENV: "test" }, allowed: false },
  { name: "missing NODE_ENV", env: { RAILWAY_PRIMARY: "true", MYSQL_URL: railwayUrl }, allowed: false },
  { name: "non-Railway runtime", env: { NODE_ENV: "production", MYSQL_URL: railwayUrl }, allowed: false },
  { name: "false primary overrides Railway indicators", env: { ...productionEnv, RAILWAY_PRIMARY: "false", RAILWAY_PROJECT_ID: "test-id", RAILWAY_SERVICE_ID: "test-id", RAILWAY_ENVIRONMENT_ID: "test-id", RAILWAY_ENVIRONMENT: "production" }, allowed: false },
  { name: "missing database", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true" }, allowed: false },
  { name: "unrelated TiDB database", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true", DATABASE_URL: legacyUrl }, allowed: false },
  { name: "unrelated explicit MySQL database", env: { ...productionEnv, RAILWAY_MYSQL_URL: "mysql://root:fake-secret@localhost:3306/other" }, allowed: false },
  { name: "unrelated native MySQL database", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true", MYSQL_URL: "mysql://root:fake-secret@db.example.com:3306/other" }, allowed: false },
  { name: "empty environment", env: {}, allowed: false },
];

describe("shouldRunExpoCombinedOfferStartupMigration", () => {
  it.each(guardCases)("reuses the identical tenant guard for $name", ({ env, allowed }) => {
    expect(shouldRunExpoCombinedOfferStartupMigration(env)).toBe(allowed);
    expect(shouldRunExpoCombinedOfferStartupMigration(env)).toBe(shouldRunExpoTenantStartupMigration(env));
  });
  it("defaults to process.env and honors an explicit false primary", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("RAILWAY_PRIMARY", "true"); vi.stubEnv("RAILWAY_MYSQL_URL", railwayUrl);
    expect(shouldRunExpoCombinedOfferStartupMigration()).toBe(true);
    vi.stubEnv("RAILWAY_PRIMARY", "false");
    expect(shouldRunExpoCombinedOfferStartupMigration()).toBe(false);
  });
});

describe("combined checkout schema inspection and availability", () => {
  it("uses exactly two scoped metadata queries and returns uppercase metadata", async () => {
    const { db, state } = mockDatabase(completeMetadata());
    expect(await inspectExpoCombinedOfferSchema(db)).toEqual(state);
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(ddlStatements(db)).toEqual([]);
  });
  it("reports full readiness only for all required columns and named indexes", async () => {
    const { db } = mockDatabase(completeMetadata());
    expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(true);
    expect(ddlStatements(db)).toEqual([]);
  });
  it("does not mistake the package-link column alone for full readiness", async () => {
    const initial = baseMetadata(); initial.columns.push(column(packages, "combined_with_package_id"));
    const { db } = mockDatabase(initial);
    expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(false);
  });
  it.each(requiredColumns)("fails readiness without $TABLE_NAME.$COLUMN_NAME", async missing => {
    const initial = completeMetadata();
    initial.columns = initial.columns.filter(row => row.TABLE_NAME !== missing.TABLE_NAME || row.COLUMN_NAME !== missing.COLUMN_NAME);
    const { db } = mockDatabase(initial);
    expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(false);
  });
  it.each(requiredColumns)("fails readiness for wrong type/nullability at $TABLE_NAME.$COLUMN_NAME", async invalid => {
    for (const mismatch of ["type", "nullable"]) {
      const initial = completeMetadata(); const target = initial.columns.find(row => row.TABLE_NAME === invalid.TABLE_NAME && row.COLUMN_NAME === invalid.COLUMN_NAME)!;
      if (mismatch === "type") target.DATA_TYPE = invalid.DATA_TYPE === "varchar" ? "int" : "varchar";
      else target.IS_NULLABLE = invalid.IS_NULLABLE === "YES" ? "NO" : "YES";
      const { db } = mockDatabase(initial);
      expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(false);
    }
  });
  const namedIndexes = requiredIndexes.filter(row => row.SEQ_IN_INDEX === 1);
  it.each(namedIndexes)("fails readiness without named index $INDEX_NAME", async missing => {
    const initial = completeMetadata(); removeIndex(initial, missing.TABLE_NAME, missing.INDEX_NAME);
    const { db } = mockDatabase(initial);
    expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(false);
  });
  it.each([
    { name: "missing composite member", mutate: (state: Metadata) => { state.indexes = state.indexes.filter(row => row.INDEX_NAME !== "ultrasound_expo_checkout_groups_user_status_idx" || row.SEQ_IN_INDEX !== 2); } },
    { name: "wrong composite order", mutate: (state: Metadata) => { for (const row of state.indexes.filter(row => row.INDEX_NAME === "ultrasound_expo_checkout_groups_user_status_idx")) row.SEQ_IN_INDEX = row.SEQ_IN_INDEX === 1 ? 2 : 1; } },
    { name: "nonunique Stripe session", mutate: (state: Metadata) => { for (const row of state.indexes.filter(row => row.INDEX_NAME === "ultrasound_expo_checkout_groups_session_unique")) row.NON_UNIQUE = 1; } },
    { name: "same columns under another name", mutate: (state: Metadata) => { for (const row of state.indexes.filter(row => row.INDEX_NAME === "ultrasound_expo_packages_combined_with_idx")) row.INDEX_NAME = "unapproved_equivalent_name"; } },
  ])("fails readiness for $name", async ({ mutate }) => {
    const initial = completeMetadata(); mutate(initial);
    const { db } = mockDatabase(initial);
    expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(false);
  });
  it("fails closed when metadata cannot be read", async () => {
    const { db } = mockDatabase(completeMetadata(), () => { throw new Error("Metadata unavailable"); });
    expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(false);
  });
});

describe("ensureExpoCombinedOfferSchema", () => {
  it("whitelists only the approved nullable links, named indexes, and new group table", () => {
    expect(EXPO_COMBINED_GROUP_TABLE_DDL).toBe(expectedGroupDdl);
    expect(EXPO_COMBINED_GROUP_TABLE_DDL).toMatch(/^CREATE TABLE IF NOT EXISTS `ultrasound_expo_checkout_groups`/);
    for (const required of groupColumns) expect(EXPO_COMBINED_GROUP_TABLE_DDL).toContain(`\`${required.COLUMN_NAME}\``);
    expect(EXPO_COMBINED_GROUP_TABLE_DDL).toMatch(/PRIMARY KEY\s*\(\s*`id`\s*\)/i);
    expect(EXPO_COMBINED_GROUP_TABLE_DDL).toContain("ultrasound_expo_checkout_groups_session_unique");
    const columns = EXPO_COMBINED_SCHEMA_ADDITIONS.filter(item => item.kind === "column");
    expect(columns.map(item => [item.table, item.column]).sort()).toEqual([[packages, "combined_with_package_id"], [registrations, "checkout_group_id"]].sort());
    for (const addition of columns) {
      const after = addition.table === packages ? "is_active" : "vendor_application_id";
      expect(addition.ddl).toBe(`ALTER TABLE \`${addition.table}\` ADD COLUMN \`${addition.column}\` INT NULL AFTER \`${after}\``);
    }
    const indexes = EXPO_COMBINED_SCHEMA_ADDITIONS.filter(item => item.kind === "index");
    expect(indexes).toHaveLength(5);
    for (const addition of indexes) {
      const expected = requiredIndexes.filter(row => row.TABLE_NAME === addition.table && row.INDEX_NAME === addition.index);
      expect(expected.length).toBeGreaterThan(0);
      expect(addition.columns).toEqual(expected.map(row => row.COLUMN_NAME));
      expect(Boolean(addition.unique)).toBe(expected[0].NON_UNIQUE === 0);
      const names = expected.map(row => `\`${row.COLUMN_NAME}\``).join(", ");
      expect(addition.ddl).toBe(`CREATE ${addition.unique ? "UNIQUE " : ""}INDEX \`${addition.index}\` ON \`${addition.table}\` (${names})`);
    }
  });
  it.each(guardCases.filter(test => !test.allowed))("skips EVERY query for $name", async ({ env }) => {
    const { db } = mockDatabase();
    expect(await ensureExpoCombinedOfferSchema(db, env)).toEqual({ status: "skipped", applied: false });
    expect(db.execute).not.toHaveBeenCalled();
  });
  it("uses process.env by default and checks eligibility before an unavailable db", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { db } = mockDatabase();
    expect(await ensureExpoCombinedOfferSchema(db)).toEqual({ status: "skipped", applied: false });
    expect(await ensureExpoCombinedOfferSchema(null)).toEqual({ status: "skipped", applied: false });
    expect(db.execute).not.toHaveBeenCalled();
  });
  it.each([null, undefined])("fails safely for eligible unavailable db %s", async db => {
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
  });
  it("creates the group and adds only two links and two base indexes, then verifies the entire schema", async () => {
    const { db } = mockDatabase();
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: true });
    const expected = [EXPO_COMBINED_GROUP_TABLE_DDL, ...EXPO_COMBINED_SCHEMA_ADDITIONS.filter(item => item.table !== groups).map(item => item.ddl)];
    expect(ddlStatements(db).sort()).toEqual(expected.sort());
    expectFinalMetadataInspection(db);
    expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(true);
  });
  it("does no DDL when the full schema is already ready", async () => {
    const { db } = mockDatabase(completeMetadata());
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: false });
    expect(ddlStatements(db)).toEqual([]);
  });
  it("is idempotent across subsequent startups against the same stateful database", async () => {
    const { db } = mockDatabase();
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: true });
    const firstDdl = ddlStatements(db);
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: false });
    expect(ddlStatements(db)).toEqual(firstDdl);
    expect(new Set(firstDdl).size).toBe(firstDdl.length);
  });
  it.each(EXPO_COMBINED_SCHEMA_ADDITIONS)("resumes a partial migration with only the missing $kind on $table", async missing => {
    const initial = completeMetadata();
    if (missing.kind === "column") initial.columns = initial.columns.filter(row => row.TABLE_NAME !== missing.table || row.COLUMN_NAME !== missing.column);
    else removeIndex(initial, missing.table, missing.index!);
    const { db } = mockDatabase(initial);
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: true });
    expect(ddlStatements(db)).toEqual([missing.ddl]);
    expectFinalMetadataInspection(db);
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: false });
    expect(ddlStatements(db)).toEqual([missing.ddl]);
  });
  it("creates only the missing group when both base links and indexes already exist", async () => {
    const initial = completeMetadata(); initial.columns = initial.columns.filter(row => row.TABLE_NAME !== groups); initial.indexes = initial.indexes.filter(row => row.TABLE_NAME !== groups);
    const { db } = mockDatabase(initial);
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: true });
    expect(ddlStatements(db)).toEqual([EXPO_COMBINED_GROUP_TABLE_DDL]);
  });
  it.each([packages, registrations])("checks existing %s id BEFORE any DDL", async missingTable => {
    for (const removeEntireTable of [true, false]) {
      const initial = baseMetadata(); initial.columns = initial.columns.filter(row => row.TABLE_NAME !== missingTable || (!removeEntireTable && row.COLUMN_NAME !== "id"));
      const { db } = mockDatabase(initial);
      expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
      expect(ddlStatements(db)).toEqual([]);
    }
  });
  it.each([
    { table: packages, name: "is_active" },
    { table: registrations, name: "vendor_application_id" },
  ])("requires existing ADD COLUMN anchor $table.$name before any DDL", async ({ table, name }) => {
    const initial = baseMetadata(); initial.columns = initial.columns.filter(row => row.TABLE_NAME !== table || row.COLUMN_NAME !== name);
    const { db } = mockDatabase(initial);
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    expect(ddlStatements(db)).toEqual([]);
  });
  it.each([packages, registrations])("requires a nonnullable INT id in existing %s before any DDL", async table => {
    for (const mismatch of ["type", "nullable"]) {
      const initial = baseMetadata(); const id = initial.columns.find(row => row.TABLE_NAME === table && row.COLUMN_NAME === "id")!;
      if (mismatch === "type") id.DATA_TYPE = "varchar";
      else id.IS_NULLABLE = "YES";
      const { db } = mockDatabase(initial);
      expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
      expect(ddlStatements(db)).toEqual([]);
    }
  });
  it("does not retrofit an existing group missing its approved primary key", async () => {
    const initial = completeMetadata(); removeIndex(initial, groups, "PRIMARY");
    const { db } = mockDatabase(initial);
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    expect(ddlStatements(db)).toEqual([]);
  });
  it.each(requiredColumns)("fails without retrofitting wrong type/nullability at $TABLE_NAME.$COLUMN_NAME", async invalid => {
    for (const mismatch of ["type", "nullable"]) {
      const initial = completeMetadata(); const target = initial.columns.find(row => row.TABLE_NAME === invalid.TABLE_NAME && row.COLUMN_NAME === invalid.COLUMN_NAME)!;
      if (mismatch === "type") target.DATA_TYPE = invalid.DATA_TYPE === "varchar" ? "int" : "varchar";
      else target.IS_NULLABLE = invalid.IS_NULLABLE === "YES" ? "NO" : "YES";
      const { db, state } = mockDatabase(initial);
      expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
      expect(ddlStatements(db)).toEqual([]);
      expect(state).toEqual(initial);
    }
  });
  it.each(groupColumns)("does not retrofit an existing group missing $COLUMN_NAME", async missing => {
    const initial = completeMetadata(); initial.columns = initial.columns.filter(row => row.TABLE_NAME !== groups || row.COLUMN_NAME !== missing.COLUMN_NAME);
    // Missing base links would otherwise invite additive DDL; structural
    // incompatibility must be checked first, leaving ALL existing tables alone.
    initial.columns = initial.columns.filter(row => row.TABLE_NAME !== packages || row.COLUMN_NAME !== "combined_with_package_id");
    const { db, state } = mockDatabase(initial);
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    expect(ddlStatements(db)).toEqual([]);
    expect(state).toEqual(initial);
  });
  it("rejects an existing named index with the wrong structure rather than overwriting it", async () => {
    const initial = completeMetadata(); initial.indexes.find(row => row.INDEX_NAME === "ultrasound_expo_checkout_groups_session_unique")!.NON_UNIQUE = 1;
    const { db } = mockDatabase(initial);
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    expect(ddlStatements(db)).toEqual([]);
  });
  it("does not execute DDL when initial metadata inspection fails", async () => {
    const { db } = mockDatabase(baseMetadata(), () => { throw new Error("Cannot inspect schema"); });
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    expect(ddlStatements(db)).toEqual([]);
  });
  it.each([
    { name: "permission failure", error: { code: "ER_TABLEACCESS_DENIED_ERROR", errno: 1142 } },
    { name: "unrelated duplicate key", error: { code: "ER_DUP_ENTRY", errno: 1062 } },
    { name: "unknown database failure", error: { code: "ER_UNKNOWN_ERROR", errno: 1105 } },
    { name: "duplicate-looking message without code", error: new Error("Duplicate column name 'checkout_group_id'") },
  ])("fails and sanitizes output/logs on $name", async ({ error }) => {
    const rawMessage = `DDL denied to migration_user; password=fake-test-password; connection=${railwayUrl}`;
    const failure = Object.assign(new Error(rawMessage), { cause: error });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const warningLog = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const { db } = mockDatabase(baseMetadata(), ({ kind }) => { if (kind === "create" || kind === "addition") throw failure; });
    const result = await ensureExpoCombinedOfferSchema(db, productionEnv);
    expectFailed(result);
    const output = JSON.stringify([result, errorLog.mock.calls, warningLog.mock.calls, infoLog.mock.calls]);
    for (const sensitive of [rawMessage, railwayUrl, "fake-test-password", "migration_user", "mysql.railway.internal"]) expect(output).not.toContain(sensitive);
    expect(ddlStatements(db)).toHaveLength(1);
  });
  it("resumes safely after an interrupted additive migration without repeating successful DDL", async () => {
    let interrupted = false;
    const { db } = mockDatabase(baseMetadata(), ({ kind, addition }) => {
      if (!interrupted && kind === "addition" && addition?.kind === "index") { interrupted = true; throw { errno: 1142 }; }
    });
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    const attempted = ddlStatements(db); const successful = attempted.slice(0, -1);
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: true });
    const resumed = ddlStatements(db).slice(attempted.length);
    for (const statement of successful) expect(resumed).not.toContain(statement);
    expectFinalMetadataInspection(db);
  });
  it("does not trust successful DDL when the final full schema cannot be verified", async () => {
    const { db } = mockDatabase(baseMetadata(), ({ kind, addition }) => {
      if (kind === "addition" && addition?.kind === "index" && addition.table === registrations) return "ignore-ddl";
    });
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    expectFinalMetadataInspection(db);
    expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(false);
  });
  it("fails when metadata verification throws after successful DDL", async () => {
    let ddlStarted = false;
    const { db } = mockDatabase(baseMetadata(), ({ kind }) => {
      if (kind === "create" || kind === "addition") ddlStarted = true;
      else if (ddlStarted) throw new Error("Post-DDL metadata unavailable");
    });
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    expect(ddlStatements(db).length).toBeGreaterThan(0);
  });
  const races = [
    { name: "ER_DUP_FIELDNAME", kind: "column", error: { code: "ER_DUP_FIELDNAME" } },
    { name: "1060", kind: "column", error: { errno: 1060 } },
    { name: "nested 1060", kind: "column", error: { cause: { errno: 1060 } } },
    { name: "ER_DUP_KEYNAME", kind: "index", error: { code: "ER_DUP_KEYNAME" } },
    { name: "1061", kind: "index", error: { errno: 1061 } },
    { name: "nested 1061", kind: "index", error: { cause: { errno: 1061 } } },
  ];
  it.each(races)("accepts race $name ONLY after full metadata verification", async ({ kind, error }) => {
    const missing = EXPO_COMBINED_SCHEMA_ADDITIONS.find(item => item.kind === kind && item.table === packages)!;
    const initial = completeMetadata();
    if (missing.kind === "column") initial.columns = initial.columns.filter(row => row.TABLE_NAME !== packages || row.COLUMN_NAME !== missing.column);
    else removeIndex(initial, packages, missing.index!);
    const { db } = mockDatabase(initial, ({ kind: queryKind, addition, state }) => {
      if (queryKind === "addition" && addition === missing) { applyAddition(state, missing); throw error; }
    });
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: false });
    expect(ddlStatements(db)).toEqual([missing.ddl]);
    expectFinalMetadataInspection(db);
    expect(await expoCombinedCheckoutSchemaAvailable(db)).toBe(true);
  });
  it.each(races)("rejects unverified race $name", async ({ kind, error }) => {
    const missing = EXPO_COMBINED_SCHEMA_ADDITIONS.find(item => item.kind === kind && item.table === packages)!;
    const initial = completeMetadata();
    if (missing.kind === "column") initial.columns = initial.columns.filter(row => row.TABLE_NAME !== packages || row.COLUMN_NAME !== missing.column);
    else removeIndex(initial, packages, missing.index!);
    const { db } = mockDatabase(initial, ({ kind: queryKind, addition }) => { if (queryKind === "addition" && addition === missing) throw error; });
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    expectFinalMetadataInspection(db);
  });
  it("rejects a duplicate race when a different required index disappears before final verification", async () => {
    const missing = EXPO_COMBINED_SCHEMA_ADDITIONS.find(item => item.kind === "column" && item.table === packages)!;
    const initial = completeMetadata(); initial.columns = initial.columns.filter(row => row.TABLE_NAME !== packages || row.COLUMN_NAME !== missing.column);
    let raced = false;
    let postRaceIndexReads = 0;
    const { db } = mockDatabase(initial, ({ kind, addition, state }) => {
      if (kind === "addition" && addition === missing) {
        applyAddition(state, missing); raced = true; throw { errno: 1060 };
      }
      if (raced && kind === "indexes" && ++postRaceIndexReads === 2) {
        removeIndex(state, groups, "ultrasound_expo_checkout_groups_session_unique");
      }
    });
    expectFailed(await ensureExpoCombinedOfferSchema(db, productionEnv));
    expectFinalMetadataInspection(db);
  });
  it("leaves existing event/package records, dates, prices, and linking choices untouched", async () => {
    const records = {
      events: [{ id: 1, tenant: "ultrasound_expo", start_date: "2027-04-09", end_date: "2027-04-11" }, { id: 2, tenant: "echo_expo", start_date: "2027-04-12", end_date: "2027-04-14" }],
      packages: [{ id: 10, event_id: 1, amount_cents: 129900, combined_with_package_id: null }, { id: 11, event_id: 2, amount_cents: 249900, combined_with_package_id: null }],
      registrations: [{ id: 20, amount_cents: 129900, payment_status: "paid", checkout_group_id: null }],
    };
    const before = structuredClone(records); const { db } = mockDatabase();
    expect(await ensureExpoCombinedOfferSchema(db, productionEnv)).toEqual({ status: "ready", applied: true });
    expect(records).toEqual(before);
    // The global SQL audit is the substantive guarantee: these fake data rows
    // are never queried or mutated, and no event/data SQL reaches execute.
    for (const [statement] of db.execute.mock.calls) expect(compileStatement(statement).sql).not.toMatch(/^\s*(?:UPDATE|INSERT|DELETE|REPLACE)\b/i);
  });
});

describe("combined migration startup wiring (source only, never boot the server)", () => {
  it("starts the helper nonawaited before the actual HTTP server listen", () => {
    const source = readFileSync(new URL("../_core/index.ts", import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
    const migration = code.indexOf('import("../lib/ensureExpoCombinedOfferSchema")');
    const listen = code.indexOf("server.listen(port", code.indexOf("async function startServer"));
    expect(migration).toBeGreaterThan(0);
    expect(listen).toBeGreaterThan(migration);
    const block = code.slice(migration, listen);
    expect(code.slice(Math.max(0, migration - 30), migration)).not.toMatch(/await\s*$/);
    expect(block).toMatch(/\.then\(async\s*\(\s*\{\s*ensureExpoCombinedOfferSchema\s*\}\s*\)\s*=>/);
    expect(block).toMatch(/ensureExpoCombinedOfferSchema\(await getDb\(\)\)/);
    expect(block).toMatch(/\.catch\(/);
    expect(block).not.toContain("startEmailCampaignScheduler");
    expect(block).not.toContain("shouldRunPrimaryHostMaintenance");
  });
});
