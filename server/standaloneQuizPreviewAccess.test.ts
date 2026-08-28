import { describe, expect, it } from "vitest";
import { canOpenStandaloneQuiz, requiresEmbeddedLearnerAccess } from "./lib/standaloneQuizPreviewAccess";
import {
  isStandaloneQuizStaff,
  resolveStandaloneQuizAdminPreview,
} from "./lib/standaloneQuizStaffAccess";

describe("standalone quiz administrator preview access", () => {
  it("permits every authenticated learner only for published quizzes", () => {
    expect(canOpenStandaloneQuiz("published", false, false)).toBe(true);
    expect(canOpenStandaloneQuiz("draft", false, false)).toBe(false);
    expect(canOpenStandaloneQuiz("draft", true, false)).toBe(false);
    expect(requiresEmbeddedLearnerAccess(true, false)).toBe(true);
  });

  it("permits staff to preview every quiz status without making content public", () => {
    expect(canOpenStandaloneQuiz("draft", true, true)).toBe(true);
    expect(canOpenStandaloneQuiz("waitlist", true, true)).toBe(true);
    expect(canOpenStandaloneQuiz("archived", true, true)).toBe(true);
    expect(requiresEmbeddedLearnerAccess(true, true)).toBe(false);
  });

  it("recognizes platform staff for Quiz Creator admin operations", () => {
    expect(isStandaloneQuizStaff("user", ["platform_admin"])).toBe(true);
    expect(isStandaloneQuizStaff("user", ["platform_owner"])).toBe(true);
    expect(isStandaloneQuizStaff("admin", [])).toBe(true);
    expect(isStandaloneQuizStaff("user", ["premium_user"])).toBe(false);
  });

  it("requires platform staff to explicitly request preview while legacy owners always preview", () => {
    expect(resolveStandaloneQuizAdminPreview("admin", true, false)).toBe(true);
    expect(resolveStandaloneQuizAdminPreview("user", true, true)).toBe(true);
    expect(resolveStandaloneQuizAdminPreview("user", true, false)).toBe(false);
    expect(resolveStandaloneQuizAdminPreview("user", false, true)).toBe(false);
  });
});
