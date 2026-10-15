import { AAUS_SONO_RING_LOGO_URL } from "./brands";

export const ULTRASOUND_EXPO_NAME = "UltrasoundExpo™";
export const ULTRASOUND_EXPO_ORGANIZER = "All About Ultrasound™";
export const ULTRASOUND_EXPO_ORIGIN = "https://ultrasoundexpo.com";
export const ULTRASOUND_EXPO_HERO_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663401463434/nmDnyKctfSTBjSLH.jpg";
export const ULTRASOUND_EXPO_AAUS_LOGO_URL = AAUS_SONO_RING_LOGO_URL;

/** The CMS domain used by the Site Pages editor for every public Expo screen. */
export const ULTRASOUND_EXPO_SITE_DOMAIN = "ultrasoundexpo.com";

export type ExpoPageSeo = {
  title: string;
  description: string;
  image: string;
};

/**
 * The Site Pages editor preserves the established Expo layouts while exposing
 * their customer-facing copy and page-specific SEO controls.
 */
export const ULTRASOUND_EXPO_PAGE_EDITOR_PAGES = [
  {
    slug: "home",
    path: "/",
    title: "UltrasoundExpo™ Home",
    pageKind: "home" as const,
    seo: {
      title: "UltrasoundExpo™ | The Annual Event for Ultrasound Professionals",
      description: "UltrasoundExpo™ by All About Ultrasound™ is the annual meeting for sonographers, physicians, educators, innovators, and the ultrasound industry.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "hero_eyebrow", label: "Hero eyebrow", hint: "Short line above the primary headline." },
      { key: "hero_headline", label: "Hero headline", hint: "Primary hero headline.", multiline: true },
      { key: "hero_subtitle", label: "Hero introduction", hint: "Supporting copy below the hero headline.", multiline: true },
      { key: "hero_primary_cta", label: "Primary button", hint: "Label for the attendee registration button." },
      { key: "hero_secondary_cta", label: "Secondary button", hint: "Label for the exhibit button." },
      { key: "community_headline", label: "Community section headline", hint: "Headline above the six experience cards.", multiline: true },
      { key: "exhibit_headline", label: "Exhibit Hall headline", hint: "Headline for the Exhibit Hall feature section.", multiline: true },
      { key: "partner_headline", label: "Partner section headline", hint: "Headline for the sponsor and exhibitor card.", multiline: true },
    ],
  },
  {
    slug: "attend",
    path: "/attend",
    title: "Attend UltrasoundExpo™",
    pageKind: "sales" as const,
    seo: {
      title: "Attend UltrasoundExpo™ | Registration and Event Information",
      description: "Plan your UltrasoundExpo™ experience with attendee registration, education, networking, hands-on learning, and event information.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "eyebrow", label: "Hero eyebrow", hint: "Short line above the page title." },
      { key: "headline", label: "Hero headline", hint: "Main page headline.", multiline: true },
      { key: "body", label: "Hero body", hint: "Supporting sales copy.", multiline: true },
      { key: "cta", label: "Call-to-action label", hint: "Button label that opens registration." },
    ],
  },
  {
    slug: "exhibit",
    path: "/exhibit",
    title: "Exhibit at UltrasoundExpo™",
    pageKind: "sales" as const,
    seo: {
      title: "Exhibit at UltrasoundExpo™ | Reach the Ultrasound Community",
      description: "Explore UltrasoundExpo™ exhibitor opportunities for organizations serving the ultrasound profession.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "eyebrow", label: "Hero eyebrow", hint: "Short line above the page title." },
      { key: "headline", label: "Hero headline", hint: "Main page headline.", multiline: true },
      { key: "body", label: "Hero body", hint: "Supporting sales copy.", multiline: true },
      { key: "cta", label: "Call-to-action label", hint: "Button label that opens exhibit registration." },
    ],
  },
  {
    slug: "sponsor",
    path: "/sponsor",
    title: "Sponsor UltrasoundExpo™",
    pageKind: "sales" as const,
    seo: {
      title: "Sponsor UltrasoundExpo™ | Annual Ultrasound Event Partnerships",
      description: "Explore UltrasoundExpo™ sponsorship opportunities and connect your organization with ultrasound professionals and innovators.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "eyebrow", label: "Hero eyebrow", hint: "Short line above the page title." },
      { key: "headline", label: "Hero headline", hint: "Main page headline.", multiline: true },
      { key: "body", label: "Hero body", hint: "Supporting sales copy.", multiline: true },
      { key: "cta", label: "Call-to-action label", hint: "Button label that opens sponsorship registration." },
    ],
  },
  {
    slug: "program",
    path: "/program",
    title: "UltrasoundExpo™ Program",
    pageKind: "sales" as const,
    seo: {
      title: "UltrasoundExpo™ Program | Education, Innovation, and Connection",
      description: "Explore the UltrasoundExpo™ program: education, ScanLabs, workshops, innovation, career development, and professional connection.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "eyebrow", label: "Hero eyebrow", hint: "Short line above the page title." },
      { key: "headline", label: "Hero headline", hint: "Main page headline.", multiline: true },
      { key: "body", label: "Hero body", hint: "Supporting sales copy.", multiline: true },
      { key: "cta", label: "Call-to-action label", hint: "Button label that opens attendee registration." },
      { key: "schedule_heading", label: "Schedule heading", hint: "Headline above the annual program schedule.", multiline: true },
      { key: "schedule_introduction", label: "Schedule introduction", hint: "Short introduction and timing note above the schedule.", multiline: true },
      { key: "wednesday_schedule", label: "Wednesday schedule", hint: "One schedule item per line. Each line is shown exactly as entered.", multiline: true },
      { key: "thursday_schedule", label: "Thursday schedule", hint: "One schedule item per line. Each line is shown exactly as entered.", multiline: true },
      { key: "friday_schedule", label: "Friday schedule", hint: "One schedule item per line. Each line is shown exactly as entered.", multiline: true },
      { key: "saturday_schedule", label: "Saturday schedule", hint: "One schedule item per line. Each line is shown exactly as entered.", multiline: true },
      { key: "sunday_schedule", label: "Sunday schedule", hint: "One schedule item per line. Each line is shown exactly as entered.", multiline: true },
    ],
  },
  {
    slug: "expo",
    path: "/expo",
    title: "UltrasoundExpo™ Exhibit Hall",
    pageKind: "sales" as const,
    seo: {
      title: "UltrasoundExpo™ Exhibit Hall | Technology and Innovation",
      description: "Discover the UltrasoundExpo™ Exhibit Hall, bringing together technology, devices, AI, education, careers, and imaging innovation.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "eyebrow", label: "Hero eyebrow", hint: "Short line above the page title." },
      { key: "headline", label: "Hero headline", hint: "Main page headline.", multiline: true },
      { key: "body", label: "Hero body", hint: "Supporting sales copy.", multiline: true },
      { key: "cta", label: "Call-to-action label", hint: "Button label that opens exhibitor registration." },
    ],
  },
  {
    slug: "connect",
    path: "/connect",
    title: "Connect at UltrasoundExpo™",
    pageKind: "sales" as const,
    seo: {
      title: "Connect at UltrasoundExpo™ | Careers and Professional Networking",
      description: "Build professional connections at UltrasoundExpo™ through careers, networking, education, and industry collaboration.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "eyebrow", label: "Hero eyebrow", hint: "Short line above the page title." },
      { key: "headline", label: "Hero headline", hint: "Main page headline.", multiline: true },
      { key: "body", label: "Hero body", hint: "Supporting sales copy.", multiline: true },
      { key: "cta", label: "Call-to-action label", hint: "Button label that opens attendee registration." },
    ],
  },
  {
    slug: "about",
    path: "/about",
    title: "About UltrasoundExpo™",
    pageKind: "sales" as const,
    seo: {
      title: "About UltrasoundExpo™ | Annual Ultrasound Industry Event",
      description: "Learn about UltrasoundExpo™, the annual event by All About Ultrasound™ for the people and organizations advancing ultrasound.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "eyebrow", label: "Hero eyebrow", hint: "Short line above the page title." },
      { key: "headline", label: "Hero headline", hint: "Main page headline.", multiline: true },
      { key: "body", label: "Hero body", hint: "Supporting sales copy.", multiline: true },
      { key: "cta", label: "Call-to-action label", hint: "Button label that opens attendee registration." },
    ],
  },
  {
    slug: "register",
    path: "/register",
    title: "Register for UltrasoundExpo™",
    pageKind: "sales" as const,
    seo: {
      title: "Register for UltrasoundExpo™ | Attendees, Exhibitors, and Sponsors",
      description: "Register for UltrasoundExpo™ as an attendee, exhibitor, or sponsor through secure Stripe checkout.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "eyebrow", label: "Registration eyebrow", hint: "Short line above the registration title." },
      { key: "headline", label: "Registration headline", hint: "Main registration page headline." },
      { key: "body", label: "Registration introduction", hint: "Supporting copy above the registration options.", multiline: true },
      { key: "checkout_headline", label: "Checkout form headline", hint: "Heading in the registration detail panel." },
      { key: "checkout_body", label: "Checkout form introduction", hint: "Supporting copy in the registration detail panel.", multiline: true },
    ],
  },
  {
    slug: "expo-dashboard",
    path: "/expo-dashboard",
    title: "My UltrasoundExpo™ Dashboard",
    pageKind: "system" as const,
    seo: {
      title: "My UltrasoundExpo™ Dashboard | Registration and Ticket Details",
      description: "Sign in to view your UltrasoundExpo™ registration, ticket, exhibit, and sponsorship details.",
      image: ULTRASOUND_EXPO_HERO_IMAGE,
    },
    zones: [
      { key: "signed_out_headline", label: "Signed-out headline", hint: "Headline shown before a member signs in." },
      { key: "signed_out_body", label: "Signed-out introduction", hint: "Supporting copy shown before sign-in.", multiline: true },
      { key: "signed_in_headline", label: "Dashboard headline", hint: "Headline shown to signed-in members." },
      { key: "signed_in_body", label: "Dashboard introduction", hint: "Supporting copy shown to signed-in members.", multiline: true },
    ],
  },
] as const;

