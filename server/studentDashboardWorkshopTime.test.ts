import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/StudentDashboardPage.tsx", import.meta.url), "utf8");

describe("learner workshop schedule timezone presentation", () => {
  it("renders enrolled workshop instance dates through the shared Eastern formatter", () => {
    expect(source).toContain('from "@shared/platformTime"');
    expect(source).toContain('formatInTimeZone(w.instanceStartDate, { year: "numeric", month: "short", day: "numeric" }, PLATFORM_TIMEZONE)');
  });
});
