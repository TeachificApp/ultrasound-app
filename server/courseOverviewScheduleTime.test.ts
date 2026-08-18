import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/CourseOverview.tsx", import.meta.url), "utf8");

describe("CourseOverview cohort schedule timezone presentation", () => {
  it("renders cohort dates and times through the shared Eastern formatter", () => {
    expect(source).toContain('from "@shared/platformTime"');
    expect(source).toContain('formatInTimeZone(d, { weekday: "short", month: "short", day: "numeric", year: "numeric" }, PLATFORM_TIMEZONE)');
    expect(source).toContain('formatInTimeZone(d, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }, PLATFORM_TIMEZONE)');
    expect(source).toContain('formatInTimeZone(s.sessionDate, { year: "numeric", month: "2-digit", day: "2-digit" }, PLATFORM_TIMEZONE)');
    expect(source).toContain('formatInTimeZone(a.dueDate, { year: "numeric", month: "2-digit", day: "2-digit" }, PLATFORM_TIMEZONE)');
  });
});
