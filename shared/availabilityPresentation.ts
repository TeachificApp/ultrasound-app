export function shouldHideEnrollmentPresentation({
  status,
  availableForPurchase,
}: {
  status?: string | null;
  availableForPurchase?: boolean | null;
}): boolean {
  return status === "waitlist" || status === "enrollment_closed" || availableForPurchase === false;
}

export function availabilityPresentationLabel(status?: string | null): "Waitlist" | "Enrollment Closed" | null {
  if (status === "waitlist") return "Waitlist";
  if (status === "enrollment_closed") return "Enrollment Closed";
  return null;
}
