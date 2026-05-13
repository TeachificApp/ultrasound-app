/*
  iHeartEcho™ — GuidelinesAssist™
  Fast-lookup guideline-based quick-reference for experienced sonographers & cardiologists
  Brand: Teal #189aa1, Aqua #4ad9e0
  Layout: Topic cards → accordion sub-topics → measurement tables
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePremium } from "@/hooks/usePremium";
import { getLoginUrl } from "@/const";
import {
  Search, ChevronDown, ChevronRight, ExternalLink,
  Activity, Heart, Baby, Users, Zap, BarChart3,
  Stethoscope, Microscope, Shield, Wind, Droplets,
  Calculator, BookOpen, ArrowRight, Clock, Star,
  AlertCircle, CheckCircle2, Info, Filter, X,
  Printer, Lock
} from "lucide-react";

const BRAND = "#189aa1";
const BRAND_LIGHT = "#f0fbfc";

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity = "normal" | "mild" | "moderate" | "severe" | "header" | "info" | "note";
type TableRow = {
  parameter: string;
  normal?: string;
  mild?: string;
  moderate?: string;
  severe?: string;
  unit?: string;
  note?: string;
  type?: Severity;
};
type SubTopic = {
  id: string;
  title: string;
  description?: string;
  tables?: { title: string; rows: TableRow[] }[];
  bullets?: string[];
  algorithm?: string[];
  links?: { label: string; path: string; type: "calculator" | "navigator" | "scancoach" }[];
};
type Guideline = {
  id: string;
  icon: any;
  title: string;
  shortTitle: string;
  year: string;
  badge: string;
  description: string;
  isNew?: boolean;
  subTopics: SubTopic[];
};

// ─── Guideline Data ────────────────────────────────────────────────────────────
const guidelines: Guideline[] = [
  // ── 1. LV Diastolic Function ──────────────────────────────────────────────
  {
    id: "diastology",
    icon: Activity,
    title: "LV Diastolic Function & HFpEF",
    shortTitle: "Diastology",
    year: "Current Guidelines",
    badge: "LV Diastolic Function",
    isNew: false,
    description: "Evaluation of LV diastolic function and HFpEF diagnosis using current guideline-based algorithms.",
    subTopics: [
      {
        id: "grading",
        title: "Diastolic Dysfunction Grading",
        description: "Four-variable algorithm using E/e', TR velocity, LAVI, and E/A ratio.",
        tables: [
          {
            title: "Key Parameters & Cut-offs",
            rows: [
              { type: "header", parameter: "Variable", normal: "Normal / Grade I", mild: "Grade II", moderate: "Grade III", severe: "Indeterminate" },
              { parameter: "E/A ratio", normal: "< 0.8 or > 2.0*", mild: "0.8–2.0", moderate: "0.8–2.0", severe: "0.8–2.0" },
              { parameter: "Average E/e'", normal: "≤ 14", mild: "< 9 (low LAP)", moderate: "9–14 (indeterminate)", severe: "≥ 15 (elevated LAP)" },
              { parameter: "TR Vmax (m/s)", normal: "≤ 2.8", mild: "≤ 2.8", moderate: "2.9–3.4", severe: "> 3.4" },
              { parameter: "LAVI (mL/m²)", normal: "≤ 34", mild: "35–41", moderate: "42–48", severe: "≥ 49" },
              { type: "note", parameter: "* E/A < 0.8 with E < 50 cm/s = Grade I; E/A > 2.0 = Grade III (restrictive). Grade II requires ≥ 2 of 4 positive variables." },
            ],
          },
          {
            title: "Grading Algorithm Summary",
            rows: [
              { type: "header", parameter: "Grade", normal: "Pattern", mild: "LAP", moderate: "E/A", severe: "Criteria" },
              { parameter: "Grade I", normal: "Impaired relaxation", mild: "Normal", moderate: "< 0.8", severe: "E < 50 cm/s" },
              { parameter: "Grade II", normal: "Pseudonormal", mild: "Elevated", moderate: "0.8–2.0", severe: "≥ 2 of 4 variables positive" },
              { parameter: "Grade III", normal: "Restrictive", mild: "Elevated", moderate: "> 2.0", severe: "E > 50 cm/s; reversibility distinguishes IIIa/IIIb" },
              { parameter: "Indeterminate", normal: "—", mild: "Uncertain", moderate: "0.8–2.0", severe: "< 2 of 4 variables positive" },
            ],
          },
        ],
        links: [
          { label: "Diastology Calculator", path: "/echoassist#engine-diastologyassist", type: "calculator" },
          { label: "Diastolic Navigator", path: "/diastolic", type: "navigator" },
          { label: "Diastolic ScanCoach", path: "/scan-coach?tab=diastolic", type: "scancoach" },
        ],
      },
      {
        id: "hfpef",
        title: "HFpEF Diagnosis",
        description: "H2FPEF Score and guideline-based diagnostic criteria for HFpEF.",
        tables: [
          {
            title: "H2FPEF Score",
            rows: [
              { type: "header", parameter: "Variable", normal: "Criterion", mild: "Points" },
              { parameter: "Heavy", normal: "BMI > 30 kg/m²", mild: "2" },
              { parameter: "Hypertensive", normal: "≥ 2 antihypertensive medications", mild: "1" },
              { parameter: "Atrial Fibrillation", normal: "Paroxysmal or persistent AF", mild: "3" },
              { parameter: "Pulmonary Hypertension", normal: "PASP > 35 mmHg on echo", mild: "1" },
              { parameter: "Elder", normal: "Age > 60 years", mild: "1" },
              { parameter: "Filling Pressure", normal: "E/e' > 9", mild: "1" },
              { type: "note", parameter: "Score 0–1: Low probability HFpEF. Score 2–5: Intermediate (exercise testing). Score 6–9: High probability HFpEF." },
            ],
          },
        ],
        links: [
          { label: "Diastology Calculator", path: "/echoassist#engine-diastologyassist", type: "calculator" },
        ],
      },
      {
        id: "tissue-doppler",
        title: "Tissue Doppler & E/e' Reference Values",
        tables: [
          {
            title: "TDI e' Normal Values",
            rows: [
              { type: "header", parameter: "Site", normal: "Normal", mild: "Borderline", moderate: "Abnormal" },
              { parameter: "Septal e'", normal: "≥ 7 cm/s", mild: "5–6 cm/s", moderate: "< 5 cm/s" },
              { parameter: "Lateral e'", normal: "≥ 10 cm/s", mild: "8–9 cm/s", moderate: "< 8 cm/s" },
              { parameter: "Average E/e'", normal: "< 9", mild: "9–14", moderate: "≥ 15 (elevated LAP)" },
            ],
          },
        ],
      },
    ],
  },

  // ── 2. Right Heart & PH ───────────────────────────────────────────────────
  {
    id: "right-heart",
    icon: Wind,
    title: "Right Heart & Pulmonary Hypertension",
    shortTitle: "Right Heart / PH",
    year: "Current Guidelines",
    badge: "Right Heart / PH",
    isNew: false,
    description: "Comprehensive RV assessment, RA size, and pulmonary hypertension probability grading.",
    subTopics: [
      {
        id: "rv-size",
        title: "RV Size",
        tables: [
          {
            title: "RV Linear Dimensions",
            rows: [
              { type: "header", parameter: "Measurement", normal: "Normal", mild: "Mildly Dilated", moderate: "Moderately Dilated", severe: "Severely Dilated" },
              { parameter: "RV basal diameter (A4C)", normal: "≤ 41 mm", mild: "42–48 mm", moderate: "49–54 mm", severe: "> 54 mm" },
              { parameter: "RV mid-cavity (A4C)", normal: "≤ 35 mm", mild: "36–41 mm", moderate: "42–48 mm", severe: "> 48 mm" },
              { parameter: "RVOT prox (PLAX)", normal: "< 33 mm", mild: "33–38 mm", moderate: "38–43 mm", severe: "> 43 mm" },
              { parameter: "RVOT distal (PSAX)", normal: "< 27 mm", mild: "27–33 mm", moderate: "33–38 mm", severe: "> 38 mm" },
              { parameter: "RV length (A4C)", normal: "≤ 83 mm", mild: "84–89 mm", moderate: "90–95 mm", severe: "> 95 mm" },
            ],
          },
          {
            title: "RA Size",
            rows: [
              { type: "header", parameter: "Measurement", normal: "Normal", mild: "Mildly Enlarged", moderate: "Moderately Enlarged", severe: "Severely Enlarged" },
              { parameter: "RA area (A4C)", normal: "≤ 18 cm²", mild: "19–21 cm²", moderate: "22–25 cm²", severe: "> 25 cm²" },
              { parameter: "RA volume index", normal: "≤ 33 mL/m²", mild: "34–41 mL/m²", moderate: "42–48 mL/m²", severe: "> 48 mL/m²" },
            ],
          },
        ],
        links: [
          { label: "RV Function Calculator", path: "/echoassist#engine-rvfunction", type: "calculator" },
          { label: "Pulmonary HTN Navigator", path: "/pulm-htn", type: "navigator" },
        ],
      },
      {
        id: "rv-function",
        title: "RV Systolic Function",
        tables: [
          {
            title: "RV Function Parameters",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Normal", mild: "Mildly Reduced", moderate: "Moderately Reduced", severe: "Severely Reduced" },
              { parameter: "TAPSE (mm)", normal: "≥ 17", mild: "12–16", moderate: "—", severe: "< 12" },
              { parameter: "S' TDI (cm/s)", normal: "≥ 9.5", mild: "6–9.4", moderate: "—", severe: "< 6" },
              { parameter: "FAC (%)", normal: "≥ 35", mild: "25–34", moderate: "18–24", severe: "< 18" },
              { parameter: "RV GLS (%)", normal: "≤ -20", mild: "-15 to -19", moderate: "-10 to -14", severe: "> -10" },
              { parameter: "RIMP (PW)", normal: "≤ 0.40", mild: "0.41–0.50", moderate: "—", severe: "> 0.50" },
              { parameter: "RIMP (TDI)", normal: "≤ 0.54", mild: "0.55–0.65", moderate: "—", severe: "> 0.65" },
              { parameter: "3D RVEF (%)", normal: "≥ 45", mild: "36–44", moderate: "26–35", severe: "< 26" },
            ],
          },
        ],
        links: [
          { label: "RV Function Calculator", path: "/echoassist#engine-rvfunction", type: "calculator" },
          { label: "Pulmonary HTN Navigator", path: "/pulm-htn", type: "navigator" },
          { label: "Adult TTE ScanCoach", path: "/scan-coach?tab=tte", type: "scancoach" },
        ],
      },
      {
        id: "ph-probability",
        title: "Pulmonary Hypertension Probability",
        description: "Guideline-based three-tier PH probability classification based on TR velocity and additional signs.",
        tables: [
          {
            title: "PH Probability Classification",
            rows: [
              { type: "header", parameter: "TR Vmax", normal: "Additional Signs", mild: "PH Probability" },
              { parameter: "≤ 2.8 m/s", normal: "None", mild: "Low" },
              { parameter: "≤ 2.8 m/s", normal: "Present", mild: "Intermediate" },
              { parameter: "2.9–3.4 m/s", normal: "None", mild: "Intermediate" },
              { parameter: "2.9–3.4 m/s", normal: "Present", mild: "High" },
              { parameter: "> 3.4 m/s", normal: "Any", mild: "High" },
              { type: "note", parameter: "Additional signs: RV/LV basal ratio > 1.0, flattening of IVS, RVOT acceleration time < 105 ms, early systolic notching, PA dilation ≥ 25 mm, RA enlargement, IVC dilation." },
            ],
          },
          {
            title: "PASP Estimation",
            rows: [
              { type: "header", parameter: "Formula", normal: "Value", mild: "Notes" },
              { parameter: "PASP", normal: "4 × (TR Vmax)² + RAP", mild: "Simplified Bernoulli + RAP" },
              { parameter: "RAP (IVC ≤ 21 mm, >50% collapse)", normal: "3 mmHg (range 0–5)", mild: "Low RAP" },
              { parameter: "RAP (IVC > 21 mm, <50% collapse)", normal: "15 mmHg (range 10–20)", mild: "High RAP" },
              { parameter: "RAP (indeterminate)", normal: "8 mmHg (range 5–10)", mild: "Intermediate" },
            ],
          },
        ],
        links: [
          { label: "PA Pressure Calculator", path: "/echoassist#engine-papressure", type: "calculator" },
          { label: "Pulmonary HTN Navigator", path: "/pulm-htn", type: "navigator" },
        ],
      },
    ],
  },

  // ── 3. Chamber Quantification ─────────────────────────────────────────────
  {
    id: "chambers",
    icon: Heart,
    title: "Cardiac Chamber Quantification",
    shortTitle: "Chamber Quant",
    year: "Current Guidelines",
    badge: "Chamber Quantification",
    description: "LV dimensions, volumes, EF, LA size, and aortic root measurements in adults.",
    subTopics: [
      {
        id: "lv-dimensions",
        title: "LV Linear Dimensions",
        tables: [
          {
            title: "LV Linear Measurements (2D-guided M-mode)",
            rows: [
              { type: "header", parameter: "Measurement", normal: "Normal (Men)", mild: "Normal (Women)", moderate: "Mildly Abnormal", severe: "Moderately/Severely Abnormal" },
              { parameter: "LVIDd (mm)", normal: "42–58", mild: "38–52", moderate: "59–63 / 53–57", severe: "> 63 / > 57" },
              { parameter: "LVIDs (mm)", normal: "25–40", mild: "22–35", moderate: "41–45 / 36–40", severe: "> 45 / > 40" },
              { parameter: "IVSd (mm)", normal: "6–10", mild: "6–9", moderate: "11–13 / 10–12", severe: "> 13 / > 12" },
              { parameter: "LVPWd (mm)", normal: "6–10", mild: "6–9", moderate: "11–13 / 10–12", severe: "> 13 / > 12" },
              { parameter: "RWT", normal: "≤ 0.42", mild: "≤ 0.42", moderate: "0.43–0.50", severe: "> 0.50" },
            ],
          },
        ],
        links: [
          { label: "LV Function Calculator", path: "/echoassist#engine-lvfunction", type: "calculator" },
        ],
      },
      {
        id: "lv-volumes-ef",
        title: "LV Volumes & EF",
        tables: [
          {
            title: "LV Volumes (Biplane Simpson's Method)",
            rows: [
              { type: "header", parameter: "Measurement", normal: "Normal (Men)", mild: "Normal (Women)", moderate: "Mildly Abnormal", severe: "Severely Abnormal" },
              { parameter: "LVEDV (mL)", normal: "62–150", mild: "46–106", moderate: "151–213 / 107–151", severe: "> 213 / > 151" },
              { parameter: "LVESV (mL)", normal: "21–61", mild: "14–42", moderate: "62–88 / 43–61", severe: "> 88 / > 61" },
              { parameter: "LVEDV index (mL/m²)", normal: "34–74", mild: "29–61", moderate: "75–89 / 62–70", severe: "> 89 / > 70" },
            ],
          },
          {
            title: "LV Ejection Fraction",
            rows: [
              { type: "header", parameter: "Category", normal: "EF Range", mild: "Classification" },
              { parameter: "Normal", normal: "≥ 52% (men) / ≥ 54% (women)", mild: "Normal systolic function" },
              { parameter: "Mildly reduced", normal: "41–51% (men) / 41–53% (women)", mild: "Mildly reduced EF (HFmrEF)" },
              { parameter: "Moderately reduced", normal: "30–40%", mild: "Moderately reduced EF" },
              { parameter: "Severely reduced", normal: "< 30%", mild: "Severely reduced EF (HFrEF)" },
            ],
          },
        ],
        links: [
          { label: "LV Function Calculator", path: "/echoassist#engine-lvfunction", type: "calculator" },
          { label: "Adult TTE Navigator", path: "/tte", type: "navigator" },
        ],
      },
      {
        id: "la-size",
        title: "LA Size",
        tables: [
          {
            title: "LA Volume Index",
            rows: [
              { type: "header", parameter: "Category", normal: "LAVI (mL/m²)", mild: "Clinical Significance" },
              { parameter: "Normal", normal: "≤ 34", mild: "Normal LA size" },
              { parameter: "Mildly enlarged", normal: "35–41", mild: "Mild LA dilation" },
              { parameter: "Moderately enlarged", normal: "42–48", mild: "Moderate LA dilation" },
              { parameter: "Severely enlarged", normal: "≥ 49", mild: "Severe LA dilation" },
            ],
          },
        ],
      },
      {
        id: "aorta",
        title: "Aortic Root & Ascending Aorta",
        tables: [
          {
            title: "Aortic Dimensions",
            rows: [
              { type: "header", parameter: "Segment", normal: "Normal (Men)", mild: "Normal (Women)", moderate: "Mildly Dilated", severe: "Moderately/Severely Dilated" },
              { parameter: "Aortic annulus (mm)", normal: "26 ± 3", mild: "23 ± 2", moderate: "—", severe: "—" },
              { parameter: "Sinuses of Valsalva (mm)", normal: "≤ 40", mild: "≤ 36", moderate: "41–44 / 37–40", severe: "> 44 / > 40" },
              { parameter: "Sinotubular junction (mm)", normal: "≤ 37", mild: "≤ 33", moderate: "38–41 / 34–37", severe: "> 41 / > 37" },
              { parameter: "Ascending aorta (mm)", normal: "≤ 40", mild: "≤ 37", moderate: "41–44 / 38–41", severe: "> 44 / > 41" },
            ],
          },
        ],
      },
    ],
  },

  // ── 4. Valvular Disease ───────────────────────────────────────────────────
  {
    id: "valves",
    icon: Stethoscope,
    title: "Valvular Heart Disease",
    shortTitle: "Valves",
    year: "Current Guidelines",
    badge: "Valvular Disease",
    description: "Severity grading for AS, AR, MR, TR, and MS using integrated multi-parameter approach.",
    subTopics: [
      {
        id: "aortic-stenosis",
        title: "Aortic Stenosis",
        tables: [
          {
            title: "AS Severity Classification",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Mild", mild: "Moderate", moderate: "Severe", severe: "Very Severe" },
              { parameter: "Peak velocity (m/s)", normal: "2.0–2.9", mild: "3.0–3.9", moderate: "≥ 4.0", severe: "≥ 5.0" },
              { parameter: "Mean gradient (mmHg)", normal: "< 20", mild: "20–39", moderate: "≥ 40", severe: "≥ 60" },
              { parameter: "AVA (cm²)", normal: "> 1.5", mild: "1.0–1.5", moderate: "< 1.0", severe: "< 0.6" },
              { parameter: "AVAi (cm²/m²)", normal: "> 0.85", mild: "0.60–0.85", moderate: "< 0.60", severe: "< 0.35" },
              { parameter: "Velocity ratio", normal: "> 0.50", mild: "0.25–0.50", moderate: "< 0.25", severe: "—" },
              { type: "note", parameter: "Low-flow Low-gradient Severe AS: AVA < 1.0 cm², mean PG < 40 mmHg. Paradoxical LFLG: EF ≥ 50%, SVI < 35 mL/m². Classic LFLG: EF < 50%." },
            ],
          },
        ],
        links: [
          { label: "AS Calculator", path: "/echoassist#engine-aorticstenosis", type: "calculator" },
          { label: "Adult TTE Navigator", path: "/tte", type: "navigator" },
        ],
      },
      {
        id: "mitral-regurgitation",
        title: "Mitral Regurgitation",
        tables: [
          {
            title: "MR Severity (Primary / Secondary)",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Mild", mild: "Moderate", moderate: "Severe (Primary)", severe: "Severe (Secondary)" },
              { parameter: "EROA (cm²)", normal: "< 0.20", mild: "0.20–0.39", moderate: "≥ 0.40", severe: "≥ 0.20" },
              { parameter: "Regurgitant volume (mL)", normal: "< 30", mild: "30–59", moderate: "≥ 60", severe: "≥ 30" },
              { parameter: "Regurgitant fraction (%)", normal: "< 30", mild: "30–49", moderate: "≥ 50", severe: "≥ 50" },
              { parameter: "Vena contracta (mm)", normal: "< 3", mild: "3–6.9", moderate: "≥ 7", severe: "≥ 7" },
              { parameter: "PISA radius (mm)", normal: "< 4 (Nyquist 40)", mild: "4–9.9", moderate: "≥ 10", severe: "≥ 10" },
              { type: "note", parameter: "Secondary (functional) MR: lower thresholds for severity — EROA ≥ 0.20 cm² and RVol ≥ 30 mL indicate hemodynamically significant MR." },
            ],
          },
        ],
        links: [
          { label: "MR Calculator", path: "/echoassist#engine-mitralregurgitation", type: "calculator" },
        ],
      },
      {
        id: "tricuspid-regurgitation",
        title: "Tricuspid Regurgitation",
        tables: [
          {
            title: "TR Severity Classification",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Mild", mild: "Moderate", moderate: "Severe", severe: "Massive/Torrential" },
              { parameter: "Vena contracta (mm)", normal: "< 3", mild: "3–6.9", moderate: "≥ 7", severe: "—" },
              { parameter: "EROA (cm²)", normal: "< 0.20", mild: "0.20–0.39", moderate: "≥ 0.40", severe: "≥ 0.75" },
              { parameter: "Regurgitant volume (mL)", normal: "< 30", mild: "30–44", moderate: "≥ 45", severe: "≥ 75" },
              { parameter: "PISA radius (mm)", normal: "< 5", mild: "5–9", moderate: "≥ 9", severe: "—" },
              { parameter: "Hepatic vein flow", normal: "Systolic dominance", mild: "Systolic blunting", moderate: "Systolic reversal", severe: "Systolic reversal" },
            ],
          },
        ],
        links: [
          { label: "TR Calculator", path: "/echoassist#engine-tricuspidregurgitation", type: "calculator" },
        ],
      },
      {
        id: "aortic-regurgitation",
        title: "Aortic Regurgitation",
        tables: [
          {
            title: "AR Severity Classification",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Mild", mild: "Moderate", moderate: "Severe" },
              { parameter: "Vena contracta (mm)", normal: "< 3", mild: "3–5.9", moderate: "≥ 6" },
              { parameter: "EROA (cm²)", normal: "< 0.10", mild: "0.10–0.29", moderate: "≥ 0.30" },
              { parameter: "Regurgitant volume (mL)", normal: "< 30", mild: "30–59", moderate: "≥ 60" },
              { parameter: "Regurgitant fraction (%)", normal: "< 30", mild: "30–49", moderate: "≥ 50" },
              { parameter: "PHT (ms)", normal: "> 500", mild: "200–500", moderate: "< 200" },
              { parameter: "Pressure half-time (ms)", normal: "> 500", mild: "200–500", moderate: "< 200" },
              { type: "note", parameter: "Holodiastolic flow reversal in descending aorta (end-diastolic velocity > 20 cm/s) supports severe AR." },
            ],
          },
        ],
        links: [
          { label: "AR Calculator", path: "/echoassist#engine-aorticregurgitation", type: "calculator" },
        ],
      },
      {
        id: "mitral-stenosis",
        title: "Mitral Stenosis",
        tables: [
          {
            title: "MS Severity Classification",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Mild", mild: "Moderate", moderate: "Severe" },
              { parameter: "MVA — PHT (cm²)", normal: "> 1.5", mild: "1.0–1.5", moderate: "< 1.0" },
              { parameter: "MVA — planimetry (cm²)", normal: "> 1.5", mild: "1.0–1.5", moderate: "< 1.0" },
              { parameter: "Mean gradient (mmHg)", normal: "< 5", mild: "5–10", moderate: "> 10" },
              { parameter: "PASP (mmHg)", normal: "< 30", mild: "30–50", moderate: "> 50" },
              { parameter: "Wilkins score", normal: "≤ 8 (favorable for BMV)", mild: "9–11", moderate: "> 11 (unfavorable)" },
            ],
          },
        ],
      },
    ],
  },

  // ── 5. Strain Imaging ─────────────────────────────────────────────────────
  {
    id: "strain",
    icon: BarChart3,
    title: "Clinical Applications of Strain",
    shortTitle: "Strain",
    year: "Current Guidelines",
    badge: "LV Systolic Function",
    isNew: false,
    description: "LV GLS, RV strain, LA strain, and cardiotoxicity monitoring thresholds.",
    subTopics: [
      {
        id: "lv-gls",
        title: "LV Global Longitudinal Strain (GLS)",
        tables: [
          {
            title: "LV GLS Reference Values",
            rows: [
              { type: "header", parameter: "Category", normal: "GLS Value", mild: "Interpretation" },
              { parameter: "Normal", normal: "≤ -20%", mild: "Normal LV longitudinal function" },
              { parameter: "Mildly reduced", normal: "-15% to -19%", mild: "Mildly reduced — consider clinical context" },
              { parameter: "Moderately reduced", normal: "-10% to -14%", mild: "Moderately reduced" },
              { parameter: "Severely reduced", normal: "> -10%", mild: "Severely reduced longitudinal function" },
              { type: "note", parameter: "More negative = better function. GLS is vendor-dependent; use same vendor for serial comparisons. Cardiotoxicity threshold: > 15% relative reduction from baseline." },
            ],
          },
          {
            title: "Cardiotoxicity Monitoring",
            rows: [
              { type: "header", parameter: "Finding", normal: "Threshold", mild: "Action" },
              { parameter: "EF drop", normal: "≥ 10% absolute drop to < 53%", mild: "Cardiotoxicity — consider cardiology referral" },
              { parameter: "EF borderline drop", normal: "5–9% absolute drop to < 53%", mild: "Repeat echo in 2–3 weeks" },
              { parameter: "GLS relative reduction", normal: "> 15% relative reduction from baseline", mild: "Early cardiotoxicity marker — monitor closely" },
              { parameter: "GLS absolute threshold", normal: "< -18% (> -18% = concern)", mild: "Subclinical dysfunction" },
            ],
          },
        ],
        links: [
          { label: "Strain Navigator", path: "/strain", type: "navigator" },
          { label: "Strain ScanCoach", path: "/strain-scan-coach", type: "scancoach" },
        ],
      },
      {
        id: "rv-strain",
        title: "RV Free Wall Strain",
        tables: [
          {
            title: "RV Strain Reference Values",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Normal", mild: "Abnormal" },
              { parameter: "RV free wall strain", normal: "≤ -20%", mild: "> -20% (less negative)" },
              { parameter: "RV global strain", normal: "≤ -17%", mild: "> -17%" },
              { type: "note", parameter: "RV free wall strain is more reproducible than global RV strain. Reduced RV strain is associated with worse outcomes in PH, HF, and ARVC." },
            ],
          },
        ],
        links: [
          { label: "Strain Navigator", path: "/strain", type: "navigator" },
        ],
      },
      {
        id: "la-strain",
        title: "LA Strain",
        tables: [
          {
            title: "LA Strain Reference Values",
            rows: [
              { type: "header", parameter: "Phase", normal: "Normal", mild: "Abnormal" },
              { parameter: "LA reservoir strain (LASr)", normal: "≥ 23%", mild: "< 23%" },
              { parameter: "LA conduit strain (LAScd)", normal: "≥ 12%", mild: "< 12%" },
              { parameter: "LA contractile strain (LASct)", normal: "≥ 11%", mild: "< 11%" },
              { type: "note", parameter: "LASr < 23% is the most robust marker of elevated LV filling pressure and is used in HFpEF diagnosis." },
            ],
          },
        ],
      },
    ],
  },

  // ── 6. Fetal Echocardiography ─────────────────────────────────────────────
  {
    id: "fetal",
    icon: Baby,
    title: "Fetal Echocardiography",
    shortTitle: "Fetal Echo",
    year: "Current Guidelines",
    badge: "Fetal Echocardiography",
    description: "Performance standards, normal values, and assessment criteria for fetal cardiac evaluation.",
    subTopics: [
      {
        id: "fetal-normal",
        title: "Normal Fetal Cardiac Values",
        tables: [
          {
            title: "Fetal Cardiac Biometry (20 weeks)",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Normal Range", mild: "Notes" },
              { parameter: "Cardiac axis", normal: "45° ± 20° (25°–65°)", mild: "Measured from midline to LV axis in 4-chamber view" },
              { parameter: "Cardiothoracic ratio", normal: "< 0.35 (area ratio)", mild: "Cardiomegaly if > 0.35" },
              { parameter: "RV/LV ratio", normal: "Approximately 1:1", mild: "RV slightly larger is normal in fetus" },
              { parameter: "Foramen ovale", normal: "Open — right to left flow", mild: "Premature closure is pathological" },
              { parameter: "Ductus arteriosus", normal: "Patent — right to left flow", mild: "Constriction: PI < 1.9 or absent/reversed diastolic flow" },
            ],
          },
          {
            title: "Fetal MPI / Tei Index",
            rows: [
              { type: "header", parameter: "Chamber", normal: "Normal MPI", mild: "Abnormal" },
              { parameter: "LV MPI (Tei Index)", normal: "≤ 0.53", mild: "> 0.53" },
              { parameter: "RV MPI (Tei Index)", normal: "≤ 0.55", mild: "> 0.55" },
              { type: "note", parameter: "MPI = (ICT + IRT) / ET. Elevated MPI indicates global ventricular dysfunction. Use pulsed Doppler at AV/SL valve level for single-beat technique." },
            ],
          },
        ],
        links: [
          { label: "Fetal Echo Navigator", path: "/fetal", type: "navigator" },
          { label: "FetalEchoAssist™", path: "/fetal-echo-assist", type: "calculator" },
          { label: "Fetal ScanCoach", path: "/scan-coach?tab=fetal", type: "scancoach" },
        ],
      },
      {
        id: "fetal-zscore",
        title: "Z-Score Interpretation",
        tables: [
          {
            title: "Z-Score Reference",
            rows: [
              { type: "header", parameter: "Z-Score", normal: "Interpretation", mild: "Action" },
              { parameter: "> +2", normal: "Dilated / enlarged", mild: "Consider pathological — correlate clinically" },
              { parameter: "-2 to +2", normal: "Normal range", mild: "Within normal limits" },
              { parameter: "< -2", normal: "Hypoplastic / small", mild: "Consider pathological — correlate clinically" },
              { parameter: "< -3", normal: "Severely hypoplastic", mild: "High likelihood of pathology" },
            ],
          },
        ],
        links: [
          { label: "FetalEchoAssist™ Z-scores", path: "/fetal-echo-assist", type: "calculator" },
        ],
      },
    ],
  },

  // ── 7. Pediatric Echo ─────────────────────────────────────────────────────
  {
    id: "pediatric",
    icon: Users,
    title: "Pediatric Echocardiography",
    shortTitle: "Pediatric Echo",
    year: "Current Guidelines",
    badge: "Congenital Heart",
    description: "CHD assessment, BSA-indexed Z-scores, and Qp/Qs shunt estimation.",
    subTopics: [
      {
        id: "shunt-calc",
        title: "Shunt Estimation (Qp/Qs)",
        tables: [
          {
            title: "Qp/Qs Interpretation",
            rows: [
              { type: "header", parameter: "Qp/Qs Ratio", normal: "Interpretation", mild: "Clinical Significance" },
              { parameter: "< 1.0", normal: "Net right-to-left shunt", mild: "Cyanosis — consider Eisenmenger" },
              { parameter: "1.0", normal: "Balanced / no net shunt", mild: "Balanced circulation" },
              { parameter: "1.0–1.5", normal: "Small left-to-right shunt", mild: "Hemodynamically insignificant" },
              { parameter: "1.5–2.0", normal: "Moderate left-to-right shunt", mild: "Consider intervention if symptomatic" },
              { parameter: "> 2.0", normal: "Large left-to-right shunt", mild: "Significant volume overload — intervention usually indicated" },
              { type: "note", parameter: "Qp/Qs = (LVOT VTI × LVOT area) / (RVOT VTI × RVOT area). Assumes no valve regurgitation." },
            ],
          },
        ],
        links: [
          { label: "Pediatric Navigator", path: "/pediatric", type: "navigator" },
          { label: "PediatricEchoAssist™", path: "/pediatric-echo-assist", type: "calculator" },
        ],
      },
    ],
  },

  // ── 8. POCUS ──────────────────────────────────────────────────────────────
  {
    id: "pocus",
    icon: Shield,
    title: "Cardiac POCUS",
    shortTitle: "POCUS",
    year: "Current Guidelines",
    badge: "POCUS",
    description: "Cardiac point-of-care ultrasound nomenclature, IVC assessment, and rapid assessment protocols.",
    subTopics: [
      {
        id: "ivc-assessment",
        title: "IVC Assessment & RAP Estimation",
        tables: [
          {
            title: "IVC-Based RAP Estimation",
            rows: [
              { type: "header", parameter: "IVC Diameter", normal: "Collapsibility", mild: "Estimated RAP", moderate: "Range" },
              { parameter: "≤ 21 mm", normal: "> 50%", mild: "3 mmHg", moderate: "0–5 mmHg" },
              { parameter: "> 21 mm", normal: "< 50%", mild: "15 mmHg", moderate: "10–20 mmHg" },
              { parameter: "Indeterminate", normal: "Any other combination", mild: "8 mmHg", moderate: "5–10 mmHg" },
            ],
          },
        ],
        links: [
          { label: "Cardiac POCUS Navigator", path: "/pocus-cardiac", type: "navigator" },
          { label: "Cardiac POCUS ScanCoach", path: "/pocus-cardiac-scan-coach", type: "scancoach" },
        ],
      },
      {
        id: "pericardial-effusion",
        title: "Pericardial Effusion & Tamponade",
        tables: [
          {
            title: "Pericardial Effusion Size",
            rows: [
              { type: "header", parameter: "Size", normal: "Echo-free Space", mild: "Clinical Significance" },
              { parameter: "Trivial / trace", normal: "< 5 mm (systole only)", mild: "Physiological" },
              { parameter: "Small", normal: "< 10 mm", mild: "Usually benign" },
              { parameter: "Moderate", normal: "10–20 mm", mild: "Monitor clinically" },
              { parameter: "Large", normal: "> 20 mm", mild: "High risk — assess for tamponade" },
            ],
          },
          {
            title: "Tamponade Signs",
            rows: [
              { type: "header", parameter: "Sign", normal: "Finding", mild: "Sensitivity / Specificity" },
              { parameter: "RA collapse", normal: "Duration > 1/3 of systole", mild: "High specificity" },
              { parameter: "RV diastolic collapse", normal: "Inward motion in diastole", mild: "High specificity for tamponade" },
              { parameter: "IVC plethora", normal: "IVC > 21 mm, < 50% collapse", mild: "Elevated RAP" },
              { parameter: "Respiratory variation (mitral)", normal: "> 25% variation in E velocity", mild: "Pulsus paradoxus equivalent" },
              { parameter: "Respiratory variation (tricuspid)", normal: "> 40% variation in E velocity", mild: "Pulsus paradoxus equivalent" },
            ],
          },
        ],
        links: [
          { label: "Cardiac POCUS Navigator", path: "/pocus-cardiac", type: "navigator" },
          { label: "eFAST Navigator", path: "/pocus-efast", type: "navigator" },
        ],
      },
    ],
  },

  // ── 9. Comprehensive TTE ──────────────────────────────────────────────────
  {
    id: "tte",
    icon: Stethoscope,
    title: "Comprehensive TTE Examination",
    shortTitle: "TTE Protocol",
    year: "Current Guidelines",
    badge: "Stress Echocardiography",
    description: "Required components of a comprehensive adult TTE examination including views, measurements, and reporting.",
    subTopics: [
      {
        id: "tte-views",
        title: "Required TTE Views",
        bullets: [
          "Parasternal long axis (PLAX): LV, aortic root, LA, MV, AV",
          "Parasternal short axis (PSAX): AV level, MV level, papillary muscle level, apical level",
          "Apical 4-chamber (A4C): LV, RV, LA, RA, MV, TV",
          "Apical 2-chamber (A2C): LV anterior and inferior walls, MV",
          "Apical 3-chamber / APLAX: LV, LVOT, AV, aortic root",
          "Apical 5-chamber: LVOT and aortic valve Doppler",
          "Subcostal 4-chamber: RV free wall, IVS, IVC",
          "Subcostal IVC: IVC diameter and respiratory variation",
          "Suprasternal notch: Aortic arch, descending aorta",
        ],
        links: [
          { label: "Adult TTE Navigator", path: "/tte", type: "navigator" },
          { label: "Adult TTE ScanCoach", path: "/scan-coach?tab=tte", type: "scancoach" },
        ],
      },
      {
        id: "doppler-measurements",
        title: "Key Doppler Measurements",
        tables: [
          {
            title: "Standard Doppler Parameters",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Method", mild: "Normal Range" },
              { parameter: "LVOT VTI", normal: "PW Doppler — LVOT (5 mm below AV)", mild: "18–22 cm" },
              { parameter: "Aortic Vmax", normal: "CW Doppler — multiple windows", mild: "< 2.0 m/s" },
              { parameter: "Mitral E velocity", normal: "PW Doppler — MV tips", mild: "0.6–1.3 m/s" },
              { parameter: "Mitral A velocity", normal: "PW Doppler — MV tips", mild: "0.3–0.7 m/s" },
              { parameter: "Septal e'", normal: "TDI — septal annulus", mild: "≥ 7 cm/s" },
              { parameter: "Lateral e'", normal: "TDI — lateral annulus", mild: "≥ 10 cm/s" },
              { parameter: "TR Vmax", normal: "CW Doppler — best window", mild: "≤ 2.8 m/s" },
              { parameter: "RVOT VTI", normal: "PW Doppler — RVOT", mild: "15–25 cm" },
            ],
          },
        ],
      },
    ],
  },

  // ── 10. MPI / Tei Index ───────────────────────────────────────────────────
  {
    id: "mpi",
    icon: Activity,
    title: "Myocardial Performance Index (MPI / Tei Index)",
    shortTitle: "MPI / Tei Index",
    year: "Current Guidelines",
    badge: "Global Function",
    description: "Global ventricular function index combining systolic and diastolic time intervals.",
    subTopics: [
      {
        id: "mpi-calculation",
        title: "MPI Calculation & Normal Values",
        tables: [
          {
            title: "MPI Formula & Reference Values",
            rows: [
              { type: "header", parameter: "Parameter", normal: "Formula / Value", mild: "Notes" },
              { parameter: "MPI formula", normal: "MPI = (ICT + IRT) / ET", mild: "ICT = isovolumic contraction time; IRT = isovolumic relaxation time; ET = ejection time" },
              { parameter: "LV MPI (PW Doppler)", normal: "≤ 0.40", mild: "> 0.40 = abnormal global LV function" },
              { parameter: "LV MPI (TDI)", normal: "≤ 0.54", mild: "> 0.54 = abnormal" },
              { parameter: "RV MPI (PW Doppler)", normal: "≤ 0.40", mild: "> 0.40 = abnormal global RV function" },
              { parameter: "RV MPI (TDI)", normal: "≤ 0.54", mild: "> 0.54 = abnormal" },              { parameter: "Fetal LV MPI", normal: "\u2264 0.53", mild: "Guideline-based reference" },
              { parameter: "Fetal RV MPI", normal: "\u2264 0.55", mild: "Guideline-based reference" },    ],
          },
        ],
        links: [
          { label: "MPI Calculator", path: "/echoassist#engine-mpi", type: "calculator" },
          { label: "Adult TTE ScanCoach (MPI)", path: "/scan-coach?tab=tte", type: "scancoach" },
          { label: "Fetal Echo Navigator (MPI)", path: "/fetal", type: "navigator" },
        ],
      },
    ],
  },
];

// ─── Link type styling ─────────────────────────────────────────────────────────
const linkTypeConfig = {
  calculator: { label: "Calculator", color: "#189aa1", icon: Calculator },
  navigator: { label: "Navigator", color: "#0e4a50", icon: Stethoscope },
  scancoach: { label: "ScanCoach", color: "#4ad9e0", icon: BookOpen },
};

// ─── Severity cell styling ─────────────────────────────────────────────────────
function getCellStyle(type?: Severity) {
  if (type === "header") return "bg-[#0e1e2e] text-white font-semibold text-xs";
  if (type === "note") return "bg-amber-50 text-amber-800 text-xs italic";
  return "text-gray-700 text-xs";
}

// ─── Sub-topic accordion ───────────────────────────────────────────────────────
function SubTopicCard({ sub }: { sub: SubTopic }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#f0fbfc] transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <span className="font-semibold text-gray-800 text-sm">{sub.title}</span>
          {sub.description && <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-[#189aa1] flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-50 space-y-4">
          {/* Bullet list */}
          {sub.bullets && (
            <ul className="space-y-1">
              {sub.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
          )}
          {/* Tables */}
          {sub.tables?.map((tbl, ti) => (
            <div key={ti}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{tbl.title}</p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {tbl.rows.map((row, ri) => {
                      if (row.type === "note") {
                        return (
                          <tr key={ri} className="bg-amber-50">
                            <td colSpan={5} className="px-3 py-2 text-amber-800 text-xs italic">
                              <div className="flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                                {row.parameter}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      const isHeader = row.type === "header";
                      return (
                        <tr key={ri} className={isHeader ? "bg-[#0e1e2e]" : ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className={`px-3 py-2 ${isHeader ? "text-white font-semibold" : "text-gray-800 font-medium"}`}>
                            {row.parameter}
                          </td>
                          {row.normal !== undefined && (
                            <td className={`px-3 py-2 ${isHeader ? "text-white font-semibold" : "text-gray-700"}`}>
                              {isHeader ? row.normal : <span className={!isHeader && row.normal?.includes("≥") || row.normal?.includes("Normal") ? "text-emerald-700 font-medium" : ""}>{row.normal}</span>}
                            </td>
                          )}
                          {row.mild !== undefined && (
                            <td className={`px-3 py-2 ${isHeader ? "text-white font-semibold" : "text-amber-700"}`}>
                              {row.mild}
                            </td>
                          )}
                          {row.moderate !== undefined && (
                            <td className={`px-3 py-2 ${isHeader ? "text-white font-semibold" : "text-orange-700"}`}>
                              {row.moderate}
                            </td>
                          )}
                          {row.severe !== undefined && (
                            <td className={`px-3 py-2 ${isHeader ? "text-white font-semibold" : "text-red-700"}`}>
                              {row.severe}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {/* Cross-links */}
          {sub.links && sub.links.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Open in EchoAssist™</p>
              <div className="flex flex-wrap gap-2">
                {sub.links.map((lnk, li) => {
                  const cfg = linkTypeConfig[lnk.type];
                  const Icon = cfg.icon;
                  return (
                    <Link key={li} href={lnk.path}>
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
                        style={{ borderColor: cfg.color, color: cfg.color, background: cfg.color + "12" }}
                      >
                        <Icon className="w-3 h-3" />
                        {lnk.label}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Print Reference Card (premium) ──────────────────────────────────────────
function PrintRefCard({ g, isPremium }: { g: Guideline; isPremium: boolean }) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handlePrint = () => {
    if (!isPremium) { setShowUpgrade(true); return; }
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = g.subTopics.flatMap(s =>
      (s.tables ?? []).flatMap(t =>
        t.rows.filter(r => r.parameter && r.parameter !== "Parameter")
          .map(r => `<tr><td>${r.parameter}</td><td>${r.normal ?? ""}</td><td>${r.mild ?? ""}</td><td>${r.moderate ?? ""}</td><td>${r.severe ?? ""}</td></tr>`)
      )
    ).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>${g.title} — Reference Card</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h1{color:#189aa1;font-size:16px;margin-bottom:4px}h2{font-size:13px;color:#0e4a50;margin-top:16px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#189aa1;color:white;padding:5px 8px;text-align:left;font-size:11px}td{padding:4px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}tr:nth-child(even){background:#f0fbfc}.footer{margin-top:20px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}@media print{body{padding:0}}</style>
      </head><body>
      <h1>iHeartEcho™ GuidelinesAssist™</h1>
      <p style="color:#189aa1;font-weight:600;margin:0 0 4px">${g.title}</p>
      <p style="color:#6b7280;font-size:11px;margin:0 0 12px">${g.description}</p>
      <table><thead><tr><th>Parameter</th><th>Normal / Mild</th><th>Mild / Moderate</th><th>Moderate</th><th>Severe</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">GuidelinesAssist™ is a quick-reference tool based on published guidelines for educational purposes. Always refer to original guideline documents for full clinical context. &copy; iHeartEcho™ ${new Date().getFullYear()}</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); handlePrint(); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
        style={isPremium
          ? { color: BRAND, borderColor: BRAND + "40", background: BRAND + "10" }
          : { color: "#9ca3af", borderColor: "#e5e7eb", background: "#f9fafb" }}
        title={isPremium ? "Print Reference Card" : "Premium feature — upgrade to print"}
      >
        {isPremium ? <Printer className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
        Print Card
      </button>
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowUpgrade(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: BRAND + "18" }}>
                <Printer className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Premium Feature</h3>
                <p className="text-xs text-gray-500">Print Reference Cards</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Printable reference cards are available to <strong>iHeartEcho™ Premium</strong> members. Upgrade to print clean, single-page PDF reference cards for any guideline — perfect for the scanner or study desk.
            </p>
            <div className="flex gap-2">
              <a
                href="https://www.iheartecho.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                style={{ background: BRAND }}
              >
                Upgrade to Premium
              </a>
              <button
                onClick={() => setShowUpgrade(false)}
                className="px-4 py-2.5 rounded-lg font-semibold text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Guideline card ────────────────────────────────────────────────────────────
function GuidelineCard({ g, isPremium, defaultOpen }: { g: Guideline; isPremium: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const Icon = g.icon;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-start gap-4 px-5 py-4 hover:bg-[#f0fbfc] transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: BRAND + "18" }}>
          <Icon className="w-5 h-5" style={{ color: BRAND }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h3 className="font-bold text-gray-800 text-sm leading-snug">{g.title}</h3>
            {g.isNew && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">NEW</span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: BRAND + "15", color: BRAND }}>{g.badge}</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{g.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          <PrintRefCard g={g} isPremium={isPremium} />
          {open
            ? <ChevronDown className="w-5 h-5 text-[#189aa1]" />
            : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-50 space-y-2">
          {g.subTopics.map(sub => (
            <SubTopicCard key={sub.id} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function GuidelinesAssist() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const { user } = useAuth();
  const { isPremium } = usePremium();

  const filters = [
    { id: "all", label: "All Guidelines" },
    { id: "valves", label: "Valves" },
    { id: "lv", label: "LV Function" },
    { id: "rv", label: "RV / PH" },
    { id: "congenital", label: "Congenital" },
    { id: "pocus", label: "POCUS" },
  ];

  const filterMap: Record<string, string[]> = {
    new: ["diastology", "right-heart", "strain"],
    valves: ["valves"],
    lv: ["diastology", "chambers", "strain", "mpi"],
    rv: ["right-heart", "mpi"],
    congenital: ["fetal", "pediatric"],
    pocus: ["pocus"],
  };

  const filtered = useMemo(() => {
    let list = guidelines;
    if (activeFilter !== "all") {
      const ids = filterMap[activeFilter] ?? [];
      list = list.filter(g => ids.includes(g.id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(g =>
        g.title.toLowerCase().includes(q) ||
        g.shortTitle.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.subTopics.some(s =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          s.tables?.some(t => t.rows.some(r => r.parameter.toLowerCase().includes(q)))
        )
      );
    }
    return list;
  }, [search, activeFilter]);

  return (
    <Layout>
      {/* Hero Banner */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="relative container py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
              <span className="text-xs text-white/80 font-medium">Guideline-Based Quick Reference</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-2" style={{ fontFamily: "Merriweather, serif" }}>
              GuidelinesAssist™
            </h1>
            <p className="text-[#4ad9e0] font-semibold text-base mb-3">Current Guidelines — Quick Reference for Clinical Practice</p>
            <p className="text-white/70 text-sm leading-relaxed mb-5 max-w-lg">
              Fast-lookup measurement cut-offs, grading algorithms, and severity thresholds based on current published guidelines.
            </p>
            {/* Stats strip */}
            <div className="flex flex-wrap gap-4">
              {[
                { label: "Guidelines", value: `${guidelines.length}` },
                { label: "Sub-topics", value: `${guidelines.reduce((a, g) => a + g.subTopics.length, 0)}` },
                { label: "Measurement Tables", value: `${guidelines.reduce((a, g) => a + g.subTopics.reduce((b, s) => b + (s.tables?.length ?? 0), 0), 0)}+` },
                { label: "EchoAssist Links", value: `${guidelines.reduce((a, g) => a + g.subTopics.reduce((b, s) => b + (s.links?.length ?? 0), 0), 0)}+` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xl font-black text-[#4ad9e0]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{value}</span>
                  <span className="text-xs text-white/60">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="container py-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search parameters, cut-offs, guidelines…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {/* Filter chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {filters.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                    activeFilter === f.id
                      ? "text-white border-transparent"
                      : "text-gray-600 border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
                  }`}
                  style={activeFilter === f.id ? { background: BRAND, borderColor: BRAND } : {}}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Guidelines Grid */}
      <div className="container py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No guidelines match "{search}"</p>
            <button onClick={() => { setSearch(""); setActiveFilter("all"); }} className="mt-2 text-sm text-[#189aa1] hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                {activeFilter === "all" ? "All Guidelines" : filters.find(f => f.id === activeFilter)?.label}
                <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length})</span>
              </h2>
              {(search || activeFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); setActiveFilter("all"); }}
                  className="text-xs text-[#189aa1] hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>
            <div className="space-y-3">
              {filtered.map(g => (
                <GuidelineCard key={g.id} g={g} isPremium={isPremium} />
              ))}
            </div>
          </>
        )}

        {/* Footer note */}
        <div className="mt-10 p-4 rounded-xl bg-[#f0fbfc] border border-[#189aa1]/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#189aa1] mb-1">Clinical Disclaimer</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                GuidelinesAssist™ is a quick-reference tool summarising published ASE guidelines for educational and clinical support purposes. Always refer to the original published guideline documents for full context, methodology, and clinical decision-making. Cut-off values may vary based on patient population, imaging quality, and clinical context.
              </p>
              <a
                href="https://www.asecho.org/practice-clinical-resources/ase-guidelines/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#189aa1] font-semibold mt-2 hover:underline"
              >
                View all ASE Guidelines <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
