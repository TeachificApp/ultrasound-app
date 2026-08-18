import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isScheduledDeadlineOpen } from "../shared/platformTime";

const source = readFileSync(new URL("./routers/embeddedCheckoutRouter.ts", import.meta.url), "utf8");

describe("embedded course checkout enrollment deadline", () => {
  it("uses the shared Eastern deadline evaluator before creating the checkout session", () => {
    expect(source).toContain('!isScheduledDeadlineOpen(courseRow.enrollmentCloseDate, PLATFORM_TIMEZONE)');
    expect(source).not.toContain('new Date(courseRow.enrollmentCloseDate) < new Date()');
  });

  it("keeps a date-only cohort enrollment deadline open through Eastern end of day", () => {
    const easternWallDeadline = new Date("2026-08-17T23:59:59.999Z");
    expect(isScheduledDeadlineOpen(easternWallDeadline, "America/New_York", new Date("2026-08-18T03:59:59.998Z"))).toBe(true);
    expect(isScheduledDeadlineOpen(easternWallDeadline, "America/New_York", new Date("2026-08-18T04:00:00.000Z"))).toBe(false);
  });
});
