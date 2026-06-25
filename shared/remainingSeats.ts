export type LandingBlockContext = {
  workshopInstanceId?: number;
  cohortGroupId?: number;
};

export function resolveRemainingSeatsData(
  data: Record<string, unknown> | undefined,
  context?: LandingBlockContext,
): Record<string, unknown> {
  const next = { ...(data ?? {}) };
  const rawId = next.sourceId;
  const hasValidSource =
    rawId != null && rawId !== "" && !Number.isNaN(Number(rawId)) && Number(rawId) > 0;

  if (!hasValidSource) {
    const sourceType = (next.sourceType as string | undefined) ?? "workshop_instance";
    if (sourceType === "workshop_instance" && context?.workshopInstanceId) {
      next.sourceId = context.workshopInstanceId;
      next.sourceType = "workshop_instance";
    } else if (sourceType === "cohort_group" && context?.cohortGroupId) {
      next.sourceId = context.cohortGroupId;
      next.sourceType = "cohort_group";
    }
  }

  return next;
}
