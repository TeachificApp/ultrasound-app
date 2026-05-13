/*
  iHeartEcho™ — TEE/ICE ScanCoach
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
  Covers: ME, TG, UE views for TEE; ICE views for structural procedures
  Media: Admin-uploadable reference images/clips per view; hidden from users when empty.
*/
import { useState, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  ChevronRight, Eye, Info, AlertTriangle, Microscope, Activity,
  Upload, Trash2, ImagePlus, Video, X, CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { uploadFile } from "@/lib/uploadFile";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import BillingCodesCard from "@/components/BillingCodesCard";
import { TEE_BILLING } from "@/lib/scanCoachBillingCodes";

// ─── Helper: render image or video based on URL extension ───────────────────
function MediaDisplay({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const isVideo = /\.(mp4|webm|ogv|mov)(\?|$)/i.test(src);
  if (isVideo) return <video src={src} controls loop className={className} style={style} />;
  return <img src={src} alt={alt} className={className} style={style} />;
}

// Map TEEIceScanCoach hyphenated view IDs → registry camelCase IDs for override lookup
const TEE_ID_TO_REGISTRY: Record<string, string> = {
  "me-4c":          "me4c",
  "me-2c":          "me2c",
  "me-lax":         "melax",
  "me-asc-ao-sax":  "meaorta",
  "me-av-sax":      "meavsax",
  "me-bicaval":     "mebicaval",
  "me-mv-comm":     "mebicaval", // closest registry match
  "tg-mid-sax":     "tgsax",
  "tg-2c":          "tg2c",
  "tg-deep-lax":    "tglax",
  "ue-arch-lax":    "ueaorticarch",
  "ue-arch-sax":    "ueaorticarch",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface TEEView {
  id: string;
  name: string;
  abbr: string;
  section: "ME" | "TG" | "UE" | "ICE"; // ICE kept in data for standalone page
  angle: string;
  depth: string;
  color: string;
  description: string;
  probeManeuver: string;
  anatomy: string[];
  doppler: string[];
  clinicalUse: string[];
  normalFindings: string[];
  pitfalls: string[];
}

// ─── TEE View Data ─────────────────────────────────────────────────────────────
const teeViews: TEEView[] = [
  // ── Midesophageal (ME) ──
  {
    id: "me-4c",
    name: "ME Four-Chamber",
    abbr: "ME 4C",
    section: "ME",
    angle: "0–10°",
    depth: "30–35 cm",
    color: "#189aa1",
    description: "The standard starting view. Displays all four chambers simultaneously with the LV apex at the top of the image.",
    probeManeuver: "Advance probe to mid-esophagus; neutral flexion; rotate to 0–10°. Adjust anteflexion to bring apex into view.",
    anatomy: ["LV", "RV", "LA", "RA", "MV", "TV", "IAS", "IVS"],
    doppler: ["MV inflow (E/A, E/e')", "TV inflow", "Color over MV/TV for regurgitation", "PW at MV tips for diastolic function"],
    clinicalUse: ["Global LV/RV function", "Mitral and tricuspid valve assessment", "ASD/PFO screening (color Doppler)", "Pericardial effusion"],
    normalFindings: ["LV EF ≥55%", "No MV/TV regurgitation", "Intact IAS", "Normal RV size"],
    pitfalls: ["LV apex may be foreshortened — use deep transgastric view for true apex", "Gain too high obscures valve leaflets"],
  },
  {
    id: "me-2c",
    name: "ME Two-Chamber",
    abbr: "ME 2C",
    section: "ME",
    angle: "80–100°",
    depth: "30–35 cm",
    color: "#189aa1",
    description: "Shows LV and LA only. Best view for LV anterior and inferior wall assessment and LAA evaluation.",
    probeManeuver: "From ME 4C, rotate multiplane angle to 80–100°. Slight withdrawal may improve LAA visualisation.",
    anatomy: ["LV (anterior + inferior walls)", "LA", "LAA", "MV (anterior + posterior leaflets)"],
    doppler: ["MV color Doppler", "LAA PW Doppler (LAA emptying velocity)", "LV anterior/inferior wall motion"],
    clinicalUse: ["LV wall motion (anterior, inferior)", "LAA thrombus exclusion", "MV regurgitation jet direction", "Mitral annular calcification"],
    normalFindings: ["LAA emptying velocity >40 cm/s (sinus rhythm)", "No LAA thrombus", "Normal anterior/inferior wall motion"],
    pitfalls: ["LAA pectinate muscles can mimic thrombus — use agitated saline or 3D", "Rotate slowly from ME 4C to avoid losing orientation"],
  },
  {
    id: "me-lax",
    name: "ME Long-Axis",
    abbr: "ME LAX",
    section: "ME",
    angle: "120–160°",
    depth: "30–35 cm",
    color: "#189aa1",
    description: "Equivalent to the parasternal long-axis TTE view. Best for LVOT, aortic valve, and proximal ascending aorta.",
    probeManeuver: "From ME 2C, continue rotating to 120–160°. Slight retroflexion may improve LVOT/AV alignment.",
    anatomy: ["LV (anterior septum + posterior wall)", "LVOT", "AV (NCC + LCC)", "Ascending aorta", "MV (AML + PML)"],
    doppler: ["LVOT PW (VTI for SV)", "AV CW (peak gradient, mean gradient, AVA)", "MV color Doppler (AMVL SAM in HOCM)", "Aortic root color (AR jet)"],
    clinicalUse: ["Aortic stenosis severity (LVOT VTI + AV CW)", "Aortic regurgitation (AR jet width/LVOT)", "LVOT obstruction (HOCM, SAM)", "Aortic root dilation"],
    normalFindings: ["LVOT diameter 1.8–2.2 cm", "AV peak velocity <2.0 m/s", "No AR", "Aortic root ≤4.0 cm"],
    pitfalls: ["LVOT angle to aorta must be <20° for accurate CW gradient", "NCC vs LCC orientation: NCC is posterior in this view"],
  },
  {
    id: "me-asc-ao-sax",
    name: "ME Ascending Aorta SAX",
    abbr: "ME Asc Ao SAX",
    section: "ME",
    angle: "0–30°",
    depth: "25–30 cm",
    color: "#189aa1",
    description: "Short-axis view of the ascending aorta. Used to assess aortic root, PA, and pulmonic valve.",
    probeManeuver: "Withdraw slightly from ME 4C to 25–30 cm; rotate to 0–30°. The circular aorta appears with PA wrapping around it.",
    anatomy: ["Ascending aorta (SAX)", "Main PA", "RPA", "Pulmonic valve", "RVOT"],
    doppler: ["PV CW (pulmonic stenosis)", "PA color (PR, PA dilation)", "RVOT PW (RVOT obstruction)"],
    clinicalUse: ["Aortic root diameter", "Pulmonic valve stenosis/regurgitation", "PA dilation (pulmonary HTN)", "RVOT assessment"],
    normalFindings: ["Aortic root ≤4.0 cm", "PV peak velocity <1.5 m/s", "No PR", "Normal PA size"],
    pitfalls: ["Ascending aorta may be partially obscured by trachea/bronchus — rotate and adjust depth", "Do not confuse PA with aorta — PA wraps anterior to aorta"],
  },
  {
    id: "me-av-sax",
    name: "ME AV Short-Axis",
    abbr: "ME AV SAX",
    section: "ME",
    angle: "30–60°",
    depth: "30–35 cm",
    color: "#189aa1",
    description: "En-face view of the aortic valve. Allows direct planimetry of AVA and assessment of all three cusps.",
    probeManeuver: "From ME Asc Ao SAX, advance slightly and rotate to 30–60°. The three cusps (NCC, LCC, RCC) appear as a 'Mercedes-Benz' sign.",
    anatomy: ["AV (NCC, LCC, RCC)", "LA", "RA", "IAS", "TV"],
    doppler: ["Color Doppler over AV (stenotic jet, AR)", "IAS color (ASD/PFO)"],
    clinicalUse: ["AV planimetry (AVA direct measurement)", "Bicuspid AV identification", "ASD/PFO screening", "AV vegetation assessment"],
    normalFindings: ["Three equal cusps opening symmetrically", "AVA ≥2.0 cm²", "No calcification", "Intact IAS"],
    pitfalls: ["Calcification causes acoustic shadowing — planimetry unreliable in severe calcification", "Bicuspid AV: two cusps with raphe — do not confuse with tricuspid"],
  },
  {
    id: "me-bicaval",
    name: "ME Bicaval",
    abbr: "ME Bicaval",
    section: "ME",
    angle: "80–110°",
    depth: "25–30 cm",
    color: "#189aa1",
    description: "Shows both caval veins entering the RA. Critical for ASD/PFO assessment and catheter/device guidance.",
    probeManeuver: "Withdraw to 25–30 cm; rotate to 80–110°; slight rightward rotation of probe body. SVC appears at top, IVC at bottom.",
    anatomy: ["SVC", "IVC", "RA", "IAS", "LA", "Eustachian valve"],
    doppler: ["Color over IAS (ASD/PFO jet)", "PW in SVC/IVC (hepatic vein flow)", "Bubble study (agitated saline) for PFO"],
    clinicalUse: ["ASD sizing and location (sinus venosus vs secundum)", "PFO detection (bubble study)", "WATCHMAN/ASD device guidance", "Central line/IABP position"],
    normalFindings: ["Intact IAS", "No shunt on color Doppler", "Normal caval flow"],
    pitfalls: ["Sinus venosus ASD is near SVC — do not miss by focusing only on fossa ovalis", "Eustachian valve can be mistaken for IAS pathology"],
  },
  {
    id: "me-mv-comm",
    name: "ME Mitral Commissural",
    abbr: "ME MV Comm",
    section: "ME",
    angle: "60–70°",
    depth: "30–35 cm",
    color: "#189aa1",
    description: "Displays all three scallops of the posterior mitral leaflet (P1, P2, P3) and the corresponding anterior leaflet segments.",
    probeManeuver: "From ME 4C, rotate to 60–70°. The MV appears in a 'fish-mouth' orientation showing both commissures.",
    anatomy: ["MV (A1/P1 at top, A2/P2 centre, A3/P3 at bottom)", "LA", "LV"],
    doppler: ["Color Doppler over MV (jet origin, direction)", "CW across MV (MR peak velocity, MVA pressure half-time)"],
    clinicalUse: ["MR jet origin (which scallop)", "Mitral stenosis commissural fusion", "MitraClip procedure guidance", "Prolapse/flail segment localisation"],
    normalFindings: ["All three scallops coapting normally", "No MR", "MVA ≥2.0 cm²"],
    pitfalls: ["Eccentric MR jets may be underestimated — always use multiple views", "P2 prolapse is most common — check all scallops systematically"],
  },
  // ── Transgastric (TG) ──
  {
    id: "tg-mid-sax",
    name: "TG Mid-Papillary SAX",
    abbr: "TG Mid SAX",
    section: "TG",
    angle: "0–20°",
    depth: "40–45 cm",
    color: "#189aa1",
    description: "Short-axis view of the LV at mid-papillary level. Gold standard for intraoperative LV function monitoring.",
    probeManeuver: "Advance probe into stomach (40–45 cm); anteflex to bring LV into view; rotate to 0–20°. Both papillary muscles should be visible.",
    anatomy: ["LV (all six wall segments at mid level)", "Anterolateral PM", "Posteromedial PM", "RV (crescent shape)"],
    doppler: ["Color Doppler over LV cavity (MR through MV)", "Not primary Doppler view — use for wall motion"],
    clinicalUse: ["Intraoperative LV monitoring (wall motion changes = ischaemia)", "Preload assessment (LV cavity size)", "Systolic function (EF estimation)", "Papillary muscle rupture"],
    normalFindings: ["Symmetric wall motion all segments", "Normal LV cavity size", "Both PMs visible and symmetric"],
    pitfalls: ["Off-axis view can make normal wall appear hypokinetic — ensure circular LV cross-section", "RV volume overload causes IVS flattening — do not misinterpret as ischaemia"],
  },
  {
    id: "tg-2c",
    name: "TG Two-Chamber",
    abbr: "TG 2C",
    section: "TG",
    angle: "80–100°",
    depth: "40–45 cm",
    color: "#189aa1",
    description: "Long-axis view of the LV from the transgastric position. Shows true LV apex — critical for apical pathology.",
    probeManeuver: "From TG Mid SAX, rotate to 80–100°. The LV apex should be at the top. Adjust anteflexion to maximise LV length.",
    anatomy: ["LV (true apex, anterior + inferior walls)", "LA", "MV"],
    doppler: ["MV inflow PW", "LV apex color (apical thrombus, hypertrabeculation)"],
    clinicalUse: ["True LV apex assessment (apical HCM, thrombus)", "LV length measurement", "Inferior wall motion (RCA territory)", "Anterior wall motion (LAD territory)"],
    normalFindings: ["Smooth LV apex", "Normal anterior and inferior wall motion", "No apical thrombus"],
    pitfalls: ["Foreshortening is common — ensure probe is fully advanced and antiflex maximally", "Apical trabeculations can mimic thrombus — use contrast if uncertain"],
  },
  {
    id: "tg-deep-lax",
    name: "Deep TG Long-Axis",
    abbr: "Deep TG LAX",
    section: "TG",
    angle: "0–20°",
    depth: "45–50 cm",
    color: "#189aa1",
    description: "The only TEE view that allows CW Doppler alignment with LVOT/AV flow. Essential for accurate aortic valve gradients.",
    probeManeuver: "Advance probe fully into stomach (45–50 cm); anteflex maximally; rotate to 0–20°. The LVOT and AV should align with the Doppler beam.",
    anatomy: ["LV apex", "LVOT", "AV", "Proximal ascending aorta"],
    doppler: ["LVOT PW (VTI for SV, LVOT obstruction)", "AV CW (peak gradient, mean gradient — most accurate TEE view)", "Color over LVOT/AV (SAM, AR)"],
    clinicalUse: ["Aortic stenosis gradient (most accurate TEE position)", "LVOT obstruction (HOCM, SAM)", "Post-TAVR gradient assessment", "SV and CO calculation"],
    normalFindings: ["LVOT VTI 18–22 cm", "AV peak velocity <2.0 m/s", "No LVOT obstruction"],
    pitfalls: ["Requires deep probe insertion — may cause patient discomfort; ensure adequate sedation", "Beam-flow angle must be <20° for accurate gradients — adjust probe rotation"],
  },
  // ── Upper Esophageal (UE) ──
  {
    id: "ue-arch-lax",
    name: "UE Aortic Arch LAX",
    abbr: "UE Arch LAX",
    section: "UE",
    angle: "0°",
    depth: "20–25 cm",
    color: "#189aa1",
    description: "Long-axis view of the aortic arch. Used to assess arch atheroma, dissection, and coarctation.",
    probeManeuver: "Withdraw probe to 20–25 cm; rotate to 0°; slight leftward rotation. The arch appears as a curved structure with left subclavian origin.",
    anatomy: ["Aortic arch", "Left subclavian artery origin", "Descending aorta transition", "Left PA (posterior)"],
    doppler: ["Color Doppler over arch (dissection flap, coarctation jet)", "CW across coarctation (gradient)"],
    clinicalUse: ["Aortic arch atheroma grading (I–V)", "Type A dissection — arch involvement", "Coarctation assessment", "Cannulation site selection (cardiac surgery)"],
    normalFindings: ["Smooth intima", "No atheroma", "No dissection flap", "Normal arch diameter"],
    pitfalls: ["Left main bronchus causes acoustic dropout — rotate probe to avoid", "Atheroma grading: Grade IV (mobile) and V (ulcerated) are highest embolic risk"],
  },
  {
    id: "ue-arch-sax",
    name: "UE Aortic Arch SAX",
    abbr: "UE Arch SAX",
    section: "UE",
    angle: "90°",
    depth: "20–25 cm",
    color: "#189aa1",
    description: "Short-axis view of the aortic arch. Shows the main pulmonary artery and left pulmonary artery in cross-section.",
    probeManeuver: "From UE Arch LAX, rotate to 90°. The circular arch cross-section appears with PA anterior.",
    anatomy: ["Aortic arch (SAX)", "Main PA", "Left PA", "Left subclavian artery"],
    doppler: ["PA color Doppler (PA dilation, PE)", "PW in PA (pulmonary flow)"],
    clinicalUse: ["PA dilation assessment", "Pulmonary embolism (central PE in main PA)", "Arch diameter measurement", "Pulmonary HTN screening"],
    normalFindings: ["Main PA diameter ≤2.5 cm", "No intraluminal filling defect", "Normal arch diameter"],
    pitfalls: ["Central PE may be visible as echogenic filling defect — confirm with CT-PA", "PA and aorta can be confused — PA is anterior and has thinner walls"],
  },
  // ── ICE Views ──
  {
    id: "ice-home",
    name: "ICE Home View",
    abbr: "ICE Home",
    section: "ICE",
    angle: "0° (phased array)",
    depth: "Right atrium",
    color: "#d97706",
    description: "The starting position for ICE. Catheter in RA with beam pointing anteriorly. Shows RA, TV, RV, and RVOT.",
    probeManeuver: "Advance ICE catheter to RA; neutral position (no deflection). Rotate clockwise to move beam posteriorly toward IAS.",
    anatomy: ["RA", "TV", "RV", "RVOT", "Tricuspid annulus"],
    doppler: ["TV color (TR)", "RVOT color (RVOTO)", "TV CW (RVSP from TR Vmax)"],
    clinicalUse: ["Baseline RA/RV assessment", "TR severity", "RVSP estimation", "Catheter position confirmation"],
    normalFindings: ["Normal RA/RV size", "No TR or mild TR", "Normal RVOT"],
    pitfalls: ["Catheter position affects image — ensure stable position before measurements", "Near-field artifact from catheter tip can obscure TV"],
  },
  {
    id: "ice-ias",
    name: "ICE IAS View",
    abbr: "ICE IAS",
    section: "ICE",
    angle: "Clockwise rotation from home",
    depth: "Right atrium",
    color: "#d97706",
    description: "Posterior rotation from home view. Shows the interatrial septum, fossa ovalis, and left atrium. Primary view for ASD/PFO closure.",
    probeManeuver: "From home view, rotate catheter clockwise until IAS comes into view. The fossa ovalis appears as a thin membrane in the centre of the IAS.",
    anatomy: ["IAS", "Fossa ovalis", "LA", "MV (partially)", "LSPV (with further rotation)"],
    doppler: ["Color over IAS (ASD/PFO shunt)", "Bubble study (agitated saline) for PFO", "PW in LSPV (pulmonary venous flow)"],
    clinicalUse: ["ASD/PFO sizing and location", "Transseptal puncture guidance", "WATCHMAN device deployment", "ASD closure device guidance"],
    normalFindings: ["Intact IAS", "No shunt on color Doppler", "Fossa ovalis visible as thin membrane"],
    pitfalls: ["Fossa ovalis is the thinnest part of IAS — transseptal needle should target this area", "Lipomatous hypertrophy of IAS can mimic mass — spare fossa ovalis is characteristic"],
  },
  {
    id: "ice-laa",
    name: "ICE LAA View",
    abbr: "ICE LAA",
    section: "ICE",
    angle: "Further clockwise from IAS",
    depth: "Right atrium or transseptal",
    color: "#d97706",
    description: "Shows the left atrial appendage. Used for LAA thrombus exclusion before cardioversion and WATCHMAN device sizing/deployment.",
    probeManeuver: "Continue clockwise rotation from IAS view. The LAA appears as a finger-like structure at the top-left. Transseptal access improves visualisation.",
    anatomy: ["LAA", "LA", "LSPV", "LIPV", "Mitral annulus"],
    doppler: ["LAA PW (emptying velocity >40 cm/s = low thrombus risk)", "Color over LAA (spontaneous echo contrast, thrombus)"],
    clinicalUse: ["LAA thrombus exclusion (pre-cardioversion, pre-ablation)", "WATCHMAN device sizing (LAA ostium diameter, depth)", "WATCHMAN deployment and leak assessment", "AF ablation guidance"],
    normalFindings: ["LAA emptying velocity >40 cm/s", "No thrombus", "No spontaneous echo contrast"],
    pitfalls: ["Pectinate muscles mimic thrombus — use multiple views and Doppler", "WATCHMAN leak: residual flow around device on color Doppler — acceptable if ≤5 mm"],
  },
  {
    id: "ice-av",
    name: "ICE Aortic Valve View",
    abbr: "ICE AV",
    section: "ICE",
    angle: "Anterior from IAS",
    depth: "Right atrium",
    color: "#d97706",
    description: "Shows the aortic valve and LVOT from the RA. Used during TAVR and structural procedures for valve positioning.",
    probeManeuver: "From IAS view, rotate counterclockwise (anteriorly). The aortic valve appears as a circular structure with three cusps.",
    anatomy: ["AV (NCC, LCC, RCC)", "LVOT", "Aortic root", "LA (behind AV)"],
    doppler: ["AV color (AR, paravalvular leak post-TAVR)", "CW across AV (gradient post-TAVR)"],
    clinicalUse: ["TAVR valve positioning and deployment", "Post-TAVR paravalvular leak assessment", "AV morphology (bicuspid)", "LVOT measurement"],
    normalFindings: ["Three equal cusps", "No AR", "Normal LVOT diameter"],
    pitfalls: ["ICE provides limited AV gradient accuracy — use TEE or TTE for haemodynamic assessment", "Paravalvular leak: circumferential color signal around prosthesis — quantify by circumference"],
  },
  // ── ICE Structural Heart ──
  {
    id: "ice-watchman-sizing",
    name: "WATCHMAN Sizing",
    abbr: "WATCHMAN Size",
    section: "ICE",
    angle: "LAA view (transseptal)",
    depth: "Left atrium (transseptal)",
    color: "#d97706",
    description: "ICE-guided LAA ostium measurement for WATCHMAN FLX device sizing. Requires transseptal access for optimal LA views.",
    probeManeuver: "After transseptal puncture, advance ICE into LA. Rotate to display LAA in long axis. Measure ostium diameter at the level of the left circumflex artery and LSPV ridge.",
    anatomy: ["LAA ostium", "LAA body and lobes", "LSPV ridge", "Left circumflex artery (landmark)", "Mitral annulus"],
    doppler: ["Color over LAA ostium (baseline flow pattern)", "PW in LAA (emptying velocity — target >40 cm/s)", "Color post-deployment (residual leak)"],
    clinicalUse: ["LAA ostium diameter measurement (sizing: device = ostium + 10–20%)", "LAA depth measurement (must exceed device diameter)", "Device deployment guidance (position, compression)", "Post-deployment leak assessment"],
    normalFindings: ["Ostium diameter 17–31 mm (WATCHMAN FLX range)", "LAA depth ≥ device diameter", "Device compression 8–20% post-deployment", "No leak or ≤5 mm residual leak acceptable"],
    pitfalls: ["Measure at widest ostium diameter — use multiple angles (0°, 45°, 90°, 135°)", "Pectinate muscles can obscure true ostium — use color Doppler to delineate boundary", "Device embolisation risk: ensure anchor zone engagement before release"],
  },
  {
    id: "ice-watchman-deploy",
    name: "WATCHMAN Deployment",
    abbr: "WATCHMAN Deploy",
    section: "ICE",
    angle: "LAA view (transseptal)",
    depth: "Left atrium (transseptal)",
    color: "#d97706",
    description: "Real-time ICE guidance during WATCHMAN FLX device deployment — confirms position, compression, and absence of significant leak.",
    probeManeuver: "Maintain ICE in LA with LAA in view. Track device advancement into LAA. Confirm PASS criteria before release.",
    anatomy: ["WATCHMAN device (echogenic disc)", "LAA ostium", "Device anchor zone", "Mitral valve (reference)"],
    doppler: ["Color Doppler around device perimeter (leak assessment)", "PW at residual gap (if present)"],
    clinicalUse: ["PASS criteria confirmation: Position (at/distal to ostium), Anchor (tug test), Size (compression 8–20%), Seal (≤5 mm leak)", "Pericardial effusion monitoring during deployment", "Device embolisation detection"],
    normalFindings: ["Device seated at LAA ostium", "Compression 8–20%", "No or ≤5 mm residual leak", "No pericardial effusion"],
    pitfalls: ["Inadequate compression (<8%) → risk of embolisation; reposition", "Excessive compression (>20%) → risk of device fracture; reconsider sizing", "Always confirm no pericardial effusion before and after release"],
  },
  {
    id: "ice-mitraclip",
    name: "MitraClip Guidance",
    abbr: "MitraClip",
    section: "ICE",
    angle: "ME 4C / Commissural equivalent (transseptal)",
    depth: "Left atrium (transseptal)",
    color: "#d97706",
    description: "ICE guidance for MitraClip (TEER) procedure — transseptal puncture, clip positioning, and post-deployment MR assessment.",
    probeManeuver: "Transseptal puncture at posterior-superior IAS (target: 3.5–4.0 cm above MV plane). Advance ICE into LA. Display MV in long axis and commissural views for clip positioning.",
    anatomy: ["MV (AML, PML, all scallops)", "LVOT (for SAM risk assessment)", "LA", "LV", "MitraClip device (echogenic)"],
    doppler: ["Color Doppler over MV (residual MR, clip position)", "CW across MV (MVA post-clip — avoid iatrogenic MS)", "Color over LVOT (SAM detection post-clip)"],
    clinicalUse: ["Transseptal puncture height guidance (posterior-superior IAS)", "Clip orientation to MR jet (perpendicular to coaptation line)", "Leaflet insertion confirmation (A2/P2 grasping)", "Post-clip MR grade and MVA assessment"],
    normalFindings: ["Residual MR ≤2+ post-clip", "MVA ≥1.5 cm² (avoid iatrogenic MS)", "No LVOT obstruction (SAM)", "Symmetric leaflet insertion"],
    pitfalls: ["Low transseptal puncture → inadequate working height; target posterior-superior IAS", "SAM risk: short posterior leaflet, small LVOT, hyperdynamic LV — consider surgical referral", "Leaflet trauma: avoid excessive clip force; confirm both leaflets grasped before locking"],
  },
  {
    id: "ice-laao-leak",
    name: "LAAO Leak Assessment",
    abbr: "LAAO Leak",
    section: "ICE",
    angle: "LAA view (transseptal or RA)",
    depth: "LA or RA",
    color: "#d97706",
    description: "Post-LAAO device leak assessment using ICE color Doppler. Evaluates peridevice flow and device position at 45-day follow-up.",
    probeManeuver: "Position ICE to display device en-face and in long axis. Apply color Doppler at multiple angles (0°, 45°, 90°, 135°) to detect peridevice flow.",
    anatomy: ["LAAO device (WATCHMAN/Amulet)", "LAA ostium", "Device-tissue interface", "Residual LAA lumen (if any)"],
    doppler: ["Color Doppler at all angles around device perimeter", "PW at any residual flow jet (measure peak velocity)", "Measure leak jet width perpendicular to flow direction"],
    clinicalUse: ["Peridevice leak grading: None / ≤3 mm (minor) / 3–5 mm (moderate) / >5 mm (major)", "Device position assessment (migration, embolisation)", "45-day follow-up: determine if anticoagulation can be stopped", "Endothelialisation assessment (device echogenicity)"],
    normalFindings: ["No peridevice flow or ≤3 mm minor leak", "Device seated at ostium without migration", "Increasing echogenicity = endothelialisation (expected at 45 days)"],
    pitfalls: ["Gain settings affect leak detection — use standardised settings", "Multiple jets may be present — assess entire circumference", ">5 mm leak at 45 days → continue anticoagulation; consider reintervention if symptomatic"],
  },
];

// ─── Section config ────────────────────────────────────────────────────────────
const SECTION_LABELS: Record<string, string> = {
  ME: "Midesophageal (ME)",
  TG: "Transgastric (TG)",
  UE: "Upper Esophageal (UE)",
  ICE: "Intracardiac Echo (ICE)",
};

const SECTION_COLORS: Record<string, string> = {
  ME: "#189aa1",
  TG: "#189aa1",
  UE: "#6366f1",
  ICE: "#d97706",
};

// ─── Admin Media Upload Panel ──────────────────────────────────────────────────
function AdminMediaPanel({ viewId }: { viewId: string }) {
  const utils = trpc.useUtils();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: media = [], isLoading } = trpc.scanCoachAdmin.getMediaByView.useQuery({ viewId });
  const uploadMutation = trpc.scanCoachAdmin.uploadViewMedia.useMutation({
    onSuccess: () => {
      utils.scanCoachAdmin.getMediaByView.invalidate({ viewId });
      setCaption("");
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    },
    onError: (e) => setUploadError(e.message),
  });
  const deleteMutation = trpc.scanCoachAdmin.deleteViewMedia.useMutation({
    onSuccess: () => utils.scanCoachAdmin.getMediaByView.invalidate({ viewId }),
  });

  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        setUploadError("Only images (JPEG, PNG, WebP, GIF) and videos (MP4, WebM) are supported.");
        setUploading(false);
        return;
      }
      const maxMB = isVideo ? 50 : 10;
      if (file.size > maxMB * 1024 * 1024) {
        setUploadError(`File too large. Max ${maxMB} MB.`);
        setUploading(false);
        return;
      }
      // Upload via multipart (no base64 size bottleneck)
      const folder = isVideo ? "tee-ice/clips" : "tee-ice/images";
      const allowedTypes = isVideo ? "video" : "image";
      const { url } = await uploadFile(file, folder, { maxMB, allowedTypes });
      await uploadMutation.mutateAsync({
        viewId,
        mediaType: isVideo ? "clip" : "image",
        url,
        mimeType: file.type,
        fileName: file.name,
        caption: caption.trim() || undefined,
        sortOrder: media.length,
      });
    } catch (e: any) {
      setUploadError(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [viewId, caption, media.length, uploadMutation]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-amber-500 text-white">
          <Upload className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-sm font-bold text-amber-800" style={{ fontFamily: "Merriweather, serif" }}>
          Admin: Reference Media
        </h3>
        <span className="ml-auto text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Admin only</span>
      </div>

      {/* Existing media */}
      {isLoading ? (
        <p className="text-xs text-amber-600 mb-3">Loading media…</p>
      ) : media.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {media.map((m) => (
            <div key={m.id} className="relative rounded-lg overflow-hidden border border-amber-200 bg-white group">
              {m.mediaType === "image" ? (
                <img src={m.url} alt={m.caption ?? "Reference image"} className="w-full h-24 object-cover" />
              ) : (
                <video src={m.url} className="w-full h-24 object-cover" controls={false} muted />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => deleteMutation.mutate({ id: m.id })}
                  className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {m.caption && (
                <p className="text-xs text-gray-600 px-2 py-1 truncate">{m.caption}</p>
              )}
              <span className="absolute top-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                {m.mediaType === "clip" ? "Clip" : "Image"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-amber-600 mb-3">No media uploaded yet for this view.</p>
      )}

      {/* Caption input */}
      <input
        type="text"
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="w-full text-xs border border-amber-200 rounded-lg px-3 py-1.5 mb-2 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
      />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
        style={{ borderColor: dragOver ? "#d97706" : "#fcd34d", background: dragOver ? "#fef3c7" : "transparent" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/x-ms-wmv,.wmv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <div className="flex items-center justify-center gap-2 text-amber-600 mb-1">
          <ImagePlus className="w-4 h-4" />
          <Video className="w-4 h-4" />
        </div>
        <p className="text-xs text-amber-700 font-medium">
          {uploading ? "Uploading…" : "Drop image or clip here, or click to browse"}
        </p>
        <p className="text-xs text-amber-500 mt-0.5">JPEG, PNG, WebP, GIF (max 10 MB) · MP4, WebM (max 50 MB)</p>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 mt-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
          <X className="w-3.5 h-3.5 flex-shrink-0" />
          {uploadError}
        </div>
      )}
      {uploadSuccess && (
        <div className="flex items-center gap-2 mt-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          Media uploaded successfully.
        </div>
      )}
    </div>
  );
}

// ─── View Media Display (users) ───────────────────────────────────────────────
function ViewMediaDisplay({ viewId }: { viewId: string }) {
  const { data: media = [], isLoading } = trpc.scanCoachAdmin.getMediaByView.useQuery({ viewId });

  if (isLoading || media.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white bg-gray-600">
          <Eye className="w-3.5 h-3.5" />
        </div>
        Reference Images & Clips
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {media.map((m) => (
          <div key={m.id} className="rounded-xl overflow-hidden border border-gray-100">
            {m.mediaType === "image" ? (
              <img src={m.url} alt={m.caption ?? "Reference image"} className="w-full object-contain bg-gray-900 max-h-48" />
            ) : (
              <video src={m.url} className="w-full max-h-48 bg-gray-900" controls loop controlsList="nodownload" onContextMenu={(e) => e.preventDefault()} muted />
            )}
            {m.caption && (
              <p className="text-xs text-gray-500 px-3 py-2">{m.caption}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── View Card (sidebar) ──────────────────────────────────────────────────────
function ViewCard({ view, isSelected, onClick }: { view: TEEView; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-lg transition-all mb-1"
      style={isSelected
        ? { background: view.color, color: "white" }
        : { background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold leading-tight">{view.name}</p>
          <p className="text-xs opacity-70 mt-0.5">{view.angle} · {view.depth}</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
      </div>
    </button>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export function TEEIceScanCoachContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeSection, setActiveSection] = useState<"ME" | "TG" | "UE">("ME");
  const [selectedView, setSelectedView] = useState<TEEView>(teeViews[0]);
  const detailRef = useRef<HTMLDivElement>(null);

  const sectionViews = teeViews.filter(v => v.section === activeSection);

  // Override hook — maps hyphenated IDs to registry IDs for unified image lookup
  const { mergeView: mergeTEEView } = useScanCoachOverrides("tee");
  const selectedViewMerged = useMemo(() => {
    const registryId = TEE_ID_TO_REGISTRY[selectedView.id] ?? selectedView.id;
    return mergeTEEView({ ...selectedView, id: registryId } as any);
  }, [selectedView, mergeTEEView]);

  const handleViewSelect = (view: TEEView) => {
    setSelectedView(view);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div>
      {/* Section tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["ME", "TG", "UE"] as const).map(s => (
          <button
            key={s}
            onClick={() => {
              setActiveSection(s);
              setSelectedView(teeViews.find(v => v.section === s)!);
            }}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={activeSection === s
              ? { background: SECTION_COLORS[s], color: "white" }
              : { background: "white", color: SECTION_COLORS[s], border: `1px solid ${SECTION_COLORS[s]}40` }}
          >
            {SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
        {/* Detail panel */}
        <div ref={detailRef} className="lg:col-span-3 lg:order-2 order-1 space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: selectedView.color + "30", background: selectedView.color + "08" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: selectedView.color }}>
                    {selectedView.abbr.split(" ")[0]}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{selectedView.name}</h2>
                    <p className="text-xs text-gray-500">{SECTION_LABELS[selectedView.section]} · {selectedView.angle} · {selectedView.depth}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white hidden sm:block"
                  style={{ background: selectedView.color }}>
                  {selectedView.section}
                </span>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 leading-relaxed">{selectedView.description}</p>
            </div>
          </div>

          {/* Reference media — shown only when filled; admin upload panel shown to admins */}
          <ViewMediaDisplay viewId={selectedView.id} />
          {isAdmin && <AdminMediaPanel viewId={selectedView.id} />}

          {/* Override images from unified ScanCoach admin editor (registry-keyed) */}
          {((selectedViewMerged as any).echoImageUrl || (selectedViewMerged as any).anatomyImageUrl) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white" style={{ background: selectedView.color }}>
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                  Reference Images
                </h3>
                <span className="text-xs text-gray-400">Diagram · Clinical Echo</span>
              </div>
              <div className={`grid gap-0 bg-gray-950 ${ (selectedViewMerged as any).echoImageUrl && (selectedViewMerged as any).anatomyImageUrl ? 'grid-cols-2' : 'grid-cols-1' }`}>
                {(selectedViewMerged as any).anatomyImageUrl && (
                  <div className="flex justify-center items-center p-3 border-r border-gray-800">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1.5">Anatomy Diagram</p>
                      <MediaDisplay src={(selectedViewMerged as any).anatomyImageUrl} alt={`${selectedView.name} diagram`} className="max-h-56 object-contain rounded" style={{ background: "#030712" }} />
                    </div>
                  </div>
                )}
                {(selectedViewMerged as any).echoImageUrl && (
                  <div className="flex justify-center items-center p-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1.5">Clinical Echo Image</p>
                      <MediaDisplay src={(selectedViewMerged as any).echoImageUrl} alt={`${selectedView.name} echo`} className="max-h-56 object-contain rounded" style={{ background: "#030712" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Probe Maneuver */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white" style={{ background: selectedView.color }}>
                <Activity className="w-3.5 h-3.5" />
              </div>
              Probe Maneuver
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{selectedView.probeManeuver}</p>
          </div>

          {/* Two-column: Anatomy + Doppler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white" style={{ background: selectedView.color }}>
                  <Eye className="w-3.5 h-3.5" />
                </div>
                Anatomy Visible
              </h3>
              <ul className="space-y-1.5">
                {selectedView.anatomy.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: selectedView.color }} />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white" style={{ background: selectedView.color }}>
                  <Activity className="w-3.5 h-3.5" />
                </div>
                Doppler Applications
              </h3>
              <ul className="space-y-1.5">
                {selectedView.doppler.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: selectedView.color }} />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Clinical Use + Normal Findings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white" style={{ background: selectedView.color }}>
                  <Info className="w-3.5 h-3.5" />
                </div>
                Clinical Use
              </h3>
              <ul className="space-y-1.5">
                {selectedView.clinicalUse.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: selectedView.color }} />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white bg-green-600">
                  <Info className="w-3.5 h-3.5" />
                </div>
                Normal Findings
              </h3>
              <ul className="space-y-1.5">
                {selectedView.normalFindings.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-green-500" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pitfalls */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white bg-amber-500">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              Pitfalls & Tips
            </h3>
            <ul className="space-y-2">
              {selectedView.pitfalls.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Billing Codes — TEE views only */}
          {TEE_BILLING[selectedView.id] && (
            <BillingCodesCard billing={TEE_BILLING[selectedView.id]} accentColor="#0e7490" />
          )}

          {/* Copyright */}
          <div className="text-xs text-gray-400 text-center py-2">
            Clinical content © All About Ultrasound, Inc. / iHeartEcho™. Educational use only. Based on ASE/SCA/EACVI TEE guidelines.
          </div>
        </div>

        {/* View list sidebar */}
        <div className="lg:col-span-1 lg:order-1 order-2 lg:sticky lg:top-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>
                {SECTION_LABELS[activeSection]}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{sectionViews.length} views</p>
            </div>
            <div className="p-3 space-y-0.5 max-h-[calc(100vh-220px)] overflow-y-auto">
              {sectionViews.map(v => (
                <ViewCard key={v.id} view={v} isSelected={selectedView.id === v.id} onClick={() => handleViewSelect(v)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
