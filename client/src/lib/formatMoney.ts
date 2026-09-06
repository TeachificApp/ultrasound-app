export function formatCentsAsCurrency(
  value: number | string | null | undefined,
  currency = "USD",
): string {
  const cents = Number(value ?? 0);
  if (!Number.isFinite(cents)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
