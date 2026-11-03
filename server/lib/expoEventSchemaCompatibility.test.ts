import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { ultrasoundExpoPackages } from "../../drizzle/schema";
import { getCompatibleExpoEventById, listCompatibleExpoEvents, listCompatibleExpoPackages, normalizeLegacyExpoEvent } from "./expoEventSchemaCompatibility";

describe("Expo event schema compatibility", () => {
  it("treats a legacy row without the additive tenant column as UltrasoundExpo™", () => {
    expect(normalizeLegacyExpoEvent({ id: 12, name: "Annual Expo" }, false)).toMatchObject({
      id: 12,
      name: "Annual Expo",
      tenant: "ultrasound_expo",
    });
  });

  it("retains an explicit EchoExpo™ tenant only after the additive schema is available", () => {
    expect(normalizeLegacyExpoEvent({ id: 13, tenant: "echo_expo" }, true).tenant).toBe("echo_expo");
    expect(normalizeLegacyExpoEvent({ id: 13, tenant: "echo_expo" }, false).tenant).toBe("ultrasound_expo");
  });

  it.each(["UTC", "America/New_York", "America/Los_Angeles", "Pacific/Honolulu"])("preserves January 11–13 in event timezone regardless of browser timezone %s", async browserTimezone => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = browserTimezone;
    try {
      const row = {
        id: 1, startsAt: "2028-01-11 13:00:00", endsAt: "2028-01-14 01:00:00",
        createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-02 00:00:00", timezone: "America/New_York",
      };
      const db = { execute: vi.fn().mockResolvedValueOnce([[], []]).mockResolvedValueOnce([[row], []]) };
      const [event] = await listCompatibleExpoEvents(db, { publishedOnly: true });
      expect(event.startsAt).toBeInstanceOf(Date);
      expect(event.endsAt).toBeInstanceOf(Date);
      expect(event.startsAt.toISOString()).toBe("2028-01-11T13:00:00.000Z");
      expect(event.endsAt?.toISOString()).toBe("2028-01-14T01:00:00.000Z");
      const day = (date: Date) => date.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/New_York" });
      expect(`${day(event.startsAt)}–${day(event.endsAt!)}`).toBe("11–13");
      expect(event.createdAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(event.updatedAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
      // Verify this regression actually distinguishes raw-string interpretation
      // on a browser west of Eastern Time, without rewriting the saved instant.
      const displayedDays = execFileSync(process.execPath, ["-e", `
        const day = value => new Date(value).toLocaleDateString("en-US", {day: "numeric", timeZone: "America/New_York"});
        console.log(JSON.stringify([day(process.argv[1]), day(process.argv[2]), day(process.argv[3])]));
      `, event.startsAt.toISOString(), event.endsAt!.toISOString(), row.endsAt], { env: { ...process.env, TZ: browserTimezone }, encoding: "utf8" });
      const [startDay, endDay, rawEndDay] = JSON.parse(displayedDays);
      expect(`${startDay}–${endDay}`).toBe("11–13");
      if (browserTimezone === "America/Los_Angeles") expect(rawEndDay).toBe("14");
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it("retains null end dates and already typed dates through the legacy lookup", async () => {
    const startsAt = new Date("2028-01-11T17:00:00.000Z");
    const db = { execute: vi.fn().mockResolvedValueOnce([[], []]).mockResolvedValueOnce([[{ id: 1, startsAt, endsAt: null }], []]) };
    expect(await getCompatibleExpoEventById(db, 1)).toMatchObject({ startsAt, endsAt: null, tenant: "ultrasound_expo" });
  });

  it.each([false, true])("keeps packages readable when combined-offer column availability is %s", async (hasColumn) => {
    const packages = [{ id: 7, eventId: 1, name: "Existing option", amountCents: 250000, combinedWithPackageId: hasColumn ? 8 : null }];
    const db = {
      execute: vi.fn().mockResolvedValue([hasColumn ? [{ COLUMN_NAME: "combined_with_package_id" }] : [], []]),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(packages) }),
      }),
    };
    expect(await listCompatibleExpoPackages(db)).toEqual(packages);
    const projection = db.select.mock.calls[0][0];
    expect(projection.id).toBe(ultrasoundExpoPackages.id);
    expect(projection.name).toBe(ultrasoundExpoPackages.name);
    expect(projection.amountCents).toBe(ultrasoundExpoPackages.amountCents);
    if (hasColumn) {
      expect(projection.combinedWithPackageId).toBe(ultrasoundExpoPackages.combinedWithPackageId);
    } else {
      expect(projection.combinedWithPackageId).toBeInstanceOf(SQL);
      expect(new MySqlDialect().sqlToQuery(projection.combinedWithPackageId).sql).toBe("NULL");
    }
  });
});
