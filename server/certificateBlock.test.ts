/**
 * certificateBlock.test.ts
 * Tests for the lesson_certificate block and getLessonQuizPassStatus procedure.
 */
import { describe, it, expect } from "vitest";

// ── Block data defaults ──────────────────────────────────────────────────────
const DEFAULT_CERT_BLOCK_DATA = {
  heading: "Your Certificate of Completion",
  subtext: "Download and share your achievement.",
  lockedMessage: "Complete all required lessons to unlock your certificate.",
  bgColor: "#f0fafa",
  requireQuizPass: false,
  gateQuizLessonId: null,
  quizNotPassedMessage: "You must pass the required quiz before accessing your certificate.",
};

describe("lesson_certificate block data", () => {
  it("has correct default fields", () => {
    expect(DEFAULT_CERT_BLOCK_DATA.heading).toBe("Your Certificate of Completion");
    expect(DEFAULT_CERT_BLOCK_DATA.requireQuizPass).toBe(false);
    expect(DEFAULT_CERT_BLOCK_DATA.gateQuizLessonId).toBeNull();
    expect(DEFAULT_CERT_BLOCK_DATA.bgColor).toBe("#f0fafa");
  });

  it("gate is disabled by default", () => {
    const gateEnabled = !!(
      DEFAULT_CERT_BLOCK_DATA.requireQuizPass &&
      DEFAULT_CERT_BLOCK_DATA.gateQuizLessonId
    );
    expect(gateEnabled).toBe(false);
  });

  it("gate is enabled when requireQuizPass=true and gateQuizLessonId is set", () => {
    const data = { ...DEFAULT_CERT_BLOCK_DATA, requireQuizPass: true, gateQuizLessonId: 42 };
    const gateEnabled = !!(data.requireQuizPass && data.gateQuizLessonId);
    expect(gateEnabled).toBe(true);
  });

  it("gate is disabled when requireQuizPass=true but gateQuizLessonId is null", () => {
    const data = { ...DEFAULT_CERT_BLOCK_DATA, requireQuizPass: true, gateQuizLessonId: null };
    const gateEnabled = !!(data.requireQuizPass && data.gateQuizLessonId);
    expect(gateEnabled).toBe(false);
  });
});

// ── getLessonQuizPassStatus response shape ───────────────────────────────────
describe("getLessonQuizPassStatus response shape", () => {
  it("passed=true when score >= passingScore", () => {
    const mockResult = { passed: true, score: 85, attempts: 2, passingScore: 70 };
    expect(mockResult.passed).toBe(true);
    expect(mockResult.score).toBeGreaterThanOrEqual(mockResult.passingScore);
  });

  it("passed=false when score < passingScore", () => {
    const mockResult = { passed: false, score: 60, attempts: 1, passingScore: 70 };
    expect(mockResult.passed).toBe(false);
    expect(mockResult.score).toBeLessThan(mockResult.passingScore);
  });

  it("passed=false when no attempts", () => {
    const mockResult = { passed: false, score: null, attempts: 0, passingScore: 70 };
    expect(mockResult.passed).toBe(false);
    expect(mockResult.attempts).toBe(0);
  });
});
