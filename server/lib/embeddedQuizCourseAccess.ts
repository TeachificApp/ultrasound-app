import { TRPCError } from "@trpc/server";
import { and, eq, gte, isNotNull, isNull, or } from "drizzle-orm";
import {
  lmsCourses,
  lmsEnrollments,
  lmsLessons,
  lmsSections,
} from "../../drizzle/schema";
import { isStandaloneQuizStaff } from "./standaloneQuizStaffAccess";
import { resolveEnrollmentByCourseSlug } from "./enrollmentAccess";

const activeEnrollmentExpiry = or(
  isNull(lmsEnrollments.accessExpiresAt),
  gte(lmsEnrollments.accessExpiresAt, new Date()),
);

/** Quiz Creator content is available through an assigned LMS lesson, not as a public standalone product. */
export async function assertEmbeddedQuizAccess(
  db: any,
  user: { id: number; role: string },
  quizId: number,
) {
  if (isStandaloneQuizStaff(user.role)) return;

  const [directAssignment] = await db
    .select({ lessonId: lmsLessons.id })
    .from(lmsLessons)
    .innerJoin(lmsEnrollments, and(
      eq(lmsEnrollments.courseId, lmsLessons.courseId),
      eq(lmsEnrollments.userId, user.id),
      activeEnrollmentExpiry,
    ))
    .where(and(
      eq(lmsLessons.type, "standalone_quiz"),
      eq(lmsLessons.standaloneQuizId, quizId),
      isNotNull(lmsLessons.courseId),
    ))
    .limit(1);
  if (directAssignment) return;

  const [sectionAssignment] = await db
    .select({ lessonId: lmsLessons.id })
    .from(lmsLessons)
    .innerJoin(lmsSections, eq(lmsSections.id, lmsLessons.sectionId))
    .innerJoin(lmsEnrollments, and(
      eq(lmsEnrollments.courseId, lmsSections.courseId),
      eq(lmsEnrollments.userId, user.id),
      activeEnrollmentExpiry,
    ))
    .where(and(
      eq(lmsLessons.type, "standalone_quiz"),
      eq(lmsLessons.standaloneQuizId, quizId),
    ))
    .limit(1);
  if (sectionAssignment) return;

  const [previewAssignment] = await db
    .select({ lessonId: lmsLessons.id })
    .from(lmsLessons)
    .where(and(
      eq(lmsLessons.type, "standalone_quiz"),
      eq(lmsLessons.standaloneQuizId, quizId),
      or(
        eq(lmsLessons.previewMode, "preview"),
        eq(lmsLessons.previewMode, "preview_hide_after_purchase"),
      ),
    ))
    .limit(1);
  if (previewAssignment) return;

  throw new TRPCError({ code: "FORBIDDEN", message: "This quiz is available through its assigned learning experience." });
}

/** Course-player context: enrolled learner opened a standalone quiz lesson inside /courses/:slug/player. */
export async function assertCoursePlayerQuizAccess(
  db: any,
  userId: number,
  courseSlug: string,
  quizId: number,
) {
  const enrollment = await resolveEnrollmentByCourseSlug(db, userId, courseSlug);
  if (!enrollment) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment required to access this quiz." });
  }

  const [course] = await db
    .select({ id: lmsCourses.id })
    .from(lmsCourses)
    .where(eq(lmsCourses.slug, courseSlug))
    .limit(1);
  if (!course) throw new TRPCError({ code: "NOT_FOUND" });

  const [lessonLink] = await db
    .select({ lessonId: lmsLessons.id })
    .from(lmsLessons)
    .leftJoin(lmsSections, eq(lmsSections.id, lmsLessons.sectionId))
    .where(and(
      eq(lmsLessons.type, "standalone_quiz"),
      eq(lmsLessons.standaloneQuizId, quizId),
      or(
        eq(lmsLessons.courseId, course.id),
        eq(lmsSections.courseId, course.id),
      ),
    ))
    .limit(1);

  if (!lessonLink) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This quiz is not assigned to this course." });
  }
}

export async function assertStandaloneQuizLearnerAccess(
  db: any,
  user: { id: number; role: string },
  quizId: number,
  opts: { adminPreview: boolean; isStaff: boolean; widgetToken?: string; courseSlug?: string },
  hasActiveWidgetLaunch: (db: any, rawToken: string | undefined, quizId: number) => Promise<boolean>,
) {
  if (opts.adminPreview && opts.isStaff) return;
  if (await hasActiveWidgetLaunch(db, opts.widgetToken, quizId)) return;
  if (opts.courseSlug) {
    await assertCoursePlayerQuizAccess(db, user.id, opts.courseSlug, quizId);
    return;
  }
  await assertEmbeddedQuizAccess(db, user, quizId);
}
