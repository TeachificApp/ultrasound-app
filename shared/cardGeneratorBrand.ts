/**
 * Brand-specific assets and copy for Challenge Card Generator and Social Content Generator.
 */
import type { Brand } from "./brands";
import { getBrandDisplayConfig } from "./brands";

export type CardGeneratorBrand = Brand;

export interface CardGeneratorBrandConfig {
  brand: CardGeneratorBrand;
  displayName: string;
  appProductName: string;
  appUrlHost: string;
  logoUrl: string;
  logoRingUrl?: string;
  heroUrl: string;
  primary: string;
  dark: string;
  accent: string;
  challengeSubtitle: string;
  tagline: string;
  zipPrefix: string;
  requiredHashtags: string[];
  categoryHashtags: Record<string, string[]>;
  socialCategories: string[];
}

const AAUS_LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_icon_192_teal_f0c966ce.png";
const AAUS_LOGO_RING =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";
const AAUS_HERO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/daily-challenge-banner-v3_AAUS_ccb55bf0.webp";

const IHE_LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/icon-192_df958e9b.png";
const IHE_HERO = "/manus-storage/ihe-daily-challenge-hero_6384adcf.webp";

const AAUS_CATEGORY_HASHTAGS: Record<string, string[]> = {
  Abdominal: ["#AbdominalUltrasound", "#AbdominalImaging", "#GIUltrasound"],
  "Small Parts": ["#SmallPartsUltrasound", "#ThyroidUltrasound", "#ScrotalUltrasound"],
  "Pelvic/Gyn": ["#PelvicUltrasound", "#GynUltrasound", "#PelvicImaging"],
  "OB 1st Trimester": ["#FirstTrimester", "#ObstetricUltrasound", "#OBUltrasound"],
  "OB 2nd/3rd Trimester": ["#ObstetricUltrasound", "#FetalImaging", "#OBUltrasound"],
  "Fetal Echo": ["#FetalEcho", "#FetalCardiology", "#FetalUltrasound"],
  Breast: ["#BreastUltrasound", "#BreastImaging", "#BIRADs"],
  Vascular: ["#VascularUltrasound", "#VascularImaging", "#DuplexScan"],
  MSK: ["#MSKUltrasound", "#MusculoskeletalUltrasound", "#MSKImaging"],
  POCUS: ["#POCUS", "#PointOfCareUltrasound", "#BedSideUltrasound"],
  Physics: ["#UltrasoundPhysics", "#SonographyPhysics", "#UltrasoundInstrumentation"],
  "OB/Gyn": ["#ObstetricUltrasound", "#GynUltrasound", "#PelvicUltrasound"],
};

const IHE_CATEGORY_HASHTAGS: Record<string, string[]> = {
  "Adult Echo": ["#AdultEcho", "#Echocardiography", "#TTE"],
  "Pediatric Echo": ["#PediatricEcho", "#CongenitalHeartDisease", "#PedCardiology"],
  ACS: ["#AcuteCoronarySyndrome", "#RWMA", "#EmergencyEcho"],
  "Fetal Echo": ["#FetalEcho", "#FetalCardiology", "#CongenitalHeartDisease"],
  ECG: ["#ECG", "#Electrocardiography", "#Cardiology"],
  POCUS: ["#POCUS", "#PointOfCareUltrasound", "#BedSideEcho"],
  Physics: ["#EchoPhysics", "#UltrasoundPhysics", "#Doppler"],
  Echocardiography: ["#Echocardiography", "#CardiacUltrasound", "#EchoFirst"],
};

const AAUS_SOCIAL_CATEGORIES = [
  "Abdominal",
  "Small Parts",
  "Pelvic/Gyn",
  "OB 1st Trimester",
  "OB 2nd/3rd Trimester",
  "Fetal Echo",
  "Breast",
  "Vascular",
  "MSK",
  "POCUS",
  "Physics",
  "General Ultrasound",
] as const;

const IHE_SOCIAL_CATEGORIES = [
  "Adult Echo",
  "Pediatric Echo",
  "ACS",
  "Fetal Echo",
  "ECG",
  "POCUS",
  "Physics",
  "Echocardiography",
] as const;

