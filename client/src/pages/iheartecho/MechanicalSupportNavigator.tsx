/*
  MechanicalSupportAssist™ Navigator — iHeartEcho™
  Premium module: Echo assessment for mechanical circulatory support devices
  Devices: LVAD, ECMO, Impella (all versions), LifeVest, ICD
  Brand: Teal #189aa1, Aqua #4ad9e0
  References: ASE 2015 LVAD Guidelines, ELSO Guidelines, ACC/AHA Device Guidelines
*/

import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { useNavigatorProtocol } from "@/hooks/useNavigatorProtocol";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Circle,
  Heart,
  Info,
  Layers,
  Ruler,
  Scan,
  Shield,
  Target,
  Zap,
  ArrowRight,
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  critical?: boolean;
  reference?: string;
};

type ProtocolSection = {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  items: ChecklistItem[];
};

type DeviceTab = {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  icon: React.ElementType;
  sections: ProtocolSection[];
  normalValues: { label: string; value: string; note: string }[];
  clinicalPearls: string[];
};

// ─── LVAD DATA ────────────────────────────────────────────────────────────────

const lvadSections: ProtocolSection[] = [
  {
    id: "lvad_preimplant",
    title: "Pre-Implant Assessment",
    icon: Target,
    color: "#189aa1",
    items: [
      { id: "lvad_pre_lv_size", label: "LV size and geometry", detail: "LVEDD, LVESD. Severely dilated LV (LVEDD >70 mm) is typical LVAD candidate. Assess for LV thrombus — critical contraindication.", critical: true, reference: "LVEDD >70 mm typical; LV thrombus = contraindication" },
      { id: "lvad_pre_ef", label: "LV systolic function (EF)", detail: "EF typically <25% for LVAD candidacy. Biplane Simpson's method. Severely reduced EF confirms need for MCS.", critical: true, reference: "EF <25% typical candidacy threshold" },
      { id: "lvad_pre_rv", label: "RV function assessment", detail: "TAPSE, RV S', FAC, RVEF. RV failure post-LVAD occurs in 20–40%. Pre-implant RV dysfunction is the strongest predictor. TAPSE <7.5 mm = high risk.", critical: true, reference: "TAPSE <7.5 mm, FAC <35% = high RV failure risk" },
      { id: "lvad_pre_mr", label: "Mitral regurgitation severity", detail: "Severe MR may reduce LVAD efficacy. Assess EROA, RVol, VC. Significant MR (≥moderate-severe) may require concomitant repair.", critical: true, reference: "Severe MR: EROA ≥0.4 cm², RVol ≥60 mL" },
      { id: "lvad_pre_ar", label: "Aortic regurgitation", detail: "AR causes recirculation through LVAD — blood ejected into aorta returns to LV via AR jet. Even mild AR may worsen. Severe AR is a relative contraindication.", critical: true, reference: "Moderate+ AR: significant LVAD recirculation risk" },
      { id: "lvad_pre_av", label: "Aortic valve opening", detail: "Document whether AV opens with each beat. Continuous AV closure leads to commissural fusion over time. Intermittent opening preferred.", reference: "AV should open at least every 2–3 beats" },
      { id: "lvad_pre_tr", label: "Tricuspid regurgitation", detail: "Significant TR compounds RV volume overload. Assess VC, EROA. Severe TR may require repair at LVAD implant.", reference: "Severe TR: VC ≥0.7 cm, EROA ≥0.4 cm²" },
      { id: "lvad_pre_septum", label: "Interatrial septum / PFO / ASD", detail: "PFO or ASD can cause right-to-left shunting when LVAD reduces LV pressure. Bubble study recommended. PFO closure may be required.", critical: true, reference: "Bubble study mandatory pre-LVAD" },
      { id: "lvad_pre_thrombus", label: "LV thrombus exclusion", detail: "LV thrombus is an absolute contraindication to LVAD. Assess all apical segments carefully. Use contrast if apical views suboptimal.", critical: true, reference: "LV thrombus = absolute contraindication" },
      { id: "lvad_pre_pericardium", label: "Pericardial effusion baseline", detail: "Document any pre-existing effusion. Post-implant effusion is a common complication.", reference: "Baseline documentation essential" },
    ],
  },
  {
    id: "lvad_postimplant",
    title: "Post-Implant Assessment",
    icon: Activity,
    color: "#0e7490",
    items: [
      { id: "lvad_post_position", label: "Inflow cannula position", detail: "Inflow cannula should point toward mitral valve, parallel to interventricular septum. Malalignment toward septum or lateral wall causes obstruction. Optimal: central LV cavity, 3–4 cm from MV.", critical: true, reference: "Inflow cannula: central, parallel to IVS, 3–4 cm from MV" },
      { id: "lvad_post_inflow_vel", label: "Inflow cannula velocity (PW Doppler)", detail: "Normal inflow velocity: 1.0–2.0 m/s. Velocity >2.0 m/s suggests obstruction (suction, thrombus, malposition). Velocity <1.0 m/s may indicate low pump speed or RV failure.", critical: true, reference: "Normal: 1.0–2.0 m/s; >2.0 m/s = obstruction" },
      { id: "lvad_post_lv_size", label: "LV size (unloading assessment)", detail: "LV should be adequately unloaded — LVEDD should decrease from pre-implant. Persistent LV dilation suggests inadequate unloading (low speed, AR, or inflow obstruction).", critical: true, reference: "LV should be smaller than pre-implant baseline" },
      { id: "lvad_post_septum", label: "Interventricular septal position", detail: "Septum should be midline or slightly leftward. Rightward septal shift indicates LV over-decompression (too high speed). Leftward shift with RV dilation = RV failure.", critical: true, reference: "Midline septum = optimal biventricular balance" },
      { id: "lvad_post_av", label: "Aortic valve opening frequency", detail: "At optimal speed, AV should open intermittently (every 2–4 beats). Continuous AV closure → commissural fusion risk. Continuous opening → inadequate LVAD support.", reference: "Intermittent AV opening preferred" },
      { id: "lvad_post_ar", label: "Aortic regurgitation (post-implant)", detail: "New or worsening AR post-LVAD is common due to continuous flow across AV. Even mild AR causes significant recirculation. Serial monitoring essential.", critical: true, reference: "AR progression common; serial monitoring required" },
      { id: "lvad_post_mr", label: "Mitral regurgitation (post-implant)", detail: "MR typically improves with LV unloading. Persistent severe MR despite adequate LVAD speed may indicate structural MV disease.", reference: "MR should improve with LV unloading" },
      { id: "lvad_post_rv", label: "RV function (post-implant)", detail: "TAPSE, RV S', FAC. RV failure post-LVAD is a major cause of mortality. Worsening RV function requires speed optimization and possible RVAD.", critical: true, reference: "RV failure: TAPSE <10 mm, FAC <25% post-implant" },
      { id: "lvad_post_effusion", label: "Pericardial effusion", detail: "New effusion post-LVAD may indicate bleeding or tamponade. Assess for hemodynamic compromise. Tamponade may be loculated.", critical: true, reference: "New effusion = urgent assessment required" },
      { id: "lvad_post_thrombus", label: "Pump thrombus assessment", detail: "Elevated LDH, hemolysis, or power spikes suggest pump thrombus. Echo: high inflow velocity, spontaneous echo contrast, reduced LV unloading. Confirm with pump parameters.", critical: true, reference: "Pump thrombus: ↑ inflow vel, ↑ LDH, ↑ power" },
      { id: "lvad_post_outflow_plax", label: "Outflow graft — PLAX view", detail: "PLAX view: the outflow graft appears as a circular echogenic structure in cross-section in the anterior mediastinum, anterior to the aortic root. Confirm graft patency (no thrombus, no kink). Color Doppler: continuous antegrade flow. PW Doppler: normal outflow graft velocity 1.5–2.5 m/s. Velocity >2.5 m/s with turbulence suggests obstruction (kink, thrombus, or anastomotic stenosis). Absent or reversed diastolic flow = pump malfunction or severe AR recirculation.", critical: true, reference: "Outflow graft velocity: 1.5–2.5 m/s; >2.5 m/s = obstruction" },
      { id: "lvad_post_outflow_hpsl", label: "Outflow graft — High Parasternal Long-Axis view", detail: "High Parasternal Long-Axis (HPSL): move transducer 1–2 interspaces superior to standard PLAX position, tilt toward right shoulder. This view places the ascending aorta and the outflow graft anastomosis in long axis. Assess: (1) graft-to-ascending aorta anastomosis for turbulence or stenosis on color Doppler, (2) longitudinal graft course and any kinking, (3) CW Doppler across anastomosis if turbulence detected. HPSL is the preferred window for evaluating the outflow graft anastomosis and longitudinal graft course — superior to PLAX cross-section for anastomotic assessment.", critical: true, reference: "HPSL: preferred view for outflow graft anastomosis and longitudinal graft course" },
    ],
  },
  {
    id: "lvad_speed_optimization",
    title: "Speed Optimization Protocol",
    icon: Zap,
    color: "#0f766e",
    items: [
      { id: "lvad_speed_ramp", label: "Ramp study protocol", detail: "Performed at multiple RPM settings (e.g., 8000–12000 RPM in 400 RPM increments). At each speed: measure LVEDD, LVESD, septal position, AV opening, MR severity, and TR gradient.", critical: true, reference: "Ramp study: ASE 2015 LVAD guidelines" },
      { id: "lvad_speed_optimal", label: "Optimal speed endpoints", detail: "Goal: (1) LV adequately unloaded (LVEDD reduced), (2) Septum midline, (3) AV opens intermittently, (4) No suction events, (5) RVSP estimated by TR gradient.", critical: true, reference: "Optimal: midline septum, intermittent AV opening" },
      { id: "lvad_speed_suction", label: "Suction event detection", detail: "Suction: LV collapses around inflow cannula. Echo: small LV, rightward septal shift, intermittent inflow velocity spikes. Reduce speed if suction events occur.", critical: true, reference: "Suction: ↓ LVEDD, rightward septum, velocity spikes" },
      { id: "lvad_speed_rvsp", label: "RVSP monitoring during ramp", detail: "TR CW Doppler at each speed step. RVSP should decrease with increasing LVAD speed (improved LV unloading → reduced LA pressure → reduced RV afterload).", reference: "RVSP should decrease with optimal speed increase" },
    ],
  },
];

