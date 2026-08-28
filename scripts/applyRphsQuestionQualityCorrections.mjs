import { gzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const ORIGINAL_DATASET = "/tmp/rphs-question-generation-validated.json";
const REPLACEMENT_DATASET = "/tmp/rphs-quality-replacements-approved-candidates.json";
const FINAL_REVIEW = "/tmp/rphs-final-four-audit-output.jsonl";
const FOLDER_ID = 1;
const QUIZ_ID = 30001;
const CORRECTION_COUNT = 99;

function toOptions(question) {
  return question.options.map((text) => ({
    text,
    feedback: text === question.correctAnswer ? question.correctFeedback : question.incorrectFeedback,
  }));
}

function toBuilderUpdate(existing, question) {
  return {
    ...existing,
    type: "mcq",
    stem: question.question,
    explanation: question.explanation,
    feedback: { correct: question.correctFeedback, incorrect: question.incorrectFeedback },
    data: {
      multiple: false,
      choices: question.options.map((text, index) => ({
        id: String(index),
        text,
        feedback: text === question.correctAnswer ? question.correctFeedback : question.incorrectFeedback,
        correct: text === question.correctAnswer,
      })),
    },
  };
}

async function main() {
  const railwayUrl = process.env.RAILWAY_MYSQL_URL;
  if (!railwayUrl) throw new Error("RAILWAY_MYSQL_URL is required.");
  const original = JSON.parse(await readFile(ORIGINAL_DATASET, "utf8"));
  const replacementsFile = JSON.parse(await readFile(REPLACEMENT_DATASET, "utf8"));
  const replacements = Object.fromEntries(Object.entries(replacementsFile.replacements).map(([index, question]) => [Number(index), question]));
  if (!original.valid || original.questions.length !== 350 || Object.keys(replacements).length !== CORRECTION_COUNT) {
    throw new Error("Expected 350 original questions and exactly 99 validated replacement questions.");
  }
  const finalReview = JSON.parse((await readFile(FINAL_REVIEW, "utf8")).split("\n").filter(Boolean)[0]);
  const finalReviews = JSON.parse(finalReview.output).reviews;
  if (finalReviews.length !== 4 || finalReviews.some((review) => review.verdict !== "approve")) {
    throw new Error("Final four-question factual review did not fully approve the final retry candidates.");
  }

  const db = await mysql.createConnection(railwayUrl);
  try {
    const indices = Object.keys(replacements).map(Number).sort((a, b) => a - b);
    const originalStems = indices.map((index) => original.questions[index].question);
    const placeholders = originalStems.map(() => "?").join(",");
    const [targetQuestions] = await db.query(
      `SELECT id, question, options, correct_answer, explanation, correct_feedback, incorrect_feedback
       FROM question_bank WHERE folder_id = ? AND question IN (${placeholders})`,
      [FOLDER_ID, ...originalStems],
    );
    if (targetQuestions.length !== CORRECTION_COUNT) throw new Error(`Expected ${CORRECTION_COUNT} exact generated Railway question stems, found ${targetQuestions.length}.`);
    const byStem = new Map(targetQuestions.map((row) => [row.question, row]));
    const targets = indices.map((index) => ({ index, original: original.questions[index], replacement: replacements[index], target: byStem.get(original.questions[index].question) }));
    if (targets.some((entry) => !entry.target)) throw new Error("At least one replacement target was not found exactly once.");
    const [links] = await db.query(
      `SELECT question_bank_id, sort_order FROM standalone_quiz_questions WHERE quiz_id = ? AND question_bank_id IN (${targetQuestions.map(() => "?").join(",")})`,
      [QUIZ_ID, ...targetQuestions.map((question) => question.id)],
    );
    if (links.length !== CORRECTION_COUNT) throw new Error(`Expected ${CORRECTION_COUNT} matching RPhS Quiz links, found ${links.length}.`);
    const [quizRows] = await db.query("SELECT id, title, builder_config FROM standalone_quizzes WHERE id = ?", [QUIZ_ID]);
    if (quizRows.length !== 1 || quizRows[0].title !== "RPhS Test & Learn Quiz") throw new Error("Expected RPhS Test & Learn Quiz target.");
    let builderConfig;
    try { builderConfig = JSON.parse(quizRows[0].builder_config || "{}"); } catch { throw new Error("RPhS Quiz builder configuration is invalid JSON."); }
    if (!Array.isArray(builderConfig.questions)) throw new Error("RPhS Quiz builder configuration has no question list.");
    const targetBuilderIds = new Set(targetQuestions.map((question) => `bank-${question.id}`));
    const builderTargets = builderConfig.questions.filter((question) => targetBuilderIds.has(question.id));
    if (builderTargets.length !== CORRECTION_COUNT) throw new Error(`Expected ${CORRECTION_COUNT} generated Question Bank entries in the RPhS Quiz builder, found ${builderTargets.length}.`);

    const summary = {
      dryRun: process.env.APPLY !== "1",
      correctedQuestionCount: CORRECTION_COUNT,
      folderId: FOLDER_ID,
      quizId: QUIZ_ID,
      operations: ["backup 99 target question rows and current RPhS Quiz builder configuration", "update 99 generated question rows only", "update matching RPhS Quiz builder entries only"],
      prohibitedOperations: ["no new Question Bank rows", "no delete", "no quiz-link change", "no user, enrollment, access, or unrelated content mutation"],
    };
    if (process.env.APPLY !== "1") {
      console.log(JSON.stringify(summary));
      return;
    }

    const backupPath = `/tmp/railway-rphs-question-quality-correction-backup-${Date.now()}.json.gz`;
    await writeFile(backupPath, gzipSync(JSON.stringify({ questionBank: targetQuestions, builderConfig: quizRows[0].builder_config, links })));
    await db.beginTransaction();
    try {
      for (const entry of targets) {
        const question = entry.replacement;
        await db.execute(
          `UPDATE question_bank SET question = ?, type = 'mcq', options = ?, correct_answer = ?, correct_answers = '[]', explanation = ?, correct_feedback = ?, incorrect_feedback = ? WHERE id = ?`,
          [question.question, JSON.stringify(toOptions(question)), question.correctAnswer, question.explanation, question.correctFeedback, question.incorrectFeedback, entry.target.id],
        );
      }
      const targetById = new Map(targets.map((entry) => [`bank-${entry.target.id}`, entry.replacement]));
      builderConfig.questions = builderConfig.questions.map((question) => targetById.has(question.id) ? toBuilderUpdate(question, targetById.get(question.id)) : question);
      await db.execute("UPDATE standalone_quizzes SET builder_config = ? WHERE id = ?", [JSON.stringify(builderConfig), QUIZ_ID]);
      await db.commit();
    } catch (error) {
      await db.rollback();
      throw error;
    }
    console.log(JSON.stringify({ ...summary, dryRun: false, backupPath, updatedQuestionCount: targets.length, updatedBuilderEntryCount: builderTargets.length }));
  } finally {
    await db.end();
  }
}

main().then(() => process.exit(0), (error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
