export type CourseLessonAccessDecision = {
  allowed: boolean;
  reason: "preview_hidden_after_purchase" | "enrollment_required" | "full_enrollment_required" | null;
};

/**
 * Decides instructional lesson access after active enrollment has been resolved.
 * Completion and certificate eligibility are intentionally separate from access:
 * a full, non-expired CME enrollment can always open protected course lessons.
 */
export function getCourseLessonAccessDecision({
  previewMode,
  hasActiveEnrollment,
  enrollmentType,
}: {
  previewMode: "none" | "preview" | "preview_hide_after_purchase";
  hasActiveEnrollment: boolean;
  enrollmentType?: string | null;
}): CourseLessonAccessDecision {
  if (previewMode === "preview") return { allowed: true, reason: null };
  if (previewMode === "preview_hide_after_purchase" && hasActiveEnrollment && enrollmentType !== "free_preview") {
    return { allowed: false, reason: "preview_hidden_after_purchase" };
  }
  if (previewMode === "none" && !hasActiveEnrollment) return { allowed: false, reason: "enrollment_required" };
  if (previewMode === "none" && enrollmentType === "free_preview") return { allowed: false, reason: "full_enrollment_required" };
  return { allowed: true, reason: null };
}
