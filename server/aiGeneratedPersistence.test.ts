import { describe, expect, it } from "vitest";
import { buildAiQuestionBankInsertValues } from "./lib/aiQuestionBankPersistence";
import { persistGeneratedCourseAssessment } from "./lib/aiCourseAssessment";

describe("AI-generated source content persistence", () => {
  it("preserves the question explanation and feedback for every answer option", () => {
    const values = buildAiQuestionBankInsertValues({
      question: "Which finding is expected?",
      type: "mcq",
      options: ["A", "B", "C", "D"],
      optionFeedback: ["A is incorrect", "B is correct", "C is incorrect", "D is incorrect"],
      correctAnswer: "B",
      explanation: "B is the expected finding.",
    }, 9, 4);
    expect(values.explanation).toBe("B is the expected finding.");
    expect(JSON.parse(values.options!)).toEqual([
      { text: "A", feedback: "A is incorrect" },
      { text: "B", feedback: "B is correct" },
      { text: "C", feedback: "C is incorrect" },
      { text: "D", feedback: "D is incorrect" },
    ]);
  });

  it("persists a generated course-wide assessment as a section, quiz lesson, quiz, and ordered questions", async () => {
    const writes: any[] = [];
    let id = 100;
    const db = { insert: (table: unknown) => ({ values: (values: any) => { writes.push({ table, values }); return { $returningId: async () => [{ id: id++ }] }; } }) };
    const persisted = await persistGeneratedCourseAssessment(db, 77, 3, {
      title: "Final Source Assessment",
      questions: [
        { question: "Q1", options: ["A", "B", "C", "D"], correctAnswer: "B", explanation: "B rationale" },
        { question: "Q2", options: ["A", "B", "C", "D"], correctAnswer: "C", explanation: "C rationale" },
      ],
    });
    expect(persisted).toBe(true);
    expect(writes).toHaveLength(5);
    expect(writes[0].values).toMatchObject({ courseId: 77, title: "Course Assessment", position: 3 });
    expect(writes[1].values).toMatchObject({ title: "Final Source Assessment", type: "quiz", durationMinutes: 10 });
    expect(writes[3].values).toMatchObject({ question: "Q1", correctAnswer: "B", explanation: "B rationale", position: 0 });
    expect(writes[4].values).toMatchObject({ question: "Q2", correctAnswer: "C", explanation: "C rationale", position: 1 });
  });
});
