import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("quiz account-field delivery", () => {
  const standalone = readFileSync(resolve(import.meta.dirname, "routers/standaloneQuizRouter.ts"), "utf8");
  const inline = readFileSync(resolve(import.meta.dirname, "routers/lmsRouter.ts"), "utf8");
  const player = readFileSync(resolve(import.meta.dirname, "../client/src/pages/StandaloneQuizPlayer.tsx"), "utf8");
  const standardCreator = readFileSync(resolve(import.meta.dirname, "../client/src/pages/admin/QuizCreatorAdmin.tsx"), "utf8");
  const visualCreator = readFileSync(resolve(import.meta.dirname, "../client/src/quiz-creator/components/QuizSettings.tsx"), "utf8");

  it("uses only allow-listed configuration and snapshots the selected values", () => {
    expect(standalone).toContain("normalizeQuizAccountFieldKeys");
    expect(standalone).toContain("resolveQuizAccountFields");
    expect(standalone).toContain("accountFieldValues");
    expect(inline).toContain("accountFieldValues");
    expect(inline).toContain("inlineQuiz?.data?.accountFields");
  });

  it("delivers selected values only through a started learner attempt", () => {
    expect(standalone).toContain("accountFields,");
    expect(player).toContain("setAccountFields(res.accountFields ?? [])");
    expect(player).toContain("Your account information");
    expect(standardCreator).toContain("Learner account fields");
    expect(visualCreator).toContain("Learner account fields");
  });
});
