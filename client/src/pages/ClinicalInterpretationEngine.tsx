/*
 * UltrasoundAssist™ Clinical Interpretation Engine
 * Guideline-driven decision support across all 10 ultrasound categories.
 * Each tool: Inputs → Guideline Logic → Interpretation + Severity + Next Step
 *
 * Guidelines: ACR LI-RADS v2018, ACR TI-RADS 2017, ACR BI-RADS 5th Ed,
 *             ACR O-RADS v2022, SRU Carotid Consensus, SVU Renal Doppler,
 *             ISUOG Fetal Echo, ACOG/SMFM OB, ACEP FAST/IVC, ESSR MSK
 */

import { useState } from "react";
import Layout from "@/components/Layout";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { usePremium } from "@/hooks/usePremium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Baby,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  Copy,
  Heart,
  Microscope,
  RefreshCw,
  Scan,
  Stethoscope,
  Wind,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Severity =
  | "normal"
  | "mild"
  | "moderate"
  | "severe"
  | "critical"
  | "indeterminate"
  | "info";

interface InterpretationResult {
  interpretation: string;
  severity: Severity;
  nextStep: string;
  reference?: string;
  detail?: string;
}

const SEV: Record<
  Severity,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  normal:        { label: "Normal",        bg: "bg-green-50",  text: "text-green-800",  border: "border-green-200",  dot: "bg-green-500"  },
  mild:          { label: "Mild",          bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200", dot: "bg-yellow-400" },
  moderate:      { label: "Moderate",      bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-200", dot: "bg-orange-500" },
  severe:        { label: "Severe",        bg: "bg-red-50",    text: "text-red-800",    border: "border-red-200",    dot: "bg-red-500"    },
  critical:      { label: "Critical",      bg: "bg-red-100",   text: "text-red-900",    border: "border-red-400",    dot: "bg-red-700"    },
  indeterminate: { label: "Indeterminate", bg: "bg-gray-50",   text: "text-gray-700",   border: "border-gray-200",   dot: "bg-gray-400"   },
  info:          { label: "Info",          bg: "bg-blue-50",   text: "text-blue-800",   border: "border-blue-200",   dot: "bg-blue-400"   },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GUIDELINE LOGIC FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── LI-RADS (ACR v2018) ────────────────────────────────────────────────────────
function runLiRADS(v: Record<string, string>): InterpretationResult {
  const ae = v.arterialEnhancement;
  const wo = v.washout;
  const cap = v.capsule;
  const grow = v.growth;
  const anc = v.ancillary;

  if (anc === "malignant")
    return {
      interpretation: "LR-M — Probably or definitely malignant; non-HCC malignancy not excluded.",
      severity: "severe",
      nextStep: "Multidisciplinary hepatology review. CT/MRI with contrast or tissue sampling recommended.",
      reference: "ACR LI-RADS v2018",
    };
  if (anc === "benign")
    return {
      interpretation: "LR-1 — Definitely benign. Ancillary features favor benign entity.",
      severity: "normal",
      nextStep: "Routine surveillance per underlying liver disease protocol.",
      reference: "ACR LI-RADS v2018",
    };

  let pts = 0;
  if (ae === "yes") pts += 2;
  if (wo === "yes") pts += 1;
  if (cap === "yes") pts += 1;
  if (grow === "yes") pts += 1;

  const size = parseFloat(v.size || "0");

  if (size < 10 && pts === 0)
    return { interpretation: "LR-1 — Definitely benign (< 10 mm, no major features).", severity: "normal", nextStep: "Routine hepatic surveillance.", reference: "ACR LI-RADS v2018" };
  if (pts <= 1 && size < 20)
    return { interpretation: "LR-2 — Probably benign. Low likelihood of HCC.", severity: "mild", nextStep: "Continue hepatic surveillance at standard intervals.", reference: "ACR LI-RADS v2018" };
  if (pts === 2 || (pts <= 2 && size >= 20))
    return { interpretation: "LR-3 — Intermediate probability of HCC.", severity: "moderate", nextStep: "Repeat CT/MRI in 3–6 months or proceed to diagnostic imaging.", reference: "ACR LI-RADS v2018" };
  if (pts === 3 && size >= 10)
    return { interpretation: "LR-4 — Probably HCC. High probability of malignancy.", severity: "severe", nextStep: "Multidisciplinary hepatology review. Diagnostic CT/MRI or biopsy recommended.", reference: "ACR LI-RADS v2018" };
  if (pts >= 4 || (ae === "yes" && wo === "yes" && cap === "yes"))
    return { interpretation: "LR-5 — Definitely HCC. All major diagnostic criteria met.", severity: "critical", nextStep: "Urgent hepatology referral. Staging and treatment planning required.", reference: "ACR LI-RADS v2018" };
  return { interpretation: "LR-3 — Intermediate probability. Insufficient features for definitive classification.", severity: "moderate", nextStep: "Repeat imaging in 3–6 months.", reference: "ACR LI-RADS v2018" };
}

// ── TI-RADS (ACR 2017) ─────────────────────────────────────────────────────────
function runTIRADS(v: Record<string, string>): InterpretationResult {
  let pts = 0;
  if (v.composition === "mixed") pts += 1;
  else if (v.composition === "solid") pts += 2;
  if (v.echogenicity === "hyperechoic" || v.echogenicity === "isoechoic") pts += 1;
  else if (v.echogenicity === "hypoechoic") pts += 2;
  else if (v.echogenicity === "very_hypoechoic") pts += 3;
  if (v.shape === "taller_than_wide") pts += 3;
  if (v.margin === "lobulated" || v.margin === "irregular") pts += 2;
  else if (v.margin === "extrathyroidal") pts += 3;
  if (v.foci === "macrocalcification") pts += 1;
  else if (v.foci === "peripheral_calcification") pts += 2;
  else if (v.foci === "punctate") pts += 3;

  const size = parseFloat(v.size || "0");
  let category = "", severity: Severity = "normal", interpretation = "", nextStep = "";

  if (pts === 0) {
    category = "TR1"; severity = "normal";
    interpretation = "TR1 (0 pts) — Benign. No malignant features.";
    nextStep = "No FNA. No follow-up required.";
  } else if (pts === 2) {
    category = "TR2"; severity = "normal";
    interpretation = "TR2 (2 pts) — Not suspicious.";
    nextStep = "No FNA. No follow-up required.";
  } else if (pts === 3) {
    category = "TR3"; severity = "mild";
    interpretation = "TR3 (3 pts) — Mildly suspicious.";
    nextStep = size >= 25 ? "FNA recommended (≥ 2.5 cm)." : "Follow-up ultrasound in 1, 3, and 5 years.";
  } else if (pts >= 4 && pts <= 6) {
    category = "TR4"; severity = "moderate";
    interpretation = `TR4 (${pts} pts) — Moderately suspicious.`;
    nextStep = size >= 15 ? "FNA recommended (≥ 1.5 cm)." : "Follow-up ultrasound in 1, 2, and 3 years.";
  } else {
    category = "TR5"; severity = "severe";
    interpretation = `TR5 (${pts} pts) — Highly suspicious.`;
    nextStep = size >= 10 ? "FNA recommended (≥ 1.0 cm)." : "Follow-up ultrasound in 1, 2, and 3 years.";
  }

  return { interpretation, severity, nextStep, reference: "ACR TI-RADS 2017", detail: `Score: ${pts} pts → ${category}` };
}

// ── Gallbladder Wall ───────────────────────────────────────────────────────────
function runGallbladder(v: Record<string, string>): InterpretationResult {
  const wall = parseFloat(v.wall || "0");
  const fasting = v.fasting === "yes";
  const focal = v.focal === "yes";
  const fever = v.fever === "yes";
  const murphy = v.murphy === "yes";

  if (!fasting)
    return { interpretation: "Non-fasting state — wall thickening may be physiologic. Repeat fasting.", severity: "indeterminate", nextStep: "Repeat ultrasound after 4–6 hours fasting.", reference: "AIUM GB Guidelines" };
  if (wall <= 3)
    return { interpretation: `Normal gallbladder wall (${wall} mm). No thickening detected.`, severity: "normal", nextStep: "No further action required.", reference: "AIUM GB Guidelines" };
  if (wall <= 5 && !focal && !fever && !murphy)
    return { interpretation: `Borderline wall thickening (${wall} mm). May reflect systemic cause (hepatitis, heart failure, hypoalbuminaemia).`, severity: "mild", nextStep: "Correlate with LFTs, albumin, and clinical history.", reference: "AIUM GB Guidelines" };
  if (focal || (fever && murphy))
    return { interpretation: `Abnormal focal/asymmetric wall thickening (${wall} mm) with clinical features. Acute cholecystitis suspected.`, severity: "severe", nextStep: "Surgical or gastroenterology referral. Consider HIDA scan if diagnosis uncertain.", reference: "AIUM GB Guidelines" };
  return { interpretation: `Diffuse wall thickening (${wall} mm). Systemic or inflammatory cause likely.`, severity: "moderate", nextStep: "Correlate with clinical context. Consider hepatitis, portal hypertension, or malignancy.", reference: "AIUM GB Guidelines" };
}

// ── Spleen Size ────────────────────────────────────────────────────────────────
function runSpleen(v: Record<string, string>): InterpretationResult {
  const len = parseFloat(v.length || "0");
  if (len <= 11) return { interpretation: `Normal spleen length (${len} cm).`, severity: "normal", nextStep: "No further action required.", reference: "AIUM/Rosenberg normative data" };
  if (len <= 13) return { interpretation: `Mild splenomegaly (${len} cm, 11–13 cm range).`, severity: "mild", nextStep: "Correlate with CBC, LFTs, and clinical history. Assess for portal hypertension or haematological cause.", reference: "AIUM/Rosenberg normative data" };
  if (len <= 16) return { interpretation: `Moderate splenomegaly (${len} cm, 13–16 cm range).`, severity: "moderate", nextStep: "Haematology or hepatology referral. Assess for lymphoma, myeloproliferative disease, or portal hypertension.", reference: "AIUM/Rosenberg normative data" };
  return { interpretation: `Massive splenomegaly (${len} cm, > 16 cm). Significant pathology likely.`, severity: "severe", nextStep: "Urgent haematology referral. Assess for myelofibrosis, CML, lymphoma, or storage disease.", reference: "AIUM/Rosenberg normative data" };
}

// ── Renal Cortex ───────────────────────────────────────────────────────────────
function runRenalCortex(v: Record<string, string>): InterpretationResult {
  const thickness = parseFloat(v.thickness || "0");
  const echo = v.echogenicity;
  const cmd = v.cmd;
  let sev: Severity = "normal";
  let interp = "";
  let next = "";

  if (thickness < 7) {
    sev = "severe";
    interp = `Markedly reduced cortical thickness (${thickness} mm, < 7 mm). Severe cortical loss.`;
    next = "Nephrology referral. Assess for chronic kidney disease, obstruction, or end-stage renal disease.";
  } else if (thickness < 10) {
    sev = "moderate";
    interp = `Reduced cortical thickness (${thickness} mm, 7–9 mm). Cortical thinning present.`;
    next = "Correlate with eGFR and urinalysis. Nephrology referral if CKD suspected.";
  } else {
    sev = "normal";
    interp = `Normal cortical thickness (${thickness} mm).`;
    next = "No action required based on cortical thickness alone.";
  }

  if (echo === "increased" && cmd === "poor") {
    sev = sev === "normal" ? "moderate" : sev;
    interp += " Increased cortical echogenicity with poor corticomedullary differentiation — consistent with medical renal disease.";
    next = "Correlate with creatinine, eGFR, urinalysis, and protein:creatinine ratio. Nephrology referral recommended.";
  } else if (echo === "increased") {
    interp += " Increased cortical echogenicity — may reflect early medical renal disease.";
    next += " Correlate with renal function tests.";
  }

  return { interpretation: interp, severity: sev, nextStep: next, reference: "AIUM Renal Ultrasound Guidelines" };
}

// ── BI-RADS (ACR 5th Ed) ───────────────────────────────────────────────────────
function runBIRADS(v: Record<string, string>): InterpretationResult {
  let pts = 0;
  if (v.shape === "irregular") pts += 2;
  if (v.orientation === "not_parallel") pts += 2;
  if (v.margin === "not_circumscribed") pts += 2;
  if (v.echo === "complex" || v.echo === "hypoechoic" || v.echo === "heterogeneous") pts += 1;
  if (v.posterior === "shadowing" || v.posterior === "combined") pts += 1;
  if (v.calcification === "yes") pts += 1;
  if (v.vascularity === "internal") pts += 1;

  const size = parseFloat(v.size || "0");
  let cat = "", sev: Severity = "normal", interp = "", next = "";

  if (pts === 0)        { cat = "BI-RADS 2"; sev = "normal";   interp = "BI-RADS 2 — Benign finding. No malignant features.";                                              next = "Routine annual mammography screening."; }
  else if (pts <= 2)   { cat = "BI-RADS 3"; sev = "mild";     interp = "BI-RADS 3 — Probably benign (< 2% malignancy risk).";                                             next = "Short-interval follow-up ultrasound in 6 months."; }
  else if (pts <= 4)   { cat = "BI-RADS 4A"; sev = "moderate"; interp = "BI-RADS 4A — Low suspicion for malignancy (2–10% risk).";                                        next = "Tissue sampling (core needle biopsy) recommended."; }
  else if (pts <= 6)   { cat = "BI-RADS 4B"; sev = "moderate"; interp = "BI-RADS 4B — Intermediate suspicion for malignancy (10–50% risk).";                              next = "Core needle biopsy recommended. Surgical referral if biopsy confirms malignancy."; }
  else if (pts <= 8)   { cat = "BI-RADS 4C"; sev = "severe";   interp = "BI-RADS 4C — Moderate concern for malignancy (50–95% risk).";                                    next = "Core needle biopsy. Breast surgery referral."; }
  else                 { cat = "BI-RADS 5";  sev = "critical"; interp = "BI-RADS 5 — Highly suggestive of malignancy (> 95% risk).";                                      next = "Urgent breast surgery referral. Biopsy and staging workup required."; }

  void size;
  return { interpretation: interp, severity: sev, nextStep: next, reference: "ACR BI-RADS 5th Edition", detail: `Score: ${pts} pts → ${cat}` };
}

// ── Endometrial Thickness ──────────────────────────────────────────────────────
function runEndometrial(v: Record<string, string>): InterpretationResult {
  const et = parseFloat(v.et || "0");
  const meno = v.menopausal;
  const bleeding = v.bleeding === "yes";
  const hrt = v.hrt === "yes";

  if (meno === "premenopausal") {
    if (et <= 16) return { interpretation: `Endometrial thickness ${et} mm — within normal premenopausal range (varies with cycle phase).`, severity: "normal", nextStep: "Correlate with menstrual cycle phase. Repeat if clinically indicated.", reference: "ACOG/SRU 2010" };
    return { interpretation: `Endometrial thickness ${et} mm — thickened for premenopausal patient. Assess cycle phase.`, severity: "moderate", nextStep: "Correlate with cycle phase. Consider sonohysterography or hysteroscopy if persistent.", reference: "ACOG/SRU 2010" };
  }
  const threshold = hrt ? 8 : 5;
  if (et <= threshold)
    return { interpretation: `Endometrial thickness ${et} mm — within normal postmenopausal range${hrt ? " (on HRT)" : ""}.`, severity: "normal", nextStep: "No further evaluation required for endometrial thickness alone.", reference: "ACOG/SRU 2010" };
  if (bleeding)
    return { interpretation: `Endometrial thickness ${et} mm in postmenopausal patient with bleeding — above threshold (${threshold} mm). Endometrial pathology must be excluded.`, severity: "severe", nextStep: "Endometrial sampling (pipelle biopsy or D&C) required. Gynaecology referral.", reference: "ACOG/SRU 2010" };
  return { interpretation: `Endometrial thickness ${et} mm in postmenopausal patient (no bleeding) — above threshold. Incidental thickening.`, severity: "moderate", nextStep: "Gynaecology referral. Endometrial sampling or sonohysterography recommended.", reference: "ACOG/SRU 2010" };
}

// ── O-RADS (ACR v2022) ─────────────────────────────────────────────────────────
function runORADS(v: Record<string, string>): InterpretationResult {
  const size = parseFloat(v.size || "0");
  const morphology = v.morphology;
  const solid = v.solid === "yes";
  const papillary = v.papillary === "yes";
  const color = v.colorScore;
  const age = v.age;

  if (morphology === "simple_cyst" && size <= 10 && age === "premenopausal")
    return { interpretation: "O-RADS 1 — Normal ovary or physiologic finding.", severity: "normal", nextStep: "No follow-up required.", reference: "ACR O-RADS v2022" };
  if (morphology === "simple_cyst" && size <= 3 && age === "postmenopausal")
    return { interpretation: "O-RADS 2 — Almost certainly benign (< 1% malignancy risk).", severity: "normal", nextStep: "No follow-up required.", reference: "ACR O-RADS v2022" };
  if (morphology === "simple_cyst" && size <= 10 && age === "postmenopausal")
    return { interpretation: "O-RADS 2 — Almost certainly benign simple cyst.", severity: "normal", nextStep: "Annual follow-up ultrasound for 2 years.", reference: "ACR O-RADS v2022" };
  if (!solid && !papillary && size <= 10)
    return { interpretation: "O-RADS 2 — Almost certainly benign (< 1% malignancy risk).", severity: "normal", nextStep: "Follow-up ultrasound in 6–12 weeks if symptomatic, otherwise annual.", reference: "ACR O-RADS v2022" };
  if (!solid && size <= 10)
    return { interpretation: "O-RADS 3 — Low risk of malignancy (1–< 10%).", severity: "mild", nextStep: "Gynaecology referral. Follow-up ultrasound in 6–12 weeks.", reference: "ACR O-RADS v2022" };
  if (solid && !papillary && (color === "1" || color === "2"))
    return { interpretation: "O-RADS 3 — Low risk of malignancy (1–< 10%). Solid component with low vascularity.", severity: "mild", nextStep: "Gynaecology referral. Consider MRI for further characterisation.", reference: "ACR O-RADS v2022" };
  if (papillary || (solid && color === "3"))
    return { interpretation: "O-RADS 4 — Intermediate risk of malignancy (10–< 50%).", severity: "moderate", nextStep: "Gynaecology oncology referral. MRI recommended. Surgical planning.", reference: "ACR O-RADS v2022" };
  return { interpretation: "O-RADS 5 — High risk of malignancy (≥ 50%). Highly suspicious morphology.", severity: "severe", nextStep: "Urgent gynaecology oncology referral. Staging workup and surgical planning required.", reference: "ACR O-RADS v2022" };
}

// ── Cervical Length ────────────────────────────────────────────────────────────
function runCervicalLength(v: Record<string, string>): InterpretationResult {
  const cl = parseFloat(v.cl || "0");
  const ga = parseFloat(v.ga || "0");
  const history = v.history === "yes";
  const cerclage = v.cerclage === "yes";

  if (cerclage)
    return { interpretation: `Cervical length ${cl} mm — cerclage in situ. Measurement may be affected.`, severity: "info", nextStep: "Obstetric review. Continue surveillance per cerclage protocol.", reference: "SMFM/ACOG" };
  if (cl > 25)
    return { interpretation: `Cervical length ${cl} mm at ${ga} weeks — adequate length. Low risk of spontaneous preterm birth.`, severity: "normal", nextStep: "Routine obstetric care. Repeat cervical length at next scan if indicated.", reference: "SMFM/ACOG" };
  if (cl >= 20 && cl <= 25)
    return { interpretation: `Cervical length ${cl} mm at ${ga} weeks — borderline short.`, severity: "mild", nextStep: history ? "Progesterone therapy recommended. Obstetric review." : "Repeat cervical length in 2 weeks. Consider progesterone if < 20 mm confirmed.", reference: "SMFM/ACOG" };
  if (cl >= 10 && cl < 20)
    return { interpretation: `Short cervix — ${cl} mm at ${ga} weeks. Elevated risk of preterm birth.`, severity: "moderate", nextStep: "Vaginal progesterone 200 mg nightly. Maternal-fetal medicine referral. Consider cerclage if prior preterm birth.", reference: "SMFM/ACOG" };
  return { interpretation: `Very short cervix — ${cl} mm at ${ga} weeks. High risk of imminent preterm labor.`, severity: "critical", nextStep: "Urgent MFM referral. Hospital admission may be required. Corticosteroids and tocolysis per obstetric protocol.", reference: "SMFM/ACOG" };
}

// ── Fetal Growth ───────────────────────────────────────────────────────────────
function runFetalGrowth(v: Record<string, string>): InterpretationResult {
  const efw = parseFloat(v.efw || "0");
  const ga = parseFloat(v.ga || "0");
  const meanEFW = Math.exp(0.578 + 0.332 * ga - 0.00354 * ga * ga) * 1000;
  const sd = meanEFW * 0.12;
  const z = (efw - meanEFW) / sd;
  const pct = Math.min(99, Math.max(1, Math.round(50 + 50 * Math.tanh(z * 0.8))));

  let sev: Severity, interp: string, next: string;
  if (pct < 3)       { sev = "critical"; interp = `EFW ${efw} g — < 3rd centile at ${ga} weeks. Severe FGR.`;                            next = "Urgent MFM referral. Umbilical artery Doppler, biophysical profile, and delivery planning required."; }
  else if (pct < 10) { sev = "severe";   interp = `EFW ${efw} g — ${pct}th centile at ${ga} weeks. SGA / FGR.`;                          next = "MFM referral. Umbilical artery Doppler assessment. Increase surveillance frequency."; }
  else if (pct < 90) { sev = "normal";   interp = `EFW ${efw} g — ${pct}th centile at ${ga} weeks. Appropriate for gestational age.`;    next = "Routine obstetric care."; }
  else if (pct < 97) { sev = "mild";     interp = `EFW ${efw} g — ${pct}th centile at ${ga} weeks. LGA.`;                                next = "Screen for gestational diabetes. Monitor growth trend. Obstetric review."; }
  else               { sev = "moderate"; interp = `EFW ${efw} g — > 97th centile at ${ga} weeks. Macrosomia.`;                           next = "Gestational diabetes screening. Obstetric review for delivery planning."; }

  return { interpretation: interp, severity: sev, nextStep: next, reference: "Hadlock 1991 / INTERGROWTH-21st", detail: `Estimated centile: ~${pct}th` };
}

// ── AFI / SDP ──────────────────────────────────────────────────────────────────
function runAFI(v: Record<string, string>): InterpretationResult {
  const method = v.method;
  const val = parseFloat(v.value || "0");
  const ga = parseFloat(v.ga || "0");

  if (method === "afi") {
    if (val < 5)       return { interpretation: `AFI ${val} cm at ${ga} weeks — Oligohydramnios (< 5 cm).`,                    severity: "severe",   nextStep: "Obstetric review. Assess for PPROM, uteroplacental insufficiency, renal anomaly. Consider delivery.",                                    reference: "ACOG/SMFM" };
    if (val < 8)       return { interpretation: `AFI ${val} cm at ${ga} weeks — Low normal / borderline oligohydramnios.`,     severity: "mild",     nextStep: "Repeat AFI in 48–72 hours. Assess fetal wellbeing.",                                                                                       reference: "ACOG/SMFM" };
    if (val <= 24)     return { interpretation: `AFI ${val} cm at ${ga} weeks — Normal amniotic fluid volume.`,                severity: "normal",   nextStep: "Routine obstetric care.",                                                                                                                  reference: "ACOG/SMFM" };
    return               { interpretation: `AFI ${val} cm at ${ga} weeks — Polyhydramnios (> 24 cm).`,                        severity: "moderate", nextStep: "Screen for gestational diabetes, fetal anomaly, and twin-twin transfusion. Obstetric review.",                                             reference: "ACOG/SMFM" };
  }
  if (val < 2)         return { interpretation: `SDP ${val} cm at ${ga} weeks — Oligohydramnios (< 2 cm).`,                   severity: "severe",   nextStep: "Obstetric review. Assess for PPROM, uteroplacental insufficiency. Consider delivery.",                                                    reference: "ACOG/SMFM" };
  if (val <= 8)        return { interpretation: `SDP ${val} cm at ${ga} weeks — Normal amniotic fluid volume.`,               severity: "normal",   nextStep: "Routine obstetric care.",                                                                                                                  reference: "ACOG/SMFM" };
  return                 { interpretation: `SDP ${val} cm at ${ga} weeks — Polyhydramnios (> 8 cm).`,                         severity: "moderate", nextStep: "Screen for gestational diabetes, fetal anomaly, and TTTS. Obstetric review.",                                                             reference: "ACOG/SMFM" };
}

// ── Ductus Venosus ─────────────────────────────────────────────────────────────
function runDuctusVenosus(v: Record<string, string>): InterpretationResult {
  const aWave = v.aWave;
  const pi = parseFloat(v.pi || "0");
  const ga = parseFloat(v.ga || "0");

  if (aWave === "reversed") return { interpretation: `Reversed a-wave in ductus venosus at ${ga} weeks. Advanced FGR / cardiac decompensation.`, severity: "critical", nextStep: "Urgent MFM referral. Delivery planning required. Corticosteroids if < 34 weeks.", reference: "ISUOG Doppler Guidelines" };
  if (aWave === "absent")   return { interpretation: `Absent a-wave in ductus venosus at ${ga} weeks. Significant FGR with cardiac compromise.`,  severity: "severe",   nextStep: "MFM referral. Intensive fetal surveillance. Delivery planning.",                                                         reference: "ISUOG Doppler Guidelines" };
  if (pi > 1.0)             return { interpretation: `Elevated DV PI (${pi}) at ${ga} weeks. Increased venous pressure — early cardiac compromise.`, severity: "moderate", nextStep: "Increase fetal surveillance frequency. MFM referral.",                                                              reference: "ISUOG Doppler Guidelines" };
  return { interpretation: `Normal ductus venosus waveform at ${ga} weeks (a-wave present, PI ${pi}).`, severity: "normal", nextStep: "Routine obstetric care.", reference: "ISUOG Doppler Guidelines" };
}

// ── Carotid Stenosis (SRU/SVU 2003) ───────────────────────────────────────────
function runCarotid(v: Record<string, string>): InterpretationResult {
  const psv = parseFloat(v.psv || "0");
  const edv = parseFloat(v.edv || "0");
  const ratio = parseFloat(v.ratio || "0");
  const plaque = v.plaque;

  if (psv === 0 && edv === 0)
    return { interpretation: "Insufficient data entered.", severity: "indeterminate", nextStep: "Enter ICA PSV and EDV values." };

  let sev: Severity, interp: string, next: string;
  if (psv < 125 && ratio < 2.0) {
    if (plaque === "none") { sev = "normal";   interp = "Normal ICA. No significant stenosis. No plaque identified.";                                                                                                                                                         next = "Routine follow-up per cardiovascular risk profile."; }
    else                   { sev = "mild";     interp = `< 50% ICA stenosis. Plaque present (${plaque}). PSV ${psv} cm/s.`;                                                                                                                                                   next = "optimize cardiovascular risk factors. Repeat duplex in 12 months."; }
  } else if (psv < 230 && edv < 100 && ratio < 4.0) {
                             sev = "moderate"; interp = `50–69% ICA stenosis. PSV ${psv} cm/s, EDV ${edv} cm/s, ICA/CCA ratio ${ratio}.`;                                                                                                                                    next = "Vascular surgery referral. CT/MR angiography for surgical planning. Antiplatelet therapy.";
  } else if (psv >= 230 || edv >= 100 || ratio >= 4.0) {
                             sev = "severe";   interp = `≥ 70% ICA stenosis. PSV ${psv} cm/s, EDV ${edv} cm/s, ICA/CCA ratio ${ratio}. High-grade stenosis.`;                                                                                                               next = "Urgent vascular surgery referral. CEA or CAS evaluation. CT/MR angiography required.";
  } else {
                             sev = "indeterminate"; interp = "Borderline values — unable to classify definitively.";                                                                                                                                                           next = "Repeat duplex or proceed to CT/MR angiography.";
  }

  return { interpretation: interp, severity: sev, nextStep: next, reference: "SRU Carotid Consensus / SVU Guidelines" };
}

// ── Renal Doppler Decision Tool (SVU Guidelines) ───────────────────────────────
function runRenalDoppler(v: Record<string, string>): InterpretationResult {
  const ri = parseFloat(v.ri || "0");
  const at = parseFloat(v.at || "0");
  const rar = parseFloat(v.rar || "0");
  const parvus = v.parvus === "yes";
  const side = v.side || "bilateral";
  const obstruction = v.obstruction === "yes";

  const parvusTardus = parvus || at > 70;

  if (rar > 3.5 || parvusTardus) {
    const parts = [
      rar > 3.5 ? `RAR ${rar} (> 3.5)` : "",
      at > 70 ? `AT ${at} ms (> 70 ms)` : "",
      parvusTardus ? "Parvus et tardus waveform detected" : "",
    ].filter(Boolean).join("; ");
    return {
      interpretation: `Renal Artery Stenosis suspected (${side} side). ${parts}. Tardus-parvus waveform indicates significant proximal stenosis.`,
      severity: "severe",
      nextStep: "CT or MR angiography for confirmation. Vascular surgery or interventional radiology referral. Assess for renovascular hypertension and ischaemic nephropathy.",
      reference: "SVU / SRU Renal Doppler Guidelines",
      detail: `RI: ${ri} | AT: ${at > 0 ? at + " ms" : "—"} | RAR: ${rar > 0 ? rar : "—"}`,
    };
  }

  if (obstruction && ri > 0.70)
    return { interpretation: `Elevated RI (${ri}) with clinical obstruction. RI > 0.70 in obstruction suggests significant outflow resistance.`, severity: "severe", nextStep: "Urology referral. Assess for hydronephrosis, ureteric calculus, or extrinsic compression. Decompression may be required.", reference: "SVU / SRU Renal Doppler Guidelines", detail: `RI: ${ri} — elevated in obstructed kidney` };

  if (ri > 0.80)
    return { interpretation: `Markedly elevated RI (${ri} > 0.80). Severe intrinsic renal disease or acute tubular necrosis. Bilateral elevation suggests systemic cause.`, severity: "severe", nextStep: "Nephrology referral. Correlate with creatinine, eGFR, urinalysis. Renal biopsy may be indicated.", reference: "SVU / SRU Renal Doppler Guidelines", detail: `RI: ${ri}` };

  if (ri > 0.70)
    return { interpretation: `Mildly to moderately elevated RI (${ri}, 0.70–0.80). Increased intrarenal resistance. Consistent with medical renal disease, early CKD, or renal vein thrombosis.`, severity: "moderate", nextStep: "Correlate with renal function (creatinine, eGFR). Nephrology referral if CKD suspected. Exclude renal vein thrombosis if acute presentation.", reference: "SVU / SRU Renal Doppler Guidelines", detail: `RI: ${ri}` };

  if (ri >= 0.60)
    return { interpretation: `Normal RI (${ri}, 0.60–0.70). Normal intrarenal resistance. No Doppler evidence of significant renal disease.`, severity: "normal", nextStep: "Correlate with clinical context. No Doppler-based intervention required.", reference: "SVU / SRU Renal Doppler Guidelines", detail: `RI: ${ri}` };

  return { interpretation: `Low RI (${ri} < 0.60). Reduced intrarenal resistance. May be seen in arteriovenous fistula, high-output states, or normal variant in young patients.`, severity: "info", nextStep: "Correlate with clinical context. Assess for AV fistula if post-biopsy or transplant.", reference: "SVU / SRU Renal Doppler Guidelines", detail: `RI: ${ri}` };
}

// ── DVT (Wells + Duplex) ───────────────────────────────────────────────────────
function runDVT(v: Record<string, string>): InterpretationResult {
  const wells = parseFloat(v.wells || "0");
  const compress = v.compress;
  const flow = v.flow;
  const echo = v.echo;

  if (compress === "non_compressible") {
    const acuity = echo === "anechoic" ? "Acute DVT (anechoic thrombus)." : echo === "echogenic" ? "Subacute/chronic DVT (echogenic thrombus)." : "DVT — acuity indeterminate.";
    return { interpretation: `Non-compressible vein — DVT confirmed. ${acuity} Wells score: ${wells}.`, severity: "severe", nextStep: "Anticoagulation initiation. Haematology or vascular medicine referral. Assess for PE.", reference: "ACCP / Wells Criteria" };
  }
  if (compress === "compressible" && flow === "normal") {
    if (wells < 2) return { interpretation: `Compressible vein with normal flow. DVT excluded. Wells score ${wells} — low pre-test probability.`, severity: "normal", nextStep: "No anticoagulation required. Consider alternative diagnosis.", reference: "ACCP / Wells Criteria" };
    return { interpretation: `Compressible vein with normal flow. DVT not identified. Wells score ${wells} — moderate/high pre-test probability.`, severity: "mild", nextStep: "D-dimer if not already done. Repeat duplex in 5–7 days if D-dimer elevated.", reference: "ACCP / Wells Criteria" };
  }
  return { interpretation: "Indeterminate duplex findings. Insufficient data for definitive DVT assessment.", severity: "indeterminate", nextStep: "Repeat duplex or proceed to CT venography.", reference: "ACCP / Wells Criteria" };
}

// ── AAA Surveillance ───────────────────────────────────────────────────────────
function runAAA(v: Record<string, string>): InterpretationResult {
  const diam = parseFloat(v.diameter || "0");
  const sex = v.sex;
  const growth = parseFloat(v.growth || "0");
  const threshold = sex === "female" ? 5.0 : 5.5;

  if (diam < 3.0) return { interpretation: `Aortic diameter ${diam} cm — Normal. No aneurysm.`, severity: "normal", nextStep: "No surveillance required.", reference: "SVS/ESVS AAA Guidelines" };
  if (diam < 4.0) return { interpretation: `Small AAA — ${diam} cm. Low rupture risk.`, severity: "mild", nextStep: "Surveillance ultrasound every 2–3 years. Cardiovascular risk factor optimisation.", reference: "SVS/ESVS AAA Guidelines" };
  if (diam < threshold) {
    const interval = diam < 4.5 ? "annually" : "every 6 months";
    return { interpretation: `Moderate AAA — ${diam} cm. Below surgical threshold (${threshold} cm for ${sex}).`, severity: "moderate", nextStep: `Surveillance ultrasound ${interval}. Vascular surgery referral. Smoking cessation and statin therapy.`, reference: "SVS/ESVS AAA Guidelines" };
  }
  if (growth >= 1.0)
    return { interpretation: `Rapid AAA growth — ${growth} cm/year. Surgical threshold met regardless of size.`, severity: "critical", nextStep: "Urgent vascular surgery referral. EVAR or open repair evaluation.", reference: "SVS/ESVS AAA Guidelines" };
  return { interpretation: `Large AAA — ${diam} cm. At or above surgical threshold (${threshold} cm for ${sex}).`, severity: "severe", nextStep: "Vascular surgery referral. CT angiography for repair planning. EVAR or open repair evaluation.", reference: "SVS/ESVS AAA Guidelines" };
}

// ── Portal Hypertension ────────────────────────────────────────────────────────
function runPortalHTN(v: Record<string, string>): InterpretationResult {
  const pvDiam = parseFloat(v.pvDiam || "0");
  const pvVel = parseFloat(v.pvVel || "0");
  const flow = v.flow;
  const spleen = parseFloat(v.spleen || "0");
  const ascites = v.ascites === "yes";

  let score = 0;
  if (pvDiam > 13) score++;
  if (pvVel < 15) score++;
  if (flow === "hepatofugal") score += 2;
  if (spleen > 13) score++;
  if (ascites) score++;

  if (score === 0) return { interpretation: "No Doppler features of portal hypertension.", severity: "normal", nextStep: "Routine hepatic surveillance.", reference: "AIUM/ACR Portal Hypertension Guidelines" };
  if (score <= 2)  return { interpretation: `Mild portal hypertension features. PV diameter ${pvDiam} mm, velocity ${pvVel} cm/s.`, severity: "mild", nextStep: "Hepatology referral. Correlate with LFTs and clinical history.", reference: "AIUM/ACR Portal Hypertension Guidelines" };
  if (score <= 4)  return { interpretation: `Moderate portal hypertension. PV ${pvDiam} mm, ${flow} flow, velocity ${pvVel} cm/s${spleen > 13 ? ", splenomegaly" : ""}${ascites ? ", ascites" : ""}.`, severity: "moderate", nextStep: "Hepatology referral. Upper GI endoscopy for varices screening. Consider TIPS evaluation.", reference: "AIUM/ACR Portal Hypertension Guidelines" };
  return { interpretation: `Severe portal hypertension. Hepatofugal flow${ascites ? " with ascites" : ""}${spleen > 13 ? " and splenomegaly" : ""}. Advanced portal hypertension.`, severity: "severe", nextStep: "Urgent hepatology referral. Varices screening and prophylaxis. Liver transplant evaluation if appropriate.", reference: "AIUM/ACR Portal Hypertension Guidelines" };
}

// ── Rotator Cuff ───────────────────────────────────────────────────────────────
function runRotatorCuff(v: Record<string, string>): InterpretationResult {
  const continuity = v.continuity;
  const width = parseFloat(v.width || "0");
  const retraction = parseFloat(v.retraction || "0");
  const fatty = v.fatty;

  if (continuity === "intact") return { interpretation: "Intact rotator cuff. No tear identified.", severity: "normal", nextStep: "Physiotherapy for symptom management.", reference: "ESSR/ACR MSK Guidelines" };
  if (continuity === "partial") {
    const sev: Severity = width < 5 ? "mild" : "moderate";
    return { interpretation: `Partial-thickness rotator cuff tear. Width ${width} mm.`, severity: sev, nextStep: "orthopedic referral. Physiotherapy. Consider corticosteroid injection for pain management.", reference: "ESSR/ACR MSK Guidelines" };
  }
  let sev: Severity = "moderate";
  let next = "orthopedic referral for surgical assessment.";
  if (width > 30 || retraction > 30 || fatty === "severe") { sev = "severe"; next = "Urgent orthopedic referral. Large/massive tear with fatty infiltration — surgical repair may be limited."; }
  return { interpretation: `Full-thickness rotator cuff tear. Width ${width} mm, retraction ${retraction} mm${fatty !== "none" ? `, fatty infiltration: ${fatty}` : ""}.`, severity: sev, nextStep: next, reference: "ESSR/ACR MSK Guidelines" };
}

// ── B-Line Congestion ──────────────────────────────────────────────────────────
function runBLines(v: Record<string, string>): InterpretationResult {
  const zones = parseInt(v.zones || "0");
  const bilateral = v.bilateral === "yes";
  const aLines = v.aLines === "yes";

  if (aLines && zones === 0) return { interpretation: "A-lines present bilaterally. No B-lines. Normal lung aeration.", severity: "normal", nextStep: "No pulmonary congestion on POCUS.", reference: "BLUE Protocol / EACVI/ASE Guidelines" };
  if (zones < 2)             return { interpretation: `Focal B-lines in ${zones} zone(s). Localised finding — may represent focal consolidation or contusion.`, severity: "mild", nextStep: "Correlate with clinical context. Consider chest X-ray.", reference: "BLUE Protocol / EACVI/ASE Guidelines" };
  if (zones >= 2 && bilateral) return { interpretation: `Bilateral B-lines in ${zones} zones. Pulmonary congestion pattern. Consistent with cardiogenic pulmonary edema or ARDS.`, severity: "severe", nextStep: "Correlate with BNP/NT-proBNP, clinical status, and echo. Diuresis if cardiogenic. Urgent medical review.", reference: "BLUE Protocol / EACVI/ASE Guidelines" };
  return { interpretation: `B-lines in ${zones} zones (unilateral or limited). Possible early congestion or focal pathology.`, severity: "moderate", nextStep: "Correlate with clinical context. Repeat assessment after diuresis or position change.", reference: "BLUE Protocol / EACVI/ASE Guidelines" };
}

// ── IVC Collapsibility ─────────────────────────────────────────────────────────
function runIVC(v: Record<string, string>): InterpretationResult {
  const max = parseFloat(v.max || "0");
  const min = parseFloat(v.min || "0");
  const ventilated = v.ventilated === "yes";

  if (max === 0) return { interpretation: "Insufficient data.", severity: "indeterminate", nextStep: "Enter IVC max and min diameters." };
  const ci = Math.round(((max - min) / max) * 100);

  if (ventilated) {
    const di = Math.round(((max - min) / min) * 100);
    if (di > 18) return { interpretation: `IVC distensibility index ${di}% (> 18%) in ventilated patient. Volume responsiveness likely.`, severity: "info", nextStep: "Consider fluid challenge. Reassess after 250 mL bolus.", reference: "ACEP/ASE IVC Guidelines" };
    return { interpretation: `IVC distensibility index ${di}% (≤ 18%) in ventilated patient. Volume unresponsive.`, severity: "info", nextStep: "Fluid challenge unlikely to improve cardiac output. Assess for other causes of haemodynamic instability.", reference: "ACEP/ASE IVC Guidelines" };
  }

  if (ci >= 50) return { interpretation: `IVC CI ${ci}% (≥ 50%) — spontaneously breathing. High collapsibility. Volume responsiveness likely. Low RAP (< 5 mmHg).`, severity: "info", nextStep: "Consider fluid challenge if haemodynamically unstable. Correlate with clinical context.", reference: "ACEP/ASE IVC Guidelines" };
  if (ci >= 35) return { interpretation: `IVC CI ${ci}% (35–49%) — intermediate collapsibility. Indeterminate volume status.`, severity: "mild", nextStep: "Correlate with clinical context, symptoms, and other haemodynamic parameters.", reference: "ACEP/ASE IVC Guidelines" };
  return { interpretation: `IVC CI ${ci}% (< 35%) — low collapsibility. Elevated RAP (> 10 mmHg). Volume unresponsive or fluid overloaded.`, severity: "moderate", nextStep: "Assess for fluid overload, right heart failure, or tamponade. Diuresis if appropriate.", reference: "ACEP/ASE IVC Guidelines" };
}

// ── ONSD ──────────────────────────────────────────────────────────────────────
function runONSD(v: Record<string, string>): InterpretationResult {
  const right = parseFloat(v.right || "0");
  const left = parseFloat(v.left || "0");
  const avg = (right + left) / 2;

  if (avg === 0) return { interpretation: "Insufficient data.", severity: "indeterminate", nextStep: "Enter bilateral ONSD measurements." };
  if (avg > 5.0) return { interpretation: `Bilateral ONSD elevated (R: ${right} mm, L: ${left} mm, avg: ${avg.toFixed(1)} mm > 5.0 mm). Elevated intracranial pressure suspected.`, severity: "critical", nextStep: "Urgent neurology review. CT head to exclude mass, haemorrhage, or hydrocephalus. Neurosurgical referral if indicated.", reference: "ACEP/ENLS ONSD Guidelines" };
  if (avg > 4.5) return { interpretation: `ONSD borderline elevated (avg: ${avg.toFixed(1)} mm, threshold 5.0 mm). ICP elevation possible.`, severity: "moderate", nextStep: "Correlate with clinical neurological assessment. Repeat measurement. Consider CT head.", reference: "ACEP/ENLS ONSD Guidelines" };
  return { interpretation: `Normal ONSD (R: ${right} mm, L: ${left} mm, avg: ${avg.toFixed(1)} mm ≤ 5.0 mm). ICP elevation not suggested by POCUS.`, severity: "normal", nextStep: "No POCUS evidence of elevated ICP. Correlate with clinical findings.", reference: "ACEP/ENLS ONSD Guidelines" };
}

// ── FAST Exam ─────────────────────────────────────────────────────────────────
function runFAST(v: Record<string, string>): InterpretationResult {
  const ruq = v.ruq === "yes";
  const luq = v.luq === "yes";
  const pelvis = v.pelvis === "yes";
  const peri = v.peri === "yes";
  const count = [ruq, luq, pelvis, peri].filter(Boolean).length;

  if (count === 0) return { interpretation: "Negative FAST exam. No free fluid identified in any window.", severity: "normal", nextStep: "Serial FAST if clinical concern persists. Correlate with mechanism of injury.", reference: "ATLS / ACEP FAST Guidelines" };
  if (peri && !ruq && !luq && !pelvis) return { interpretation: "Pericardial free fluid identified. Cardiac tamponade must be excluded.", severity: "critical", nextStep: "Urgent cardiothoracic surgery or trauma surgery activation. Pericardiocentesis if haemodynamically unstable.", reference: "ATLS / ACEP FAST Guidelines" };
  const windows = [ruq && "RUQ", luq && "LUQ", pelvis && "Pelvis", peri && "Pericardium"].filter(Boolean).join(", ");
  if (count >= 2) return { interpretation: `Positive FAST exam — free fluid in ${count} windows (${windows}). Significant haemoperitoneum or haemopericardium.`, severity: "critical", nextStep: "Trauma surgery activation. Operative intervention likely required. Haemostatic resuscitation.", reference: "ATLS / ACEP FAST Guidelines" };
  return { interpretation: `Positive FAST exam — free fluid in ${windows}. Haemoperitoneum present.`, severity: "severe", nextStep: "Trauma surgery review. Serial FAST and CT trauma survey if haemodynamically stable.", reference: "ATLS / ACEP FAST Guidelines" };
}

// ── Bladder Volume ─────────────────────────────────────────────────────────────
function runBladder(v: Record<string, string>): InterpretationResult {
  const l = parseFloat(v.length || "0");
  const w = parseFloat(v.width || "0");
  const h = parseFloat(v.height || "0");
  const vol = Math.round(0.523 * l * w * h);

  if (vol < 50)  return { interpretation: `Bladder volume ~${vol} mL — Empty or near-empty.`,                                      severity: "normal", nextStep: "No urinary retention.",                                                                                                   reference: "Standard ellipsoid formula" };
  if (vol < 300) return { interpretation: `Bladder volume ~${vol} mL — Normal fill.`,                                             severity: "normal", nextStep: "No retention. Correlate with clinical symptoms.",                                                                           reference: "Standard ellipsoid formula" };
  if (vol < 500) return { interpretation: `Bladder volume ~${vol} mL — Elevated. Possible incomplete emptying.`,                  severity: "mild",   nextStep: "Post-void residual assessment. Urology referral if symptomatic.",                                                           reference: "Standard ellipsoid formula" };
  return           { interpretation: `Bladder volume ~${vol} mL — Significant urinary retention (> 500 mL).`,                    severity: "severe", nextStep: "Urological assessment. Catheterisation recommended if symptomatic or > 600 mL.",                                            reference: "Standard ellipsoid formula" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ResultPanel({ result, onCopy }: { result: InterpretationResult; onCopy: () => void }) {
  const s = SEV[result.severity];
  return (
    <div className={`rounded-xl border p-4 mt-4 ${s.bg} ${s.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
          <span className={`text-sm font-bold ${s.text}`}>{s.label}</span>
          {result.detail && <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 ${s.text}`}>{result.detail}</span>}
        </div>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" /> Copy
        </button>
      </div>
      <p className={`text-sm font-medium ${s.text} mb-2`}>{result.interpretation}</p>
      <div className="border-t border-current/10 pt-2 mt-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Next Step</p>
        <p className={`text-sm ${s.text}`}>{result.nextStep}</p>
      </div>
      {result.reference && (
        <p className="text-xs text-gray-400 mt-2 italic">{result.reference}</p>
      )}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {["yes", "no"].map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
            value === v
              ? "bg-[#189aa1] text-white border-[#189aa1]"
              : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"
          }`}
        >
          {v === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL PANELS
// ═══════════════════════════════════════════════════════════════════════════════

function LiRADSTool() {
  const [v, setV] = useState<Record<string, string>>({ size: "", arterialEnhancement: "no", washout: "no", capsule: "no", growth: "no", ancillary: "none" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Lesion size (mm)"><Input type="number" value={v.size} onChange={(e) => set("size", e.target.value)} placeholder="e.g. 22" /></FieldRow>
        <FieldRow label="Arterial phase enhancement"><YesNo value={v.arterialEnhancement} onChange={(val) => set("arterialEnhancement", val)} /></FieldRow>
        <FieldRow label="Washout appearance"><YesNo value={v.washout} onChange={(val) => set("washout", val)} /></FieldRow>
        <FieldRow label="Enhancing capsule"><YesNo value={v.capsule} onChange={(val) => set("capsule", val)} /></FieldRow>
        <FieldRow label="Threshold growth (≥ 5 mm in ≤ 6 mo)"><YesNo value={v.growth} onChange={(val) => set("growth", val)} /></FieldRow>
        <FieldRow label="Ancillary features">
          <Select value={v.ancillary} onValueChange={(val) => set("ancillary", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="benign">favor benign</SelectItem>
              <SelectItem value="malignant">favor malignant (non-HCC)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <Button onClick={() => setResult(runLiRADS(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function TIRADSTool() {
  const [v, setV] = useState<Record<string, string>>({ size: "", composition: "solid", echogenicity: "hypoechoic", shape: "wider_than_tall", margin: "smooth", foci: "none" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Size (mm)"><Input type="number" value={v.size} onChange={(e) => set("size", e.target.value)} placeholder="e.g. 18" /></FieldRow>
        <FieldRow label="Composition">
          <Select value={v.composition} onValueChange={(val) => set("composition", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cystic">Cystic / almost cystic (0 pts)</SelectItem>
              <SelectItem value="spongiform">Spongiform (0 pts)</SelectItem>
              <SelectItem value="mixed">Mixed cystic/solid (1 pt)</SelectItem>
              <SelectItem value="solid">Solid (2 pts)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Echogenicity">
          <Select value={v.echogenicity} onValueChange={(val) => set("echogenicity", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anechoic">Anechoic (0 pts)</SelectItem>
              <SelectItem value="hyperechoic">Hyperechoic / isoechoic (1 pt)</SelectItem>
              <SelectItem value="hypoechoic">Hypoechoic (2 pts)</SelectItem>
              <SelectItem value="very_hypoechoic">Very hypoechoic (3 pts)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Shape">
          <Select value={v.shape} onValueChange={(val) => set("shape", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wider_than_tall">Wider than tall (0 pts)</SelectItem>
              <SelectItem value="taller_than_wide">Taller than wide (3 pts)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Margin">
          <Select value={v.margin} onValueChange={(val) => set("margin", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="smooth">Smooth (0 pts)</SelectItem>
              <SelectItem value="ill_defined">Ill-defined (0 pts)</SelectItem>
              <SelectItem value="lobulated">Lobulated / irregular (2 pts)</SelectItem>
              <SelectItem value="extrathyroidal">Extrathyroidal extension (3 pts)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Echogenic foci">
          <Select value={v.foci} onValueChange={(val) => set("foci", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None / large comet-tail (0 pts)</SelectItem>
              <SelectItem value="macrocalcification">Macrocalcification (1 pt)</SelectItem>
              <SelectItem value="peripheral_calcification">Peripheral calcification (2 pts)</SelectItem>
              <SelectItem value="punctate">Punctate echogenic foci (3 pts)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <Button onClick={() => setResult(runTIRADS(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Calculate TI-RADS Score</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function GallbladderTool() {
  const [v, setV] = useState<Record<string, string>>({ wall: "", fasting: "yes", focal: "no", fever: "no", murphy: "no" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Wall thickness (mm)"><Input type="number" value={v.wall} onChange={(e) => set("wall", e.target.value)} placeholder="e.g. 4" /></FieldRow>
        <FieldRow label="Fasting patient"><YesNo value={v.fasting} onChange={(val) => set("fasting", val)} /></FieldRow>
        <FieldRow label="Focal / asymmetric thickening"><YesNo value={v.focal} onChange={(val) => set("focal", val)} /></FieldRow>
        <FieldRow label="Fever present"><YesNo value={v.fever} onChange={(val) => set("fever", val)} /></FieldRow>
        <FieldRow label="Sonographic Murphy's sign"><YesNo value={v.murphy} onChange={(val) => set("murphy", val)} /></FieldRow>
      </div>
      <Button onClick={() => setResult(runGallbladder(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function SpleenTool() {
  const [v, setV] = useState<Record<string, string>>({ length: "" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  return (
    <div className="space-y-4">
      <FieldRow label="Spleen length (cm)"><Input type="number" value={v.length} onChange={(e) => setV({ length: e.target.value })} placeholder="e.g. 12.5" /></FieldRow>
      <Button onClick={() => setResult(runSpleen(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function RenalCortexTool() {
  const [v, setV] = useState<Record<string, string>>({ thickness: "", echogenicity: "normal", cmd: "good" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Cortical thickness (mm)"><Input type="number" value={v.thickness} onChange={(e) => set("thickness", e.target.value)} placeholder="e.g. 8" /></FieldRow>
        <FieldRow label="Cortical echogenicity">
          <Select value={v.echogenicity} onValueChange={(val) => set("echogenicity", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal (isoechoic to liver)</SelectItem>
              <SelectItem value="increased">Increased echogenicity</SelectItem>
              <SelectItem value="decreased">Decreased echogenicity</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Corticomedullary differentiation">
          <Select value={v.cmd} onValueChange={(val) => set("cmd", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="poor">Poor / absent</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <Button onClick={() => setResult(runRenalCortex(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function BIRADSTool() {
  const [v, setV] = useState<Record<string, string>>({ size: "", shape: "oval", orientation: "parallel", margin: "circumscribed", echo: "anechoic", posterior: "enhancement", calcification: "no", vascularity: "none" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Size (mm)"><Input type="number" value={v.size} onChange={(e) => set("size", e.target.value)} placeholder="e.g. 14" /></FieldRow>
        <FieldRow label="Shape">
          <Select value={v.shape} onValueChange={(val) => set("shape", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="oval">Oval (0 pts)</SelectItem>
              <SelectItem value="round">Round (0 pts)</SelectItem>
              <SelectItem value="irregular">Irregular (2 pts)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Orientation">
          <Select value={v.orientation} onValueChange={(val) => set("orientation", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="parallel">Parallel (0 pts)</SelectItem>
              <SelectItem value="not_parallel">Not parallel (2 pts)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Margin">
          <Select value={v.margin} onValueChange={(val) => set("margin", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="circumscribed">Circumscribed (0 pts)</SelectItem>
              <SelectItem value="not_circumscribed">Not circumscribed (2 pts)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Echo pattern">
          <Select value={v.echo} onValueChange={(val) => set("echo", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anechoic">Anechoic (0 pts)</SelectItem>
              <SelectItem value="hyperechoic">Hyperechoic (0 pts)</SelectItem>
              <SelectItem value="isoechoic">Isoechoic (0 pts)</SelectItem>
              <SelectItem value="hypoechoic">Hypoechoic (1 pt)</SelectItem>
              <SelectItem value="heterogeneous">Heterogeneous (1 pt)</SelectItem>
              <SelectItem value="complex">Complex (1 pt)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Posterior features">
          <Select value={v.posterior} onValueChange={(val) => set("posterior", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="enhancement">Enhancement (0 pts)</SelectItem>
              <SelectItem value="none">No posterior features (0 pts)</SelectItem>
              <SelectItem value="shadowing">Shadowing (1 pt)</SelectItem>
              <SelectItem value="combined">Combined pattern (1 pt)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Calcifications"><YesNo value={v.calcification} onChange={(val) => set("calcification", val)} /></FieldRow>
        <FieldRow label="Vascularity">
          <Select value={v.vascularity} onValueChange={(val) => set("vascularity", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Absent (0 pts)</SelectItem>
              <SelectItem value="peripheral">Peripheral (0 pts)</SelectItem>
              <SelectItem value="internal">Internal (1 pt)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <Button onClick={() => setResult(runBIRADS(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Calculate BI-RADS</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function EndometrialTool() {
  const [v, setV] = useState<Record<string, string>>({ et: "", menopausal: "postmenopausal", bleeding: "no", hrt: "no" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Endometrial thickness (mm)"><Input type="number" value={v.et} onChange={(e) => set("et", e.target.value)} placeholder="e.g. 6" /></FieldRow>
        <FieldRow label="Menopausal status">
          <Select value={v.menopausal} onValueChange={(val) => set("menopausal", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="premenopausal">Premenopausal</SelectItem>
              <SelectItem value="postmenopausal">Postmenopausal</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Postmenopausal bleeding"><YesNo value={v.bleeding} onChange={(val) => set("bleeding", val)} /></FieldRow>
        <FieldRow label="On HRT"><YesNo value={v.hrt} onChange={(val) => set("hrt", val)} /></FieldRow>
      </div>
      <Button onClick={() => setResult(runEndometrial(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function ORADSTool() {
  const [v, setV] = useState<Record<string, string>>({ size: "", morphology: "simple_cyst", solid: "no", papillary: "no", colorScore: "1", age: "premenopausal" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Size (cm)"><Input type="number" value={v.size} onChange={(e) => set("size", e.target.value)} placeholder="e.g. 4.5" /></FieldRow>
        <FieldRow label="Menopausal status">
          <Select value={v.age} onValueChange={(val) => set("age", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="premenopausal">Premenopausal</SelectItem>
              <SelectItem value="postmenopausal">Postmenopausal</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Morphology">
          <Select value={v.morphology} onValueChange={(val) => set("morphology", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simple_cyst">Simple cyst</SelectItem>
              <SelectItem value="hemorrhagic">Hemorrhagic cyst</SelectItem>
              <SelectItem value="endometrioma">Endometrioma</SelectItem>
              <SelectItem value="dermoid">Dermoid / mature teratoma</SelectItem>
              <SelectItem value="multilocular">Multilocular cyst</SelectItem>
              <SelectItem value="complex">Complex / other</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Solid component"><YesNo value={v.solid} onChange={(val) => set("solid", val)} /></FieldRow>
        <FieldRow label="Papillary projections"><YesNo value={v.papillary} onChange={(val) => set("papillary", val)} /></FieldRow>
        <FieldRow label="Color Doppler score (1–4)">
          <Select value={v.colorScore} onValueChange={(val) => set("colorScore", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 — No flow</SelectItem>
              <SelectItem value="2">2 — Minimal flow</SelectItem>
              <SelectItem value="3">3 — Moderate flow</SelectItem>
              <SelectItem value="4">4 — Marked flow</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <Button onClick={() => setResult(runORADS(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Calculate O-RADS</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function CervicalLengthTool() {
  const [v, setV] = useState<Record<string, string>>({ cl: "", ga: "", history: "no", cerclage: "no" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Cervical length (mm)"><Input type="number" value={v.cl} onChange={(e) => set("cl", e.target.value)} placeholder="e.g. 22" /></FieldRow>
        <FieldRow label="Gestational age (weeks)"><Input type="number" value={v.ga} onChange={(e) => set("ga", e.target.value)} placeholder="e.g. 22" /></FieldRow>
        <FieldRow label="Prior preterm birth"><YesNo value={v.history} onChange={(val) => set("history", val)} /></FieldRow>
        <FieldRow label="Cerclage in situ"><YesNo value={v.cerclage} onChange={(val) => set("cerclage", val)} /></FieldRow>
      </div>
      <Button onClick={() => setResult(runCervicalLength(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function FetalGrowthTool() {
  const [v, setV] = useState<Record<string, string>>({ efw: "", ga: "" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Estimated fetal weight (g)"><Input type="number" value={v.efw} onChange={(e) => set("efw", e.target.value)} placeholder="e.g. 1250" /></FieldRow>
        <FieldRow label="Gestational age (weeks)"><Input type="number" value={v.ga} onChange={(e) => set("ga", e.target.value)} placeholder="e.g. 30" /></FieldRow>
      </div>
      <Button onClick={() => setResult(runFetalGrowth(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Calculate Centile</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function AFITool() {
  const [v, setV] = useState<Record<string, string>>({ method: "afi", value: "", ga: "" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Method">
          <Select value={v.method} onValueChange={(val) => set("method", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="afi">AFI (4-quadrant, cm)</SelectItem>
              <SelectItem value="sdp">SDP (single deepest pocket, cm)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label={v.method === "afi" ? "AFI value (cm)" : "SDP value (cm)"}><Input type="number" value={v.value} onChange={(e) => set("value", e.target.value)} placeholder={v.method === "afi" ? "e.g. 14" : "e.g. 4"} /></FieldRow>
        <FieldRow label="Gestational age (weeks)"><Input type="number" value={v.ga} onChange={(e) => set("ga", e.target.value)} placeholder="e.g. 32" /></FieldRow>
      </div>
      <Button onClick={() => setResult(runAFI(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function DuctusVenosusTool() {
  const [v, setV] = useState<Record<string, string>>({ aWave: "present", pi: "", ga: "" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="a-wave">
          <Select value={v.aWave} onValueChange={(val) => set("aWave", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="present">Present (normal)</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="DV Pulsatility Index"><Input type="number" step="0.01" value={v.pi} onChange={(e) => set("pi", e.target.value)} placeholder="e.g. 0.85" /></FieldRow>
        <FieldRow label="Gestational age (weeks)"><Input type="number" value={v.ga} onChange={(e) => set("ga", e.target.value)} placeholder="e.g. 28" /></FieldRow>
      </div>
      <Button onClick={() => setResult(runDuctusVenosus(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function CarotidTool() {
  const [v, setV] = useState<Record<string, string>>({ psv: "", edv: "", ratio: "", plaque: "none" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="ICA PSV (cm/s)"><Input type="number" value={v.psv} onChange={(e) => set("psv", e.target.value)} placeholder="e.g. 180" /></FieldRow>
        <FieldRow label="ICA EDV (cm/s)"><Input type="number" value={v.edv} onChange={(e) => set("edv", e.target.value)} placeholder="e.g. 55" /></FieldRow>
        <FieldRow label="ICA/CCA PSV ratio"><Input type="number" step="0.1" value={v.ratio} onChange={(e) => set("ratio", e.target.value)} placeholder="e.g. 2.8" /></FieldRow>
        <FieldRow label="Plaque">
          <Select value={v.plaque} onValueChange={(val) => set("plaque", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="soft">Soft / hypoechoic</SelectItem>
              <SelectItem value="calcified">Calcified</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
              <SelectItem value="ulcerated">Ulcerated</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <Button onClick={() => setResult(runCarotid(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Grade Stenosis</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function RenalDopplerTool() {
  const [v, setV] = useState<Record<string, string>>({ ri: "", at: "", rar: "", parvus: "no", side: "bilateral", obstruction: "no" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <p className="font-semibold mb-1">Advanced Renal Doppler Decision Tool</p>
        <p>Integrates RI, Acceleration Time, RAR, and Parvus et Tardus detection to differentiate intrinsic renal disease, obstruction, and renal artery stenosis.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Resistive Index (RI)"><Input type="number" step="0.01" value={v.ri} onChange={(e) => set("ri", e.target.value)} placeholder="e.g. 0.72" /></FieldRow>
        <FieldRow label="Acceleration Time (ms)"><Input type="number" value={v.at} onChange={(e) => set("at", e.target.value)} placeholder="e.g. 85 (normal < 70 ms)" /></FieldRow>
        <FieldRow label="Renal-Aortic Ratio (RAR)"><Input type="number" step="0.1" value={v.rar} onChange={(e) => set("rar", e.target.value)} placeholder="e.g. 3.8 (stenosis > 3.5)" /></FieldRow>
        <FieldRow label="Parvus et tardus waveform"><YesNo value={v.parvus} onChange={(val) => set("parvus", val)} /></FieldRow>
        <FieldRow label="Side affected">
          <Select value={v.side} onValueChange={(val) => set("side", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bilateral">Bilateral</SelectItem>
              <SelectItem value="right">Right</SelectItem>
              <SelectItem value="left">Left</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Clinical obstruction suspected"><YesNo value={v.obstruction} onChange={(val) => set("obstruction", val)} /></FieldRow>
      </div>
      <Button onClick={() => setResult(runRenalDoppler(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret Renal Doppler</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function DVTTool() {
  const [v, setV] = useState<Record<string, string>>({ wells: "0", compress: "compressible", flow: "normal", echo: "anechoic" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Wells DVT score">
          <Select value={v.wells} onValueChange={(val) => set("wells", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 — Low probability</SelectItem>
              <SelectItem value="1">1–2 — Moderate probability</SelectItem>
              <SelectItem value="3">≥ 3 — High probability</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Vein compressibility">
          <Select value={v.compress} onValueChange={(val) => set("compress", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compressible">Fully compressible</SelectItem>
              <SelectItem value="non_compressible">Non-compressible</SelectItem>
              <SelectItem value="partial">Partially compressible</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Venous flow">
          <Select value={v.flow} onValueChange={(val) => set("flow", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal spontaneous flow</SelectItem>
              <SelectItem value="absent">Absent flow</SelectItem>
              <SelectItem value="reduced">Reduced flow</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Thrombus echogenicity">
          <Select value={v.echo} onValueChange={(val) => set("echo", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anechoic">Anechoic (acute)</SelectItem>
              <SelectItem value="echogenic">Echogenic (subacute/chronic)</SelectItem>
              <SelectItem value="none">No thrombus seen</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <Button onClick={() => setResult(runDVT(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret DVT Duplex</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function AAATool() {
  const [v, setV] = useState<Record<string, string>>({ diameter: "", sex: "male", growth: "" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Maximum diameter (cm)"><Input type="number" step="0.1" value={v.diameter} onChange={(e) => set("diameter", e.target.value)} placeholder="e.g. 4.2" /></FieldRow>
        <FieldRow label="Sex">
          <Select value={v.sex} onValueChange={(val) => set("sex", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male (threshold 5.5 cm)</SelectItem>
              <SelectItem value="female">Female (threshold 5.0 cm)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Growth rate (cm/year, if known)"><Input type="number" step="0.1" value={v.growth} onChange={(e) => set("growth", e.target.value)} placeholder="e.g. 1.2" /></FieldRow>
      </div>
      <Button onClick={() => setResult(runAAA(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret AAA</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function PortalHTNTool() {
  const [v, setV] = useState<Record<string, string>>({ pvDiam: "", pvVel: "", flow: "hepatopetal", spleen: "", ascites: "no" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Portal vein diameter (mm)"><Input type="number" value={v.pvDiam} onChange={(e) => set("pvDiam", e.target.value)} placeholder="e.g. 14 (normal < 13 mm)" /></FieldRow>
        <FieldRow label="Portal vein velocity (cm/s)"><Input type="number" value={v.pvVel} onChange={(e) => set("pvVel", e.target.value)} placeholder="e.g. 12 (normal 15–40 cm/s)" /></FieldRow>
        <FieldRow label="Portal flow direction">
          <Select value={v.flow} onValueChange={(val) => set("flow", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hepatopetal">Hepatopetal (towards liver — normal)</SelectItem>
              <SelectItem value="bidirectional">Bidirectional / to-and-fro</SelectItem>
              <SelectItem value="hepatofugal">Hepatofugal (away from liver)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Spleen length (cm)"><Input type="number" step="0.1" value={v.spleen} onChange={(e) => set("spleen", e.target.value)} placeholder="e.g. 14" /></FieldRow>
        <FieldRow label="Ascites present"><YesNo value={v.ascites} onChange={(val) => set("ascites", val)} /></FieldRow>
      </div>
      <Button onClick={() => setResult(runPortalHTN(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret Portal Doppler</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function RotatorCuffTool() {
  const [v, setV] = useState<Record<string, string>>({ continuity: "intact", width: "", retraction: "", fatty: "none" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Tendon continuity">
          <Select value={v.continuity} onValueChange={(val) => set("continuity", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="intact">Intact</SelectItem>
              <SelectItem value="partial">Partial-thickness tear</SelectItem>
              <SelectItem value="full">Full-thickness tear</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Tear width (mm)"><Input type="number" value={v.width} onChange={(e) => set("width", e.target.value)} placeholder="e.g. 12" /></FieldRow>
        <FieldRow label="Tendon retraction (mm)"><Input type="number" value={v.retraction} onChange={(e) => set("retraction", e.target.value)} placeholder="e.g. 20" /></FieldRow>
        <FieldRow label="Fatty infiltration">
          <Select value={v.fatty} onValueChange={(val) => set("fatty", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="mild">Mild</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="severe">Severe (Goutallier 3–4)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <Button onClick={() => setResult(runRotatorCuff(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function BLinesTool() {
  const [v, setV] = useState<Record<string, string>>({ zones: "0", bilateral: "yes", aLines: "yes" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Number of B-line zones (0–8)"><Input type="number" min={0} max={8} value={v.zones} onChange={(e) => set("zones", e.target.value)} placeholder="e.g. 4" /></FieldRow>
        <FieldRow label="Bilateral B-lines"><YesNo value={v.bilateral} onChange={(val) => set("bilateral", val)} /></FieldRow>
        <FieldRow label="A-lines present"><YesNo value={v.aLines} onChange={(val) => set("aLines", val)} /></FieldRow>
      </div>
      <Button onClick={() => setResult(runBLines(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret B-Lines</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function IVCTool() {
  const [v, setV] = useState<Record<string, string>>({ max: "", min: "", ventilated: "no" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="IVC max diameter (cm)"><Input type="number" step="0.1" value={v.max} onChange={(e) => set("max", e.target.value)} placeholder="e.g. 2.1" /></FieldRow>
        <FieldRow label="IVC min diameter (cm)"><Input type="number" step="0.1" value={v.min} onChange={(e) => set("min", e.target.value)} placeholder="e.g. 0.9" /></FieldRow>
        <FieldRow label="Mechanically ventilated"><YesNo value={v.ventilated} onChange={(val) => set("ventilated", val)} /></FieldRow>
      </div>
      <Button onClick={() => setResult(runIVC(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret IVC</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function ONSDTool() {
  const [v, setV] = useState<Record<string, string>>({ right: "", left: "" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Right ONSD (mm)"><Input type="number" step="0.1" value={v.right} onChange={(e) => set("right", e.target.value)} placeholder="e.g. 5.2" /></FieldRow>
        <FieldRow label="Left ONSD (mm)"><Input type="number" step="0.1" value={v.left} onChange={(e) => set("left", e.target.value)} placeholder="e.g. 5.0" /></FieldRow>
      </div>
      <Button onClick={() => setResult(runONSD(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret ONSD</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function FASTTool() {
  const [v, setV] = useState<Record<string, string>>({ ruq: "no", luq: "no", pelvis: "no", peri: "no" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Select all windows where free fluid was identified:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="RUQ (Morison's pouch)"><YesNo value={v.ruq} onChange={(val) => set("ruq", val)} /></FieldRow>
        <FieldRow label="LUQ (Splenorenal)"><YesNo value={v.luq} onChange={(val) => set("luq", val)} /></FieldRow>
        <FieldRow label="Pelvis (Pouch of Douglas)"><YesNo value={v.pelvis} onChange={(val) => set("pelvis", val)} /></FieldRow>
        <FieldRow label="Pericardial window"><YesNo value={v.peri} onChange={(val) => set("peri", val)} /></FieldRow>
      </div>
      <Button onClick={() => setResult(runFAST(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Interpret FAST Exam</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}

function BladderTool() {
  const [v, setV] = useState<Record<string, string>>({ length: "", width: "", height: "" });
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <FieldRow label="Length (cm)"><Input type="number" step="0.1" value={v.length} onChange={(e) => set("length", e.target.value)} placeholder="e.g. 8" /></FieldRow>
        <FieldRow label="Width (cm)"><Input type="number" step="0.1" value={v.width} onChange={(e) => set("width", e.target.value)} placeholder="e.g. 6" /></FieldRow>
        <FieldRow label="Height (cm)"><Input type="number" step="0.1" value={v.height} onChange={(e) => set("height", e.target.value)} placeholder="e.g. 5" /></FieldRow>
      </div>
      <Button onClick={() => setResult(runBladder(v))} className="bg-[#189aa1] hover:bg-[#147a80] text-white w-full">Calculate Volume</Button>
      {result && <ResultPanel result={result} onCopy={() => { navigator.clipboard.writeText(`${result.interpretation}\n\nNext Step: ${result.nextStep}`); toast.success("Copied"); }} />}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
// access: "free" = login required, "premium" = premium required
const TOOL_CATEGORIES = [
  {
    label: "Thyroid",
    access: "free" as const,
    tools: [
      { id: "tirads", title: "ACR TI-RADS 2017", subtitle: "Thyroid Nodule Risk Stratification", component: TIRADSTool },
    ],
  },
  {
    label: "Breast",
    access: "premium" as const,
    tools: [
      { id: "birads", title: "ACR BI-RADS 5th Ed.", subtitle: "Breast Lesion Risk Stratification", component: BIRADSTool },
    ],
  },
  {
    label: "Liver / Hepatic",
    access: "premium" as const,
    tools: [
      { id: "lirads", title: "LI-RADS v2018", subtitle: "Hepatocellular Carcinoma Risk", component: LiRADSTool },
    ],
  },
  {
    label: "Renal",
    access: "premium" as const,
    tools: [
      { id: "renalcortex", title: "Renal Cortex Assessment", subtitle: "Echogenicity & hydronephrosis grading", component: RenalCortexTool },
      { id: "renaldoppler", title: "Renal Doppler", subtitle: "Resistive index & renal artery stenosis", component: RenalDopplerTool },
    ],
  },
  {
    label: "Gallbladder & Spleen",
    access: "premium" as const,
    tools: [
      { id: "gallbladder", title: "Gallbladder Assessment", subtitle: "Wall thickness, stones, polyps", component: GallbladderTool },
      { id: "spleen", title: "Spleen Size", subtitle: "Splenomegaly grading", component: SpleenTool },
    ],
  },
  {
    label: "OB / Gynecology",
    access: "premium" as const,
    tools: [
      { id: "endometrial", title: "Endometrial Thickness", subtitle: "ACOG/TVUS guidelines", component: EndometrialTool },
      { id: "orads", title: "ACR O-RADS v2022", subtitle: "Ovarian Lesion Risk Stratification", component: ORADSTool },
      { id: "cervicallength", title: "Cervical Length", subtitle: "Preterm birth risk assessment", component: CervicalLengthTool },
      { id: "fetalgrowth", title: "Fetal Growth", subtitle: "EFW & biometry percentiles", component: FetalGrowthTool },
      { id: "afi", title: "Amniotic Fluid Index", subtitle: "AFI & MVP assessment", component: AFITool },
      { id: "ductusvenosus", title: "Ductus Venosus Doppler", subtitle: "Fetal cardiac function", component: DuctusVenosusTool },
    ],
  },
  {
    label: "Vascular",
    access: "premium" as const,
    tools: [
      { id: "carotid", title: "Carotid Stenosis", subtitle: "SRU consensus criteria", component: CarotidTool },
      { id: "dvt", title: "DVT Assessment", subtitle: "Lower extremity venous duplex", component: DVTTool },
      { id: "aaa", title: "Abdominal Aortic Aneurysm", subtitle: "AAA size & surveillance", component: AAATool },
      { id: "portalhtn", title: "Portal Hypertension", subtitle: "Portal vein diameter & flow", component: PortalHTNTool },
    ],
  },
  {
    label: "MSK",
    access: "premium" as const,
    tools: [
      { id: "rotatorcuff", title: "Rotator Cuff Assessment", subtitle: "Tear grading per ESSR guidelines", component: RotatorCuffTool },
    ],
  },
  {
    label: "POCUS",
    access: "premium" as const,
    tools: [
      { id: "blines", title: "B-Lines / Lung Ultrasound", subtitle: "Pulmonary edema & pneumothorax", component: BLinesTool },
      { id: "ivc", title: "IVC Collapsibility", subtitle: "Volume status & RA pressure", component: IVCTool },
      { id: "onsd", title: "Optic Nerve Sheath Diameter", subtitle: "Elevated ICP screening", component: ONSDTool },
      { id: "fast", title: "eFAST Exam", subtitle: "Trauma free fluid assessment", component: FASTTool },
      { id: "bladder", title: "Bladder Volume", subtitle: "Post-void residual calculation", component: BladderTool },
    ],
  },
];

export default function ClinicalInterpretationEngine() {
  const [activeCat, setActiveCat] = useState<string>(TOOL_CATEGORIES[0].label);
  const [activeTool, setActiveTool] = useState<string>(TOOL_CATEGORIES[0].tools[0].id);
  const { isPremium, isAuthenticated } = usePremium();

  const currentCat = TOOL_CATEGORIES.find((c) => c.label === activeCat) ?? TOOL_CATEGORIES[0];
  const currentToolDef = currentCat.tools.find((t) => t.id === activeTool) ?? currentCat.tools[0];
  const ToolComponent = currentToolDef.component;

  // Three-tier access logic:
  // - Non-registered: can see all menus, but clicking a premium category shows login prompt on the tool form
  // - Registered (free): can open any menu, but premium tool form shows upgrade prompt
  // - Premium: full access everywhere
  //
  // Thyroid (access="free"): free to registered users, login prompt for non-registered
  // All others (access="premium"): login prompt for non-registered, upgrade prompt for registered non-premium

  const catAccess = currentCat.access;

  // Should the tool form be overlaid?
  const toolFormLocked =
    catAccess === "free"
      ? !isAuthenticated          // Thyroid: only locked if not logged in
      : catAccess === "premium"
        ? !isPremium               // Premium tools: locked if not premium (includes non-registered)
        : false;

  // Which overlay type to show on the tool form
  const toolOverlayType: "login" | "premium" =
    catAccess === "free"
      ? "login"
      : !isAuthenticated
        ? "login"    // Non-registered clicking premium tool → login first
        : "premium"; // Registered non-premium → upgrade prompt

  // Sidebar click handler: non-registered users clicking premium cats still navigate to the cat
  // (they'll see the overlay on the tool form), so no interception needed on sidebar click
  const handleCatClick = (cat: typeof TOOL_CATEGORIES[0]) => {
    setActiveCat(cat.label);
    setActiveTool(cat.tools[0].id);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-[#0e1e2e] to-[#1a3a4a] text-white px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="w-7 h-7 text-[#4ad9e0]" />
              <h1 className="text-2xl font-bold" style={{ fontFamily: "Merriweather, serif" }}>
                Clinical Intelligence
              </h1>
            </div>
            <p className="text-[#a0d8dc] text-sm max-w-2xl">
              Guideline-driven interpretation tools across all ultrasound specialties. Enter clinical findings to receive structured risk stratification, grading, and next-step recommendations.
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
          {/* Category sidebar — always fully visible, no click interception */}
          <div className="md:w-56 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {TOOL_CATEGORIES.map((cat) => {
                // Badge logic: show PRO for premium cats if user isn't premium; FREE for thyroid if not logged in
                const showProBadge = cat.access === "premium" && !isPremium;
                const showFreeBadge = cat.access === "free" && !isAuthenticated;
                return (
                  <button
                    key={cat.label}
                    onClick={() => handleCatClick(cat)}
                    className={`w-full text-left px-4 py-3 text-sm font-medium border-b border-gray-50 transition-colors flex items-center justify-between ${
                      activeCat === cat.label
                        ? "bg-[#189aa1] text-white"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{cat.label}</span>
                    {(showProBadge || showFreeBadge) && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                        showProBadge
                          ? activeCat === cat.label ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
                          : activeCat === cat.label ? "bg-white/20 text-white" : "bg-teal-50 text-teal-700"
                      }`}>
                        {showProBadge ? "PRO" : "FREE"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tool area */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Tool tabs within category — always shown so user can see what's available */}
            {currentCat.tools.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {currentCat.tools.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTool(t.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      activeTool === t.id
                        ? "bg-[#189aa1] text-white border-[#189aa1]"
                        : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}

            {/* Tool form — BlurredOverlay only wraps the data-entry form, not the header */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>
                  {currentToolDef.title}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">{currentToolDef.subtitle}</p>
              </div>
              <BlurredOverlay
                type={toolOverlayType}
                featureName={currentCat.label}
                disabled={!toolFormLocked}
              >
                <ToolComponent />
              </BlurredOverlay>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