const lvadNormalValues = [
  { label: "Inflow Cannula Velocity", value: "1.0–2.0 m/s", note: ">2.0 m/s = obstruction; <1.0 m/s = low flow" },
  { label: "Inflow Cannula Position", value: "Central, parallel to IVS", note: "3–4 cm from mitral valve" },
  { label: "AV Opening Frequency", value: "Every 2–4 beats", note: "Continuous closure = fusion risk" },
  { label: "Septal Position", value: "Midline", note: "Rightward = over-decompression; Leftward = RV failure" },
  { label: "TAPSE (post-implant)", value: "≥10 mm", note: "<10 mm = significant RV dysfunction" },
  { label: "Outflow Graft Velocity", value: "1.5–2.5 m/s", note: ">2.5 m/s = obstruction (kink, thrombus, or anastomotic stenosis)" },
  { label: "Outflow Graft Flow Pattern", value: "Continuous antegrade", note: "Absent or reversed diastolic flow = pump malfunction or severe AR recirculation" },
];

const lvadPearls = [
  "Inflow cannula malposition is the most common mechanical complication — always assess position and velocity.",
  "AR progression is nearly universal with continuous-flow LVADs — even mild AR causes significant recirculation.",
  "RV failure post-LVAD is the leading cause of 30-day mortality — pre-implant RV assessment is critical.",
  "Pump thrombus: suspect when LDH rises, power increases, or inflow velocity exceeds 2.5 m/s.",
  "During ramp study, optimal speed = midline septum + intermittent AV opening + no suction events.",
  "PFO/ASD must be excluded pre-implant — LVAD reduces LV pressure, enabling right-to-left shunting.",
  "Outflow graft assessment requires two windows: PLAX (cross-section, Doppler velocity) and High Parasternal Long-Axis (anastomosis, longitudinal graft course).",
  "Outflow graft obstruction (velocity >2.5 m/s) is a surgical emergency — kinking is the most common cause.",
];

// ─── ECMO DATA ────────────────────────────────────────────────────────────────

const ecmoSections: ProtocolSection[] = [
  {
    id: "ecmo_va_assessment",
    title: "VA-ECMO Echo Assessment",
    icon: Heart,
    color: "#189aa1",
    items: [
      { id: "ecmo_va_lv_distension", label: "LV distension monitoring", detail: "VA-ECMO increases LV afterload by retrograde aortic flow. LV distension (LVEDD >70 mm, LVESD >60 mm) indicates LV cannot eject against ECMO flow. Requires venting (Impella, IABP, or surgical vent).", critical: true, reference: "LV distension = venting required; LVEDD >70 mm" },
      { id: "ecmo_va_av_opening", label: "Aortic valve opening", detail: "AV must open to prevent stasis and thrombus. If AV does not open with any beat, LV is severely distended. Continuous AV closure on VA-ECMO = high thrombus risk.", critical: true, reference: "AV must open — continuous closure = thrombus risk" },
      { id: "ecmo_va_ef", label: "LV systolic function (EF)", detail: "Serial EF assessment to monitor myocardial recovery. Improving EF suggests native cardiac recovery. EF <10% with no AV opening = severe LV distension.", critical: true, reference: "Improving EF = recovery; EF <10% = distension risk" },
      { id: "ecmo_va_rv", label: "RV function", detail: "VA-ECMO does not directly support RV. RV failure may persist or worsen. Assess TAPSE, RV S', FAC. Severe RV failure may require biventricular ECMO or RVAD.", critical: true, reference: "TAPSE <10 mm, FAC <25% = severe RV dysfunction" },
      { id: "ecmo_va_cannula", label: "Cannula position (TEE preferred)", detail: "Venous cannula tip should be in RA/IVC junction. Arterial cannula in femoral artery — not directly visualized by TTE. TEE preferred for cannula position assessment.", reference: "Venous cannula: RA/IVC junction" },
      { id: "ecmo_va_thrombus", label: "Intracardiac thrombus", detail: "LV stasis with poor AV opening → LV thrombus risk. RA thrombus may form at venous cannula tip. Contrast echo if apical views suboptimal.", critical: true, reference: "LV thrombus risk high with AV non-opening" },
      { id: "ecmo_va_effusion", label: "Pericardial effusion", detail: "New effusion post-ECMO cannulation may indicate cardiac perforation or bleeding. Assess for tamponade physiology.", critical: true, reference: "New effusion = urgent assessment" },
      { id: "ecmo_va_weaning", label: "Weaning assessment", detail: "Before ECMO weaning: EF >20–25%, AV opening with each beat, no LV distension, adequate hemodynamics at reduced flow. Formal weaning trial at 1.0–1.5 L/min.", critical: true, reference: "Weaning: EF >20–25%, AV opening, stable hemodynamics" },
    ],
  },
  {
    id: "ecmo_vv_assessment",
    title: "VV-ECMO Echo Assessment",
    icon: Activity,
    color: "#0e7490",
    items: [
      { id: "ecmo_vv_rv", label: "RV function (primary assessment)", detail: "VV-ECMO supports oxygenation but not cardiac output. RV failure is a common complication of severe ARDS. TAPSE, RV S', FAC, RVSP. Cor pulmonale pattern.", critical: true, reference: "RV failure common in severe ARDS on VV-ECMO" },
      { id: "ecmo_vv_recirculation", label: "Recirculation assessment", detail: "Recirculation occurs when oxygenated blood returns to venous cannula without passing through pulmonary circulation. Echo: assess cannula positions. Bicaval dual-lumen cannula (Avalon): tip in IVC, side holes in RA.", reference: "Recirculation reduces ECMO efficacy" },
      { id: "ecmo_vv_cannula_position", label: "Cannula position (bicaval)", detail: "Avalon dual-lumen cannula: drainage holes in SVC and IVC, return jet directed toward tricuspid valve. TEE preferred for position confirmation. Misdirected return jet = recirculation.", critical: true, reference: "Return jet should point toward tricuspid valve" },
      { id: "ecmo_vv_cardiac_function", label: "Cardiac function monitoring", detail: "VV-ECMO does not provide hemodynamic support. Monitor LV and RV function. Deteriorating cardiac function on VV-ECMO may require conversion to VA-ECMO.", reference: "Cardiac deterioration = consider VA-ECMO conversion" },
      { id: "ecmo_vv_pfo", label: "PFO / ASD assessment", detail: "Hypoxemia despite adequate ECMO flow may indicate right-to-left shunting through PFO/ASD. Bubble study to assess. PFO closure may be required.", critical: true, reference: "Bubble study if unexplained hypoxemia on VV-ECMO" },
    ],
  },
];

const ecmoNormalValues = [
  { label: "LV Distension Threshold", value: "LVEDD <70 mm", note: ">70 mm = venting required on VA-ECMO" },
  { label: "AV Opening (VA-ECMO)", value: "Every beat", note: "Continuous closure = thrombus risk; vent required" },
  { label: "Weaning EF Threshold", value: ">20–25%", note: "With AV opening and stable hemodynamics" },
  { label: "Venous Cannula Position", value: "RA/IVC junction", note: "TEE preferred for confirmation" },
  { label: "RVSP (VV-ECMO)", value: "Monitor trend", note: "Elevated RVSP = RV pressure overload" },
];

