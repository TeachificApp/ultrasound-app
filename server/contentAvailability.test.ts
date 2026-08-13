import { describe, expect, it } from "vitest";
import { availabilityCtaLabel, isPresaleAvailability, isWaitlistAvailability, resolvePresaleWelcome, shouldReleasePresaleEnrollment } from "../shared/contentAvailability";

describe("content availability statuses", () => {
  it("routes Waitlist content to visitor signup rather than enrollment", () => {
    expect(isWaitlistAvailability("waitlist")).toBe(true);
    expect(isPresaleAvailability("waitlist")).toBe(false);
    expect(availabilityCtaLabel("waitlist")).toBe("Join Waitlist");
  });

  it("preserves pre-sale enrollment while distinguishing it from fully open content", () => {
    expect(isPresaleAvailability("presale")).toBe(true);
    expect(isWaitlistAvailability("presale")).toBe(false);
    expect(availabilityCtaLabel("presale")).toBe("Pre-sale: Enroll Now");
    expect(shouldReleasePresaleEnrollment("presale", "open")).toBe(true);
    expect(shouldReleasePresaleEnrollment("presale", "active")).toBe(true);
    expect(shouldReleasePresaleEnrollment("presale", "presale")).toBe(false);
    expect(shouldReleasePresaleEnrollment("open", "active")).toBe(false);
  });

  it("keeps enrollment closed and public CTAs distinct", () => {
    expect(availabilityCtaLabel("enrollment_closed")).toBe("Enrollment Closed");
    expect(availabilityCtaLabel("public", "Register")).toBe("Register");
  });

  it("uses a cohort-specific Pre-sale welcome page before falling back to course defaults", () => {
    expect(resolvePresaleWelcome({ heading: "Your cohort seat is reserved", body: "We will open access shortly." }, { heading: "Course default", body: "Course default body", ctaLabel: "Contact us" })).toEqual({
      heading: "Your cohort seat is reserved",
      body: "We will open access shortly.",
      mediaUrl: null,
      ctaLabel: "Contact us",
      ctaUrl: null,
    });
    expect(resolvePresaleWelcome()).toMatchObject({
      heading: "Thank you for enrolling.",
      body: "You’ll be granted access once the course is open.",
    });
  });
});
