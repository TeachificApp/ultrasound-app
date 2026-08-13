import { describe, expect, it } from "vitest";
import { availabilityCtaLabel, isPresaleAvailability, isWaitlistAvailability } from "../shared/contentAvailability";

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
  });

  it("keeps enrollment closed and public CTAs distinct", () => {
    expect(availabilityCtaLabel("enrollment_closed")).toBe("Enrollment Closed");
    expect(availabilityCtaLabel("public", "Register")).toBe("Register");
  });
});
