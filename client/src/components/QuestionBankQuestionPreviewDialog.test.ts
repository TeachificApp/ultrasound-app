import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("QuestionBankQuestionPreviewDialog", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/QuestionBankQuestionPreviewDialog.tsx"), "utf8");

  it("renders read-only question, answer, feedback, image, and video content", () => {
    expect(source).toContain("Question Preview");
    expect(source).toContain("Answer choices");
    expect(source).toContain("Feedback and explanation");
    expect(source).toContain("question.questionImageUrl");
    expect(source).toContain("question.questionVideoUrl");
    expect(source).toContain("option.videoUrl");
    expect(source).toContain("Close preview");
  });
});
