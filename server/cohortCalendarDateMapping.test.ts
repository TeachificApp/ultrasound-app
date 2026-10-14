import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calendarDateKeyInTimeZone } from "../shared/platformTime";

describe("cohort course calendar date mapping", () => {
  it("uses YYYY-MM-DD keys that match calendar grid cells in the platform timezone", () => {
    expect(calendarDateKeyInTimeZone("2026-10-15T00:30:00.000Z", "America/New_York")).toBe("2026-10-14");
    expect(calendarDateKeyInTimeZone("2026-10-15T23:30:00.000Z", "America/New_York")).toBe("2026-10-15");
  });

  it("does not use locale-formatted dates as course calendar map keys", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/CourseOverview.tsx"), "utf8");
    expect(source).toContain("calendarDateKeyInTimeZone(s.sessionDate, PLATFORM_TIMEZONE)");
    expect(source).toContain("calendarDateKeyInTimeZone(a.dueDate, PLATFORM_TIMEZONE)");
  });
});
