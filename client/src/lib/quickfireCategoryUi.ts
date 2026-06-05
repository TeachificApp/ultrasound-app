import {
  Activity,
  Baby,
  FlaskConical,
  Heart,
  Scan,
  Stethoscope,
  Wind,
  type LucideIcon,
} from "lucide-react";
import {
  CHALLENGE_CATEGORIES,
  IHE_CHALLENGE_CATEGORIES,
  getBrandCategoryConfig,
  isIheCategoryMapKey,
  type QuickfireBrand,
} from "@shared/quickfireCategories";

export type DisplayCategory = {
  key: string;
  label: string;
  desc: string;
  mapKey: string;
  prefKey: string;
  Icon: LucideIcon;
  isPocus: boolean;
};

const AAUS_META: Record<string, { desc: string; Icon: LucideIcon }> = {
  Abdominal: { desc: "Abdominal Ultrasound", Icon: Activity },
  "OB/Gyn": { desc: "OB/Gyn Ultrasound", Icon: Baby },
  "Small Parts": { desc: "Small Parts Ultrasound", Icon: Scan },
  Vascular: { desc: "Vascular Duplex", Icon: Activity },
  MSK: { desc: "Musculoskeletal Ultrasound", Icon: Stethoscope },
  POCUS: { desc: "Point-of-Care Ultrasound", Icon: Wind },
};

const IHE_META: Record<string, { desc: string; Icon: LucideIcon }> = {
  "Adult Echo": { desc: "Adult Echocardiography", Icon: Heart },
  "Pediatric Echo": { desc: "Pediatric Echocardiography", Icon: Baby },
  ACS: { desc: "Acute Coronary Syndrome", Icon: Activity },
  "Fetal Echo": { desc: "Fetal Echocardiography", Icon: Heart },
  ECG: { desc: "Electrocardiography", Icon: Activity },
  POCUS: { desc: "Point-of-Care Ultrasound", Icon: Wind },
  Physics: { desc: "Echo Physics & Instrumentation", Icon: FlaskConical },
};

export function resolveQuickfireBrand(
  categoryMap: Record<string, number | null | undefined>,
  hostnameIhe: boolean,
): QuickfireBrand {
  if (hostnameIhe) return "iheartecho";
  if (Object.keys(categoryMap).some(isIheCategoryMapKey)) return "iheartecho";
  return "aaus";
}

export function buildDisplayCategories(brand: QuickfireBrand): DisplayCategory[] {
  const cfg = getBrandCategoryConfig(brand);
  const labels = brand === "iheartecho" ? IHE_CHALLENGE_CATEGORIES : CHALLENGE_CATEGORIES;
  const meta = brand === "iheartecho" ? IHE_META : AAUS_META;
  return labels.map((label) => {
    const mapKey = cfg.catKey[label];
    const m = meta[label] ?? { desc: label, Icon: Activity };
    return {
      key: label,
      label,
      desc: m.desc,
      mapKey,
      prefKey: mapKey,
      Icon: m.Icon,
      isPocus: label === "POCUS",
    };
  });
}

export function defaultCategoryPrefs(brand: QuickfireBrand): Record<string, boolean> {
  return { ...getBrandCategoryConfig(brand).defaultPrefs };
}
