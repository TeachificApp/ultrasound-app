import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/CohortSchedule.tsx", import.meta.url), "utf8");

describe("CohortSchedule calendar timezone presentation", () => {
  it("groups calendar sessions by their America/New_York calendar date without reparsing local date strings", () => {
    expect(source).toContain('formatInTimeZone(s.sessionDate, { weekday: "long", month: "long", day: "numeric" }, PLATFORM_TIMEZONE)');
    expect(source).toContain('mb-2">{dateStr}</p>');
    expect(source).not.toContain('new Date(dateStr).toLocaleDateString');
  });
});
