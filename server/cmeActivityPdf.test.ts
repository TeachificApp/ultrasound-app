import { describe, it, expect } from "vitest";
import { generateCmeActivityPdf } from "./lib/cmeActivityPdf";

describe("generateCmeActivityPdf", () => {
  it("generates a valid PDF for a populated two-column form", async () => {
    const buffer = await generateCmeActivityPdf({
      activityTitle: "Test Activity",
      activityType: "enduring",
      activityStructure: "one_time",
      proposedDate: "2026-01-15",
      originalReleaseDate: "2026-02-01",
      mostRecentReviewDate: "2026-03-01",
      expirationDate: "2029-03-01",
      activityLengthHours: "1.5",
      cmeCreditsRequested: "1.5",
      offerMocCredit: "no",
      offeredMoreThanOnce: "yes",
      targetAudience: "sonographers",
      estimatedLearners: "250",
      attestationName: "Jane Doe",
      attestationTitle: "MD, FACC",
      attestationDate: "2026-08-09",
    });

    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(2000);
  });
});
