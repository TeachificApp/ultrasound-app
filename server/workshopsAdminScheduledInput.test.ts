import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/admin/WorkshopsAdmin.tsx", import.meta.url), "utf8");

describe("Workshop Admin scheduled input hydration", () => {
  it("uses the shared Eastern input formatter for workshop dates and enrollment deadlines", () => {
    expect(source).toContain('formatScheduledInput(inst.startDate, PLATFORM_TIMEZONE)');
    expect(source).toContain('formatScheduledInput(inst.salesCloseDate, PLATFORM_TIMEZONE)');
    expect(source).toContain('formatScheduledInput(inst.enrollmentCloseDate, PLATFORM_TIMEZONE, false)');
  });
});
