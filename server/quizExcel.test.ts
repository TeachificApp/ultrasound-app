import { describe, expect, it } from "vitest";
import { exportQuizToExcel, parseQuizExcel } from "./quizExcel";

describe("iSpring spreadsheet export", () => {
  it("exports the documented template format with answer keys and feedback that parse back correctly", () => {
    const workbook = exportQuizToExcel("Vascular Review", [{
      questionType: "multiple_choice",
      questionText: "Which threshold is diagnostic?",
      points: 2,
      correctFeedback: "This threshold meets the accepted diagnostic criterion.",
      incorrectFeedback: "Review the diagnostic threshold.",
      choices: [
        { choiceText: "500 milliseconds", isCorrect: true, sortOrder: 0 },
        { choiceText: "100 milliseconds", isCorrect: false, sortOrder: 1 },
      ],
    }]);
    const parsed = parseQuizExcel(workbook);
    expect(parsed.errorCount).toBe(0);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0]).toMatchObject({
      typeCode: "MC",
      questionText: "Which threshold is diagnostic?",
      points: 2,
      correctFeedback: "This threshold meets the accepted diagnostic criterion.",
      incorrectFeedback: "Review the diagnostic threshold.",
    });
    expect(parsed.questions[0].choices).toEqual([
      { choiceText: "500 milliseconds", isCorrect: true, sortOrder: 0 },
      { choiceText: "100 milliseconds", isCorrect: false, sortOrder: 1 },
    ]);
  });
});
