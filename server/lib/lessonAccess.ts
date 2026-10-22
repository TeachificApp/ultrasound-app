export type CourseLessonAccessDecision = {
  allowed: boolean;
  reason: "preview_hidden_after_purchase" | "cme_restricted_lesson" | "enrollment_required" | "full_enrollment_required" | null;
};

/**
 * Decides instructional lesson access after active enrollment has been resolved.
 * Completion and certificate eligibility are intentionally separate from access.
 * A CME-restricted enrollment retains ordinary course access, but may not open
 * lessons that the CME course administrator explicitly hides for that learner.
 */
export function getCourseLessonAccessDecision({
  previewMode,
  hasActiveEnrollment,
  enrollmentType,
  cmeCreditRestricted = false,
  hideForCmeRestricted = false,
}: {
  previewMode: "none" | "preview" | "preview_hide_after_purchase";
  hasActiveEnrollment: boolean;
  enrollmentType?: string | null;
  cmeCreditRestricted?: boolean | null;
  hideForCmeRestricted?: boolean | null;
}): CourseLessonAccessDecision {
  if (cmeCreditRestricted && hideForCmeRestricted) {
    return { allowed: false, reason: "cme_restricted_lesson" };
  }
  if (previewMode === "preview") return { allowed: true, reason: null };
  if (previewMode === "preview_hide_after_purchase" && hasActiveEnrollment && enrollmentType !== "free_preview") {
    return { allowed: false, reason: "preview_hidden_after_purchase" };
  }
  if (previewMode === "none" && !hasActiveEnrollment) return { allowed: false, reason: "enrollment_required" };
  if (previewMode === "none" && enrollmentType === "free_preview") return { allowed: false, reason: "full_enrollment_required" };
  return { allowed: true, reason: null };
}
