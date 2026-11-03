import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ultrasoundExpoEvents, ultrasoundExpoPackages } from "../drizzle/schema";
import { expoCombinedOfferSchemaAvailable, listCompatibleExpoPackages } from "./lib/expoEventSchemaCompatibility";
import { EXPO_COMBINED_GROUP_COLUMNS, EXPO_COMBINED_SCHEMA_ADDITIONS } from "./lib/expoCombinedOfferSchema";
import { ultrasoundExpoRouter } from "./routers/ultrasoundExpoRouter";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getUserRoles: vi.fn() }));
vi.mock("./db", () => mocks);
vi.mock("./lib/stripeClient", () => ({ getStripeClient: vi.fn(() => { throw new Error("Stripe must not be called"); }) }));
vi.mock("./lib/vendorPartnerAccess", () => ({ requireApprovedVendorApplication: vi.fn(() => { throw new Error("Partner checkout must not be called"); }) }));

type Row = Record<string, any>;
type Statement = { sql: string; params: unknown[] };
const tables = { ultrasound_expo_events: ultrasoundExpoEvents, ultrasound_expo_packages: ultrasoundExpoPackages };
type TableName = keyof typeof tables;
const input = {
  eventId: 1, packageType: "exhibitor" as const, name: "Edited exhibitor option",
  description: "Authored description", benefits: "Authored benefits", amountCents: 275000,
  currency: "usd", sortOrder: 4, isActive: true,
};
const caller = (role: string | null = "admin") => ultrasoundExpoRouter.createCaller({
  user: role ? { id: 7, role } : null, req: {}, res: {},
} as any);

/** Real Drizzle compiles and maps all statements against this strictly in-memory
 * mysql2 driver. No connection, database mutations, DDL, email or Stripe calls. */
