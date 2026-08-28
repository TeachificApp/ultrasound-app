import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const DATASET_PATH = "/tmp/rphs-question-generation-validated.json";
const FOLDER_ID = 1;
const QUIZ_ID = 30001;
const EXPECTED_NEW_QUESTION_COUNT = 350;

const normalizeStem = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const dataset = JSON.parse(await readFile(DATASET_PATH, "utf8"));
if (!dataset.valid || dataset.questions.length !== EXPECTED_NEW_QUESTION_COUNT) {
  throw new Error("The validated source dataset is unavailable or does not contain 350 questions.");
}
const expectedHash = createHash("sha256").update(JSON.stringify(dataset.questions)).digest("hex");
const sourceStems = new Set(dataset.questions.map((question) => normalizeStem(question.question)));

const railwayUrl = process.env.RAILWAY_MYSQL_URL;
if (!railwayUrl) throw new Error("RAILWAY_MYSQL_URL is required.");
const db = await mysql.createConnection(railwayUrl);
try {
  const [folderRows] = await db.query("SELECT id, name FROM question_bank_folders WHERE id = ?", [FOLDER_ID]);
  const [quizRows] = await db.query("SELECT id, title, builder_config FROM standalone_quizzes WHERE id = ?", [QUIZ_ID]);
  const [questions] = await db.query(
    `SELECT qb.id, qb.question, qb.options, qb.correct_answer, qb.explanation, qb.correct_feedback, qb.incorrect_feedback, sq.question_bank_id AS linked_question_id
     FROM question_bank qb
     LEFT JOIN standalone_quiz_questions sq ON sq.question_bank_id = qb.id AND sq.quiz_id = ?
     WHERE qb.folder_id = ?
     ORDER BY qb.id DESC LIMIT ?`,
    [QUIZ_ID, FOLDER_ID, EXPECTED_NEW_QUESTION_COUNT],
  );
  const [folderCounts] = await db.query("SELECT COUNT(*) AS count FROM question_bank WHERE folder_id = ?", [FOLDER_ID]);
  const [quizCounts] = await db.query("SELECT COUNT(*) AS count FROM standalone_quiz_questions WHERE quiz_id = ?", [QUIZ_ID]);
  const failures = [];
  if (folderRows.length !== 1 || folderRows[0].name.toLowerCase() !== "rphs") failures.push("RPhS folder target was not found.");
  if (quizRows.length !== 1 || quizRows[0].title !== "RPhS Test & Learn Quiz") failures.push("RPhS Quiz target was not found.");
  if (questions.length !== EXPECTED_NEW_QUESTION_COUNT) failures.push(`Expected ${EXPECTED_NEW_QUESTION_COUNT} newest RPhS questions, found ${questions.length}.`);
  if (Number(folderCounts[0].count) !== 500) failures.push(`Expected 500 RPhS folder questions, found ${folderCounts[0].count}.`);
  if (Number(quizCounts[0].count) !== 400) failures.push(`Expected 400 RPhS Quiz links, found ${quizCounts[0].count}.`);
  for (const question of questions) {
    const options = JSON.parse(question.options || "[]");
    if (!sourceStems.has(normalizeStem(question.question))) failures.push(`Question ${question.id} is not a generated source stem.`);
    if (options.length !== 4 || !options.some((option) => option.text === question.correct_answer)) failures.push(`Question ${question.id} has an invalid option/correct-answer relationship.`);
    if (!question.explanation || !question.correct_feedback || !question.incorrect_feedback) failures.push(`Question ${question.id} is missing required editable feedback.`);
    if (!question.linked_question_id) failures.push(`Question ${question.id} is not linked to RPhS Quiz.`);
  }
  let builderQuestionCount = 0;
  let builderNewQuestionCount = 0;
  try {
    const config = JSON.parse(quizRows[0]?.builder_config || "{}");
    builderQuestionCount = Array.isArray(config.questions) ? config.questions.length : 0;
    builderNewQuestionCount = (config.questions || []).filter((question) => /^bank-\d+$/.test(question.id) && questions.some((row) => question.id === `bank-${row.id}`)).length;
  } catch {
    failures.push("RPhS Quiz builder configuration is not valid JSON.");
  }
  if (builderNewQuestionCount !== EXPECTED_NEW_QUESTION_COUNT) failures.push(`Expected ${EXPECTED_NEW_QUESTION_COUNT} generated Question Bank entries in the quiz builder, found ${builderNewQuestionCount}.`);
  const result = {
    valid: failures.length === 0,
    folder: { id: FOLDER_ID, name: folderRows[0]?.name ?? null, questionCount: Number(folderCounts[0].count) },
    quiz: { id: QUIZ_ID, title: quizRows[0]?.title ?? null, linkCount: Number(quizCounts[0].count), builderQuestionCount, builderGeneratedQuestionCount: builderNewQuestionCount },
    generatedQuestionCount: questions.length,
    expectedSourceSha256: expectedHash,
    failures,
  };
  await writeFile("/tmp/railway-rphs-venous-question-verification.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (failures.length) process.exitCode = 1;
} finally {
  await db.end();
}
