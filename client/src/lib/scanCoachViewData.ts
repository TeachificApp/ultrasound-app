/**
 * scanCoachViewData.ts
 *
 * Central import/re-export of all static view data from each ScanCoach page.
 * Used by the ScanCoach Editor to render WYSIWYG previews that exactly
 * match what users see in the live pages.
 */

// ── General & Small Parts ────────────────────────────────────────────────────
import { views as _abdominalViews } from "@/pages/AbdominalScanCoach";
import { taViews as _pelvicGynTaViews, tvsViews as _pelvicGynTvsViews } from "@/pages/PelvicGynScanCoach";
import { views as _ob1Views } from "@/pages/OB1ScanCoach";
import { views as _ob23Views } from "@/pages/OB23ScanCoach";
import { views as _thyroidViews } from "@/pages/ThyroidScanCoach";
import { views as _scrotumViews } from "@/pages/ScrotumScanCoach";

// ── Vascular ─────────────────────────────────────────────────────────────────
import { views as _venousViews } from "@/pages/VenousScanCoach";
import { views as _arterialViews } from "@/pages/ArterialScanCoach";
import {
  liverViews as _abdominalVascularLiverViews,
  mesentericViews as _abdominalVascularMesentericViews,
  tipsViews as _abdominalVascularTipsViews,
  renalViews as _abdominalVascularRenalViews,
} from "@/pages/AbdominalVascularScanCoach";
import { views as _aortaViews } from "@/pages/AortaScanCoach";
import { views as _carotidViews } from "@/pages/CarotidScanCoach";
import { views as _tcdViews } from "@/pages/TCDScanCoach";

// ── MSK ──────────────────────────────────────────────────────────────────────
import { views as _mskViews } from "@/pages/MSKScanCoach";

// ── Breast ───────────────────────────────────────────────────────────────────
import { views as _breastViews } from "@/pages/BreastScanCoach";

// ── POCUS ────────────────────────────────────────────────────────────────────
import { EFAST_VIEWS as _pocusEfastViews } from "@/pages/POCUSEfastScanCoach";
import { RUSH_VIEWS as _pocusRushViews } from "@/pages/POCUSRushScanCoach";
import { CARDIAC_VIEWS as _pocusCardiacViews } from "@/pages/POCUSCardiacScanCoach";
import { LUNG_VIEWS as _pocusLungViews } from "@/pages/POCUSLungScanCoach";

// ── Procedures ───────────────────────────────────────────────────────────────
import { views as _appendixViews } from "@/pages/AppendixScanCoach";
import { views as _invasiveProceduresViews } from "@/pages/InvasiveProceduresScanCoach";

// ── Fetal Echo ───────────────────────────────────────────────────────────────
import { FETAL_VIEWS as _fetalViews } from "@/pages/FetalScanCoach";

// Re-export for direct use
export const abdominalViews = _abdominalViews;
export const pelvicGynTaViews = _pelvicGynTaViews;
export const pelvicGynTvsViews = _pelvicGynTvsViews;
export const ob1Views = _ob1Views;
export const ob23Views = _ob23Views;
export const thyroidViews = _thyroidViews;
export const scrotumViews = _scrotumViews;
export const venousViews = _venousViews;
export const arterialViews = _arterialViews;
export const abdominalVascularLiverViews = _abdominalVascularLiverViews;
export const abdominalVascularMesentericViews = _abdominalVascularMesentericViews;
export const abdominalVascularTipsViews = _abdominalVascularTipsViews;
export const abdominalVascularRenalViews = _abdominalVascularRenalViews;
export const aortaViews = _aortaViews;
export const carotidViews = _carotidViews;
export const tcdViews = _tcdViews;
export const mskViews = _mskViews;
export const breastViews = _breastViews;
export const pocusEfastViews = _pocusEfastViews;
export const pocusRushViews = _pocusRushViews;
export const pocusCardiacViews = _pocusCardiacViews;
export const pocusLungViews = _pocusLungViews;
export const appendixViews = _appendixViews;
export const invasiveProceduresViews = _invasiveProceduresViews;
export const fetalViews = _fetalViews;

