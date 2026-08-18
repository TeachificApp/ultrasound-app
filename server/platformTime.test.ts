import { describe, expect, it } from "vitest";
import { formatScheduledInput, isInstantExpired, isScheduledDeadlineOpen, parseScheduledTimestamp } from "../shared/platformTime";

describe("platform scheduled timestamps", () => {
  it("treats a date-only enrollment close as 11:59:59.999 PM Eastern", () => {
    const deadline = parseScheduledTimestamp("2026-08-17", "America/New_York", "end");
    expect(deadline.toISOString()).toBe("2026-08-18T03:59:59.999Z");
    expect(new Date("2026-08-18T03:59:59.998Z") < deadline).toBe(true);
    expect(new Date("2026-08-18T04:00:00.000Z") < deadline).toBe(false);
  });

  it("converts zone-less Eastern cohort session input to the correct UTC instant", () => {
    expect(parseScheduledTimestamp("2026-01-05T18:00", "America/New_York", "start").toISOString()).toBe("2026-01-05T23:00:00.000Z");
    expect(parseScheduledTimestamp("2026-07-05T18:00", "America/New_York", "start").toISOString()).toBe("2026-07-05T22:00:00.000Z");
  });

  it("keeps explicit ISO instants unchanged", () => {
    expect(parseScheduledTimestamp("2026-08-18T03:59:59.999Z").toISOString()).toBe("2026-08-18T03:59:59.999Z");
  });

  it("formats stored UTC instants back into Eastern administrator datetime and date input values", () => {
    const instant = new Date("2026-08-18T01:30:00.000Z");
    expect(formatScheduledInput(instant)).toBe("2026-08-17T21:30");
    expect(formatScheduledInput(instant, undefined, false)).toBe("2026-08-17");
  });

  it("compares access-expiry instants without depending on local calendar time", () => {
    const boundary = Date.parse("2026-08-18T00:00:00.000Z");
    expect(isInstantExpired("2026-08-17T23:59:59.999Z", boundary)).toBe(true);
    expect(isInstantExpired("2026-08-18T00:00:00.000Z", boundary)).toBe(false);
  });
});