const ecmoPearls = [
  "LV distension on VA-ECMO is a medical emergency — requires urgent venting (Impella, IABP, or surgical vent).",
  "AV must open on VA-ECMO — continuous closure causes LV thrombus and commissural fusion.",
  "VV-ECMO does not support cardiac output — deteriorating hemodynamics require conversion to VA-ECMO.",
  "Recirculation on bicaval VV-ECMO: return jet must point toward tricuspid valve — confirm with TEE.",
  "PFO/ASD causes right-to-left shunting on VV-ECMO — bubble study if unexplained hypoxemia.",
  "ECMO weaning: EF >20–25%, AV opening with each beat, and stable hemodynamics at 1.0–1.5 L/min flow.",
];

// ─── IMPELLA DATA (per-device sub-tabs) ──────────────────────────────────────

// Shared positioning checklist items (common to all LV Impella devices)
const impellaSharedPositioningItems: ChecklistItem[] = [
  { id: "imp_pos_inlet", label: "Inlet area position (PLAX / A5C)", detail: "Inlet area (pigtail) must be in LV, 3.5–4.5 cm below aortic valve. Too shallow (<3.5 cm) = inlet in LVOT → suction alarms. Too deep (>5 cm) = mitral valve entrapment.", critical: true, reference: "Inlet: 3.5–4.5 cm below AV in PLAX or A5C" },
  { id: "imp_pos_outlet", label: "Outlet area position (ascending aorta)", detail: "Outlet area must be in ascending aorta, above aortic valve. Outlet in LVOT = recirculation — blood is pumped back into LV rather than to systemic circulation.", critical: true, reference: "Outlet: ascending aorta, above AV" },
  { id: "imp_pos_av", label: "AV leaflets not impinged by device shaft", detail: "Confirm AV leaflets open and close freely around device shaft. New AR after insertion = leaflet impingement. Assess by color Doppler in PLAX.", critical: true, reference: "Confirm AV leaflets not impinged" },
  { id: "imp_pos_mv", label: "MV / subvalvular apparatus (pigtail entanglement)", detail: "Device too deep → pigtail entangles in chordae or impinges on MV leaflets. New MR or suction alarms after insertion = MV entrapment. Reposition urgently.", critical: true, reference: "New MR + suction alarms = pigtail entanglement" },
];

const impellaSharedMonitoringItems: ChecklistItem[] = [
  { id: "imp_mon_lv_unload", label: "LV unloading (LVEDD, LVESD)", detail: "LV should decompress with Impella support. LVEDD and LVESD should decrease from baseline. Persistent LV dilation at high P-level = inadequate unloading or device malposition.", critical: true, reference: "LV should decompress with increasing P-level" },
  { id: "imp_mon_ar", label: "Aortic regurgitation (color Doppler PLAX)", detail: "Impella crosses AV → new or worsened AR is common. Significant AR causes recirculation — blood pumped to aorta returns to LV via AR jet. Serial monitoring at each P-level.", critical: true, reference: "AR assessment at each echo — recirculation risk" },
  { id: "imp_mon_suction", label: "Suction alarm assessment", detail: "Suction alarms = LV under-filling or device malposition. Echo: assess LV size, device position, inlet velocity. Causes: hypovolemia, RV failure, device too deep (MV entrapment).", critical: true, reference: "Suction = LV under-filling or malposition" },
  { id: "imp_mon_weaning", label: "Weaning protocol (P-level reduction)", detail: "Stepwise P-level reduction. At each step: assess LV size, EF, hemodynamics. Wean when EF >25–30%, adequate hemodynamics at P2. Remove when stable at P2 for 4–6 hours.", reference: "Wean: EF >25–30%, stable at P2 for 4–6 hrs" },
];

// ─── Impella 2.5 ──────────────────────────────────────────────────────────────
const impella25Sections: ProtocolSection[] = [
  {
    id: "imp25_overview",
    title: "Impella 2.5 — Device Overview",
    icon: Info,
    color: "#0e7490",
    items: [
      { id: "imp25_specs", label: "Device specifications", detail: "Maximum flow: 2.5 L/min. Catheter profile: 12Fr. Access: percutaneous femoral artery (standard). Sheath: 13Fr. P-levels: P1–P8. Smallest Impella LV device.", reference: "Flow: 2.5 L/min | 12Fr | Femoral | P1–P8" },
      { id: "imp25_indication", label: "Clinical indications", detail: "Elective high-risk PCI (prophylactic support), mild-to-moderate cardiogenic shock, haemodynamic support during ablation procedures. Not adequate for severe cardiogenic shock (SCAI Stage C–D).", reference: "High-risk PCI, mild cardiogenic shock" },
      { id: "imp25_access", label: "Vascular access consideration", detail: "12Fr device via femoral artery. Assess femoral artery diameter and iliofemoral disease before insertion. Peripheral vascular disease may preclude femoral access.", reference: "Femoral artery ≥5 mm recommended" },
    ],
  },
  {
    id: "imp25_positioning",
    title: "Impella 2.5 — Positioning Protocol",
    icon: Target,
    color: "#189aa1",
    items: [
      ...impellaSharedPositioningItems,
      { id: "imp25_views", label: "Preferred echo views (2.5)", detail: "PLAX: measure inlet-to-AV distance. A5C: confirm inlet in LV, outlet in aorta. TEE ME LAX: gold standard in cath lab. Smaller 12Fr profile — AR less common than CP/5.5.", reference: "PLAX + A5C (TTE); ME LAX (TEE)" },
    ],
  },
  {
    id: "imp25_monitoring",
    title: "Impella 2.5 — Hemodynamic Monitoring",
    icon: Activity,
    color: "#0f766e",
    items: [
      ...impellaSharedMonitoringItems,
      { id: "imp25_plevel", label: "P-level reference (2.5)", detail: "P2: ~1.0 L/min | P4: ~1.5 L/min | P6: ~2.0 L/min | P8: ~2.5 L/min. Titrate to hemodynamic targets. Reduce P-level if suction alarms or LV over-decompression.", reference: "P8 = max 2.5 L/min" },
    ],
  },
];

const impella25NormalValues = [
  { label: "Maximum Flow", value: "2.5 L/min", note: "At P8" },
  { label: "Catheter Profile", value: "12Fr", note: "Percutaneous femoral artery" },
  { label: "Inlet-to-AV Distance", value: "3.5–4.5 cm", note: "PLAX or A5C — critical measurement" },
  { label: "Weaning Threshold", value: "EF >25–30%", note: "Stable at P2 for 4–6 hours before removal" },
  { label: "P-Level Range", value: "P1–P8", note: "P8 = maximum support" },
];

const impella25Pearls = [
  "Impella 2.5 provides modest support (2.5 L/min) — adequate for high-risk PCI but insufficient for severe cardiogenic shock.",
  "12Fr profile is the smallest LV Impella — lower AR risk than CP or 5.5, but still monitor with serial color Doppler.",
  "Inlet-to-AV distance: 3.5–4.5 cm in PLAX — the single most important measurement at every echo assessment.",
  "Suction alarms at P2 or P4 suggest hypovolemia, RV failure, or pigtail entanglement — do not simply reduce P-level without echo assessment.",
];

// ─── Impella CP ───────────────────────────────────────────────────────────────
const impellaCPSections: ProtocolSection[] = [
  {
    id: "impcp_overview",
    title: "Impella CP — Device Overview",
    icon: Info,
    color: "#0e7490",
    items: [
      { id: "impcp_specs", label: "Device specifications", detail: "Maximum flow: 3.7–4.3 L/min (CP) / 4.0 L/min (CP Smart). Catheter profile: 14Fr. Access: percutaneous femoral artery. Sheath: 14Fr. P-levels: P1–P8.", reference: "Flow: 3.7–4.3 L/min | 14Fr | Femoral | P1–P8" },
      { id: "impcp_indication", label: "Clinical indications", detail: "Most commonly used Impella for cardiogenic shock (SCAI Stage B–C). AMI cardiogenic shock (IABP-SHOCK II era), high-risk PCI, bridge to decision. Most widely studied Impella device.", reference: "AMI cardiogenic shock, high-risk PCI — most common" },
      { id: "impcp_ar_risk", label: "AR risk (14Fr profile)", detail: "14Fr profile is larger than 2.5 — higher risk of significant AR. AR causes recirculation: blood pumped to aorta returns to LV via AR jet, reducing net forward flow. Assess at every echo.", critical: true, reference: "14Fr profile — higher AR risk than 2.5" },
    ],
  },
  {
    id: "impcp_positioning",
    title: "Impella CP — Positioning Protocol",
    icon: Target,
    color: "#189aa1",
    items: [
      ...impellaSharedPositioningItems,
      { id: "impcp_views", label: "Preferred echo views (CP)", detail: "PLAX: inlet-to-AV distance (3.5–4.5 cm). A5C: outlet confirmation in aorta. TEE ME LAX: gold standard in cath lab or ICU. Color Doppler PLAX: AR assessment at each echo.", reference: "PLAX + A5C (TTE); ME LAX (TEE)" },
    ],
  },
  {
    id: "impcp_monitoring",
    title: "Impella CP — Hemodynamic Monitoring",
    icon: Activity,
    color: "#0f766e",
    items: [
      ...impellaSharedMonitoringItems,
      { id: "impcp_plevel", label: "P-level reference (CP)", detail: "P2: ~1.5 L/min | P4: ~2.5 L/min | P6: ~3.0 L/min | P8: ~3.7 L/min (CP) or 4.3 L/min (CP Smart). Titrate to MAP >65 mmHg and cardiac power output targets.", reference: "P8 = max 3.7–4.3 L/min" },
      { id: "impcp_ecmo_combo", label: "ECMO + Impella CP (ECPELLA) configuration", detail: "Impella CP is frequently combined with VA-ECMO (ECPELLA) to vent the LV. In this configuration: Impella provides LV unloading, ECMO provides oxygenation and systemic support. Monitor LV size and AV opening closely.", critical: true, reference: "ECPELLA: Impella CP + VA-ECMO for LV venting" },
    ],
  },
];

