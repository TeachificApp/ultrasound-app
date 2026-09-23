import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Question Bank row preview", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/admin/LMSAdmin.tsx"), "utf8");

  it("adds a preview action beside edit and delete without changing either existing action", () => {
    expect(source).toContain("setPreviewingQuestion(q)");
    expect(source).toContain("title=\"Preview question\"");
    expect(source).toContain("QuestionBankQuestionPreviewDialog");
    expect(source).toContain("setEditingQuestion(q)");
    expect(source).toContain("deleteQ.mutate({ id: q.id })");
  });

  it("visibly labels image and video media even while tag maps are refreshed", () => {
    expect(source).toContain("const hasImageMedia");
    expect(source).toContain("const hasVideoMedia");
    expect(source).toContain("Media: Image");
    expect(source).toContain("Media: Video");
    expect(source).toContain('aria-label="Question media tags"');
  });
});
