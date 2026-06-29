/*
  iHeartEcho™ — TEE Navigator
  Comprehensive transesophageal echo protocol:
  ME, TG, Deep TG, UE views with angle guidance, clinical applications
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, AlertCircle, Eye, Printer, Scan, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { useNavigatorProtocol } from "@/hooks/useNavigatorProtocol";

type ChecklistItem = { id: string; label: string; detail?: string; critical?: boolean; angle?: string };
type ViewSection = { id?: string; view: string; probe: string; position: string; angle: string; depth: string; items: ChecklistItem[]; clinicalUse?: string };

const teeProtocol: ViewSection[] = [
  // ── 1. ME Four-Chamber ──────────────────────────────────────────────────────
  {
    id: "me4c",
    view: "ME Four-Chamber",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "0–20°",
    depth: "28–32 cm",
    clinicalUse: "LV/RV size & function, MV/TV morphology, IAS, LA/RA size",
    items: [
      { id: "me4c_lv", label: "LV size and systolic function", detail: "Biplane EF if needed. Assess all walls", critical: true },
      { id: "me4c_rv", label: "RV size and function", detail: "RV should be <2/3 LV size. TAPSE not feasible — use FAC or S'", critical: true },
      { id: "me4c_mv", label: "Mitral valve morphology", detail: "Leaflet coaptation, prolapse, restriction, calcification", critical: true },
      { id: "me4c_tv", label: "Tricuspid valve morphology", detail: "TR severity, leaflet morphology" },
      { id: "me4c_la", label: "Left atrium size and LAA", detail: "LA dilation? Spontaneous echo contrast (SEC)?" },
      { id: "me4c_ias", label: "Interatrial septum (ASD/PFO)", detail: "Color Doppler + bubble study if PFO suspected", critical: true },
      { id: "me4c_mr_color", label: "MR color Doppler", detail: "Jet origin, direction, extent. Vena contracta", critical: true },
      { id: "me4c_tr_color", label: "TR color Doppler + CW", detail: "TR Vmax for RVSP estimation" },
    ],
  },
  // ── 2. ME Mitral Commissural ────────────────────────────────────────────────
  {
    id: "me_mitral_comm",
    view: "ME Mitral Commissural",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "60–70°",
    depth: "28–32 cm",
    clinicalUse: "MV commissures, P1/A3 and P3/A1 segments, MR mechanism",
    items: [
      { id: "me_mc_p1a3", label: "P1/A3 and P3/A1 segments visible", detail: "Commissural view — best for identifying commissural pathology", critical: true },
      { id: "me_mc_mr", label: "MR color Doppler (commissural origin)", detail: "Commissural MR jets best seen here" },
      { id: "me_mc_coaptation", label: "Leaflet coaptation line", detail: "Prolapse, flail, or restricted segment at commissures" },
    ],
  },
  // ── 3. ME Two-Chamber ───────────────────────────────────────────────────────
  {
    id: "me2c",
    view: "ME Two-Chamber",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "80–100°",
    depth: "28–32 cm",
    clinicalUse: "LV anterior/inferior walls, LAA thrombus, MV anterior/posterior leaflets",
    items: [
      { id: "me2c_lv", label: "LV anterior and inferior wall motion", detail: "LAD (anterior) and RCA (inferior) territories" },
      { id: "me2c_mv", label: "MV anterior and posterior leaflets", detail: "A1/A2/A3 and P1/P2/P3 segments visible" },
      { id: "me2c_la", label: "Left atrium and LAA", detail: "LAA thrombus? SEC? LAA flow velocity <20 cm/s = stasis" },
      { id: "me2c_laa_doppler", label: "LAA Doppler (emptying velocity)", detail: "Normal LAA emptying: >40 cm/s. <20 cm/s = high thrombus risk", critical: true },
    ],
  },
  // ── 4. ME Long Axis ─────────────────────────────────────────────────────────
  {
    id: "melax",
    view: "ME Long Axis",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "120–160°",
    depth: "28–32 cm",
    clinicalUse: "AV, LVOT, MV, aortic root, proximal ascending aorta",
    items: [
      { id: "melax_av", label: "Aortic valve morphology (3 cusps visible)", detail: "Bicuspid? Calcification? Restricted opening?" },
      { id: "melax_lvot", label: "LVOT diameter (for SV calculation)", detail: "Measure in systole, 0.5–1 cm below AV" },
      { id: "melax_aortic_root", label: "Aortic root and proximal ascending aorta", detail: "Sinus of Valsalva, STJ, ascending aorta diameters", critical: true },
      { id: "melax_ar_color", label: "AR color Doppler (LVOT)", detail: "Jet width/LVOT width. Severe: >65% LVOT width" },
      { id: "melax_mv", label: "MV (PLAX equivalent)", detail: "Posterior leaflet prolapse best seen here" },
    ],
  },
  // ── 5. ME AV Long Axis ──────────────────────────────────────────────────────
  {
    id: "me_av_lax",
    view: "ME AV Long Axis",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "120–160°",
    depth: "25–30 cm",
    clinicalUse: "AV leaflets in LAX, LVOT, aortic root — complements ME LAX",
    items: [
      { id: "me_av_lax_cusps", label: "AV cusp motion (LAX)", detail: "Opening excursion, doming, prolapse" },
      { id: "me_av_lax_root", label: "Aortic root dimensions", detail: "Annulus, sinus, STJ, ascending aorta" },
      { id: "me_av_lax_ar", label: "AR color Doppler", detail: "Jet width relative to LVOT. Central vs eccentric" },
    ],
  },
  // ── 6. ME AV Short Axis ─────────────────────────────────────────────────────
  {
    id: "meavsax",
    view: "ME AV Short Axis",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "30–60°",
    depth: "25–30 cm",
    clinicalUse: "AV morphology (bicuspid?), coronary ostia, RVOT, PV",
    items: [
      { id: "meavsax_av", label: "AV leaflet morphology (tricuspid vs bicuspid)", detail: "R, L, N cusps. Commissural fusion? Calcification?", critical: true },
      { id: "meavsax_coronary", label: "Coronary ostia (LMCA and RCA)", detail: "LMCA from left cusp, RCA from right cusp. Dissection? Occlusion?" },
      { id: "meavsax_rvot", label: "RVOT and pulmonary valve", detail: "RVOT dilation? PV morphology?" },
      { id: "meavsax_ra_rv", label: "RA and RV (at AV level)", detail: "RA size, TV, coronary sinus" },
      { id: "meavsax_ar_color", label: "AR color Doppler (SAX)", detail: "Identify which cusp is prolapsing/perforated" },
    ],
  },
  // ── 7. ME RV Inflow-Outflow ──────────────────────────────────────────────────
  {
    id: "mervio",
    view: "ME RV Inflow-Outflow",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "60–90°",
    depth: "28–32 cm",
    clinicalUse: "TV, RVOT, PV — comprehensive RV assessment",
    items: [
      { id: "mervio_tv", label: "Tricuspid valve (all leaflets)", detail: "Anterior, posterior, septal leaflets. TR mechanism" },
      { id: "mervio_rvot", label: "RVOT and pulmonary valve", detail: "RVOT obstruction? PV stenosis/regurgitation?" },
      { id: "mervio_tr_cw", label: "TR CW Doppler (RVSP)", detail: "TR Vmax for RVSP. Severe TR: EROA ≥0.4 cm²" },
      { id: "mervio_pr", label: "PR color Doppler", detail: "PR severity. PHT of PR jet" },
    ],
  },
  // ── 8. ME Bicaval ───────────────────────────────────────────────────────────
  {
    id: "mebicaval",
    view: "ME Bicaval",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "90–110°",
    depth: "28–32 cm",
    clinicalUse: "IAS, SVC/IVC, ASD sizing, PFO, sinus venosus ASD",
    items: [
      { id: "mebicaval_ias", label: "Interatrial septum (full length)", detail: "Secundum ASD, sinus venosus ASD, PFO", critical: true },
      { id: "mebicaval_svc", label: "Superior vena cava", detail: "SVC flow, sinus venosus ASD near SVC" },
      { id: "mebicaval_ivc", label: "Inferior vena cava", detail: "IVC entry into RA. Eustachian valve?" },
      { id: "mebicaval_color", label: "Color Doppler across IAS", detail: "Shunt direction and size. Bubble study if PFO" },
    ],
  },
  // ── 9. ME Modified Bicaval TV ────────────────────────────────────────────────
  {
    id: "me_mod_bicaval_tv",
    view: "ME Modified Bicaval TV",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "100–120°",
    depth: "28–32 cm",
    clinicalUse: "TV in bicaval orientation — TR mechanism, TV repair planning",
    items: [
      { id: "me_mod_tv_leaflets", label: "TV leaflets (anterior and posterior)", detail: "Leaflet morphology, coaptation, prolapse, tethering" },
      { id: "me_mod_tv_tr", label: "TR color Doppler", detail: "Jet direction and origin in bicaval plane" },
      { id: "me_mod_tv_annulus", label: "TV annulus", detail: "Annular dilation? Relevant for TV repair planning" },
    ],
  },
  // ── 10. ME Right Pulmonary Vein ──────────────────────────────────────────────
  {
    id: "me_rpv",
    view: "ME Right Pulmonary Vein",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "0–30°",
    depth: "28–32 cm",
    clinicalUse: "RSPV/RIPV flow, MR severity (systolic reversal), AF ablation planning",
    items: [
      { id: "me_rpv_flow", label: "RSPV PW Doppler (S/D/Ar waves)", detail: "Systolic blunting or reversal = severe MR", critical: true },
      { id: "me_rpv_ripv", label: "RIPV flow if visible", detail: "Inferior PV flow pattern" },
      { id: "me_rpv_color", label: "Color Doppler at PV ostia", detail: "PV stenosis (post-ablation)? Turbulence?" },
    ],
  },
  // ── 11. ME Left Pulmonary Vein ───────────────────────────────────────────────
  {
    id: "me_lpv",
    view: "ME Left Pulmonary Vein",
    probe: "Mid-esophageal",
    position: "Mid-esophageal",
    angle: "90–110°",
    depth: "28–32 cm",
    clinicalUse: "LSPV/LIPV flow, LAA assessment, MR severity",
    items: [
      { id: "me_lpv_flow", label: "LSPV PW Doppler (S/D/Ar waves)", detail: "Systolic blunting or reversal = severe MR", critical: true },
      { id: "me_lpv_laa", label: "LAA (left atrial appendage)", detail: "LAA thrombus? SEC? Emptying velocity <20 cm/s = stasis" },
      { id: "me_lpv_color", label: "Color Doppler at LSPV ostium", detail: "PV stenosis? Turbulence?" },
    ],
  },
  // ── 12. ME Ascending Aorta SAX ───────────────────────────────────────────────
  {
    id: "me_asc_ao_sax",
    view: "ME Ascending Aorta SAX",
    probe: "Mid-esophageal (upper)",
    position: "Mid-esophageal (upper)",
    angle: "0–30°",
    depth: "20–25 cm",
    clinicalUse: "Ascending aorta SAX, PA bifurcation, RPA, SVC",
    items: [
      { id: "me_asc_sax_ao", label: "Ascending aorta diameter (SAX)", detail: "Measure at mid-ascending level. Normal ≤38 mm", critical: true },
      { id: "me_asc_sax_pa", label: "Main PA and bifurcation", detail: "PA dilation? Thrombus (PE)?" },
      { id: "me_asc_sax_rpa", label: "Right pulmonary artery (RPA)", detail: "RPA thrombus? Dilation?" },
      { id: "me_asc_sax_svc", label: "Superior vena cava", detail: "SVC diameter, flow direction" },
    ],
  },
  // ── 13. ME Ascending Aorta LAX ───────────────────────────────────────────────
  {
    id: "me_asc_ao_lax",
    view: "ME Ascending Aorta LAX",
    probe: "Mid-esophageal (upper)",
    position: "Mid-esophageal (upper)",
    angle: "90–120°",
    depth: "20–25 cm",
    clinicalUse: "Ascending aorta LAX — dissection flap, aneurysm, atheroma",
    items: [
      { id: "me_asc_lax_ao", label: "Ascending aorta LAX diameter", detail: "Measure at sinus, STJ, mid-ascending. Dissection flap?", critical: true },
      { id: "me_asc_lax_dissection", label: "Intimal flap (dissection)", detail: "Type A dissection involves ascending aorta. True vs false lumen" },
      { id: "me_asc_lax_atheroma", label: "Aortic atheroma grade", detail: "Grade I–V. Grade ≥IV (≥4 mm or mobile) = high embolic risk" },
    ],
  },
  // ── 14. UE Aortic Arch LAX ───────────────────────────────────────────────────
  {
    id: "ue_arch_lax",
    view: "UE Aortic Arch LAX",
    probe: "Upper esophageal",
    position: "Upper esophageal",
    angle: "0°",
    depth: "18–22 cm",
    clinicalUse: "Aortic arch LAX — atheroma, dissection, PDA, coarctation",
    items: [
      { id: "ue_arch_lax_ao", label: "Aortic arch diameter and morphology", detail: "Atheroma, dissection, aneurysm" },
      { id: "ue_arch_lax_pda", label: "PDA (if suspected)", detail: "Continuous flow from descending aorta to PA" },
      { id: "ue_arch_lax_coarc", label: "Coarctation (if suspected)", detail: "Turbulent flow in descending aorta" },
    ],
  },
  // ── 15. UE Aortic Arch SAX ───────────────────────────────────────────────────
  {
    id: "ue_arch_sax",
    view: "UE Aortic Arch SAX",
    probe: "Upper esophageal",
    position: "Upper esophageal",
    angle: "90°",
    depth: "18–22 cm",
    clinicalUse: "Aortic arch SAX — PA, PV, SVC, left pulmonary artery",
    items: [
      { id: "ue_arch_sax_pa", label: "Main PA and pulmonary valve (SAX)", detail: "PA dilation? PV morphology?" },
      { id: "ue_arch_sax_lpa", label: "Left pulmonary artery", detail: "LPA thrombus? Dilation?" },
      { id: "ue_arch_sax_svc", label: "SVC (SAX)", detail: "SVC diameter and flow" },
    ],
  },
  // ── 16. TG Basal SAX ─────────────────────────────────────────────────────────
  {
    id: "tg_basal_sax",
    view: "TG Basal SAX",
    probe: "Transgastric",
    position: "Transgastric",
    angle: "0°",
    depth: "38–42 cm",
    clinicalUse: "MV leaflet tips (SAX), LV basal segments, papillary muscles",
    items: [
      { id: "tg_basal_mv", label: "MV leaflet tips (SAX)", detail: "Fish-mouth opening. Rheumatic stenosis? Commissural fusion?" },
      { id: "tg_basal_lv", label: "LV basal wall motion", detail: "Basal anteroseptal, anterior, lateral, posterior, inferior, inferoseptal" },
    ],
  },
  // ── 17. TG Mid SAX ───────────────────────────────────────────────────────────
  {
    id: "tg_mid_sax",
    view: "TG Mid SAX",
    probe: "Transgastric",
    position: "Transgastric",
    angle: "0°",
    depth: "40–45 cm",
    clinicalUse: "LV wall motion (all 6 mid segments), papillary muscles, pericardium",
    items: [
      { id: "tg_lv_wall", label: "LV wall motion (all 6 mid segments)", detail: "Anteroseptal, anterior, lateral, posterior, inferior, inferoseptal", critical: true },
      { id: "tg_pap", label: "Papillary muscles (anterolateral and posteromedial)", detail: "Papillary muscle rupture? Ischemia?" },
      { id: "tg_rv", label: "RV free wall motion", detail: "RV ischemia? Dilation?" },
      { id: "tg_pericardium", label: "Pericardial effusion", detail: "Circumferential? Loculated?" },
    ],
  },
  // ── 18. TG Apical SAX ────────────────────────────────────────────────────────
  {
    id: "tg_apical_sax",
    view: "TG Apical SAX",
    probe: "Transgastric",
    position: "Transgastric",
    angle: "0°",
    depth: "45–50 cm",
    clinicalUse: "LV apical segments — apical thrombus, apical ballooning (Takotsubo)",
    items: [
      { id: "tg_apical_lv", label: "LV apical wall motion", detail: "Apical anteroseptal, anterior, lateral, posterior, inferior, inferoseptal", critical: true },
      { id: "tg_apical_thrombus", label: "LV apical thrombus", detail: "Apical thrombus? Spontaneous echo contrast?" },
    ],
  },
  // ── 19. TG Two-Chamber ───────────────────────────────────────────────────────
  {
    id: "tg2c",
    view: "TG Two-Chamber",
    probe: "Transgastric",
    position: "Transgastric",
    angle: "80–100°",
    depth: "40–45 cm",
    clinicalUse: "LV anterior/inferior walls, MV subvalvular apparatus",
    items: [
      { id: "tg2c_lv", label: "LV anterior and inferior wall motion", detail: "Anterior (LAD), inferior (RCA)" },
      { id: "tg2c_mv_sub", label: "MV subvalvular apparatus", detail: "Chordae, papillary muscles. Chordal rupture?" },
    ],
  },
  // ── 20. TG LAX ───────────────────────────────────────────────────────────────
  {
    id: "tglax",
    view: "TG LAX",
    probe: "Transgastric",
    position: "Transgastric",
    angle: "90–120°",
    depth: "40–45 cm",
    clinicalUse: "LVOT alignment for Doppler — best intraoperative AV/LVOT assessment",
    items: [
      { id: "tglax_lvot", label: "LVOT (TG LAX — best Doppler alignment)", detail: "Best view for LVOT PW Doppler and AV CW Doppler in intraop TEE", critical: true },
      { id: "tglax_av_cw", label: "AV CW Doppler (TG LAX)", detail: "Parallel alignment. Use for AS gradient in intraop TEE" },
      { id: "tglax_lv_walls", label: "LV anterior and inferior walls", detail: "Anterior (LAD), inferior (RCA)" },
    ],
  },
  // ── 21. TG RV Basal ──────────────────────────────────────────────────────────
  {
    id: "tg_rv_basal",
    view: "TG RV Basal",
    probe: "Transgastric",
    position: "Transgastric",
    angle: "0–20°",
    depth: "38–42 cm",
    clinicalUse: "RV basal function, TV subvalvular apparatus, RVOT",
    items: [
      { id: "tg_rv_basal_rv", label: "RV basal wall motion", detail: "RV free wall, moderator band" },
      { id: "tg_rv_basal_tv", label: "TV subvalvular apparatus", detail: "Chordae, papillary muscles. Tricuspid chordal rupture?" },
    ],
  },
  // ── 22. TG RV Inflow ─────────────────────────────────────────────────────────
  {
    id: "tg_rv_inflow",
    view: "TG RV Inflow",
    probe: "Transgastric",
    position: "Transgastric",
    angle: "100–120°",
    depth: "38–42 cm",
    clinicalUse: "TV, RV inflow, TR Doppler — complements ME RV IO",
    items: [
      { id: "tg_rv_inflow_tv", label: "TV leaflets (inflow view)", detail: "TV morphology, coaptation, prolapse" },
      { id: "tg_rv_inflow_tr", label: "TR CW Doppler", detail: "TR Vmax for RVSP. Best alignment from TG RV Inflow" },
    ],
  },
  // ── 23. Deep TG LAX ──────────────────────────────────────────────────────────
  {
    id: "deep_tg",
    view: "Deep TG LAX",
    probe: "Deep transgastric",
    position: "Deep transgastric",
    angle: "0° (anteflexed)",
    depth: "45–50 cm",
    clinicalUse: "Best Doppler alignment for LVOT/AV — intraoperative AS assessment",
    items: [
      { id: "dtg_lvot_pw", label: "LVOT PW Doppler (best alignment)", detail: "Used for SV calculation in intraop TEE" },
      { id: "dtg_av_cw", label: "AV CW Doppler (best alignment for AS)", detail: "Most parallel to flow — preferred for intraop AS gradient", critical: true },
    ],
  },
  // ── 24. Desc Aorta SAX ───────────────────────────────────────────────────────
  {
    id: "desc_ao_sax",
    view: "Desc Aorta SAX",
    probe: "Mid/lower esophageal (rotate left)",
    position: "Mid-esophageal",
    angle: "0°",
    depth: "30–40 cm",
    clinicalUse: "Descending thoracic aorta SAX — dissection, atheroma, aneurysm",
    items: [
      { id: "desc_sax_ao", label: "Descending aorta diameter (SAX)", detail: "Normal ≤28 mm. Aneurysm >40 mm", critical: true },
      { id: "desc_sax_dissection", label: "Intimal flap (Type B dissection)", detail: "True vs false lumen. Color Doppler flow direction" },
      { id: "desc_sax_atheroma", label: "Aortic atheroma grade", detail: "Grade I–V. Grade ≥IV = high embolic risk" },
    ],
  },
  // ── 25. Desc Aorta LAX ───────────────────────────────────────────────────────
  {
    id: "desc_ao_lax",
    view: "Desc Aorta LAX",
    probe: "Mid/lower esophageal (rotate left)",
    position: "Mid-esophageal",
    angle: "90°",
    depth: "30–40 cm",
    clinicalUse: "Descending thoracic aorta LAX — dissection extent, atheroma, aneurysm",
    items: [
      { id: "desc_lax_ao", label: "Descending aorta LAX morphology", detail: "Dissection flap extent? Aneurysm? Atheroma?" },
      { id: "desc_lax_flow", label: "Color Doppler (true vs false lumen)", detail: "Flow in true lumen (systolic) vs false lumen (variable)" },
    ],
  },
];

// --- CLINICAL APPLICATIONS ----------------------------------------------------
const clinicalApps = [
  {
    indication: "MV Repair / Replacement",
    keyViews: ["ME 4C (0°)", "ME 2C (90°)", "ME LAX (120°)", "ME AV SAX (45°)", "TG Mid SAX (0°)"],
    focus: "MV leaflet segmentation (P1/P2/P3, A1/A2/A3), prolapse/flail segment, MR mechanism (Carpentier classification), post-repair MR, SAM assessment",
    carpentier: ["Type I: Normal leaflet motion (annular dilation, perforation)", "Type II: Excessive motion (prolapse, flail)", "Type III: Restricted motion (IIIa: rheumatic | IIIb: ischemic)"],
  },
  {
    indication: "Aortic Dissection",
    keyViews: ["ME LAX (120°)", "ME AV SAX (45°)", "ME Ascending SAX/LAX", "UE Arch (0°/90°)", "TG Mid SAX"],
    focus: "Intimal flap location, true vs false lumen (color Doppler), AR severity, coronary involvement, pericardial effusion",
    carpentier: [],
  },
  {
    indication: "Endocarditis",
    keyViews: ["ME 4C (0°)", "ME LAX (120°)", "ME AV SAX (45°)", "ME 2C (90°)", "TG Mid SAX"],
    focus: "Vegetation size/location/mobility, perivalvular abscess (aortic root), fistula, severe regurgitation, prosthetic valve involvement",
    carpentier: [],
  },
  {
    indication: "Intraoperative (Cardiac Surgery)",
    keyViews: ["Pre-bypass: Full ME survey", "TG Mid SAX (continuous monitoring)", "Deep TG LAX (Doppler)", "Post-bypass: Repeat full survey"],
    focus: "Pre-bypass: baseline function, valve pathology. Intraop: wall motion (ischemia), volume status. Post-bypass: repair result, residual lesions, de-airing",
    carpentier: [],
  },
  {
    indication: "Structural Heart (TAVR/MitraClip/LAA Closure)",
    keyViews: ["ME AV SAX (45°)", "ME LAX (120°)", "ME Bicaval (90°)", "ME 4C (0°)", "3D TEE"],
    focus: "TAVR: annulus sizing, calcium, coronary heights, paravalvular leak. MitraClip: leaflet anatomy, grasping. WATCHMAN: LAA sizing, thrombus exclusion",
    carpentier: [],
  },
];

// --- MAIN COMPONENT -----------------------------------------------------------
export default function TEENavigator() {
  const [tab, setTab] = useState<"protocol" | "applications" | "reference">("protocol");
  // Use DB overrides if available (seeded via Navigator Editor), else fall back to static
  const { sections: protocol } = useNavigatorProtocol("tee", teeProtocol);
  const [expandedView, setExpandedView] = useState<number | null>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedApp, setExpandedApp] = useState<number | null>(null);

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalItems = protocol.reduce((acc, v) => acc + v.items.length, 0);
  const progress = Math.round((checked.size / totalItems) * 100);

  const handleExport = () => {
    const now = new Date().toLocaleString();
    const lines: string[] = [
      "=== iHeartEcho™ — TEE Protocol Checklist ===",
      `Generated: ${now}`,
      `Progress: ${checked.size}/${totalItems} items (${progress}%)`,
      "",
    ];
    protocol.forEach(section => {
      const sectionChecked = section.items.filter(i => checked.has(i.id)).length;
      lines.push(`\n-- ${section.view} [${section.position} | ${section.angle} | ${section.depth}] (${sectionChecked}/${section.items.length}) --`);
      if (section.clinicalUse) lines.push(`   Clinical use: ${section.clinicalUse}`);
      section.items.forEach(item => {
        const status = checked.has(item.id) ? "[✓]" : item.critical ? "[ ] ⚠ CRITICAL" : "[ ]";
        lines.push(`   ${status} ${item.label}`);
        if (item.detail && !checked.has(item.id)) lines.push(`        → ${item.detail}`);
      });
    });
    lines.push("\n" + "=".repeat(50));
    lines.push("Per ASE/SCA TEE Guidelines | iHeartEcho™ EchoAssist™ Echocardiography Clinical Intelligence");
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TEE-Checklist-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const positionColors: Record<string, string> = {
    "Mid-esophageal": "#189aa1",
    "Mid-esophageal (upper)": "#0e7490",
    "Upper esophageal": "#189aa1",
    "Transgastric": "#189aa1",
    "Deep transgastric": "#4ad9e0",
  };

  return (
    <Layout>
      {/* Hero Banner */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="container py-8 md:py-10">
          <div className="mb-3">
            <BackToEchoAssist className="text-white/70 hover:text-white" />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Eye className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                  <span className="text-xs text-white/80 font-medium">Guideline-Based TEE Protocol</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  PREMIUM
                </div>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAssist™ Navigator — TEE
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Comprehensive transesophageal echocardiography protocol with ME, TG, and UE views, clinical applications, and intraoperative guidance.
              </p>
              <div className="mt-3">
                <Link href="/tee-scan-coach">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <Scan className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    Go to TEE ScanCoach
                    <span className="text-xs text-[#4ad9e0]">→</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PremiumOverlay featureName="TEE Navigator">
      <div className="container py-6">

        {/* Safety reminder */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700">
            <strong>Safety:</strong> Confirm no absolute contraindications (esophageal stricture, active GI bleed, recent esophageal surgery).
            Relative: esophageal varices, cervical spine instability, coagulopathy. Bite block in place. Continuous monitoring required.
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">Protocol Progress</div>
            <div className="text-sm font-bold text-[#189aa1]">{checked.size}/{totalItems}</div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "#189aa1" }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[{ id: "protocol", label: "Protocol Checklist" }, { id: "applications", label: "Clinical Applications" }, { id: "reference", label: "Normal Reference Values" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
              }`}
              style={tab === t.id ? { background: "#189aa1" } : {}}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={() => setChecked(new Set())}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 hover:border-red-300 hover:text-red-500 bg-white transition-all">
              Reset
            </button>
          </div>
        </div>

        {tab === "protocol" && (
          <div className="space-y-3">
            {protocol.map((section, si) => {
              const sectionChecked = section.items.filter(i => checked.has(i.id)).length;
              const isExpanded = expandedView === si;
              const posColor = positionColors[section.position ?? ""] || "#189aa1";
              return (
                <div key={si} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#f0fbfc] transition-all"
                    onClick={() => setExpandedView(isExpanded ? null : si)}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: sectionChecked === section.items.length ? "#16a34a" : posColor }}>
                      {sectionChecked === section.items.length ? "✓" : si + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                        {section.view}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: posColor }}>
                          {section.position}
                        </span>
                        <span className="text-xs text-gray-400">Angle: {section.angle} | Depth: {section.depth}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mr-2">{sectionChecked}/{section.items.length}</div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {section.clinicalUse && (
                        <div className="px-5 py-2 bg-[#f0fbfc] border-b border-[#189aa1]/10 flex items-start gap-2">
                          <Eye className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-[#189aa1] font-medium">{section.clinicalUse}</span>
                        </div>
                      )}
                      {section.items.map((item) => (
                        <div key={item.id}
                          className={`flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-[#f0fbfc] transition-all ${
                            checked.has(item.id) ? "bg-green-50/50" : ""
                          }`}
                          onClick={() => toggleCheck(item.id)}>
                          {checked.has(item.id)
                            ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            : <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${item.critical ? "text-amber-400" : "text-gray-300"}`} />
                          }
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${checked.has(item.id) ? "text-gray-400 line-through" : "text-gray-700"}`}>
                              {item.label}
                              {item.angle && <span className="ml-2 text-xs text-gray-400 font-normal">{item.angle}</span>}
                              {item.critical && !checked.has(item.id) && (
                                <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Critical</span>
                              )}
                            </div>
                            {item.detail && <div className="text-xs text-gray-400 mt-0.5">{item.detail}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "reference" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b" style={{ background: "linear-gradient(90deg, #0e4a50, #189aa1)" }}>
              <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>TEE Normal Reference Values</h3>
              <p className="text-xs text-white/70 mt-0.5">ASE/EACVI 2015 · Vendor-neutral · Adult</p>
            </div>
            <div className="p-5 space-y-5">
              {[
                { section: "Left Ventricle", rows: [
                  ["LVEDD", "42–58 mm (M), 38–52 mm (F)"],
                  ["LVESD", "25–40 mm"],
                  ["IVSd / PWd", "6–10 mm"],
                  ["LV EF (biplane)", "≥ 55%"],
                  ["LV GLS", "≤ −18% (ASE 2025)"],
                ]},
                { section: "Left Atrium", rows: [
                  ["LA AP dimension", "< 40 mm"],
                  ["LAVI", "< 34 mL/m²"],
                  ["LA appendage flow velocity", "≥ 40 cm/s (LAA thrombus risk if < 20 cm/s)"],
                ]},
                { section: "Aorta (TEE)", rows: [
                  ["Aortic annulus", "18–26 mm"],
                  ["Sinus of Valsalva", "< 40 mm"],
                  ["Sinotubular junction", "< 36 mm"],
                  ["Ascending aorta", "< 40 mm"],
                  ["Descending thoracic aorta", "< 30 mm"],
                ]},
                { section: "Mitral Valve", rows: [
                  ["Mitral annulus diameter", "28–35 mm"],
                  ["Mitral E velocity", "0.6–1.3 m/s"],
                  ["Mitral A velocity", "0.4–0.9 m/s"],
                  ["E/A ratio", "0.8–2.0"],
                ]},
                { section: "Aortic Valve", rows: [
                  ["AV peak velocity", "< 2.0 m/s"],
                  ["AVA (normal)", "≥ 2.0 cm²"],
                  ["LVOT diameter", "18–25 mm"],
                ]},
                { section: "Right Heart", rows: [
                  ["RV basal diameter", "< 41 mm"],
                  ["TAPSE", "≥ 17 mm"],
                  ["RV free wall strain", "≤ −20%"],
                  ["RA area", "< 18 cm²"],
                ]},
              ].map(({ section, rows }) => (
                <div key={section}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#189aa1" }}>{section}</div>
                  <table className="w-full text-xs">
                    <tbody>
                      {rows.map(([param, val]) => (
                        <tr key={param} className="border-b border-gray-50 last:border-0">
                          <td className="py-1.5 text-gray-600 w-1/2">{param}</td>
                          <td className="py-1.5 font-semibold text-gray-800">{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-2">References: <a href='https://asecho.org/wp-content/uploads/2018/08/WFTF-Chamber-Quantification-Summary-Doc-Final-July-18.pdf' target='_blank' rel='noopener noreferrer' className='underline hover:text-[#189aa1]'>ASE/WFTF 2018 Chamber Quantification</a>, ASE 2025 Strain Guideline (Thomas et al.), ACC/AHA Valvular Heart Disease Guidelines 2021.</p>
            </div>
          </div>
        )}
        {tab === "applications" && (
          <div className="space-y-3">
            {clinicalApps.map((app, ai) => (
              <div key={ai} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#f0fbfc] transition-all"
                  onClick={() => setExpandedApp(expandedApp === ai ? null : ai)}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: "#189aa1" }}>
                    {ai + 1}
                  </div>
                  <span className="font-bold text-sm text-gray-800 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
                    {app.indication}
                  </span>
                  {expandedApp === ai ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedApp === ai && (
                  <div className="border-t border-gray-100 p-5 space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Views</div>
                      <div className="flex flex-wrap gap-2">
                        {app.keyViews.map((v, i) => (
                          <span key={i} className="px-2 py-1 rounded-lg text-xs font-medium text-white" style={{ background: "#189aa1" }}>{v}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Focus Points</div>
                      <p className="text-sm text-gray-600">{app.focus}</p>
                    </div>
                    {app.carpentier.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Carpentier Classification (MV)</div>
                        <ul className="space-y-1">
                          {app.carpentier.map((c, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-600 p-2 rounded-lg bg-[#f0fbfc]">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: "#189aa1" }}>{i + 1}</span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </PremiumOverlay>
    </Layout>
  );
}
