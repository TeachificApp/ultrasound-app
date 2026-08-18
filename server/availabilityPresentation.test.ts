import { describe, expect, it } from "vitest";
import { availabilityPresentationLabel, shouldHideEnrollmentPresentation } from "../shared/availabilityPresentation";

describe("availability presentation", () => {
  it("suppresses enrollment and seats for waitlist and enrollment-closed content", () => {
    expect(shouldHideEnrollmentPresentation({ status: "waitlist" })).toBe(true);
    expect(shouldHideEnrollmentPresentation({ status: "enrollment_closed" })).toBe(true);
    expect(availabilityPresentationLabel("waitlist")).toBe("Waitlist");
    expect(availabilityPresentationLabel("enrollment_closed")).toBe("Enrollment Closed");
  });

  it("suppresses an instance that is not available for purchase while allowing an open purchasable item", () => {
    expect(shouldHideEnrollmentPresentation({ status: "published", availableForPurchase: false })).toBe(true);
    expect(shouldHideEnrollmentPresentation({ status: "open", availableForPurchase: true })).toBe(false);
  });
});
