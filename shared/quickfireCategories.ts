/**
 * Canonical Daily Challenge category configuration for AAUS (UltrasoundAssist)
 * and iHeartEcho (EchoAssist). Single source of truth for server + client.
 */

import { detectBrandFromPath as detectBrandTagFromPath } from "./brandScopedRoutes";

export type QuickfireBrand = "aaus" | "iheartecho";

/** AAUS daily challenge slots (merged categories shown to users) */
export const CHALLENGE_CATEGORIES = [
  "Abdominal",
  "OB/Gyn",
  "Small Parts",
  "Vascular",
  "MSK",
  "POCUS",
] as const;

export type AausChallengeCategory = (typeof CHALLENGE_CATEGORIES)[number];

/** iHeartEcho daily challenge slots */
export const IHE_CHALLENGE_CATEGORIES = [
  "Adult Echo",
  "Pediatric Echo",
  "ACS",
  "Fetal Echo",
  "ECG",
  "POCUS",
  "Physics",
] as const;

export type IheChallengeCategory = (typeof IHE_CHALLENGE_CATEGORIES)[number];

/** Granular DB question categories (question bank storage) */
export const AAUS_QUESTION_CATEGORIES = [
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
] as const;

export const IHE_QUESTION_CATEGORIES = [
  "ACS",
  "Adult Echo",
  "Pediatric Echo",
  "General",
  "Fetal Echo",
  "POCUS",
  "Physics",
] as const;

export const AAUS_CAT_KEY: Record<AausChallengeCategory, string> = {
  Abdominal: "abdominal",
  "OB/Gyn": "obgyn",
  "Small Parts": "smallParts",
  Vascular: "vascular",
  MSK: "msk",
  POCUS: "pocus",
};

export const IHE_CAT_KEY: Record<IheChallengeCategory, string> = {
  "Adult Echo": "adultEcho",
  "Pediatric Echo": "pediatricEcho",
  ACS: "acs",
  "Fetal Echo": "fetalEcho",
  ECG: "ecg",
  POCUS: "pocus",
  Physics: "physics",
};

/** Map daily slot → granular question.category values for backfill queries (AAUS) */
export const AAUS_QUESTION_POOL_LABELS: Record<string, string[]> = {
  "OB/Gyn": ["Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "OB/Gyn"],
  "Small Parts": ["Small Parts", "Breast"],
  Vascular: ["Vascular"],
};

/** Map daily slot → question.category values for backfill (IHE) */
export const IHE_QUESTION_POOL_LABELS: Record<string, string[]> = {
  "Adult Echo": ["Adult Echo", "General"],
  "Pediatric Echo": ["Pediatric Echo", "General"],
  ACS: ["ACS", "General"],
  "Fetal Echo": ["Fetal Echo", "General"],
  ECG: ["General"],
  POCUS: ["POCUS", "General"],
  Physics: ["Physics", "General"],
};

export function getBrandCategoryConfig(brand: string): {
  brand: QuickfireBrand;
  categories: readonly string[];
  catKey: Record<string, string>;
  defaultMap: Record<string, number | null>;
  defaultOrder: string[];
  defaultEnabledSet: Set<string>;
  questionPoolLabels: Record<string, string[]>;
  defaultPrefs: Record<string, boolean>;
} {
  if (brand === "iheartecho") {
    const defaultMap: Record<string, number | null> = {
      adultEcho: null,
      pediatricEcho: null,
      acs: null,
      fetalEcho: null,
      ecg: null,
      pocus: null,
      physics: null,
    };
    const defaultPrefs = {
      adultEcho: true,
      pediatricEcho: true,
      acs: true,
      fetalEcho: true,
      ecg: true,
      pocus: true,
      physics: true,
    };
    return {
      brand: "iheartecho",
      categories: IHE_CHALLENGE_CATEGORIES,
      catKey: IHE_CAT_KEY,
      defaultMap,
      defaultOrder: ["adultEcho", "pediatricEcho", "acs", "fetalEcho", "ecg", "pocus", "physics"],
      defaultEnabledSet: new Set(Object.keys(defaultPrefs)),
      questionPoolLabels: IHE_QUESTION_POOL_LABELS,
      defaultPrefs,
    };
  }

  const defaultMap: Record<string, number | null> = {
    abdominal: null,
    obgyn: null,
    smallParts: null,
    vascular: null,
    msk: null,
    pocus: null,
  };
  const defaultPrefs = {
    abdominal: true,
    obgyn: true,
    smallParts: true,
    vascular: true,
    msk: true,
    pocus: true,
  };
  return {
    brand: "aaus",
    categories: CHALLENGE_CATEGORIES,
    catKey: AAUS_CAT_KEY,
    defaultMap,
    defaultOrder: ["abdominal", "obgyn", "smallParts", "vascular", "msk", "pocus"],
    defaultEnabledSet: new Set(Object.keys(defaultPrefs)),
    questionPoolLabels: AAUS_QUESTION_POOL_LABELS,
    defaultPrefs,
  };
}

export function getChallengeCategoriesForBrand(brand: string): readonly string[] {
  return getBrandCategoryConfig(brand).categories;
}

export function isIheCategoryMapKey(key: string): boolean {
  return ["adultEcho", "pediatricEcho", "acs", "fetalEcho", "ecg", "pocus", "physics"].includes(key);
}

export function detectBrandFromPath(pathname: string): QuickfireBrand | null {
  return detectBrandTagFromPath(pathname);
}
