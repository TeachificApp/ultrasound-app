/*
  iHeartEcho™ — TEE/ICE ScanCoach
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
  Covers: ME, TG, UE views for TEE; ICE views for structural procedures
  Media: Admin-uploadable reference images/clips per view; hidden from users when empty.
*/
import React, { useState, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  ChevronRight, Eye, Info, AlertTriangle, Microscope, Activity,
  Upload, Trash2, ImagePlus, Video, X, CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { uploadFile } from "@/lib/uploadFile";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { ScanCoachViewMediaCard } from "@/components/ScanCoachViewMediaPanel";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import BillingCodesCard from "@/components/BillingCodesCard";
import { TEE_BILLING } from "@/lib/scanCoachBillingCodes";

// ─── Helper: render image or video based on URL extension ───────────────────
function MediaDisplay({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const isVideo = /\.(mp4|webm|ogv|mov)(\?|$)/i.test(src);
  if (isVideo) return <video src={src} autoPlay loop muted playsInline className={className} style={style} />;
  return <img src={src} alt={alt} className={className} style={style} />;
}

// Map TEEIceScanCoach hyphenated view IDs → registry camelCase IDs for override lookup
const TEE_ID_TO_REGISTRY: Record<string, string> = {
  "me-4c":              "me4c",
  "me-mitral-comm":     "mebicaval",
  "me-2c":              "me2c",
  "me-lax":             "melax",
  "me-av-lax":          "melax",
  "me-av-sax":          "meavsax",
  "me-rv-io":           "mervio",
  "me-bicaval":         "mebicaval",
  "me-mod-bicaval-tv":  "mebicaval",
  "me-rpv":             "me_rpv",
  "me-lpv":             "me_lpv",
  "me-asc-ao-sax":      "me_asc_ao_sax",
  "me-asc-ao-lax":      "me_asc_ao_lax",
  "ue-arch-lax":        "ue_arch_lax",
  "ue-arch-sax":        "ue_arch_sax",
  "tg-basal-sax":       "tgbasal",
  "tg-mid-sax":         "tgsax",
  "tg-apical-sax":      "tg_apical_sax",
  "tg-2c":              "tg2c",
  "tg-lax":             "tglax",
  "tg-rv-basal":        "tg_rv_basal",
  "tg-rv-inflow":       "tg_rv_inflow",
  "tg-deep-lax":        "tglax",
  "desc-ao-sax":        "desc_ao_sax",
  "desc-ao-lax":        "desc_ao_lax",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface TEEView {
  id: string;
  name: string;
  abbr: string;
  section: "ME" | "TG" | "UE" | "Aorta" | "ICE"; // ICE kept in data for standalone page
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
  // ── Mid-Esophageal (ME) ──
  {
    id: "me-4c",
    name: "ME Four-Chamber",
    abbr: "ME 4C",
    section: "ME",
    angle: "0–20°",
    depth: "28–32 cm",
    color: "#189aa1",
    description: "The standard starting view. Shows all four chambers, both AV valves, and the IAS simultaneously. Essential for LV/RV function and MV/TV morphology.",
    probeManeuver: "Insert probe to 28–32 cm; rotate to 0°; slight anteflexion to bring all four chambers into view. Optimise depth to include both atria.",
    anatomy: ["LV (all walls)", "RV", "LA", "RA", "MV (A2/P2)", "TV (anterior/septal leaflets)", "IAS", "Coronary sinus (posterior)"],
    doppler: ["MR color Doppler (jet origin, direction, vena contracta)", "TR color Doppler + CW (RVSP)", "MV PW inflow (E/A ratio)", "Tissue Doppler (e') at septal and lateral annulus"],
    clinicalUse: ["LV systolic function (EF, wall motion)", "RV size and function (FAC, TAPSE equivalent)", "MV morphology and MR severity", "TR severity and RVSP estimation", "ASD/PFO (IAS color Doppler + bubble study)", "LA/RA size"],
    normalFindings: ["RV <2/3 LV size", "Normal MV coaptation", "No IAS defect on color Doppler", "Normal LA/RA size"],
    pitfalls: ["Foreshortening of LV apex — advance probe slightly", "RV dilation can push IVS leftward — do not misinterpret as LV dysfunction", "MR jet direction affects severity assessment — eccentric jets underestimate severity"],
  },
  {
    id: "me-mitral-comm",
    name: "ME Mitral Commissural",
    abbr: "ME MC",
    section: "ME",
    angle: "60–70°",
    depth: "28–32 cm",
    color: "#189aa1",
    description: "Commissural view of the MV showing P1/A3 medially and P3/A1 laterally. Essential for identifying commissural pathology and MR jet origin.",
    probeManeuver: "From ME 4C, rotate to 60–70°. The MV appears as a 'fish-mouth' with commissures visible. Adjust depth to optimise MV.",
    anatomy: ["MV (P1/A3 medial, P3/A1 lateral)", "LV (inferolateral and anteroseptal walls)", "LA", "CS (coronary sinus)"],
    doppler: ["MR color Doppler (commissural jet origin)", "MV PW inflow"],
    clinicalUse: ["Commissural MR (P1/P3 prolapse, commissural fusion)", "MV repair planning (commissuroplasty)", "Rheumatic MV disease (commissural fusion)", "MitraClip planning (commissural anatomy)"],
    normalFindings: ["Normal coaptation at both commissures", "No commissural fusion", "No commissural MR jet"],
    pitfalls: ["Commissural jets are often eccentric — do not underestimate MR severity", "Commissural fusion in rheumatic disease is best assessed here"],
  },
  {
    id: "me-2c",
    name: "ME Two-Chamber",
    abbr: "ME 2C",
    section: "ME",
    angle: "80–100°",
    depth: "28–32 cm",
    color: "#189aa1",
    description: "Shows LV anterior and inferior walls, LA, and LAA. Essential for LAA thrombus assessment and MV anterior/posterior leaflet evaluation.",
    probeManeuver: "From ME 4C, rotate to 80–100°. The LV anterior and inferior walls should be visible. Adjust to bring LAA into view.",
    anatomy: ["LV (anterior and inferior walls)", "LA", "LAA", "MV (A1/A2/A3 and P1/P2/P3)"],
    doppler: ["LAA PW Doppler (emptying velocity)", "MR color Doppler (2C plane)", "MV PW inflow"],
    clinicalUse: ["LAA thrombus assessment (pre-cardioversion, AF)", "LAA emptying velocity (stasis = <20 cm/s)", "LV anterior wall (LAD territory)", "LV inferior wall (RCA territory)", "MV leaflet evaluation (A1/A2/A3, P1/P2/P3)"],
    normalFindings: ["No LAA thrombus or SEC", "LAA emptying velocity >40 cm/s", "Normal anterior and inferior wall motion"],
    pitfalls: ["LAA pectinate muscles can mimic thrombus — use contrast if uncertain", "LAA emptying velocity <20 cm/s = high thrombus risk even without visible thrombus", "SEC (smoke) = stasis — high thrombus risk"],
  },
  {
    id: "me-lax",
    name: "ME Long Axis",
    abbr: "ME LAX",
    section: "ME",
    angle: "120–160°",
    depth: "28–32 cm",
    color: "#189aa1",
    description: "The TEE equivalent of the parasternal long axis. Shows AV, LVOT, MV, and aortic root. Essential for AR and aortic root assessment.",
    probeManeuver: "From ME 2C, continue rotating to 120–160°. The AV, LVOT, and MV should be visible simultaneously. Adjust depth to include the aortic root.",
    anatomy: ["AV (RCC and NCC)", "LVOT", "MV (A2/P2)", "Aortic root (sinus, STJ, ascending aorta)", "LV (anteroseptal and inferolateral walls)"],
    doppler: ["AR color Doppler (LVOT — jet width/LVOT width)", "MR color Doppler (LAX plane)", "LVOT PW (VTI for SV)", "AV color (AS turbulence)"],
    clinicalUse: ["AV morphology (bicuspid vs tricuspid)", "AR severity (jet width/LVOT width)", "LVOT diameter measurement (SV calculation)", "Aortic root dimensions (sinus, STJ, ascending)", "MV posterior leaflet prolapse (best seen here)", "Aortic dissection (ascending aorta)"],
    normalFindings: ["Tricuspid AV with normal opening", "LVOT diameter 1.8–2.2 cm", "No AR on color Doppler", "Aortic root ≤38 mm"],
    pitfalls: ["LVOT diameter must be measured in mid-systole, 0.5–1 cm below AV", "AR jet width/LVOT width >65% = severe AR", "Bicuspid AV may appear tricuspid in LAX — confirm in SAX"],
  },
  {
    id: "me-av-lax",
    name: "ME AV Long Axis",
    abbr: "ME AV LAX",
    section: "ME",
    angle: "120–160°",
    depth: "25–30 cm",
    color: "#189aa1",
    description: "Focused long-axis view of the aortic valve and root. Complements ME LAX with optimised AV visualisation and root measurement.",
    probeManeuver: "From ME LAX, slightly withdraw probe and optimise angle (120–160°) to centre the AV. Adjust depth to focus on AV and proximal root.",
    anatomy: ["AV (RCC and NCC in LAX)", "Aortic annulus", "Sinus of Valsalva", "Sinotubular junction", "Proximal ascending aorta"],
    doppler: ["AR color Doppler (jet width relative to LVOT)", "AV CW (peak gradient if AS suspected)"],
    clinicalUse: ["AV cusp motion (opening excursion, doming, prolapse)", "Aortic root dimensions (annulus, sinus, STJ, ascending)", "AR severity (central vs eccentric jet)", "Pre-TAVR assessment (annulus sizing)", "Aortic dissection (intimal flap at root)"],
    normalFindings: ["Normal cusp opening excursion", "No AR on color Doppler", "Aortic annulus 2.0–2.5 cm", "Sinus of Valsalva ≤38 mm"],
    pitfalls: ["Annulus measurement for TAVR: measure inner edge to inner edge in mid-systole", "Eccentric AR jet may be missed if not scanning full LVOT width with color"],
  },
  {
    id: "me-av-sax",
    name: "ME AV Short Axis",
    abbr: "ME AV SAX",
    section: "ME",
    angle: "30–60°",
    depth: "25–30 cm",
    color: "#189aa1",
    description: "Short-axis view of the aortic valve showing all three cusps (R, L, N), coronary ostia, RVOT, and PV. Essential for AV morphology and coronary assessment.",
    probeManeuver: "From ME LAX, rotate back to 30–60°. The AV should appear as a 'Mercedes-Benz' sign with three cusps. Adjust depth to see coronary ostia.",
    anatomy: ["AV (RCC, LCC, NCC)", "LMCA ostium (from LCC)", "RCA ostium (from RCC)", "RVOT", "PV", "RA", "TV"],
    doppler: ["AR color Doppler (SAX — identifies which cusp is prolapsing/perforated)", "RVOT color (RVOT obstruction)", "PV color (PR, PS)"],
    clinicalUse: ["AV morphology (bicuspid vs tricuspid — best view)", "Coronary ostia assessment (dissection, anomalous origin)", "RVOT and PV evaluation", "AR mechanism (which cusp)", "Endocarditis (vegetation location on AV)", "Pre-TAVR (calcium distribution)"],
    normalFindings: ["Three equal cusps (Mercedes-Benz sign)", "LMCA and RCA ostia visible", "No AR on color Doppler", "Normal RVOT"],
    pitfalls: ["Bicuspid AV: two cusps with raphe — raphe can mimic a third cusp", "LMCA ostium from LCC, RCA from RCC — coronary anatomy varies", "Aortic vegetations are best seen here (cusp-specific location)"],
  },
  {
    id: "me-rv-io",
    name: "ME RV Inflow-Outflow",
    abbr: "ME RV IO",
    section: "ME",
    angle: "60–90°",
    depth: "28–32 cm",
    color: "#189aa1",
    description: "Shows TV, RV, RVOT, and PV in one view. The primary view for comprehensive RV assessment and TR/PR Doppler.",
    probeManeuver: "From ME AV SAX, rotate to 60–90° and adjust to bring TV and RVOT into view simultaneously. The RV appears as a crescent between TV and PV.",
    anatomy: ["TV (anterior, posterior, septal leaflets)", "RV (inflow and outflow)", "RVOT", "PV", "PA"],
    doppler: ["TR color Doppler + CW (RVSP)", "PR color Doppler (severity, PHT)", "RVOT PW (RVOT VTI)", "PV CW (PS gradient)"],
    clinicalUse: ["TV morphology and TR mechanism", "RVSP estimation (TR CW)", "RVOT obstruction (subvalvular, valvular, supravalvular)", "PV stenosis/regurgitation", "Carcinoid heart disease (TV/PV thickening)", "Ebstein anomaly (apical displacement of TV)"],
    normalFindings: ["Normal TV coaptation", "TR Vmax <2.8 m/s (RVSP <36 mmHg + RAP)", "No RVOT obstruction", "Mild PR acceptable"],
    pitfalls: ["TR CW: ensure beam is parallel to TR jet — underestimation is common", "RVOT obstruction: use color Doppler to identify level (subvalvular vs valvular)", "Carcinoid: TV and PV thickening with restricted motion"],
  },
  {
    id: "me-bicaval",
    name: "ME Bicaval",
    abbr: "ME Bicaval",
    section: "ME",
    angle: "90–110°",
    depth: "28–32 cm",
    color: "#189aa1",
    description: "Shows SVC, IVC, RA, and the full length of the IAS. Essential for ASD sizing, PFO assessment, and sinus venosus ASD.",
    probeManeuver: "From ME 2C, rotate to 90–110°. The SVC enters RA superiorly, IVC inferiorly. The IAS is seen in full length. Slight rightward rotation may improve SVC/IVC visualisation.",
    anatomy: ["SVC", "IVC", "RA", "IAS (full length)", "Eustachian valve", "Crista terminalis"],
    doppler: ["IAS color Doppler (ASD shunt direction and size)", "SVC PW (hepatic vein pattern)", "Bubble study (PFO — agitated saline)"],
    clinicalUse: ["ASD sizing (secundum, sinus venosus)", "PFO assessment (bubble study)", "Sinus venosus ASD (near SVC)", "IAS aneurysm", "Caval cannula positioning (cardiac surgery)", "RA mass assessment"],
    normalFindings: ["Intact IAS on color Doppler", "No shunt on bubble study", "Normal SVC/IVC entry"],
    pitfalls: ["Sinus venosus ASD is near SVC — do not miss by only looking at fossa ovalis", "PFO: bubble study must be done with Valsalva release — bubbles cross within 3 beats", "IAS aneurysm (>10 mm excursion) is associated with PFO and stroke"],
  },
  {
    id: "me-mod-bicaval-tv",
    name: "ME Modified Bicaval TV",
    abbr: "ME Mod Bicaval TV",
    section: "ME",
    angle: "100–120°",
    depth: "28–32 cm",
    color: "#189aa1",
    description: "Modified bicaval view rotated to bring the TV into the bicaval plane. Used for TV repair planning and TR mechanism assessment.",
    probeManeuver: "From ME Bicaval, slightly increase angle to 100–120° and rotate probe rightward to bring TV into view alongside SVC/IVC.",
    anatomy: ["TV (anterior and posterior leaflets in bicaval plane)", "RA", "SVC", "IVC", "TV annulus"],
    doppler: ["TR color Doppler (jet direction in bicaval plane)", "TR CW (RVSP)"],
    clinicalUse: ["TV repair planning (annular dilation, leaflet tethering)", "TR mechanism (Carpentier classification)", "TV annulus measurement", "Functional TR vs organic TR", "Post-TV repair assessment"],
    normalFindings: ["Normal TV coaptation in bicaval plane", "No TR on color Doppler"],
    pitfalls: ["TV annulus is best measured in this view for repair planning", "Functional TR: annular dilation with normal leaflets — annuloplasty is the treatment"],
  },
  {
    id: "me-rpv",
    name: "ME Right Pulmonary Vein",
    abbr: "ME RPV",
    section: "ME",
    angle: "0–30°",
    depth: "28–32 cm",
    color: "#189aa1",
    description: "Shows the right superior and inferior pulmonary veins entering the LA. PV Doppler is used to assess MR severity and diastolic function.",
    probeManeuver: "From ME 4C, slight rightward rotation and withdraw slightly to 28–30 cm; rotate to 0–30°. The RSPV enters LA posteriorly. Adjust to visualise RSPV ostium.",
    anatomy: ["RSPV (right superior PV)", "RIPV (right inferior PV)", "LA posterior wall", "IAS"],
    doppler: ["RSPV PW Doppler (S/D/Ar waves — S blunting or reversal = severe MR)", "RSPV color (PV stenosis post-ablation)"],
    clinicalUse: ["MR severity (systolic reversal = severe MR)", "Diastolic function (Ar wave duration vs MV A wave)", "Post-AF ablation PV stenosis", "PV anatomy for AF ablation planning"],
    normalFindings: ["S ≥ D wave", "Ar wave <35 cm/s", "No systolic reversal", "No PV stenosis on color"],
    pitfalls: ["Systolic blunting (S < D) = moderate-severe MR; systolic reversal = severe MR", "Ar wave >35 cm/s or Ar duration > MV A duration = elevated LVEDP", "Post-ablation PV stenosis: turbulence and high velocity at ostium"],
  },
  {
    id: "me-lpv",
    name: "ME Left Pulmonary Vein",
    abbr: "ME LPV",
    section: "ME",
    angle: "90–110°",
    depth: "28–32 cm",
    color: "#189aa1",
    description: "Shows the left superior and inferior pulmonary veins and the LAA. Essential for LAA thrombus and LPV Doppler assessment.",
    probeManeuver: "From ME 2C, slight leftward rotation; rotate to 90–110°. The LSPV enters LA posteriorly adjacent to the LAA. Adjust to visualise LSPV ostium and LAA.",
    anatomy: ["LSPV (left superior PV)", "LIPV (left inferior PV)", "LAA", "LA posterior wall"],
    doppler: ["LSPV PW Doppler (S/D/Ar waves)", "LAA PW Doppler (emptying velocity)", "LSPV color (PV stenosis)"],
    clinicalUse: ["MR severity (systolic reversal in LSPV)", "LAA thrombus assessment", "LAA emptying velocity (stasis)", "Post-AF ablation LPV stenosis", "LAA closure device sizing (WATCHMAN)"],
    normalFindings: ["S ≥ D wave", "No LAA thrombus", "LAA emptying >40 cm/s", "No PV stenosis"],
    pitfalls: ["LAA pectinate muscles mimic thrombus — use contrast if uncertain", "LAA emptying <20 cm/s = high thrombus risk", "LSPV is adjacent to LAA — ensure PW sample is in PV, not LAA"],
  },
  {
    id: "me-asc-ao-sax",
    name: "ME Ascending Aorta SAX",
    abbr: "ME Asc Ao SAX",
    section: "ME",
    angle: "0–30°",
    depth: "20–25 cm",
    color: "#189aa1",
    description: "Short-axis view of the ascending aorta at the level of the PA bifurcation. Shows main PA, RPA, SVC, and ascending aorta in cross-section.",
    probeManeuver: "Withdraw probe to 20–25 cm; rotate to 0–30°. The ascending aorta appears as a circle with PA anterior. Adjust to visualise PA bifurcation and RPA.",
    anatomy: ["Ascending aorta (SAX)", "Main PA", "PA bifurcation", "RPA", "SVC", "Left PA (partially)"],
    doppler: ["PA color Doppler (PA dilation, central PE)", "SVC PW (hepatic vein pattern)"],
    clinicalUse: ["Ascending aorta diameter (SAX)", "PA dilation (PAH, PS)", "Central PE (filling defect in main PA or RPA)", "SVC assessment", "Aortic dissection (ascending involvement)"],
    normalFindings: ["Ascending aorta ≤38 mm", "Main PA ≤25 mm", "No intraluminal filling defect", "Normal SVC"],
    pitfalls: ["Central PE: echogenic filling defect in PA — confirm with CT-PA", "PA and aorta can be confused — PA is anterior with thinner walls", "RPA is well seen here — assess for RPA thrombus"],
  },
  {
    id: "me-asc-ao-lax",
    name: "ME Ascending Aorta LAX",
    abbr: "ME Asc Ao LAX",
    section: "ME",
    angle: "90–120°",
    depth: "20–25 cm",
    color: "#189aa1",
    description: "Long-axis view of the ascending aorta. Essential for aortic dissection assessment, aneurysm measurement, and atheroma grading.",
    probeManeuver: "From ME Asc Ao SAX, rotate to 90–120°. The ascending aorta appears as a tubular structure. Adjust depth and angle to maximise aortic length.",
    anatomy: ["Ascending aorta (LAX)", "Proximal arch", "SVC (posterior)", "RPA (posterior)"],
    doppler: ["Color Doppler over ascending aorta (dissection flap, true vs false lumen)"],
    clinicalUse: ["Ascending aorta diameter measurement (sinus, STJ, mid-ascending)", "Type A aortic dissection (intimal flap)", "Aortic atheroma grading (I–V)", "Aneurysm assessment", "Cannulation site selection (cardiac surgery)"],
    normalFindings: ["Ascending aorta ≤38 mm", "Smooth intima", "No dissection flap", "No atheroma"],
    pitfalls: ["Type A dissection: intimal flap in ascending aorta — true lumen compresses in systole", "Atheroma Grade IV (≥4 mm) and V (mobile) = highest embolic risk", "Near-field artefact can mimic dissection — confirm with multiple views"],
  },
  // ── Upper Esophageal (UE) ──
  {
    id: "ue-arch-lax",
    name: "UE Aortic Arch LAX",
    abbr: "UE Arch LAX",
    section: "UE",
    angle: "0°",
    depth: "20–25 cm",
    color: "#0f766e",
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
    color: "#0f766e",
    description: "Short-axis view of the aortic arch. Shows the main pulmonary artery and left pulmonary artery in cross-section.",
    probeManeuver: "From UE Arch LAX, rotate to 90°. The circular arch cross-section appears with PA anterior.",
    anatomy: ["Aortic arch (SAX)", "Main PA", "Left PA", "Left subclavian artery"],
    doppler: ["PA color Doppler (PA dilation, PE)", "PW in PA (pulmonary flow)"],
    clinicalUse: ["PA dilation assessment", "Pulmonary embolism (central PE in main PA)", "Arch diameter measurement", "Pulmonary HTN screening"],
    normalFindings: ["Main PA diameter ≤2.5 cm", "No intraluminal filling defect", "Normal arch diameter"],
    pitfalls: ["Central PE may be visible as echogenic filling defect — confirm with CT-PA", "PA and aorta can be confused — PA is anterior and has thinner walls"],
  },
  // ── Transgastric (TG) ──
  {
    id: "tg-basal-sax",
    name: "TG Basal SAX",
    abbr: "TG Basal SAX",
    section: "TG",
    angle: "0°",
    depth: "38–42 cm",
    color: "#0e7490",
    description: "Short-axis view at the level of the MV leaflet tips. Shows the 'fish-mouth' MV opening and LV basal segments.",
    probeManeuver: "Advance probe to 38–42 cm; rotate to 0°; slight anteflexion. The MV leaflet tips appear as a 'fish-mouth'. Adjust depth to optimise MV.",
    anatomy: ["MV leaflet tips (SAX)", "LV basal segments (6 segments)", "Papillary muscles (basal level)"],
    doppler: ["Color Doppler over MV (commissural fusion, MS)"],
    clinicalUse: ["Mitral stenosis (commissural fusion, MV area by planimetry)", "MV leaflet tip morphology", "LV basal wall motion", "Rheumatic MV disease"],
    normalFindings: ["Fish-mouth MV opening", "No commissural fusion", "Normal LV basal wall motion"],
    pitfalls: ["MVA planimetry: trace the inner edge of the MV orifice at maximal opening", "Commissural fusion in rheumatic disease: fused commissures reduce MV area"],
  },
  {
    id: "tg-mid-sax",
    name: "TG Mid SAX",
    abbr: "TG Mid SAX",
    section: "TG",
    angle: "0°",
    depth: "40–45 cm",
    color: "#0e7490",
    description: "The workhorse intraoperative view. Shows all 6 LV mid-cavity segments simultaneously — the best single view for ischaemia monitoring.",
    probeManeuver: "Advance probe to 40–45 cm; rotate to 0°; anteflexion to obtain a circular LV cross-section. Both papillary muscles should be visible.",
    anatomy: ["LV (all 6 mid segments)", "Anterolateral papillary muscle (LAD/LCx territory)", "Posteromedial papillary muscle (RCA territory)", "RV free wall", "Pericardium"],
    doppler: ["Color Doppler over LV cavity (MR through MV)", "Not primary Doppler view — use for wall motion"],
    clinicalUse: ["Intraoperative LV monitoring (wall motion changes = ischaemia)", "Preload assessment (LV cavity size)", "Systolic function (EF estimation)", "Papillary muscle rupture", "Pericardial effusion"],
    normalFindings: ["Symmetric wall motion all segments", "Normal LV cavity size", "Both PMs visible and symmetric"],
    pitfalls: ["Off-axis view can make normal wall appear hypokinetic — ensure circular LV cross-section", "RV volume overload causes IVS flattening — do not misinterpret as ischaemia"],
  },
  {
    id: "tg-apical-sax",
    name: "TG Apical SAX",
    abbr: "TG Apical SAX",
    section: "TG",
    angle: "0°",
    depth: "45–50 cm",
    color: "#0e7490",
    description: "Short-axis view at the LV apex. Used to assess apical wall motion, apical thrombus, and apical ballooning (Takotsubo).",
    probeManeuver: "From TG Mid SAX, advance probe slightly to 45–50 cm. The LV appears smaller and more circular at the apex.",
    anatomy: ["LV apical segments (6 apical segments)", "LV apex"],
    doppler: ["Color Doppler at LV apex (apical thrombus, apical VSD)"],
    clinicalUse: ["Apical wall motion assessment", "Apical thrombus (post-MI, Takotsubo)", "Apical ballooning (Takotsubo syndrome)", "Apical HCM", "Apical VSD (post-MI)"],
    normalFindings: ["Normal apical wall motion", "No apical thrombus", "No apical ballooning"],
    pitfalls: ["Apical trabeculations can mimic thrombus — use contrast if uncertain", "Takotsubo: apical ballooning with preserved basal function — classic pattern"],
  },
  {
    id: "tg-2c",
    name: "TG Two-Chamber",
    abbr: "TG 2C",
    section: "TG",
    angle: "80–100°",
    depth: "40–45 cm",
    color: "#0e7490",
    description: "Long-axis view of the LV from the transgastric position. Shows true LV apex and MV subvalvular apparatus.",
    probeManeuver: "From TG Mid SAX, rotate to 80–100°. The LV anterior and inferior walls should be visible. Adjust anteflexion to maximise LV length.",
    anatomy: ["LV (anterior and inferior walls, true apex)", "LA", "MV (subvalvular apparatus)", "Papillary muscles"],
    doppler: ["MV inflow PW", "LV apex color (apical thrombus)"],
    clinicalUse: ["True LV apex assessment (apical HCM, thrombus)", "LV length measurement", "Inferior wall motion (RCA territory)", "Anterior wall motion (LAD territory)", "MV subvalvular apparatus (chordal rupture)"],
    normalFindings: ["Smooth LV apex", "Normal anterior and inferior wall motion", "No apical thrombus"],
    pitfalls: ["Foreshortening is common — ensure probe is fully advanced and antiflex maximally", "Apical trabeculations can mimic thrombus — use contrast if uncertain"],
  },
  {
    id: "tg-lax",
    name: "TG LAX",
    abbr: "TG LAX",
    section: "TG",
    angle: "90–120°",
    depth: "40–45 cm",
    color: "#0e7490",
    description: "Transgastric long-axis view showing LVOT, AV, and LV. Best view for LVOT PW Doppler and AV CW Doppler alignment in intraoperative TEE.",
    probeManeuver: "From TG 2C, continue rotating to 90–120°. The LVOT and AV should be visible. Adjust anteflexion to align Doppler beam with LVOT flow.",
    anatomy: ["LV (anterior and inferior walls)", "LVOT", "AV", "Proximal ascending aorta", "MV"],
    doppler: ["LVOT PW Doppler (VTI for SV)", "AV CW Doppler (AS gradient)", "Color over LVOT/AV (SAM, AR)"],
    clinicalUse: ["LVOT PW Doppler (SV calculation)", "AV CW Doppler (AS gradient — good alignment)", "LVOT obstruction (HOCM, SAM)", "Post-TAVR gradient", "LV anterior and inferior wall motion"],
    normalFindings: ["LVOT VTI 18–22 cm", "AV peak velocity <2.0 m/s", "No LVOT obstruction"],
    pitfalls: ["Beam-flow angle must be <20° for accurate gradients", "SAM: systolic anterior motion of MV into LVOT — use color to confirm obstruction"],
  },
  {
    id: "tg-rv-basal",
    name: "TG RV Basal",
    abbr: "TG RV Basal",
    section: "TG",
    angle: "0–20°",
    depth: "38–42 cm",
    color: "#0e7490",
    description: "Transgastric view of the RV basal segments and TV subvalvular apparatus. Complements ME RV IO for comprehensive RV assessment.",
    probeManeuver: "From TG Mid SAX, slight rightward rotation and withdraw slightly to 38–42 cm; rotate to 0–20°. The RV basal segments and TV should be visible.",
    anatomy: ["RV (basal segments)", "TV (subvalvular apparatus)", "Moderator band", "RVOT (partially)"],
    doppler: ["TR color Doppler", "TV PW inflow"],
    clinicalUse: ["RV basal function", "TV subvalvular apparatus (chordal rupture)", "RV basal wall motion (RCA territory)", "Moderator band hypertrophy (ARVC)"],
    normalFindings: ["Normal RV basal wall motion", "Normal TV subvalvular apparatus"],
    pitfalls: ["RV basal view is often underutilised — important for TV repair planning", "Moderator band can be prominent in ARVC"],
  },
  {
    id: "tg-rv-inflow",
    name: "TG RV Inflow",
    abbr: "TG RV Inflow",
    section: "TG",
    angle: "100–120°",
    depth: "38–42 cm",
    color: "#0e7490",
    description: "Transgastric RV inflow view showing TV and RV in long axis. Best Doppler alignment for TR CW in some patients.",
    probeManeuver: "From TG RV Basal, rotate to 100–120°. The TV and RV inflow should be visible in long axis.",
    anatomy: ["TV (inflow view)", "RV inflow", "RA"],
    doppler: ["TR CW Doppler (RVSP — good alignment from TG)", "TV PW inflow"],
    clinicalUse: ["TR CW Doppler (RVSP estimation)", "TV morphology (inflow view)", "RV inflow assessment"],
    normalFindings: ["Normal TV coaptation", "TR Vmax <2.8 m/s"],
    pitfalls: ["Best Doppler alignment for TR varies by patient — compare with ME RV IO", "TV inflow view: ensure sample is in RV inflow, not RVOT"],
  },
  {
    id: "tg-deep-lax",
    name: "Deep TG LAX",
    abbr: "Deep TG LAX",
    section: "TG",
    angle: "0° (anteflexed)",
    depth: "45–50 cm",
    color: "#0e7490",
    description: "The only TEE view that allows CW Doppler alignment with LVOT/AV flow. Essential for accurate aortic valve gradients in intraoperative TEE.",
    probeManeuver: "Advance probe fully into stomach (45–50 cm); anteflex maximally; rotate to 0–20°. The LVOT and AV should align with the Doppler beam.",
    anatomy: ["LV apex", "LVOT", "AV", "Proximal ascending aorta"],
    doppler: ["LVOT PW (VTI for SV, LVOT obstruction)", "AV CW (peak gradient, mean gradient — most accurate TEE view)", "Color over LVOT/AV (SAM, AR)"],
    clinicalUse: ["Aortic stenosis gradient (most accurate TEE position)", "LVOT obstruction (HOCM, SAM)", "Post-TAVR gradient assessment", "SV and CO calculation"],
    normalFindings: ["LVOT VTI 18–22 cm", "AV peak velocity <2.0 m/s", "No LVOT obstruction"],
    pitfalls: ["Requires deep probe insertion — may cause patient discomfort; ensure adequate sedation", "Beam-flow angle must be <20° for accurate gradients — adjust probe rotation"],
  },
  // ── Aorta ──
  {
    id: "desc-ao-sax",
    name: "Desc Aorta SAX",
    abbr: "Desc Ao SAX",
    section: "Aorta",
    angle: "0°",
    depth: "30–40 cm",
    color: "#134e4a",
    description: "Short-axis view of the descending thoracic aorta obtained by rotating the probe leftward from any ME view. Used to assess dissection, atheroma, and aneurysm.",
    probeManeuver: "From any ME view, rotate probe leftward (counterclockwise) until the descending aorta appears as a circle. Adjust depth to 30–40 cm. Withdraw/advance to scan the full descending aorta.",
    anatomy: ["Descending thoracic aorta (SAX)", "Aortic wall layers"],
    doppler: ["Color Doppler (true vs false lumen in dissection)", "PW in true lumen (systolic flow)"],
    clinicalUse: ["Type B aortic dissection (intimal flap)", "Aortic atheroma grading (I–V)", "Descending aorta aneurysm", "Aortic wall haematoma", "Intra-aortic balloon pump positioning"],
    normalFindings: ["Descending aorta ≤28 mm", "Smooth intima", "No dissection flap", "No atheroma"],
    pitfalls: ["Scan from diaphragm (40 cm) to arch (20 cm) systematically", "True lumen: systolic expansion; false lumen: diastolic expansion or no flow", "Grade IV atheroma (≥4 mm) and V (mobile/ulcerated) = highest embolic risk"],
  },
  {
    id: "desc-ao-lax",
    name: "Desc Aorta LAX",
    abbr: "Desc Ao LAX",
    section: "Aorta",
    angle: "90°",
    depth: "30–40 cm",
    color: "#134e4a",
    description: "Long-axis view of the descending thoracic aorta. Complements Desc Ao SAX for dissection extent and atheroma assessment.",
    probeManeuver: "From Desc Ao SAX, rotate to 90°. The descending aorta appears as a tubular structure. Adjust depth and withdraw/advance to scan the full length.",
    anatomy: ["Descending thoracic aorta (LAX)", "Aortic wall layers", "Intimal flap (if dissection)"],
    doppler: ["Color Doppler (true vs false lumen flow direction)", "CW across coarctation (if present)"],
    clinicalUse: ["Dissection extent (LAX confirms intimal flap length)", "Atheroma morphology (sessile vs mobile)", "Aortic wall haematoma (intramural haematoma)", "Aneurysm length measurement"],
    normalFindings: ["Smooth intima", "No dissection flap", "No atheroma", "Normal diameter"],
    pitfalls: ["Intramural haematoma: crescentic thickening without intimal flap — can progress to dissection", "Mobile atheroma in LAX = highest embolic risk — report as Grade V"],
  },
];

// ─── Section config ────────────────────────────────────────────────────────────
const SECTION_LABELS: Record<string, string> = {
  ME: "Midesophageal (ME)",
  TG: "Transgastric (TG)",
  UE: "Upper Esophageal (UE)",
  Aorta: "Aorta",
  ICE: "Intracardiac Echo (ICE)",
};

const SECTION_COLORS: Record<string, string> = {
  ME: "#189aa1",
  TG: "#0e7490",
  UE: "#0f766e",
  Aorta: "#134e4a",
  ICE: "#d97706",
};

// ─── Admin Media Upload Panel ──────────────────────────────────────────────────
function UploadZone({
  label,
  role,
  viewId,
  media,
  uploading,
  uploadError,
  uploadSuccess,
  caption,
  onCaptionChange,
  onFile,
  onDelete,
  accentColor,
  borderColor,
}: {
  label: string;
  role: "clinical" | "reference";
  viewId: string;
  media: Array<{ id: number; url: string; mediaType: string; caption?: string | null; role?: string }>;
  uploading: boolean;
  uploadError: string | null;
  uploadSuccess: boolean;
  caption: string;
  onCaptionChange: (v: string) => void;
  onFile: (file: File, role: "clinical" | "reference") => void;
  onDelete: (id: number) => void;
  accentColor: string;
  borderColor: string;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roleMedia = media.filter((m) => !m.role || m.role === role || (role === "reference" && m.role === "general"));

  return (
    <div className="rounded-xl border p-3 mb-3" style={{ borderColor, background: role === "clinical" ? "#f0fdf4" : "#eff6ff" }}>
      <p className="text-xs font-bold mb-2" style={{ color: accentColor }}>{label}</p>
      {roleMedia.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {roleMedia.map((m) => (
            <div key={m.id} className="relative rounded-lg overflow-hidden border border-gray-100 group">
              {m.mediaType === "image" ? (
                <img src={m.url} alt={m.caption ?? label} className="w-full object-contain bg-gray-900 max-h-36" />
              ) : (
                <video src={m.url} className="w-full max-h-36 bg-gray-900" autoPlay loop muted playsInline controlsList="nodownload" onContextMenu={(e) => e.preventDefault()} />
              )}
              {m.caption && <p className="text-xs text-gray-500 px-2 py-1 truncate">{m.caption}</p>}
              <button
                onClick={() => onDelete(m.id)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="absolute top-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                {m.mediaType === "clip" ? "Clip" : role === "clinical" ? "Clinical" : "Reference"}
              </span>
            </div>
          ))}
        </div>
      )}
      <input
        type="text"
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => onCaptionChange(e.target.value)}
        className="w-full text-xs border rounded-lg px-3 py-1.5 mb-2 bg-white focus:outline-none focus:ring-1"
        style={{ borderColor, outline: "none" }}
      />
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f, role); }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors"
        style={{ borderColor: dragOver ? accentColor : borderColor, background: dragOver ? "#f0fdf4" : "transparent" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/x-ms-wmv,.wmv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f, role); }}
        />
        <div className="flex items-center justify-center gap-2 mb-0.5" style={{ color: accentColor }}>
          <ImagePlus className="w-3.5 h-3.5" />
          <Video className="w-3.5 h-3.5" />
        </div>
        <p className="text-xs font-medium" style={{ color: accentColor }}>
          {uploading ? "Uploading…" : "Drop or click to browse"}
        </p>
        <p className="text-xs mt-0.5 text-gray-400">JPEG, PNG, WebP, GIF (max 10 MB) · MP4, WebM (max 50 MB)</p>
      </div>
      {uploadError && (
        <div className="flex items-center gap-2 mt-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
          <X className="w-3.5 h-3.5 flex-shrink-0" />{uploadError}
        </div>
      )}
      {uploadSuccess && (
        <div className="flex items-center gap-2 mt-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />Uploaded successfully.
        </div>
      )}
    </div>
  );
}

