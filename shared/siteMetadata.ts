import {
  ULTRASOUND_EXPO_HERO_IMAGE,
  ULTRASOUND_EXPO_LOGO_URL,
} from "./ultrasoundExpo";

export type SiteMetadata = {
  siteName: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  themeColor: string;
  imageWidth?: number;
  imageHeight?: number;
  appTitle: string;
  twitterSite?: string;
  keywords?: string;
};

/**
 * EchoExpo's supplied public hero is stored behind the first-party static
 * object route. Social crawlers require a complete URL rather than a relative
 * /manus-storage path.
 */
const ECHO_EXPO_HERO_IMAGE =
  "https://www.echocardiographyexpo.com/manus-storage/echoexpo-hero-approved_2a95e8a5.png";
const ECHO_EXPO_FAVICON =
  "https://echocardiographyexpo.com/manus-storage/echoexpo-logo_535dff69.png";

const AAUS_LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_e47ffb71.png";
const IHE_LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/icon-512_79ee0572.png";

const ULTRASOUND_EXPO_METADATA: SiteMetadata = {
  keywords: "UltrasoundExpo, ultrasound event, ultrasound conference, sonographers, exhibitors, Orlando, January 11–13 2028",
  siteName: "UltrasoundExpo™",
  title: "UltrasoundExpo™ | The Annual Event for Ultrasound Professionals",
  description:
    "UltrasoundExpo™ by All About Ultrasound™ brings education, innovation, hands-on learning, exhibitors, and connection together in Orlando, January 11–13, 2028.",
  image: ULTRASOUND_EXPO_HERO_IMAGE,
  favicon: ULTRASOUND_EXPO_LOGO_URL,
  themeColor: "#087f8c",
  appTitle: "UltrasoundExpo™",
};

const ECHO_EXPO_METADATA: SiteMetadata = {
  keywords: "EchoExpo, echocardiography event, cardiac ultrasound, Echo Skills, Echo Games, Orlando, January 14–16 2028",
  siteName: "EchoExpo™",
  title: "EchoExpo™ | The Standalone Echocardiography Event",
  description:
    "EchoExpo™ by iHeartEcho™ is the standalone cardiac ultrasound and echocardiography event immediately following UltrasoundExpo™, with education, Echo Skills, Echo Games, hands-on CME, innovation, and its own dedicated exhibit hall in Orlando, January 14–16, 2028.",
  image: ECHO_EXPO_HERO_IMAGE,
  favicon: ECHO_EXPO_FAVICON,
  themeColor: "#0b9fa5",
  appTitle: "EchoExpo™",
};

const APP_AAUS_METADATA: SiteMetadata = {
  siteName: "All About Ultrasound™",
  title: "UltrasoundAssist™ | All About Ultrasound™",
  description:
    "Clinical ultrasound intelligence from All About Ultrasound™ for sonographers, physicians, educators, and imaging professionals.",
  image: AAUS_LOGO,
  favicon: AAUS_LOGO,
  themeColor: "#189aa1",
  appTitle: "UltrasoundAssist™",
  twitterSite: "@allaboutultrasound",
};

const APP_IHE_METADATA: SiteMetadata = {
  keywords: "EchoAssist, iHeartEcho, echocardiography, cardiac ultrasound, echo protocols, clinical calculators",
  siteName: "iHeartEcho™",
  title: "EchoAssist™ by iHeartEcho™ | Echocardiography Clinical Intelligence",
  description:
    "EchoAssist™ by iHeartEcho™ provides echocardiography protocols, calculators, clinical learning, and reference tools for cardiac ultrasound professionals.",
  image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663401463434/MoTslpfWBnnaocOo.jpg",
  imageWidth: 1200,
  imageHeight: 675,
  favicon: IHE_LOGO,
  themeColor: "#0e1e2e",
  appTitle: "EchoAssist™",
  twitterSite: "@iHeartEcho",
};

const LEARN_METADATA: SiteMetadata = {
  keywords: "ultrasound education, echocardiography education, CME, courses, workshops, cohorts, quizzes, webinars",
  siteName: "All About Ultrasound™ | iHeartEcho™",
  title: "Learn | All About Ultrasound™ + iHeartEcho™",
  description:
    "Courses, CME, workshops, cohorts, quizzes, webinars, and clinical learning for ultrasound and echocardiography professionals.",
  image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663401463434/yLPYnDQQBKYappfZ.jpg",
  imageWidth: 1200,
  imageHeight: 675,
  favicon: AAUS_LOGO,
  themeColor: "#189aa1",
  appTitle: "AAUS | iHeartEcho",
  twitterSite: "@allaboutultrasound",
};