// ── Tip type ─────────────────────────────────────────────────────────────────
export type StructuredTip = { category: string; text: string };

export type ScanCoachView = {
  id: string;
  view?: string;
  name?: string;
  probe?: string;
  tips: StructuredTip[] | string[];
  [key: string]: unknown;
};

/**
 * Returns the views array for a given module key.
 * For modules with multiple view groups (pelvic_gyn, abdominal_vascular),
 * returns all views concatenated.
 */
export function getViewsForModule(moduleKey: string): ScanCoachView[] {
  switch (moduleKey) {
    case "abdominal":          return _abdominalViews as unknown as ScanCoachView[];
    case "pelvic_gyn":         return [..._pelvicGynTaViews, ..._pelvicGynTvsViews] as unknown as ScanCoachView[];
    case "ob1":                return _ob1Views as unknown as ScanCoachView[];
    case "ob23":               return _ob23Views as unknown as ScanCoachView[];
    case "thyroid":            return _thyroidViews as unknown as ScanCoachView[];
    case "scrotum":            return _scrotumViews as unknown as ScanCoachView[];
    case "venous":             return _venousViews as unknown as ScanCoachView[];
    case "arterial":           return _arterialViews as unknown as ScanCoachView[];
    case "abdominal_vascular": return [
      ..._abdominalVascularLiverViews,
      ..._abdominalVascularMesentericViews,
      ..._abdominalVascularTipsViews,
      ..._abdominalVascularRenalViews,
    ] as unknown as ScanCoachView[];
    case "aorta":              return _aortaViews as unknown as ScanCoachView[];
    case "carotid":            return _carotidViews as unknown as ScanCoachView[];
    case "tcd":                return _tcdViews as unknown as ScanCoachView[];
    case "msk":                return _mskViews as unknown as ScanCoachView[];
    case "breast":             return _breastViews as unknown as ScanCoachView[];
    case "pocus_efast":        return _pocusEfastViews as unknown as ScanCoachView[];
    case "pocus_rush":         return _pocusRushViews as unknown as ScanCoachView[];
    case "pocus_cardiac":      return _pocusCardiacViews as unknown as ScanCoachView[];
    case "pocus_lung":         return _pocusLungViews as unknown as ScanCoachView[];
    case "appendix":           return _appendixViews as unknown as ScanCoachView[];
    case "invasive_procedures":return _invasiveProceduresViews as unknown as ScanCoachView[];
    case "fetal":              return _fetalViews as unknown as ScanCoachView[];
    default:                   return [];
  }
}

/**
 * Returns true if the tips array uses the {category, text}[] structured format.
 * Returns false if tips are plain strings.
 */
export function isStructuredTips(tips: unknown[]): tips is StructuredTip[] {
  return tips.length > 0 && typeof tips[0] === "object" && tips[0] !== null && "category" in (tips[0] as object);
}

/** All known tip categories with their brand colors */
export const TIP_CATEGORIES = [
  { label: "Patient Positioning",    color: "#0e4a50" },
  { label: "Transducer Positioning", color: "#189aa1" },
  { label: "What to Assess",         color: "#0e1e2e" },
  { label: "Doppler",                color: "#4a6fa5" },
  { label: "Doppler Optimization",   color: "#4a6fa5" },
  { label: "Scanning Tip",           color: "#189aa1" },
  { label: "Optimization",           color: "#0e4a50" },
  { label: "Pitfall",                color: "#d97706" },
  { label: "Pearl",                  color: "#059669" },
  { label: "Preparation",            color: "#0e4a50" },
  { label: "Positioning",            color: "#0e4a50" },
  { label: "Equipment",              color: "#4a6fa5" },
  { label: "Documentation",          color: "#0e1e2e" },
  { label: "Post-Prandial Protocol", color: "#d97706" },
] as const;

export const TIP_COLOR_MAP: Record<string, string> = Object.fromEntries(
  TIP_CATEGORIES.map((c) => [c.label, c.color])
);
