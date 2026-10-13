import { inArray } from "drizzle-orm";
import { lmsCourses } from "../../drizzle/schema";

/** LMS course statuses that may appear in learner My Content virtual cards (membership/bundle). */
export const LMS_MY_CONTENT_COURSE_STATUSES = ["public", "hidden", "private"] as const;

export function lmsCourseVisibleInMyContentCondition() {
  return inArray(lmsCourses.status, [...LMS_MY_CONTENT_COURSE_STATUSES]);
}