function mockDatabase(options: {
  hasTenant?: boolean; hasCombined?: boolean; insertId?: number; writeError?: boolean; readError?: boolean;
} = {}) {
  const hasTenant = options.hasTenant ?? true;
  const hasCombined = options.hasCombined ?? true;
  const records: Record<TableName, Row[]> = { ultrasound_expo_events: [], ultrasound_expo_packages: [] };
  const statements: Statement[] = [];
  function seed(table: TableName, values: Row) {
    const row: Row = {};
    for (const [key, column] of Object.entries(getTableColumns(tables[table]))) {
      const value = values[key] ?? (key === "createdAt" || key === "updatedAt" ? new Date("2026-01-01T00:00:00Z") : null);
      row[column.name] = value === null ? null : column.mapToDriverValue(value);
    }
    if (table === "ultrasound_expo_events" && !hasTenant) delete row.tenant;
    if (table === "ultrasound_expo_packages" && !hasCombined) delete row.combined_with_package_id;
    records[table].push(row);
    return row;
  }
  const client = {
    query: vi.fn(async (query: { sql: string; rowsAsArray?: boolean }, params: unknown[] = []) => {
      const text = query.sql.trim();
      statements.push({ sql: text, params });
      if (text.includes("INFORMATION_SCHEMA.STATISTICS")) {
        const indexes = [{ TABLE_NAME: "ultrasound_expo_checkout_groups", INDEX_NAME: "PRIMARY", COLUMN_NAME: "id", SEQ_IN_INDEX: 1, NON_UNIQUE: 0 }, ...EXPO_COMBINED_SCHEMA_ADDITIONS.flatMap(addition => addition.kind === "index" ? addition.columns.map((column, index) => ({ TABLE_NAME: addition.table, INDEX_NAME: addition.index, COLUMN_NAME: column, SEQ_IN_INDEX: index + 1, NON_UNIQUE: addition.unique ? 0 : 1 })) : [])];
        return [hasCombined ? indexes : [], []];
      }
      if (text.includes("INFORMATION_SCHEMA.COLUMNS") && text.includes("DATA_TYPE")) {
        const columns = [...EXPO_COMBINED_GROUP_COLUMNS.map(([column, type, nullable]) => ({ TABLE_NAME: "ultrasound_expo_checkout_groups", COLUMN_NAME: column, DATA_TYPE: type, IS_NULLABLE: nullable })), ...EXPO_COMBINED_SCHEMA_ADDITIONS.flatMap(addition => addition.kind === "column" ? [{ TABLE_NAME: addition.table, COLUMN_NAME: addition.column, DATA_TYPE: "int", IS_NULLABLE: "YES" }] : [])];
        return [hasCombined ? columns : [], []];
      }
      if (text.includes("INFORMATION_SCHEMA.COLUMNS")) {
        const column = text.includes("combined_with_package_id") ? "combined_with_package_id" : "tenant";
        if (options.readError && column === "combined_with_package_id") throw new Error("Synthetic metadata failure: sensitive SQL and authored values");
        const exists = column === "tenant" ? hasTenant : hasCombined;
        return [exists ? [{ COLUMN_NAME: column }] : [], []];
      }
      if (/^select/i.test(text) && text.includes("from `ultrasound_expo_registrations`")) return [[], []];
      const table = text.match(/(?:from|update|insert into)\s+`?(\w+)`?/i)?.[1] as TableName;
      if (!(table in tables)) throw new Error("Unexpected SQL in offline package driver");
      if (table === "ultrasound_expo_events" && !hasTenant && /\btenant\b/.test(text)) {
        throw Object.assign(new Error("Synthetic missing tenant column"), { code: "ER_BAD_FIELD_ERROR" });
      }
      if (table === "ultrasound_expo_packages" && !hasCombined && /\bcombined_with_package_id\b/.test(text)) {
        throw Object.assign(new Error("Synthetic missing combined column"), { code: "ER_BAD_FIELD_ERROR" });
      }
      if (/^select/i.test(text)) {
        const projection = text.slice(6, text.toLowerCase().indexOf(" from ")).split(",").map(field => field.trim());
        const where = text.match(/\bwhere\s+(.+?)(?:\s+order by|\s+limit|$)/is)?.[1];
        const conditions = [...(where ?? "").matchAll(/(?:`\w+`\.)?`?(\w+)`?\s*=\s*\?/g)];
        let rows = records[table].filter(row => conditions.every((condition, index) => row[condition[1]] === params[index]));
        if (/\blimit 1\b/.test(text)) rows = rows.slice(0, 1);
        const valueAt = (row: Row, field: string) => {
          if (/^NULL$/i.test(field)) return null;
          const column = field.match(/^`\w+`\.`(\w+)`/)?.[1] ?? field.match(/^`?(\w+)`?/)?.[1];
          return row[column!] ?? null;
        };
        if (query.rowsAsArray) return [rows.map(row => projection.map(field => valueAt(row, field))), []];
        return [rows.map(row => Object.fromEntries(projection.map(field => {
          const alias = field.match(/\s+AS\s+(\w+)/i)?.[1] ?? field.match(/^`?(\w+)`?/)?.[1];
          return [alias!, valueAt(row, field)];
        }))), []];
      }
      if (/^(update|insert into)/i.test(text) && options.writeError) {
        throw Object.assign(new Error(`Synthetic sensitive SQL: ${text}; values: ${params.join(",")}`), { code: "ER_SYNTHETIC_FAILURE" });
      }
      if (/^update/i.test(text)) {
        const set = text.match(/\bset\s+(.+?)\s+where/is)![1];
        const columns = [...set.matchAll(/`(\w+)`\s*=\s*\?/g)].map(match => match[1]);
        const where = text.match(/\bwhere\s+(.+)/is)![1];
        const conditions = [...where.matchAll(/(?:`\w+`\.)?`?(\w+)`?\s*=\s*\?/g)];
        const rows = records[table].filter(row => conditions.every((condition, index) => row[condition[1]] === params[columns.length + index]));
        for (const row of rows) columns.forEach((column, index) => { row[column] = params[index]; });
        return [{ affectedRows: rows.length }, []];
      }
      if (/^insert into/i.test(text)) {
        const columns = text.match(/^insert into\s+`?\w+`?\s*\(([^)]+)\)/i)![1].split(",").map(column => column.trim().replaceAll("`", ""));
        const values = text.slice(text.toLowerCase().indexOf("values") + 6).match(/\(([^()]*)\)/)![1].split(",").map(value => value.trim());
        const id = Math.max(99, ...records[table].map(row => row.id)) + 1;
        const row: Row = { id };
        let parameterIndex = 0;
        columns.forEach((column, index) => { if (values[index] === "?") row[column] = params[parameterIndex++]; });
        if (hasCombined) row.combined_with_package_id ??= null;
        records[table].push(row);
        return [{ insertId: options.insertId ?? id, affectedRows: 1 }, []];
      }
      throw new Error("Unexpected SQL in offline package driver");
    }),
  };
  const db = drizzle({ client: client as any });
  mocks.getDb.mockResolvedValue(db);
  const event = { startsAt: new Date("2028-01-11T17:00:00Z"), endsAt: new Date("2028-01-13T19:00:00Z"), timezone: "America/New_York", status: "published" };
  seed("ultrasound_expo_events", { ...event, id: 1, tenant: "ultrasound_expo", name: "UltrasoundExpo 2028", slug: "ultrasoundexpo-2028" });
  seed("ultrasound_expo_events", { ...event, id: 2, tenant: "echo_expo", name: "EchoExpo 2028", slug: "echoexpo-2028" });
  seed("ultrasound_expo_events", { ...event, id: 3, tenant: "ultrasound_expo", name: "UltrasoundExpo 2029", slug: "ultrasoundexpo-2029" });
  seed("ultrasound_expo_packages", { ...input, id: 10, name: "Original option", combinedWithPackageId: 20 });
  seed("ultrasound_expo_packages", { ...input, id: 20, eventId: 2, name: "Echo companion", combinedWithPackageId: 10 });
  seed("ultrasound_expo_packages", { ...input, id: 30, eventId: 3, name: "Other annual option", combinedWithPackageId: null });
  return {
    db, client, statements, seed, rows: (table: TableName) => records[table],
    snapshot: () => structuredClone(records),
    writes: () => statements.filter(statement => /^(insert into|update|delete)/i.test(statement.sql)),
  };
}

