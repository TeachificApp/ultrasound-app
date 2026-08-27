import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sdmsCmeService = readFileSync(resolve(process.cwd(), "server/lib/sdmsCmeService.ts"), "utf8");

describe("CME lesson progress integration", () => {
  it("marks the configured CME curriculum lesson complete when the SDMS form is passed", () => {
    expect(sdmsCmeService).toContain('import { markLessonCompleteForUser } from "./cmeLessonProgress"');
    expect(sdmsCmeService).toContain("config.cmeLessonId");
    expect(sdmsCmeService).toContain("markLessonCompleteForUser({");
  });
});
