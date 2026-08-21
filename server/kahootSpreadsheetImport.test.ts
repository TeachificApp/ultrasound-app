import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseKahootSpreadsheet } from "./lib/kahootSpreadsheetImport";

function workbookBuffer(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Kahoot quiz");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("Kahoot spreadsheet import", () => {
  it("maps a user-supplied Kahoot-style quiz row into a Teach multiple-choice slide", () => {
    const result = parseKahootSpreadsheet(workbookBuffer([
      ["Question - max 120 characters", "Answer 1", "Answer 2", "Answer 3", "Answer 4", "Correct answer(s)", "Time limit (sec)"],
      ["Which chamber receives pulmonary venous return?", "Left atrium", "Right atrium", "Left ventricle", "Right ventricle", "1", "30"],
    ]));
    expect(result.questions).toEqual([{
      question: "Which chamber receives pulmonary venous return?",
      options: ["Left atrium", "Right atrium", "Left ventricle", "Right ventricle"],
      correctAnswer: 0,
      correctIndexes: [0],
      timeLimitSeconds: 30,
    }]);
  });

  it("uses the first scoreable choice and reports a warning for multiple correct answers", () => {
    const result = parseKahootSpreadsheet(workbookBuffer([
      ["Question", "Answer 1", "Answer 2", "Correct answer(s)", "Time limit (sec)"],
      ["Choose the atria", "Left atrium", "Right atrium", "1,2", "15"],
    ]));
    expect(result.questions[0].correctAnswer).toBe(0);
    expect(result.questions[0].timeLimitSeconds).toBe(20);
    expect(result.warnings[0]).toContain("multiple correct answers");
  });
});
