/**
 * Format a dollar price exactly as entered:
 *  - Whole numbers show without decimals: $299
 *  - Values with cents show with 2 decimal places: $299.97
 *  - Free / zero: "Free"
 */
export function formatDollar(price: number | string | null | undefined, showFree = true): string {
  const n = Number(price ?? 0);
  if (isNaN(n)) return showFree ? "Free" : "$0";
  if (n === 0) return showFree ? "Free" : "$0";
  // If the value has no fractional part, show as integer
  if (n % 1 === 0) return `$${n.toLocaleString("en-US")}`;
  // Otherwise show exactly 2 decimal places
  return `$${n.toFixed(2)}`;
}
