import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseScheduledTimestamp } from "../shared/platformTime";

const source = readFileSync(new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url), "utf8");

describe("cohort administration timestamp persistence", () => {
  it("parses group starts at Eastern start-of-day and closing values at Eastern end-of-day", () => {
    expect(source).toContain('parseScheduledTimestamp(startDate, PLATFORM_TIMEZONE, "start")');
    expect(source).toContain('parseScheduledTimestamp(endDate, PLATFORM_TIMEZONE, "end")');
    expect(source).toContain('parseScheduledTimestamp(enrollmentCloseDate, PLATFORM_TIMEZONE, "end")');
    expect(parseScheduledTimestamp("2026-08-17", "America/New_York", "start").toISOString()).toBe("2026-08-17T04:00:00.000Z");
    expect(parseScheduledTimestamp("2026-08-17", "America/New_York", "end").toISOString()).toBe("2026-08-18T03:59:59.999Z");
  });
});
