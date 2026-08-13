import * as XLSX from "xlsx";
import type { QuestionGroup, QuizFile, QuizQuestion } from "../types/quiz";

const GROUP_COLORS = ["#189aa1", "#4ad9e0", "#0f766e", "#0ea5e9", "#14b8a6", "#64748b"];

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getCell(row: unknown[], index: number) {
  return String(row[index] ?? "").trim();
}

/**
 * Converts the documented Excel template into a Visual Builder QuizFile.
 * Add an optional `Group` column after `Points` to preserve named groups.
 * Image, Video, and Audio cells are retained as URLs exactly as supplied.
 */
export async function importExcelQuiz(file: File): Promise<{ quiz: QuizFile; warnings: string[] }> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellText: true, cellDates: false });
  const sheetName = workbook.SheetNames.includes("Questions") ? "Questions" : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("The workbook does not contain a readable Questions sheet.");
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
  const headerIndex = rows.findIndex((row) => getCell(row, 0).toLowerCase() === "question type");
  if (headerIndex < 0) throw new Error("Use the Quiz Creator Excel template: the first column must be Question Type.");
  const header = rows[headerIndex].map((cell) => String(cell).trim().toLowerCase());
  const groupColumn = header.findIndex((cell) => cell === "group" || cell === "question group" || cell === "category");
  const groupsByName = new Map<string, QuestionGroup>();
  const warnings: string[] = [];
  const questions: QuizQuestion[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const typeCode = getCell(row, 0).toUpperCase();
    const stem = getCell(row, 1);
    if (!typeCode && !stem) continue;
    if (!stem || typeCode.startsWith("[")) {
      warnings.push("Skipped an empty or placeholder spreadsheet row.");
      continue;
    }
    const imageUrl = getCell(row, 2);
    const videoUrl = getCell(row, 3);
    const audioUrl = getCell(row, 4);
    const answers = Array.from({ length: 10 }, (_, index) => getCell(row, index + 5)).filter(Boolean);
    const correctFeedback = getCell(row, 15);
    const incorrectFeedback = getCell(row, 16);
    const points = Number(getCell(row, 17)) || 1;
    const groupName = groupColumn >= 0 ? getCell(row, groupColumn) : "";
    let groupId: string | undefined;
    if (groupName) {
      let group = groupsByName.get(groupName);
      if (!group) {
        group = { id: id("group"), name: groupName, color: GROUP_COLORS[groupsByName.size % GROUP_COLORS.length] };
        groupsByName.set(groupName, group);
      }
      groupId = group.id;
    }
    const shared = {
      id: id("question"), order: questions.length, points, required: true, stem,
      image: imageUrl ? { url: imageUrl, alt: "" } : null,
      video: videoUrl ? { url: videoUrl } : null,
      audio: audioUrl ? { url: audioUrl } : null,
      explanation: correctFeedback || incorrectFeedback || "",
      feedback: { correct: correctFeedback || undefined, incorrect: incorrectFeedback || undefined },
      groupId,
    };
    if (typeCode === "TF") {
      const trueIsCorrect = answers.find((answer) => answer.replace(/^\*/, "").toLowerCase() === "true")?.startsWith("*") ?? true;
      questions.push({ ...shared, type: "tf", data: { correct: trueIsCorrect, trueFeedback: trueIsCorrect ? correctFeedback : incorrectFeedback, falseFeedback: trueIsCorrect ? incorrectFeedback : correctFeedback } });
    } else if (typeCode === "MG" || typeCode === "MS") {
      questions.push({ ...shared, type: "matching", data: { pairs: answers.map((answer) => {
        const [premise, response] = answer.replace(/^\*/, "").split("|");
        return { id: id("pair"), premise: premise?.trim() || answer, response: response?.trim() || "" };
      }) } });
    } else if (typeCode === "SEQ" || typeCode === "RNK") {
      questions.push({ ...shared, type: "ordering", data: { items: answers.map((answer) => ({ id: id("item"), text: answer.replace(/^\*/, "") })) } });
    } else if (typeCode === "TI" || typeCode === "SA") {
      questions.push({ ...shared, type: "short_answer", data: { sampleAnswer: answers[0]?.replace(/^\*/, "") || "", keywords: answers.map((answer) => answer.replace(/^\*/, "")).filter(Boolean), autoGrade: true } });
    } else if (typeCode === "NUMG") {
      questions.push({ ...shared, type: "numeric", data: { correctValue: Number((answers.find((answer) => answer.startsWith("*")) || answers[0] || "0").replace(/^\*/, "")), tolerance: 0, allowRange: false } });
    } else if (typeCode === "ESS") {
      questions.push({ ...shared, type: "essay", data: { placeholder: "Enter your answer" } });
    } else {
      const multiSelect = typeCode === "MR" || typeCode === "PM";
      questions.push({ ...shared, type: "mcq", data: { multiSelect, choices: answers.map((answer) => ({ id: id("choice"), text: answer.replace(/^\*/, ""), correct: answer.startsWith("*"), feedback: answer.startsWith("*") ? correctFeedback || undefined : incorrectFeedback || undefined })) } });
    }
  }
  if (questions.length === 0) throw new Error("No importable questions were found in this Excel file.");
  const now = new Date().toISOString();
  return {
    quiz: {
      meta: {
        id: id("quiz"), title: file.name.replace(/\.[^.]+$/, "") || "Imported Excel Quiz", description: "", author: "", authorEmail: "", createdAt: now, updatedAt: now, version: 1, licenseKey: null, teachificOrgId: null, tags: [], passingScore: 70, timeLimit: null, shuffleQuestions: false, shuffleAnswers: false, showFeedback: "immediate", allowRetry: true, maxAttempts: 0, groups: Array.from(groupsByName.values()),
      },
      questions,
    },
    warnings,
  };
}
