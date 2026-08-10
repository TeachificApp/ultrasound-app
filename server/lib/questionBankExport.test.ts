import { describe, it, expect } from "vitest";
import {
  IMPORT_TEMPLATE_DIR,
  exportQuestionsToCsv,
  questionBankRowToExportQuestion,
  stripHtmlForExport,
} from "./questionBankExport";

describe("questionBankExport", () => {
  it("strips HTML from question text", () => {
    expect(stripHtmlForExport("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("converts MCQ rows with starred correct answer export format", () => {
    const exported = questionBankRowToExportQuestion({
      question: "<p>What is 2+2?</p>",
      type: "mcq",
      options: [
        { text: "3" },
        { text: "4" },
        { text: "5" },
      ],
      correctAnswer: "4",
      questionImageUrl: "https://cdn.example.com/q-image.png",
    });

    expect(exported.questionType).toBe("multiple_choice");
    expect(exported.questionText).toBe("What is 2+2?");
    expect(exported.imagePath).toBe("https://cdn.example.com/q-image.png");
    expect(exported.choices[1].isCorrect).toBe(true);
  });

  it("converts true/false questions", () => {
    const exported = questionBankRowToExportQuestion({
      question: "The sun is a star.",
      type: "truefalse",
      options: [{ text: "True" }, { text: "False" }],
      correctAnswer: "True",
    });
    expect(exported.questionType).toBe("true_false");
    expect(exported.choices[0].isCorrect).toBe(true);
    expect(exported.choices[1].isCorrect).toBe(false);
  });

  it("converts matching pairs to MG rows", () => {
    const exported = questionBankRowToExportQuestion({
      question: "Match the terms",
      type: "matching",
      options: [],
      correctAnswer: "",
      matchingPairs: [
        { left: "Aorta", right: "Artery" },
        { left: "Vena cava", right: "Vein" },
      ],
    });
    expect(exported.questionType).toBe("matching");
    expect(exported.choices[0]).toMatchObject({ choiceText: "Aorta", matchTarget: "Artery" });
  });

  it("exports CSV with iSpring header including Answer 1 - CORRECT ANSWER", () => {
    const csv = exportQuestionsToCsv([
      questionBankRowToExportQuestion({
        question: "Pick one",
        type: "mcq",
        options: [{ text: "Yes" }, { text: "No" }],
        correctAnswer: "Yes",
      }),
    ]);
    const [header, row] = csv.split("\n");
    expect(header).toContain("Answer 1 - CORRECT ANSWER");
    expect(row.startsWith("MC,")).toBe(true);
    expect(row).toContain("*Yes");
  });

  it("uses Import Template folder constants", () => {
    expect(IMPORT_TEMPLATE_DIR).toBe("Import Template");
  });
});
