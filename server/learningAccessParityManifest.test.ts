import { describe, expect, it } from "vitest";
import { classifyLearningAccessTable } from "../scripts/learningAccessParityManifest.mjs";

describe("learning-access parity manifest", () => {
  it("includes content and learner-access tables while excluding sensitive credential material", () => {
    expect(classifyLearningAccessTable("courses")).toBe("content");
    expect(classifyLearningAccessTable("course_enrollments")).toBe("content-and-access");
    expect(classifyLearningAccessTable("user_course_progress")).toBe("content-and-access");
    expect(classifyLearningAccessTable("cme_certificates")).toBe("content-and-access");
    expect(classifyLearningAccessTable("user_access_tokens")).toBe("excluded-sensitive");
  });

  it("keeps technical session and webhook tables out of content-access migration scope", () => {
    expect(classifyLearningAccessTable("lms_cohort_sessions")).toBe("excluded-sensitive");
    expect(classifyLearningAccessTable("generalFormWebhooks")).toBe("excluded-sensitive");
    expect(classifyLearningAccessTable("ip_access_logs")).toBe("excluded-operational-personal-data");
  });

  it("identifies composite-key quiz metadata as content for count-based zero-row parity handling", () => {
    expect(classifyLearningAccessTable("quiz_question_tags")).toBe("content");
  });

  it("includes the user identity table for ID-preserving Railway reconciliation", () => {
    expect(classifyLearningAccessTable("users")).toBe("identity");
  });
});
