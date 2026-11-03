import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  ultrasoundExpoAgendaItems,
  ultrasoundExpoBooths,
  ultrasoundExpoBoothRequests,
  ultrasoundExpoEvents,
  ultrasoundExpoEventPages,
  ultrasoundExpoPackages,
  ultrasoundExpoPartnerResources,
  ultrasoundExpoRecordings,
  ultrasoundExpoRegistrations,
  vendorPartnerApplications,
} from "../drizzle/schema";
import { parseScheduledTimestamp } from "../shared/platformTime";
import { ultrasoundExpoRouter } from "./routers/ultrasoundExpoRouter";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getUserRoles: vi.fn() }));
vi.mock("./db", () => mocks);
vi.mock("./lib/stripeClient", () => ({ getStripeClient: vi.fn(() => { throw new Error("Stripe must not be called"); }) }));
vi.mock("./lib/vendorPartnerAccess", () => ({ requireApprovedVendorApplication: vi.fn(() => { throw new Error("Partner checkout must not be called"); }) }));

const eventInput = {
  name: "UltrasoundExpo™ 2028",
  slug: "ultrasoundexpo-2028",
  startsAt: new Date("2028-01-11T17:00:00.000Z"),
  endsAt: new Date("2028-01-13T19:00:00.000Z"),
  timezone: "America/New_York",
  locationLabel: "Orlando, Florida",
  description: "  Authored overview\n",
  heroImageUrl: "/manus-storage/echoexpo-hero-approved_2a95e8a5.png",
  registrationTerms: "  Authored terms\n",
  attendeeInstructions: "  Attendee copy\n",
  partnerInstructions: "  Partner copy\n",
  status: "published" as const,
};
const duplicateInput = {
  sourceEventId: 1, name: "Expo 2029", slug: "expo-2029",
  startsAt: new Date("2029-01-11T17:00:00.000Z"),
  endsAt: new Date("2029-01-13T19:00:00.000Z"),
};
const caller = (role: string | null = "admin", suspendedAt: Date | null = null) => ultrasoundExpoRouter.createCaller({
  user: role ? { id: 7, role, suspendedAt } : null, req: {}, res: {},
} as any);

type Row = Record<string, any>;
type Statement = { sql: string; params: unknown[] };
const tables = {
  ultrasound_expo_events: ultrasoundExpoEvents,
  ultrasound_expo_packages: ultrasoundExpoPackages,
  ultrasound_expo_agenda_items: ultrasoundExpoAgendaItems,
  ultrasound_expo_event_pages: ultrasoundExpoEventPages,
  ultrasound_expo_recordings: ultrasoundExpoRecordings,
  ultrasound_expo_partner_resources: ultrasoundExpoPartnerResources,
  ultrasound_expo_booths: ultrasoundExpoBooths,
  ultrasound_expo_booth_requests: ultrasoundExpoBoothRequests,
  ultrasound_expo_registrations: ultrasoundExpoRegistrations,
  vendor_partner_applications: vendorPartnerApplications,
};
type TableName = keyof typeof tables;

/** Real Drizzle serializes/maps every endpoint query, but this driver is entirely
 * in memory: no connections, DB writes, DDL, Stripe, uploads or test records. */
