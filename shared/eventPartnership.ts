export const EVENT_PARTNERSHIP_TYPES = {
  workshop_exhibit: {
    label: "Workshop exhibit",
    pluralLabel: "Workshop exhibits",
    contactLabel: "Exhibitor",
    packageLabel: "Exhibit option",
  },
  webinar_sponsor: {
    label: "Webinar sponsorship",
    pluralLabel: "Webinar sponsorships",
    contactLabel: "Sponsor",
    packageLabel: "Sponsorship option",
  },
} as const;

export type EventPartnershipType = keyof typeof EVENT_PARTNERSHIP_TYPES;

export function isEventPartnershipType(value: unknown): value is EventPartnershipType {
  return typeof value === "string" && value in EVENT_PARTNERSHIP_TYPES;
}

export function formatEventPartnershipAmount(amountCents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(Number(amountCents ?? 0) / 100);
}
