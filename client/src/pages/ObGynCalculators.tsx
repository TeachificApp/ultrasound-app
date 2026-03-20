/*
  UltrasoundAssist™ — Clinical Calculators Hub
  Tabs: OB/Gyn | Abdominal | Breast | Vascular
  References: ACOG, SMFM, ISUOG, AIUM, EASL, WFUMB, ACR, AHA/ACC
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Calculator, ChevronDown, ChevronUp, ArrowLeft, Baby, Activity, Scan, Heart } from "lucide-react";

// ─── Shared types ─────────────────────────────────────────────────────────────
type CalcResult = { result: string; label: string; note: string } | null;
type FieldDef = { key: string; label: string; placeholder: string; min?: number; max?: number };
type CalcDef = {
  id: string; title: string; subtitle: string; category: string; premium: boolean;
  fields: FieldDef[];
  calculate: (vals: Record<string, number>) => CalcResult;
};

// ─── OB/GYN helpers ──────────────────────────────────────────────────────────
function gestationalAge(crl_mm: number): string {
  const days = Math.round(8.052 * Math.sqrt(crl_mm + 23.73) + 23.73);
  return `${Math.floor(days / 7)}w ${days % 7}d`;
}
function ntPercentile(nt: number, crl: number): string {
  const p95 = 0.7 + 0.031 * crl;
  if (nt >= 3.5) return "≥99th percentile — HIGH RISK";
  if (nt >= p95) return "≥95th percentile — Increased risk";
  return "Below 95th percentile — Low risk";
}
function mcaPsvMoM(psv: number, ga: number): string {
  const median = 20.0 + (ga - 18) * 2.5;
  const mom = psv / median;
  if (mom >= 1.5) return `${mom.toFixed(2)} MoM — ELEVATED (≥1.5 MoM)`;
  if (mom >= 1.29) return `${mom.toFixed(2)} MoM — Borderline (1.29–1.49 MoM)`;
  return `${mom.toFixed(2)} MoM — Normal (<1.29 MoM)`;
}
function efw(bpd: number, hc: number, ac: number, fl: number): number {
  const log10 = 1.3596 - 0.00386 * ac * fl + 0.0064 * hc + 0.00061 * bpd * ac + 0.0424 * ac + 0.174 * fl;
  return Math.round(Math.pow(10, log10));
}
function twinDiscordance(a: number, b: number): string {
  const larger = Math.max(a, b), smaller = Math.min(a, b);
  const d = ((larger - smaller) / larger) * 100;
  if (d >= 25) return `${d.toFixed(1)}% — SIGNIFICANT discordance (≥25%)`;
  if (d >= 15) return `${d.toFixed(1)}% — Moderate discordance (15–24%)`;
  return `${d.toFixed(1)}% — Within normal limits (<15%)`;
}

// ─── Abdominal helpers ────────────────────────────────────────────────────────
function liverStiffnessStage(kpa: number, method: string): string {
  // EASL/WFUMB guidelines — pSWE (point SWE / ARFI) thresholds
  if (method === "pswe") {
    if (kpa < 1.21) return "F0–F1 — No/minimal fibrosis (<1.21 m/s equivalent)";
    if (kpa < 1.35) return "F1–F2 — Mild fibrosis (1.21–1.34 m/s)";
    if (kpa < 1.55) return "F2–F3 — Moderate fibrosis (1.35–1.54 m/s)";
    if (kpa < 1.80) return "F3 — Significant fibrosis (1.55–1.79 m/s)";
    return "F4 — Cirrhosis (≥1.80 m/s) — Confirm clinically";
  }
  // 2D-SWE kPa thresholds (EASL 2017)
  if (kpa < 6.0) return "F0–F1 — No/minimal fibrosis (<6.0 kPa)";
  if (kpa < 8.0) return "F1–F2 — Mild fibrosis (6.0–7.9 kPa)";
  if (kpa < 10.0) return "F2–F3 — Moderate fibrosis (8.0–9.9 kPa)";
  if (kpa < 14.0) return "F3 — Significant fibrosis (10.0–13.9 kPa)";
  return "F4 — Cirrhosis (≥14.0 kPa) — Confirm clinically";
}
function udffGrade(udff: number): string {
  if (udff < 5) return "S0 — No steatosis (<5%)";
  if (udff < 17.5) return "S1 — Mild steatosis (5–17.4%)";
  if (udff < 22.1) return "S2 — Moderate steatosis (17.5–22.0%)";
  return "S3 — Severe steatosis (≥22.1%)";
}
function gallbladderWall(thickness_mm: number): string {
  if (thickness_mm <= 3) return "Normal (≤3 mm)";
  if (thickness_mm <= 5) return "Borderline thickening (3–5 mm) — correlate clinically";
  return "Abnormal (>5 mm) — consider cholecystitis, hepatitis, heart failure, hypoalbuminemia";
}
function spleenSize(length_cm: number): string {
  if (length_cm <= 11) return "Normal (≤11 cm)";
  if (length_cm <= 13) return "Mild splenomegaly (11–13 cm)";
  if (length_cm <= 16) return "Moderate splenomegaly (13–16 cm)";
  return "Massive splenomegaly (>16 cm) — evaluate for portal hypertension, hematologic cause";
}

// ─── Breast helpers ───────────────────────────────────────────────────────────
function sweKpaMalignancy(kpa: number): string {
  // ACR/WFUMB SWE BI-RADS adjunct criteria
  if (kpa < 30) return "Soft (<30 kPa) — Benign characteristic. Supports BI-RADS 2–3 downgrade.";
  if (kpa < 80) return "Intermediate (30–79 kPa) — Indeterminate. Correlate with B-mode features.";
  if (kpa < 160) return "Stiff (80–159 kPa) — Suspicious. Supports BI-RADS 4–5 upgrade.";
  return "Very stiff (≥160 kPa) — Highly suspicious for malignancy. Biopsy recommended.";
}
function sweMs(ms: number): string {
  const kpa = ms * ms * 3; // approximate conversion: kPa ≈ 3 × (m/s)²
  return sweKpaMalignancy(kpa) + ` [≈${kpa.toFixed(0)} kPa]`;
}
function lesionFatRatio(lesion_kpa: number, fat_kpa: number): string {
  if (fat_kpa <= 0) return "—";
  const ratio = lesion_kpa / fat_kpa;
  if (ratio < 1.5) return `Ratio = ${ratio.toFixed(2)} — Soft (benign characteristic)`;
  if (ratio < 3.0) return `Ratio = ${ratio.toFixed(2)} — Intermediate`;
  return `Ratio = ${ratio.toFixed(2)} — Stiff (malignant characteristic, ratio ≥3.0)`;
}
function biradsSweAdjunct(birads: number, kpa: number): string {
  const soft = kpa < 30, stiff = kpa >= 80;
  if (birads <= 3 && stiff) return `BI-RADS ${birads} + stiff SWE → Consider upgrade to BI-RADS 4A`;
  if (birads === 4 && soft) return `BI-RADS 4 + soft SWE → Consider downgrade to BI-RADS 3 (if other features benign)`;
  if (birads >= 4 && stiff) return `BI-RADS ${birads} + stiff SWE → Supports biopsy recommendation`;
  return `BI-RADS ${birads} + SWE ${kpa} kPa — No adjunct upgrade/downgrade indicated`;
}

// ─── Vascular helpers ─────────────────────────────────────────────────────────
function abiInterpret(abi: number): string {
  if (abi > 1.40) return "Non-compressible (>1.40) — Likely calcified vessels. Consider toe-brachial index.";
  if (abi >= 1.00) return "Normal (1.00–1.40) — No significant PAD.";
  if (abi >= 0.90) return "Borderline (0.90–0.99) — Mild PAD possible. Repeat with exercise.";
  if (abi >= 0.70) return "Mild PAD (0.70–0.89) — Lifestyle modification, risk factor control.";
  if (abi >= 0.40) return "Moderate PAD (0.40–0.69) — Vascular surgery referral.";
  return "Severe PAD (<0.40) — Critical limb ischemia. Urgent vascular referral.";
}
function ivcCi(max_cm: number, min_cm: number): string {
  if (max_cm <= 0) return "—";
  const ci = ((max_cm - min_cm) / max_cm) * 100;
  let cvp = "";
  if (ci >= 50) cvp = "Low CVP (<5 mmHg) — volume responsive";
  else if (ci >= 20) cvp = "Intermediate CVP (5–10 mmHg) — consider clinical context";
  else cvp = "High CVP (>10 mmHg) — likely volume overloaded";
  return `CI = ${ci.toFixed(1)}% — ${cvp}`;
}
function carotidStenosis(psv: number, edv: number, ica_cca_ratio: number): string {
  // NASCET/SRU criteria
  const results: string[] = [];
  if (psv < 125) results.push("<50% stenosis (PSV <125 cm/s)");
  else if (psv < 230) results.push("50–69% stenosis (PSV 125–229 cm/s)");
  else results.push("≥70% stenosis (PSV ≥230 cm/s)");
  if (edv >= 100) results.push("EDV ≥100 cm/s supports ≥70%");
  if (ica_cca_ratio >= 4.0) results.push("ICA/CCA ratio ≥4.0 supports ≥70%");
  return results.join("; ");
}
// ─── Calculator definitions ───────────────────────────────────────────────────
const obgynCalcs: CalcDef[] = [
  {
    id: "crl_ga", title: "CRL → Gestational Age", subtitle: "Crown-Rump Length to GA (Robinson & Fleming 1975)",
    category: "1st Trimester", premium: false,
    fields: [{ key: "crl", label: "CRL (mm)", placeholder: "e.g. 45", min: 1, max: 84 }],
    calculate: (v) => v.crl ? { result: gestationalAge(v.crl), label: "Estimated Gestational Age", note: "Valid for CRL 1–84 mm (6w0d–13w6d)" } : null,
  },
  {
    id: "nt_assessment", title: "Nuchal Translucency Assessment", subtitle: "NT percentile vs. CRL (FMF/Snijders reference)",
    category: "1st Trimester", premium: false,
    fields: [
      { key: "nt", label: "NT (mm)", placeholder: "e.g. 2.8", min: 0.5, max: 10 },
      { key: "crl", label: "CRL (mm)", placeholder: "e.g. 55", min: 36, max: 84 },
    ],
    calculate: (v) => (v.nt && v.crl) ? { result: ntPercentile(v.nt, v.crl), label: "NT Risk Assessment", note: "NT ≥3.5 mm = high risk regardless of CRL." } : null,
  },
  {
    id: "mca_psv", title: "MCA PSV (Multiples of Median)", subtitle: "Fetal anemia screening (Mari NEJM 2000)",
    category: "2nd/3rd Trimester", premium: false,
    fields: [
      { key: "psv", label: "MCA PSV (cm/s)", placeholder: "e.g. 52", min: 10, max: 120 },
      { key: "ga", label: "Gestational Age (weeks)", placeholder: "e.g. 28", min: 18, max: 40 },
    ],
    calculate: (v) => (v.psv && v.ga) ? { result: mcaPsvMoM(v.psv, v.ga), label: "MCA PSV Assessment", note: "Angle of insonation <30°. Measure at proximal 1/3 of MCA." } : null,
  },
  {
    id: "efw_hadlock", title: "Estimated Fetal Weight (Hadlock 4-parameter)", subtitle: "BPD + HC + AC + FL — Hadlock 1985",
    category: "2nd/3rd Trimester", premium: false,
    fields: [
      { key: "bpd", label: "BPD (cm)", placeholder: "e.g. 7.2", min: 1, max: 12 },
      { key: "hc", label: "HC (cm)", placeholder: "e.g. 26.5", min: 5, max: 40 },
      { key: "ac", label: "AC (cm)", placeholder: "e.g. 25.0", min: 5, max: 40 },
      { key: "fl", label: "FL (cm)", placeholder: "e.g. 5.2", min: 1, max: 9 },
    ],
    calculate: (v) => (v.bpd && v.hc && v.ac && v.fl) ? {
      result: `${efw(v.bpd, v.hc, v.ac, v.fl).toLocaleString()} g (${(efw(v.bpd, v.hc, v.ac, v.fl) / 453.592).toFixed(2)} lbs)`,
      label: "Estimated Fetal Weight", note: "±15–20% error range. SGA <10th percentile; LGA >90th percentile."
    } : null,
  },
  {
    id: "twin_discordance", title: "Twin Growth Discordance", subtitle: "EFW discordance (ACOG/SMFM criteria)",
    category: "2nd/3rd Trimester", premium: false,
    fields: [
      { key: "efw1", label: "Twin A EFW (g)", placeholder: "e.g. 1800", min: 100, max: 5000 },
      { key: "efw2", label: "Twin B EFW (g)", placeholder: "e.g. 1350", min: 100, max: 5000 },
    ],
    calculate: (v) => (v.efw1 && v.efw2) ? { result: twinDiscordance(v.efw1, v.efw2), label: "Twin Discordance", note: "≥25% = significant. SMFM recommends surveillance every 2 weeks." } : null,
  },
  {
    id: "cervical_length", title: "Cervical Length Risk Stratification", subtitle: "Preterm birth risk (ACOG/SMFM)",
    category: "Cervix", premium: false,
    fields: [
      { key: "cl", label: "Cervical Length (mm)", placeholder: "e.g. 28", min: 1, max: 60 },
      { key: "ga", label: "Gestational Age (weeks)", placeholder: "e.g. 22", min: 16, max: 34 },
    ],
    calculate: (v) => {
      if (!v.cl || !v.ga) return null;
      let risk = v.cl <= 10 ? "Extremely short — very high risk. Immediate referral."
        : v.cl <= 20 ? "Short cervix (≤20 mm) — high risk. Progesterone and/or cerclage evaluation."
        : v.cl <= 25 ? "Borderline short (21–25 mm) — increased risk. Consider progesterone."
        : "Normal cervical length (>25 mm) — low risk.";
      return { result: risk, label: "Cervical Length Assessment", note: "Measure transvaginally with empty bladder. Report shortest of 3 measurements." };
    },
  },
  {
    id: "afv", title: "Amniotic Fluid Index (AFI) / DVP", subtitle: "Oligohydramnios and polyhydramnios assessment",
    category: "Amniotic Fluid", premium: false,
    fields: [
      { key: "afi", label: "AFI (cm) — sum of 4 quadrants", placeholder: "e.g. 14", min: 0, max: 40 },
      { key: "dvp", label: "Deepest Vertical Pocket (cm)", placeholder: "e.g. 5.2", min: 0, max: 20 },
    ],
    calculate: (v) => {
      const res: string[] = [];
      if (v.afi > 0) res.push(v.afi < 5 ? `AFI ${v.afi} cm — Oligohydramnios` : v.afi <= 8 ? `AFI ${v.afi} cm — Low normal` : v.afi <= 24 ? `AFI ${v.afi} cm — Normal` : `AFI ${v.afi} cm — Polyhydramnios`);
      if (v.dvp > 0) res.push(v.dvp < 2 ? `DVP ${v.dvp} cm — Oligohydramnios` : v.dvp <= 8 ? `DVP ${v.dvp} cm — Normal` : `DVP ${v.dvp} cm — Polyhydramnios`);
      return res.length ? { result: res.join(" | "), label: "Amniotic Fluid Assessment", note: "DVP preferred in multiple gestations. AFI <5 cm or DVP <2 cm = oligohydramnios." } : null;
    },
  },
  {
    id: "umbilical_doppler", title: "Umbilical Artery Doppler Indices", subtitle: "S/D ratio, PI, RI interpretation",
    category: "Doppler", premium: true,
    fields: [
      { key: "sd", label: "S/D Ratio", placeholder: "e.g. 3.2", min: 0.5, max: 20 },
      { key: "pi", label: "Pulsatility Index (PI)", placeholder: "e.g. 1.2", min: 0.1, max: 5 },
      { key: "ri", label: "Resistive Index (RI)", placeholder: "e.g. 0.65", min: 0.1, max: 1.5 },
    ],
    calculate: (v) => {
      if (!v.sd) return null;
      const res: string[] = [];
      if (v.sd > 4.0) res.push("S/D ratio elevated (>4.0)");
      if (v.pi > 1.7) res.push("PI elevated (>1.7)");
      if (v.ri > 0.8) res.push("RI elevated (>0.8)");
      return { result: res.length ? res.join("; ") : "Normal umbilical artery Doppler", label: "Umbilical Artery Assessment", note: "Absent/reversed end-diastolic flow = immediate obstetric consultation." };
    },
  },
];

const abdominalCalcs: CalcDef[] = [
  {
    id: "liver_stiffness_2dswe", title: "Liver Stiffness — 2D-SWE (kPa)", subtitle: "Hepatic fibrosis staging (EASL 2017 guidelines)",
    category: "Liver SWE", premium: false,
    fields: [{ key: "kpa", label: "2D-SWE Result (kPa)", placeholder: "e.g. 8.5", min: 1, max: 75 }],
    calculate: (v) => v.kpa ? { result: liverStiffnessStage(v.kpa, "2dswe"), label: "Fibrosis Stage (2D-SWE)", note: "Fasting ≥2 h required. Avoid after exercise. IQR/median <30% for reliable result. Reference: EASL Clinical Practice Guidelines 2017." } : null,
  },
  {
    id: "liver_stiffness_pswe", title: "Liver Stiffness — pSWE / ARFI (m/s)", subtitle: "Hepatic fibrosis staging (WFUMB/EFSUMB guidelines)",
    category: "Liver SWE", premium: false,
    fields: [{ key: "kpa", label: "pSWE / ARFI Result (m/s)", placeholder: "e.g. 1.45", min: 0.5, max: 4.5 }],
    calculate: (v) => v.kpa ? { result: liverStiffnessStage(v.kpa, "pswe"), label: "Fibrosis Stage (pSWE/ARFI)", note: "Measure in right lobe, 10th intercostal space, 1–2 cm below liver capsule. 10 valid measurements. Reference: WFUMB 2015." } : null,
  },
  {
    id: "udff", title: "UDFF — Ultrasound-Derived Fat Fraction", subtitle: "Hepatic steatosis grading S0–S3 (GE LOGIQ / Siemens Acuson)",
    category: "Steatosis (UDFF)", premium: false,
    fields: [{ key: "udff", label: "UDFF (%)", placeholder: "e.g. 12.5", min: 0, max: 100 }],
    calculate: (v) => v.udff !== undefined ? { result: udffGrade(v.udff), label: "Steatosis Grade (UDFF)", note: "UDFF <5% = no steatosis. Validated against MRI-PDFF. Vendor-specific: GE uses ATI, Siemens uses STE. Reference: Ferraioli et al. Ultrasonography 2021." } : null,
  },
  {
    id: "gallbladder_wall", title: "Gallbladder Wall Thickness", subtitle: "Normal vs. abnormal wall thickness interpretation",
    category: "Gallbladder", premium: false,
    fields: [{ key: "thickness_mm", label: "Wall Thickness (mm)", placeholder: "e.g. 4", min: 1, max: 20 }],
    calculate: (v) => v.thickness_mm ? { result: gallbladderWall(v.thickness_mm), label: "Gallbladder Wall Assessment", note: "Measure anterior wall in fasting patient. Diffuse thickening >3 mm has many causes beyond cholecystitis." } : null,
  },
  {
    id: "spleen_size", title: "Spleen Size Assessment", subtitle: "Splenomegaly grading by maximum length",
    category: "Spleen", premium: false,
    fields: [{ key: "length_cm", label: "Spleen Length (cm)", placeholder: "e.g. 12.5", min: 4, max: 30 }],
    calculate: (v) => v.length_cm ? { result: spleenSize(v.length_cm), label: "Spleen Size Assessment", note: "Measure maximum craniocaudal length in coronal plane. Normal ≤11 cm in adults." } : null,
  },
];

const breastCalcs: CalcDef[] = [
  {
    id: "swe_kpa", title: "SWE Lesion Stiffness (kPa) → Malignancy Risk", subtitle: "ACR/WFUMB SWE BI-RADS adjunct criteria",
    category: "SWE Stiffness", premium: false,
    fields: [{ key: "kpa", label: "Mean Lesion Stiffness (kPa)", placeholder: "e.g. 95", min: 1, max: 300 }],
    calculate: (v) => v.kpa ? { result: sweKpaMalignancy(v.kpa), label: "SWE Malignancy Risk (kPa)", note: "Use mean stiffness in ROI placed over stiffest part of lesion. Avoid ROI in necrotic areas. Reference: ACR SWE Lexicon 2019." } : null,
  },
  {
    id: "swe_ms", title: "SWE Lesion Stiffness (m/s) → Malignancy Risk", subtitle: "Convert m/s to kPa and interpret (kPa ≈ 3 × v²)",
    category: "SWE Stiffness", premium: false,
    fields: [{ key: "ms", label: "Mean Lesion Stiffness (m/s)", placeholder: "e.g. 5.5", min: 0.5, max: 15 }],
    calculate: (v) => v.ms ? { result: sweMs(v.ms), label: "SWE Malignancy Risk (m/s)", note: "Conversion: kPa ≈ 3 × (m/s)². Vendor-specific: Supersonic Imagine reports m/s; Siemens/GE report kPa." } : null,
  },
  {
    id: "lesion_fat_ratio", title: "Lesion-to-Fat SWE Ratio", subtitle: "Lesion stiffness relative to adjacent fat (ratio ≥3.0 = suspicious)",
    category: "SWE Stiffness", premium: false,
    fields: [
      { key: "lesion_kpa", label: "Lesion Stiffness (kPa)", placeholder: "e.g. 90", min: 1, max: 300 },
      { key: "fat_kpa", label: "Adjacent Fat Stiffness (kPa)", placeholder: "e.g. 18", min: 1, max: 50 },
    ],
    calculate: (v) => (v.lesion_kpa && v.fat_kpa) ? { result: lesionFatRatio(v.lesion_kpa, v.fat_kpa), label: "Lesion-to-Fat Ratio", note: "Measure fat stiffness in same plane, same depth. Ratio ≥3.0 supports malignant classification. Reference: Berg et al. Radiology 2012." } : null,
  },
  {
    id: "birads_swe_adjunct", title: "BI-RADS + SWE Adjunct Assessment", subtitle: "SWE upgrade/downgrade guidance for BI-RADS 3–5",
    category: "BI-RADS Adjunct", premium: false,
    fields: [
      { key: "birads", label: "B-mode BI-RADS Category (2–5)", placeholder: "e.g. 4", min: 2, max: 5 },
      { key: "kpa", label: "Mean Lesion Stiffness (kPa)", placeholder: "e.g. 95", min: 1, max: 300 },
    ],
    calculate: (v) => (v.birads && v.kpa) ? { result: biradsSweAdjunct(v.birads, v.kpa), label: "BI-RADS + SWE Adjunct", note: "SWE is an adjunct — never use alone to upgrade or downgrade without full B-mode assessment. Reference: ACR BI-RADS Atlas 5th Ed." } : null,
  },
];

const vascularCalcs: CalcDef[] = [
  {
    id: "abi", title: "Ankle-Brachial Index (ABI)", subtitle: "Peripheral arterial disease assessment (AHA/ACC guidelines)",
    category: "Peripheral Arterial", premium: false,
    fields: [
      { key: "ankle", label: "Ankle Systolic Pressure (mmHg)", placeholder: "e.g. 110", min: 40, max: 250 },
      { key: "brachial", label: "Brachial Systolic Pressure (mmHg)", placeholder: "e.g. 130", min: 60, max: 250 },
    ],
    calculate: (v) => (v.ankle && v.brachial) ? { result: abiInterpret(v.ankle / v.brachial), label: `ABI = ${(v.ankle / v.brachial).toFixed(2)}`, note: "Use higher of 2 brachial pressures. Use higher of dorsalis pedis and posterior tibial pressures per side. Reference: AHA/ACC PAD Guidelines 2016." } : null,
  },
  {
    id: "ivc_ci", title: "IVC Collapsibility Index (IVC-CI)", subtitle: "Volume status / CVP estimation (POCUS)",
    category: "Venous / POCUS", premium: false,
    fields: [
      { key: "max_cm", label: "IVC Max Diameter (cm, expiration)", placeholder: "e.g. 2.1", min: 0.5, max: 4 },
      { key: "min_cm", label: "IVC Min Diameter (cm, inspiration)", placeholder: "e.g. 0.9", min: 0, max: 4 },
    ],
    calculate: (v) => (v.max_cm) ? { result: ivcCi(v.max_cm, v.min_cm || 0), label: "IVC Collapsibility Index", note: "Measure 2 cm from RA junction, subcostal view. Spontaneously breathing patients. Mechanically ventilated: use distensibility index instead. Reference: ACEP POCUS Guidelines 2016." } : null,
  },
  {
    id: "carotid_stenosis", title: "Carotid Stenosis Grading (ICA)", subtitle: "NASCET/SRU velocity criteria for ICA stenosis",
    category: "Carotid / Cerebrovascular", premium: false,
    fields: [
      { key: "psv", label: "ICA PSV (cm/s)", placeholder: "e.g. 240", min: 20, max: 600 },
      { key: "edv", label: "ICA EDV (cm/s)", placeholder: "e.g. 110", min: 0, max: 300 },
      { key: "ica_cca_ratio", label: "ICA/CCA PSV Ratio", placeholder: "e.g. 4.2", min: 0, max: 20 },
    ],
    calculate: (v) => v.psv ? { result: carotidStenosis(v.psv, v.edv || 0, v.ica_cca_ratio || 0), label: "Carotid Stenosis Grade", note: "PSV ≥230 cm/s, EDV ≥100 cm/s, or ICA/CCA ratio ≥4.0 each independently suggest ≥70% stenosis. Reference: SRU Consensus 2003." } : null,
  },
  {
    id: "dvt_wells", title: "DVT Pre-test Probability (Wells Score)", subtitle: "Lower extremity DVT clinical probability",
    category: "Venous / POCUS", premium: true,
    fields: [
      { key: "active_cancer", label: "Active cancer (0 or 1)", placeholder: "0 = No, 1 = Yes", min: 0, max: 1 },
      { key: "paralysis", label: "Paralysis/paresis/plaster (0 or 1)", placeholder: "0 = No, 1 = Yes", min: 0, max: 1 },
      { key: "bedridden", label: "Bedridden >3 days or surgery <12 wk (0 or 1)", placeholder: "0 = No, 1 = Yes", min: 0, max: 1 },
      { key: "tenderness", label: "Localized tenderness along deep veins (0 or 1)", placeholder: "0 = No, 1 = Yes", min: 0, max: 1 },
      { key: "entire_leg", label: "Entire leg swollen (0 or 1)", placeholder: "0 = No, 1 = Yes", min: 0, max: 1 },
      { key: "calf_diff", label: "Calf swelling >3 cm vs. asymptomatic (0 or 1)", placeholder: "0 = No, 1 = Yes", min: 0, max: 1 },
      { key: "pitting", label: "Pitting edema (symptomatic leg only) (0 or 1)", placeholder: "0 = No, 1 = Yes", min: 0, max: 1 },
      { key: "collateral", label: "Collateral superficial veins (0 or 1)", placeholder: "0 = No, 1 = Yes", min: 0, max: 1 },
      { key: "alt_dx", label: "Alternative diagnosis as likely or more likely (0 or -2)", placeholder: "0 = No, -2 = Yes", min: -2, max: 0 },
    ],
    calculate: (v) => {
      const score = (v.active_cancer || 0) + (v.paralysis || 0) + (v.bedridden || 0) + (v.tenderness || 0) + (v.entire_leg || 0) + (v.calf_diff || 0) + (v.pitting || 0) + (v.collateral || 0) + (v.alt_dx || 0);
      let prob = score <= 0 ? "Low probability (≤0) — DVT unlikely. Consider D-dimer." : score <= 2 ? `Moderate probability (score ${score}) — Ultrasound recommended.` : `High probability (score ${score}) — Ultrasound and anticoagulation consideration.`;
      return { result: prob, label: `Wells DVT Score = ${score}`, note: "Score ≤0 = low; 1–2 = moderate; ≥3 = high. Reference: Wells PS et al. Lancet 1997." };
    },
  },
];

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "obgyn", label: "OB/Gyn", icon: Baby, calcs: obgynCalcs, badge: "OB · Gyn · Fetal", refs: "ACOG, SMFM, ISUOG, Hadlock 1985, Mari 2000, Snijders 1998" },
  { id: "abdominal", label: "Abdominal", icon: Scan, calcs: abdominalCalcs, badge: "Liver · GB · Spleen", refs: "EASL 2017, WFUMB 2015, Ferraioli 2021" },
  { id: "breast", label: "Breast", icon: Activity, calcs: breastCalcs, badge: "SWE · BI-RADS", refs: "ACR BI-RADS 5th Ed, WFUMB SWE 2017, Berg 2012" },
  { id: "vascular", label: "Vascular", icon: Heart, calcs: vascularCalcs, badge: "ABI · IVC · Carotid · DVT", refs: "AHA/ACC 2016, SRU 2003, Wells 1997" },
] as const;

type TabId = typeof TABS[number]["id"];

// ─── Calculator card component ────────────────────────────────────────────────
function CalcCard({ calc, expanded, onToggle }: { calc: CalcDef; expanded: boolean; onToggle: () => void }) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [result, setResult] = useState<CalcResult>(null);

  const handleInput = (key: string, raw: string) => {
    const num = parseFloat(raw);
    setValues(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  };

  const handleCalculate = () => {
    setResult(calc.calculate(values));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-2">
      <button
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all"
        onClick={onToggle}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}>
          <Calculator className="w-4 h-4 text-[#4ad9e0]" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{calc.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{calc.subtitle}</div>
        </div>
        {calc.premium && (
          <span className="text-xs font-bold text-[#189aa1] bg-[#f0fbfc] border border-[#189aa140] px-2 py-0.5 rounded-full mr-2">Premium</span>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {calc.fields.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{field.label}</label>
                <input
                  type="number"
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                  step="any"
                  onChange={e => handleInput(field.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-[#189aa1]"
                  style={{ "--tw-ring-color": "#189aa1" } as React.CSSProperties}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleCalculate}
            className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
          >
            Calculate
          </button>
          {result && (
            <div className="mt-4 rounded-xl p-4 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
              <div className="text-xs font-bold text-[#189aa1] uppercase tracking-wider mb-1">{result.label}</div>
              <div className="text-base font-bold text-gray-900 mb-2">{result.result}</div>
              {result.note && <div className="text-xs text-gray-500 leading-relaxed">{result.note}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ObGynCalculators() {
  const [activeTab, setActiveTab] = useState<TabId>("obgyn");
  const [expanded, setExpanded] = useState<string | null>(null);

  const tab = TABS.find(t => t.id === activeTab)!;
  const categories = Array.from(new Set(tab.calcs.map(c => c.category)));

  return (
    <Layout>
      {/* Hero header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-8 md:py-10">
          {/* Breadcrumb */}
          <div className="mb-4">
            <Link href="/ultrasound-assist">
              <a className="inline-flex items-center gap-1.5 text-[#4ad9e0] hover:text-white text-sm font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" />
                UltrasoundAssist™
              </a>
            </Link>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Calculator className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">UltrasoundAssist™ · {tab.badge}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                UltrasoundAssist™ Calculators
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Guideline-Based Clinical Calculators</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                OB/Gyn biometrics, liver SWE/UDFF, breast SWE stiffness, and vascular indices — based on ACOG, EASL, ACR, and AHA/ACC guidelines.
              </p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-6 bg-white/10 rounded-xl p-1 w-fit">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id); setExpanded(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === t.id
                      ? "bg-[#189aa1] text-white shadow"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-3">
        {/* Disclaimer */}
        <div className="rounded-xl p-3 border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">Clinical Use Disclaimer:</span> These calculators are for educational reference only. Always correlate with clinical context. Results do not replace individualized clinical judgment or formal reporting.
          </p>
        </div>

        {/* Calculators by category */}
        {categories.map(cat => (
          <div key={cat}>
            <div className="text-xs font-bold text-[#189aa1] uppercase tracking-wider px-1 mb-2">{cat}</div>
            {tab.calcs.filter(c => c.category === cat).map(calc => (
              <CalcCard
                key={calc.id}
                calc={calc}
                expanded={expanded === calc.id}
                onToggle={() => setExpanded(expanded === calc.id ? null : calc.id)}
              />
            ))}
          </div>
        ))}

        <div className="text-xs text-gray-400 px-1 mt-4">
          References: {tab.refs}
        </div>
      </div>
    </Layout>
  );
}
