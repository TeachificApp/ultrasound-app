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

export const EXPO_PACKAGE_TYPE_META: Record<ExpoPackageType, { label: string; dashboardLabel: string; description: string }> = {
  registrant: {
    label: "Registration",
    dashboardLabel: "My registrations",
    description: "Professional attendance, ticket, and event information.",
  },
  exhibitor: {
    label: "Exhibit",
    dashboardLabel: "My exhibits",
    description: "Event-specific exhibit space and vendor participation.",
  },
  sponsor: {
    label: "Event sponsorship",
    dashboardLabel: "My event sponsorships",
    description: "UltrasoundExpo™-specific sponsorship opportunities and recognition.",
  },
  product: {
    label: "Product",
    dashboardLabel: "My Expo products",
    description: "Event merchandise, add-ons, and future physical offerings.",
  },
  other: {
    label: "Other Expo option",
    dashboardLabel: "My Expo options",
    description: "Additional event-specific packages configured by the Expo team.",
  },
};

export function isExpoPackageType(value: string): value is ExpoPackageType {
  return (EXPO_PACKAGE_TYPES as readonly string[]).includes(value);
}

export function formatExpoMoney(amountCents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format((amountCents ?? 0) / 100);
}
