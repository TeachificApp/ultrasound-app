import { and, eq, isNull } from "drizzle-orm";
import { lmsCourses, lmsLessons, lmsQuizQuestions, lmsQuizzes, questionBank, questionBankFolders } from "../../drizzle/schema";

const BANK_TYPES = new Set(["mcq", "truefalse", "multiselect", "hotspot", "matching"]);
type BankType = "mcq" | "truefalse" | "multiselect" | "hotspot" | "matching";

function asQuestionBankType(type: unknown): BankType {
  return BANK_TYPES.has(String(type)) ? String(type) as BankType : "mcq";
}

async function ensureLessonQuizCourseFolder(db: any, courseId: number, adminId: number) {
  const [course] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
  const courseFolderName = course?.title?.trim() || `Course ${courseId}`;

  let [parent] = await db.select({ id: questionBankFolders.id }).from(questionBankFolders)
    .where(and(eq(questionBankFolders.name, "Lesson Quiz"), isNull(questionBankFolders.parentId))).limit(1);
  if (!parent) {
    const [created] = await db.insert(questionBankFolders).values({
      name: "Lesson Quiz", description: "Questions synchronized from course lesson quizzes.", createdByAdminId: adminId,
    }).$returningId();
    parent = { id: created.id };
  }

  let [courseFolder] = await db.select({ id: questionBankFolders.id }).from(questionBankFolders)
    .where(and(eq(questionBankFolders.name, courseFolderName), eq(questionBankFolders.parentId, parent.id))).limit(1);
  if (!courseFolder) {
    const [created] = await db.insert(questionBankFolders).values({
      name: courseFolderName, description: `Lesson quiz questions for ${courseFolderName}.`, parentId: parent.id, createdByAdminId: adminId,
    }).$returningId();
    courseFolder = { id: created.id };
  }
  return courseFolder.id;
}

/** Persist page-builder lesson_quiz block questions. Re-saving a lesson updates the same source-keyed bank questions. */
export async function syncLessonQuizBlocksToQuestionBank(db: any, lessonId: number, contentBlocks: string | null | undefined, adminId: number) {
  if (!contentBlocks) return { created: 0, updated: 0 };
  let blocks: any[];
  try { blocks = JSON.parse(contentBlocks); } catch { return { created: 0, updated: 0 }; }
  if (!Array.isArray(blocks)) return { created: 0, updated: 0 };
  const [lesson] = await db.select({ courseId: lmsLessons.courseId }).from(lmsLessons).where(eq(lmsLessons.id, lessonId)).limit(1);
  if (!lesson?.courseId) return { created: 0, updated: 0 };
  const folderId = await ensureLessonQuizCourseFolder(db, lesson.courseId, adminId);

  let created = 0, updated = 0;
  for (const block of blocks) {
    if (block?.type !== "lesson_quiz" || !Array.isArray(block?.data?.questions)) continue;
    for (const [index, question] of block.data.questions.entries()) {
      if (!question?.question?.trim()) continue;
      const type = asQuestionBankType(question.type);
      const options = type === "truefalse" ? JSON.stringify([{ text: "True" }, { text: "False" }])
        : type === "hotspot" || type === "matching" ? null
        : JSON.stringify((question.options ?? []).map((text: string, i: number) => ({ text, imageUrl: question.answerImages?.[i] })));
      const values = {
        question: question.question.trim(), type, options,
        correctAnswer: type === "truefalse" ? (question.correctAnswer === 0 ? "True" : "False") : type === "mcq" ? (question.options?.[question.correctAnswer] ?? "") : "",
        correctAnswers: type === "multiselect" ? JSON.stringify(question.correctAnswers ?? []) : null,
        explanation: question.explanation ?? null,
        questionImageUrl: type === "hotspot" ? (question.hotspotImageUrl ?? question.imageUrl ?? null) : (question.imageUrl ?? null),
        questionVideoUrl: question.videoUrl ?? null,
        hotspotMarkers: type === "hotspot" ? JSON.stringify(question.hotspotMarkers ?? []) : null,
        matchingPairs: type === "matching" ? JSON.stringify(question.matchingPairs ?? []) : null,
        feedbackImageUrl: question.feedbackImageUrl ?? null, feedbackVideoUrl: question.feedbackVideoUrl ?? null,
        sourceLessonId: lessonId, sourceBlockId: String(block.id ?? "lesson-quiz"), sourceQuestionIndex: index,
        folderId, createdByAdminId: adminId,
      };
      const [existing] = await db.select({ id: questionBank.id }).from(questionBank).where(and(
        eq(questionBank.sourceLessonId, lessonId), eq(questionBank.sourceBlockId, values.sourceBlockId), eq(questionBank.sourceQuestionIndex, index),
      )).limit(1);
      if (existing) { await db.update(questionBank).set(values).where(eq(questionBank.id, existing.id)); updated += 1; }
      else { await db.insert(questionBank).values(values); created += 1; }
    }
  }
  return { created, updated };
}

/** Keep legacy lms_quiz_questions synchronized with the same Lesson Quiz course folders. */
export async function syncLegacyLessonQuizQuestionToBank(db: any, quizQuestionId: number, adminId: number) {
  const [question] = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.id, quizQuestionId)).limit(1);
  if (!question) return { created: 0, updated: 0 };
  const [quiz] = await db.select({ lessonId: lmsQuizzes.lessonId }).from(lmsQuizzes).where(eq(lmsQuizzes.id, question.quizId)).limit(1);
  if (!quiz?.lessonId) return { created: 0, updated: 0 };
  const [lesson] = await db.select({ courseId: lmsLessons.courseId }).from(lmsLessons).where(eq(lmsLessons.id, quiz.lessonId)).limit(1);
  if (!lesson?.courseId) return { created: 0, updated: 0 };
  let rawOptions: string[] = [];
  try { rawOptions = question.options ? JSON.parse(question.options) : []; } catch { rawOptions = []; }
  const values = {
    question: question.question, type: asQuestionBankType(question.type), options: JSON.stringify(rawOptions.map((text: string) => ({ text }))),
    correctAnswer: question.correctAnswer ?? "", correctAnswers: (question as any).correctAnswers ?? null,
    explanation: question.explanation ?? null, questionImageUrl: (question as any).questionImageUrl ?? null,
    questionVideoUrl: (question as any).questionVideoUrl ?? null, hotspotMarkers: (question as any).hotspotMarkers ?? null,
    matchingPairs: (question as any).matchingPairs ?? null, feedbackImageUrl: (question as any).feedbackImageUrl ?? null,
    feedbackVideoUrl: (question as any).feedbackVideoUrl ?? null, sourceQuizId: question.quizId,
    sourceQuizQuestionId: question.id, folderId: await ensureLessonQuizCourseFolder(db, lesson.courseId, adminId), createdByAdminId: adminId,
  };
  const [existing] = await db.select({ id: questionBank.id }).from(questionBank).where(eq(questionBank.sourceQuizQuestionId, question.id)).limit(1);
  if (existing) { await db.update(questionBank).set(values).where(eq(questionBank.id, existing.id)); return { created: 0, updated: 1 }; }
  await db.insert(questionBank).values(values);
  return { created: 1, updated: 0 };
}
