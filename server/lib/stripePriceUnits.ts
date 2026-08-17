/** Converts canonical decimal-dollar prices into the integer cents Stripe requires. */
export function dollarsToStripeCents(value: number | string | null | undefined) {
  return Math.round(Number(value ?? 0) * 100);
}
