export type ContentAvailabilityStatus = "draft" | "public" | "published" | "hidden" | "private" | "archived" | "enrollment_closed" | "waitlist" | "presale" | string | null | undefined;

export function isWaitlistAvailability(status: ContentAvailabilityStatus): boolean {
  return status === "waitlist";
}

export function isPresaleAvailability(status: ContentAvailabilityStatus): boolean {
  return status === "presale";
}

/** A restricted pre-sale enrolment is released when availability moves out of Pre-sale. */
export function shouldReleasePresaleEnrollment(previousStatus: ContentAvailabilityStatus, nextStatus: ContentAvailabilityStatus): boolean {
  return isPresaleAvailability(previousStatus) && !!nextStatus && !isPresaleAvailability(nextStatus);
}

export type PresaleWelcomeSource = {
  heading?: string | null;
  body?: string | null;
  mediaUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

/** Prefer a product-instance welcome configuration while retaining course-level defaults. */
export function resolvePresaleWelcome(primary?: PresaleWelcomeSource | null, fallback?: PresaleWelcomeSource | null) {
  return {
    heading: primary?.heading || fallback?.heading || "Thank you for enrolling.",
    body: primary?.body || fallback?.body || "You’ll be granted access once the course is open.",
    mediaUrl: primary?.mediaUrl || fallback?.mediaUrl || null,
    ctaLabel: primary?.ctaLabel || fallback?.ctaLabel || null,
    ctaUrl: primary?.ctaUrl || fallback?.ctaUrl || null,
  };
}

export function availabilityCtaLabel(status: ContentAvailabilityStatus, fallback = "Enroll Now"): string {
  if (isWaitlistAvailability(status)) return "Join Waitlist";
  if (isPresaleAvailability(status)) return "Pre-sale: Enroll Now";
  if (status === "enrollment_closed") return "Enrollment Closed";
  return fallback;
}
