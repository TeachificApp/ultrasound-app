/*
  ECG Navigator — Systematic ECG Interpretation Guide
  Brand: iHeartEcho Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
  Free access — no premium gate
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import {
  Activity, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  Heart, Zap, BarChart3, ArrowRight, Info, BookOpen, Radio
} from "lucide-react";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CriteriaItem {
  label: string;
  value: string;
  flag?: "normal" | "warn" | "danger";
}

interface Pattern {
  name: string;
  criteria: CriteriaItem[];
  ecgFeatures?: string[];
  clinicalNote?: string;
  aseRef?: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  patterns: Pattern[];
}

// ─── Clinical Data ────────────────────────────────────────────────────────────
const sections: Section[] = [
  {
    id: "rate-rhythm",
    title: "Rate & Rhythm",
    icon: Activity,
    color: "#189aa1",
    patterns: [
      {
        name: "Normal Sinus Rhythm",
        criteria: [
          { label: "Rate", value: "60–100 bpm", flag: "normal" },
          { label: "P wave before each QRS", value: "Yes", flag: "normal" },
          { label: "PR interval", value: "120–200 ms", flag: "normal" },
          { label: "P wave axis", value: "0°–75° (upright in I, II; inverted in aVR)", flag: "normal" },
        ],
        clinicalNote: "Each P wave must be followed by a QRS. Regularity is the hallmark — RR intervals should vary by <10%.",
        aseRef: "AHA/ACC 2019 ECG Interpretation Guidelines",
      },
      {
        name: "Sinus Bradycardia",
        criteria: [
          { label: "Rate", value: "<60 bpm", flag: "warn" },
          { label: "Rhythm", value: "Regular sinus", flag: "normal" },
          { label: "P morphology", value: "Normal", flag: "normal" },
        ],
        clinicalNote: "Common in athletes and during sleep. Pathological causes: hypothyroidism, inferior MI (RCA → SA node), beta-blockers, increased vagal tone.",
      },
      {
        name: "Sinus Tachycardia",
        criteria: [
          { label: "Rate", value: ">100 bpm", flag: "warn" },
          { label: "Rhythm", value: "Regular sinus", flag: "normal" },
          { label: "P wave", value: "Upright in I, II; may be buried in T wave at fast rates", flag: "normal" },
        ],
        clinicalNote: "Always a secondary finding — treat the cause (pain, fever, hypovolemia, PE, thyrotoxicosis, anemia, heart failure). Gradual onset/offset distinguishes from SVT.",
      },
      {
        name: "Atrial Fibrillation",
        criteria: [
          { label: "Rate", value: "Ventricular rate variable (60–170 bpm uncontrolled)", flag: "warn" },
          { label: "Rhythm", value: "Irregularly irregular", flag: "danger" },
          { label: "P waves", value: "Absent — replaced by fibrillatory baseline (f waves)", flag: "danger" },
          { label: "QRS", value: "Narrow (unless aberrant conduction or WPW)", flag: "normal" },
        ],
        clinicalNote: "Most common sustained arrhythmia. CHA₂DS₂-VASc score guides anticoagulation. Rate vs rhythm control decision based on symptoms and hemodynamic stability.",
        aseRef: "AHA/ACC/HRS 2023 AF Guidelines",
      },
      {
        name: "Atrial Flutter",
        criteria: [
          { label: "Atrial rate", value: "~300 bpm (250–350)", flag: "danger" },
          { label: "Ventricular rate", value: "150 bpm (2:1 block most common)", flag: "warn" },
          { label: "Flutter waves", value: "Sawtooth pattern — best seen in II, III, aVF", flag: "danger" },
          { label: "Rhythm", value: "Regular (if fixed block ratio)", flag: "normal" },
        ],
        clinicalNote: "Typical (counterclockwise, cavotricuspid isthmus-dependent) flutter: negative flutter waves in inferior leads, positive in V1. Radiofrequency ablation is highly effective (>95% success).",
      },
      {
        name: "SVT (AVNRT / AVRT)",
        criteria: [
          { label: "Rate", value: "150–250 bpm", flag: "danger" },
          { label: "Rhythm", value: "Regular", flag: "normal" },
          { label: "P waves", value: "Buried in QRS (AVNRT) or just after QRS (AVRT)", flag: "warn" },
          { label: "QRS", value: "Narrow (<120 ms) unless aberrant", flag: "normal" },
          { label: "Onset/offset", value: "Sudden (paroxysmal)", flag: "warn" },
        ],
        clinicalNote: "Vagal maneuvers (Valsalva, carotid sinus massage) or IV adenosine terminate most SVTs. RP interval: short in AVNRT (RP <PR), long in atypical AVNRT or AVRT.",
      },
      {
        name: "Ventricular Tachycardia (VT)",
        criteria: [
          { label: "Rate", value: ">100 bpm (usually 120–200)", flag: "danger" },
          { label: "QRS duration", value: ">120 ms (usually >140 ms)", flag: "danger" },
          { label: "AV dissociation", value: "Present (P waves independent of QRS)", flag: "danger" },
          { label: "Fusion beats", value: "Pathognomonic when present", flag: "danger" },
          { label: "Capture beats", value: "Narrow QRS interrupting wide complex rhythm", flag: "danger" },
          { label: "Concordance", value: "Positive or negative concordance in precordial leads", flag: "danger" },
        ],
        clinicalNote: "Brugada criteria: RBBB-like morphology with RS interval >100 ms in any precordial lead, AV dissociation, or morphology criteria → VT. Sustained VT (>30 s) requires urgent management.",
        aseRef: "ACC/AHA/HRS 2017 Ventricular Arrhythmia Guidelines",
      },
      {
        name: "Ventricular Fibrillation",
        criteria: [
          { label: "Rhythm", value: "Chaotic, irregular", flag: "danger" },
          { label: "Rate", value: "Indeterminate", flag: "danger" },
          { label: "QRS/T", value: "No identifiable complexes", flag: "danger" },
        ],
        clinicalNote: "Cardiac arrest rhythm — immediate defibrillation required. CPR until defibrillator available. Post-ROSC: targeted temperature management, PCI if STEMI.",
      },
    ],
  },
  {
    id: "av-blocks",
    title: "AV Blocks",
    icon: Radio,
    color: "#dc2626",
    patterns: [
      {
        name: "First-Degree AV Block",
        criteria: [
          { label: "PR interval", value: ">200 ms (>5 small squares)", flag: "warn" },
          { label: "Every P followed by QRS", value: "Yes", flag: "normal" },
          { label: "PR consistency", value: "Constant", flag: "normal" },
        ],
        clinicalNote: "Not a true 'block' — all impulses conduct, just slowly. Usually benign. Causes: increased vagal tone, inferior MI, digoxin, beta-blockers, myocarditis.",
      },
      {
        name: "Second-Degree AV Block — Mobitz I (Wenckebach)",
        criteria: [
          { label: "PR interval", value: "Progressively lengthening", flag: "warn" },
          { label: "Dropped QRS", value: "Periodic — after longest PR", flag: "warn" },
          { label: "RR interval", value: "Progressively shortening before dropped beat", flag: "warn" },
          { label: "Level of block", value: "AV node (above His)", flag: "warn" },
        ],
        clinicalNote: "Usually benign, especially in inferior MI (reversible with atropine). The RR interval shortens progressively — the group beating pattern is characteristic.",
      },
      {
        name: "Second-Degree AV Block — Mobitz II",
        criteria: [
          { label: "PR interval", value: "Constant (does not lengthen)", flag: "warn" },
          { label: "Dropped QRS", value: "Sudden, without warning", flag: "danger" },
          { label: "QRS", value: "Often wide (infranodal block)", flag: "danger" },
          { label: "Level of block", value: "Below AV node (His-Purkinje)", flag: "danger" },
        ],
        clinicalNote: "High risk of progression to complete heart block. Permanent pacemaker usually indicated. Does NOT respond reliably to atropine.",
      },
      {
        name: "Third-Degree (Complete) AV Block",
        criteria: [
          { label: "P waves", value: "Regular, independent of QRS", flag: "danger" },
          { label: "QRS", value: "Regular escape rhythm — narrow (junctional) or wide (ventricular)", flag: "danger" },
          { label: "AV dissociation", value: "Complete — no relationship between P and QRS", flag: "danger" },
          { label: "Escape rate", value: "Junctional: 40–60 bpm; Ventricular: 20–40 bpm", flag: "danger" },
        ],
        clinicalNote: "Emergency — transcutaneous pacing if hemodynamically unstable. Permanent pacemaker required. Causes: inferior MI (usually transient), anterior MI (permanent), Lyme disease, surgical trauma.",
      },
    ],
  },
  {
    id: "bundle-branch",
    title: "Bundle Branch Blocks",
    icon: Zap,
    color: "#189aa1",
    patterns: [
      {
        name: "Right Bundle Branch Block (RBBB)",
        criteria: [
          { label: "QRS duration", value: "≥120 ms (complete); 110–119 ms (incomplete)", flag: "warn" },
          { label: "V1 morphology", value: "RSR' pattern ('rabbit ears') — rSR', rsR', or qR", flag: "warn" },
          { label: "V5/V6 morphology", value: "Wide, slurred S wave", flag: "warn" },
          { label: "ST-T changes", value: "Discordant — T wave opposite to terminal QRS deflection", flag: "normal" },
        ],
        clinicalNote: "Isolated RBBB is often benign. New RBBB in the context of anterior MI or PE is significant. RBBB + left axis deviation = bifascicular block (high risk for complete heart block).",
      },
      {
        name: "Left Bundle Branch Block (LBBB)",
        criteria: [
          { label: "QRS duration", value: "≥120 ms", flag: "warn" },
          { label: "V1 morphology", value: "Broad, deep QS or rS", flag: "warn" },
          { label: "V5/V6 morphology", value: "Broad, notched R wave — no septal Q waves", flag: "warn" },
          { label: "Lateral leads (I, aVL)", value: "Broad monophasic R wave", flag: "warn" },
          { label: "ST-T changes", value: "Discordant — always opposite to QRS direction", flag: "normal" },
        ],
        clinicalNote: "New LBBB may indicate acute MI (apply Sgarbossa criteria). LBBB makes standard ST analysis unreliable. LBBB is a criterion for CRT (cardiac resynchronization therapy) in HFrEF.",
        aseRef: "ACC/AHA 2022 Heart Failure Guidelines",
      },
      {
        name: "Left Anterior Fascicular Block (LAFB)",
        criteria: [
          { label: "QRS duration", value: "<120 ms (fascicular block alone)", flag: "normal" },
          { label: "Axis", value: "Left axis deviation: −45° to −90°", flag: "warn" },
          { label: "Lead I", value: "qR pattern", flag: "warn" },
          { label: "Lead III", value: "rS pattern", flag: "warn" },
        ],
        clinicalNote: "Most common fascicular block. Causes: LV disease, inferior MI, cardiomyopathy. LAFB + RBBB = bifascicular block.",
      },
      {
        name: "Left Posterior Fascicular Block (LPFB)",
        criteria: [
          { label: "QRS duration", value: "<120 ms", flag: "normal" },
          { label: "Axis", value: "Right axis deviation: +90° to +180°", flag: "warn" },
          { label: "Lead I", value: "rS pattern", flag: "warn" },
          { label: "Lead III", value: "qR pattern", flag: "warn" },
          { label: "Exclusion", value: "RVH, lateral MI, and normal variant must be excluded", flag: "warn" },
        ],
        clinicalNote: "Less common than LAFB. Diagnosis of exclusion. LPFB + RBBB = bifascicular block with high risk for complete heart block.",
      },
    ],
  },
  {
    id: "p-wave",
    title: "P Wave Analysis",
    icon: BarChart3,
    color: "#189aa1",
    patterns: [
      {
        name: "Left Atrial Enlargement (LAE)",
        criteria: [
          { label: "P wave duration", value: ">120 ms in lead II (P mitrale)", flag: "warn" },
          { label: "P wave morphology (II)", value: "Notched, bifid P wave", flag: "warn" },
          { label: "P terminal force (V1)", value: "Terminal negative component >1 mm deep and >40 ms wide", flag: "warn" },
          { label: "P wave axis", value: "Normal or slightly leftward", flag: "normal" },
        ],
        clinicalNote: "Seen in mitral stenosis, mitral regurgitation, LV dysfunction, hypertension. The PTF-V1 (P terminal force in V1) is the most specific criterion.",
      },
      {
        name: "Right Atrial Enlargement (RAE)",
        criteria: [
          { label: "P wave amplitude (II)", value: ">2.5 mm (P pulmonale)", flag: "warn" },
          { label: "P wave duration", value: "Normal or slightly prolonged", flag: "normal" },
          { label: "P wave (V1)", value: "Initial positive component >1.5 mm", flag: "warn" },
          { label: "P wave axis", value: "Rightward (>75°)", flag: "warn" },
        ],
        clinicalNote: "Seen in pulmonary hypertension, tricuspid stenosis, cor pulmonale, COPD. The tall peaked P in inferior leads is the hallmark.",
      },
      {
        name: "Biatrial Enlargement",
        criteria: [
          { label: "P wave duration", value: ">120 ms (LAE component)", flag: "warn" },
          { label: "P wave amplitude (II)", value: ">2.5 mm (RAE component)", flag: "warn" },
          { label: "V1 P wave", value: "Biphasic with both tall initial and deep terminal components", flag: "warn" },
        ],
        clinicalNote: "Combination of LAE and RAE criteria. Seen in advanced cardiomyopathy, congenital heart disease, severe valvular disease.",
      },
    ],
  },
  {
    id: "st-t",
    title: "ST-T Changes & Ischemia",
    icon: AlertTriangle,
    color: "#dc2626",
    patterns: [
      {
        name: "STEMI — Anterior (LAD territory)",
        criteria: [
          { label: "ST elevation", value: "≥2 mm in V2–V3 (men ≥40y); ≥2.5 mm (men <40y); ≥1.5 mm (women)", flag: "danger" },
          { label: "Leads involved", value: "V1–V4 (proximal LAD); V3–V5 (mid LAD)", flag: "danger" },
          { label: "Reciprocal changes", value: "ST depression in inferior leads (II, III, aVF)", flag: "danger" },
          { label: "Pathological Q waves", value: "Develop within hours — V1–V4", flag: "danger" },
        ],
        clinicalNote: "Proximal LAD occlusion (V1–V6 + I, aVL) = widow maker. Immediate PCI target: door-to-balloon <90 min. New LBBB with ischemic symptoms = STEMI equivalent.",
        aseRef: "ACC/AHA 2013 STEMI Guidelines (2022 focused update)",
      },
      {
        name: "STEMI — Inferior (RCA / LCx territory)",
        criteria: [
          { label: "ST elevation", value: "≥1 mm in II, III, aVF", flag: "danger" },
          { label: "Reciprocal changes", value: "ST depression in I, aVL (≥1 mm)", flag: "danger" },
          { label: "Right-sided leads", value: "ST elevation in V3R–V4R → RV MI (RCA)", flag: "danger" },
          { label: "Posterior leads", value: "ST elevation in V7–V9 → posterior MI (LCx)", flag: "danger" },
        ],
        clinicalNote: "Always obtain right-sided leads (V3R, V4R) for inferior STEMI — RV MI in 30–50% of inferior STEMIs. Avoid nitrates in RV MI (preload-dependent). Bradycardia/heart block common with RCA occlusion.",
      },
      {
        name: "STEMI — Lateral (LCx territory)",
        criteria: [
          { label: "ST elevation", value: "≥1 mm in I, aVL, V5–V6", flag: "danger" },
          { label: "Reciprocal changes", value: "ST depression in III, aVF", flag: "danger" },
        ],
        clinicalNote: "High lateral MI (I, aVL only) may be subtle — look carefully for reciprocal inferior ST depression. LCx is the 'silent artery' — often no reciprocal changes.",
      },
      {
        name: "Wellens Syndrome (LAD Critical Stenosis)",
        criteria: [
          { label: "Type A", value: "Biphasic T waves in V2–V3 (initial positive, terminal negative)", flag: "danger" },
          { label: "Type B", value: "Deep symmetric T wave inversions in V2–V3", flag: "danger" },
          { label: "ST segment", value: "Minimal or no ST elevation", flag: "warn" },
          { label: "Context", value: "Pain-free period after angina episode", flag: "danger" },
        ],
        clinicalNote: "Wellens pattern indicates critical proximal LAD stenosis — high risk for anterior STEMI. Do NOT stress test. Urgent catheterization required. Troponin may be normal or mildly elevated.",
      },
      {
        name: "de Winter Pattern (LAD Occlusion Equivalent)",
        criteria: [
          { label: "ST depression", value: "1–3 mm upsloping ST depression at J-point in V1–V6", flag: "danger" },
          { label: "Tall, symmetric T waves", value: "Positive, peaked T waves in precordial leads", flag: "danger" },
          { label: "aVR", value: "ST elevation in aVR", flag: "danger" },
          { label: "No ST elevation", value: "Absence of classic STEMI pattern", flag: "warn" },
        ],
        clinicalNote: "STEMI equivalent — proximal LAD occlusion. Seen in ~2% of LAD occlusions. Activate cath lab immediately. Static pattern (does not evolve like classic STEMI).",
      },
      {
        name: "Brugada Pattern",
        criteria: [
          { label: "Type 1 (diagnostic)", value: "Coved ST elevation ≥2 mm with negative T wave in V1–V2", flag: "danger" },
          { label: "Type 2", value: "Saddle-back ST elevation ≥0.5 mm in V1–V2", flag: "warn" },
          { label: "Type 3", value: "Saddle-back ST elevation <1 mm", flag: "warn" },
          { label: "Spontaneous Type 1", value: "Higher risk than drug-induced", flag: "danger" },
        ],
        clinicalNote: "Brugada syndrome: autosomal dominant SCN5A mutation. Risk of sudden cardiac death from VF. ICD indicated for symptomatic patients (syncope, aborted SCA). Fever unmasks the pattern — treat aggressively.",
        aseRef: "HRS/EHRA/APHRS 2013 Brugada Consensus Statement",
      },
      {
        name: "Early Repolarization",
        criteria: [
          { label: "J-point elevation", value: "≥1 mm in ≥2 contiguous inferior or lateral leads", flag: "warn" },
          { label: "Morphology", value: "Notching or slurring at J-point; upward concave ST", flag: "warn" },
          { label: "T waves", value: "Tall, concordant with QRS", flag: "normal" },
        ],
        clinicalNote: "Benign early repolarization: lateral leads, young athletes. High-risk pattern: inferior leads, horizontal/descending ST, family history of SCD. Differentiate from STEMI by concave vs convex ST morphology.",
      },
      {
        name: "Pericarditis",
        criteria: [
          { label: "ST elevation", value: "Diffuse, concave ('saddle-shaped') in multiple leads", flag: "warn" },
          { label: "Lead distribution", value: "Widespread — I, II, III, aVL, aVF, V2–V6 (not territory-specific)", flag: "warn" },
          { label: "PR depression", value: "Diffuse PR depression (except aVR — PR elevation)", flag: "warn" },
          { label: "Reciprocal ST depression", value: "Only in aVR and V1", flag: "warn" },
          { label: "T wave inversion", value: "Late finding — after ST normalises", flag: "warn" },
        ],
        clinicalNote: "Four stages: (1) diffuse ST elevation + PR depression, (2) ST normalises, (3) T wave inversion, (4) normalisation. Spodick's sign: downsloping TP segment. Distinguish from STEMI by diffuse distribution and concave morphology.",
      },
    ],
  },
  {
    id: "qt",
    title: "QT Interval",
    icon: Activity,
    color: "#189aa1",
    patterns: [
      {
        name: "QTc Normal Ranges",
        criteria: [
          { label: "Men — Normal", value: "≤440 ms", flag: "normal" },
          { label: "Women — Normal", value: "≤460 ms", flag: "normal" },
          { label: "Borderline prolonged", value: "440–470 ms (men); 460–480 ms (women)", flag: "warn" },
          { label: "Prolonged", value: ">470 ms (men); >480 ms (women)", flag: "warn" },
          { label: "High risk / TdP threshold", value: ">500 ms", flag: "danger" },
        ],
        clinicalNote: "Bazett formula: QTc = QT / √RR (seconds). Most widely used but overcorrects at fast rates. Fridericia (QT / RR^0.333) preferred at heart rates >100 bpm. Measure QT in lead II or V5 — longest QT.",
        aseRef: "AHA/ACC/HRS 2017 Ventricular Arrhythmia Guidelines",
      },
      {
        name: "Long QT Syndrome (LQTS)",
        criteria: [
          { label: "QTc", value: ">480 ms (diagnostic); 460–480 ms (borderline)", flag: "danger" },
          { label: "LQT1", value: "Broad-based T waves; triggered by exercise/swimming", flag: "danger" },
          { label: "LQT2", value: "Low-amplitude, notched T waves; triggered by sudden noise/emotion", flag: "danger" },
          { label: "LQT3", value: "Late-onset T wave; events during sleep/rest", flag: "danger" },
          { label: "Arrhythmia", value: "Torsades de Pointes (TdP) → VF → SCD", flag: "danger" },
        ],
        clinicalNote: "Congenital LQTS: KCNQ1 (LQT1), KCNH2 (LQT2), SCN5A (LQT3). Schwartz score used for diagnosis. Avoid QT-prolonging drugs. Beta-blockers first-line for LQT1/LQT2. ICD for high-risk patients.",
      },
      {
        name: "Drug-Induced QT Prolongation",
        criteria: [
          { label: "Antiarrhythmics", value: "Amiodarone, sotalol, dofetilide, quinidine", flag: "danger" },
          { label: "Antibiotics", value: "Azithromycin, fluoroquinolones, clarithromycin", flag: "warn" },
          { label: "Antipsychotics", value: "Haloperidol, quetiapine, ziprasidone", flag: "warn" },
          { label: "Antidepressants", value: "TCAs, citalopram (>40 mg/day)", flag: "warn" },
          { label: "Antiemetics", value: "Ondansetron, metoclopramide", flag: "warn" },
          { label: "Electrolytes", value: "Hypokalemia, hypomagnesemia, hypocalcemia", flag: "danger" },
        ],
        clinicalNote: "Risk increases with multiple QT-prolonging drugs, electrolyte abnormalities, bradycardia, and female sex. Monitor QTc at baseline and after drug initiation. Withhold drug if QTc >500 ms.",
      },
      {
        name: "Short QT Syndrome",
        criteria: [
          { label: "QTc", value: "<340 ms (definitive); <360 ms (possible)", flag: "danger" },
          { label: "T waves", value: "Tall, peaked, narrow; short or absent ST segment", flag: "warn" },
          { label: "Risk", value: "AF, VF, SCD in young patients", flag: "danger" },
        ],
        clinicalNote: "Rare channelopathy. Gain-of-function mutations in potassium channels (KCNH2, KCNQ1, KCNJ2). ICD recommended for symptomatic patients. Quinidine may be protective.",
      },
    ],
  },
  {
    id: "axis",
    title: "Electrical Axis",
    icon: ArrowRight,
    color: "#189aa1",
    patterns: [
      {
        name: "Normal Axis",
        criteria: [
          { label: "Range", value: "−30° to +90°", flag: "normal" },
          { label: "Lead I", value: "Positive QRS", flag: "normal" },
          { label: "aVF", value: "Positive QRS", flag: "normal" },
        ],
        clinicalNote: "Quick method: if Lead I and aVF are both positive → normal axis. The isoelectric lead is perpendicular to the axis.",
      },
      {
        name: "Left Axis Deviation (LAD)",
        criteria: [
          { label: "Range", value: "−30° to −90°", flag: "warn" },
          { label: "Lead I", value: "Positive", flag: "normal" },
          { label: "aVF", value: "Negative", flag: "warn" },
          { label: "Lead II", value: "Negative (if axis < −30°)", flag: "warn" },
        ],
        clinicalNote: "Causes: LAFB (most common), inferior MI, LVH, WPW (right-sided pathway), hyperkalemia, pacemaker rhythm. Mild LAD (−30° to −45°) may be normal in obese/pregnant patients.",
      },
      {
        name: "Right Axis Deviation (RAD)",
        criteria: [
          { label: "Range", value: "+90° to +180°", flag: "warn" },
          { label: "Lead I", value: "Negative", flag: "warn" },
          { label: "aVF", value: "Positive", flag: "normal" },
        ],
        clinicalNote: "Causes: RVH, LPFB, lateral MI, PE, COPD, dextrocardia, normal variant in children/tall thin adults. New RAD in the context of acute dyspnea → consider PE.",
      },
      {
        name: "Extreme Axis Deviation (Northwest Axis)",
        criteria: [
          { label: "Range", value: "−90° to ±180°", flag: "danger" },
          { label: "Lead I", value: "Negative", flag: "danger" },
          { label: "aVF", value: "Negative", flag: "danger" },
        ],
        clinicalNote: "Causes: VT, hyperkalemia, severe RVH, lead reversal (RA-LA swap), ventricular pacing. Always consider lead reversal before diagnosing extreme axis deviation.",
      },
    ],
  },
  {
    id: "special-patterns",
    title: "Special Patterns",
    icon: Info,
    color: "#189aa1",
    patterns: [
      {
        name: "Wolff-Parkinson-White (WPW)",
        criteria: [
          { label: "PR interval", value: "<120 ms (short)", flag: "warn" },
          { label: "Delta wave", value: "Slurred upstroke of QRS — initial slow conduction via accessory pathway", flag: "warn" },
          { label: "QRS duration", value: ">120 ms (widened)", flag: "warn" },
          { label: "ST-T changes", value: "Discordant (secondary to pre-excitation)", flag: "warn" },
        ],
        clinicalNote: "WPW pattern + symptoms = WPW syndrome. Risk of AF with rapid conduction via accessory pathway → VF. Avoid AV nodal blocking agents (adenosine, digoxin, verapamil) in pre-excited AF. Radiofrequency ablation is curative.",
        aseRef: "PACES/HRS 2012 WPW Expert Consensus",
      },
      {
        name: "Sgarbossa Criteria (LBBB + MI)",
        criteria: [
          { label: "Criterion 1 (5 pts)", value: "Concordant ST elevation ≥1 mm in leads with positive QRS", flag: "danger" },
          { label: "Criterion 2 (3 pts)", value: "Concordant ST depression ≥1 mm in V1–V3", flag: "danger" },
          { label: "Criterion 3 (2 pts)", value: "Discordant ST elevation ≥5 mm in leads with negative QRS", flag: "warn" },
          { label: "Modified Criterion 3", value: "ST/S ratio ≤−0.25 (Smith modification — more sensitive)", flag: "warn" },
          { label: "Score ≥3", value: "Highly specific for MI (specificity 90%)", flag: "danger" },
        ],
        clinicalNote: "Original Sgarbossa score ≥3 points is highly specific but insensitive. Smith's modified criterion 3 (proportional ST/S ratio) improves sensitivity. Any concordant ST change in LBBB should prompt urgent evaluation.",
      },
      {
        name: "Hyperkalemia",
        criteria: [
          { label: "Mild (5.5–6.5 mEq/L)", value: "Peaked, narrow, symmetric T waves (best in V2–V4)", flag: "warn" },
          { label: "Moderate (6.5–7.5 mEq/L)", value: "PR prolongation, P wave flattening/disappearance, QRS widening", flag: "danger" },
          { label: "Severe (>7.5 mEq/L)", value: "Sine wave pattern, VF, asystole", flag: "danger" },
        ],
        clinicalNote: "Peaked T waves are the earliest ECG sign. Progression: peaked T → wide QRS → sine wave → VF. Treatment: calcium gluconate (membrane stabilization), insulin/dextrose, sodium bicarbonate, kayexalate, dialysis.",
      },
      {
        name: "Digoxin Effect vs Toxicity",
        criteria: [
          { label: "Digoxin effect (therapeutic)", value: "Scooped ('Salvador Dali moustache') ST depression; shortened QT", flag: "warn" },
          { label: "Digoxin toxicity — bradyarrhythmias", value: "Sinus bradycardia, AV blocks (1°, 2°, 3°)", flag: "danger" },
          { label: "Digoxin toxicity — tachyarrhythmias", value: "PAT with block (pathognomonic), junctional tachycardia, bidirectional VT", flag: "danger" },
          { label: "Bidirectional VT", value: "Alternating QRS axis — classic for digoxin toxicity", flag: "danger" },
        ],
        clinicalNote: "Digoxin effect ≠ toxicity. Toxicity risk increased by hypokalemia, hypomagnesemia, renal failure, hypothyroidism. Digoxin-specific antibody fragments (Digibind) for severe toxicity.",
      },
      {
        name: "Pulmonary Embolism (PE) ECG Signs",
        criteria: [
          { label: "S1Q3T3 pattern", value: "S wave in I, Q wave in III, T wave inversion in III", flag: "warn" },
          { label: "Sinus tachycardia", value: "Most common finding (>50%)", flag: "warn" },
          { label: "New RBBB", value: "Acute right heart strain", flag: "warn" },
          { label: "T wave inversions", value: "V1–V4 (RV strain pattern)", flag: "warn" },
          { label: "Right axis deviation", value: "New RAD", flag: "warn" },
          { label: "P pulmonale", value: "Peaked P in II (RAE)", flag: "warn" },
        ],
        clinicalNote: "ECG is neither sensitive nor specific for PE. S1Q3T3 is present in only 20% of cases. The primary value of ECG in suspected PE is to exclude other diagnoses (MI, pericarditis). CT-PA remains the diagnostic gold standard.",
      },
    ],
  },
  {
    id: "pacemaker",
    title: "Pacemaker ECGs",
    icon: Heart,
    color: "#189aa1",
    patterns: [
      {
        name: "VVI Pacemaker (Ventricular Demand)",
        criteria: [
          { label: "Pacing spikes", value: "Visible before each paced QRS", flag: "normal" },
          { label: "QRS morphology", value: "Wide, LBBB-like (RV apex pacing)", flag: "warn" },
          { label: "Sensing", value: "Inhibited by intrinsic ventricular activity", flag: "normal" },
          { label: "Rate", value: "Paces at programmed lower rate limit", flag: "normal" },
        ],
        clinicalNote: "Single-chamber ventricular pacemaker. No AV synchrony — can cause 'pacemaker syndrome' (retrograde VA conduction, reduced CO). Used in AF with bradycardia.",
      },
      {
        name: "DDD Pacemaker (Dual-Chamber)",
        criteria: [
          { label: "Atrial spike", value: "Before P wave (if atrial pacing)", flag: "normal" },
          { label: "Ventricular spike", value: "Before QRS after programmed AV delay", flag: "normal" },
          { label: "Modes", value: "AAI (atrial only), VVI (ventricular only), DDD (both)", flag: "normal" },
          { label: "AV delay", value: "Programmed (typically 120–200 ms)", flag: "normal" },
        ],
        clinicalNote: "Maintains AV synchrony. Four possible patterns: (1) A-paced/V-paced, (2) A-paced/V-sensed, (3) A-sensed/V-paced, (4) A-sensed/V-sensed (no pacing). Identify which chambers are pacing vs sensing.",
      },
      {
        name: "Biventricular Pacemaker (CRT)",
        criteria: [
          { label: "QRS morphology", value: "RBBB-like or narrow (fusion of LV + RV pacing)", flag: "normal" },
          { label: "Axis", value: "Right axis deviation or superior axis", flag: "warn" },
          { label: "Pacing spikes", value: "One or two spikes before QRS", flag: "normal" },
          { label: "QRS duration", value: "Narrower than intrinsic LBBB (goal <130 ms)", flag: "normal" },
        ],
        clinicalNote: "CRT for HFrEF with LBBB and QRS ≥150 ms. Effective CRT: QRS narrowing, RBBB-like morphology, improved hemodynamics. Loss of biventricular pacing (fusion, pseudofusion, undersensing) reduces benefit.",
        aseRef: "ACC/AHA 2022 Heart Failure Guidelines",
      },
      {
        name: "Failure to Pace",
        criteria: [
          { label: "Finding", value: "Pacing spike present but NO QRS follows", flag: "danger" },
          { label: "Causes", value: "Lead fracture, lead displacement, exit block, battery depletion", flag: "danger" },
          { label: "Management", value: "Urgent device interrogation; transcutaneous pacing if symptomatic", flag: "danger" },
        ],
        clinicalNote: "Distinguish from failure to capture. Failure to pace: no spike when expected (sensing problem). Failure to capture: spike present but no QRS (capture problem). Both require urgent device evaluation.",
      },
      {
        name: "Failure to Sense",
        criteria: [
          { label: "Finding", value: "Pacing spikes occur despite adequate intrinsic activity (undersensing)", flag: "danger" },
          { label: "Risk", value: "R-on-T phenomenon → VF if spike falls on T wave", flag: "danger" },
          { label: "Causes", value: "Lead displacement, programming error, electrolyte disturbance, fibrosis", flag: "danger" },
        ],
        clinicalNote: "Oversensing (inhibition of pacing by non-cardiac signals — myopotentials, T waves) is the opposite problem — pacemaker inhibited when it should pace. Both require device interrogation.",
      },
    ],
  },
  {
    id: "lvh-rvh",
    title: "Ventricular Hypertrophy",
    icon: BarChart3,
    color: "#189aa1",
    patterns: [
      {
        name: "Left Ventricular Hypertrophy (LVH)",
        criteria: [
          { label: "Sokolow-Lyon", value: "SV1 + RV5 or RV6 ≥35 mm", flag: "warn" },
          { label: "Cornell voltage", value: "RaVL + SV3 >28 mm (men); >20 mm (women)", flag: "warn" },
          { label: "Cornell product", value: "Cornell voltage × QRS duration >2440 mm·ms", flag: "warn" },
          { label: "Romhilt-Estes", value: "Score ≥5 = definite LVH; 4 = probable", flag: "warn" },
          { label: "ST-T changes", value: "Strain pattern: ST depression + T wave inversion in I, aVL, V5–V6", flag: "warn" },
        ],
        clinicalNote: "ECG has low sensitivity (~50%) but high specificity (~85–95%) for LVH. Strain pattern indicates pressure/volume overload. Echocardiography is the gold standard for LV mass quantification.",
        aseRef: "ASE 2015 Chamber Quantification Guidelines",
      },
      {
        name: "Right Ventricular Hypertrophy (RVH)",
        criteria: [
          { label: "R/S ratio in V1", value: ">1 (dominant R in V1)", flag: "warn" },
          { label: "R wave in V1", value: ">7 mm", flag: "warn" },
          { label: "S wave in V5/V6", value: ">7 mm", flag: "warn" },
          { label: "Right axis deviation", value: ">+90°", flag: "warn" },
          { label: "P pulmonale", value: "Peaked P >2.5 mm in II (RAE)", flag: "warn" },
          { label: "ST-T changes", value: "Strain pattern in V1–V3, III, aVF", flag: "warn" },
        ],
        clinicalNote: "Causes: pulmonary hypertension, pulmonary stenosis, cor pulmonale, congenital heart disease (ToF, Eisenmenger). Exclude RBBB (also gives dominant R in V1 but with RSR' pattern).",
      },
    ],
  },
];

// ─── Components ───────────────────────────────────────────────────────────────
function FlagBadge({ flag }: { flag?: "normal" | "warn" | "danger" }) {
  if (!flag) return null;
  const config = {
    normal: { bg: "#f0fdf4", text: "#16a34a", label: "Normal" },
    warn:   { bg: "#fffbeb", text: "#d97706", label: "Abnormal" },
    danger: { bg: "#fef2f2", text: "#dc2626", label: "Critical" },
  }[flag];
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ background: config.bg, color: config.text }}>
      {config.label}
    </span>
  );
}

function PatternCard({ pattern }: { pattern: Pattern }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-semibold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
          {pattern.name}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Criteria table */}
          <div className="rounded-lg overflow-hidden border border-gray-100">
            {pattern.criteria.map((c, i) => (
              <div key={i} className={`flex items-start justify-between gap-3 px-3 py-2 text-xs ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                <span className="text-gray-500 font-medium flex-shrink-0 w-40">{c.label}</span>
                <span className="text-gray-800 font-semibold flex-1">{c.value}</span>
                <FlagBadge flag={c.flag} />
              </div>
            ))}
          </div>
          {/* Clinical note */}
          {pattern.clinicalNote && (
            <div className="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">{pattern.clinicalNote}</p>
            </div>
          )}
          {/* Reference */}
          {pattern.aseRef && (
            <p className="text-[10px] text-gray-400 italic">Ref: {pattern.aseRef}</p>
          )}
        </div>
      )}
    </div>
  );
}

function SectionPanel({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  return (
    <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: section.color + "30" }}>
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:opacity-90"
        style={{ background: section.color + "0d" }}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: section.color + "20" }}>
            <Icon className="w-4.5 h-4.5" style={{ color: section.color }} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
              {section.title}
            </h3>
            <p className="text-xs text-gray-500">{section.patterns.length} patterns / criteria sets</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 flex-shrink-0" style={{ color: section.color }} />
          : <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: section.color }} />
        }
      </button>
      {open && (
        <div className="px-4 py-4 space-y-3 bg-white">
          {section.patterns.map((p) => (
            <PatternCard key={p.name} pattern={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ECGNavigator() {
  return (
    <Layout>
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, #0e1e2e 0%, ${BRAND_DARK} 60%, ${BRAND} 100%)` }}
      >
        <div className="relative container py-10 md:py-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ad9e0" }} />
              <span className="text-xs text-white/80 font-medium">Systematic ECG Interpretation</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
              style={{ fontFamily: "Merriweather, serif" }}>
              ECG Navigator
            </h1>
            <p className="text-white/70 text-sm leading-relaxed mb-5 max-w-lg">
              A comprehensive, guideline-based ECG interpretation reference covering rate, rhythm, blocks, ischemia, special patterns, and pacemaker ECGs. Based on AHA/ACC/HRS 2023 standards.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/ecg-coach">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                  style={{ background: BRAND }}>
                  <BookOpen className="w-4 h-4" />
                  ECG Coach
                </button>
              </Link>
              <Link href="/ecg-assist">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                  <Zap className="w-4 h-4" />
                  ECG Calculators
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="container py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Clinical Sections", value: sections.length.toString() },
              { label: "Patterns & Criteria", value: sections.reduce((a, s) => a + s.patterns.length, 0).toString() },
              { label: "Guideline Standard", value: "AHA/ACC 2023" },
              { label: "ECG Calculators", value: "12" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div>
                  <div className="text-lg font-bold" style={{ fontFamily: "JetBrains Mono, monospace", color: BRAND }}>{value}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="container py-8 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
            ECG Interpretation Sections
          </h2>
          <span className="text-xs text-gray-400">Tap any section to expand</span>
        </div>
        {sections.map((section) => (
          <SectionPanel key={section.id} section={section} />
        ))}

        {/* ECG Reference Images (admin-uploaded via ScanCoach Editor) */}

        {/* Cross-promo to ECG Coach and Calculators */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-5 border" style={{ borderColor: BRAND + "40", background: "#f0fbfc" }}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4" style={{ color: BRAND }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND }}>Premium</span>
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1" style={{ fontFamily: "Merriweather, serif" }}>ECG Coach</h3>
            <p className="text-xs text-gray-500 mb-3">Lead placement, right-sided & posterior leads, artifact recognition, pediatric & neonatal ECG differences.</p>
            <Link href="/ecg-coach">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white transition-all hover:opacity-90"
                style={{ background: BRAND }}>
                Open ECG Coach <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
          <div className="rounded-xl p-5 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4" style={{ color: "#189aa1" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#189aa1" }}>Premium</span>
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1" style={{ fontFamily: "Merriweather, serif" }}>ECG Calculators</h3>
            <p className="text-xs text-gray-500 mb-3">QTc (4 formulas), TIMI, GRACE, HEART Score, Sgarbossa, LVH voltage criteria, axis calculator, and more.</p>
            <Link href="/ecg-assist">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white transition-all hover:opacity-90"
                style={{ background: "#189aa1" }}>
                Open ECG Calculators <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
