/**
 * Shared published-lesson loading for Course Overview and Course Player.
 * Uses a section join so section-owned lessons appear even when course_id is null.
 */
import { and, asc, eq, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import { lmsLessons, lmsSections } from "../../drizzle/schema";

export type CourseLessonTreeLesson = typeof lmsLessons.$inferSelect;

export type CourseLessonTreeSection = typeof lmsSections.$inferSelect & {
  lessons: CourseLessonTreeLesson[];
};

export type CourseLessonTree = {
  sections: CourseLessonTreeSection[];
  topLevelLessons: CourseLessonTreeLesson[];
  allLessons: CourseLessonTreeLesson[];
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

export function groupCourseLessonsBySection(
  sections: typeof lmsSections.$inferSelect[],
  lessons: CourseLessonTreeLesson[],
  options?: { hideEmptySections?: boolean },
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
  options?: { hideEmptySections?: boolean },
): Promise<CourseLessonTree> {
  const sections = await db
    .select()
    .from(lmsSections)
    .where(eq(lmsSections.courseId, courseId))
    .orderBy(asc(lmsSections.position));
  const lessons = await fetchPublishedCourseLessons(db, courseId);
  return groupCourseLessonsBySection(sections, lessons, options);
}