function AdminMediaPanel({ viewId }: { viewId: string }) {
  const utils = trpc.useUtils();
  const [uploadingRole, setUploadingRole] = React.useState<"clinical" | "reference" | null>(null);
  const [uploadError, setUploadError] = React.useState<{ clinical: string | null; reference: string | null }>({ clinical: null, reference: null });
  const [uploadSuccess, setUploadSuccess] = React.useState<{ clinical: boolean; reference: boolean }>({ clinical: false, reference: false });
  const [captions, setCaptions] = React.useState<{ clinical: string; reference: string }>({ clinical: "", reference: "" });
  const { data: media = [] } = trpc.scanCoachAdmin.getMediaByView.useQuery({ viewId });
  const uploadMutation = trpc.scanCoachAdmin.uploadViewMedia.useMutation({
    onSuccess: (_, vars) => {
      utils.scanCoachAdmin.getMediaByView.invalidate({ viewId });
      const role = (vars as any).role as "clinical" | "reference";
      setCaptions((c) => ({ ...c, [role]: "" }));
      setUploadSuccess((s) => ({ ...s, [role]: true }));
      setTimeout(() => setUploadSuccess((s) => ({ ...s, [role]: false })), 3000);
      setUploadingRole(null);
    },
    onError: (e, vars) => {
      const role = (vars as any).role as "clinical" | "reference";
      setUploadError((s) => ({ ...s, [role]: e.message }));
      setUploadingRole(null);
    },
  });
  const deleteMutation = trpc.scanCoachAdmin.deleteViewMedia.useMutation({
    onSuccess: () => utils.scanCoachAdmin.getMediaByView.invalidate({ viewId }),
  });

  const handleFile = useCallback(async (file: File, role: "clinical" | "reference") => {
    setUploadError((s) => ({ ...s, [role]: null }));
    setUploadingRole(role);
    try {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        setUploadError((s) => ({ ...s, [role]: "Only images and videos are supported." }));
        setUploadingRole(null);
        return;
      }
      const maxMB = isVideo ? 50 : 10;
      if (file.size > maxMB * 1024 * 1024) {
        setUploadError((s) => ({ ...s, [role]: `File too large. Max ${maxMB} MB.` }));
        setUploadingRole(null);
        return;
      }
      const folder = isVideo ? "tee-ice/clips" : `tee-ice/${role}`;
      const { url, fileKey } = await uploadFile(file, folder, { maxMB, allowedTypes: isVideo ? "video" : "image" });
      await uploadMutation.mutateAsync({
        viewId,
        mediaType: isVideo ? "clip" : "image",
        role,
        url,
        fileKey,
        mimeType: file.type,
        fileName: file.name,
        caption: captions[role].trim() || undefined,
        sortOrder: media.filter((m) => (m as any).role === role).length,
      });
    } catch (e: any) {
      setUploadError((s) => ({ ...s, [role]: e?.message ?? "Upload failed" }));
      setUploadingRole(null);
    }
  }, [viewId, captions, media, uploadMutation]);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-amber-500 text-white">
            <Upload className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-amber-800">Admin: Reference Media</span>
        </div>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Admin only</span>
      </div>
      <UploadZone
        label="Clinical Image (real patient scan)"
        role="clinical"
        viewId={viewId}
        media={media as any[]}
        uploading={uploadingRole === "clinical"}
        uploadError={uploadError.clinical}
        uploadSuccess={uploadSuccess.clinical}
        caption={captions.clinical}
        onCaptionChange={(v) => setCaptions((c) => ({ ...c, clinical: v }))}
        onFile={handleFile}
        onDelete={(id) => deleteMutation.mutate({ id })}
        accentColor="#16a34a"
        borderColor="#bbf7d0"
      />
      <UploadZone
        label="Reference Image (diagram / schematic / annotated)"
        role="reference"
        viewId={viewId}
        media={media as any[]}
        uploading={uploadingRole === "reference"}
        uploadError={uploadError.reference}
        uploadSuccess={uploadSuccess.reference}
        caption={captions.reference}
        onCaptionChange={(v) => setCaptions((c) => ({ ...c, reference: v }))}
        onFile={handleFile}
        onDelete={(id) => deleteMutation.mutate({ id })}
        accentColor="#2563eb"
        borderColor="#bfdbfe"
      />
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
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  const isAdmin = appRoles.includes("platform_admin") || appRoles.includes("platform_owner") || user?.role === "admin";

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

          <ScanCoachViewMediaCard
            viewId={TEE_ID_TO_REGISTRY[selectedView.id] ?? selectedView.id}
            view={selectedViewMerged as any}
          />

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