const impellaCPNormalValues = [
  { label: "Maximum Flow", value: "3.7–4.3 L/min", note: "At P8 (CP / CP Smart)" },
  { label: "Catheter Profile", value: "14Fr", note: "Percutaneous femoral artery" },
  { label: "Inlet-to-AV Distance", value: "3.5–4.5 cm", note: "PLAX or A5C — critical measurement" },
  { label: "AR Risk", value: "Moderate", note: "14Fr profile — serial color Doppler required" },
  { label: "Weaning Threshold", value: "EF >25–30%", note: "Stable at P2 for 4–6 hours before removal" },
];

const impellaCPPearls = [
  "Impella CP is the most commonly used Impella for cardiogenic shock — 14Fr profile provides meaningful support (3.7–4.3 L/min).",
  "AR is a significant concern with CP — even moderate AR causes substantial recirculation. Assess with color Doppler at every echo.",
  "ECPELLA (ECMO + Impella CP): the Impella vents the LV while ECMO provides oxygenation and systemic support — monitor AV opening and LV size closely.",
  "Inlet-to-AV distance: 3.5–4.5 cm — if suction alarms occur, check position before reducing P-level.",
];

// ─── Impella 5.5 ──────────────────────────────────────────────────────────────
const impella55Sections: ProtocolSection[] = [
  {
    id: "imp55_overview",
    title: "Impella 5.5 — Device Overview",
    icon: Info,
    color: "#0e7490",
    items: [
      { id: "imp55_specs", label: "Device specifications", detail: "Maximum flow: 5.5 L/min. Catheter profile: 21Fr. Access: surgical cutdown (axillary artery preferred; femoral artery alternative). P-levels: P1–P8. Highest flow LV Impella.", reference: "Flow: 5.5 L/min | 21Fr | Surgical cutdown | P1–P8" },
      { id: "imp55_indication", label: "Clinical indications", detail: "Severe cardiogenic shock (SCAI Stage C–D), bridge to LVAD or heart transplant, post-cardiotomy shock, high-risk complex PCI requiring maximum support. Requires surgical access.", reference: "Severe cardiogenic shock, bridge to LVAD/transplant" },
      { id: "imp55_axillary", label: "Axillary artery access — echo implications", detail: "Axillary access allows patient ambulation. Device enters via subclavian/axillary artery — course is different from femoral. Echo positioning unchanged: PLAX inlet-to-AV distance still the key measurement.", reference: "Axillary access: patient can ambulate; echo unchanged" },
      { id: "imp55_ar_risk", label: "AR risk (21Fr profile — highest)", detail: "21Fr is the largest Impella profile — highest AR risk. Significant AR is common and causes substantial recirculation. Serial color Doppler assessment at every echo is mandatory.", critical: true, reference: "21Fr — highest AR risk of all Impella devices" },
    ],
  },
  {
    id: "imp55_positioning",
    title: "Impella 5.5 — Positioning Protocol",
    icon: Target,
    color: "#189aa1",
    items: [
      ...impellaSharedPositioningItems,
      { id: "imp55_views", label: "Preferred echo views (5.5)", detail: "PLAX: inlet-to-AV distance (3.5–4.5 cm). A5C: outlet in ascending aorta. TEE ME LAX: preferred for initial positioning and repositioning. Larger device is more echogenic — easier to visualize.", reference: "PLAX + A5C (TTE); ME LAX (TEE) — device more visible" },
      { id: "imp55_depth", label: "Depth and gain optimization", detail: "21Fr device is highly echogenic. Reduce gain to avoid blooming artifact obscuring AV leaflets. Use harmonic imaging. TEE provides superior resolution for precise positioning.", reference: "Reduce gain to avoid blooming artifact" },
    ],
  },
  {
    id: "imp55_monitoring",
    title: "Impella 5.5 — Hemodynamic Monitoring",
    icon: Activity,
    color: "#0f766e",
    items: [
      ...impellaSharedMonitoringItems,
      { id: "imp55_plevel", label: "P-level reference (5.5)", detail: "P2: ~2.0 L/min | P4: ~3.5 L/min | P6: ~4.5 L/min | P8: ~5.5 L/min. Higher flows provide near-complete LV unloading. Monitor for over-decompression (rightward septal shift).", reference: "P8 = max 5.5 L/min — near-complete LV unloading" },
      { id: "imp55_bridge", label: "Bridge-to-LVAD / transplant assessment", detail: "Serial echo to assess end-organ recovery, RV function, and LVAD candidacy. Key parameters: LVEDD, EF, TAPSE, RV FAC, TR severity, AR severity. Document trajectory for LVAD team.", critical: true, reference: "Serial echo for LVAD/transplant candidacy assessment" },
    ],
  },
];

const impella55NormalValues = [
  { label: "Maximum Flow", value: "5.5 L/min", note: "At P8 — near-complete LV unloading" },
  { label: "Catheter Profile", value: "21Fr", note: "Surgical cutdown (axillary or femoral)" },
  { label: "Inlet-to-AV Distance", value: "3.5–4.5 cm", note: "PLAX or A5C — critical measurement" },
  { label: "AR Risk", value: "High", note: "21Fr profile — mandatory serial color Doppler" },
  { label: "Weaning Threshold", value: "EF >25–30%", note: "Stable at P2 for 4–6 hours before removal" },
];

const impella55Pearls = [
  "Impella 5.5 provides near-complete LV unloading (5.5 L/min) — used for severe cardiogenic shock and bridge to LVAD/transplant.",
  "21Fr profile carries the highest AR risk of all Impella devices — AR assessment is mandatory at every echo.",
  "Axillary access allows patient ambulation — echo positioning and measurements are unchanged from femoral access.",
  "Larger device is more echogenic — reduce gain to avoid blooming artifact that may obscure AV leaflets.",
  "Serial echo is essential for LVAD/transplant candidacy assessment — document LVEDD, EF, TAPSE, RV FAC, AR, and TR trajectory.",
];

