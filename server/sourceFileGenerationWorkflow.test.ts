import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const courseRouter = fs.readFileSync(path.join(root, "server/routers/lmsEnrollmentAdminRouter.ts"), "utf8");
const questionBankRouter = fs.readFileSync(path.join(root, "server/routers/questionBankRouter.ts"), "utf8");
const courseUi = fs.readFileSync(path.join(root, "client/src/pages/admin/LMSAdmin.tsx"), "utf8");
const quizUi = fs.readFileSync(path.join(root, "client/src/pages/admin/QuizCreatorAdmin.tsx"), "utf8");
const sourceReviewUi = fs.readFileSync(path.join(root, "client/src/components/admin/AiSourceFileReview.tsx"), "utf8");

describe("source-file course and quiz generation workflow", () => {
  it("accepts multimodal source files for course and Question Bank generation", () => {
    expect(courseRouter).toContain('sourceFile: z.object({');
    expect(questionBankRouter).toContain('sourceFile: z.object({');
    expect(courseRouter).toContain('buildAiSourceMessage(userPrompt, sourceFiles)');
    expect(questionBankRouter).toContain('buildAiSourceMessage(`Generate ${input.count} questions about: ${input.topic}`, sourceFiles)');
  });

  it("offers upload controls in both AI authoring workflows and persists the optional course-wide quiz", () => {
    expect(courseUi).toContain('/api/upload-ai-generation-source');
    expect(quizUi).toContain('/api/upload-ai-generation-source');
    expect(courseRouter).toContain('generated.courseQuiz');
    expect(courseUi).toContain('aiGenerateCourseQuiz');
    expect(courseUi).toContain('AiSourceFileReview');
    expect(quizUi).toContain('AiSourceFileReview');
    expect(sourceReviewUi).toContain('multiple accept="application/pdf,image/jpeg,image/png,image/webp"');
    expect(sourceReviewUi).toContain('aria-label="Source review"');
  });
});
