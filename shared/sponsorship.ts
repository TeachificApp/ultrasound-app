export const SPONSORSHIP_TIERS = {
  silver: {
    label: "Silver",
    amountCents: 250_000,
    description: "Meaningful visibility for organizations supporting hands-on ultrasound education.",
    benefits: [
      "Organization name and linked website recognition on the supporting workshop page",
      "One social media acknowledgement",
      "Recognition in participant-provided materials when production timing allows",
    ],
  },
  gold: {
    label: "Gold",
    amountCents: 500_000,
    description: "Expanded recognition across workshop, digital, and participant touchpoints.",
    benefits: [
      "Priority organization and linked website recognition on the workshop page",
      "Two social media acknowledgements",
      "Prominent recognition in participant-provided materials when production timing allows",
    ],
  },
  platinum: {
    label: "Platinum",
    amountCents: 800_000,
    description: "Premier support with the strongest available event and digital presence.",
    benefits: [
      "Featured organization and linked website recognition on the workshop page",
      "Three social media acknowledgements",
      "Premier recognition in participant-provided materials when production timing allows",
      "Event signage recognition for sponsored in-person workshops",
    ],
  },
  other: {
    label: "Other support",
    amountCents: null,
    description: "Choose a support amount that is meaningful to your organization.",
    benefits: [
      "Recognition details are coordinated with the sponsorship team based on the selected support and opportunity.",
    ],
  },
} as const;

export type SponsorshipTier = keyof typeof SPONSORSHIP_TIERS;
export type SponsorshipScope = "workshop_instance" | "website" | "app" | "podcast" | "other";

export const SPONSORSHIP_SCOPE_LABELS: Record<SponsorshipScope, string> = {
  workshop_instance: "Specific workshop instance",
  website: "General website sponsorship",
  app: "App sponsorship",
  podcast: "Sonographer’s After Dark podcast sponsorship",
  other: "Other sponsorship",
};

export function isSponsorshipTier(value: unknown): value is SponsorshipTier {
  return typeof value === "string" && value in SPONSORSHIP_TIERS;
}

export function isSponsorshipScope(value: unknown): value is SponsorshipScope {
  return typeof value === "string" && value in SPONSORSHIP_SCOPE_LABELS;
}

export function resolveSponsorshipAmountCents(input: {
  tier: SponsorshipTier;
  customAmountCents?: number | null;
}): number {
  const configuredAmount = SPONSORSHIP_TIERS[input.tier].amountCents;
  if (configuredAmount !== null) return configuredAmount;
  return Math.round(input.customAmountCents ?? 0);
}

export function formatSponsorshipAmount(amountCents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function sponsorshipTargetLabel(input: {
  scope: SponsorshipScope;
  workshopTitle?: string | null;
  workshopInstanceTitle?: string | null;
  otherPurpose?: string | null;
}): string {
  if (input.scope === "workshop_instance") {
    return [input.workshopTitle, input.workshopInstanceTitle].filter(Boolean).join(" — ") || "Specific workshop instance";
  }
  if (input.scope === "other") return input.otherPurpose?.trim() || SPONSORSHIP_SCOPE_LABELS.other;
  return SPONSORSHIP_SCOPE_LABELS[input.scope];
}
