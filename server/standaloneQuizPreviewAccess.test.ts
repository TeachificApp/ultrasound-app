import { describe, expect, it } from "vitest";
import { canOpenStandaloneQuiz, requiresEmbeddedLearnerAccess } from "./lib/standaloneQuizPreviewAccess";

describe("standalone quiz administrator preview access", () => {
  it("permits every authenticated learner only for published quizzes", () => {
    expect(canOpenStandaloneQuiz("published", "user", false)).toBe(true);
    expect(canOpenStandaloneQuiz("draft", "user", false)).toBe(false);
    expect(canOpenStandaloneQuiz("draft", "user", true)).toBe(false);
    expect(requiresEmbeddedLearnerAccess("user", true)).toBe(true);
  });

  it("permits administrators to preview every quiz status without making content public", () => {
    expect(canOpenStandaloneQuiz("draft", "admin", true)).toBe(true);
    expect(canOpenStandaloneQuiz("waitlist", "admin", true)).toBe(true);
    expect(canOpenStandaloneQuiz("archived", "admin", true)).toBe(true);
    expect(requiresEmbeddedLearnerAccess("admin", true)).toBe(false);
  });
});
