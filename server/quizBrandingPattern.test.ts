import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_QUIZ_PLAYER_PATTERN } from "../shared/quizBrandingPattern";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("current quiz player branding pattern", () => {
  it("defines the existing readable dark navy-to-aqua player pattern", () => {
    expect(CURRENT_QUIZ_PLAYER_PATTERN.primaryColor).toBe("#189aa1");
    expect(CURRENT_QUIZ_PLAYER_PATTERN.backgroundMode).toBe("gradient");
    expect(CURRENT_QUIZ_PLAYER_PATTERN.backgroundGradient).toContain("#0d1f3c");
    expect(CURRENT_QUIZ_PLAYER_PATTERN.textColor).toBe("#ffffff");
  });

  it("uses the same pattern in the Design panel and player preview", () => {
    expect(read("client/src/quiz-creator/components/BrandingPanel.tsx")).toContain("CURRENT_QUIZ_PLAYER_PATTERN");
    expect(read("client/src/quiz-creator/components/QuizSettings.tsx")).toContain("CURRENT_QUIZ_PLAYER_PATTERN");
    expect(read("client/src/quiz-creator/components/SlideViewEditor.tsx")).toContain("resolveQuizBackground");
  });
});
