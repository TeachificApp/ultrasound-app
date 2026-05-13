/*
  StressScanCoach.tsx — iHeartEcho™
  Stress Echo ScanCoach: view-by-view acquisition guide for exercise and
  pharmacological (DSE) stress echocardiography.
  Covers: rest baseline, peak stress, recovery, and DSE-specific views.
  Each view includes probe position, acquisition tips, what to look for,
  Doppler guidance, pitfalls, and critical findings.
*/
import { useState, useMemo } from "react";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import ScanCoachNavBar from "@/components/ScanCoachNavBar";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import {
  ChevronDown, ChevronUp, ArrowRight, Zap, Activity,
  AlertTriangle, Lightbulb, Info, ImageIcon, Stethoscope,
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA  = "#4ad9e0";

// ─── VIEW DATA ────────────────────────────────────────────────────────────────
const STRESS_VIEWS = [
  // ── Baseline (Rest) ──────────────────────────────────────────────────────────
  {
    id: "rest-plax",
    group: "Baseline — Rest",
    groupColor: "#189aa1",
    name: "PLAX (Rest)",
    stage: "Rest",
    probe: "Parasternal, 3rd–4th ICS, left sternal border",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "The parasternal long axis is the first baseline view. It provides LV dimensions, wall thickness, LVOT diameter, aortic and mitral valve morphology, and a reference for posterior wall and septal motion at rest.",
    howToGet: [
      "Position patient in left lateral decubitus",
      "Place transducer at 3rd–4th ICS, left sternal border",
      "Rotate marker toward the right shoulder (10–11 o'clock)",
      "Optimize depth to include the descending aorta posteriorly",
      "Tilt inferiorly to open the LVOT and aortic valve",
    ],
    structures: [
      "LV (septum, posterior wall)", "LVOT", "Aortic valve",
      "Mitral valve (anterior and posterior leaflets)",
      "Left atrium", "Descending aorta (posterior)",
    ],
    doppler: [
      { label: "M-Mode at MV tips", detail: "LVIDd, LVIDs, IVSd, PWd — baseline dimensions" },
      { label: "Color MV/AV", detail: "Baseline MR and AR — compare to peak stress" },
      { label: "LVOT PW", detail: "Baseline LVOT VTI for cardiac output calculation" },
    ],
    tips: [
      "Acquire cine loops of ≥3 cardiac cycles at rest — essential for side-by-side comparison",
      "Mark end-diastole (QRS) and end-systole (smallest LV) for wall motion scoring",
      "Ensure the posterior wall and septum are parallel — avoid oblique cuts",
    ],
    pitfalls: [
      "Oblique PLAX overestimates LV dimensions — ensure parallel walls",
      "Foreshortened PLAX misses apical WMA — supplement with apical views",
    ],
    measurements: ["LVIDd/LVIDs", "IVSd/PWd", "LVEF (visual)", "LVOT diameter"],
    criticalFindings: ["Baseline RWMA (pre-existing ischaemia)", "Severe MR at rest", "Significant LVOTO (HOCM)"],
  },
  {
    id: "rest-psax-mv",
    group: "Baseline — Rest",
    groupColor: "#189aa1",
    name: "PSAX — Mitral Valve Level (Rest)",
    stage: "Rest",
    probe: "Parasternal, rotate 90° clockwise from PLAX",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "Short axis at the mitral valve level provides a 'fish-mouth' view of the MV and assesses all six LV wall segments at the basal level. Essential for detecting basal inferior and inferolateral WMA (RCA territory).",
    howToGet: [
      "From PLAX, rotate the transducer 90° clockwise",
      "Tilt slightly inferiorly to open the mitral valve",
      "The MV should appear as a 'fish mouth' opening in diastole",
      "Optimize to show a circular LV cross-section",
    ],
    structures: [
      "LV (basal segments — anterior, anteroseptal, inferoseptal, inferior, inferolateral, anterolateral)",
      "Mitral valve (anterior and posterior leaflets)", "RV (crescent)",
    ],
    doppler: [
      { label: "Color MV", detail: "Baseline MR — note origin and severity for comparison at stress" },
    ],
    tips: [
      "The LV should appear circular — an oval shape indicates off-axis imaging",
      "Basal inferior and inferolateral segments = RCA territory — most commonly ischaemic",
      "Compare wall thickening (not just motion) — dyskinesis vs. akinesis vs. hypokinesis",
    ],
    pitfalls: [
      "Foreshortened PSAX shows fewer than 6 wall segments — tilt to open the full circle",
      "Near-field RV can obscure the anterior septum — adjust gain",
    ],
    measurements: ["Visual LVEF at basal level", "MV planimetry if MS suspected"],
    criticalFindings: ["Basal inferior/inferolateral akinesis (RCA)", "Severe MR origin"],
  },
  {
    id: "rest-psax-pm",
    group: "Baseline — Rest",
    groupColor: "#189aa1",
    name: "PSAX — Papillary Muscle Level (Rest)",
    stage: "Rest",
    probe: "Parasternal, tilt inferiorly from MV level",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "The papillary muscle level PSAX is the most important short-axis view for wall motion analysis. It provides mid-level assessment of all six LV wall segments and is the standard reference for regional wall motion scoring.",
    howToGet: [
      "From PSAX-MV, tilt the probe inferiorly (toward the apex)",
      "Both papillary muscles (anterolateral and posteromedial) should appear as symmetric bumps",
      "Optimize for a circular LV cross-section at mid-cavity level",
      "Ensure both papillary muscles are visible simultaneously",
    ],
    structures: [
      "LV mid-segments (anterior, anteroseptal, inferoseptal, inferior, inferolateral, anterolateral)",
      "Anterolateral papillary muscle (LAD/LCx dual supply)",
      "Posteromedial papillary muscle (RCA dominant supply)",
    ],
    doppler: [],
    tips: [
      "This is the most sensitive PSAX level for ischaemia — acquire at every stage",
      "Posteromedial PM has single RCA supply — most vulnerable to ischaemia",
      "Symmetric PM size and position confirms on-axis imaging",
    ],
    pitfalls: [
      "Asymmetric PM appearance suggests off-axis imaging — reposition",
      "Suboptimal endocardial definition at peak stress — use harmonic imaging",
    ],
    measurements: ["Wall motion score (6 segments)", "Visual LVEF at mid level"],
    criticalFindings: ["New mid-inferior/inferolateral WMA at stress", "PM dysfunction (MR mechanism)"],
  },
  {
    id: "rest-a4c",
    group: "Baseline — Rest",
    groupColor: "#189aa1",
    name: "Apical 4-Chamber (Rest)",
    stage: "Rest",
    probe: "Cardiac apex, 5th–6th ICS, mid-axillary line",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus, arm raised",
    description: "The apical 4-chamber is the primary view for apical wall motion assessment and biplane EF calculation. It visualises the apical, mid, and basal segments of the anterior septum and lateral wall.",
    howToGet: [
      "Locate the point of maximal impulse (PMI) — usually 5th–6th ICS, mid-axillary line",
      "Place transducer at the apex with marker pointing to 3 o'clock (left)",
      "Tilt slightly medially to open all four chambers",
      "Optimize depth to include the apex — do not foreshorten",
      "Raise the patient's left arm to open the rib space",
    ],
    structures: [
      "LV (apical, mid, basal lateral and septal segments)",
      "RV (apical, mid, basal free wall)", "LA", "RA",
      "Mitral valve", "Tricuspid valve", "IAS",
    ],
    doppler: [
      { label: "MV PW (tips)", detail: "E/A ratio, DT — baseline diastolic function" },
      { label: "Septal/lateral TDI", detail: "e' velocities — baseline E/e' ratio" },
      { label: "TR CW", detail: "Baseline RVSP" },
      { label: "Color MV/TV", detail: "Baseline MR and TR severity" },
    ],
    tips: [
      "Avoid foreshortening — the apex should be at the top of the screen with the LV appearing elongated",
      "Acquire biplane EF (A4C + A2C) at rest and peak stress for quantitative comparison",
      "TDI e' at rest establishes baseline diastolic function — compare to recovery",
    ],
    pitfalls: [
      "Foreshortened A4C underestimates LV length and overestimates EF",
      "Apical WMA is most sensitive for LAD ischaemia — do not miss by foreshortening",
    ],
    measurements: ["LV volumes (biplane EF)", "E/A ratio", "e' septal/lateral", "E/e' ratio", "TR Vmax"],
    criticalFindings: ["Apical akinesis/dyskinesis (LAD territory)", "New severe MR at stress", "RV dilation"],
  },
  {
    id: "rest-a2c",
    group: "Baseline — Rest",
    groupColor: "#189aa1",
    name: "Apical 2-Chamber (Rest)",
    stage: "Rest",
    probe: "Rotate 60° counter-clockwise from A4C",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "The apical 2-chamber view shows the LV anterior and inferior walls — essential for completing biplane EF and assessing LAD (anterior) and RCA (inferior) territory WMA.",
    howToGet: [
      "From A4C, rotate the transducer ~60° counter-clockwise",
      "The RV should disappear — only LV and LA should be visible",
      "Optimize to show the anterior and inferior walls in full length",
      "Ensure the apex is not foreshortened",
    ],
    structures: [
      "LV anterior wall (LAD territory)", "LV inferior wall (RCA territory)",
      "Left atrium", "Mitral valve",
    ],
    doppler: [
      { label: "Color MV (A2C)", detail: "Anterior and posterior MR jets" },
    ],
    tips: [
      "A2C completes the biplane EF — always acquire paired with A4C",
      "Anterior wall WMA = LAD territory — compare rest vs. peak",
      "Inferior wall WMA = RCA territory — compare with PSAX-PM inferior segment",
    ],
    pitfalls: [
      "If RV is still visible, the probe has not been rotated enough — continue rotating CCW",
      "Foreshortened A2C misses apical anterior WMA",
    ],
    measurements: ["LV anterior/inferior wall motion score", "Biplane EF (with A4C)"],
    criticalFindings: ["New anterior or inferior WMA at stress"],
  },
  {
    id: "rest-a3c",
    group: "Baseline — Rest",
    groupColor: "#189aa1",
    name: "Apical 3-Chamber / APLAX (Rest)",
    stage: "Rest",
    probe: "Rotate further CCW from A2C (~30–40° more)",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "The apical long axis (APLAX) shows the LVOT, aortic valve, and anteroseptal/inferolateral walls. Useful for LVOTO assessment at rest and stress, and for detecting stress-induced dynamic obstruction in HOCM.",
    howToGet: [
      "From A2C, rotate CCW another 30–40° until the LVOT and aortic valve come into view",
      "The LVOT should be on the right side of the screen",
      "Optimize depth to include the aortic root",
    ],
    structures: [
      "LVOT", "Aortic valve", "LV anteroseptal wall (LAD)", "LV inferolateral wall (LCx)",
      "Left atrium", "Mitral valve",
    ],
    doppler: [
      { label: "LVOT PW", detail: "Baseline LVOT VTI — compare to peak stress for dynamic obstruction" },
      { label: "LVOT CW", detail: "If LVOTO suspected — dagger-shaped waveform = dynamic obstruction" },
      { label: "Color LVOT", detail: "Aliasing = obstruction; note MR direction (SAM-related = posterior jet)" },
    ],
    tips: [
      "In HOCM, LVOTO gradient increases dramatically at peak stress — always measure",
      "SAM-related MR produces a posteriorly directed jet — different from leaflet pathology",
      "Baseline LVOT VTI × HR = cardiac output at rest",
    ],
    pitfalls: [
      "Dynamic LVOTO can be missed if only resting views are acquired",
      "SAM may only appear at peak stress — watch for systolic anterior motion of MV",
    ],
    measurements: ["LVOT VTI", "LVOT gradient (if obstruction)", "LVEF (visual)"],
    criticalFindings: ["New LVOTO at stress (gradient >30 mmHg)", "SAM with severe MR"],
  },
  // ── Peak Stress ──────────────────────────────────────────────────────────────
  {
    id: "peak-psax-pm",
    group: "Peak Stress",
    groupColor: "#e05252",
    name: "PSAX — PM Level (Peak)",
    stage: "Peak",
    probe: "Same as rest PSAX-PM",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus (exercise); supine (DSE)",
    description: "The papillary muscle level PSAX at peak stress is the single most important view for detecting ischaemia. New or worsening wall motion abnormalities in any of the six segments indicate significant coronary artery disease.",
    howToGet: [
      "For exercise stress: acquire within 60–90 seconds of peak exercise",
      "For DSE: acquire at peak dobutamine dose (40 mcg/kg/min ± atropine)",
      "Maintain the same transducer position as rest — do not reposition",
      "Use harmonic imaging to improve endocardial definition",
      "Acquire ≥3 cardiac cycles — wall motion is assessed visually",
    ],
    structures: [
      "LV mid-segments (all 6)", "Anterolateral PM", "Posteromedial PM",
    ],
    doppler: [],
    tips: [
      "Acquire immediately — wall motion normalises within 1–2 minutes of stopping exercise",
      "New inferior/inferolateral WMA = RCA; new anterior/anteroseptal = LAD; new lateral = LCx",
      "Compare side-by-side with rest cine loop in real time",
    ],
    pitfalls: [
      "Delayed acquisition misses transient ischaemia — must be within 60–90 seconds",
      "Tachycardia at peak stress reduces frame rate — use high frame rate mode",
      "Hyperventilation artifact can simulate WMA — confirm in multiple views",
    ],
    measurements: ["Wall motion score (6 segments)", "Visual LVEF at peak"],
    criticalFindings: [
      "New WMA in ≥2 segments = significant ischaemia",
      "Worsening of baseline WMA",
      "New LVEF drop >10% from rest",
      "LV cavity dilation at peak stress (ischaemic cardiomyopathy pattern)",
    ],
  },
  {
    id: "peak-a4c",
    group: "Peak Stress",
    groupColor: "#e05252",
    name: "Apical 4-Chamber (Peak)",
    stage: "Peak",
    probe: "Same as rest A4C",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "Peak A4C assesses apical and mid-lateral/septal wall motion and provides biplane EF at peak stress. New apical WMA is highly specific for LAD territory ischaemia.",
    howToGet: [
      "Acquire within 60–90 seconds of peak exercise",
      "Maintain same position as rest A4C",
      "Optimize for endocardial definition — use harmonic imaging",
      "Acquire ≥3 cycles for wall motion scoring",
    ],
    structures: [
      "LV apical and mid segments (lateral and septal)",
      "RV free wall", "MV", "TV",
    ],
    doppler: [
      { label: "MV Color (peak)", detail: "New or worsening MR at peak stress — indicates ischaemic MR or HOCM" },
      { label: "TR CW (peak)", detail: "Peak RVSP — exercise-induced PH if >50 mmHg" },
    ],
    tips: [
      "Apical ballooning at peak = Takotsubo pattern — look for hyperkinetic basal segments",
      "New apical akinesis with preserved base = LAD wraparound ischaemia",
      "Exercise-induced MR >2+ = ischaemic MR — high-risk finding",
    ],
    pitfalls: [
      "Tachycardia makes wall motion scoring difficult — use cine loop review",
      "Foreshortened A4C at peak stress misses apical WMA",
    ],
    measurements: ["Biplane EF at peak", "Wall motion score (apical/mid segments)", "TR Vmax at peak"],
    criticalFindings: [
      "New apical WMA (LAD)",
      "Biplane EF drop >10% from rest",
      "New severe MR at peak",
      "RVSP >50 mmHg at peak (exercise-induced PH)",
    ],
  },
  {
    id: "peak-a2c",
    group: "Peak Stress",
    groupColor: "#e05252",
    name: "Apical 2-Chamber (Peak)",
    stage: "Peak",
    probe: "Same as rest A2C",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "Peak A2C completes the biplane EF at peak stress and assesses the anterior (LAD) and inferior (RCA) walls. New anterior WMA at peak is a high-risk finding.",
    howToGet: [
      "Acquire within 60–90 seconds of peak exercise",
      "Rotate from A4C as at rest — maintain consistent plane",
    ],
    structures: ["LV anterior wall (LAD)", "LV inferior wall (RCA)", "LA", "MV"],
    doppler: [],
    tips: [
      "Anterior wall WMA at peak = proximal LAD disease — high-risk finding",
      "Inferior WMA at peak = RCA disease — correlate with PSAX-PM inferior segment",
    ],
    pitfalls: [
      "Off-axis A2C at peak stress — confirm by absence of RV",
    ],
    measurements: ["Biplane EF (with A4C)", "Anterior/inferior wall motion score"],
    criticalFindings: ["New anterior WMA (proximal LAD)", "New inferior WMA (RCA)"],
  },
  // ── Recovery ─────────────────────────────────────────────────────────────────
  {
    id: "recovery-a4c",
    group: "Recovery",
    groupColor: "#7c3aed",
    name: "Apical 4-Chamber (Recovery)",
    stage: "Recovery",
    probe: "Same as rest A4C",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "Recovery views at 2–3 minutes post-exercise confirm resolution of stress-induced WMA and assess post-stress diastolic function. Persistent WMA in recovery suggests severe ischaemia or stunning.",
    howToGet: [
      "Acquire at 2–3 minutes post-exercise",
      "Compare directly with peak stress cine loops",
      "Acquire Doppler for diastolic function assessment",
    ],
    structures: ["LV (all apical/mid segments)", "MV", "TV"],
    doppler: [
      { label: "MV PW (recovery)", detail: "E/A ratio and DT — compare to rest. E/A >2 post-stress = elevated LAP" },
      { label: "Septal/lateral TDI (recovery)", detail: "e' recovery — E/e' >14 post-stress = exercise-induced diastolic dysfunction" },
      { label: "TR CW (recovery)", detail: "RVSP recovery — should normalise within 3–5 min" },
    ],
    tips: [
      "Post-exercise E/e' >14 is associated with elevated LAP and HFpEF",
      "Persistent WMA at 3 min recovery = severe ischaemia or stunning",
      "RVSP >60 mmHg at peak that normalises in recovery = exercise-induced PH",
    ],
    pitfalls: [
      "Acquiring recovery Doppler too late (>5 min) misses the diastolic stress response",
      "Persistent WMA may represent stunning — not always active ischaemia",
    ],
    measurements: ["E/A ratio (recovery)", "e' septal/lateral (recovery)", "E/e' ratio (recovery)", "TR Vmax (recovery)"],
    criticalFindings: [
      "Persistent WMA at recovery (stunning or severe ischaemia)",
      "E/e' >14 at recovery (exercise-induced diastolic dysfunction / HFpEF)",
      "RVSP >50 mmHg at recovery (exercise-induced PH)",
    ],
  },
  // ── DSE-Specific ─────────────────────────────────────────────────────────────
  {
    id: "dse-low-dose",
    group: "DSE Protocol",
    groupColor: "#d97706",
    name: "Low-Dose DSE (5–10 mcg/kg/min)",
    stage: "DSE",
    probe: "All standard views",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "Low-dose dobutamine (5–10 mcg/kg/min) is used to assess myocardial viability. Viable but hibernating myocardium shows a biphasic response — improved wall motion at low dose, then worsening at high dose. Scar shows no response.",
    howToGet: [
      "Establish IV access and continuous ECG monitoring",
      "Acquire baseline views at all four standard planes",
      "Infuse dobutamine at 5 mcg/kg/min for 3 minutes, then 10 mcg/kg/min",
      "Acquire PSAX-PM, A4C, A2C, and PLAX at each dose stage",
      "Compare wall motion side-by-side with baseline",
    ],
    structures: ["LV (all 17 segments)", "RV", "MV"],
    doppler: [
      { label: "LVOT PW (each stage)", detail: "Cardiac output response — should increase with dobutamine" },
      { label: "MV Color (each stage)", detail: "New or worsening MR — dobutamine can unmask ischaemic MR" },
    ],
    tips: [
      "Biphasic response = viable myocardium (hibernation) — revascularisation likely beneficial",
      "No response at any dose = transmural scar — revascularisation unlikely to help",
      "Sustained improvement without worsening = stunned myocardium",
    ],
    pitfalls: [
      "Dobutamine increases HR and BP — monitor continuously for arrhythmia and hypertension",
      "Atropine (0.25–1 mg IV) used if target HR not achieved at peak dose",
    ],
    measurements: ["Wall motion score at each stage", "LVEF at each stage", "LVOT VTI at each stage"],
    criticalFindings: [
      "Biphasic response (viable myocardium)",
      "New WMA at peak dose without low-dose improvement (ischaemia without viability)",
      "Sustained improvement (stunned myocardium)",
    ],
  },
  {
    id: "dse-peak",
    group: "DSE Protocol",
    groupColor: "#d97706",
    name: "Peak DSE (40 mcg/kg/min ± Atropine)",
    stage: "DSE",
    probe: "All standard views",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus",
    description: "Peak dobutamine stress (40 mcg/kg/min ± atropine 0.25–1 mg IV) is used for ischaemia detection when exercise stress is not feasible. Target HR is 85% of maximum predicted HR (220 − age).",
    howToGet: [
      "Increase dobutamine in 10 mcg/kg/min steps every 3 minutes",
      "Add atropine 0.25 mg IV if target HR not achieved at 40 mcg/kg/min",
      "Acquire PSAX-PM, A4C, A2C at each stage",
      "Terminate at target HR, new WMA, significant arrhythmia, or severe hypertension (>220/120)",
    ],
    structures: ["LV (all segments)", "RV", "MV", "LVOT"],
    doppler: [
      { label: "LVOT CW (peak DSE)", detail: "Dynamic LVOTO — dagger-shaped waveform. Gradient >30 mmHg = significant" },
      { label: "MV Color (peak DSE)", detail: "New MR at peak — ischaemic MR or SAM-related" },
      { label: "TR CW (peak DSE)", detail: "RVSP at peak — exercise-equivalent PH assessment" },
    ],
    tips: [
      "Target HR = 85% × (220 − age) — document achieved HR and reason for termination",
      "New WMA in ≥2 segments at peak = positive for ischaemia",
      "LVOTO gradient >50 mmHg at peak = significant dynamic obstruction",
    ],
    pitfalls: [
      "Dobutamine-induced arrhythmia (VT, AF) requires immediate termination and beta-blocker reversal",
      "Hypotension at peak dose = severe ischaemia or vasodepressor response — terminate",
      "False positive WMA from LBBB — septal motion abnormality is not ischaemia in LBBB",
    ],
    measurements: ["Wall motion score (17 segments)", "LVEF at peak", "LVOT gradient", "Achieved HR"],
    criticalFindings: [
      "New WMA ≥2 segments (positive for ischaemia)",
      "LVEF drop >10% from rest",
      "Sustained VT or haemodynamically significant arrhythmia",
      "Severe hypotension (SBP drop >40 mmHg)",
    ],
  },
  // ── Diastolic Stress ─────────────────────────────────────────────────────────
  {
    id: "diastolic-stress",
    group: "Diastolic Stress Protocol",
    groupColor: "#0891b2",
    name: "Diastolic Stress Echo (HFpEF Protocol)",
    stage: "Diastolic",
    probe: "Apical 4-chamber",
    transducer: "Phased array 2–4 MHz",
    patientPosition: "Left lateral decubitus (rest); semi-recumbent on bike (exercise)",
    description: "Diastolic stress echo uses exercise to unmask elevated filling pressures in patients with exertional dyspnoea and preserved EF. A post-exercise E/e' >14 or TR Vmax >2.8 m/s strongly supports HFpEF.",
    howToGet: [
      "Acquire rest A4C with MV PW Doppler and TDI (septal and lateral e')",
      "Perform semi-supine bicycle exercise to 50–75W or symptom-limited",
      "Immediately post-exercise: acquire MV PW Doppler and TDI",
      "Acquire TR CW Doppler within 1–2 minutes of stopping exercise",
      "Compare rest vs. post-exercise E/e' and TR Vmax",
    ],
    structures: ["LV", "MV", "TV", "LA"],
    doppler: [
      { label: "MV PW (rest + post-exercise)", detail: "E velocity, A velocity, E/A ratio, DT" },
      { label: "Septal TDI (rest + post-exercise)", detail: "Septal e' — normal ≥7 cm/s" },
      { label: "Lateral TDI (rest + post-exercise)", detail: "Lateral e' — normal ≥10 cm/s" },
      { label: "TR CW (post-exercise)", detail: "TR Vmax >2.8 m/s post-exercise = elevated RVSP = elevated LAP" },
    ],
    tips: [
      "Post-exercise E/e' >14 = elevated LAP — supports HFpEF diagnosis",
      "Post-exercise TR Vmax >2.8 m/s = elevated RVSP — supports HFpEF",
      "Both criteria positive = high specificity for HFpEF",
      "Acquire Doppler immediately — values normalise within 3–5 minutes",
    ],
    pitfalls: [
      "Tachycardia fuses E and A waves — use longer DT to separate",
      "Lateral e' is more variable — use average of septal and lateral",
      "Atrial fibrillation invalidates E/A ratio — use E/e' alone",
    ],
    measurements: [
      "E/e' ratio (rest and post-exercise)",
      "Septal e' and lateral e' (rest and post-exercise)",
      "TR Vmax (post-exercise)",
      "LARS (if available)",
    ],
    criticalFindings: [
      "Post-exercise E/e' >14 (elevated LAP, HFpEF)",
      "Post-exercise TR Vmax >2.8 m/s (elevated RVSP)",
      "Both criteria positive = high-probability HFpEF",
    ],
  },
];

const GROUPS = [
  { key: "Baseline — Rest",        label: "Baseline — Rest",        color: "#189aa1" },
  { key: "Peak Stress",            label: "Peak Stress",            color: "#e05252" },
  { key: "Recovery",               label: "Recovery",               color: "#7c3aed" },
  { key: "DSE Protocol",           label: "DSE Protocol",           color: "#d97706" },
  { key: "Diastolic Stress Protocol", label: "Diastolic Stress",   color: "#0891b2" },
];

// ─── VIEW DETAIL COMPONENT ────────────────────────────────────────────────────
function ViewDetail({ view }: { view: typeof STRESS_VIEWS[0] }) {
  const groupColor = GROUPS.find(g => g.key === view.group)?.color ?? BRAND;
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
        <div className="px-5 py-4" style={{ background: groupColor + "0d", borderBottom: `1px solid ${groupColor}25` }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: groupColor + "18", color: groupColor }}>{view.group}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: groupColor + "18", color: groupColor }}>{view.stage}</span>
              </div>
              <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{view.name}</h2>
              <p className="text-xs text-gray-500 mt-1">{view.probe}</p>
            </div>
          </div>
        </div>
        <div className="p-5 bg-white">
          <p className="text-sm text-gray-700 leading-relaxed">{view.description}</p>
        </div>
      </div>
      {/* Reference Images — shown when admin has uploaded via ScanCoach Editor */}
      {((view as any).echoImageUrl || (view as any).anatomyImageUrl || (view as any).transducerImageUrl) ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-800">Reference Images</p>
          </div>
          <div className={`bg-gray-950 grid gap-2 p-4 ${
            [(view as any).echoImageUrl, (view as any).anatomyImageUrl, (view as any).transducerImageUrl].filter(Boolean).length > 1
              ? 'grid-cols-2'
              : 'grid-cols-1'
          }`}>
            {(view as any).echoImageUrl && (
              <div>
                <p className="text-[10px] text-gray-400 mb-1 font-medium">Echo Image</p>
                <img src={(view as any).echoImageUrl} alt="Echo reference" className="max-h-64 object-contain rounded-lg w-full" onContextMenu={e => e.preventDefault()} />
              </div>
            )}
            {(view as any).anatomyImageUrl && (
              <div>
                <p className="text-[10px] text-gray-400 mb-1 font-medium">Anatomy Diagram</p>
                <img src={(view as any).anatomyImageUrl} alt="Anatomy diagram" className="max-h-64 object-contain rounded-lg w-full" onContextMenu={e => e.preventDefault()} />
              </div>
            )}
            {(view as any).transducerImageUrl && (
              <div>
                <p className="text-[10px] text-gray-400 mb-1 font-medium">Probe Position</p>
                <img src={(view as any).transducerImageUrl} alt="Probe position" className="max-h-64 object-contain rounded-lg w-full" onContextMenu={e => e.preventDefault()} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-10 gap-2">
          <p className="text-xs text-gray-400 font-medium">Reference image — {view.name}</p>
          <p className="text-xs text-gray-300">Upload images via the ScanCoach Editor in Admin</p>
        </div>
      )}

      {/* Acquisition grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#f0fbfc] border border-[#b2e8ec] p-4">
          <p className="text-xs font-bold text-[#0e7490] uppercase tracking-wider mb-2">Probe / Patient</p>
          <div className="space-y-1">
            <p className="text-xs text-gray-700"><span className="font-semibold">Probe:</span> {view.probe}</p>
            <p className="text-xs text-gray-700"><span className="font-semibold">Transducer:</span> {view.transducer}</p>
            <p className="text-xs text-gray-700"><span className="font-semibold">Position:</span> {view.patientPosition}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Structures Visualised</p>
          <ul className="space-y-0.5">
            {view.structures.map((s, i) => (
              <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: groupColor }} />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* How to get */}
      <div className="rounded-xl bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">How to Acquire</p>
        <ol className="space-y-2">
          {view.howToGet.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                style={{ background: groupColor }}>{i + 1}</span>
              <span className="text-xs text-gray-700 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Doppler */}
      {view.doppler.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Doppler Assessment</p>
          <div className="space-y-2">
            {view.doppler.map((d, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                <span className="text-xs font-semibold text-[#189aa1] min-w-[120px] flex-shrink-0">{d.label}</span>
                <span className="text-xs text-gray-600">{d.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips & Pitfalls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Tips</p>
          </div>
          <ul className="space-y-1.5">
            {view.tips.map((t, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Pitfalls</p>
          </div>
          <ul className="space-y-1.5">
            {view.pitfalls.map((p, i) => (
              <li key={i} className="text-xs text-red-800 flex items-start gap-1.5">
                <span className="mt-1 w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Measurements & Critical Findings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {view.measurements.length > 0 && (
          <div className="rounded-xl bg-white border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-3.5 h-3.5 text-[#189aa1]" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Key Measurements</p>
            </div>
            <ul className="space-y-1">
              {view.measurements.map((m, i) => (
                <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#189aa1] flex-shrink-0" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}
        {view.criticalFindings.length > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Critical Findings</p>
            </div>
            <ul className="space-y-1">
              {view.criticalFindings.map((f, i) => (
                <li key={i} className="text-xs text-red-800 flex items-start gap-1.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function StressScanCoach() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const [selectedViewId, setSelectedViewId] = useState<string>(
    STRESS_VIEWS.find(v => v.id === _viewParam)?.id ?? STRESS_VIEWS[0].id
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["Baseline — Rest"])
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const { mergeView, overrideMap } = useScanCoachOverrides("stress");
  const selectedView = useMemo(() => {
    const raw = STRESS_VIEWS.find(v => v.id === selectedViewId) ?? STRESS_VIEWS[0];
    return mergeView(raw as any);
  }, [selectedViewId, mergeView, overrideMap]);

  return (
    <Layout>
      <ScanCoachNavBar navigatorPath="/stress" navigatorLabel="Stress Navigator" />

      {/* Hero Banner */}
      <PremiumOverlay featureName="Stress Echo ScanCoach™">
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-10 md:py-12">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <Zap className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">Exercise &amp; DSE · 13 Views · Rest → Peak → Recovery</span>
              </div>
              <h1
                className="text-2xl md:text-3xl font-black text-white leading-tight"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                Stress Echo ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-base mt-0.5">Probe Positioning · Wall Motion Scoring · DSE Protocol</p>
              <p className="text-white/70 text-sm md:text-base mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guide for exercise and pharmacological stress echocardiography — baseline, peak stress, and recovery phases with Doppler guidance and critical findings.
              </p>
            </div>
          </div>
        </div>
      </div>

{/* Main Layout */}
      <div className="container py-6">
        <div className="flex gap-5">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 hidden md:block">
            <div className="sticky top-4 space-y-2 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">Select View</p>
              {GROUPS.map(group => (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors hover:bg-gray-100"
                    style={{ color: group.color }}
                  >
                    <span>{group.label}</span>
                    {expandedGroups.has(group.key)
                      ? <ChevronUp className="w-3.5 h-3.5" />
                      : <ChevronDown className="w-3.5 h-3.5" />
                    }
                  </button>
                  {expandedGroups.has(group.key) && (
                    <div className="ml-2 mt-1 space-y-0.5">
                      {STRESS_VIEWS.filter(v => v.group === group.key).map(view => (
                        <button
                          key={view.id}
                          onClick={() => setSelectedViewId(view.id)}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2"
                          style={{
                            background: selectedViewId === view.id ? group.color + "15" : "transparent",
                            color: selectedViewId === view.id ? group.color : "#374151",
                            fontWeight: selectedViewId === view.id ? 700 : 400,
                            borderLeft: selectedViewId === view.id ? `3px solid ${group.color}` : "3px solid transparent",
                          }}
                        >
                          <ArrowRight className="w-3 h-3 flex-shrink-0" />
                          {view.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile dropdown */}
          <div className="md:hidden w-full mb-4">
            <select
              value={selectedViewId}
              onChange={e => setSelectedViewId(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2"
              style={{ borderColor: BRAND + "40" }}
            >
              {GROUPS.map(group => (
                <optgroup key={group.key} label={group.label}>
                  {STRESS_VIEWS.filter(v => v.group === group.key).map(view => (
                    <option key={view.id} value={view.id}>{view.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* View Detail */}
          <div className="flex-1 min-w-0">
            <ViewDetail view={selectedView} />
          </div>
        </div>
      </div>
      </PremiumOverlay>
    </Layout>
  );
}
