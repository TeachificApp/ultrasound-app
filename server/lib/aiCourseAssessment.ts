import { lmsLessons, lmsQuizQuestions, lmsQuizzes, lmsSections } from "../../drizzle/schema";

/** Persists a generated final assessment as a dedicated final course section. */
export async function persistGeneratedCourseAssessment(db: any, courseId: number, sectionPosition: number, courseQuiz: any) {
  if (!courseQuiz || !Array.isArray(courseQuiz.questions) || courseQuiz.questions.length === 0) return false;
  const [assessmentSection] = await db.insert(lmsSections).values({ courseId, title: "Course Assessment", position: sectionPosition }).$returningId();
  const assessmentTitle = courseQuiz.title ?? "Course Assessment";
  const [assessmentLesson] = await db.insert(lmsLessons).values({
    courseId, sectionId: assessmentSection.id, title: assessmentTitle, type: "quiz", position: 0, content: null, durationMinutes: 10, mediaAssetId: null,
  }).$returningId();
  const [assessmentQuiz] = await db.insert(lmsQuizzes).values({ lessonId: assessmentLesson.id, title: assessmentTitle }).$returningId();
  for (let position = 0; position < courseQuiz.questions.length; position++) {
    const question = courseQuiz.questions[position];
    await db.insert(lmsQuizQuestions).values({
      quizId: assessmentQuiz.id,
      question: question.question,
      type: "mcq",
      options: Array.isArray(question.options) ? JSON.stringify(question.options) : null,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? null,
      position,
    });
  }
  return true;
}