// ─── Impella ECP ──────────────────────────────────────────────────────────────
const impellaECPSections: ProtocolSection[] = [
  {
    id: "impecp_overview",
    title: "Impella ECP — Device Overview",
    icon: Info,
    color: "#0e7490",
    items: [
      { id: "impecp_specs", label: "Device specifications", detail: "Maximum flow: 5.0 L/min (expandable). Delivery profile: 9Fr (smallest of all high-flow Impellas). Expands to 21Fr equivalent inside the LV. Access: percutaneous femoral artery. P-levels: P1–P8.", reference: "Flow: 5.0 L/min | 9Fr delivery | Expands in LV | P1–P8" },
      { id: "impecp_indication", label: "Clinical indications", detail: "High-risk PCI requiring high-flow support without surgical cutdown. Cardiogenic shock where femoral artery access is preferred but high flow is needed. Combines high flow with percutaneous access.", reference: "High-risk PCI + cardiogenic shock — percutaneous high-flow" },
      { id: "impecp_expandable", label: "Expandable catheter — echo appearance", detail: "ECP expands from 9Fr to a larger profile within the LV. Echo appearance: the expanded pump is more echogenic than the 2.5 but less than the 5.5. Confirm full expansion in LV by echo.", critical: true, reference: "Confirm full expansion in LV cavity by echo" },
    ],
  },
  {
    id: "impecp_positioning",
    title: "Impella ECP — Positioning Protocol",
    icon: Target,
    color: "#189aa1",
    items: [
      ...impellaSharedPositioningItems,
      { id: "impecp_expansion", label: "Confirm full pump expansion (ECP-specific)", detail: "ECP must be fully expanded in the LV before activating at high P-levels. Echo: confirm expanded pump body is in LV cavity, not LVOT. Partial expansion = reduced flow and suction risk.", critical: true, reference: "Full expansion in LV required before high P-level" },
      { id: "impecp_views", label: "Preferred echo views (ECP)", detail: "PLAX: inlet-to-AV distance (3.5–4.5 cm) and expansion confirmation. A5C: outlet in aorta. TEE ME LAX: preferred in cath lab for expansion and position confirmation.", reference: "PLAX + A5C (TTE); ME LAX (TEE)" },
    ],
  },
  {
    id: "impecp_monitoring",
    title: "Impella ECP — Hemodynamic Monitoring",
    icon: Activity,
    color: "#0f766e",
    items: [
      ...impellaSharedMonitoringItems,
      { id: "impecp_plevel", label: "P-level reference (ECP)", detail: "P2: ~1.5 L/min | P4: ~3.0 L/min | P6: ~4.0 L/min | P8: ~5.0 L/min. Titrate to hemodynamic targets. Confirm full expansion before increasing above P4.", reference: "P8 = max 5.0 L/min — confirm expansion first" },
      { id: "impecp_ar", label: "AR assessment (ECP)", detail: "ECP expands to a large profile in the LV — AR risk is significant (similar to 5.5 when fully expanded). Serial color Doppler in PLAX at each echo. AR causes recirculation and reduces net forward flow.", critical: true, reference: "Expanded profile = significant AR risk — monitor closely" },
    ],
  },
];

const impellaECPNormalValues = [
  { label: "Maximum Flow", value: "5.0 L/min", note: "At P8 (expandable catheter)" },
  { label: "Delivery Profile", value: "9Fr", note: "Smallest percutaneous delivery for high-flow Impella" },
  { label: "Inlet-to-AV Distance", value: "3.5–4.5 cm", note: "PLAX or A5C — critical measurement" },
  { label: "Expansion Confirmation", value: "Full expansion in LV", note: "Confirm by echo before high P-level" },
  { label: "AR Risk", value: "High (when expanded)", note: "Serial color Doppler mandatory" },
];

const impellaECPPearls = [
  "Impella ECP delivers 5.0 L/min via a 9Fr delivery catheter — the smallest percutaneous access for high-flow LV support.",
  "Full expansion in the LV must be confirmed by echo before activating at high P-levels — partial expansion = reduced flow.",
  "When fully expanded, AR risk is similar to the 5.5 — mandatory serial color Doppler at every echo.",
  "Inlet-to-AV distance: 3.5–4.5 cm — same critical measurement as all other LV Impella devices.",
];

// ─── Impella RP ───────────────────────────────────────────────────────────────
const impellaRPSections: ProtocolSection[] = [
  {
    id: "imprp_overview",
    title: "Impella RP — Device Overview",
    icon: Info,
    color: "#0e7490",
    items: [
      { id: "imprp_specs", label: "Device specifications", detail: "Maximum flow: 4.3 L/min. Catheter profile: 11Fr. Access: femoral vein. Inlet: IVC/RA junction. Outlet: main pulmonary artery. P-levels: P1–P8. Right ventricular support device.", reference: "Flow: 4.3 L/min | 11Fr | Femoral vein | IVC → PA" },
      { id: "imprp_indication", label: "Clinical indications", detail: "Acute RV failure post-LVAD implant, post-MI RV failure, post-cardiac surgery RV failure, RV failure during VA-ECMO weaning. Not for LV support.", reference: "Acute RV failure: post-LVAD, post-MI, post-surgery" },
      { id: "imprp_mechanism", label: "Mechanism of action", detail: "Impella RP draws blood from IVC/RA and pumps it into the main pulmonary artery, bypassing the failing RV. Reduces RV preload and provides direct RV output support.", reference: "IVC/RA → main PA: bypasses failing RV" },
    ],
  },
  {
    id: "imprp_positioning",
    title: "Impella RP — Positioning Protocol",
    icon: Target,
    color: "#7c3aed",
    items: [
      { id: "imprp_inlet", label: "Inlet area position (IVC/RA junction)", detail: "Inlet area must be at IVC/RA junction. Confirm with subcostal IVC view (TTE) or TEE bicaval view (90–100°). Inlet too high in RA = reduced drainage. Inlet too deep in IVC = hepatic vein obstruction.", critical: true, reference: "Inlet: IVC/RA junction — subcostal or TEE bicaval" },
      { id: "imprp_outlet", label: "Outlet area position (main pulmonary artery)", detail: "Outlet area must be in main pulmonary artery, above pulmonic valve. Confirm with parasternal short axis (RVOT/PA view) or TEE. Outlet in RVOT = recirculation.", critical: true, reference: "Outlet: main PA, above pulmonic valve" },
      { id: "imprp_pv", label: "Pulmonic valve — device crossing", detail: "Device shaft crosses pulmonic valve. Assess for new PR caused by device. PR causes recirculation in Impella RP (blood pumped to PA returns to RV via PR). Monitor with color Doppler.", critical: true, reference: "New PR = device-related recirculation" },
      { id: "imprp_tee", label: "TEE preferred for positioning", detail: "TEE bicaval view (90–100°): inlet at IVC/RA junction. TEE RV inflow-outflow view: outlet in main PA. TTE subcostal + PSAX as alternatives. TEE provides superior resolution.", reference: "TEE preferred: bicaval + RV inflow-outflow views" },
    ],
  },
  {
    id: "imprp_monitoring",
    title: "Impella RP — Hemodynamic Monitoring",
    icon: Activity,
    color: "#0f766e",
    items: [
      { id: "imprp_rv_unload", label: "RV unloading assessment (TAPSE, RV S', FAC)", detail: "RV should decompress with Impella RP support. TAPSE and RV S' may improve. Persistent severe RV dysfunction despite adequate P-level = irreversible RV failure.", critical: true, reference: "RV should decompress with increasing P-level" },
      { id: "imprp_rvsp", label: "RVSP trend (TR CW Doppler)", detail: "RVSP should decrease with Impella RP support as RV is unloaded. Rising RVSP despite Impella RP = inadequate support or irreversible RV failure.", critical: true, reference: "RVSP should decrease with RP support" },
      { id: "imprp_lv", label: "LV function monitoring", detail: "Impella RP increases LV preload (more blood delivered to PA → lungs → LA → LV). Monitor for LV volume overload if LV function is severely impaired. May require combined LV support.", critical: true, reference: "RP increases LV preload — monitor LV function" },
      { id: "imprp_pr", label: "Pulmonary regurgitation (color Doppler)", detail: "New PR after Impella RP insertion = device crossing pulmonic valve. Significant PR causes recirculation. Assess severity with color Doppler in PSAX or TEE.", reference: "New PR = device-related; assess severity" },
      { id: "imprp_weaning", label: "Weaning assessment", detail: "Stepwise P-level reduction. Wean when TAPSE >10 mm, RV S' >6 cm/s, FAC >25%, and stable hemodynamics at P2. Remove when stable at P2 for 4–6 hours.", reference: "Wean: TAPSE >10 mm, FAC >25%, stable at P2" },
    ],
  },
];

const impellaRPNormalValues = [
  { label: "Maximum Flow", value: "4.3 L/min", note: "At P8" },
  { label: "Catheter Profile", value: "11Fr", note: "Femoral vein access" },
  { label: "Inlet Position", value: "IVC/RA junction", note: "Subcostal TTE or TEE bicaval view" },
  { label: "Outlet Position", value: "Main pulmonary artery", note: "Above pulmonic valve — PSAX or TEE" },
  { label: "Weaning Threshold", value: "TAPSE >10 mm, FAC >25%", note: "Stable at P2 for 4–6 hours" },
];

const impellaRPPearls = [
  "Impella RP is the only Impella device for RV support — inlet at IVC/RA junction, outlet in main PA.",
  "TEE is preferred for positioning — bicaval view for inlet, RV inflow-outflow view for outlet.",
  "New PR after insertion = device crossing pulmonic valve — significant PR causes recirculation, reducing net RV output.",
  "Impella RP increases LV preload — if LV function is severely impaired, combined LV support (Impella CP or LVAD) may be required.",
  "Wean when TAPSE >10 mm, FAC >25%, and stable hemodynamics at P2 for 4–6 hours.",
];

// ─── Impella sub-tab type ─────────────────────────────────────────────────────
type ImpellaSubTab = {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  sections: ProtocolSection[];
  normalValues: { label: string; value: string; note: string }[];
  clinicalPearls: string[];
};

