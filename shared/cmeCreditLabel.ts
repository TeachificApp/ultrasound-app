/** Human-readable CME credit label from the course `creditHours` field. */
export function formatCmeCreditLabel(creditHours: string | number | null | undefined): string | null {
  if (creditHours == null) return null;
  const raw = String(creditHours).trim();
  if (!raw) return null;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${raw} CME Credit${n !== 1 ? "s" : ""}`;
}

/** Short phrase for learner-facing copy, e.g. "2 CME credits". */
export function formatCmeCreditPhrase(creditHours: string | number | null | undefined): string | null {
  const label = formatCmeCreditLabel(creditHours);
  if (!label) return null;
  return label.replace(/ Credit(s)?$/, (m) => m.toLowerCase());
}
