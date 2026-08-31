import { describe, expect, it } from "vitest";
import { cloneLessonTemplateBlocks } from "./LessonBlockEditor";

describe("cloneLessonTemplateBlocks", () => {
  it("creates fresh content-block IDs without mutating saved template content", () => {
    const template = JSON.stringify([
      { id: "saved-quiz", type: "lesson_quiz", data: { title: "CME Activity Evaluation Survey", questions: [{ question: "Example", type: "likert" }] } },
      { id: "saved-columns", type: "column_layout", data: { leftBlocks: [{ id: "saved-child", type: "text", data: { content: "Instructional text" } }], rightBlocks: [] } },
    ]);
    const sourceBefore = template;
    let next = 0;
    const copies = cloneLessonTemplateBlocks(template, () => `new-${++next}`);

    expect(copies).toHaveLength(2);
    expect(copies.map(block => block.id)).toEqual(["new-1", "new-2"]);
    expect(copies[1].data.leftBlocks[0].id).toBe("new-3");
    expect(copies[0].data.questions[0].question).toBe("Example");
    expect(template).toBe(sourceBefore);
  });

  it("returns no blocks for malformed template data", () => {
    expect(cloneLessonTemplateBlocks("not-json")).toEqual([]);
  });
});