const IMPELLA_SUBTABS: ImpellaSubTab[] = [
  { id: "imp_25",  label: "Impella 2.5", subtitle: "2.5 L/min | 12Fr | Percutaneous Femoral",  color: "#0e7490", sections: impella25Sections,  normalValues: impella25NormalValues,  clinicalPearls: impella25Pearls  },
  { id: "imp_cp",  label: "Impella CP",  subtitle: "3.7–4.3 L/min | 14Fr | Percutaneous Femoral", color: "#0f766e", sections: impellaCPSections,  normalValues: impellaCPNormalValues,  clinicalPearls: impellaCPPearls  },
  { id: "imp_55",  label: "Impella 5.5", subtitle: "5.5 L/min | 21Fr | Surgical Cutdown",     color: "#065f46", sections: impella55Sections,  normalValues: impella55NormalValues,  clinicalPearls: impella55Pearls  },
  { id: "imp_ecp", label: "Impella ECP", subtitle: "5.0 L/min | 9Fr Delivery | Expandable",   color: "#1d4ed8", sections: impellaECPSections, normalValues: impellaECPNormalValues, clinicalPearls: impellaECPPearls },
  { id: "imp_rp",  label: "Impella RP",  subtitle: "4.3 L/min | 11Fr | RV Support (IVC→PA)",  color: "#7c3aed", sections: impellaRPSections,  normalValues: impellaRPNormalValues,  clinicalPearls: impellaRPPearls  },
];

// ─── LIFEVEST DATA ────────────────────────────────────────────────────────────

const lifevestSections: ProtocolSection[] = [
  {
    id: "lifevest_indication",
    title: "LifeVest Indications & Echo Assessment",
    icon: Shield,
    color: "#189aa1",
    items: [
      { id: "lv_ind_ef", label: "EF assessment for LifeVest indication", detail: "LifeVest indicated when EF ≤35% and risk of sudden cardiac death during a period of uncertainty (e.g., newly diagnosed cardiomyopathy, post-MI, post-revascularization). Biplane Simpson's EF is the standard measurement.", critical: true, reference: "LifeVest: EF ≤35% with SCD risk during recovery period" },
      { id: "lv_ind_new_cm", label: "Newly diagnosed cardiomyopathy", detail: "New non-ischemic cardiomyopathy: EF may improve with GDMT. LifeVest bridges the gap during the 3–6 month optimization period before ICD implantation decision.", reference: "Bridge during GDMT optimization (3–6 months)" },
      { id: "lv_ind_post_mi", label: "Post-MI assessment", detail: "Post-MI EF ≤35% at 40 days: LifeVest recommended until repeat EF assessment at 3 months. EF may improve with revascularization and GDMT.", critical: true, reference: "Post-MI: reassess EF at 40 days and 3 months" },
      { id: "lv_ind_post_revasc", label: "Post-revascularization", detail: "After CABG or PCI: EF may improve. LifeVest protects during the recovery period (typically 3 months). Repeat echo at 3 months to reassess ICD need.", reference: "Post-revascularization: reassess EF at 3 months" },
      { id: "lv_ind_transplant", label: "Bridge to transplant listing", detail: "Patients awaiting heart transplant listing with EF ≤35%. LifeVest provides SCD protection during evaluation period.", reference: "Bridge during transplant evaluation" },
    ],
  },
  {
    id: "lifevest_followup",
    title: "Serial Echo Follow-Up Protocol",
    icon: Activity,
    color: "#0e7490",
    items: [
      { id: "lv_fu_baseline", label: "Baseline echo documentation", detail: "Complete echo at LifeVest initiation: EF (biplane Simpson's), LV volumes, LV dimensions, diastolic function, valvular disease, RV function. This is the reference for serial comparison.", critical: true, reference: "Baseline: complete echo with all parameters" },
      { id: "lv_fu_3month", label: "3-month reassessment", detail: "Repeat complete echo at 3 months on GDMT. If EF improves to >35%: LifeVest may be discontinued and ICD implantation deferred. If EF remains ≤35%: proceed to ICD implantation.", critical: true, reference: "3-month echo: ICD decision point if EF ≤35% persists" },
      { id: "lv_fu_ef_improvement", label: "EF improvement criteria", detail: "EF improvement >35% on optimized GDMT (beta-blocker, ACEi/ARB/ARNI, MRA, SGLT2i) for ≥3 months: ICD may not be required. Document GDMT compliance.", reference: "EF >35% on GDMT ≥3 months = ICD may be deferred" },
      { id: "lv_fu_lv_remodeling", label: "LV remodeling assessment", detail: "Positive remodeling: ↓ LVEDD, ↓ LVESD, ↑ EF. Negative remodeling: ↑ LVEDD, ↑ LVESD, ↓ EF. Document LV volumes and dimensions at each follow-up.", reference: "Positive remodeling: ↓ LV volumes, ↑ EF" },
    ],
  },
];

const lifevestNormalValues = [
  { label: "LifeVest Indication Threshold", value: "EF ≤35%", note: "With SCD risk during recovery period" },
  { label: "Reassessment Timing", value: "3 months", note: "After GDMT optimization" },
  { label: "ICD Deferral Threshold", value: "EF >35%", note: "On optimized GDMT for ≥3 months" },
  { label: "Post-MI Reassessment", value: "40 days + 3 months", note: "Two serial assessments post-MI" },
];

const lifevestPearls = [
  "LifeVest is a bridge device — the goal is to determine whether ICD implantation is needed after GDMT optimization.",
  "Post-MI: EF often improves significantly within 3 months of revascularization and GDMT — do not implant ICD prematurely.",
  "New non-ischemic cardiomyopathy: up to 40% of patients recover EF >35% with GDMT — LifeVest prevents premature ICD implantation.",
  "Document GDMT compliance at each follow-up — EF improvement requires adequate doses of all four pillars.",
  "EF measurement must use biplane Simpson's method for consistency across serial assessments.",
];

// ─── ICD DATA ─────────────────────────────────────────────────────────────────

const icdSections: ProtocolSection[] = [
  {
    id: "icd_preimplant",
    title: "Pre-ICD Implant Echo Assessment",
    icon: Target,
    color: "#189aa1",
    items: [
      { id: "icd_pre_ef", label: "EF confirmation (biplane Simpson's)", detail: "ICD primary prevention: EF ≤35% on GDMT for ≥3 months. Biplane Simpson's is the standard. Single-plane or visual estimation not acceptable for ICD decision.", critical: true, reference: "ICD: EF ≤35% on GDMT ≥3 months (ACC/AHA Class I)" },
      { id: "icd_pre_etiology", label: "Cardiomyopathy etiology", detail: "Ischemic vs non-ischemic cardiomyopathy. Ischemic: ICD benefit well-established (MADIT-II). Non-ischemic: ICD benefit confirmed (SCD-HeFT, DANISH trial nuances). Document etiology.", reference: "Ischemic vs non-ischemic affects risk stratification" },
      { id: "icd_pre_lv_size", label: "LV dimensions and volumes", detail: "LVEDD, LVESD, EDV, ESV. Severely dilated LV (LVEDD >70 mm) with low EF: high SCD risk. Document for serial comparison post-implant.", reference: "Baseline LV dimensions for serial comparison" },
      { id: "icd_pre_diastolic", label: "Diastolic function assessment", detail: "Grade diastolic dysfunction (I–III). Grade III (restrictive pattern) associated with worse prognosis. E/A, DT, e', E/e'. Elevated filling pressures affect CRT response.", reference: "Grade III diastolic dysfunction = poor prognosis" },
      { id: "icd_pre_rv", label: "RV function", detail: "TAPSE, RV S', FAC. RV dysfunction is an independent predictor of mortality in HF. TAPSE <17 mm, S' <9.5 cm/s = significant RV dysfunction.", reference: "TAPSE <17 mm = significant RV dysfunction" },
      { id: "icd_pre_mr", label: "Mitral regurgitation", detail: "Functional MR is common in dilated cardiomyopathy. Severe functional MR may improve with CRT. Document EROA, RVol, VC for serial comparison.", reference: "Functional MR: may improve with CRT" },
      { id: "icd_pre_crt_criteria", label: "CRT eligibility assessment (if applicable)", detail: "CRT-D criteria: EF ≤35%, LBBB with QRS ≥150 ms (Class I), or non-LBBB QRS ≥150 ms (Class IIa). Echo: assess dyssynchrony (IVMD, SPWMD), MR severity, and LV dimensions.", critical: true, reference: "CRT-D: EF ≤35%, LBBB QRS ≥150 ms (Class I)" },
    ],
  },
  {
    id: "icd_postimplant",
    title: "Post-ICD / CRT-D Assessment",
    icon: Activity,
    color: "#0e7490",
    items: [
      { id: "icd_post_lead", label: "Lead position assessment", detail: "RV lead: RV apex or RVOT septum. LV lead (CRT): coronary sinus branch (lateral or posterolateral wall). Assess lead position and stability. Pericardial effusion post-implant.", reference: "LV lead: lateral/posterolateral CS branch" },
      { id: "icd_post_effusion", label: "Pericardial effusion (post-procedure)", detail: "New effusion post-ICD implant may indicate cardiac perforation. Assess for tamponade physiology. Subcostal view most useful acutely.", critical: true, reference: "New effusion = cardiac perforation excluded" },
      { id: "icd_post_crt_response", label: "CRT response assessment (6 months)", detail: "CRT super-responder: EF improvement >10%, LVEDD reduction >10%. Responder: EF improvement >5%. Non-responder: no improvement. Assess at 3–6 months.", critical: true, reference: "CRT response: EF improvement >5% at 6 months" },
      { id: "icd_post_mr_improvement", label: "MR improvement with CRT", detail: "Functional MR often improves with CRT due to improved LV synchrony and geometry. Reassess MR severity at 3–6 months. Persistent severe MR despite CRT: consider MV intervention.", reference: "Functional MR should improve with CRT" },
      { id: "icd_post_lv_remodeling", label: "LV reverse remodeling", detail: "Positive remodeling: ↓ LVEDD, ↓ LVESD, ↑ EF. Document at 3–6 months post-CRT. Reverse remodeling correlates with improved survival.", reference: "Reverse remodeling: ↓ LV volumes, ↑ EF" },
      { id: "icd_post_s_icd", label: "S-ICD specific assessment", detail: "Subcutaneous ICD: no transvenous leads. No pacing capability. Echo: confirm no pacing-dependent rhythm. Assess for LVOT obstruction (S-ICD sensing issues with LVOT gradient).", reference: "S-ICD: no pacing; exclude LVOT obstruction" },
    ],
  },
  {
    id: "icd_crt_optimization",
    title: "CRT-D Optimization Protocol",
    icon: Zap,
    color: "#0f766e",
    items: [
      { id: "icd_crt_av", label: "AV delay optimization", detail: "Iterative method or Ritter method. Goal: maximize LV filling time (E and A wave separation without truncation). Optimal AV delay: A wave completes before mitral valve closes.", critical: true, reference: "AV optimization: maximize LV filling (E-A separation)" },
      { id: "icd_crt_vv", label: "VV delay optimization", detail: "Optimize interventricular timing. Goal: maximize LV dP/dt or aortic VTI. LV pre-activation (LV before RV) typically optimal. Assess by aortic VTI at each VV setting.", reference: "VV optimization: maximize aortic VTI" },
      { id: "icd_crt_dyssynchrony", label: "Mechanical dyssynchrony assessment", detail: "IVMD (interventricular mechanical delay): QRS onset to aortic flow onset minus QRS onset to PA flow onset. SPWMD (septal-to-posterior wall motion delay). Post-CRT: dyssynchrony should reduce.", reference: "IVMD >40 ms = significant dyssynchrony" },
    ],
  },
];