beforeEach(() => { vi.clearAllMocks(); mocks.getUserRoles.mockResolvedValue([]); });

describe("Legacy Expo package management compatibility", () => {
  it("reproduces Drizzle including the absent pairing column even when its input is omitted", async () => {
    const mock = mockDatabase({ hasCombined: false });
    await expect(mock.db.insert(ultrasoundExpoPackages).values(input).$returningId())
      .rejects.toMatchObject({ cause: { code: "ER_BAD_FIELD_ERROR" } });
    expect(mock.writes()[0].sql).toContain("`combined_with_package_id`");
  });
  it.each([undefined, null])("edits a plain option without the missing pairing column for input %s", async combinedWithPackageId => {
    const mock = mockDatabase({ hasTenant: false, hasCombined: false });
    const other = structuredClone(mock.rows("ultrasound_expo_packages").slice(1));
    expect(await caller().savePackage({ ...input, id: 10, combinedWithPackageId })).toEqual({ id: 10, updated: true });
    expect(mock.rows("ultrasound_expo_packages")[0]).toMatchObject({ id: 10, event_id: 1, name: input.name, description: input.description, benefits: input.benefits, amount_cents: input.amountCents });
    expect(mock.rows("ultrasound_expo_packages")[0]).not.toHaveProperty("combined_with_package_id");
    expect(mock.rows("ultrasound_expo_packages").slice(1)).toEqual(other);
    expect(mock.writes()).toHaveLength(1);
    expect(mock.writes()[0].sql).not.toContain("combined_with_package_id");
    expect(mock.writes()[0].sql).toMatch(/where \(`ultrasound_expo_packages`\.`id` = \? and `ultrasound_expo_packages`\.`event_id` = \?\)/);
    expect(mock.writes()[0].params.slice(-2)).toEqual([10, 1]);
    expect(mock.writes()[0].sql).not.toMatch(/set[^]*`event_id` = \?[^]*where/);
  });
  it.each([undefined, null])("adds a plain option using only established columns for input %s", async combinedWithPackageId => {
    const mock = mockDatabase({ hasTenant: false, hasCombined: false });
    expect(await caller().savePackage({ ...input, combinedWithPackageId, isActive: false })).toEqual({ id: 100, updated: false });
    expect(mock.rows("ultrasound_expo_packages").at(-1)).toMatchObject({ id: 100, event_id: 1, package_type: "exhibitor", name: input.name, amount_cents: input.amountCents, is_active: false });
    expect(mock.rows("ultrasound_expo_packages").at(-1)).not.toHaveProperty("combined_with_package_id");
    expect(mock.writes()).toHaveLength(1);
    expect(mock.writes()[0].sql).not.toContain("combined_with_package_id");
    expect(mock.writes()[0].params).toEqual([1, "exhibitor", input.name, input.description, input.benefits, input.amountCents, "usd", 4, false]);
  });
  it.each([undefined, 10])("rejects a selected companion before any legacy insert/update for package %s", async id => {
    const mock = mockDatabase({ hasCombined: false });
    const before = mock.snapshot();
    await expect(caller().savePackage({ ...input, id, combinedWithPackageId: 20 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED", message: expect.stringContaining("ultrasound_expo_packages.combined_with_package_id"),
    });
    expect(mock.snapshot()).toEqual(before);
    expect(mock.writes()).toEqual([]);
  });
  it("parameterizes authored option text on the legacy insert", async () => {
    const mock = mockDatabase({ hasCombined: false });
    const name = "Quoted ' name; DROP TABLE options; --";
    await caller().savePackage({ ...input, name });
    expect(mock.writes()[0].sql).not.toContain(name);
    expect(mock.writes()[0].params).toContain(name);
  });
});

describe("Package event scope and pairing semantics", () => {
  it.each([false, true])("rejects missing parent events before edits or additions when migrated = %s", async hasCombined => {
    const mock = mockDatabase({ hasCombined });
    const before = mock.snapshot();
    for (const id of [undefined, 10]) await expect(caller().savePackage({ ...input, eventId: 999, id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.snapshot()).toEqual(before);
    expect(mock.writes()).toEqual([]);
  });
  it.each([2, 3])("rejects the exact package/event scope mismatch for event %s without moving any option", async eventId => {
    const mock = mockDatabase();
    const before = mock.snapshot();
    await expect(caller().savePackage({ ...input, id: 10, eventId })).rejects.toMatchObject({ code: "NOT_FOUND", message: expect.stringContaining("cannot be moved") });
    expect(mock.snapshot()).toEqual(before);
    expect(mock.writes()).toEqual([]);
  });
  it("rejects an unknown package ID before writing", async () => {
    const mock = mockDatabase();
    await expect(caller().savePackage({ ...input, id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.writes()).toEqual([]);
  });
  it("preserves an existing pairing when omitted while editing price and copy", async () => {
    const mock = mockDatabase();
    const other = structuredClone(mock.rows("ultrasound_expo_packages").slice(1));
    await caller().savePackage({ ...input, id: 10, amountCents: 300000 });
    expect(mock.rows("ultrasound_expo_packages")[0]).toMatchObject({ combined_with_package_id: 20, amount_cents: 300000, name: input.name, event_id: 1 });
    expect(mock.rows("ultrasound_expo_packages").slice(1)).toEqual(other);
    expect(mock.writes()[0].sql).not.toContain("combined_with_package_id");
    expect(mock.writes()[0].params.slice(-2)).toEqual([10, 1]);
  });
  it("clears only the selected option pairing when explicit null is provided", async () => {
    const mock = mockDatabase();
    const companion = structuredClone(mock.rows("ultrasound_expo_packages")[1]);
    await caller().savePackage({ ...input, id: 10, combinedWithPackageId: null });
    expect(mock.rows("ultrasound_expo_packages")[0].combined_with_package_id).toBeNull();
    expect(mock.rows("ultrasound_expo_packages")[1]).toEqual(companion);
    expect(mock.writes()[0].sql).toContain("`combined_with_package_id` = ?");
  });
  it.each([undefined, 10])("saves an explicitly validated opposite-tenant companion for package %s", async id => {
    const mock = mockDatabase();
    const result = await caller().savePackage({ ...input, id, combinedWithPackageId: 20 });
    expect(result).toEqual({ id: id ?? 100, updated: Boolean(id) });
    expect(mock.rows("ultrasound_expo_packages").find(row => row.id === result.id)).toMatchObject({ event_id: 1, combined_with_package_id: 20 });
  });
  it("adds an unpaired option with the migrated nullable default", async () => {
    const mock = mockDatabase();
    expect(await caller().savePackage(input)).toEqual({ id: 100, updated: false });
    expect(mock.rows("ultrasound_expo_packages").at(-1)?.combined_with_package_id).toBeNull();
  });
  it.each(["same-event", "same-tenant", "type", "currency", "missing-event", "missing-companion", "self"])("rejects invalid companion %s without writes", async mismatch => {
    const mock = mockDatabase();
    const companion = mock.rows("ultrasound_expo_packages")[1];
    if (mismatch === "same-event") companion.event_id = 1;
    if (mismatch === "same-tenant") companion.event_id = 3;
    if (mismatch === "type") companion.package_type = "sponsor";
    if (mismatch === "currency") companion.currency = "eur";
    if (mismatch === "missing-event") companion.event_id = 999;
    const before = mock.snapshot();
    const combinedWithPackageId = mismatch === "missing-companion" ? 999 : mismatch === "self" ? 10 : 20;
    await expect(caller().savePackage({ ...input, id: 10, combinedWithPackageId })).rejects.toMatchObject({ code: mismatch === "missing-companion" ? "NOT_FOUND" : "BAD_REQUEST" });
    expect(mock.snapshot()).toEqual(before);
    expect(mock.writes()).toEqual([]);
  });
  it("uses safe legacy tenant attribution rather than selecting an unknown tenant column", async () => {
    const mock = mockDatabase({ hasTenant: false });
    await expect(caller().savePackage({ ...input, id: 10, combinedWithPackageId: 20 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.statements.filter(statement => !statement.sql.includes("INFORMATION_SCHEMA")).every(statement => !/\btenant\b/.test(statement.sql))).toBe(true);
    expect(mock.writes()).toEqual([]);
  });
});

describe("Package save result, errors and read-only snapshot contract", () => {
  it.each([false, true])("rejects a missing inserted ID instead of false success on migrated = %s", async hasCombined => {
    const mock = mockDatabase({ hasCombined, insertId: 0 });
    await expect(caller().savePackage(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("did not return an ID") });
    expect(mock.writes()).toHaveLength(1);
  });
  it.each([undefined, 10])("returns safe write errors without leaking SQL/authored values for package %s", async id => {
    const mock = mockDatabase({ hasCombined: false, writeError: true });
    const before = mock.snapshot();
    await expect(caller().savePackage({ ...input, id })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.not.stringMatching(/Authored|Edited exhibitor|insert into|update `|ER_SYNTHETIC/) });
    expect(mock.snapshot()).toEqual(before);
  });
  it("returns a safe metadata inspection error without any write", async () => {
    const mock = mockDatabase({ readError: true });
    await expect(caller().savePackage(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.not.stringContaining("sensitive") });
    expect(mock.writes()).toEqual([]);
  });
  it.each([false, true])("exports the read-only schema helper and compatible list when migrated = %s", async hasCombined => {
    const mock = mockDatabase({ hasCombined });
    expect(await expoCombinedOfferSchemaAvailable(mock.db)).toBe(hasCombined);
    const packages = await listCompatibleExpoPackages(mock.db);
    expect(packages[0]).toMatchObject({ id: 10, combinedWithPackageId: hasCombined ? 20 : null });
    expect(mock.writes()).toEqual([]);
    expect(mock.statements.some(statement => /^(alter|create|drop)/i.test(statement.sql))).toBe(false);
  });
  it.each([false, true])("includes combinedOfferSchemaAvailable in the read-only admin snapshot on migrated = %s", async hasCombined => {
    const mock = mockDatabase({ hasCombined });
    const snapshot = await caller().adminSnapshot();
    expect(snapshot.combinedOfferSchemaAvailable).toBe(hasCombined);
    expect(snapshot.packages[0].combinedWithPackageId).toBe(hasCombined ? 20 : null);
    expect(snapshot.tenantSchemaAvailable).toBe(true);
    expect(mock.writes()).toEqual([]);
  });
  it.each(["user", null])("blocks unauthorized package saves before database access for role %s", async role => {
    const mock = mockDatabase();
    await expect(caller(role).savePackage(input)).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mock.client.query).not.toHaveBeenCalled();
  });
});
