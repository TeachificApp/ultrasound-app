import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  EXPO_TENANT_COLUMN_DDL,
  ensureExpoTenantSchema,
  shouldRunExpoTenantStartupMigration,
} from "./ensureExpoTenantSchema";
import { expoTenantSchemaAvailable } from "./expoEventSchemaCompatibility";

const railwayUrl = "mysql://migration_user:fake-test-password@mysql.railway.internal:3306/railway";
const publicRailwayUrl = "mysql://migration_user:fake-test-password@viaduct.proxy.rlwy.net:37790/railway";
const legacyUrl = "mysql://legacy:fake-legacy-password@gateway06.us-east-1.prod.aws.tidbcloud.com:4000/legacy";
const expectedDdl = "ALTER TABLE `ultrasound_expo_events` ADD COLUMN `tenant` VARCHAR(40) NOT NULL DEFAULT 'ultrasound_expo' AFTER `id`";
const productionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  RAILWAY_PRIMARY: "true",
  RAILWAY_MYSQL_URL: railwayUrl,
};

function columnRows(...names: string[]) {
  return [names.map(COLUMN_NAME => ({ COLUMN_NAME })), []];
}

const dialect = new MySqlDialect();
function compileStatement(statement: unknown): { sql: string; params: unknown[] } {
  if (typeof statement === "string") return { sql: statement, params: [] };
  expect(statement).toBeInstanceOf(SQL);
  return dialect.sqlToQuery(statement as SQL);
}

type MockDb = NonNullable<Parameters<typeof ensureExpoTenantSchema>[0]> & {
  execute: ReturnType<typeof vi.fn>;
};
let databases: MockDb[] = [];
function mockDb(): MockDb {
  // No database connection is created: every query, including DDL, is mocked.
  const db = { execute: vi.fn() } as unknown as MockDb;
  databases.push(db);
  return db;
}

function expectColumnInspection(statement: unknown) {
  const query = compileStatement(statement);
  expect(query.sql).toMatch(/^\s*SELECT\b/i);
  expect(query.sql).toMatch(/COLUMN_NAME/i);
  expect(query.sql).toMatch(/INFORMATION_SCHEMA\s*\.\s*COLUMNS/i);
  expect(query.sql).toMatch(/TABLE_SCHEMA\s*=\s*DATABASE\(\)/i);
  expect(`${query.sql} ${JSON.stringify(query.params)}`).toContain("ultrasound_expo_events");
}

function expectFailed(result: Awaited<ReturnType<typeof ensureExpoTenantSchema>>) {
  expect(result).toMatchObject({ status: "failed", applied: false });
  expect(result.error).toEqual(expect.any(String));
  expect(result.error?.length).toBeGreaterThan(0);
}

beforeEach(() => {
  databases = [];
});

afterEach(() => {
  // Audit every executed statement: metadata reads or the single approved ADD
  // COLUMN only. No unrelated schema change or data mutation is permitted.
  for (const db of databases) {
    let alterations = 0;
    for (const [statement] of db.execute.mock.calls) {
      const query = compileStatement(statement);
      expect(query.sql).not.toMatch(/\b(?:UPDATE|DELETE|DROP|INSERT|TRUNCATE|REPLACE|MODIFY|RENAME)\b/i);
      if (/^\s*SELECT\b/i.test(query.sql)) {
        expectColumnInspection(statement);
      } else {
        expect(query.sql).toBe(expectedDdl);
        expect(query.params).toEqual([]);
        alterations++;
      }
    }
    expect(alterations).toBeLessThanOrEqual(1);
  }
  vi.unstubAllEnvs();
});