const icdNormalValues = [
  { label: "ICD Indication Threshold", value: "EF ≤35%", note: "On GDMT ≥3 months (ACC/AHA Class I)" },
  { label: "CRT-D Indication (LBBB)", value: "EF ≤35%, QRS ≥150 ms", note: "LBBB morphology (Class I)" },
  { label: "CRT Response (6 months)", value: "EF improvement >5%", note: "Super-responder: >10% improvement" },
  { label: "IVMD (dyssynchrony)", value: ">40 ms", note: "Significant interventricular dyssynchrony" },
  { label: "SPWMD (dyssynchrony)", value: ">130 ms", note: "Septal-to-posterior wall motion delay" },
];

const icdPearls = [
  "EF must be measured by biplane Simpson's — visual estimation or single-plane is not acceptable for ICD decision.",
  "Non-ischemic cardiomyopathy: allow ≥3 months of GDMT before ICD decision — EF may improve significantly.",
  "CRT-D super-responders (EF improvement >10%) may eventually have ICD therapy deactivated if EF normalizes.",
  "S-ICD: exclude LVOT obstruction and pacing dependence before implantation — S-ICD cannot pace.",
  "CRT AV optimization: A wave must complete before MV closes — truncated A wave = AV delay too short.",
  "Post-CRT: functional MR improvement is a marker of successful LV resynchronization.",
];

// ─── DEVICE TABS ──────────────────────────────────────────────────────────────

const DEVICE_TABS: DeviceTab[] = [
  {
    id: "lvad",
    label: "LVAD",
    subtitle: "Left Ventricular Assist Device",
    color: "#189aa1",
    icon: Heart,
    sections: lvadSections,
    normalValues: lvadNormalValues,
    clinicalPearls: lvadPearls,
  },
  {
    id: "ecmo",
    label: "ECMO",
    subtitle: "Extracorporeal Membrane Oxygenation",
    color: "#0e7490",
    icon: Activity,
    sections: ecmoSections,
    normalValues: ecmoNormalValues,
    clinicalPearls: ecmoPearls,
  },
  {
    id: "impella",
    label: "Impella",
    subtitle: "Percutaneous Ventricular Support",
    color: "#0f766e",
    icon: Zap,
    // Impella uses sub-tabs — sections/normalValues/clinicalPearls are per sub-tab
    sections: [],
    normalValues: [],
    clinicalPearls: [],
  },
  {
    id: "lifevest",
    label: "LifeVest",
    subtitle: "Wearable Cardioverter-Defibrillator",
    color: "#b45309",
    icon: Shield,
    sections: lifevestSections,
    normalValues: lifevestNormalValues,
    clinicalPearls: lifevestPearls,
  },
  {
    id: "icd",
    label: "ICD / CRT-D",
    subtitle: "Implantable Cardioverter-Defibrillator",
    color: "#7c3aed",
    icon: Layers,
    sections: icdSections,
    normalValues: icdNormalValues,
    clinicalPearls: icdPearls,
  },
];

// ─── SECTION COMPONENT ────────────────────────────────────────────────────────