export type ExpoEditorPage = (typeof ULTRASOUND_EXPO_PAGE_EDITOR_PAGES)[number];

export function getUltrasoundExpoEditorPage(slug: string): ExpoEditorPage | undefined {
  return ULTRASOUND_EXPO_PAGE_EDITOR_PAGES.find((page) => page.slug === slug);
}

export function getUltrasoundExpoPageSeo(slug: string): ExpoPageSeo {
  return getUltrasoundExpoEditorPage(slug)?.seo
    ?? getUltrasoundExpoEditorPage("home")!.seo;
}

export const ULTRASOUND_EXPO_SCHEDULE = {
  heading: "The UltrasoundExpo™ Schedule",
  introduction: "Exhibitor setup begins Wednesday and continues Thursday, followed by a destination Friday evening, a full Saturday of education and innovation, and a Sunday closing celebration. All scheduled program times are Eastern Time.",
  days: [
    {
      key: "wednesday_schedule",
      label: "Wednesday",
      title: "Exhibitor Setup",
      summary: "Dedicated exhibitor setup and installation day.",
      items: ["Exhibitor setup"],
    },
    {
      key: "thursday_schedule",
      label: "Thursday",
      title: "Exhibitor Setup",
      summary: "Continued exhibitor setup and installation day.",
      items: ["Exhibitor setup"],
    },
    {
      key: "friday_schedule",
      label: "Friday",
      title: "Grand Opening & Destination Evening",
      summary: "Friday night becomes the destination event at UltrasoundExpo™.",
      items: [
        "12 PM – All exhibitor setup complete",
        "3 PM – Workshops / ScanLabs",
        "5 PM – UltrasoundExpo™ Grand Opening",
        "5–8 PM – Expo + Opening Reception",
      ],
    },
    {
      key: "saturday_schedule",
      label: "Saturday",
      title: "Education, Expo & Innovation",
      items: [
        "8 AM – Keynote",
        "9 AM – Education",
        "10 AM – Expo",
        "11 AM – CME Tracks / ScanLabs",
        "12 PM – Lunch in Expo",
        "1:30 PM – Education",
        "3 PM – Expo",
        "4 PM – Innovation Stage",
        "5 PM – Career sessions",
        "6 PM – Expo Social",
      ],
    },
    {
      key: "sunday_schedule",
      label: "Sunday",
      title: "CME, ScanLabs & Closing Celebration",
      items: [
        "8 AM – CME",
        "9:30 AM – Expo",
        "11 AM – ScanLabs",
        "12:30 PM – Closing keynote / awards",
        "2 PM – End",
      ],
    },
  ],
} as const;

export const ULTRASOUND_EXPO_LAUNCH_EVENT = {
  name: "UltrasoundExpo™ 2028",
  slug: "ultrasoundexpo-2028",
  startsAtIso: "2028-01-15T12:00:00-05:00",
  endsAtIso: "2028-01-18T14:00:00-05:00",
  timezone: "America/New_York",
  locationLabel: "Orlando, FL · Venue to be announced",
  shortDescription: "The annual ultrasound event for education, innovation, ScanLabs, exhibits, and connection — with a destination Grand Opening and Opening Reception on Friday evening.",
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
