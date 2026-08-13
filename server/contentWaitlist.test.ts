import { describe, expect, it } from "vitest";
import { groupContentWaitlistEntries } from "../shared/contentWaitlist";

describe("content waitlist grouping", () => {
  it("keeps product-level and instance-level signups in distinct notification groups", () => {
    const groups = groupContentWaitlistEntries([
      { id: 1, productType: "workshop", productId: 50 },
      { id: 2, productType: "workshop_instance", productId: 50 },
      { id: 3, productType: "workshop", productId: 50 },
      { id: 4, productType: "cohort_group", productId: 9 },
    ]);
    expect(groups.map((group) => group.map((entry) => entry.id))).toEqual([[1, 3], [2], [4]]);
  });
});