function ProtocolSectionCard({ section, deviceColor }: { section: ProtocolSection; deviceColor: string }) {
  const [open, setOpen] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const Icon = section.icon;

  const toggleItem = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const completedCount = section.items.filter(item => checked[item.id]).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: section.color + "18" }}>
            <Icon className="w-4 h-4" style={{ color: section.color }} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>{section.title}</h3>
            <p className="text-xs text-gray-400">{completedCount}/{section.items.length} completed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completedCount === section.items.length && completedCount > 0 && (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {section.items.map(item => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              checked={!!checked[item.id]}
              onToggle={() => toggleItem(item.id)}
              deviceColor={deviceColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistItemRow({
  item, checked, onToggle, deviceColor,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
  deviceColor: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`px-4 py-3 transition-colors ${checked ? "bg-green-50/40" : "hover:bg-gray-50/60"}`}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className="mt-0.5 flex-shrink-0">
          {checked
            ? <CheckCircle className="w-4 h-4 text-green-500" />
            : <Circle className="w-4 h-4 text-gray-300" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-sm font-medium leading-snug ${checked ? "line-through text-gray-400" : "text-gray-700"}`}>
                {item.label}
              </span>
              {item.critical && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 flex-shrink-0">
                  <AlertTriangle className="w-2.5 h-2.5" /> Critical
                </span>
              )}
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
          {expanded && (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-gray-600 leading-relaxed">{item.detail}</p>
              {item.reference && (
                <div className="flex items-start gap-1.5 p-2 rounded-lg" style={{ background: deviceColor + "10", border: `1px solid ${deviceColor}25` }}>
                  <Ruler className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: deviceColor }} />
                  <span className="text-[11px] font-medium leading-snug" style={{ color: deviceColor }}>{item.reference}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function MechanicalSupportNavigator() {
  const [activeDevice, setActiveDevice] = useState("lvad");
  const [activeImpellaSubTab, setActiveImpellaSubTab] = useState("imp_cp");

  // Wire each device module to the Navigator Editor DB overrides
  const { sections: lvadSectionsDb }       = useNavigatorProtocol("mcs_lvad",        lvadSections,       { titleField: "title" });
  const { sections: ecmoSectionsDb }       = useNavigatorProtocol("mcs_ecmo",        ecmoSections,       { titleField: "title" });
  const { sections: lifevestSectionsDb }   = useNavigatorProtocol("mcs_lifevest",    lifevestSections,   { titleField: "title" });
  const { sections: icdSectionsDb }        = useNavigatorProtocol("mcs_icd",         icdSections,        { titleField: "title" });
  const { sections: imp25SectionsDb }      = useNavigatorProtocol("mcs_impella_25",  impella25Sections,  { titleField: "title" });
  const { sections: impCPSectionsDb }      = useNavigatorProtocol("mcs_impella_cp",  impellaCPSections,  { titleField: "title" });
  const { sections: imp55SectionsDb }      = useNavigatorProtocol("mcs_impella_55",  impella55Sections,  { titleField: "title" });
  const { sections: impECPSectionsDb }     = useNavigatorProtocol("mcs_impella_ecp", impellaECPSections, { titleField: "title" });
  const { sections: impRPSectionsDb }      = useNavigatorProtocol("mcs_impella_rp",  impellaRPSections,  { titleField: "title" });

  // Build live DEVICE_TABS with DB-overridden sections
  const liveTabs = DEVICE_TABS.map(tab => {
    if (tab.id === "lvad")     return { ...tab, sections: lvadSectionsDb };
    if (tab.id === "ecmo")     return { ...tab, sections: ecmoSectionsDb };
    if (tab.id === "lifevest") return { ...tab, sections: lifevestSectionsDb };
    if (tab.id === "icd")      return { ...tab, sections: icdSectionsDb };
    return tab;
  });
  const liveImpellaSubTabs = IMPELLA_SUBTABS.map(sub => {
    if (sub.id === "imp_25")  return { ...sub, sections: imp25SectionsDb };
    if (sub.id === "imp_cp")  return { ...sub, sections: impCPSectionsDb };
    if (sub.id === "imp_55")  return { ...sub, sections: imp55SectionsDb };
    if (sub.id === "imp_ecp") return { ...sub, sections: impECPSectionsDb };
    if (sub.id === "imp_rp")  return { ...sub, sections: impRPSectionsDb };
    return sub;
  });

  const device = liveTabs.find(d => d.id === activeDevice)!;
  const isImpella = activeDevice === "impella";
  const impellaSubTab = liveImpellaSubTabs.find(s => s.id === activeImpellaSubTab)!;

  return (
    <Layout>
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4ad9e0] animate-pulse" />
                  <span className="text-[11px] text-white/80 font-medium uppercase tracking-wider">Premium Module</span>
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-1" style={{ fontFamily: "Merriweather, serif" }}>
                MechanicalSupportAssist™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mb-2">Echo Assessment for Mechanical Circulatory Support</p>
              <p className="text-white/60 text-xs max-w-xl leading-relaxed">
                Comprehensive echo protocols for LVAD, ECMO, Impella, LifeVest, and ICD/CRT-D — covering pre-implant assessment, device positioning, post-implant monitoring, and weaning criteria.
              </p>
            </div>
            <Link href="/mechanical-support-scan-coach">
              <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                <Scan className="w-3.5 h-3.5" />
                ScanCoach
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Device Tabs */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="container">
          <div className="flex overflow-x-auto gap-0 scrollbar-hide">
            {DEVICE_TABS.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeDevice === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDevice(tab.id)}
                  className="flex items-center gap-2 px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all flex-shrink-0"
                  style={{
                    borderBottomColor: isActive ? tab.color : "transparent",
                    color: isActive ? tab.color : "#6b7280",
                    background: isActive ? tab.color + "08" : "transparent",
                  }}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <PremiumOverlay featureName="MechanicalSupportAssist™ Navigator">
        <div className="container py-6">

          {/* ─── IMPELLA: Sub-tabs ──────────────────────────────────────────────────────────── */}
          {isImpella && (
            <>
              {/* Impella header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Impella</h2>
                  <p className="text-sm text-gray-500">Select a device type below for its specific protocol checklist</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border"
                  style={{ color: "#0f766e", borderColor: "#0f766e40", background: "#0f766e10" }}>
                  <Zap className="w-3.5 h-3.5" />
                  5 Device Types
                </div>
              </div>

              {/* Impella sub-tab bar */}
              <div className="flex overflow-x-auto gap-1.5 mb-6 pb-1 scrollbar-hide">
                {IMPELLA_SUBTABS.map(sub => {
                  const isActive = activeImpellaSubTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setActiveImpellaSubTab(sub.id)}
                      className="flex flex-col items-start px-4 py-2.5 rounded-xl text-left flex-shrink-0 border transition-all"
                      style={{
                        background: isActive ? sub.color : "white",
                        borderColor: isActive ? sub.color : "#e5e7eb",
                        color: isActive ? "white" : "#374151",
                      }}
                    >
                      <span className="text-xs font-bold">{sub.label}</span>
                      <span className="text-[10px] opacity-70 mt-0.5 leading-tight max-w-[140px]">{sub.subtitle}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Impella sub-tab content */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{impellaSubTab.label}</h3>
                  <p className="text-sm text-gray-500">{impellaSubTab.subtitle}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border"
                  style={{ color: impellaSubTab.color, borderColor: impellaSubTab.color + "40", background: impellaSubTab.color + "10" }}>
                  {impellaSubTab.sections.reduce((acc, s) => acc + s.items.length, 0)} checklist items
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {impellaSubTab.sections.map(section => (
                  <ProtocolSectionCard key={section.id} section={section} deviceColor={impellaSubTab.color} />
                ))}
              </div>

              {/* Reference Values */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
                  <Ruler className="w-4 h-4" style={{ color: impellaSubTab.color }} />
                  Reference Values — {impellaSubTab.label}
                </h3>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: impellaSubTab.color + "12" }}>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Parameter</th>
                        <th className="text-left px-4 py-2.5 font-semibold" style={{ color: impellaSubTab.color }}>Value</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Clinical Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {impellaSubTab.normalValues.map((nv, i) => (
                        <tr key={i} className="bg-white hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-700">{nv.label}</td>
                          <td className="px-4 py-2.5 font-bold" style={{ color: impellaSubTab.color }}>{nv.value}</td>
                          <td className="px-4 py-2.5 text-gray-500">{nv.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clinical Pearls */}
              <div className="rounded-xl border p-4 mb-6" style={{ background: impellaSubTab.color + "08", borderColor: impellaSubTab.color + "30" }}>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: impellaSubTab.color, fontFamily: "Merriweather, serif" }}>
                  <Target className="w-4 h-4" />
                  Clinical Pearls — {impellaSubTab.label}
                </h3>
                <ul className="space-y-2">
                  {impellaSubTab.clinicalPearls.map((pearl, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700 leading-relaxed">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-white"
                        style={{ background: impellaSubTab.color }}>
                        {i + 1}
                      </div>
                      {pearl}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* ─── ALL OTHER DEVICES ──────────────────────────────────────────────────────────── */}
          {!isImpella && (
            <>
              {/* Device subtitle */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{device.label}</h2>
                  <p className="text-sm text-gray-500">{device.subtitle}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border"
                  style={{ color: device.color, borderColor: device.color + "40", background: device.color + "10" }}>
                  <device.icon className="w-3.5 h-3.5" />
                  {device.sections.reduce((acc, s) => acc + s.items.length, 0)} checklist items
                </div>
              </div>

              {/* Protocol Sections */}
              <div className="space-y-4 mb-8">
                {device.sections.map(section => (
                  <ProtocolSectionCard key={section.id} section={section} deviceColor={device.color} />
                ))}
              </div>

              {/* Normal Reference Values */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
                  <Ruler className="w-4 h-4" style={{ color: device.color }} />
                  Reference Values — {device.label}
                </h3>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: device.color + "12" }}>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Parameter</th>
                        <th className="text-left px-4 py-2.5 font-semibold" style={{ color: device.color }}>Value</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Clinical Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {device.normalValues.map((nv, i) => (
                        <tr key={i} className="bg-white hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-700">{nv.label}</td>
                          <td className="px-4 py-2.5 font-bold" style={{ color: device.color }}>{nv.value}</td>
                          <td className="px-4 py-2.5 text-gray-500">{nv.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clinical Pearls */}
              <div className="rounded-xl border p-4" style={{ background: device.color + "08", borderColor: device.color + "30" }}>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: device.color, fontFamily: "Merriweather, serif" }}>
                  <Target className="w-4 h-4" />
                  Clinical Pearls — {device.label}
                </h3>
                <ul className="space-y-2">
                  {device.clinicalPearls.map((pearl, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700 leading-relaxed">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-white"
                        style={{ background: device.color }}>
                        {i + 1}
                      </div>
                      {pearl}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* ScanCoach CTA */}
          <div className="mt-6 rounded-xl p-4 flex items-center justify-between gap-4"
            style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
            <div>
              <p className="text-xs font-semibold text-[#4ad9e0] mb-0.5">Imaging Guidance</p>
              <p className="text-white font-bold text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                MechanicalSupportAssist™ ScanCoach
              </p>
              <p className="text-white/60 text-xs mt-0.5">View-by-view acquisition tips, probe positioning, and Doppler guidance for MCS devices</p>
            </div>
            <Link href="/mechanical-support-scan-coach">
              <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "#189aa1" }}>
                <Scan className="w-3.5 h-3.5" />
                Open ScanCoach
                <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </div>
      </PremiumOverlay>
    </Layout>
  );
}
