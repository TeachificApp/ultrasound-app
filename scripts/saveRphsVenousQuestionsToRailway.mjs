import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const DATASET_PATH = "/tmp/rphs-question-generation-validated.json";
const FOLDER_NAME = "RPhS";
const QUIZ_TITLE = "RPhS Test & Learn Quiz";
const QUESTION_COUNT = 350;

function normalizeStem(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toBuilderQuestion(question, questionBankId, order) {
  const choices = question.options.map((text, index) => ({
    id: String(index),
    text,
    feedback: text === question.correctAnswer ? question.correctFeedback : question.incorrectFeedback,
    correct: text === question.correctAnswer,
  }));
  return {
    id: `bank-${questionBankId}`,
    order,
    points: 1,
    stem: question.question,
    required: true,
    shuffleAnswerOptions: false,
    lockAnswerOrder: false,
    explanation: question.explanation,
    feedback: { correct: question.correctFeedback, incorrect: question.incorrectFeedback },
    image: null,
    video: null,
    feedbackImage: null,
    feedbackVideo: null,
    branchRules: [],
    type: "mcq",
    data: { multiple: false, choices },
  };
}

async function main() {
  const railwayUrl = process.env.RAILWAY_MYSQL_URL;
  if (!railwayUrl) throw new Error("RAILWAY_MYSQL_URL is required.");
  const dataset = JSON.parse(await readFile(DATASET_PATH, "utf8"));
  if (!dataset.valid || !Array.isArray(dataset.questions) || dataset.questions.length !== QUESTION_COUNT) {
    throw new Error(`Validated dataset must contain exactly ${QUESTION_COUNT} questions.`);
  }
  const stems = dataset.questions.map((question) => normalizeStem(question.question));
  if (new Set(stems).size !== QUESTION_COUNT) throw new Error("Validated dataset contains duplicate stems.");

  const db = await mysql.createConnection(railwayUrl);
  try {
    const [folders] = await db.query("SELECT id, name FROM question_bank_folders WHERE LOWER(name) = LOWER(?)", [FOLDER_NAME]);
    const [quizzes] = await db.query("SELECT id, title, builder_config FROM standalone_quizzes WHERE LOWER(title) = LOWER(?)", [QUIZ_TITLE]);
    if (folders.length !== 1) throw new Error(`Expected one ${FOLDER_NAME} Question Bank folder, found ${folders.length}.`);
    if (quizzes.length !== 1) throw new Error(`Expected one ${QUIZ_TITLE}, found ${quizzes.length}.`);
    const folder = folders[0];
    const quiz = quizzes[0];

    const [existingQuestions] = await db.query("SELECT id, question FROM question_bank WHERE folder_id = ?", [folder.id]);
    const existingStems = new Set(existingQuestions.map((row) => normalizeStem(row.question)));
    const collisions = dataset.questions.filter((question) => existingStems.has(normalizeStem(question.question)));
    if (collisions.length) throw new Error(`Refusing to create ${collisions.length} duplicate Question Bank stems in ${FOLDER_NAME}.`);

    const [[folderCount]] = await db.query("SELECT COUNT(*) AS count FROM question_bank WHERE folder_id = ?", [folder.id]);
    const [[linkCount]] = await db.query("SELECT COUNT(*) AS count FROM standalone_quiz_questions WHERE quiz_id = ?", [quiz.id]);
    const summary = {
      dryRun: process.env.APPLY !== "1",
      folder: { id: folder.id, name: folder.name, currentQuestionCount: Number(folderCount.count) },
      quiz: { id: quiz.id, title: quiz.title, currentQuestionCount: Number(linkCount.count) },
      proposedQuestionInserts: QUESTION_COUNT,
      proposedQuizLinks: QUESTION_COUNT,
      proposedFolderQuestionCount: Number(folderCount.count) + QUESTION_COUNT,
      proposedQuizQuestionCount: Number(linkCount.count) + QUESTION_COUNT,
      sourceSha256: createHash("sha256").update(JSON.stringify(dataset.questions)).digest("hex"),
      operations: ["insert question_bank rows", "insert standalone_quiz_questions rows", "update requested quiz builder_config only"],
      prohibitedOperations: ["no question_bank update", "no question_bank delete", "no standalone_quiz_questions delete", "no user/enrollment/access mutation"],
    };
    if (process.env.APPLY !== "1") {
      console.log(JSON.stringify(summary));
      return;
    }

    const [backupQuestions] = await db.query("SELECT * FROM question_bank WHERE folder_id = ?", [folder.id]);
    const [backupLinks] = await db.query("SELECT * FROM standalone_quiz_questions WHERE quiz_id = ?", [quiz.id]);
    const backupPath = `/tmp/railway-rphs-venous-question-backup-${Date.now()}.json.gz`;
    await writeFile(backupPath, gzipSync(JSON.stringify({ folder, quiz: { id: quiz.id, title: quiz.title, builderConfig: quiz.builder_config }, questions: backupQuestions, links: backupLinks })));

    await db.beginTransaction();
    try {
      const insertedIds = [];
      for (const question of dataset.questions) {
        const options = question.options.map((text) => ({
          text,
          feedback: text === question.correctAnswer ? question.correctFeedback : question.incorrectFeedback,
        }));
        const [result] = await db.execute(
          `INSERT INTO question_bank (question, type, options, correct_answer, correct_answers, explanation, correct_feedback, incorrect_feedback, folder_id, is_preset)
           VALUES (?, 'mcq', ?, ?, '[]', ?, ?, ?, ?, 0)`,
          [question.question, JSON.stringify(options), question.correctAnswer, question.explanation, question.correctFeedback, question.incorrectFeedback, folder.id],
        );
        insertedIds.push(Number(result.insertId));
      }
      const [[maxOrder]] = await db.query("SELECT COALESCE(MAX(sort_order), -1) AS value FROM standalone_quiz_questions WHERE quiz_id = ?", [quiz.id]);
      for (const [index, questionBankId] of insertedIds.entries()) {
        await db.execute(
          "INSERT INTO standalone_quiz_questions (quiz_id, question_bank_id, sort_order, points, shuffle_answer_options) VALUES (?, ?, ?, 1, 0)",
          [quiz.id, questionBankId, Number(maxOrder.value) + index + 1],
        );
      }
      let builderConfig;
      try { builderConfig = quiz.builder_config ? JSON.parse(quiz.builder_config) : {}; } catch { throw new Error("RPhS Quiz builder configuration is not valid JSON."); }
      if (!Array.isArray(builderConfig.questions)) builderConfig.questions = [];
      const existingBuilderIds = new Set(builderConfig.questions.map((question) => question.id));
      const newBuilderQuestions = dataset.questions
        .map((question, index) => toBuilderQuestion(question, insertedIds[index], Number(maxOrder.value) + index + 2))
        .filter((question) => !existingBuilderIds.has(question.id));
      if (newBuilderQuestions.length !== QUESTION_COUNT) throw new Error("RPhS Quiz builder already contains a generated question ID unexpectedly.");
      builderConfig.questions.push(...newBuilderQuestions);
      await db.execute("UPDATE standalone_quizzes SET builder_config = ? WHERE id = ?", [JSON.stringify(builderConfig), quiz.id]);
      await db.commit();
      const [[finalFolderCount]] = await db.query("SELECT COUNT(*) AS count FROM question_bank WHERE folder_id = ?", [folder.id]);
      const [[finalLinkCount]] = await db.query("SELECT COUNT(*) AS count FROM standalone_quiz_questions WHERE quiz_id = ?", [quiz.id]);
      console.log(JSON.stringify({ ...summary, dryRun: false, backupPath, insertedQuestionCount: insertedIds.length, linkedQuestionCount: insertedIds.length, finalFolderQuestionCount: Number(finalFolderCount.count), finalQuizQuestionCount: Number(finalLinkCount.count) }));
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } finally {
    await db.end();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
