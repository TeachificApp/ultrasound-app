import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/routers/standaloneQuizRouter.ts"), "utf8");

describe("standalone Visual Builder canonical Question Bank hydration", () => {
  it("hydrates linked builder content before attempts, grading, and results", () => {
    expect(source).toContain("hydrateBuilderConfigFromQuestionBank");
    expect(source).toContain("standaloneQuizBuilderHydration");
    expect(source).toContain("onlyBankIds");
    expect((source.match(/await hydrateBuilderConfigFromQuestionBank/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("does not hydrate the full question bank when loading quiz info", () => {
    const getQuizInfoBlock = source.slice(source.indexOf("getQuizInfo:"), source.indexOf("startAttempt:"));
    expect(getQuizInfoBlock).not.toContain("await hydrateBuilderConfigFromQuestionBank");
  });
});
