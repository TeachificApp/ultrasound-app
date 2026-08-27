import { lessonRequiresExplicitCompletion } from "./cmeLessonCompletion";

export type LessonGateInput = {
  id: number;
  isPrerequisite?: boolean | number | null;
  prerequisiteLessonId?: number | null;
  requireVideoCompletion?: number | null;
  requireManualComplete?: number | null;
  lessonStatus?: string | null;
  countTowardCompletion?: boolean | number | null;
  type?: string | null;
  hasAssessmentContent?: boolean;
};

export function lessonHasAssessmentContent(lesson: {
  type?: string | null;
  contentBlocks?: string | null;
}): boolean {
  if (lesson.type === "quiz" || lesson.type === "standalone_quiz") return true;
  if (!lesson.contentBlocks) return false;
  try {
    const blocks = typeof lesson.contentBlocks === "string"
      ? JSON.parse(lesson.contentBlocks)
      : lesson.contentBlocks;
    if (!Array.isArray(blocks)) return false;
    return blocks.some((block) => block?.type === "lesson_quiz" || block?.type === "sdms_cme_module");
  } catch {
    return false;
  }
}

export function isCountableLesson(lesson: LessonGateInput): boolean {
  return lesson.lessonStatus !== "draft"
    && lesson.countTowardCompletion !== false
    && lesson.countTowardCompletion !== 0;
}

export function isLessonGateSatisfied(
  lesson: LessonGateInput,
  completedIds: Set<number>,
  openedIds: Set<number>,
  courseDefaultMarkComplete = true,
): boolean {
  const hasExplicitCompletion = lessonRequiresExplicitCompletion(lesson, courseDefaultMarkComplete);
  return hasExplicitCompletion
    ? completedIds.has(lesson.id)
    : openedIds.has(lesson.id) || completedIds.has(lesson.id);
}

/** True when every other countable lesson is complete — final assessment should unlock. */
export function allOtherCountableLessonsComplete(
  lessonId: number,
  allLessons: LessonGateInput[],
  completedIds: Set<number>,
): boolean {
  const others = allLessons.filter((lesson) => lesson.id !== lessonId && isCountableLesson(lesson));
  if (others.length === 0) return true;
  return others.every((lesson) => completedIds.has(lesson.id));
}

export function buildPrereqLockedIds(input: {
  allLessons: LessonGateInput[];
  completedIds: Set<number>;
  openedIds: Set<number>;
  courseDefaultMarkComplete?: boolean;
  dripBypassed?: boolean;
}): Set<number> {
  const locked = new Set<number>();
  if (input.dripBypassed) return locked;

  const courseDefaultMarkComplete = input.courseDefaultMarkComplete !== false;
  let gateActive = false;

  for (const lesson of input.allLessons) {
    const blockedByCascade = gateActive;
    const blockedByLessonPrereq = Boolean(
      lesson.prerequisiteLessonId
      && !input.completedIds.has(lesson.prerequisiteLessonId),
    );
    const isAssessment = lesson.hasAssessmentContent ?? lessonHasAssessmentContent(lesson);
    const assessmentReady = isAssessment
      && allOtherCountableLessonsComplete(lesson.id, input.allLessons, input.completedIds);

    if ((blockedByCascade || blockedByLessonPrereq) && !assessmentReady) {
      locked.add(lesson.id);
    }

    if (lesson.isPrerequisite) {
      gateActive = !isLessonGateSatisfied(
        lesson,
        input.completedIds,
        input.openedIds,
        courseDefaultMarkComplete,
      );
    }
  }

  return locked;
}

export function isLessonPrereqLocked(
  lesson: LessonGateInput,
  allLessons: LessonGateInput[],
  completedIds: Set<number>,
  openedIds: Set<number>,
  courseDefaultMarkComplete = true,
  dripBypassed = false,
): boolean {
  if (dripBypassed) return false;
  return buildPrereqLockedIds({
    allLessons,
    completedIds,
    openedIds,
    courseDefaultMarkComplete,
    dripBypassed,
  }).has(lesson.id);
}
