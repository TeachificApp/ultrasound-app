import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/routers/standaloneQuizRouter.ts"), "utf8");

describe("standalone Visual Builder canonical Question Bank hydration", () => {
  it("hydrates linked builder content before learner attempts, grading, and results", () => {
    expect(source).toContain("hydrateBuilderConfigFromQuestionBank");
    expect(source).toContain("builderQuestionFromQuestionBank");
    expect(source).toContain("mergeCanonicalBuilderQuestion");
    expect((source.match(/await hydrateBuilderConfigFromQuestionBank/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
