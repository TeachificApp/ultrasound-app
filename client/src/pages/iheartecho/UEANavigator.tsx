/*
  UEA Navigator — iHeartEcho™
  Ultrasound Enhancing Agents (Contrast Echo) protocol navigator
  Covers: safety screening, indications, agent prep, view-by-view enhancement,
  LVO/myocardial perfusion assessment, and reporting guidance.
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  AlertTriangle, AlertCircle, Info, Scan, ExternalLink,
  Droplets, Shield, Eye, FileText, Activity, Zap, Heart
} from "lucide-react";
import { useNavigatorProtocol } from "@/hooks/useNavigatorProtocol";

const BRAND = "#189aa1";
const AQUA  = "#4ad9e0";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type CheckItem = { id: string; label: string; detail?: string; critical?: boolean };

// ─── SAFETY SCREENING CHECKLIST ───────────────────────────────────────────────

const safetyChecklist: CheckItem[] = [
  {
    id: "s1",
    label: "Confirm indication for UEA (LVO or myocardial perfusion)",
    detail: "UEA is indicated when ≥2 contiguous LV segments are not adequately visualised on unenhanced echo (ASE 2018 guideline).",
    critical: true,
  },
  {
    id: "s2",
    label: "Screen for known hypersensitivity to UEA or any component",
    detail: "Previous anaphylaxis to any UEA is an absolute contraindication. Mild prior reactions may be pre-medicated.",
    critical: true,
  },
  {
    id: "s3",
    label: "Screen for right-to-left intracardiac or pulmonary shunt",
    detail: "Definity/Lumason: contraindicated with known or suspected R-to-L shunt. Optison: use with caution.",
    critical: true,
  },
  {
    id: "s4",
    label: "Screen for worsening or clinically unstable heart failure",
    detail: "Severe decompensated HF is a relative contraindication for Definity. Assess clinical stability before proceeding.",
    critical: true,
  },
  {
    id: "s5",
    label: "Screen for acute MI, ACS, or unstable angina",
    detail: "Use with caution in the peri-infarct period. Benefit vs. risk assessment required.",
  },
  {
    id: "s6",
    label: "Screen for severe pulmonary hypertension (PAP >90 mmHg)",
    detail: "Relative contraindication for Definity. Lumason may be used with caution.",
  },
  {
    id: "s7",
    label: "Screen for respiratory distress or adult respiratory distress syndrome",
    detail: "Contraindicated in patients on ventilator support or with significant respiratory compromise.",
    critical: true,
  },
  {
    id: "s8",
    label: "Confirm IV access is patent and functional",
    detail: "Peripheral IV (18–20G) in antecubital fossa preferred. Avoid hand/wrist veins — higher haemolysis risk.",
  },
  {
    id: "s9",
    label: "Resuscitation equipment and trained personnel available",
    detail: "Emergency cart, oxygen, epinephrine, and staff trained in anaphylaxis management must be present.",
    critical: true,
  },
  {
    id: "s10",
    label: "Obtain informed consent (verbal or written per institutional policy)",
    detail: "Explain the procedure, benefits, and rare risk of serious adverse reactions.",
  },
  {
    id: "s11",
    label: "Confirm patient can remain in left lateral decubitus for 15–20 minutes",
    detail: "Positioning is essential for optimal LV visualisation.",
  },
  {
    id: "s12",
    label: "Document pre-procedure vital signs (BP, HR, SpO2)",
    detail: "Baseline vitals required for comparison during and after administration.",
  },
];

// ─── INDICATIONS ──────────────────────────────────────────────────────────────

const indications = [
  {
    category: "Class I Indications",
    color: "#16a34a",
    items: [
      "LV opacification (LVO) when ≥2 contiguous LV segments are not visualised on unenhanced TTE",
      "Suspected apical thrombus or mass — differentiate thrombus from artifact",
      "Suspected apical hypertrophic cardiomyopathy (apical HCM)",
      "Suspected non-compaction cardiomyopathy (LVNC)",
      "Stress echo — inadequate baseline image quality",
    ],
  },
  {
    category: "Class II Indications",
    color: "#d97706",
    items: [
      "Myocardial perfusion imaging (MPI) — detect CAD, perfusion defects",
      "Characterisation of intracardiac masses (differentiate vascular vs. avascular)",
      "Assessment of ventricular assist device (VAD) function",
      "Evaluation of prosthetic valve function when image quality is suboptimal",
      "Congenital heart disease assessment when standard views are inadequate",
    ],
  },
  {
    category: "Relative Contraindications",
    color: "#dc2626",
    items: [
      "Known or suspected right-to-left intracardiac or pulmonary shunt",
      "Worsening or clinically unstable heart failure",
      "Acute MI, ACS, or unstable angina",
      "Severe pulmonary hypertension (PAP >90 mmHg)",
      "Respiratory distress or ventilator dependence",
      "Known hypersensitivity to UEA or any excipient",
    ],
  },
];

// ─── AGENTS ───────────────────────────────────────────────────────────────────

const agents = [
  {
    name: "Definity® (Perflutren Lipid Microsphere)",
    manufacturer: "Lantheus Medical Imaging",
    shell: "Lipid shell",
    gas: "Perflutren (octafluoropropane)",
    size: "Mean diameter 1.1–3.3 µm",
    approved: "LVO (FDA); off-label MPI",
    preparation: [
      "Activate vial by mechanical agitation (Vialmix) for 45 seconds",
      "Invert vial and withdraw dose with a 21G or larger needle",
      "Dilute in 1 mL NS if bolus injection preferred",
      "Use within 5 minutes of activation",
    ],
    dosing: "Bolus: 10 µL/kg IV (max 720 µL); or infusion: 1.3 mL diluted in 50 mL NS at 4 mL/min",
    storage: "Refrigerate at 2–8°C; do not freeze",
    notes: "FDA black box warning: serious cardiopulmonary reactions reported. Monitor for 30 min post-injection.",
  },
  {
    name: "Lumason® / SonoVue® (Sulfur Hexafluoride Lipid-type A Microspheres)",
    manufacturer: "Bracco Diagnostics",
    shell: "Phospholipid shell",
    gas: "Sulfur hexafluoride (SF6)",
    size: "Mean diameter 2.5 µm",
    approved: "LVO (FDA 2014); liver lesion characterization (FDA 2016); cardiac and liver (EMA)",
    preparation: [
      "Remove vial from refrigerator and allow to reach room temperature (5 min)",
      "Attach the transfer system (blue cap + white needle) to the vial",
      "Inject 5 mL of 0.9% NaCl from the pre-filled syringe into the vial",
      "Gently shake the vial for 20 seconds until a uniform milky-white suspension forms",
      "Invert the vial and withdraw the required dose into the syringe",
      "Administer within 6 hours of reconstitution; gently re-agitate if >5 min has elapsed",
      "Discard any unused portion after 6 hours",
    ],
    dosing: "Bolus: 2.0 mL IV followed by 5 mL NS flush; may repeat once (total max 4.0 mL per study). Infusion: 4.0 mL diluted in 50 mL NS at 1–2 mL/min (titrate to image quality)",
    storage: "Refrigerate at 2–8°C before reconstitution; store reconstituted suspension at room temperature (≤30°C)",
    notes: "No FDA black box warning — preferred agent for patients with cardiopulmonary instability, worsening heart failure, or severe pulmonary hypertension. Contraindicated in known/suspected R-to-L shunt. Sulfur hexafluoride gas is biologically inert and eliminated via respiration within minutes.",
  },
  {
    name: "Agitated Saline (Bubble Study)",
    manufacturer: "No manufacturer — prepared bedside",
    shell: "Air microbubbles in saline",
    gas: "Room air",
    size: "Variable (50–200 µm) — too large to cross pulmonary capillaries normally",
    approved: "Not FDA-approved as a contrast agent; used off-label for shunt detection and PLSVC",
    preparation: [
      "Prepare two 10 mL syringes connected by a 3-way stopcock",
      "Fill one syringe with 9 mL normal saline (NS) + 1 mL room air (10:1 ratio)",
      "Agitate vigorously by rapidly transferring between syringes 10–15 times",
      "Administer immediately after agitation (within 5 seconds) — bubbles dissolve rapidly",
      "Optional: add 0.1–0.5 mL of patient’s own blood to improve bubble stability",
      "Repeat injections as needed (typically 2–3 injections per study)",
    ],
    dosing: "Inject 10 mL agitated saline IV as a rapid bolus; repeat with Valsalva maneuver (bear down for 5 seconds, release just before injection)",
    storage: "Prepared immediately before use; cannot be stored",
    notes: "Bubbles are too large to cross normal pulmonary capillaries. Appearance in left heart within 3 cardiac cycles = intracardiac R-to-L shunt (PFO/ASD). Appearance after 3–5 cycles = intrapulmonary shunt (HHT, hepatopulmonary syndrome). Early coronary sinus opacification = PLSVC. No adverse reactions reported with agitated saline.",
  },
  {
    name: "Optison® (Perflutren Protein-Type A Microspheres)",
    manufacturer: "GE HealthCare",
    shell: "Human albumin shell",
    gas: "Perflutren (octafluoropropane)",
    size: "Mean diameter 3.0–4.5 µm",
    approved: "LVO (FDA)",
    preparation: [
      "Gently invert vial 10 times before withdrawal",
      "Withdraw 0.5 mL for IV bolus",
      "Do not shake vigorously — excessive agitation destroys microspheres",
    ],
    dosing: "Bolus: 0.5 mL IV; may repeat up to 5.0 mL total per study",
    storage: "Refrigerate at 2–8°C; do not freeze",
    notes: "Albumin shell — caution in patients with albumin allergy. Largest microsphere size — may not pass pulmonary capillaries in severe PHT.",
  },
];

// ─── BUBBLE STUDY PROTOCOL ───────────────────────────────────────────────────

const bubbleStudyChecklist: CheckItem[] = [
  { id: "bs1", label: "Confirm indication: PFO/ASD screening, intrapulmonary shunt, or PLSVC evaluation", detail: "Bubble study is the gold standard for detecting intracardiac R-to-L shunts. Also used to confirm PLSVC when coronary sinus is dilated.", critical: true },
  { id: "bs2", label: "Obtain large-bore peripheral IV access (18G or larger) in antecubital fossa", detail: "Antecubital or basilic vein preferred. Avoid hand/wrist veins — poor bubble delivery. For PLSVC evaluation, inject from LEFT arm to opacify coronary sinus first.", critical: true },
  { id: "bs3", label: "Prepare agitated saline: 9 mL NS + 1 mL air in two 10 mL syringes via 3-way stopcock", detail: "Agitate vigorously 10–15 times. Administer within 5 seconds of preparation. Optional: add 0.1–0.5 mL blood to improve bubble stability." },
  { id: "bs4", label: "Obtain A4C view — optimize for RV and LV visualization before injection", detail: "A4C is the primary view. Subcostal 4-chamber is an excellent alternative. Ensure both atria are clearly visible.", critical: true },
  { id: "bs5", label: "Baseline injection (no Valsalva) — inject 10 mL agitated saline as rapid IV bolus", detail: "Confirm RV opacification to verify IV placement and adequate bubble delivery. Observe for any immediate LV opacification (large shunt)." },
  { id: "bs6", label: "Valsalva injection — patient bears down for 5 seconds, release just before injection", detail: "Valsalva increases RA pressure transiently, forcing open a PFO. The Valsalva release (not the strain) is when shunting occurs — time injection so bubbles arrive during release.", critical: true },
  { id: "bs7", label: "Count cardiac cycles from RV opacification to first LV bubble appearance", detail: "≤3 cycles = intracardiac shunt (PFO/ASD). 3–5 cycles = intrapulmonary shunt (HHT, hepatopulmonary syndrome, cirrhosis).", critical: true },
  { id: "bs8", label: "Grade shunt severity (0–3+) based on number of bubbles in LV", detail: "Grade 0: no bubbles. Grade 1+: 1–10 bubbles. Grade 2+: 11–30 bubbles. Grade 3+: >30 bubbles or complete LV opacification." },
  { id: "bs9", label: "For PLSVC evaluation: inject from LEFT arm and observe coronary sinus in PLAX/A4C", detail: "In PLSVC, the left arm injection opacifies the coronary sinus BEFORE the RA/RV. Dilated coronary sinus (>10 mm) + early opacification = PLSVC confirmed.", critical: true },
  { id: "bs10", label: "Repeat injection from RIGHT arm for comparison (PLSVC evaluation)", detail: "Right arm injection opacifies RA/RV first (normal pattern). Comparing left vs. right arm injections confirms PLSVC diagnosis." },
  { id: "bs11", label: "Document findings: timing, grade, and injection site", detail: "Report: 'Bubble study positive/negative for R-to-L shunt. Grade X+. Timing: X cardiac cycles after RV opacification. Injection site: left/right antecubital.'" },
];

const bubbleGrading = [
  { grade: "Grade 0", bubbles: "No bubbles in LV", interpretation: "No shunt detected", color: "#16a34a" },
  { grade: "Grade 1+", bubbles: "1–10 bubbles", interpretation: "Small shunt — PFO likely", color: "#d97706" },
  { grade: "Grade 2+", bubbles: "11–30 bubbles", interpretation: "Moderate shunt — PFO or small ASD", color: "#ea580c" },
  { grade: "Grade 3+", bubbles: ">30 bubbles or complete LV opacification", interpretation: "Large shunt — large ASD or significant PFO", color: "#dc2626" },
];

const plsvcFindings = [
  { finding: "Dilated coronary sinus", detail: "CS diameter >10 mm (normal <10 mm). Measured in PLAX at the level of the posterior mitral annulus. Sensitivity ~90% for PLSVC.", significance: "Key screening finding" },
  { finding: "Early CS opacification on left arm bubble study", detail: "Bubbles appear in coronary sinus before RA/RV when injected from LEFT arm. Pathognomonic for PLSVC draining into CS.", significance: "Diagnostic" },
  { finding: "Normal right arm bubble study", detail: "Right arm injection shows normal RA → RV opacification sequence. Confirms PLSVC is an additional vessel, not replacing the RSVC.", significance: "Confirms isolated PLSVC" },
  { finding: "Absent or small RSVC", detail: "In ~20% of PLSVC cases, the RSVC is absent or hypoplastic. Assess SVC size in suprasternal or right parasternal views.", significance: "Surgical planning" },
  { finding: "Associated CHD", detail: "PLSVC is associated with ASD (10–15%), VSD, bicuspid aortic valve, and other congenital anomalies. Complete structural assessment required.", significance: "Screen for associated lesions" },
  { finding: "CS-to-LA communication (unroofed CS)", detail: "Rare variant: PLSVC drains into LA via unroofed CS. Presents as cyanosis. Bubble study from left arm shows LA opacification before RA.", significance: "Critical — causes cyanosis" },
];

// ─── VIEW-BY-VIEW PROTOCOL ────────────────────────────────────────────────────

type ViewSection = {
  id?: string;             // matches sectionId in Navigator Editor for DB merge
  view: string;
  probe: string;           // maps to ProtocolSection.probe (same as window for UEA)
  window: string;          // kept for backward compat with static data
  items: CheckItem[];
  tips: string[];
  normalFindings: string[];
  abnormalFindings: string[];
};

const viewProtocol: ViewSection[] = [
  {
    id: "plax",
    view: "Parasternal Long Axis (PLAX)",
    probe: "Parasternal window",
    window: "Parasternal",
    items: [
      { id: "plax_lvo", label: "LV opacification — anterior septum and posterior wall", detail: "Confirm contrast fills LV cavity uniformly. Assess septal and posterior wall thickness.", critical: true },
      { id: "plax_mv", label: "Mitral valve and subvalvular apparatus", detail: "Contrast helps delineate chordae, papillary muscles, and subvalvular structures." },
      { id: "plax_aorta", label: "Aortic root and proximal ascending aorta", detail: "Contrast may enhance aortic root dimensions and identify dissection flap." },
      { id: "plax_mass", label: "Assess for intracardiac mass or thrombus", detail: "Avascular masses (thrombus) appear as filling defects. Vascular masses (tumour) enhance with contrast.", critical: true },
      { id: "plax_pericardium", label: "Pericardial effusion assessment", detail: "Contrast does not enter pericardial space — confirms effusion vs. other structures." },
    ],
    tips: [
      "Reduce MI to 0.1–0.2 for contrast imaging — high MI destroys microbubbles",
      "Reduce gain by 30–50% from standard settings to avoid blooming artifact",
      "Increase depth to include full LV — contrast fills apex last",
    ],
    normalFindings: ["Uniform LV cavity opacification", "No filling defects", "Clear delineation of all wall segments"],
    abnormalFindings: ["Filling defect at apex — thrombus vs. artifact", "Non-uniform enhancement — wall motion abnormality", "Enhancing mass — consider myxoma or metastasis"],
  },
  {
    id: "psax_mv",
    view: "Parasternal Short Axis (PSAX) — Mitral Level",
    probe: "Parasternal window",
    window: "Parasternal",
    items: [
      { id: "psax_mv_lvo", label: "LV opacification at mitral valve level", detail: "All 6 segments at mitral level should opacify uniformly." },
      { id: "psax_mv_wma", label: "Wall motion assessment — anterior, lateral, inferior, posterior, septal", detail: "Contrast improves endocardial border definition for regional WMA assessment." },
      { id: "psax_mv_pap", label: "Papillary muscle visualisation", detail: "Contrast delineates papillary muscle anatomy — important for LVNC and HCM." },
    ],
    tips: [
      "PSAX mitral level is ideal for identifying circumferential perfusion defects",
      "Rotate probe to align true short axis — avoid oblique cuts",
    ],
    normalFindings: ["Uniform opacification of all 6 segments", "Symmetric wall thickness"],
    abnormalFindings: ["Segmental perfusion defect — CAD territory", "Asymmetric hypertrophy — HCM"],
  },
  {
    id: "psax_pm",
    view: "Parasternal Short Axis (PSAX) — Mid-Papillary Level",
    probe: "Parasternal window",
    window: "Parasternal",
    items: [
      { id: "psax_pap_lvo", label: "LV opacification at mid-papillary level", detail: "Critical level for myocardial perfusion imaging — 6 segments assessed.", critical: true },
      { id: "psax_pap_wma", label: "Regional wall motion assessment (6 segments)", detail: "LAD: anterior, anteroseptal. LCx: anterolateral, inferolateral. RCA: inferior, inferoseptal." },
      { id: "psax_pap_mpi", label: "Myocardial perfusion — flash replenishment technique", detail: "High-MI flash destroys bubbles; observe replenishment pattern. Delayed or absent = perfusion defect.", critical: true },
    ],
    tips: [
      "Mid-papillary PSAX is the single most important view for myocardial perfusion imaging",
      "Use flash-replenishment: send high-MI pulse (flash), then observe bubble replenishment over 4–6 cardiac cycles",
      "Normal replenishment: uniform, rapid (<4 beats). Abnormal: delayed, patchy, or absent",
    ],
    normalFindings: ["Rapid uniform replenishment in all 6 segments", "No resting perfusion defects"],
    abnormalFindings: ["Delayed replenishment — ischaemia or scar", "Absent replenishment — infarct", "Patchy replenishment — microvascular disease"],
  },
  {
    id: "psax_apex",
    view: "Parasternal Short Axis (PSAX) — Apical Level",
    probe: "Parasternal window",
    window: "Parasternal",
    items: [
      { id: "psax_apex_lvo", label: "LV opacification at apical level", detail: "Apical segments are often the most difficult to visualise — contrast is most beneficial here." },
      { id: "psax_apex_wma", label: "Apical wall motion assessment", detail: "Apical cap, anterior apex, inferior apex, lateral apex." },
    ],
    tips: [
      "Apical PSAX is technically challenging — ensure true short axis at apex",
      "Contrast significantly improves apical segment visualisation",
    ],
    normalFindings: ["Uniform apical opacification", "Symmetric apical wall motion"],
    abnormalFindings: ["Apical filling defect — thrombus", "Apical ballooning — Takotsubo", "Apical akinesis — LAD territory infarct"],
  },
  {
    id: "a4c",
    view: "Apical 4-Chamber (A4C)",
    probe: "Apical window",
    window: "Apical",
    items: [
      { id: "a4c_lvo", label: "LV opacification — all apical and mid segments", detail: "Confirm contrast fills apex completely. Apical thrombus appears as filling defect.", critical: true },
      { id: "a4c_ef", label: "LV volumes and EF (biplane Simpson's)", detail: "Contrast dramatically improves EF accuracy — trace endocardial border at end-diastole and end-systole.", critical: true },
      { id: "a4c_wma", label: "Regional wall motion — lateral and septal walls", detail: "Lateral: LCx territory. Septal: LAD/RCA territory." },
      { id: "a4c_thrombus", label: "Apical thrombus assessment", detail: "Avascular thrombus = filling defect. Contrast is more sensitive than unenhanced echo for thrombus detection.", critical: true },
      { id: "a4c_mass", label: "Intracardiac mass characterisation", detail: "Vascular mass enhances; avascular (thrombus, calcification) does not." },
      { id: "a4c_lvnc", label: "Non-compaction assessment (if suspected)", detail: "Contrast fills deep trabecular recesses — NC:C ratio >2.3 (systole) supports LVNC diagnosis." },
    ],
    tips: [
      "A4C is the most important view for LVO — EF measurement improves significantly with contrast",
      "Reduce depth to include only LV — RV can be excluded if not needed",
      "Harmonic imaging + low MI (0.1–0.2) is optimal for contrast A4C",
      "Patient positioning: steep left lateral decubitus with left arm raised",
    ],
    normalFindings: ["Complete LV opacification including apex", "No apical filling defects", "EF ≥55% (normal)", "Uniform wall motion"],
    abnormalFindings: ["Apical filling defect — thrombus (sensitivity >90% with contrast)", "Apical ballooning — Takotsubo", "Apical HCM — spade-shaped cavity", "Reduced EF — systolic dysfunction"],
  },
  {
    id: "a2c",
    view: "Apical 2-Chamber (A2C)",
    probe: "Apical window",
    window: "Apical",
    items: [
      { id: "a2c_lvo", label: "LV opacification — anterior and inferior walls", detail: "A2C provides the only apical view of the true anterior wall (LAD territory)." },
      { id: "a2c_ef", label: "Biplane EF (A4C + A2C)", detail: "Required for accurate biplane Simpson's EF calculation with contrast.", critical: true },
      { id: "a2c_wma", label: "Anterior and inferior wall motion", detail: "Anterior: LAD territory. Inferior: RCA territory." },
    ],
    tips: [
      "Rotate probe 60° counterclockwise from A4C to obtain A2C",
      "Confirm anterior and inferior walls are in view — not lateral/septal",
    ],
    normalFindings: ["Uniform anterior and inferior wall opacification", "Normal wall motion"],
    abnormalFindings: ["Anterior wall hypokinesis/akinesis — LAD ischaemia", "Inferior wall abnormality — RCA territory"],
  },
  {
    id: "aplax",
    view: "Apical 3-Chamber / Long Axis (A3C/APLAX)",
    probe: "Apical window",
    window: "Apical",
    items: [
      { id: "a3c_lvo", label: "LV opacification — anteroseptal and inferolateral walls", detail: "Completes the 17-segment model with A4C and A2C." },
      { id: "a3c_lvot", label: "LVOT and aortic valve assessment", detail: "Contrast may help delineate LVOT obstruction in HCM." },
      { id: "a3c_ef", label: "Triplane EF (if available)", detail: "Some platforms support triplane EF with contrast — improves accuracy further." },
    ],
    tips: [
      "Rotate probe 30–60° counterclockwise from A2C to obtain A3C",
      "LVOT is best seen in this view — useful for HOCM assessment",
    ],
    normalFindings: ["Uniform anteroseptal and inferolateral opacification"],
    abnormalFindings: ["LVOT obstruction with systolic anterior motion (SAM)", "Inferolateral akinesis — LCx territory"],
  },
  {
    id: "subcostal",
    view: "Subcostal 4-Chamber",
    probe: "Subcostal window",
    window: "Subcostal",
    items: [
      { id: "sub_lvo", label: "LV opacification — inferior and inferoseptal walls", detail: "Subcostal view is useful when apical windows are poor." },
      { id: "sub_rv", label: "RV opacification and size assessment", detail: "Contrast fills RV cavity — useful for RV thrombus or mass assessment." },
      { id: "sub_ivc", label: "IVC assessment", detail: "Contrast does not affect IVC assessment — standard technique applies." },
    ],
    tips: [
      "Subcostal view is an excellent alternative window when apical windows are poor",
      "Useful in post-surgical or obese patients",
      "Contrast fills inferior and inferoseptal walls first from this window",
    ],
    normalFindings: ["Uniform inferior and inferoseptal opacification"],
    abnormalFindings: ["Inferior wall akinesis — RCA territory", "RV thrombus — filling defect"],
  },
];

// ─── REPORTING GUIDANCE ───────────────────────────────────────────────────────

const reportingItems: CheckItem[] = [
  { id: "r1", label: "Document UEA agent used, dose, and route of administration", detail: "Include brand name, lot number, and expiry date per institutional policy.", critical: true },
  { id: "r2", label: "State indication for UEA use", detail: "e.g., 'UEA administered for LV opacification — ≥2 segments suboptimally visualised on unenhanced imaging'." },
  { id: "r3", label: "Report LV volumes and EF with contrast", detail: "State 'LVEF X% (contrast-enhanced biplane Simpson's method)'. Normal: ≥55%." },
  { id: "r4", label: "Report regional wall motion findings per 17-segment model", detail: "Use ASE 17-segment nomenclature. Grade: 1=Normal, 2=Hypokinetic, 3=Akinetic, 4=Dyskinetic, 5=Aneurysmal." },
  { id: "r5", label: "Report presence or absence of apical thrombus", detail: "State 'No filling defect identified in LV apex to suggest thrombus' or describe defect location and characteristics.", critical: true },
  { id: "r6", label: "Report myocardial perfusion findings (if MPI performed)", detail: "Describe replenishment pattern per territory: LAD, LCx, RCA. State: normal, delayed, or absent." },
  { id: "r7", label: "Document any adverse reactions during or after administration", detail: "Record any haemodynamic changes, allergic reactions, or other adverse events.", critical: true },
  { id: "r8", label: "Document post-procedure monitoring period and patient status", detail: "30-minute monitoring period recommended. Record vital signs at 5, 15, and 30 minutes." },
];

// ─── REFERENCE VALUES ─────────────────────────────────────────────────────────

const referenceValues = [
  { parameter: "LVEF (Normal)", value: "≥55%", method: "Biplane Simpson's with contrast" },
  { parameter: "LVEF (Mildly reduced)", value: "41–54%", method: "Biplane Simpson's with contrast" },
  { parameter: "LVEF (Moderately reduced)", value: "30–40%", method: "Biplane Simpson's with contrast" },
  { parameter: "LVEF (Severely reduced)", value: "<30%", method: "Biplane Simpson's with contrast" },
  { parameter: "LV EDV (Male)", value: "62–150 mL", method: "Contrast-enhanced biplane" },
  { parameter: "LV EDV (Female)", value: "46–106 mL", method: "Contrast-enhanced biplane" },
  { parameter: "LV ESV (Male)", value: "21–61 mL", method: "Contrast-enhanced biplane" },
  { parameter: "LV ESV (Female)", value: "14–42 mL", method: "Contrast-enhanced biplane" },
  { parameter: "Flash replenishment (Normal)", value: "<4 cardiac cycles", method: "High-MI flash technique" },
  { parameter: "LVNC NC:C ratio (Systole)", value: ">2.3 (Jenni criteria)", method: "Contrast-enhanced PSAX" },
  { parameter: "Apical HCM cavity", value: "Spade-shaped; apical:basal wall ratio >1.5", method: "Contrast A4C/A2C" },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function UEANavigator() {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  // Use DB overrides if available (seeded via Navigator Editor), else fall back to static
  const { sections: protocol } = useNavigatorProtocol("uea", viewProtocol);
  const [expandedSection, setExpandedSection] = useState<string | null>("safety");
  const [expandedView, setExpandedView] = useState<string | null>("Apical 4-Chamber (A4C)");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const toggle = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSection = (id: string) =>
    setExpandedSection(prev => (prev === id ? null : id));

  const safetyComplete = safetyChecklist.filter(i => checkedItems.has(i.id)).length;
  const reportComplete = reportingItems.filter(i => checkedItems.has(i.id)).length;
  const bubbleComplete = bubbleStudyChecklist.filter(i => checkedItems.has(i.id)).length;

  return (
    <Layout>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="relative container py-10 md:py-14">
          <div className="mb-3">
            <BackToEchoAssist className="text-white/70 hover:text-white" />
          </div>
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
              <span className="text-xs text-white/80 font-medium">Guideline-Based Contrast Echo</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.12)" }}>
                <Droplets className="w-7 h-7 text-[#4ad9e0]" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight"
                  style={{ fontFamily: "Merriweather, serif" }}>
                  EchoAssist™ Navigator — UEA
                </h1>
                <p className="text-[#4ad9e0] font-semibold text-sm">Ultrasound Enhancing Agents — Contrast Echo Protocol</p>
              </div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed mb-5 max-w-2xl">
              A structured protocol for contrast echocardiography covering safety screening, agent selection,
              view-by-view LV opacification and myocardial perfusion assessment, and reporting guidance.
              Based on ASE 2018 and EACVI recommendations.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/uea-scan-coach">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                  <Scan className="w-4 h-4 text-[#4ad9e0]" />
                  UEA ScanCoach
                </button>
              </Link>
              <a href="https://www.asecho.org/guideline/guidelines-for-the-use-of-echocardiographic-contrast-agents/"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                <ExternalLink className="w-4 h-4" />
                ASE Guidelines
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-6">

        {/* ── Safety Screening ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection("safety")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#dc262615" }}>
                <Shield className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  Pre-Procedure Safety Screening
                </h2>
                <p className="text-xs text-gray-400">
                  {safetyComplete}/{safetyChecklist.length} items checked
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {safetyComplete === safetyChecklist.length && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  Complete
                </span>
              )}
              {expandedSection === "safety" ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {expandedSection === "safety" && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="mt-4 mb-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed">
                  <strong>FDA Black Box Warning (Definity/Optison):</strong> Serious cardiopulmonary reactions including fatalities have been reported. Resuscitation equipment and trained personnel must be available during and for at least 30 minutes after UEA administration.
                </p>
              </div>
              <div className="space-y-2">
                {safetyChecklist.map(item => (
                  <button
                    key={item.id}
                    className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                    onClick={() => toggle(item.id)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {checkedItems.has(item.id) ? (
                        <CheckCircle2 className="w-4 h-4" style={{ color: BRAND }} />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${checkedItems.has(item.id) ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {item.label}
                        </span>
                        {item.critical && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      {item.detail && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Indications ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection("indications")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
                <FileText className="w-4 h-4" style={{ color: BRAND }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  Indications & Contraindications
                </h2>
                <p className="text-xs text-gray-400">ASE Class I and II indications</p>
              </div>
            </div>
            {expandedSection === "indications" ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSection === "indications" && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="mt-4 space-y-4">
                {indications.map(group => (
                  <div key={group.category}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: group.color }} />
                      <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>
                        {group.category}
                      </h3>
                    </div>
                    <ul className="space-y-1.5 ml-4">
                      {group.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: group.color }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Agent Selection ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection("agents")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: AQUA + "20" }}>
                <Droplets className="w-4 h-4" style={{ color: BRAND }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  UEA Agents — Preparation & Dosing
                </h2>
                <p className="text-xs text-gray-400">Definity, Lumason, Optison, Agitated Saline</p>
              </div>
            </div>
            {expandedSection === "agents" ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSection === "agents" && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="mt-4 space-y-3">
                {agents.map(agent => (
                  <div key={agent.name} className="rounded-lg border border-gray-100 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedAgent(prev => prev === agent.name ? null : agent.name)}
                    >
                      <div>
                        <div className="text-sm font-bold text-gray-800">{agent.name}</div>
                        <div className="text-xs text-gray-400">{agent.manufacturer} · {agent.gas}</div>
                      </div>
                      {expandedAgent === agent.name ? (
                        <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {expandedAgent === agent.name && (
                      <div className="px-4 pb-4 border-t border-gray-100 space-y-3">
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Shell</div>
                            <div className="text-xs text-gray-700">{agent.shell}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Size</div>
                            <div className="text-xs text-gray-700">{agent.size}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">FDA Approval</div>
                            <div className="text-xs text-gray-700">{agent.approved}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Storage</div>
                            <div className="text-xs text-gray-700">{agent.storage}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Dosing</div>
                          <div className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{agent.dosing}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Preparation Steps</div>
                          <ol className="space-y-1">
                            {agent.preparation.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                                  style={{ background: BRAND }}>
                                  {i + 1}
                                </span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                        {agent.notes && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 leading-relaxed">{agent.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Machine Settings ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection("machine")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
                <Zap className="w-4 h-4" style={{ color: BRAND }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  Machine Optimization for Contrast Imaging
                </h2>
                <p className="text-xs text-gray-400">MI, gain, depth, and harmonic settings</p>
              </div>
            </div>
            {expandedSection === "machine" ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSection === "machine" && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Mechanical Index (MI)", value: "0.1–0.2", detail: "Low MI preserves microbubbles. High MI (>0.5) destroys contrast — use only for flash replenishment." },
                  { label: "Imaging Mode", value: "Contrast Harmonic Imaging", detail: "Activate contrast-specific mode (e.g., CPS, Power Modulation, Pulse Inversion Harmonic). Do NOT use standard B-mode." },
                  { label: "Gain", value: "Reduce 30–50% from standard", detail: "Over-gain causes blooming artifact. Start low and increase until endocardial border is clearly defined." },
                  { label: "Depth", value: "Minimum to include full LV", detail: "Shallower depth improves frame rate and contrast resolution. Exclude structures not needed." },
                  { label: "Focus", value: "Single focus at mid-LV level", detail: "Multiple foci reduce frame rate. Single focus at mid-ventricle is optimal." },
                  { label: "Frame Rate", value: ">25 fps (ideally >50 fps)", detail: "Higher frame rate improves detection of wall motion abnormalities and perfusion dynamics." },
                  { label: "Dynamic Range / Compression", value: "Reduce by 10–20 dB", detail: "Lower dynamic range improves contrast-to-tissue ratio." },
                  { label: "Reject / Threshold", value: "Increase slightly", detail: "Helps suppress low-level tissue signals and improve contrast conspicuity." },
                ].map(({ label, value, detail }) => (
                  <div key={label} className="p-3 rounded-lg border border-gray-100" style={{ background: "#f0fbfc" }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>{label}</div>
                    <div className="text-sm font-bold text-gray-800 mb-0.5">{value}</div>
                    <div className="text-xs text-gray-500 leading-relaxed">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* ── Bubble Study Protocol ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection("bubble")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#e0f2fe" }}>
                <Droplets className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  Agitated Saline Bubble Study Protocol
                </h2>
                <p className="text-xs text-gray-400">
                  {bubbleComplete}/{bubbleStudyChecklist.length} steps checked · PFO/ASD · Intrapulmonary shunt · PLSVC
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {bubbleComplete === bubbleStudyChecklist.length && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">Complete</span>
              )}
              {expandedSection === "bubble" ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {expandedSection === "bubble" && (
            <div className="px-5 pb-5 border-t border-gray-100">
              {/* Info banner */}
              <div className="mt-4 mb-4 flex items-start gap-2 p-3 rounded-lg bg-sky-50 border border-sky-200">
                <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-sky-800 leading-relaxed">
                  <strong>Agitated saline bubbles are too large to cross normal pulmonary capillaries.</strong> Appearance in the left heart ≤3 cardiac cycles after RV opacification = intracardiac R-to-L shunt. Appearance after 3–5 cycles = intrapulmonary shunt. Early coronary sinus opacification (left arm injection) = PLSVC.
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-1.5 mb-5">
                {bubbleStudyChecklist.map(item => (
                  <button
                    key={item.id}
                    className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                    onClick={() => toggle(item.id)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {checkedItems.has(item.id) ? (
                        <CheckCircle2 className="w-4 h-4" style={{ color: BRAND }} />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${checkedItems.has(item.id) ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {item.label}
                        </span>
                        {item.critical && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">CRITICAL</span>
                        )}
                      </div>
                      {item.detail && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Shunt Grading Table */}
              <div className="mb-5">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>Shunt Grading (Spencer Scale)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-4 font-bold text-gray-600">Grade</th>
                        <th className="text-left py-2 pr-4 font-bold text-gray-600">Bubbles in LV</th>
                        <th className="text-left py-2 font-bold text-gray-600">Interpretation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bubbleGrading.map((row, i) => (
                        <tr key={i} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                          <td className="py-2 pr-4 font-bold" style={{ color: row.color }}>{row.grade}</td>
                          <td className="py-2 pr-4 text-gray-700">{row.bubbles}</td>
                          <td className="py-2 text-gray-600">{row.interpretation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Timing interpretation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">No Bubbles in LV</div>
                  <div className="text-xs text-green-800 font-semibold mb-1">Negative Study</div>
                  <div className="text-xs text-green-700">No R-to-L shunt detected at rest or with Valsalva</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">≤3 Cardiac Cycles</div>
                  <div className="text-xs text-amber-800 font-semibold mb-1">Intracardiac Shunt</div>
                  <div className="text-xs text-amber-700">PFO, ASD, or other intracardiac R-to-L communication</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">3–5 Cardiac Cycles</div>
                  <div className="text-xs text-blue-800 font-semibold mb-1">Intrapulmonary Shunt</div>
                  <div className="text-xs text-blue-700">HHT, hepatopulmonary syndrome, pulmonary AVMs, cirrhosis</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── PLSVC Section ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection("plsvc")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#fdf4ff" }}>
                <Activity className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  PLSVC — Persistent Left Superior Vena Cava
                </h2>
                <p className="text-xs text-gray-400">Echo findings · Bubble study diagnosis · Clinical implications</p>
              </div>
            </div>
            {expandedSection === "plsvc" ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {expandedSection === "plsvc" && (
            <div className="px-5 pb-5 border-t border-gray-100">
              {/* Overview */}
              <div className="mt-4 mb-4 p-4 rounded-lg bg-purple-50 border border-purple-200">
                <h3 className="text-xs font-bold text-purple-800 mb-2">What is PLSVC?</h3>
                <p className="text-xs text-purple-700 leading-relaxed">
                  Persistent Left Superior Vena Cava (PLSVC) is the most common congenital thoracic venous anomaly, occurring in 0.3–0.5% of the general population and 4–8% of patients with congenital heart disease. The left SVC persists from embryonic development and typically drains into the right atrium via a dilated coronary sinus. It is usually an incidental finding but has important implications for pacemaker implantation, central line placement, and cardiac surgery.
                </p>
              </div>

              {/* Echo Findings Table */}
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>Echo Findings & Diagnostic Criteria</div>
              <div className="space-y-3 mb-5">
                {plsvcFindings.map((item, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="text-sm font-bold text-gray-800">{item.finding}</div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: item.significance === "Diagnostic" ? "#f0fdf4" : item.significance === "Critical — causes cyanosis" ? "#fef2f2" : "#f0f9ff",
                          color: item.significance === "Diagnostic" ? "#16a34a" : item.significance === "Critical — causes cyanosis" ? "#dc2626" : "#0369a1",
                          border: `1px solid ${item.significance === "Diagnostic" ? "#bbf7d0" : item.significance === "Critical — causes cyanosis" ? "#fecaca" : "#bae6fd"}`
                        }}>
                        {item.significance}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>

              {/* Bubble Study Protocol for PLSVC */}
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs font-bold text-amber-800">Bubble Study Protocol for PLSVC Confirmation</div>
                </div>
                <ol className="space-y-1.5">
                  {[
                    "Inject agitated saline from LEFT antecubital vein — observe coronary sinus in PLAX view",
                    "PLSVC: coronary sinus opacifies BEFORE RA/RV (pathognomonic finding)",
                    "Repeat injection from RIGHT antecubital vein — normal RA → RV sequence confirms isolated PLSVC",
                    "Measure coronary sinus diameter in PLAX (normal <10 mm; dilated >10 mm suggests PLSVC)",
                    "Assess for associated defects: ASD, VSD, bicuspid aortic valve",
                    "If LA opacifies before RA on left arm injection — consider unroofed coronary sinus (rare, causes cyanosis)",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                        style={{ background: "#d97706" }}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* ── View-by-View Protocol ─────────────────────────────────────────────────── */}  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection("views")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
                <Eye className="w-4 h-4" style={{ color: BRAND }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  View-by-View Protocol Checklist
                </h2>
                <p className="text-xs text-gray-400">{protocol.length} views — LVO and myocardial perfusion</p>
              </div>
            </div>
            {expandedSection === "views" ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSection === "views" && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="mt-4 space-y-3">
                {protocol.map(section => {
                  const sectionChecked = section.items.filter(i => checkedItems.has(i.id)).length;
                  const isExpanded = expandedView === section.view;
                  return (
                    <div key={section.view} className="rounded-lg border border-gray-100 overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedView(prev => prev === section.view ? null : section.view)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: BRAND + "15" }}>
                            <Heart className="w-3.5 h-3.5" style={{ color: BRAND }} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-800">{section.view}</div>
                            <div className="text-xs text-gray-400">{section.window} window · {sectionChecked}/{section.items.length} checked</div>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
                          {/* Checklist */}
                          <div className="mt-3 space-y-1.5">
                            {section.items.map(item => (
                              <button
                                key={item.id}
                                className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                                onClick={() => toggle(item.id)}
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  {checkedItems.has(item.id) ? (
                                    <CheckCircle2 className="w-4 h-4" style={{ color: BRAND }} />
                                  ) : (
                                    <Circle className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-sm font-medium ${checkedItems.has(item.id) ? "line-through text-gray-400" : "text-gray-800"}`}>
                                      {item.label}
                                    </span>
                                    {item.critical && (
                                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                                        CRITICAL
                                      </span>
                                    )}
                                  </div>
                                  {item.detail && (
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* Tips */}
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>
                              Scanning Tips
                            </div>
                            <div className="space-y-1.5">
                              {(section.tips ?? []).map((tip, i) => (
                                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-teal-50 border border-teal-100">
                                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                                  <p className="text-xs text-teal-800 leading-relaxed">{tip}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Normal vs Abnormal */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1.5">Normal Findings</div>
                              <ul className="space-y-1">
                                {(section.normalFindings ?? []).map((f, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-1.5">Abnormal / Look For</div>
                              <ul className="space-y-1">
                                {(section.abnormalFindings ?? []).map((f, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Reporting Checklist ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection("reporting")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
                <FileText className="w-4 h-4" style={{ color: BRAND }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  Reporting Checklist
                </h2>
                <p className="text-xs text-gray-400">
                  {reportComplete}/{reportingItems.length} items checked
                </p>
              </div>
            </div>
            {expandedSection === "reporting" ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSection === "reporting" && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="mt-4 space-y-1.5">
                {reportingItems.map(item => (
                  <button
                    key={item.id}
                    className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                    onClick={() => toggle(item.id)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {checkedItems.has(item.id) ? (
                        <CheckCircle2 className="w-4 h-4" style={{ color: BRAND }} />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${checkedItems.has(item.id) ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {item.label}
                        </span>
                        {item.critical && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      {item.detail && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Reference Values ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection("reference")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
                <Activity className="w-4 h-4" style={{ color: BRAND }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  Reference Values
                </h2>
                <p className="text-xs text-gray-400">ASE 2015 / 2018 contrast echo reference ranges</p>
              </div>
            </div>
            {expandedSection === "reference" ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSection === "reference" && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 font-bold text-gray-600">Parameter</th>
                      <th className="text-left py-2 pr-4 font-bold text-gray-600">Value</th>
                      <th className="text-left py-2 font-bold text-gray-600">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referenceValues.map((row, i) => (
                      <tr key={i} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                        <td className="py-2 pr-4 text-gray-700 font-medium">{row.parameter}</td>
                        <td className="py-2 pr-4 font-mono font-bold" style={{ color: BRAND }}>{row.value}</td>
                        <td className="py-2 text-gray-500">{row.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Post-Procedure Monitoring ─────────────────────────────────────── */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>
                Post-Procedure Monitoring Protocol
              </h3>
              <ul className="space-y-1.5 text-xs text-amber-700">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  Monitor patient for a minimum of <strong>30 minutes</strong> after UEA administration
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  Record vital signs (BP, HR, SpO2) at <strong>5, 15, and 30 minutes</strong> post-injection
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  Signs of serious reaction: hypotension, bronchospasm, urticaria, angioedema, loss of consciousness
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  Treat anaphylaxis with epinephrine 0.3 mg IM (EpiPen) + call emergency services immediately
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  Document all adverse events in the patient record and report to FDA MedWatch if serious
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── Link to ScanCoach ─────────────────────────────────────────────── */}
        <div className="rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Scan className="w-4 h-4 text-[#4ad9e0]" />
              <span className="text-xs font-semibold text-[#4ad9e0] uppercase tracking-wider">UEA ScanCoach</span>
            </div>
            <h3 className="text-white font-bold text-sm mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Need acquisition guidance?
            </h3>
            <p className="text-white/60 text-xs">
              Step-by-step probe placement, machine optimization tips, injection technique, and contrast artifact recognition.
            </p>
          </div>
          <Link href="/uea-scan-coach">
            <button className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "#189aa1" }}>
              <Scan className="w-4 h-4" />
              Open UEA ScanCoach
            </button>
          </Link>
        </div>

      </div>
    </Layout>
  );
}
