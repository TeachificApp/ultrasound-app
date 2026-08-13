import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { importExcelQuiz } from "../client/src/quiz-creator/lib/excelQuizImporter";

describe("Visual Builder Excel template import", () => {
  it("preserves question groups, media URLs, answers, and feedback", async () => {
    const rows = [
      ["Question Type", "Question Text", "Image", "Video", "Audio", "Answer 1", "Answer 2", "Correct Feedback", "Incorrect Feedback", "Points", "Group"],
      ["MC", "Which structure is assessed?", "https://cdn.example/image.png", "https://cdn.example/video.mp4", "", "*Mitral valve", "Aortic valve", "Correct: assess the mitral valve.", "Review the image again.", "2", "Valve Assessment"],
    ];
    // The documented template reserves answer columns 5–14 and feedback at 15–17.
    const normalizedRow = Array(19).fill("");
    normalizedRow[0] = "MC";
    normalizedRow[1] = "Which structure is assessed?";
    normalizedRow[2] = "https://cdn.example/image.png";
    normalizedRow[3] = "https://cdn.example/video.mp4";
    normalizedRow[5] = "*Mitral valve";
    normalizedRow[6] = "Aortic valve";
    normalizedRow[15] = "Correct: assess the mitral valve.";
    normalizedRow[16] = "Review the image again.";
    normalizedRow[17] = "2";
    normalizedRow[18] = "Valve Assessment";
    const header = Array(19).fill("");
    header[0] = "Question Type";
    header[1] = "Question Text";
    header[2] = "Image";
    header[3] = "Video";
    header[18] = "Group";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header, normalizedRow]), "Questions");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = { name: "valves.xlsx", arrayBuffer: async () => buffer } as File;

    const { quiz } = await importExcelQuiz(file);
    expect(quiz.meta.groups).toHaveLength(1);
    expect(quiz.meta.groups?.[0]?.name).toBe("Valve Assessment");
    expect(quiz.questions).toHaveLength(1);
    const question = quiz.questions[0];
    expect(question.groupId).toBe(quiz.meta.groups?.[0]?.id);
    expect(question.image?.url).toBe("https://cdn.example/image.png");
    expect(question.video?.url).toBe("https://cdn.example/video.mp4");
    expect(question.points).toBe(2);
    expect(question.type).toBe("mcq");
    expect((question.data as any).choices[0]).toMatchObject({ text: "Mitral valve", correct: true });
  });
});
