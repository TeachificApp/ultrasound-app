import { lessonHasAssessmentContent } from "./lessonAccessGating";

export type BackfillLesson = {
  id: number;
  type?: string | null;
  contentBlocks?: string | null;
  lessonStatus?: string | null;
  countTowardCompletion?: boolean | number | null;
};

export function lessonHasSdmsCmeModule(lesson: { contentBlocks?: string | null }): boolean {
  if (!lesson.contentBlocks) return false;
  try {
    const blocks = typeof lesson.contentBlocks === "string"
      ? JSON.parse(lesson.contentBlocks)
      : lesson.contentBlocks;
    if (!Array.isArray(blocks)) return false;
    return blocks.some((block) => block?.type === "sdms_cme_module");
  } catch {
    return false;
  }
}

/** Final CME / certificate quiz lessons stay incomplete so learners can still take them. */
export function resolveFinalAssessmentLessonIds(
  lessons: BackfillLesson[],
  cmeLessonId?: number | null,
): Set<number> {
  const ids = new Set<number>();
  if (cmeLessonId) ids.add(cmeLessonId);

  for (const lesson of lessons) {
    if (lessonHasSdmsCmeModule(lesson)) ids.add(lesson.id);
  }

  if (ids.size === 0) {
    const quizLessons = lessons.filter((lesson) => lesson.type === "quiz" || lesson.type === "standalone_quiz");
    if (quizLessons.length > 0) {
      ids.add(quizLessons[quizLessons.length - 1]!.id);
    }
  }

  return ids;
}

export function lessonsToBackfillComplete(
  lessons: BackfillLesson[],
  finalAssessmentIds: Set<number>,
): BackfillLesson[] {
  return lessons.filter((lesson) => {
    if (lesson.lessonStatus === "draft") return false;
    if (lesson.countTowardCompletion === false || lesson.countTowardCompletion === 0) return false;
    if (finalAssessmentIds.has(lesson.id)) return false;
    return true;
  });
}

export function sdmsPassStatuses(): string[] {
  return ["passed", "override_pass"];
}
