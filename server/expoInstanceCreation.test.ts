import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { ultrasoundExpoEvents } from "../drizzle/schema";
import { ultrasoundExpoRouter } from "./routers/ultrasoundExpoRouter";
import { formatScheduledInput, parseScheduledTimestamp } from "../shared/platformTime";
import { ULTRASOUND_EXPO_EVENT_DATES_LABEL, ULTRASOUND_EXPO_LAUNCH_EVENT } from "../shared/ultrasoundExpo";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getUserRoles: vi.fn() }));
vi.mock("./db", () => mocks);
vi.mock("./lib/stripeClient", () => ({ getStripeClient: vi.fn(() => { throw new Error("Stripe must not be called"); }) }));
vi.mock("./lib/vendorPartnerAccess", () => ({ requireApprovedVendorApplication: vi.fn(() => { throw new Error("Partner checkout must not be called"); }) }));

// Real Drizzle runs against this driver only: no network, event records, email,
// Stripe operations, or database mutations occur during these execution tests.
function mockDatabase(hasTenant: boolean, insertError?: { code: string }, insertId = 42) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const client = {
    query: vi.fn(async (query: { sql: string }, params: unknown[]) => {
      const text = query.sql;
      statements.push({ sql: text, params });
      if (text.includes("INFORMATION_SCHEMA.COLUMNS")) {
        return [hasTenant ? [{ COLUMN_NAME: "tenant" }] : [], []];
      }
      if (/^\s*insert into/i.test(text)) {
        if (!hasTenant && /`?tenant`?/.test(text)) {
          throw Object.assign(new Error("Unknown column tenant"), { code: "ER_BAD_FIELD_ERROR" });
        }
        if (insertError) throw Object.assign(new Error("Synthetic insert failure"), insertError);
        return [{ insertId, affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected query in test: ${text}`);
    }),
  };
  const db = drizzle({ client: client as any });
  mocks.getDb.mockResolvedValue(db);
  return { db, client, statements };
}

const input = {
  name: "UltrasoundExpo™ 2028",
  slug: "ultrasoundexpo-2028",
  startsAt: new Date("2028-01-11T17:00:00.000Z"),
  endsAt: new Date("2028-01-13T19:00:00.000Z"),
  timezone: "America/New_York",
  locationLabel: "Orlando, Florida · Venue TBD",
  description: "Authored overview",
  registrationTerms: "Authored terms",
  attendeeInstructions: "Authored attendee instructions",
  partnerInstructions: "Authored partner instructions",
  status: "draft" as const,
};
const caller = (role = "admin") => ultrasoundExpoRouter.createCaller({ user: { id: 1, role }, req: {}, res: {} } as any);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserRoles.mockResolvedValue([]);
});

describe("Expo instance creation with real Drizzle and a no-write driver", () => {
  it("reproduces why omitting tenant from values still fails against the legacy Railway schema", async () => {
    const { db, statements } = mockDatabase(false);
    await expect(db.insert(ultrasoundExpoEvents).values(input).$returningId())
      .rejects.toMatchObject({ cause: { code: "ER_BAD_FIELD_ERROR" } });
    expect(statements[0].sql).toContain("`tenant`");
  });

  it("creates normal UltrasoundExpo through an explicit legacy column list, with the existing tenant default", async () => {
    const { statements } = mockDatabase(false);
    expect(await caller().createEvent(input)).toEqual({ id: 42 });
    const inserts = statements.filter(query => /^\s*insert into/i.test(query.sql));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sql).not.toMatch(/\btenant\b/);
    expect(inserts[0].params).toEqual([
      input.name, input.slug, "2028-01-11 17:00:00.000", "2028-01-13 19:00:00.000",
      input.timezone, input.locationLabel, input.description, null,
      input.registrationTerms, input.attendeeInstructions, input.partnerInstructions, "draft",
    ]);
  });

  it("parameterizes authored text instead of interpolating it into SQL", async () => {
    const { statements } = mockDatabase(false);
    const description = "A quoted ' value; DROP TABLE ultrasound_expo_events; --";
    await caller().createEvent({ ...input, description });
    const insert = statements.find(query => /^\s*insert into/i.test(query.sql))!;
    expect(insert.sql).not.toContain(description);
    expect(insert.params).toContain(description);
  });

  it.each(["ultrasound_expo", "echo_expo"] as const)("retains %s identity through the normal typed insert when migrated", async tenant => {
    const { statements } = mockDatabase(true);
    const dates = tenant === "echo_expo" ? {
      startsAt: new Date("2028-01-14T17:00:00.000Z"),
      endsAt: new Date("2028-01-16T19:00:00.000Z"),
    } : {};
    expect(await caller().createEvent({ ...input, ...dates, tenant })).toEqual({ id: 42 });
    const inserts = statements.filter(query => /^\s*insert into/i.test(query.sql));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sql).toContain("`tenant`");
    expect(inserts[0].params).toContain(tenant);
    expect(inserts[0].params).toContain(tenant === "echo_expo" ? "2028-01-16 19:00:00.000" : "2028-01-13 19:00:00.000");
  });

  it("explains the Echo migration dependency and performs no insert on the legacy schema", async () => {
    const { statements } = mockDatabase(false);
    await expect(caller().createEvent({ ...input, tenant: "echo_expo" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("ultrasound_expo_events.tenant"),
    });
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toContain("INFORMATION_SCHEMA.COLUMNS");
  });

  it.each([false, true])("explains a reused slug without exposing SQL on schema availability %s", async hasTenant => {
    const { statements } = mockDatabase(hasTenant, { code: "ER_DUP_ENTRY" });
    await expect(caller().createEvent(input)).rejects.toMatchObject({
      code: "CONFLICT", message: expect.stringContaining("unique slug"),
    });
    expect(statements.filter(query => /^\s*insert into/i.test(query.sql))).toHaveLength(1);
  });

  it.each([false, true])("does not return false success when no instance ID was returned on schema availability %s", async hasTenant => {
    mockDatabase(hasTenant, undefined, 0);
    await expect(caller().createEvent(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("blocks non-admin creation before inspecting or inserting into the database", async () => {
    const { client } = mockDatabase(false);
    await expect(caller("user").createEvent(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(client.query).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("preserves explicit platform-admin access", async () => {
    mockDatabase(false);
    mocks.getUserRoles.mockResolvedValue(["platform_admin"]);
    expect(await caller("user").createEvent(input)).toEqual({ id: 42 });
  });

  it("shows the existing saved end instant as January 13 in the event editor and round-trips it unchanged", () => {
    const savedEnd = new Date("2028-01-14T01:00:00.000Z");
    const editorValue = formatScheduledInput(savedEnd, "America/New_York");
    expect(editorValue).toBe("2028-01-13T20:00");
    expect(parseScheduledTimestamp(editorValue, "America/New_York").toISOString()).toBe(savedEnd.toISOString());
    expect(parseScheduledTimestamp("2028-01-13T14:00", "America/New_York").toISOString()).toBe("2028-01-13T19:00:00.000Z");
  });

  it("keeps the approved UltrasoundExpo defaults January 11–13, not an exclusive January 14 end date", () => {
    expect(ULTRASOUND_EXPO_EVENT_DATES_LABEL).toBe("January 11–13, 2028");
    expect(formatScheduledInput(new Date(ULTRASOUND_EXPO_LAUNCH_EVENT.startsAtIso), "America/New_York")).toBe("2028-01-11T12:00");
    expect(formatScheduledInput(new Date(ULTRASOUND_EXPO_LAUNCH_EVENT.endsAtIso), "America/New_York")).toBe("2028-01-13T14:00");
  });

  it("wires the same timezone conversion into the editor without hiding Echo creation or authored event fields", async () => {
    const { readFile } = await import("node:fs/promises");
    const [admin, echo] = await Promise.all([
      readFile("client/src/pages/admin/UltrasoundExpoAdmin.tsx", "utf8"),
      readFile("client/src/pages/EchoExpoSite.tsx", "utf8"),
    ]);
    expect(admin).toContain("formatScheduledInput(value, timezone)");
    expect(admin).toContain("parseScheduledTimestamp(value, timezone)");
    expect(admin).toContain("dateFromInput(eventDetails.endsAt, eventDetails.timezone)");
    expect(admin).toContain('onClick={() => newEvent("echo_expo")}');
    expect(admin).not.toContain('tenantSchemaAvailable !== false && <Button');
    expect(admin).toContain("createEvent.error.message");
    for (const field of ["registrationTerms", "attendeeInstructions", "partnerInstructions", "heroImageUrl"]) {
      expect(admin).toContain(field);
    }
    expect(echo).toContain("January 14–16, 2028");
  });
});
