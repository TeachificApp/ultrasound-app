export type ContentAvailabilityStatus = "draft" | "public" | "published" | "hidden" | "private" | "archived" | "enrollment_closed" | "waitlist" | "presale" | string | null | undefined;

export function isWaitlistAvailability(status: ContentAvailabilityStatus): boolean {
  return status === "waitlist";
}

export function isPresaleAvailability(status: ContentAvailabilityStatus): boolean {
  return status === "presale";
}

export function availabilityCtaLabel(status: ContentAvailabilityStatus, fallback = "Enroll Now"): string {
  if (isWaitlistAvailability(status)) return "Join Waitlist";
  if (isPresaleAvailability(status)) return "Pre-sale: Enroll Now";
  if (status === "enrollment_closed") return "Enrollment Closed";
  return fallback;
}
