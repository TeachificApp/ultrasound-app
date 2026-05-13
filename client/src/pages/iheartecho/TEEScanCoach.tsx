/*
  TEE ScanCoach — iHeartEcho™
  Interactive view-by-view TEE acquisition guide
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { useSearch } from "wouter";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import ScanCoachNavBar from "@/components/ScanCoachNavBar";
import {
  Microscope, ChevronRight, ChevronDown, ChevronUp,
  Stethoscope, Zap, Info, AlertTriangle,
  CheckCircle, Target, RotateCcw, ArrowRight, BookOpen
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA  = "#4ad9e0";

// ─── VIEW DATA ────────────────────────────────────────────────────────────────

const TEE_VIEWS = [
  // ── Mid-Esophageal ──────────────────────────────────────────────────────────
  {
    id: "me4c",
    group: "Mid-Esophageal",
    groupColor: "#189aa1",
    name: "ME 4-Chamber",
    angle: "0°",
    depth: "30–35 cm",
    flexion: "Neutral to slight anteflexion",
    patientPosition: "Supine; bite block in place; head in neutral position",
    description: "The foundational TEE view. Provides simultaneous assessment of all four cardiac chambers, both AV valves, and the interatrial septum. Equivalent to the TTE apical 4-chamber but with superior resolution.",
    howToGet: [
      "Advance probe to mid-esophagus (30–35 cm from incisors)",
      "Set multiplane angle to 0°",
      "Apply gentle anteflexion to bring all four chambers into view",
      "Optimize depth to include the apex — avoid foreshortening",
      "Rotate slightly left/right to center the IVS vertically",
    ],
    structures: [
      "LV (all walls, apex)", "RV", "LA", "RA",
      "Mitral valve (A2/P2 segments)", "Tricuspid valve",
      "Interatrial septum", "Moderator band (RV)",
    ],
    doppler: [
      { label: "MV Color Doppler", detail: "Assess MR jet — origin, direction, vena contracta" },
      { label: "TV Color Doppler", detail: "Assess TR jet — vena contracta ≥7 mm = severe" },
      { label: "TR CW Doppler", detail: "RVSP = 4v² + RAP. Normal TR Vmax <2.5 m/s" },
      { label: "PW at MV tips", detail: "E/A ratio, deceleration time for diastolic function" },
    ],
    tips: [
      "The RV should appear smaller than the LV — if equal or larger, suspect RV dilation",
      "Tilt the probe slightly posteriorly to visualise the coronary sinus",
      "Advance 1–2 cm to open up the LV apex and avoid foreshortening",
    ],
    pitfalls: [
      "Foreshortening of LV apex underestimates LV size and EF",
      "IAS dropout is common at 0° — use color Doppler to confirm ASD",
    ],
    measurements: ["LV biplane volumes/EF", "LA area", "MV E/A/DT", "TR Vmax/RVSP"],
    criticalFindings: ["New LV wall motion abnormality (ischaemia)", "Severe MR or TR", "Large pericardial effusion"],
  },
  {
    id: "me2c",
    group: "Mid-Esophageal",
    groupColor: "#189aa1",
    name: "ME 2-Chamber",
    angle: "90°",
    depth: "30–35 cm",
    flexion: "Neutral",
    patientPosition: "Supine; same position as ME 4-chamber",
    description: "Obtained by rotating the multiplane angle from 0° to 90° without moving the probe. Provides the only TEE view of the LV anterior wall (LAD territory) and is essential for LAA assessment.",
    howToGet: [
      "From ME 4-chamber, rotate multiplane angle to 90°",
      "Do not advance or withdraw the probe",
      "Optimize to show LV anterior and inferior walls in full length",
      "Tilt slightly to open the LAA — it opens to the left of the screen",
    ],
    structures: [
      "LV anterior wall (LAD territory)", "LV inferior wall (RCA territory)",
      "Mitral valve (A1/A2/A3 and P1/P2/P3)", "Left atrium",
      "Left atrial appendage (LAA)",
    ],
    doppler: [
      { label: "LAA PW Doppler", detail: "LAA emptying velocity. Normal >40 cm/s. <20 cm/s = high thrombus risk" },
      { label: "MV Color (2-chamber)", detail: "Anterior and posterior leaflet prolapse/restriction" },
    ],
    tips: [
      "LAA is best seen at 90°–110° — rotate slightly past 90° if LAA is not visible",
      "Always obtain LAA Doppler at 0° and 90° to exclude thrombus",
      "Anterior wall WMA = LAD territory ischaemia — critical intraoperatively",
    ],
    pitfalls: [
      "LAA lobes can mimic thrombus — use color Doppler and multiple planes",
      "Pectinate muscles in LAA are normal — do not confuse with thrombus",
    ],
    measurements: ["LAA emptying velocity", "LAA ostium diameter (for LAA occlusion sizing)"],
    criticalFindings: ["LAA thrombus", "LAA SEC (spontaneous echo contrast)", "Anterior wall WMA"],
  },
  {
    id: "melax",
    group: "Mid-Esophageal",
    groupColor: "#189aa1",
    name: "ME Long Axis (LAX)",
    angle: "120–135°",
    depth: "30–35 cm",
    flexion: "Neutral",
    patientPosition: "Supine; no change from prior views",
    description: "The TEE equivalent of the parasternal long axis (PLAX). Essential for LVOT, aortic valve, and aortic root assessment. The primary view for LVOT diameter measurement and AR quantification.",
    howToGet: [
      "From ME 2-chamber (90°), continue rotating to 120–135°",
      "The LVOT, AV, and aortic root should come into view",
      "Adjust depth and gain to visualise the proximal ascending aorta",
      "Optimize to make the IVS and posterior wall parallel",
    ],
    structures: [
      "Aortic valve (all three cusps in LAX)", "LVOT",
      "Aortic root (sinus of Valsalva, STJ)", "Proximal ascending aorta",
      "Mitral valve (PLAX equivalent)", "LV outflow",
    ],
    doppler: [
      { label: "LVOT PW Doppler", detail: "LVOT VTI for stroke volume. Measure 0.5–1 cm below AV" },
      { label: "AR Color Doppler", detail: "Jet width/LVOT width. Severe: >65% LVOT width" },
      { label: "MV Color (LAX)", detail: "Posterior leaflet prolapse best seen here" },
    ],
    tips: [
      "LVOT diameter measured here — inner edge to inner edge in mid-systole",
      "Proximal ascending aorta is well seen — measure at sinus, STJ, and mid-ascending",
      "Posterior leaflet prolapse (P2) is most visible in this view",
    ],
    pitfalls: [
      "Oblique cut through LVOT overestimates diameter — ensure parallel walls",
      "Aortic root can be foreshortened — adjust angle 5–10° to maximize diameter",
    ],
    measurements: ["LVOT diameter", "Aortic root (sinus, STJ, ascending)", "AR jet width/LVOT ratio"],
    criticalFindings: ["Aortic dissection (intimal flap in ascending aorta)", "Severe AR", "LVOT obstruction"],
  },
  {
    id: "meavsax",
    group: "Mid-Esophageal",
    groupColor: "#189aa1",
    name: "ME AV Short Axis",
    angle: "30–60°",
    depth: "28–32 cm",
    flexion: "Neutral to slight retroflexion",
    patientPosition: "Supine; slight probe withdrawal from ME 4-chamber position",
    description: "Short-axis view of the aortic valve showing all three cusps (right, left, non-coronary). Essential for bicuspid AV assessment, commissural anatomy, coronary ostia identification, and AR mechanism.",
    howToGet: [
      "From ME 4-chamber (0°), rotate to 30–60°",
      "Withdraw probe slightly (1–2 cm) until AV comes into view",
      "Optimize to show all three cusps symmetrically — 'Mercedes-Benz' sign",
      "Identify RVOT/PV anteriorly and RA/TV to the right",
    ],
    structures: [
      "Aortic valve (R, L, N cusps)", "Coronary ostia (LMCA from L cusp, RCA from R cusp)",
      "RVOT and pulmonary valve", "RA and tricuspid valve",
      "Interatrial septum (at AV level)",
    ],
    doppler: [
      { label: "AR Color (SAX)", detail: "Identify which cusp is prolapsing or perforated" },
      { label: "PV Color Doppler", detail: "Pulmonary stenosis or regurgitation" },
    ],
    tips: [
      "Bicuspid AV: look for raphe, commissural fusion, and 'fish-mouth' opening",
      "LMCA ostium is at ~4 o'clock from the left cusp — critical for TAVR planning",
      "Rotate 5–10° to optimize — perfect trisection is the goal",
    ],
    pitfalls: [
      "Oblique cut creates pseudo-bicuspid appearance — ensure true SAX",
      "Coronary ostia can be missed — use color Doppler to confirm flow",
    ],
    measurements: ["AV planimetry (AVA)", "Coronary ostia height (for TAVR)"],
    criticalFindings: ["Bicuspid AV with severe stenosis", "Coronary ostial involvement in dissection", "Aortic abscess"],
  },
  {
    id: "mebicaval",
    group: "Mid-Esophageal",
    groupColor: "#189aa1",
    name: "ME Bicaval",
    angle: "90–110°",
    depth: "28–32 cm",
    flexion: "Slight retroflexion",
    patientPosition: "Supine; probe at same depth as ME AV SAX",
    description: "The definitive view for interatrial septum assessment. Shows the full length of the IAS from SVC to IVC. Essential for ASD sizing, PFO identification, transseptal puncture guidance, and sinus venosus ASD.",
    howToGet: [
      "From ME AV SAX, rotate to 90–110°",
      "The IAS should run vertically in the center of the screen",
      "SVC enters RA at the top, IVC at the bottom",
      "Adjust angle 5–10° to maximize IAS length",
    ],
    structures: [
      "Interatrial septum (full length)", "Fossa ovalis",
      "Superior vena cava", "Inferior vena cava",
      "Right atrium", "Left atrium",
    ],
    doppler: [
      { label: "IAS Color Doppler", detail: "Shunt direction: L→R (ASD/PFO) or R→L (elevated RA pressure)" },
      { label: "Bubble study", detail: "IV agitated saline — bubbles in LA within 3 beats = PFO" },
      { label: "SVC flow PW", detail: "Sinus venosus ASD: abnormal PV drainage into SVC" },
    ],
    tips: [
      "Sinus venosus ASD is near the SVC — look for dropout at the SVC/RA junction",
      "Primum ASD is at the inferior IAS near the AV valves",
      "Tenting of IAS during transseptal puncture is best seen here",
    ],
    pitfalls: [
      "IAS dropout at 0° is common — bicaval view confirms true ASD",
      "Eustachian valve at IVC can be mistaken for a mass",
    ],
    measurements: ["ASD diameter (max)", "ASD rims (for device sizing)", "Fossa ovalis dimensions"],
    criticalFindings: ["Large ASD", "Sinus venosus ASD (requires surgical repair)", "IAS mass or lipomatous hypertrophy"],
  },
  {
    id: "mervio",
    group: "Mid-Esophageal",
    groupColor: "#189aa1",
    name: "ME RV Inflow-Outflow",
    angle: "60–90°",
    depth: "28–32 cm",
    flexion: "Neutral",
    patientPosition: "Supine; same depth as bicaval",
    description: "Provides simultaneous visualisation of the tricuspid valve, RV, RVOT, and pulmonary valve in a single view. The primary view for comprehensive RV assessment and TR/PR quantification.",
    howToGet: [
      "From ME Bicaval (90–110°), rotate back to 60–90°",
      "TV should appear on the right, RVOT/PV on the left",
      "Adjust angle to show both TV and PV simultaneously",
    ],
    structures: [
      "Tricuspid valve (anterior, posterior, septal leaflets)",
      "Right ventricle", "RVOT", "Pulmonary valve",
      "Pulmonary artery (proximal)",
    ],
    doppler: [
      { label: "TR Color Doppler", detail: "Vena contracta ≥7 mm = severe TR. Identify mechanism" },
      { label: "TR CW Doppler", detail: "RVSP = 4(TR Vmax)² + RAP. Severe TR: dense/triangular CW signal" },
      { label: "PR Color Doppler", detail: "PR severity — jet length and width" },
      { label: "PV PW/CW", detail: "PV stenosis: peak gradient. Normal PV Vmax <1.5 m/s" },
    ],
    tips: [
      "TV septal leaflet is adjacent to IVS — tethering here = functional TR",
      "Carcinoid: thickened, retracted TV leaflets with fixed open position",
      "RVOT obstruction: accelerated color Doppler signal in RVOT",
    ],
    pitfalls: [
      "TV leaflets can be confused with each other — use 3D to clarify anatomy",
      "Severe TR may have low velocity (equalised pressures) — do not underestimate",
    ],
    measurements: ["TR Vmax", "RVSP", "PV Vmax", "TV annulus diameter"],
    criticalFindings: ["Severe TR with RV dilation", "RVOT obstruction", "Pulmonary hypertension"],
  },
  {
    id: "meaorta",
    group: "Mid-Esophageal",
    groupColor: "#189aa1",
    name: "ME Ascending Aorta SAX/LAX",
    angle: "0° (SAX) / 90° (LAX)",
    depth: "20–25 cm",
    flexion: "Slight retroflexion",
    patientPosition: "Supine; probe withdrawn to upper esophagus",
    description: "Visualises the ascending aorta in both short and long axis. Critical for aortic dissection assessment, atheroma grading, and measurement of the ascending aorta diameter before aortic cross-clamping.",
    howToGet: [
      "Withdraw probe to 20–25 cm from incisors",
      "At 0°: ascending aorta in SAX (round cross-section)",
      "Rotate to 90°: ascending aorta in LAX",
      "Scan from proximal to distal by withdrawing slowly",
    ],
    structures: [
      "Ascending aorta (proximal to mid)", "Aortic wall layers",
      "Pericardium", "Right pulmonary artery (crosses posterior)",
    ],
    doppler: [
      { label: "Aortic Color Doppler", detail: "True vs false lumen in dissection — true lumen expands in systole" },
    ],
    tips: [
      "Intimal flap in Type A dissection: thin, mobile linear echo in ascending aorta",
      "Grade aortic atheroma: Grade I (normal) to V (mobile plaque ≥5 mm)",
      "The right PA crosses posterior to the ascending aorta — useful landmark",
    ],
    pitfalls: [
      "Reverberation artifact can mimic intimal flap — confirm in two planes",
      "The ascending aorta is partially obscured by the trachea — a 'blind spot' exists",
    ],
    measurements: ["Ascending aorta diameter (sinus, STJ, mid-ascending)", "Atheroma grade"],
    criticalFindings: ["Type A aortic dissection", "Ascending aortic aneurysm >5.5 cm", "Mobile atheroma (embolic risk)"],
  },
  // ── Transgastric ────────────────────────────────────────────────────────────
  {
    id: "tgsax",
    group: "Transgastric",
    groupColor: "#189aa1",
    name: "TG Mid SAX",
    angle: "0°",
    depth: "40–45 cm",
    flexion: "Anteflexion (tip flexed forward)",
    patientPosition: "Supine; advance probe past gastroesophageal junction",
    description: "The primary transgastric view. Provides a true short-axis cross-section of the LV at the papillary muscle level. Essential for real-time wall motion monitoring during cardiac surgery and for LV filling assessment.",
    howToGet: [
      "Advance probe into the stomach (40–45 cm from incisors)",
      "Apply anteflexion to bring the probe tip against the gastric wall",
      "Set angle to 0°",
      "Optimize to show a circular LV cross-section with both papillary muscles",
      "Adjust depth so LV fills ~60% of the image",
    ],
    structures: [
      "LV (all six walls in SAX)", "Both papillary muscles",
      "RV (anterior)", "IVS",
    ],
    doppler: [
      { label: "Wall motion (visual)", detail: "All six LV walls: anterior, anterolateral, inferolateral, inferior, inferoseptal, anteroseptal" },
    ],
    tips: [
      "Papillary muscles should be symmetric — asymmetry suggests off-axis imaging",
      "Kissing papillary muscles = severe hypovolaemia (LV cavity obliteration)",
      "This is the monitoring view during CPB — watch all six walls simultaneously",
    ],
    pitfalls: [
      "Foreshortening creates oval rather than circular LV — adjust anteflexion",
      "Basal SAX (above papillary muscles) shows MV leaflets — advance probe",
    ],
    measurements: ["LV SAX area (systole/diastole)", "FAC (fractional area change)", "Papillary muscle symmetry"],
    criticalFindings: ["New regional wall motion abnormality (ischaemia)", "LV cavity obliteration (hypovolaemia)", "LV thrombus (apical)"],
  },
  {
    id: "tg2c",
    group: "Transgastric",
    groupColor: "#189aa1",
    name: "TG 2-Chamber",
    angle: "90°",
    depth: "40–45 cm",
    flexion: "Anteflexion",
    patientPosition: "Supine; same position as TG Mid SAX",
    description: "Transgastric equivalent of the 2-chamber view. Shows LV anterior and inferior walls in long axis from the transgastric window. Useful when esophageal views are suboptimal.",
    howToGet: [
      "From TG Mid SAX (0°), rotate to 90°",
      "LV anterior and inferior walls should appear in long axis",
      "Optimize to show the full LV from base to apex",
    ],
    structures: [
      "LV anterior wall", "LV inferior wall",
      "Mitral valve (subvalvular apparatus)", "LV apex",
    ],
    doppler: [
      { label: "MV Color (TG)", detail: "MR from transgastric window — useful when ME views are limited" },
    ],
    tips: [
      "The LV apex is often better seen from TG than ME views",
      "Subvalvular apparatus (chordae, papillary muscles) is well visualised here",
    ],
    pitfalls: [
      "LV foreshortening is common — ensure full length from base to apex",
    ],
    measurements: ["LV length (for biplane EF)", "Papillary muscle morphology"],
    criticalFindings: ["Anterior or inferior wall WMA", "Papillary muscle rupture (post-MI)"],
  },
  {
    id: "tglax",
    group: "Transgastric",
    groupColor: "#189aa1",
    name: "TG Long Axis (LAX)",
    angle: "90–120°",
    depth: "40–45 cm",
    flexion: "Anteflexion + slight retroflexion",
    patientPosition: "Supine; same transgastric position",
    description: "Transgastric long-axis view showing the LVOT and aortic valve from below. The best view for LVOT PW Doppler when the ME LAX is suboptimal. Essential for TAVR guidance when ME views are limited.",
    howToGet: [
      "From TG 2-chamber (90°), rotate to 90–120°",
      "Apply slight retroflexion to bring LVOT and AV into view",
      "The LVOT should be aligned with the Doppler beam for accurate VTI",
    ],
    structures: [
      "LVOT", "Aortic valve", "LV outflow",
      "Mitral valve (subvalvular)", "Aortic root",
    ],
    doppler: [
      { label: "LVOT PW Doppler", detail: "Best alignment for LVOT VTI — beam parallel to flow" },
      { label: "AV CW Doppler", detail: "AS peak velocity from TG window — often best alignment" },
    ],
    tips: [
      "TG LAX gives the best Doppler alignment for AS — often underestimates from ME",
      "LVOT VTI from TG LAX is more accurate than from ME LAX in many patients",
    ],
    pitfalls: [
      "Probe position is unstable in TG — confirm position before measuring",
    ],
    measurements: ["LVOT VTI", "AV peak velocity (CW)", "AVA by continuity equation"],
    criticalFindings: ["Severe AS (Vmax >4 m/s)", "LVOTO (dynamic obstruction)", "Prosthetic valve dysfunction"],
  },
  {
    id: "tgrvio",
    group: "Transgastric",
    groupColor: "#189aa1",
    name: "TG RV Inflow",
    angle: "100–120°",
    depth: "40–45 cm",
    flexion: "Anteflexion + rightward rotation",
    patientPosition: "Supine; rotate probe clockwise from TG LAX",
    description: "Transgastric view of the RV inflow. Shows the tricuspid valve subvalvular apparatus and RV from a transgastric window. Useful for TV repair guidance and RV function assessment.",
    howToGet: [
      "From TG LAX, rotate clockwise (rightward) 30–40°",
      "Rotate multiplane angle to 100–120°",
      "The RV and TV should come into view on the right side of the screen",
    ],
    structures: [
      "Tricuspid valve (subvalvular apparatus)", "RV inflow",
      "Right atrium", "Papillary muscles (RV)",
    ],
    doppler: [
      { label: "TR CW Doppler (TG)", detail: "Alternative window for TR Vmax when ME alignment is poor" },
    ],
    tips: [
      "Papillary muscle rupture of the TV is best seen from TG",
      "Useful for TV repair — shows subvalvular anatomy clearly",
    ],
    pitfalls: [
      "This view is technically challenging — may not be obtainable in all patients",
    ],
    measurements: ["TV subvalvular anatomy", "RV size (qualitative)"],
    criticalFindings: ["TV papillary muscle rupture", "TV chordal rupture"],
  },
  // ── Upper Esophageal ─────────────────────────────────────────────────────────
  {
    id: "ueaorticarch",
    group: "Upper Esophageal",
    groupColor: "#189aa1",
    name: "UE Aortic Arch",
    angle: "0° (arch LAX) / 90° (arch SAX)",
    depth: "18–22 cm",
    flexion: "Neutral to slight retroflexion",
    patientPosition: "Supine; probe withdrawn to upper esophagus",
    description: "Upper esophageal views of the aortic arch and descending thoracic aorta. Essential for aortic dissection assessment, atheroma grading, and coarctation evaluation. The probe is at the level of the aortic arch.",
    howToGet: [
      "Withdraw probe to 18–22 cm from incisors",
      "At 0°: aortic arch in long axis (LAX) — left to right across screen",
      "Rotate to 90°: arch in SAX (round cross-section)",
      "Scan the descending aorta by withdrawing slowly from 22 cm to 35 cm",
    ],
    structures: [
      "Aortic arch (long and short axis)", "Descending thoracic aorta",
      "Left subclavian artery origin", "Left common carotid artery",
      "Innominate artery",
    ],
    doppler: [
      { label: "Arch Color Doppler", detail: "Dissection: true vs false lumen. Coarctation: turbulent flow" },
      { label: "Descending Ao PW", detail: "Diastolic flow reversal = severe AR. Coarctation: continuous forward flow" },
    ],
    tips: [
      "Descending aorta: scan from arch to diaphragm by withdrawing probe slowly",
      "Diastolic flow reversal in descending Ao = hemodynamically significant AR",
      "Type B dissection: intimal flap in descending aorta, does not involve ascending",
    ],
    pitfalls: [
      "Left mainstem bronchus creates a 'blind spot' in the mid-ascending aorta",
      "Reverberation artifact from the probe can mimic intimal flap",
    ],
    measurements: ["Aortic arch diameter", "Descending Ao diameter", "Atheroma grade (I–V)"],
    criticalFindings: ["Type A or B aortic dissection", "Aortic arch aneurysm", "Mobile atheroma (embolic risk)"],
  },
  {
    id: "uepv",
    group: "Upper Esophageal",
    groupColor: "#189aa1",
    name: "UE Pulmonary Veins",
    angle: "0–30°",
    depth: "20–25 cm",
    flexion: "Slight anteflexion",
    patientPosition: "Supine; probe at upper esophageal level",
    description: "Upper esophageal view of the pulmonary veins entering the left atrium. Used for pulmonary vein flow assessment, anomalous pulmonary venous drainage, and post-ablation PV stenosis evaluation.",
    howToGet: [
      "Withdraw probe to 20–25 cm",
      "Set angle to 0–30°",
      "Apply slight anteflexion to bring the LA posterior wall and PV ostia into view",
      "Rotate left/right to visualise LSPV, LIPV, RSPV, RIPV individually",
    ],
    structures: [
      "Left superior pulmonary vein (LSPV)", "Left inferior pulmonary vein (LIPV)",
      "Right superior pulmonary vein (RSPV)", "Left atrium (posterior wall)",
    ],
    doppler: [
      { label: "PV PW Doppler", detail: "S/D ratio, AR wave. Blunted S wave = elevated LA pressure or severe MR" },
      { label: "PV Color Doppler", detail: "Post-ablation: PV stenosis if velocity >1.2 m/s" },
    ],
    tips: [
      "LSPV is the easiest to find — it enters the LA at the upper left",
      "Blunted or reversed PV S wave = elevated LVEDP or severe MR",
      "Post-ablation: compare PV diameters to baseline for stenosis",
    ],
    pitfalls: [
      "RSPV is harder to visualise — may need slight probe rotation",
      "Anomalous PV drainage: RSPV to SVC is the most common variant",
    ],
    measurements: ["PV S/D ratio", "PV AR velocity/duration", "PV ostium diameter (post-ablation)"],
    criticalFindings: ["Anomalous pulmonary venous drainage", "PV stenosis post-ablation", "LA thrombus near PV ostia"],
  },
];

// ─── GROUP DEFINITIONS ────────────────────────────────────────────────────────
const GROUPS = [
  { key: "Mid-Esophageal", color: "#189aa1", label: "Mid-Esophageal (ME)", count: 7 },
  { key: "Transgastric",   color: "#189aa1", label: "Transgastric (TG)",   count: 4 },
  { key: "Upper Esophageal", color: "#189aa1", label: "Upper Esophageal (UE)", count: 2 },
];

// ─── VIEW DETAIL PANEL ────────────────────────────────────────────────────────
function ViewDetail({ view }: { view: typeof TEE_VIEWS[0] }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    howToGet: true, structures: true, doppler: false, tips: false, measurements: false,
  });
  function toggle(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-5" style={{ background: `linear-gradient(135deg, ${view.groupColor}, ${view.groupColor}cc)` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-0.5 mb-2">
              <span className="text-[10px] font-semibold text-white/80">{view.group}</span>
            </div>
            <h2 className="text-xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
              {view.name}
            </h2>
            <p className="text-white/70 text-xs mt-1 leading-relaxed max-w-lg">{view.description}</p>
          </div>
        </div>
        {/* Quick specs */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Angle", value: view.angle },
            { label: "Depth", value: view.depth },
            { label: "Flexion", value: view.flexion },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/10 rounded-lg px-3 py-2">
              <div className="text-[10px] text-white/60 font-medium">{label}</div>
              <div className="text-xs text-white font-semibold mt-0.5">{value}</div>
            </div>
          ))}
          <div className="bg-white/10 rounded-lg px-3 py-2">
            <div className="text-[10px] text-white/60 font-medium">Patient Position</div>
            <div className="text-xs text-white font-semibold mt-0.5 leading-snug">{view.patientPosition}</div>
          </div>
        </div>
      </div>

      {/* Reference Images — shown when admin has uploaded via ScanCoach Editor */}
      {((view as any).echoImageUrl || (view as any).anatomyImageUrl || (view as any).transducerImageUrl) && (
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
      )}
      {/* How to Get This View */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("howToGet")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">How to Get This View</span>
          </div>
          {openSections.howToGet ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.howToGet && (
          <div className="px-5 pb-4">
            <ol className="space-y-2">
              {view.howToGet.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ background: view.groupColor }}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700 leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Structures Visualised */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("structures")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Structures Visualised</span>
          </div>
          {openSections.structures ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.structures && (
          <div className="px-5 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {view.structures.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: view.groupColor }} />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Doppler Assessment */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("doppler")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Doppler Assessment</span>
          </div>
          {openSections.doppler ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.doppler && (
          <div className="px-5 pb-4 space-y-2">
            {view.doppler.map((d, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: view.groupColor + "08", border: `1px solid ${view.groupColor}20` }}>
                <p className="text-xs font-bold" style={{ color: view.groupColor }}>{d.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{d.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips & Pitfalls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("tips")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Tips & Pitfalls</span>
          </div>
          {openSections.tips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.tips && (
          <div className="px-5 pb-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Scanning Tips
              </p>
              <ul className="space-y-1">
                {view.tips.map((t, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Common Pitfalls
              </p>
              <ul className="space-y-1">
                {view.pitfalls.map((p, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Key Measurements */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("measurements")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Key Measurements</span>
          </div>
          {openSections.measurements ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.measurements && (
          <div className="px-5 pb-4">
            <div className="flex flex-wrap gap-2">
              {view.measurements.map((m, i) => (
                <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: view.groupColor + "12", color: view.groupColor }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Critical Findings */}
      {view.criticalFindings.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <p className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Critical Findings — Do Not Miss
          </p>
          <ul className="space-y-1">
            {view.criticalFindings.map((f, i) => (
              <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function TEEScanCoach() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const [selectedViewId, setSelectedViewId] = useState<string>(
    TEE_VIEWS.find(v => v.id === _viewParam)?.id ?? TEE_VIEWS[0].id
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(GROUPS.map(g => g.key))
  );

  const _selectedViewRaw = TEE_VIEWS.find(v => v.id === selectedViewId) ?? TEE_VIEWS[0];
  const { mergeView: mergeTEEView } = useScanCoachOverrides("tee");
  const selectedView = useMemo(() => mergeTEEView(_selectedViewRaw as any), [_selectedViewRaw, mergeTEEView]);

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <Layout>
      <ScanCoachNavBar navigatorPath="/tee" navigatorLabel="TEE Navigator" />
{/* Main Layout */}
      <PremiumOverlay featureName="TEE ScanCoach™">
      <div className="container py-6">
        <div className="flex gap-5">
          {/* View Selector Sidebar */}
          <div className="w-64 flex-shrink-0 hidden md:block">
            <div className="sticky top-4 space-y-2">
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
                      {TEE_VIEWS.filter(v => v.group === group.key).map(view => (
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

          {/* Mobile view selector */}
          <div className="md:hidden w-full mb-4">
            <select
              value={selectedViewId}
              onChange={e => setSelectedViewId(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2"
              style={{ borderColor: BRAND + "40" }}
            >
              {GROUPS.map(group => (
                <optgroup key={group.key} label={group.label}>
                  {TEE_VIEWS.filter(v => v.group === group.key).map(view => (
                    <option key={view.id} value={view.id}>{view.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* View Detail Panel */}
          <div className="flex-1 min-w-0">
            <ViewDetail view={selectedView} />
          </div>
        </div>
      </div>
      </PremiumOverlay>
    </Layout>
  );
}
