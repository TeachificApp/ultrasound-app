import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const ORIGINAL_DATASET = "/tmp/rphs-question-generation-validated.json";
const REPLACEMENT_DATASET = "/tmp/rphs-quality-replacements-approved-candidates.json";
const FOLDER_ID = 1;
const QUIZ_ID = 30001;

async function main() {
  const railwayUrl = process.env.RAILWAY_MYSQL_URL;
  if (!railwayUrl) throw new Error("RAILWAY_MYSQL_URL is required.");
  const original = JSON.parse(await readFile(ORIGINAL_DATASET, "utf8"));
  const replacements = Object.fromEntries(Object.entries(JSON.parse(await readFile(REPLACEMENT_DATASET, "utf8")).replacements).map(([index, question]) => [Number(index), question]));
  const db = await mysql.createConnection(railwayUrl);
  try {
    const indices = Object.keys(replacements).map(Number).sort((a, b) => a - b);
    const expectedStems = indices.map((index) => replacements[index].question);
    const [correctedRows] = await db.query(`SELECT id, question, options, correct_answer, explanation, correct_feedback, incorrect_feedback FROM question_bank WHERE folder_id = ? AND question IN (${expectedStems.map(() => "?").join(",")})`, [FOLDER_ID, ...expectedStems]);
    const byStem = new Map(correctedRows.map((row) => [row.question, row]));
    const mismatches = [];
    for (const index of indices) {
      const expected = replacements[index];
      const row = byStem.get(expected.question);
      if (!row) { mismatches.push({ index, field: "question" }); continue; }
      let options = [];
      try { options = typeof row.options === "string" ? JSON.parse(row.options) : row.options; } catch { mismatches.push({ index, field: "options-json" }); continue; }
      const optionTexts = options.map((option) => typeof option === "string" ? option : option.text);
      if (row.correct_answer !== expected.correctAnswer) mismatches.push({ index, field: "correct_answer" });
      if (row.explanation !== expected.explanation) mismatches.push({ index, field: "explanation" });
      if (row.correct_feedback !== expected.correctFeedback) mismatches.push({ index, field: "correct_feedback" });
      if (row.incorrect_feedback !== expected.incorrectFeedback) mismatches.push({ index, field: "incorrect_feedback" });
      if (JSON.stringify(optionTexts) !== JSON.stringify(expected.options)) mismatches.push({ index, field: "options" });
    }
    const [folderCounts] = await db.query("SELECT COUNT(*) AS count FROM question_bank WHERE folder_id = ?", [FOLDER_ID]);
    const [linkCounts] = await db.query("SELECT COUNT(*) AS count FROM standalone_quiz_questions WHERE quiz_id = ?", [QUIZ_ID]);
    const [quizRows] = await db.query("SELECT title, builder_config FROM standalone_quizzes WHERE id = ?", [QUIZ_ID]);
    const builderQuestions = JSON.parse(quizRows[0].builder_config).questions || [];
    const correctedIds = new Set(correctedRows.map((row) => `bank-${row.id}`));
    const builderMatches = builderQuestions.filter((question) => correctedIds.has(question.id) && replacements[indices.find((index) => replacements[index].question === question.stem)]).length;
    const result = {
      valid: mismatches.length === 0 && correctedRows.length === 99 && Number(folderCounts[0].count) === 500 && Number(linkCounts[0].count) === 400 && builderQuestions.length === 400 && builderMatches === 99,
      verifiedCorrectionCount: correctedRows.length,
      folderQuestionCount: Number(folderCounts[0].count),
      quizLinkCount: Number(linkCounts[0].count),
      builderQuestionCount: builderQuestions.length,
      matchingBuilderEntryCount: builderMatches,
      mismatchCount: mismatches.length,
      mismatches,
    };
    console.log(JSON.stringify(result));
    if (!result.valid) process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
