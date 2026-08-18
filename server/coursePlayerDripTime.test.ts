import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/CoursePlayer.tsx", import.meta.url), "utf8");

describe("Course Player drip schedule timezone presentation", () => {
  it("renders lesson and section drip dates through the shared Eastern formatter", () => {
    expect(source).toContain('from "@shared/platformTime"');
    expect(source).toContain('formatInTimeZone(new Date(enrolledAt.getTime() + lesson.dripDays * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE)');
    expect(source).toContain('formatInTimeZone(new Date(enrolledAt.getTime() + section.dripDays * 86400000), { month: "short", day: "numeric" }, PLATFORM_TIMEZONE)');
    expect(source).not.toContain('lesson.dripDays * 86400000).toLocaleDateString');
    expect(source).not.toContain('section.dripDays * 86400000).toLocaleDateString');
  });
});
