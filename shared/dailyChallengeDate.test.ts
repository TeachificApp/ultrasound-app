import { describe, expect, it } from "vitest";
import { getDailyChallengeDate } from "./dailyChallengeDate";
import { getDailyChallengeArchiveCategories } from "./quickfireCategories";

describe("getDailyChallengeDate", () => {
  it("holds the current Daily Challenge on the Eastern calendar before midnight Eastern", () => {
    expect(getDailyChallengeDate(new Date("2026-10-01T00:45:00.000Z"))).toBe("2026-09-30");
  });

  it("advances after midnight Eastern", () => {
    expect(getDailyChallengeDate(new Date("2026-10-01T04:45:00.000Z"))).toBe("2026-10-01");
  });

  it("keeps Daily Challenge archive recovery brand-specific while mapping legacy AAU labels", () => {
    expect(getDailyChallengeArchiveCategories("aaus", "OB/Gyn")).toEqual([
      "Pelvic/Gyn",
      "OB 1st Trimester",
      "OB 2nd/3rd Trimester",
      "Fetal Echo",
      "OB/Gyn",
    ]);
    expect(getDailyChallengeArchiveCategories("iheartecho", "Pediatric Echo")).toEqual(["Pediatric Echo"]);
  });
});
