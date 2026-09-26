import { describe, expect, it } from "vitest";
import { hasFiniteWorkshopCapacity } from "./workshopAvailability";

describe("workshop capacity semantics", () => {
  it("treats null and legacy zero capacity as unlimited", () => {
    expect(hasFiniteWorkshopCapacity(null)).toBe(false);
    expect(hasFiniteWorkshopCapacity(0)).toBe(false);
  });

  it("treats positive capacity as finite", () => {
    expect(hasFiniteWorkshopCapacity(1)).toBe(true);
    expect(hasFiniteWorkshopCapacity(25)).toBe(true);
  });
});
