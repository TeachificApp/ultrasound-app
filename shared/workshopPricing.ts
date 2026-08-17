export function workshopDollarsToCents(value: number | string | null | undefined) {
  return Math.round(Number(value ?? 0) * 100);
}

export function resolveWorkshopCheckoutPrice(instancePrice: number | string | null | undefined, workshopPrice: number | string | null | undefined) {
  const displayDollars = instancePrice ?? workshopPrice ?? 0;
  return {
    displayDollars,
    stripeCents: workshopDollarsToCents(displayDollars),
  };
}

export function formatWorkshopDollars(value: number | string | null | undefined, currency = "usd") {
  const rawValue = String(value ?? "0");
  const dollars = Number(rawValue);
  if (dollars === 0) return "Free";
  const decimalPart = rawValue.match(/\.(\d{1,2})$/)?.[1];
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: decimalPart?.length ?? 0,
    maximumFractionDigits: 2,
  }).format(dollars);
}

export function shouldRouteWorkshopCtaToCheckout(action: string | undefined, label: string | undefined) {
  if (action === "direct_checkout" || action === "pricing_option" || action === "enroll_next_available") return true;
  const normalizedLabel = (label ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return (action === "url" || action === "scroll_to_section") && /^(save my seat|register now|enroll now|reserve your seat)$/.test(normalizedLabel);
}

export function buildWorkshopCheckoutIdempotencyKey({
  userId,
  workshopId,
  instanceId,
  priceInCents,
  currency,
  orderBumpId,
  bumpMode,
}: {
  userId?: number | null;
  workshopId: number;
  instanceId: number;
  priceInCents: number;
  currency?: string | null;
  orderBumpId?: string | number | null;
  bumpMode?: string | null;
}) {
  return [
    "workshop-checkout-v2",
    userId ?? "guest",
    workshopId,
    instanceId,
    priceInCents,
    (currency ?? "usd").toLowerCase(),
    orderBumpId ?? "no-bump",
    bumpMode ?? "standard",
  ].join("-");
}
