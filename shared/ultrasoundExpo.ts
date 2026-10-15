import { AAUS_SONO_RING_LOGO_URL } from "./brands";

export const ULTRASOUND_EXPO_NAME = "UltrasoundExpo™";
export const ULTRASOUND_EXPO_ORGANIZER = "All About Ultrasound™";
export const ULTRASOUND_EXPO_ORIGIN = "https://ultrasoundexpo.com";
export const ULTRASOUND_EXPO_HERO_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663401463434/nmDnyKctfSTBjSLH.jpg";
export const ULTRASOUND_EXPO_AAUS_LOGO_URL = AAUS_SONO_RING_LOGO_URL;

export const ULTRASOUND_EXPO_LAUNCH_EVENT = {
  name: "UltrasoundExpo™ 2028",
  slug: "ultrasoundexpo-2028",
  startsAtIso: "2028-01-16T09:00:00-05:00",
  endsAtIso: "2028-01-17T17:00:00-05:00",
  timezone: "America/New_York",
  locationLabel: "Orlando, FL · Venue to be announced",
  shortDescription: "A new annual meeting for sonographers, physicians, educators, innovators, and the ultrasound industry.",
} as const;

export const EXPO_PACKAGE_TYPES = ["registrant", "exhibitor", "sponsor", "product", "other"] as const;
export type ExpoPackageType = typeof EXPO_PACKAGE_TYPES[number];

/** Customer-facing registrations available until additional event offerings are released. */
export const EXPO_PUBLIC_REGISTRATION_TYPES = ["registrant", "exhibitor", "sponsor"] as const satisfies readonly ExpoPackageType[];
export type ExpoPublicRegistrationType = typeof EXPO_PUBLIC_REGISTRATION_TYPES[number];

export const EXPO_PACKAGE_TYPE_META: Record<ExpoPackageType, { label: string; dashboardLabel: string; description: string }> = {
  registrant: {
    label: "Register (Attendee)",
    dashboardLabel: "My registrations",
    description: "Reserve your place at UltrasoundExpo™ with event details delivered as plans are confirmed.",
  },
  exhibitor: {
    label: "Exhibit",
    dashboardLabel: "My exhibits",
    description: "Put your technology, services, and expertise in front of the UltrasoundExpo™ community.",
  },
  sponsor: {
    label: "Sponsor",
    dashboardLabel: "My sponsorships",
    description: "Create meaningful visibility through an UltrasoundExpo™ sponsorship opportunity.",
  },
  product: {
    label: "Product",
    dashboardLabel: "My UltrasoundExpo™ products",
    description: "Event merchandise, add-ons, and future physical offerings.",
  },
  other: {
    label: "Additional UltrasoundExpo™ option",
    dashboardLabel: "My UltrasoundExpo™ options",
    description: "Additional event offerings configured for a future UltrasoundExpo™ year.",
  },
};

export function isExpoPackageType(value: string): value is ExpoPackageType {
  return (EXPO_PACKAGE_TYPES as readonly string[]).includes(value);
}

export function isExpoPublicRegistrationType(value: string): value is ExpoPublicRegistrationType {
  return (EXPO_PUBLIC_REGISTRATION_TYPES as readonly string[]).includes(value);
}

export function formatExpoMoney(amountCents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format((amountCents ?? 0) / 100);
}
