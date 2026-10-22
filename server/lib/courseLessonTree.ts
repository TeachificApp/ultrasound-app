/**
 * Shared published-lesson loading for Course Overview and Course Player.
 * Uses a section join so section-owned lessons appear even when course_id is null.
 */
import { and, asc, eq, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import { lmsLessons, lmsSections } from "../../drizzle/schema";
import { isVisibleAfterPurchase } from "../../shared/coursePreviewEligibility";

export type CourseLessonTreeLesson = typeof lmsLessons.$inferSelect;

export type CourseLessonTreeSection = typeof lmsSections.$inferSelect & {
  lessons: CourseLessonTreeLesson[];
};

export type CourseLessonTree = {
  sections: CourseLessonTreeSection[];
  topLevelLessons: CourseLessonTreeLesson[];
  allLessons: CourseLessonTreeLesson[];
};

export type CourseLessonTreeOptions = {
  hideEmptySections?: boolean;
  excludeCmeRestrictedLessons?: boolean;
  /** Omit free-preview-only lessons after a learner has full course access. */
  excludePreviewOnlyAfterPurchase?: boolean;
};

/** Published lessons belonging to a course (direct or via section). */
export async function fetchPublishedCourseLessons(
  db: MySql2Database<typeof schema>,
  courseId: number,
): Promise<CourseLessonTreeLesson[]> {
  const rows = await db
    .select({ lesson: lmsLessons })
    .from(lmsLessons)
    .leftJoin(lmsSections, eq(lmsLessons.sectionId, lmsSections.id))
    .where(
      and(
        or(eq(lmsLessons.courseId, courseId), eq(lmsSections.courseId, courseId)),
        eq(lmsLessons.lessonStatus, "published"),
      ),
    )
    .orderBy(asc(lmsLessons.position));

  return rows.map((row) => row.lesson);
}

/** Apply learner-specific curriculum visibility before module grouping/counting. */
export function filterCourseLessonsForLearner(
  lessons: CourseLessonTreeLesson[],
  options?: CourseLessonTreeOptions,
): CourseLessonTreeLesson[] {
  return lessons.filter((lesson) => {
    if (options?.excludeCmeRestrictedLessons && lesson.hideForCmeRestricted) return false;
    if (options?.excludePreviewOnlyAfterPurchase && !isVisibleAfterPurchase(lesson)) return false;
    return true;
  });
}

export function groupCourseLessonsBySection(
  sections: typeof lmsSections.$inferSelect[],
  lessons: CourseLessonTreeLesson[],
  options?: CourseLessonTreeOptions,
): CourseLessonTree {
  const lessonsBySectionId = new Map<number, CourseLessonTreeLesson[]>();
  const topLevelLessons: CourseLessonTreeLesson[] = [];

  for (const lesson of lessons) {
    if (lesson.sectionId) {
      if (!lessonsBySectionId.has(lesson.sectionId)) {
        lessonsBySectionId.set(lesson.sectionId, []);
      }
      lessonsBySectionId.get(lesson.sectionId)!.push(lesson);
    } else {
      topLevelLessons.push(lesson);
    }
  }

  const sectionsWithLessons = sections
    .map((section) => ({ ...section, lessons: lessonsBySectionId.get(section.id) ?? [] }))
    .filter((section) => !options?.hideEmptySections || section.lessons.length > 0);

  return {
    sections: sectionsWithLessons,
    topLevelLessons,
    allLessons: lessons,
  };
}

export async function loadPublishedCourseLessonTree(
  db: MySql2Database<typeof schema>,
  courseId: number,
  options?: CourseLessonTreeOptions,
): Promise<CourseLessonTree> {
  const sections = await db
    .select()
    .from(lmsSections)
    .where(eq(lmsSections.courseId, courseId))
    .orderBy(asc(lmsSections.position));
  const lessons = filterCourseLessonsForLearner(
    await fetchPublishedCourseLessons(db, courseId),
    options,
  );
  return groupCourseLessonsBySection(sections, lessons, options);
}
