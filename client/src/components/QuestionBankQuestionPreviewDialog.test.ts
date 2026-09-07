import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("QuestionBankQuestionPreviewDialog", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/QuestionBankQuestionPreviewDialog.tsx"), "utf8");

  it("uses learner-style question presentation with local-only answer checking", () => {
    expect(source).toContain("Question Preview");
    expect(source).toContain("Learner quiz-player preview");
    expect(source).toContain("Check Answer");
    expect(source).toContain("Try again");
    expect(source).toContain("StandaloneQuestionMedia");
    expect(source).toContain("<Progress value={100}");
    expect(source).toContain("question.questionImageUrl");
    expect(source).toContain("question.questionVideoUrl");
    expect(source).toContain("question.feedbackImageUrl");
    expect(source).toContain("option.videoUrl");
    expect(source).toContain("does not create a learner attempt or record");
    expect(source).toContain("Close preview");
  });
});
