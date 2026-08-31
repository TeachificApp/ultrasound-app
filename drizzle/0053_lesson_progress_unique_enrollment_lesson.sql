-- Ensure each enrolled learner has one authoritative progress row per lesson.
-- Preflight aggregate audit confirmed no duplicate enrollment/lesson pairs.
CREATE UNIQUE INDEX lms_lesson_progress_enrollment_lesson_unique
  ON lms_lesson_progress (enrollment_id, lesson_id);