export function getCardGeneratorBrandConfig(brand: CardGeneratorBrand): CardGeneratorBrandConfig {
  const display = getBrandDisplayConfig(brand);
  if (brand === "iheartecho") {
    return {
      brand: "iheartecho",
      displayName: display.displayName,
      appProductName: "EchoAssist™",
      appUrlHost: "app.iheartecho.com",
      logoUrl: IHE_LOGO,
      heroUrl: IHE_HERO,
      primary: display.primaryColor,
      dark: display.darkColor,
      accent: display.accentColor,
      challengeSubtitle: "Daily Echo Challenge",
      tagline: "See It. Measure It. Make a Difference.",
      zipPrefix: "echoassist",
      requiredHashtags: [
        "#iHeartEcho",
        "#EchoAssist",
        "#Echocardiography",
        "#DailyChallenge",
        "#EchoChallenge",
        "#Cardiology",
        "#CardiacUltrasound",
        "#EchoFirst",
      ],
      categoryHashtags: IHE_CATEGORY_HASHTAGS,
      socialCategories: [...IHE_SOCIAL_CATEGORIES],
    };
  }

  return {
    brand: "aaus",
    displayName: display.displayName,
    appProductName: "UltrasoundAssist™",
    appUrlHost: "app.allaboutultrasound.com",
    logoUrl: AAUS_LOGO,
    logoRingUrl: AAUS_LOGO_RING,
    heroUrl: AAUS_HERO,
    primary: display.primaryColor,
    dark: "#0d3d44",
    accent: display.accentColor,
    challengeSubtitle: "Daily Ultrasound Challenge",
    tagline: "See It. Measure It. Make a Difference.",
    zipPrefix: "ultrasoundassist",
    requiredHashtags: [
      "#AllAboutUltrasound",
      "#UltrasoundAssist",
      "#Ultrasound",
      "#DailyChallenge",
      "#UltrasoundChallenge",
      "#Sonography",
      "#MedicalImaging",
      "#Sonographer",
      "#UltrasoundEducation",
    ],
    categoryHashtags: AAUS_CATEGORY_HASHTAGS,
    socialCategories: [...AAUS_SOCIAL_CATEGORIES],
  };
}

export function getCategoryHashtags(cfg: CardGeneratorBrandConfig, category: string): string[] {
  if (cfg.categoryHashtags[category]) return cfg.categoryHashtags[category];
  for (const [key, tags] of Object.entries(cfg.categoryHashtags)) {
    if (
      category.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(category.toLowerCase())
    ) {
      return tags;
    }
  }
  return cfg.brand === "iheartecho"
    ? ["#EchoTraining", "#CardiacImaging", "#EchoEducation"]
    : ["#UltrasoundTraining", "#ClinicalImaging", "#SonographyEducation"];
}

export function buildChallengeSocialPost(
  cfg: CardGeneratorBrandConfig,
  type: "question" | "answer",
  category: string,
  questionText: string,
  answerText: string | null,
  explanationText: string | null,
  options?: string[],
): string {
  const cleanQ = stripHtml(questionText);
  const cleanA = answerText ? stripHtml(answerText) : null;
  const cleanE = explanationText ? stripHtml(explanationText) : null;
  const categoryTags = getCategoryHashtags(cfg, category);
  const allHashtags = [...cfg.requiredHashtags, ...categoryTags].join(" ");
  const letters = ["A", "B", "C", "D", "E"];
  const challengeLabel =
    cfg.brand === "iheartecho" ? "Daily Echo Challenge" : "Daily Ultrasound Challenge";

  if (type === "question") {
    const optionsBlock =
      options && options.length > 0
        ? "\n\n" + options.map((o, i) => `${letters[i]}. ${stripHtml(o)}`).join("\n")
        : "";
    return `🏆${challengeLabel} — ${category}

Can you answer today's question?

❓ ${cleanQ}${optionsBlock}

Drop your answer in the comments below! 👇

Get more challenges and take your place on the leaderboard 🏆 at ${cfg.appUrlHost}

${allHashtags}`;
  }

  const answerLine = cleanA ? `✅ Answer: ${cleanA}` : "";
  const explanationLine = cleanE ? `\n\n💡 ${cleanE}` : "";
  return `🏆${challengeLabel} — ${category} | ANSWER

${answerLine}${explanationLine}

Get more challenges and take your place on the leaderboard 🏆 at ${cfg.appUrlHost}

${allHashtags}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