function mockDatabase(options: {
  hasTenant?: boolean; hasCombined?: boolean; failInsertTable?: TableName;
  updateError?: string; missingInsertId?: boolean;
} = {}) {
  const hasTenant = options.hasTenant ?? true;
  const hasCombined = options.hasCombined ?? true;
  let records = Object.fromEntries(Object.keys(tables).map(name => [name, []])) as Record<TableName, Row[]>;
  let transactionSnapshot: typeof records | undefined;
  const statements: Statement[] = [];
  function seed(table: TableName, values: Row) {
    const columns = getTableColumns(tables[table]);
    const row: Row = {};
    for (const [key, column] of Object.entries(columns)) {
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
      if (/^begin$/i.test(text)) {
        transactionSnapshot = structuredClone(records);
        return [{}, []];
      }
      if (/^commit$/i.test(text)) { transactionSnapshot = undefined; return [{}, []]; }
      if (/^rollback$/i.test(text)) {
        if (transactionSnapshot) records = transactionSnapshot;
        transactionSnapshot = undefined;
        return [{}, []];
      }
      if (text.includes("INFORMATION_SCHEMA.COLUMNS")) {
        const column = text.includes("combined_with_package_id") ? "combined_with_package_id" : "tenant";
        const exists = column === "tenant" ? hasTenant : hasCombined;
        return [exists ? [{ COLUMN_NAME: column }] : [], []];
      }
      const tableMatch = text.match(/(?:from|update|insert into)\s+`?(\w+)`?/i);
      const table = tableMatch?.[1] as TableName;
      if (!(table in tables)) throw new Error("Unexpected table in offline driver");
      if ((!hasTenant && /`tenant`/.test(text)) || (!hasCombined && /`combined_with_package_id`/.test(text))) {
        throw Object.assign(new Error("Synthetic missing column"), { code: "ER_BAD_FIELD_ERROR" });
      }
      if (/^select/i.test(text)) {
        const projection = text.slice(6, text.toLowerCase().indexOf(" from ")).split(",").map(value => value.trim());
        const where = text.match(/\bwhere\s+(.+?)(?:\s+order by|\s+limit|$)/is)?.[1];
        let rows = records[table];
        if (where) {
          const conditions = [...where.matchAll(/(?:`\w+`\.)?`?(\w+)`?\s*=\s*\?/g)];
          rows = rows.filter(row => conditions.every((condition, i) => row[condition[1]] === params[i]));
        }
        if (text.includes("limit 1") && !text.includes("limit 1000")) rows = rows.slice(0, 1);
        const valueAt = (row: Row, field: string) => {
          if (/^NULL$/i.test(field)) return null;
          const qualified = field.match(/^`(\w+)`\.`(\w+)`/);
          const column = qualified?.[2] ?? field.match(/^`?(\w+)`?/)?.[1];
          if (qualified?.[1] === "ultrasound_expo_packages" && table === "ultrasound_expo_registrations") {
            return records.ultrasound_expo_packages.find(pkg => pkg.id === row.package_id)?.[column!] ?? null;
          }
          if (qualified?.[1] === "vendor_partner_applications") {
            return records.vendor_partner_applications.find(application => application.id === row.vendor_application_id)?.[column!] ?? null;
          }
          return row[column!] ?? null;
        };
        if (query.rowsAsArray) return [rows.map(row => projection.map(field => valueAt(row, field))), []];
        return [rows.map(row => Object.fromEntries(projection.map(field => {
          const alias = field.match(/\s+AS\s+(\w+)/i)?.[1] ?? field.match(/^`?(\w+)`?/)?.[1];
          return [alias!, valueAt(row, field)];
        }))), []];
      }
      if (/^update/i.test(text)) {
        if (options.updateError) throw Object.assign(new Error("Synthetic update failure"), { code: options.updateError });
        const set = text.match(/\bset\s+(.+?)\s+where/is)![1];
        const columns = [...set.matchAll(/`(\w+)`\s*=\s*\?/g)].map(match => match[1]);
        const id = params[columns.length];
        const row = records[table].find(item => item.id === id);
        if (row && (!text.includes('`status` = ?') || params.length === columns.length + 1 || row.status === params[columns.length + 1])) {
          columns.forEach((column, index) => { row[column] = params[index]; });
        }
        return [{ affectedRows: row ? 1 : 0 }, []];
      }
      if (/^insert into/i.test(text)) {
        if (options.failInsertTable === table) throw new Error("Synthetic copy failure");
        const columns = text.match(/^insert into\s+`?\w+`?\s*\(([^)]+)\)/i)![1].split(",").map(column => column.trim().replaceAll("`", ""));
        const groups = [...text.slice(text.toLowerCase().indexOf("values") + 6).matchAll(/\(([^()]*)\)/g)];
        const nextId = Math.max(99, ...records[table].map(row => row.id)) + 1;
        let parameterIndex = 0;
        for (const [index, group] of groups.entries()) {
          const values = group[1].split(",").map(value => value.trim());
          const row: Row = { id: nextId + index };
          columns.forEach((column, i) => { if (values[i] === "?") row[column] = params[parameterIndex++]; });
          if (table === "ultrasound_expo_events") {
            if (!hasTenant) delete row.tenant;
            else row.tenant ??= "ultrasound_expo";
          }
          if (table === "ultrasound_expo_packages" && hasCombined) row.combined_with_package_id ??= null;
          if (table === "ultrasound_expo_events" && records[table].some(existing => existing.slug === row.slug)) {
            throw Object.assign(new Error("Synthetic duplicate slug"), { code: "ER_DUP_ENTRY" });
          }
          records[table].push(row);
        }
        return [{ insertId: options.missingInsertId ? 0 : nextId, affectedRows: groups.length }, []];
      }
      throw new Error("Unexpected SQL in offline driver");
    }),
  };
  const db = drizzle({ client: client as any });
  mocks.getDb.mockResolvedValue(db);
  seed("ultrasound_expo_events", { id: 1, tenant: "ultrasound_expo", ...eventInput });
  seed("ultrasound_expo_events", { id: 2, tenant: "echo_expo", ...eventInput, name: "EchoExpo™ 2028", slug: "echoexpo-2028" });
  seed("ultrasound_expo_packages", { id: 10, eventId: 1, packageType: "exhibitor", name: "Original exhibitor", description: "Package copy", benefits: "Authored benefits", amountCents: 250000, currency: "usd", sortOrder: 3, isActive: true, combinedWithPackageId: 20 });
  seed("ultrasound_expo_packages", { id: 20, eventId: 2, packageType: "exhibitor", name: "Other event exhibitor", amountCents: 200000, currency: "usd", sortOrder: 0, isActive: true, combinedWithPackageId: 10 });
  seed("ultrasound_expo_agenda_items", { id: 30, eventId: 1, title: "Opening reception", description: "Session copy", startsAt: new Date("2028-01-11T22:00:00.000Z"), endsAt: new Date("2028-01-12T00:00:00.000Z"), locationLabel: "Reception room", speakerNames: "Presenter", category: "Networking", status: "published", sortOrder: 1 });
  seed("ultrasound_expo_agenda_items", { id: 31, eventId: 1, title: "Next-day session", startsAt: new Date("2028-01-12T18:00:00.000Z"), endsAt: null, locationLabel: "Room B", status: "draft", sortOrder: 2 });
  seed("ultrasound_expo_event_pages", { id: 40, eventId: 1, title: "Private program", slug: "program", pageType: "schedule", accessLevel: "partners", blocksJson: '{"text":"Authored blocks"}', status: "published", seoTitle: "Original SEO", seoDescription: "SEO description", seoKeywords: "ultrasound", seoImage: "/manus-storage/seo.png", createdByUserId: 4, updatedByUserId: 4 });
  seed("ultrasound_expo_recordings", { id: 50, eventId: 1, title: "Recording", description: "Recording copy", videoUrl: "https://example.com/old-video.mp4", thumbnailUrl: "https://example.com/thumb.png", durationSeconds: 1800, status: "published", sortOrder: 4 });
  seed("ultrasound_expo_partner_resources", { id: 60, eventId: 1, resourceType: "floor_plan", title: "Floor plan", description: "Resource copy", resourceUrl: "https://example.com/floor.pdf", isPublished: true, sortOrder: 2 });
  seed("ultrasound_expo_partner_resources", { id: 61, eventId: 1, resourceType: "document", title: "Unpublished internal resource", isPublished: false, sortOrder: 3 });
  seed("ultrasound_expo_booths", { id: 70, eventId: 1, boothCode: "A1", zoneLabel: "Main hall", dimensions: "10x10", description: "Booth copy", mapReference: "map-a1", availabilityStatus: "sold", sortOrder: 4 });
  seed("ultrasound_expo_booth_requests", { id: 71, eventId: 1, boothId: 70, vendorApplicationId: 80, status: "confirmed", adminNote: "Approval remains original" });
  seed("vendor_partner_applications", { id: 80, partnerTypes: '["vendor","exhibitor","unknown"]', status: "approved", linkedUserId: 8 });
  seed("ultrasound_expo_registrations", { id: 90, eventId: 1, packageId: 10, vendorApplicationId: 80, userId: 8, attendeeName: "Existing partner", attendeeEmail: "partner@example.test", amountCents: 250000, currency: "usd", paymentStatus: "paid", status: "confirmed", stripeSessionId: "cs_original", ticketCode: "original-ticket" });
  seed("ultrasound_expo_registrations", { id: 91, eventId: 2, packageId: 20, attendeeName: "Existing other partner", attendeeEmail: "other@example.test", amountCents: 200000, currency: "usd", paymentStatus: "pending", status: "pending" });
  return {
    db, client, statements, seed,
    rows: (table: TableName) => records[table],
    snapshot: () => structuredClone(records),
    writes: () => statements.filter(statement => /^(insert into|update|delete)/i.test(statement.sql)),
  };
}

