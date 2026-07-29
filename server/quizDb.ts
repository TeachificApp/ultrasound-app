import { and, desc, eq, sql } from "drizzle-orm";
import {
  quizAnswerChoices,
  quizAttempts,
  quizQuestions,
  quizResponses,
  quizzes,
} from "../drizzle/schema";
import { getDb } from "./db";

// ─── Quizzes ──────────────────────────────────────────────────────────────────
export async function getQuizzesByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizzes).where(eq(quizzes.orgId, orgId)).orderBy(desc(quizzes.createdAt));
}

export async function getQuizById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  return result[0];
}

export async function createQuiz(data: typeof quizzes.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(quizzes).values(data);
  return getQuizById(result[0].insertId as number);
}

export async function updateQuiz(id: number, data: Partial<typeof quizzes.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(quizzes).set(data).where(eq(quizzes.id, id));
  return getQuizById(id);
}

export async function deleteQuiz(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quizResponses).where(
    eq(quizResponses.attemptId, sql`(SELECT id FROM quiz_attempts WHERE quizId = ${id})`)
  );
  await db.delete(quizAttempts).where(eq(quizAttempts.quizId, id));
  const questions = await getQuestionsByQuiz(id);
  for (const q of questions) {
    await db.delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, q.id));
  }
  await db.delete(quizQuestions).where(eq(quizQuestions.quizId, id));
  await db.delete(quizzes).where(eq(quizzes.id, id));
}

// ─── Questions ────────────────────────────────────────────────────────────────
export async function getQuestionsByQuiz(quizId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.sortOrder);
}

export async function createQuestion(data: typeof quizQuestions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(quizQuestions).values(data);
  return result[0];
}

export async function updateQuestion(id: number, data: Partial<typeof quizQuestions.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(quizQuestions).set(data).where(eq(quizQuestions.id, id));
}

export async function deleteQuestion(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, id));
  await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
}

// ─── Answer Choices ───────────────────────────────────────────────────────────
export async function getChoicesByQuestion(questionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizAnswerChoices)
    .where(eq(quizAnswerChoices.questionId, questionId))
    .orderBy(quizAnswerChoices.sortOrder);
}

export async function upsertChoices(
  questionId: number,
  choices: Array<{
    id?: number;
    sortOrder: number;
    choiceText: string;
    choiceHtml?: string;
    isCorrect: boolean;
    matchTarget?: string;
  }>
) {
  const db = await getDb();
  if (!db) return;
  // Delete existing and re-insert for simplicity
  await db.delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, questionId));
  if (choices.length > 0) {
    await db.insert(quizAnswerChoices).values(
      choices.map((c) => ({
        questionId,
        sortOrder: c.sortOrder,
        choiceText: c.choiceText,
        choiceHtml: c.choiceHtml,
        isCorrect: c.isCorrect,
        matchTarget: c.matchTarget,
      }))
    );
  }
}

// ─── Attempts ─────────────────────────────────────────────────────────────────
export async function createAttempt(data: typeof quizAttempts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(quizAttempts).values(data);
  return getAttemptById(result[0].insertId as number);
}

export async function getAttemptById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quizAttempts).where(eq(quizAttempts.id, id)).limit(1);
  return result[0];
}

export async function getAttemptsByQuiz(quizId: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const condition = userId
    ? and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId))
    : eq(quizAttempts.quizId, quizId);
  return db.select().from(quizAttempts).where(condition).orderBy(desc(quizAttempts.startedAt));
}

export async function submitAttempt(attemptId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Attempt not found");

  const quiz = await getQuizById(attempt.quizId);
  if (!quiz) throw new Error("Quiz not found");

  const responses = await getResponsesByAttempt(attemptId);
  const questions = await getQuestionsByQuiz(attempt.quizId);

  // Grade responses
  let totalPoints = 0;
  let earnedPoints = 0;

  for (const question of questions) {
    totalPoints += question.points;
    const response = responses.find((r) => r.questionId === question.id);
    if (!response) continue;

    const choices = await getChoicesByQuestion(question.id);
    let isCorrect = false;
    let pointsEarned = 0;

    if (question.questionType === "multiple_choice" || question.questionType === "true_false") {
      const selectedIds: number[] = response.selectedChoiceIds
        ? JSON.parse(response.selectedChoiceIds)
        : [];
      const correctChoice = choices.find((c) => c.isCorrect);
      isCorrect = correctChoice ? selectedIds.includes(correctChoice.id) : false;
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.questionType === "multiple_select") {
      const selectedIds: number[] = response.selectedChoiceIds
        ? JSON.parse(response.selectedChoiceIds)
        : [];
      const correctIds = choices.filter((c) => c.isCorrect).map((c) => c.id);
      const allCorrectSelected = correctIds.every((id) => selectedIds.includes(id));
      const noIncorrectSelected = selectedIds.every((id) => correctIds.includes(id));
      isCorrect = allCorrectSelected && noIncorrectSelected;
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.questionType === "short_answer") {
      // Short answer: manual grading or simple text match
      const correctChoice = choices.find((c) => c.isCorrect);
      if (correctChoice && response.responseText) {
        isCorrect = response.responseText.trim().toLowerCase() === correctChoice.choiceText.trim().toLowerCase();
        pointsEarned = isCorrect ? question.points : 0;
      }
    }

    earnedPoints += pointsEarned;
    await db.update(quizResponses).set({ isCorrect, pointsEarned }).where(eq(quizResponses.id, response.id));
  }

  const scorePct = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
  const isPassed = scorePct >= (quiz.passingScore ?? 70);
  const timeTaken = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);

  await db.update(quizAttempts).set({
    submittedAt: new Date(),
    scoreRaw: earnedPoints,
    scorePct,
    isPassed,
    isCompleted: true,
    timeTakenSeconds: timeTaken,
  }).where(eq(quizAttempts.id, attemptId));

  return getAttemptById(attemptId);
}

// ─── Responses ────────────────────────────────────────────────────────────────
export async function saveResponse(data: typeof quizResponses.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  // Upsert: delete existing response for this question in this attempt, then insert
  await db.delete(quizResponses).where(
    and(eq(quizResponses.attemptId, data.attemptId!), eq(quizResponses.questionId, data.questionId!))
  );
  await db.insert(quizResponses).values(data);
}

export async function getResponsesByAttempt(attemptId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizResponses).where(eq(quizResponses.attemptId, attemptId));
}

// ─── Quiz Analytics ───────────────────────────────────────────────────────────
export async function getQuizAnalytics(quizId: number) {
  const db = await getDb();
  if (!db) return { totalAttempts: 0, avgScore: 0, passRate: 0, questions: [] };

  const attempts = await db.select().from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.isCompleted, true)));

  const totalAttempts = attempts.length;
  const avgScore = totalAttempts > 0
    ? attempts.reduce((sum, a) => sum + (a.scorePct ?? 0), 0) / totalAttempts
    : 0;
  const passRate = totalAttempts > 0
    ? (attempts.filter((a) => a.isPassed).length / totalAttempts) * 100
    : 0;

  const questions = await getQuestionsByQuiz(quizId);
  const questionStats = await Promise.all(
    questions.map(async (q) => {
      const responses = await db!.select().from(quizResponses)
        .where(eq(quizResponses.questionId, q.id));
      const correct = responses.filter((r) => r.isCorrect).length;
      return {
        questionId: q.id,
        questionText: q.questionText,
        totalResponses: responses.length,
        correctResponses: correct,
        correctRate: responses.length > 0 ? (correct / responses.length) * 100 : 0,
      };
    })
  );

  return { totalAttempts, avgScore, passRate, questions: questionStats };
}
