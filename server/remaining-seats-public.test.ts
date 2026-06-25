/**
 * remaining-seats-public.test.ts
 * Verifies public remaining-seats source resolution.
 */
import { describe, it, expect } from "vitest";
import { resolveRemainingSeatsData } from "@shared/remainingSeats";

describe("resolveRemainingSeatsData", () => {
  it("keeps an explicit workshop instance sourceId", () => {
    const result = resolveRemainingSeatsData(
      { sourceType: "workshop_instance", sourceId: 42 },
      { workshopInstanceId: 99 },
    );
    expect(result.sourceId).toBe(42);
  });

  it("coerces string sourceId and keeps it when valid", () => {
    const result = resolveRemainingSeatsData(
      { sourceType: "workshop_instance", sourceId: "101" },
      { workshopInstanceId: 99 },
    );
    expect(result.sourceId).toBe("101");
  });

  it("fills workshop instance from page context when sourceId is missing", () => {
    const result = resolveRemainingSeatsData(
      { sourceType: "workshop_instance", sourceId: null },
      { workshopInstanceId: 55 },
    );
    expect(result.sourceId).toBe(55);
    expect(result.sourceType).toBe("workshop_instance");
  });

  it("fills cohort group from page context when sourceId is missing", () => {
    const result = resolveRemainingSeatsData(
      { sourceType: "cohort_group", sourceId: null },
      { cohortGroupId: 12 },
    );
    expect(result.sourceId).toBe(12);
    expect(result.sourceType).toBe("cohort_group");
  });

  it("does not cross-fill workshop context into cohort blocks", () => {
    const result = resolveRemainingSeatsData(
      { sourceType: "cohort_group", sourceId: null },
      { workshopInstanceId: 55 },
    );
    expect(result.sourceId).toBeNull();
  });
});