beforeEach(() => { vi.clearAllMocks(); mocks.getUserRoles.mockResolvedValue([]); });

describe("Expo management admin boundary", () => {
  const calls = [
    ["createEvent", eventInput], ["updateEvent", { id: 1, ...eventInput }],
    ["duplicateEvent", duplicateInput], ["deleteEvent", { id: 1, confirmName: eventInput.name }],
    ["restoreEvent", { id: 1 }], ["adminSnapshot", undefined],
  ] as const;
  it.each(calls)("blocks non-admin %s before database access", async (method, input) => {
    const mock = mockDatabase();
    await expect((caller("user")[method] as any)(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mock.client.query).not.toHaveBeenCalled();
  });
  it.each(calls)("requires authentication for %s", async (method, input) => {
    mockDatabase();
    await expect((caller(null)[method] as any)(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getUserRoles).not.toHaveBeenCalled();
  });
  it("permits platform-admin editing and blocks suspended users", async () => {
    mockDatabase();
    mocks.getUserRoles.mockResolvedValue(["platform_admin"]);
    expect(await caller("user").updateEvent({ id: 1, ...eventInput })).toEqual({ success: true });
    await expect(caller("user", new Date()).deleteEvent({ id: 1, confirmName: eventInput.name })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Expo category and details editing", () => {
  it.each(["ultrasound_expo", "echo_expo"] as const)("updates only the selected ID to category %s and preserves attached records", async tenant => {
    const mock = mockDatabase();
    const before = mock.snapshot();
    expect(await caller().updateEvent({ id: 1, ...eventInput, tenant, name: "Renamed event", slug: "renamed-event" })).toEqual({ success: true });
    expect(mock.rows("ultrasound_expo_events")[0]).toMatchObject({ id: 1, tenant, name: "Renamed event", slug: "renamed-event", description: eventInput.description, registration_terms: eventInput.registrationTerms });
    const after = mock.snapshot();
    expect(after.ultrasound_expo_events[1]).toEqual(before.ultrasound_expo_events[1]);
    delete (before as Partial<typeof before>).ultrasound_expo_events;
    delete (after as Partial<typeof after>).ultrasound_expo_events;
    expect(after).toEqual(before);
    expect(mock.writes()).toHaveLength(1);
    expect(mock.writes()[0].params.at(-1)).toBe(1);
  });
  it("retains Echo category, end date and copy when optional fields are omitted", async () => {
    const mock = mockDatabase();
    const { endsAt, description, registrationTerms, attendeeInstructions, partnerInstructions, locationLabel, heroImageUrl, ...required } = eventInput;
    await caller().updateEvent({ id: 2, ...required, name: "Edited Echo", slug: "edited-echo" });
    expect(mock.rows("ultrasound_expo_events")[1]).toMatchObject({ tenant: "echo_expo", ends_at: "2028-01-13 19:00:00.000", description, registration_terms: registrationTerms, attendee_instructions: attendeeInstructions, partner_instructions: partnerInstructions, location_label: locationLabel, hero_image_url: heroImageUrl });
    expect(mock.writes()[0].sql).not.toContain("`tenant`");
  });
  it("clears explicitly blank copy and null end without clearing other optional fields", async () => {
    const mock = mockDatabase();
    await caller().updateEvent({ id: 1, ...eventInput, endsAt: null, description: "", registrationTerms: "", attendeeInstructions: "", partnerInstructions: "", heroImageUrl: "", locationLabel: "" });
    expect(mock.rows("ultrasound_expo_events")[0]).toMatchObject({ ends_at: null, description: null, registration_terms: null, attendee_instructions: null, partner_instructions: null, hero_image_url: null, location_label: null });
  });
  it("rejects nonexistent event editing without a write", async () => {
    const mock = mockDatabase();
    await expect(caller().updateEvent({ id: 999, ...eventInput })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.writes()).toEqual([]);
  });
  it("does not silently save an Echo reclassification against the legacy tenant schema", async () => {
    const mock = mockDatabase({ hasTenant: false });
    const before = mock.snapshot();
    await expect(caller().updateEvent({ id: 1, ...eventInput, tenant: "echo_expo" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("cannot be saved as UltrasoundExpo") });
    expect(mock.snapshot()).toEqual(before);
    expect(mock.writes()).toEqual([]);
  });
  it("still edits established UltrasoundExpo fields without writing a missing tenant column", async () => {
    const mock = mockDatabase({ hasTenant: false });
    await caller().updateEvent({ id: 1, ...eventInput, tenant: "ultrasound_expo" });
    expect(mock.writes()).toHaveLength(1);
    expect(mock.writes()[0].sql).not.toContain("`tenant`");
  });
  it.each(["ER_DUP_ENTRY", "ER_BAD_FIELD_ERROR"])("returns safe update failure for %s without leaking authored values", async updateError => {
    const mock = mockDatabase({ updateError });
    await expect(caller().updateEvent({ id: 1, ...eventInput })).rejects.toMatchObject({ code: updateError === "ER_DUP_ENTRY" ? "CONFLICT" : "INTERNAL_SERVER_ERROR", message: expect.not.stringContaining(eventInput.description) });
    expect(mock.rows("ultrasound_expo_events")[0].name).toBe(eventInput.name);
  });
});

describe("Expo date and image validation before writes", () => {
  it.each(["createEvent", "updateEvent", "duplicateEvent"] as const)("rejects reversed dates and invalid timezone for %s", async method => {
    const mock = mockDatabase();
    const input = method === "duplicateEvent" ? duplicateInput : { ...eventInput, id: 1 };
    await expect((caller()[method] as any)({ ...input, endsAt: new Date("2020-01-01T00:00:00Z") })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect((caller()[method] as any)({ ...input, timezone: "Invalid/Timezone" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect((caller()[method] as any)({ ...input, startsAt: new Date(NaN) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.writes()).toEqual([]);
  });
  it("validates an omitted end against the existing end", async () => {
    const mock = mockDatabase();
    const { endsAt, ...input } = eventInput;
    await expect(caller().updateEvent({ id: 1, ...input, startsAt: new Date("2030-01-01T00:00:00Z") })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.writes()).toEqual([]);
  });
  it("allows equal start/end instants", async () => {
    const mock = mockDatabase();
    await caller().updateEvent({ id: 1, ...eventInput, endsAt: eventInput.startsAt });
    expect(mock.rows("ultrasound_expo_events")[0].ends_at).toBe("2028-01-11 17:00:00.000");
  });
  it.each(["/manus-storage/echoexpo-hero-approved_2a95e8a5.png", "https://example.com/hero.png", "http://example.com/hero.png", ""])("accepts safe event image %s", async heroImageUrl => {
    const mock = mockDatabase();
    expect(await caller().createEvent({ ...eventInput, slug: "new-image-event", heroImageUrl })).toEqual({ id: 100 });
    expect(mock.rows("ultrasound_expo_events").at(-1)?.hero_image_url).toBe(heroImageUrl || null);
  });
  it.each(["javascript:alert(1)", "data:image/svg+xml,evil", "ftp://example.com/image.png", "//evil.test/image.png", "/manus-storage/../evil.png", "/manus-storage/%2e%2e/evil.png"])("rejects unsafe event image %s", async heroImageUrl => {
    const mock = mockDatabase();
    await expect(caller().updateEvent({ id: 1, ...eventInput, heroImageUrl })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.client.query).not.toHaveBeenCalled();
  });
});

describe("Expo duplication with attached content, not attendee identities", () => {
  it.each([false, true])("copies safe shells and clears stale pairing when combined column exists = %s", async hasCombined => {
    const mock = mockDatabase({ hasCombined });
    const before = mock.snapshot();
    expect(await caller().duplicateEvent(duplicateInput)).toEqual({ id: 100, copiedPackages: 1, copiedAgendaItems: 2, copiedPages: 1, copiedRecordingShells: 1, copiedPartnerResources: 1, copiedBooths: 1 });
    expect(mock.rows("ultrasound_expo_events").at(-1)).toMatchObject({ id: 100, tenant: "ultrasound_expo", status: "draft", timezone: "America/New_York", description: eventInput.description, registration_terms: eventInput.registrationTerms, attendee_instructions: eventInput.attendeeInstructions, partner_instructions: eventInput.partnerInstructions, hero_image_url: eventInput.heroImageUrl });
    const copiedPackage = mock.rows("ultrasound_expo_packages").at(-1)!;
    expect(copiedPackage).toMatchObject({ event_id: 100, package_type: "exhibitor", amount_cents: 250000, is_active: false, benefits: "Authored benefits" });
    if (hasCombined) expect(copiedPackage.combined_with_package_id).toBeNull();
    else expect(copiedPackage).not.toHaveProperty("combined_with_package_id");
    expect(mock.writes().find(statement => statement.sql.includes("INSERT INTO ultrasound_expo_packages"))?.sql).not.toContain("combined_with_package_id");
    const agenda = mock.rows("ultrasound_expo_agenda_items").filter(row => row.event_id === 100);
    expect(agenda[0]).toMatchObject({ starts_at: "2029-01-11 22:00:00.000", ends_at: "2029-01-12 00:00:00.000", location_label: "Reception room", status: "draft" });
    expect(agenda[1]).toMatchObject({ starts_at: "2029-01-12 18:00:00.000", ends_at: null, location_label: "Room B", status: "draft" });
    expect(mock.rows("ultrasound_expo_event_pages").at(-1)).toMatchObject({ event_id: 100, status: "draft", access_level: "partners", blocks_json: '{"text":"Authored blocks"}', seo_title: "Original SEO", created_by_user_id: 7, updated_by_user_id: 7 });
    expect(mock.rows("ultrasound_expo_recordings").at(-1)).toMatchObject({ event_id: 100, status: "draft", video_url: null, thumbnail_url: "https://example.com/thumb.png" });
    expect(mock.rows("ultrasound_expo_partner_resources").at(-1)).toMatchObject({ event_id: 100, is_published: false, resource_url: "https://example.com/floor.pdf" });
    expect(mock.rows("ultrasound_expo_booths").at(-1)).toMatchObject({ event_id: 100, booth_code: "A1", availability_status: "available", dimensions: "10x10", map_reference: "map-a1" });
    for (const table of Object.keys(tables) as TableName[]) {
      expect(mock.rows(table).slice(0, before[table].length)).toEqual(before[table]);
    }
    for (const table of ["ultrasound_expo_registrations", "ultrasound_expo_booth_requests", "vendor_partner_applications"] as const) expect(mock.rows(table)).toEqual(before[table]);
    expect(mock.statements.at(-1)?.sql).toBe("commit");
    expect(mock.writes().some(statement => /^update|^delete/i.test(statement.sql))).toBe(false);
  });
  it("defaults to an Echo source category without changing the source", async () => {
    const mock = mockDatabase();
    const source = structuredClone(mock.rows("ultrasound_expo_events")[1]);
    await caller().duplicateEvent({ ...duplicateInput, sourceEventId: 2 });
    expect(mock.rows("ultrasound_expo_events").at(-1)?.tenant).toBe("echo_expo");
    expect(mock.rows("ultrasound_expo_events")[1]).toEqual(source);
  });
  it("allows category override and chosen timezone while storing UI-provided UTC instants unchanged", async () => {
    const mock = mockDatabase();
    const startsAt = parseScheduledTimestamp("2029-01-11T12:00", "America/Los_Angeles");
    const endsAt = parseScheduledTimestamp("2029-01-13T14:00", "America/Los_Angeles");
    await caller().duplicateEvent({ ...duplicateInput, tenant: "echo_expo", timezone: "America/Los_Angeles", startsAt, endsAt });
    expect(mock.rows("ultrasound_expo_events").at(-1)).toMatchObject({ tenant: "echo_expo", timezone: "America/Los_Angeles", starts_at: "2029-01-11 20:00:00.000", ends_at: "2029-01-13 22:00:00.000" });
    expect(mock.rows("ultrasound_expo_events")[0].tenant).toBe("ultrasound_expo");
    expect(mock.rows("ultrasound_expo_agenda_items").find(row => row.event_id === 100)?.starts_at).toBe("2029-01-12 01:00:00.000");
  });
  it("supports legacy tenant and combined schemas together without unsafe inserts", async () => {
    const mock = mockDatabase({ hasTenant: false, hasCombined: false });
    expect((await caller().duplicateEvent(duplicateInput)).id).toBe(100);
    expect(mock.writes()[0].sql).not.toMatch(/\btenant\b/);
    expect(mock.rows("ultrasound_expo_events")).toHaveLength(3);
  });
  it("blocks explicit Echo duplication on a legacy tenant schema and rolls back", async () => {
    const mock = mockDatabase({ hasTenant: false });
    const before = mock.snapshot();
    await expect(caller().duplicateEvent({ ...duplicateInput, tenant: "echo_expo" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mock.snapshot()).toEqual(before);
    expect(mock.writes()).toEqual([]);
    expect(mock.statements.at(-1)?.sql).toBe("rollback");
  });
  it("rejects missing source before writing", async () => {
    const mock = mockDatabase();
    await expect(caller().duplicateEvent({ ...duplicateInput, sourceEventId: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.writes()).toEqual([]);
  });
  it("rejects malformed copied agenda dates before any writes", async () => {
    const mock = mockDatabase();
    mock.rows("ultrasound_expo_agenda_items")[0].ends_at = "2028-01-10 00:00:00.000";
    await expect(caller().duplicateEvent(duplicateInput)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.writes()).toEqual([]);
  });
  it("rolls back every copied row on attached-content failure", async () => {
    const mock = mockDatabase({ failInsertTable: "ultrasound_expo_event_pages" });
    const before = mock.snapshot();
    await expect(caller().duplicateEvent(duplicateInput)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("No duplicate was saved") });
    expect(mock.snapshot()).toEqual(before);
    expect(mock.statements.at(-1)?.sql).toBe("rollback");
  });
  it("returns safe slug conflict on repeat duplication without creating an additional instance", async () => {
    const mock = mockDatabase();
    await caller().duplicateEvent(duplicateInput);
    const afterFirst = mock.snapshot();
    await expect(caller().duplicateEvent(duplicateInput)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mock.snapshot()).toEqual(afterFirst);
  });
  it("does not return success or copy content if insert returns no ID", async () => {
    const mock = mockDatabase({ missingInsertId: true });
    const before = mock.snapshot();
    await expect(caller().duplicateEvent(duplicateInput)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mock.snapshot()).toEqual(before);
    expect(mock.writes()).toHaveLength(1);
  });
});

describe("Reversible event deletion", () => {
  it("archives only the event status and retains every attached row", async () => {
    const mock = mockDatabase();
    const before = mock.snapshot();
    expect(await caller().deleteEvent({ id: 1, confirmName: eventInput.name })).toEqual({ success: true, archived: true });
    before.ultrasound_expo_events[0].status = "archived";
    expect(mock.snapshot()).toEqual(before);
    expect(mock.writes()).toHaveLength(1);
    expect(mock.writes()[0].params).toEqual(["archived", 1]);
    expect(mock.writes()[0].sql).not.toMatch(/delete|registration/i);
  });
  it.each(["ultrasoundExpo™ 2028", "UltrasoundExpo™ 2028 ", "Wrong event", ""])("requires exact event name confirmation %s", async confirmName => {
    const mock = mockDatabase();
    await expect(caller().deleteEvent({ id: 1, confirmName })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.writes()).toEqual([]);
  });
  it("repeated confirmed Delete is idempotent but still checks confirmation", async () => {
    const mock = mockDatabase();
    await caller().deleteEvent({ id: 1, confirmName: eventInput.name });
    expect(await caller().deleteEvent({ id: 1, confirmName: eventInput.name })).toEqual({ success: true, archived: true });
    await expect(caller().deleteEvent({ id: 1, confirmName: "Wrong" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.writes()).toHaveLength(1);
  });
  it("restores archived events to Draft only, preserves records and rejects repeated restore", async () => {
    const mock = mockDatabase();
    await caller().deleteEvent({ id: 1, confirmName: eventInput.name });
    const before = mock.snapshot();
    expect(await caller().restoreEvent({ id: 1 })).toEqual({ success: true, restored: true });
    before.ultrasound_expo_events[0].status = "draft";
    expect(mock.snapshot()).toEqual(before);
    expect(mock.writes().at(-1)?.params).toEqual(["draft", 1, "archived"]);
    await expect(caller().restoreEvent({ id: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mock.writes()).toHaveLength(2);
  });
  it("does not demote a published event through Restore", async () => {
    const mock = mockDatabase();
    await expect(caller().restoreEvent({ id: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mock.writes()).toEqual([]);
  });
  it.each(["deleteEvent", "restoreEvent"] as const)("errors on nonexistent ID or invalid ID for %s", async method => {
    const mock = mockDatabase();
    await expect((caller()[method] as any)({ id: 999, confirmName: eventInput.name })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect((caller()[method] as any)({ id: 0, confirmName: eventInput.name })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.writes()).toEqual([]);
  });
  it("archives and restores through the legacy tenant schema", async () => {
    const mock = mockDatabase({ hasTenant: false });
    await caller().deleteEvent({ id: 1, confirmName: eventInput.name });
    await caller().restoreEvent({ id: 1 });
    expect(mock.rows("ultrasound_expo_events")[0].status).toBe("draft");
    expect(mock.writes().every(statement => !statement.sql.includes("`tenant`"))).toBe(true);
  });
  it("does not return false success when the status write fails", async () => {
    const mock = mockDatabase({ updateError: "ER_SYNTHETIC_FAILURE" });
    const before = mock.snapshot();
    await expect(caller().deleteEvent({ id: 1, confirmName: eventInput.name })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mock.snapshot()).toEqual(before);
    mock.rows("ultrasound_expo_events")[0].status = "archived";
    await expect(caller().restoreEvent({ id: 1 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mock.rows("ultrasound_expo_events")[0].status).toBe("archived");
  });
});

describe("Admin snapshot stable partner roster enrichment", () => {
  it("returns existing vendor application ID and parsed known partner types without new application fields", async () => {
    const mock = mockDatabase({ hasCombined: false });
    const snapshot = await caller().adminSnapshot();
    expect(snapshot.registrations[0]).toMatchObject({ id: 90, vendorApplicationId: 80, partnerTypes: ["vendor", "exhibitor"], eventId: 1, eventTenant: "ultrasound_expo", packageType: "exhibitor" });
    expect(snapshot.registrations[1]).toMatchObject({ id: 91, vendorApplicationId: null, partnerTypes: [], eventId: 2, eventTenant: "echo_expo" });
    expect(snapshot.paidTotal).toBe(250000);
    expect(mock.statements.some(statement => statement.sql.includes("left join `vendor_partner_applications`"))).toBe(true);
    expect(mock.statements.some(statement => statement.sql.includes("event_interests"))).toBe(false);
    expect(mock.writes()).toEqual([]);
  });
});