const ACCREDITATION_METADATA: SiteMetadata = {
  siteName: "iHeartEcho™ Accreditation",
  title: "Accreditation | iHeartEcho™",
  description:
    "Accreditation, education management, compliance, and program resources for ultrasound and echocardiography education.",
  image: IHE_LOGO,
  favicon: IHE_LOGO,
  themeColor: "#c77722",
  appTitle: "iHeartEcho™ Accreditation",
  twitterSite: "@iHeartEcho",
};

const MEMBERS_METADATA: SiteMetadata = {
  siteName: "All About Ultrasound™ | iHeartEcho™",
  title: "Member Hub | All About Ultrasound™ + iHeartEcho™",
  description:
    "Manage your learning, memberships, subscriptions, purchases, and professional profile in the All About Ultrasound™ and iHeartEcho™ Member Hub.",
  image: AAUS_LOGO,
  favicon: AAUS_LOGO,
  themeColor: "#189aa1",
  appTitle: "Member Hub",
  twitterSite: "@allaboutultrasound",
};

const AAUS_MARKETING_METADATA: SiteMetadata = {
  siteName: "All About Ultrasound™",
  title: "All About Ultrasound™ | Education, Events, and Clinical Resources",
  description:
    "Education, CME, events, clinical resources, and professional development for the ultrasound community.",
  image: AAUS_LOGO,
  favicon: AAUS_LOGO,
  themeColor: "#189aa1",
  appTitle: "All About Ultrasound™",
  twitterSite: "@allaboutultrasound",
};

const IHE_MARKETING_METADATA: SiteMetadata = {
  siteName: "iHeartEcho™",
  title: "iHeartEcho™ | Echocardiography Education and Resources",
  description:
    "Echocardiography education, clinical resources, events, and professional development for the cardiac ultrasound community.",
  image: IHE_LOGO,
  favicon: IHE_LOGO,
  themeColor: "#0e1e2e",
  appTitle: "iHeartEcho™",
  twitterSite: "@iHeartEcho",
};

export const DOMAIN_METADATA: Readonly<Record<string, SiteMetadata>> = {
  "ultrasoundexpo.com": ULTRASOUND_EXPO_METADATA,
  "www.ultrasoundexpo.com": ULTRASOUND_EXPO_METADATA,
  "echocardiographyexpo.com": ECHO_EXPO_METADATA,
  "www.echocardiographyexpo.com": ECHO_EXPO_METADATA,
  "echoexpo.iheartecho.com": ECHO_EXPO_METADATA,

  "app.allaboutultrasound.com": APP_AAUS_METADATA,
  "app.iheartecho.com": APP_IHE_METADATA,
  "app.iheartecho.net": APP_IHE_METADATA,
  "learn.allaboutultrasound.com": LEARN_METADATA,
  "learn.iheartecho.com": LEARN_METADATA,
  "members.allaboutultrasound.com": MEMBERS_METADATA,
  "member.allaboutultrasound.com": MEMBERS_METADATA,
  "accreditation.iheartecho.com": ACCREDITATION_METADATA,

  "allaboutultrasound.com": AAUS_MARKETING_METADATA,
  "www.allaboutultrasound.com": AAUS_MARKETING_METADATA,
  "allaboutultrasound.net": AAUS_MARKETING_METADATA,
  "www.allaboutultrasound.net": AAUS_MARKETING_METADATA,
  "site.allaboutultrasound.com": AAUS_MARKETING_METADATA,
  "iheartecho.com": IHE_MARKETING_METADATA,
  "www.iheartecho.com": IHE_MARKETING_METADATA,
  "iheartecho.net": IHE_MARKETING_METADATA,
  "www.iheartecho.net": IHE_MARKETING_METADATA,
};

export function normalizeMetadataHostname(value: string | null | undefined): string {
  const candidate = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!candidate) return "";
  try {
    if (/^https?:\/\//i.test(candidate)) return new URL(candidate).hostname.toLowerCase();
  } catch {
    return "";
  }
  return candidate.replace(/^\[|\]$/g, "").split(":")[0] ?? "";
}

export function getSiteMetadataForHostname(hostname: string | null | undefined): SiteMetadata | null {
  return DOMAIN_METADATA[normalizeMetadataHostname(hostname)] ?? null;
}
