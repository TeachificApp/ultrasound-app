/** Converts canonical course dollars into the integer cents Stripe requires. */
export function courseDollarsToStripeCents(value: number | string | null | undefined) {
  return Math.round(Number(value ?? 0) * 100);
}

export function resolveCourseCheckoutPrice(value: number | string | null | undefined) {
  const displayDollars = Number(value ?? 0);
  return { displayDollars, stripeCents: courseDollarsToStripeCents(displayDollars) };
}