const guardCases: Array<{ name: string; env: NodeJS.ProcessEnv; allowed: boolean }> = [
  { name: "explicit Railway primary in production", env: productionEnv, allowed: true },
  { name: "Railway service ID without an explicit primary flag", env: { NODE_ENV: "production", RAILWAY_SERVICE_ID: "service-test-id", MYSQL_URL: railwayUrl }, allowed: true },
  { name: "Railway project ID without an explicit primary flag", env: { NODE_ENV: "production", RAILWAY_PROJECT_ID: "project-test-id", MYSQL_URL: railwayUrl }, allowed: true },
  { name: "Railway environment ID without an explicit primary flag", env: { NODE_ENV: "production", RAILWAY_ENVIRONMENT_ID: "environment-test-id", MYSQL_URL: railwayUrl }, allowed: true },
  { name: "Railway production environment without an explicit primary flag", env: { NODE_ENV: "production", RAILWAY_ENVIRONMENT: "production", MYSQL_URL: railwayUrl }, allowed: true },
  { name: "native MYSQL_URL with a retired DATABASE_URL", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true", MYSQL_URL: railwayUrl, DATABASE_URL: legacyUrl }, allowed: true },
  { name: "Railway DATABASE_URL fallback", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true", DATABASE_URL: railwayUrl }, allowed: true },
  { name: "public Railway MySQL URL", env: { ...productionEnv, RAILWAY_MYSQL_URL: publicRailwayUrl }, allowed: true },
  { name: "explicit Railway URL overrides retired DATABASE_URL", env: { ...productionEnv, DATABASE_URL: legacyUrl }, allowed: true },
  { name: "development even with Railway primary", env: { ...productionEnv, NODE_ENV: "development" }, allowed: false },
  { name: "test runtime even with Railway primary", env: { ...productionEnv, NODE_ENV: "test" }, allowed: false },
  { name: "missing NODE_ENV", env: { RAILWAY_PRIMARY: "true", MYSQL_URL: railwayUrl }, allowed: false },
  { name: "production non-Railway runtime with Railway URL", env: { NODE_ENV: "production", MYSQL_URL: railwayUrl }, allowed: false },
  { name: "explicit false overrides all Railway IDs", env: { ...productionEnv, RAILWAY_PRIMARY: "false", RAILWAY_SERVICE_ID: "service-test-id", RAILWAY_PROJECT_ID: "project-test-id", RAILWAY_ENVIRONMENT_ID: "environment-test-id" }, allowed: false },
  { name: "explicit false overrides Railway production environment", env: { ...productionEnv, RAILWAY_PRIMARY: "false", RAILWAY_ENVIRONMENT: "production" }, allowed: false },
  { name: "explicit false without Railway IDs", env: { ...productionEnv, RAILWAY_PRIMARY: "false" }, allowed: false },
  { name: "Railway primary without a database URL", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true" }, allowed: false },
  { name: "retired Manus database only", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true", DATABASE_URL: legacyUrl }, allowed: false },
  { name: "non-Railway explicit MySQL URL", env: { ...productionEnv, RAILWAY_MYSQL_URL: "mysql://root:fake-secret@localhost:3306/other" }, allowed: false },
  { name: "non-Railway native MySQL URL", env: { NODE_ENV: "production", RAILWAY_PRIMARY: "true", MYSQL_URL: "mysql://root:fake-secret@db.example.com:3306/other" }, allowed: false },
  { name: "Railway IDs with an unresolved database URL", env: { NODE_ENV: "production", RAILWAY_SERVICE_ID: "service-test-id", DATABASE_URL: legacyUrl }, allowed: false },
  { name: "empty environment", env: {}, allowed: false },
];

describe("shouldRunExpoTenantStartupMigration", () => {
  it.each(guardCases)("$name => $allowed", ({ env, allowed }) => {
    expect(shouldRunExpoTenantStartupMigration(env)).toBe(allowed);
  });

  it("defaults to process.env without ignoring an explicit false primary flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAILWAY_PRIMARY", "true");
    vi.stubEnv("RAILWAY_MYSQL_URL", railwayUrl);
    expect(shouldRunExpoTenantStartupMigration()).toBe(true);
    vi.stubEnv("RAILWAY_PRIMARY", "false");
    expect(shouldRunExpoTenantStartupMigration()).toBe(false);
  });
});

describe("ensureExpoTenantSchema", () => {
  it("exports exactly the approved additive DDL with no data mutation", () => {
    expect(EXPO_TENANT_COLUMN_DDL).toBe(expectedDdl);
    expect(EXPO_TENANT_COLUMN_DDL).not.toMatch(/\b(?:UPDATE|DELETE|DROP|INSERT|TRUNCATE|REPLACE)\b/i);
    expect(EXPO_TENANT_COLUMN_DDL).not.toContain(";");
  });

  it.each(guardCases.filter(test => !test.allowed))("skips all queries for $name", async ({ env }) => {
    const db = mockDb();
    expect(await ensureExpoTenantSchema(db, env)).toEqual({ status: "skipped", applied: false });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("uses process.env by default and skips before touching an unavailable database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RAILWAY_PRIMARY", "true");
    vi.stubEnv("RAILWAY_MYSQL_URL", railwayUrl);
    const db = mockDb();
    expect(await ensureExpoTenantSchema(db)).toEqual({ status: "skipped", applied: false });
    expect(await ensureExpoTenantSchema(null)).toEqual({ status: "skipped", applied: false });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it.each([null, undefined])("fails closed when the eligible database is %s", async db => {
    expectFailed(await ensureExpoTenantSchema(db, productionEnv));
  });

  it("returns ready without DDL when tenant already exists", async () => {
    const db = mockDb();
    db.execute.mockResolvedValueOnce(columnRows("id", "name", "tenant"));
    expect(await ensureExpoTenantSchema(db, productionEnv)).toEqual({ status: "ready", applied: false });
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "no table columns", names: [] },
    { name: "columns without the required id", names: ["name"] },
  ])("fails without creating or altering a table for $name", async ({ names }) => {
    const db = mockDb();
    db.execute.mockResolvedValueOnce(columnRows(...names));
    expectFailed(await ensureExpoTenantSchema(db, productionEnv));
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("adds only the missing tenant column once, then verifies it", async () => {
    const db = mockDb();
    db.execute
      .mockResolvedValueOnce(columnRows("id", "name"))
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce(columnRows("id", "name", "tenant"));
    expect(await ensureExpoTenantSchema(db, productionEnv)).toEqual({ status: "ready", applied: true });
    expect(db.execute).toHaveBeenCalledTimes(3);
    expectColumnInspection(db.execute.mock.calls[0][0]);
    expect(compileStatement(db.execute.mock.calls[1][0]).sql).toBe(expectedDdl);
    expectColumnInspection(db.execute.mock.calls[2][0]);
  });

  it("is idempotent on a subsequent startup with the same database", async () => {
    const db = mockDb();
    db.execute
      .mockResolvedValueOnce(columnRows("id"))
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce(columnRows("id", "tenant"))
      .mockResolvedValueOnce(columnRows("id", "tenant"));
    expect(await ensureExpoTenantSchema(db, productionEnv)).toEqual({ status: "ready", applied: true });
    expect(await ensureExpoTenantSchema(db, productionEnv)).toEqual({ status: "ready", applied: false });
    expect(db.execute).toHaveBeenCalledTimes(4);
  });

  it("does not report applied or ready when post-DDL verification lacks tenant", async () => {
    const db = mockDb();
    db.execute
      .mockResolvedValueOnce(columnRows("id"))
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce(columnRows("id"));
    expectFailed(await ensureExpoTenantSchema(db, productionEnv));
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it("fails rather than trusting a successful DDL when verification throws", async () => {
    const db = mockDb();
    db.execute
      .mockResolvedValueOnce(columnRows("id"))
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockRejectedValueOnce(new Error("Metadata lookup unavailable"));
    expectFailed(await ensureExpoTenantSchema(db, productionEnv));
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it("does not execute DDL when initial schema inspection fails", async () => {
    const db = mockDb();
    db.execute.mockRejectedValueOnce(new Error("Cannot inspect schema"));
    expectFailed(await ensureExpoTenantSchema(db, productionEnv));
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  const duplicateErrors = [
    { name: "ER_DUP_FIELDNAME", error: { code: "ER_DUP_FIELDNAME" } },
    { name: "errno 1060", error: { errno: 1060 } },
    { name: "nested ER_DUP_FIELDNAME", error: { cause: { code: "ER_DUP_FIELDNAME" } } },
    { name: "nested errno 1060", error: { cause: { errno: 1060 } } },
  ];

  it.each(duplicateErrors)("accepts a concurrent $name only after verifying tenant", async ({ error }) => {
    const db = mockDb();
    db.execute
      .mockResolvedValueOnce(columnRows("id"))
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(columnRows("id", "tenant"));
    expect(await ensureExpoTenantSchema(db, productionEnv)).toEqual({ status: "ready", applied: false });
    expect(db.execute).toHaveBeenCalledTimes(3);
    expectColumnInspection(db.execute.mock.calls[2][0]);
  });

  it.each(duplicateErrors)("rejects an unverified $name when tenant is still missing", async ({ error }) => {
    const db = mockDb();
    db.execute
      .mockResolvedValueOnce(columnRows("id"))
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(columnRows("id"));
    expectFailed(await ensureExpoTenantSchema(db, productionEnv));
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it("fails if schema verification after a duplicate race throws", async () => {
    const db = mockDb();
    db.execute
      .mockResolvedValueOnce(columnRows("id"))
      .mockRejectedValueOnce({ cause: { errno: 1060 } })
      .mockRejectedValueOnce(new Error("Verification unavailable"));
    expectFailed(await ensureExpoTenantSchema(db, productionEnv));
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it.each([
    { name: "permission error", code: "ER_TABLEACCESS_DENIED_ERROR", errno: 1142 },
    { name: "unrelated duplicate key error", code: "ER_DUP_ENTRY", errno: 1062 },
    { name: "unexpected database error", code: "ER_UNKNOWN_ERROR", errno: 1105 },
  ])("fails safely on $name without exposing connection credentials", async ({ code, errno }) => {
    const rawMessage = `ALTER denied to migration_user; password=fake-test-password; connection=${railwayUrl}`;
    const error = Object.assign(new Error(rawMessage), {
      cause: Object.assign(new Error(rawMessage), { code, errno }),
    });
    const db = mockDb();
    db.execute.mockResolvedValueOnce(columnRows("id")).mockRejectedValueOnce(error);
    const result = await ensureExpoTenantSchema(db, productionEnv);
    expectFailed(result);
    for (const sensitive of [rawMessage, railwayUrl, "fake-test-password", "migration_user", "mysql.railway.internal"]) {
      expect(result.error).not.toContain(sensitive);
    }
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it("does not treat a duplicate-looking message without the MySQL code as a verified race", async () => {
    const db = mockDb();
    db.execute
      .mockResolvedValueOnce(columnRows("id"))
      .mockRejectedValueOnce(new Error("Duplicate column name 'tenant'"));
    expectFailed(await ensureExpoTenantSchema(db, productionEnv));
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it.each([
    { name: "already-present column", path: "existing", applied: false },
    { name: "successful additive migration", path: "added", applied: true },
    { name: "verified duplicate race", path: "duplicate", applied: false },
  ])("invalidates a cached missing tenant for $name", async ({ path, applied }) => {
    const db = mockDb();
    db.execute.mockResolvedValueOnce(columnRows());
    expect(await expoTenantSchemaAvailable(db)).toBe(false);
    expect(await expoTenantSchemaAvailable(db)).toBe(false);
    expect(db.execute).toHaveBeenCalledTimes(1);

    if (path === "existing") {
      db.execute.mockResolvedValueOnce(columnRows("id", "tenant"));
    } else {
      db.execute.mockResolvedValueOnce(columnRows("id"));
      if (path === "duplicate") db.execute.mockRejectedValueOnce({ cause: { code: "ER_DUP_FIELDNAME" } });
      else db.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
      db.execute.mockResolvedValueOnce(columnRows("id", "tenant"));
    }
    expect(await ensureExpoTenantSchema(db, productionEnv)).toEqual({ status: "ready", applied });

    const callsBeforeRefresh = db.execute.mock.calls.length;
    db.execute.mockResolvedValueOnce(columnRows("tenant"));
    expect(await expoTenantSchemaAvailable(db)).toBe(true);
    expect(db.execute).toHaveBeenCalledTimes(callsBeforeRefresh + 1);
    expect(await expoTenantSchemaAvailable(db)).toBe(true);
    expect(db.execute).toHaveBeenCalledTimes(callsBeforeRefresh + 1);
  });

  it("keeps the missing-tenant cache intact after an unverified migration", async () => {
    const db = mockDb();
    db.execute.mockResolvedValueOnce(columnRows());
    expect(await expoTenantSchemaAvailable(db)).toBe(false);
    db.execute
      .mockResolvedValueOnce(columnRows("id"))
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce(columnRows("id"));
    expectFailed(await ensureExpoTenantSchema(db, productionEnv));
    const callsAfterFailure = db.execute.mock.calls.length;
    expect(await expoTenantSchemaAvailable(db)).toBe(false);
    expect(db.execute).toHaveBeenCalledTimes(callsAfterFailure);
  });
});
