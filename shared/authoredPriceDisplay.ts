/**
 * Formats an authored decimal-dollar value without inventing or discarding
 * fractional precision. Values stored as `2297.00` remain `$2,297.00`, while
 * a whole-dollar value authored as `2297` remains `$2,297`.
 */
export function formatAuthoredDollars(value: number | string | null | undefined): string {
  const raw = String(value ?? 0).trim();
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return "$0";
  const fractionalPart = raw.includes(".") ? raw.split(".")[1] ?? "" : "";
  const precision = Math.min(2, fractionalPart.length);
  return `$${numeric.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: Math.max(precision, 2),
  })}`;
}
