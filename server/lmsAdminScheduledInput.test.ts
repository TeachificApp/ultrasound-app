import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url), "utf8");

describe("LMS Admin scheduled input hydration", () => {
  it("uses the shared Eastern formatter for the course enrollment close date input", () => {
    expect(source).toContain('formatScheduledInput(course.enrollmentCloseDate, PLATFORM_TIMEZONE, false)');
  });
});
