/*
  StructuralHeartScanCoach.tsx — iHeartEcho™
  Structural Heart ScanCoach: procedure-specific TEE and ICE acquisition guide
  for transcatheter structural heart interventions.
  Covers: TAVR, TEER/MitraClip, LAAO (Watchman/Amulet), ASD/PFO closure,
  TMVR, Tricuspid TEER, and Balloon Mitral Valvuloplasty.
  Each procedure includes pre-procedure sizing views, intra-procedure guidance
  views, and post-procedure assessment views.
*/
import { useState, useMemo } from "react";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import ScanCoachNavBar from "@/components/ScanCoachNavBar";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import {
  ChevronDown, ChevronUp, ArrowRight, Zap,
  AlertTriangle, Lightbulb, Info, ImageIcon, Stethoscope, Heart,
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA  = "#4ad9e0";

// ─── VIEW DATA ────────────────────────────────────────────────────────────────
const SH_VIEWS = [
  // ── TAVR ─────────────────────────────────────────────────────────────────────
  {
    id: "tavr-sizing",
    group: "TAVR",
    groupColor: "#189aa1",
    name: "TAVR — Annulus Sizing (ME LAX)",
    modality: "TEE",
    phase: "Pre-procedure / Sizing",
    description: "The midesophageal long axis (ME LAX / 120–135°) is the primary TEE view for aortic annulus sizing. The annulus diameter, perimeter, and area are measured at end-systole for TAVR prosthesis selection.",
    howToGet: [
      "Advance probe to mid-esophagus (30–35 cm)",
      "Rotate multiplane angle to 120–135°",
      "Optimize to show LVOT, aortic valve, and aortic root in the same plane",
      "Freeze at end-systole (just before valve closure)",
      "Measure annulus diameter at the hinge points of the aortic cusps",
    ],
    structures: [
      "Aortic annulus (virtual basal ring)", "LVOT",
      "Aortic root (sinus of Valsalva, STJ)", "Aortic cusps (RCC, LCC, NCC)",
      "Proximal ascending aorta",
    ],
    doppler: [
      { label: "AV CW (ME LAX)", detail: "Peak and mean gradient — baseline AS severity" },
      { label: "LVOT PW", detail: "Baseline LVOT VTI for cardiac output" },
      { label: "AR Color", detail: "Baseline AR — note origin and severity before valve deployment" },
    ],
    tips: [
      "Annulus is measured at end-systole — largest dimension",
      "3D TEE provides more accurate annulus area and perimeter than 2D diameter",
      "Bicuspid AV requires special sizing — note raphe and asymmetric anatomy",
      "LVOT calcification can complicate annulus measurement — note extent",
    ],
    pitfalls: [
      "Measuring at wrong phase (diastole) underestimates annulus size",
      "Off-axis ME LAX overestimates or underestimates annulus diameter",
      "Heavy calcification can shadow the annulus — use 3D for accuracy",
    ],
    measurements: [
      "Annulus diameter (2D, end-systole)",
      "Sinus of Valsalva diameter",
      "STJ diameter",
      "Ascending aorta diameter",
      "LVOT diameter",
      "Coronary ostia height (RCA and LCA)",
    ],
    criticalFindings: [
      "Severe LVOT calcification (risk of annulus rupture)",
      "Low coronary ostia height <10 mm (coronary occlusion risk)",
      "Bicuspid AV (higher paravalvular leak risk)",
    ],
  },
  {
    id: "tavr-deployment",
    group: "TAVR",
    groupColor: "#189aa1",
    name: "TAVR — Valve Deployment Guidance",
    modality: "TEE / Fluoroscopy",
    phase: "Intra-procedure",
    description: "During TAVR deployment, TEE guides wire crossing, balloon valvuloplasty, and valve positioning. The ME LAX and ME AV SAX views are used simultaneously to confirm coaxial alignment and deployment depth.",
    howToGet: [
      "Maintain ME LAX (120–135°) for deployment depth monitoring",
      "Switch to ME AV SAX (30–45°) to confirm coaxial alignment",
      "Monitor for valve position relative to annulus during deployment",
      "Immediately post-deployment: assess AR, LVOT gradient, and leaflet motion",
    ],
    structures: [
      "Aortic annulus", "Deployed valve frame", "LVOT",
      "Coronary ostia (post-deployment)", "Mitral valve (anterior leaflet)",
    ],
    doppler: [
      { label: "AR Color (immediate post)", detail: "Paravalvular leak — location and severity. Central vs. paravalvular" },
      { label: "AV CW (post-deployment)", detail: "Residual gradient — mean >20 mmHg = significant" },
      { label: "MV Color (post-deployment)", detail: "New MR from valve frame impingement on AMVL" },
    ],
    tips: [
      "Paravalvular AR: mild = acceptable; moderate/severe = balloon post-dilation or valve-in-valve",
      "Valve too deep (ventricular) = LBBB risk and LVOT obstruction",
      "Valve too high (aortic) = coronary occlusion and embolisation risk",
      "Pericardial effusion post-deployment = annulus injury — monitor closely",
    ],
    pitfalls: [
      "Central AR vs. paravalvular AR — use 3D color Doppler to localise",
      "Rapid pacing during deployment reduces image quality — acquire immediately after",
      "Valve frame can shadow the LVOT — use multiple planes",
    ],
    measurements: [
      "Paravalvular AR grade (none/trace/mild/moderate/severe)",
      "Post-deployment mean AV gradient",
      "LVOT VTI (post-deployment)",
      "Pericardial effusion size",
    ],
    criticalFindings: [
      "Moderate-severe paravalvular AR (requires post-dilation or valve-in-valve)",
      "Coronary occlusion (new RWMA + ST changes)",
      "Cardiac tamponade (pericardial effusion + haemodynamic compromise)",
      "Valve embolisation (loss of frame position)",
    ],
  },
  // ── TEER / MitraClip ─────────────────────────────────────────────────────────
  {
    id: "teer-iasn",
    group: "TEER / MitraClip",
    groupColor: "#7c3aed",
    name: "TEER — Transseptal Puncture Guidance",
    modality: "TEE / ICE",
    phase: "Intra-procedure",
    description: "Transseptal puncture (TSP) for TEER requires precise needle placement in the posterior-superior IAS, 3.5–4.5 cm above the mitral annulus. TEE bicaval and ME 4-chamber views guide needle position.",
    howToGet: [
      "ME Bicaval view (90–110°): confirms needle in posterior IAS — not anterior",
      "ME 4-chamber (0°): confirms superior position and height above MV annulus",
      "Tenting of the IAS should be visible before puncture",
      "After puncture: confirm wire and sheath in LA with color Doppler",
      "Measure height above MV annulus: target 3.5–4.5 cm for MitraClip",
    ],
    structures: [
      "Interatrial septum (fossa ovalis)", "SVC", "IVC",
      "Right atrium", "Left atrium", "Mitral valve annulus",
    ],
    doppler: [
      { label: "Color across IAS", detail: "Confirm left-to-right shunt after puncture — confirms LA entry" },
      { label: "Height measurement", detail: "Distance from TSP site to MV annular plane — target 3.5–4.5 cm" },
    ],
    tips: [
      "Too anterior = risk of aortic puncture; too posterior = difficult catheter manipulation",
      "Height <3.5 cm = insufficient room for clip delivery system",
      "ICE can replace TEE for TSP guidance in experienced centres",
      "Biplane view (0° + 90°) simultaneously confirms both planes",
    ],
    pitfalls: [
      "Lipomatous hypertrophy of IAS can make TSP difficult — identify fossa ovalis",
      "Aortic root is anterior — confirm needle is posterior before puncture",
    ],
    measurements: [
      "TSP height above MV annulus (target 3.5–4.5 cm)",
      "TSP location (posterior-superior fossa ovalis)",
    ],
    criticalFindings: [
      "Aortic puncture (needle in aortic root — abort immediately)",
      "Cardiac tamponade (pericardial effusion post-TSP)",
    ],
  },
  {
    id: "teer-guidance",
    group: "TEER / MitraClip",
    groupColor: "#7c3aed",
    name: "TEER — Clip Delivery and Grasping",
    modality: "TEE",
    phase: "Intra-procedure",
    description: "TEE guides MitraClip/TEER clip delivery, positioning, and grasping. The ME commissural view (60°) and ME 4-chamber (0°) are used for clip orientation; the ME 2-chamber (90°) confirms A2/P2 grasping.",
    howToGet: [
      "ME Commissural (60°): confirms clip perpendicular to coaptation line",
      "ME 4-chamber (0°): confirms clip position in A2/P2 zone",
      "ME 2-chamber (90°): confirms leaflet grasping — both leaflets should be captured",
      "3D TEE en face view: 'surgeon's view' of MV — confirms clip orientation",
      "After grasping: assess residual MR and mean MV gradient",
    ],
    structures: [
      "Mitral valve (A1/A2/A3, P1/P2/P3)", "Clip arms",
      "Left atrium", "Left ventricle", "Chordae tendineae",
    ],
    doppler: [
      { label: "MV Color (post-grasp)", detail: "Residual MR — location and severity. Target ≤1+" },
      { label: "MV Mean Gradient (post-grasp)", detail: "Mean gradient — target <5 mmHg. >5 mmHg = significant MS" },
      { label: "MV Area (post-grasp)", detail: "MVA by PHT — target >1.5 cm² after clip" },
    ],
    tips: [
      "Clip should be perpendicular to the coaptation line — not parallel",
      "A2/P2 is the most common grasping zone — confirm with biplane view",
      "After clip release: assess for leaflet tear — new severe MR = clip detachment",
      "Double-orifice MV is expected after clip — do not mistake for pathology",
    ],
    pitfalls: [
      "Single leaflet attachment (SLA) = only one leaflet grasped — reposition",
      "Clip too medial or lateral = A1/P1 or A3/P3 grasping — suboptimal result",
      "Chordal entanglement can prevent clip deployment — withdraw and reposition",
    ],
    measurements: [
      "Residual MR grade (target ≤1+)",
      "Mean MV gradient (target <5 mmHg)",
      "MVA post-clip (target >1.5 cm²)",
      "Number of clips deployed",
    ],
    criticalFindings: [
      "Residual MR ≥3+ after clip (insufficient reduction — consider additional clip)",
      "Mean gradient >5 mmHg (iatrogenic MS — do not add more clips)",
      "Leaflet tear with severe MR (emergency surgery may be required)",
      "Cardiac tamponade",
    ],
  },
  // ── LAAO ─────────────────────────────────────────────────────────────────────
  {
    id: "laao-sizing",
    group: "LAAO (Watchman / Amulet)",
    groupColor: "#d97706",
    name: "LAAO — LAA Sizing",
    modality: "TEE",
    phase: "Pre-procedure / Sizing",
    description: "LAA sizing for Watchman/Amulet requires measurement of the LAA ostium diameter and depth at multiple angles (0°, 45°, 90°, 135°). The largest ostium diameter determines device size (device = ostium + 10–20%).",
    howToGet: [
      "ME 2-chamber (90°): primary LAA view — shows LAA neck and body",
      "Rotate through 0°, 45°, 90°, 135° to measure ostium at each angle",
      "Measure LAA ostium at the widest point (hinge point to hinge point)",
      "Measure LAA depth — must be ≥ device size",
      "3D TEE: en face view of LAA ostium for accurate sizing",
    ],
    structures: [
      "Left atrial appendage (ostium, neck, lobes)",
      "Left upper pulmonary vein (LUPV — adjacent to LAA)",
      "Left circumflex artery (posterior to LAA)",
    ],
    doppler: [
      { label: "LAA PW Doppler", detail: "LAA emptying velocity — <20 cm/s = high thrombus risk" },
      { label: "Color LAA", detail: "Exclude LAA thrombus — spontaneous echo contrast (SEC) is high risk" },
    ],
    tips: [
      "LAA thrombus must be excluded before LAAO — if present, anticoagulate and re-image",
      "Multi-lobed LAA requires careful depth measurement — deepest lobe determines depth",
      "LUPV ridge is not a lobe — do not confuse with LAA anatomy",
      "Watchman sizing: device diameter = max ostium + 10–20% (compression target 8–20%)",
    ],
    pitfalls: [
      "Pectinate muscles can mimic thrombus — use color Doppler and multiple planes",
      "SEC (smoke) is not thrombus but indicates high thrombus risk",
      "Measuring at wrong angle underestimates ostium — always use largest diameter",
    ],
    measurements: [
      "LAA ostium diameter at 0°, 45°, 90°, 135°",
      "LAA depth (landing zone)",
      "LAA emptying velocity",
    ],
    criticalFindings: [
      "LAA thrombus (contraindication to LAAO — postpone procedure)",
      "Dense SEC (high thrombus risk — consider extended anticoagulation)",
    ],
  },
  {
    id: "laao-deployment",
    group: "LAAO (Watchman / Amulet)",
    groupColor: "#d97706",
    name: "LAAO — Device Deployment and Assessment",
    modality: "TEE",
    phase: "Intra-procedure / Post-procedure",
    description: "After Watchman/Amulet deployment, TEE confirms device position, compression, seal, and absence of peridevice leak. The PASS criteria (Position, Anchor, Size, Seal) must be met before device release.",
    howToGet: [
      "Assess device position: LAA ostium should be covered, device not protruding into LA",
      "Confirm anchoring: tug test — device should not move with gentle traction",
      "Measure device compression: (device size − deployed diameter) / device size × 100%",
      "Color Doppler at 0°, 45°, 90°, 135°: assess for peridevice leak",
      "Confirm no pericardial effusion",
    ],
    structures: [
      "Watchman/Amulet device", "LAA ostium", "Left atrium",
      "Mitral valve (device should not impinge)", "Pericardium",
    ],
    doppler: [
      { label: "Color Doppler (peridevice)", detail: "Peridevice leak — jet width >5 mm = significant. Assess at all angles" },
      { label: "MV Color (post-deployment)", detail: "Confirm no device impingement on MV" },
    ],
    tips: [
      "PASS criteria: Position (ostium covered), Anchor (tug test), Size (8–20% compression), Seal (no significant leak)",
      "Peridevice leak <5 mm is acceptable — >5 mm requires repositioning",
      "Device too deep = incomplete seal; too shallow = embolisation risk",
      "Amulet has two components (lobe + disc) — confirm both are deployed correctly",
    ],
    pitfalls: [
      "Device embolisation: loss of device position — requires retrieval",
      "Pericardial effusion post-deployment = perforation — monitor for tamponade",
      "Peridevice leak can be underestimated at a single angle — assess all four angles",
    ],
    measurements: [
      "Device compression (%)",
      "Peridevice leak jet width (target <5 mm)",
      "Pericardial effusion size",
    ],
    criticalFindings: [
      "Device embolisation (loss of position — emergency retrieval)",
      "Cardiac tamponade (pericardial effusion + haemodynamic compromise)",
      "Peridevice leak >5 mm (significant — consider repositioning)",
    ],
  },
  // ── ASD / PFO Closure ────────────────────────────────────────────────────────
  {
    id: "asd-sizing",
    group: "ASD / PFO Closure",
    groupColor: "#0891b2",
    name: "ASD / PFO — Sizing and Rims",
    modality: "TEE / ICE",
    phase: "Pre-procedure / Sizing",
    description: "ASD sizing requires measurement of the defect diameter and assessment of all rims (aortic, superior vena cava, inferior vena cava, posterior, and mitral valve rims). A deficient aortic rim (<5 mm) is common and acceptable; other deficient rims increase device embolisation risk.",
    howToGet: [
      "ME Bicaval (90–110°): SVC and IVC rims, defect length",
      "ME 4-chamber (0°): MV rim and posterior rim",
      "ME AV SAX (30–45°): aortic rim",
      "3D TEE en face view: true defect shape and area",
      "Measure all rims: aortic, SVC, IVC, posterior, MV",
    ],
    structures: [
      "Interatrial septum (fossa ovalis)", "ASD / PFO tunnel",
      "Aortic root (anterior rim)", "SVC (superior rim)", "IVC (inferior rim)",
      "Mitral valve (inferior-anterior rim)", "Pulmonary veins",
    ],
    doppler: [
      { label: "Color IAS", detail: "Left-to-right shunt — confirm location and size" },
      { label: "Qp/Qs estimation", detail: "RVOT VTI × RVOT area / LVOT VTI × LVOT area — Qp/Qs >1.5 = significant shunt" },
      { label: "PV Doppler", detail: "Confirm all four pulmonary veins drain to LA — exclude PAPVD" },
    ],
    tips: [
      "Aortic rim deficiency (<5 mm) is present in ~80% of ASDs — not a contraindication",
      "Multiple defects (fenestrated ASD) may require a larger device or multiple devices",
      "PFO: measure tunnel length and width — longer tunnels may need different devices",
      "Balloon sizing (stop-flow technique) gives the stretched diameter for device selection",
    ],
    pitfalls: [
      "Lipomatous hypertrophy of IAS can be mistaken for a thick rim — use color Doppler",
      "Partial anomalous pulmonary venous drainage (PAPVD) must be excluded before ASD closure",
      "Sinus venosus ASD is near the SVC — not suitable for transcatheter closure",
    ],
    measurements: [
      "ASD diameter (maximum, 2D and 3D)",
      "All rim measurements (aortic, SVC, IVC, posterior, MV)",
      "Qp/Qs ratio",
      "Balloon-stretched diameter (if performed)",
    ],
    criticalFindings: [
      "Sinus venosus ASD (not suitable for device closure)",
      "Multiple deficient rims (high embolisation risk)",
      "PAPVD (requires surgical correction)",
    ],
  },
  {
    id: "asd-deployment",
    group: "ASD / PFO Closure",
    groupColor: "#0891b2",
    name: "ASD / PFO — Device Deployment",
    modality: "TEE / ICE",
    phase: "Intra-procedure",
    description: "ASD/PFO device deployment is guided by TEE or ICE. The LA disc is deployed first, then pulled back to the IAS, followed by RA disc deployment. Confirm both discs are on correct sides of the IAS before release.",
    howToGet: [
      "ME 4-chamber (0°): confirms LA disc fully open in LA",
      "ME Bicaval (90°): confirms device straddles the IAS correctly",
      "Tug test: device should not move with gentle traction",
      "Color Doppler: confirm no residual shunt after deployment",
      "Confirm no impingement on SVC, IVC, MV, or aortic root",
    ],
    structures: [
      "ASD/PFO device (LA disc, RA disc, waist)",
      "IAS", "Aortic root", "SVC", "IVC", "Mitral valve",
    ],
    doppler: [
      { label: "Color IAS (post-deployment)", detail: "Residual shunt — small residual shunts often close within 3–6 months" },
      { label: "MV Color", detail: "Confirm no device impingement on MV causing MR" },
    ],
    tips: [
      "LA disc should be larger than RA disc — confirm correct orientation",
      "Device waist should sit within the defect — not protruding into either atrium",
      "Small residual shunts at deployment often close as device endothelialises",
      "ICE can replace TEE for ASD/PFO closure — avoids general anaesthesia",
    ],
    pitfalls: [
      "Device embolisation: LA disc not fully open — do not release until confirmed",
      "Aortic erosion (rare): device too close to aortic root — check aortic rim",
      "MV impingement: device too inferior — reposition before release",
    ],
    measurements: [
      "Residual shunt (none/trivial/small/moderate/large)",
      "Device position relative to aortic root, SVC, IVC, MV",
    ],
    criticalFindings: [
      "Device embolisation (emergency retrieval)",
      "Aortic root impingement (erosion risk — reposition)",
      "New MR from device impingement on MV",
    ],
  },
  // ── Tricuspid TEER ───────────────────────────────────────────────────────────
  {
    id: "tteer-guidance",
    group: "Tricuspid TEER",
    groupColor: "#16a34a",
    name: "Tricuspid TEER — Clip Guidance",
    modality: "TEE / ICE",
    phase: "Intra-procedure",
    description: "Tricuspid TEER (TriClip/CLASP) requires TEE guidance for transseptal puncture, clip delivery, and grasping of the tricuspid valve leaflets. The A4C and RV-focused views are primary; 3D TEE provides en face TV assessment.",
    howToGet: [
      "ME 4-chamber (0°): primary view for clip positioning and TV assessment",
      "RV inflow (ME RV inflow, ~110°): shows anterior and posterior TV leaflets",
      "3D TEE en face view: 'surgeon's view' of TV — confirms clip orientation",
      "Confirm clip perpendicular to TV coaptation line",
      "After grasping: assess residual TR and mean TV gradient",
    ],
    structures: [
      "Tricuspid valve (anterior, posterior, septal leaflets)",
      "Right atrium", "Right ventricle", "Clip arms",
    ],
    doppler: [
      { label: "TR Color (post-grasp)", detail: "Residual TR — target ≤1+. Assess vena contracta and jet area" },
      { label: "TV Mean Gradient (post-grasp)", detail: "Mean gradient — target <3 mmHg. Higher = iatrogenic TS" },
      { label: "Hepatic vein Doppler", detail: "Systolic reversal resolves with successful TR reduction" },
    ],
    tips: [
      "TV anatomy is more complex than MV — anterior leaflet is largest, septal is smallest",
      "A/S coaptation zone is most common target for TriClip",
      "Residual TR ≤1+ is the target — TV gradient must be monitored",
      "RV function should be assessed before and after — severe RV dysfunction is a contraindication",
    ],
    pitfalls: [
      "TV imaging is more challenging than MV — use multiple planes and 3D",
      "Chordal entanglement is more common in TV than MV",
      "Leaflet tear with severe TR = emergency surgery",
    ],
    measurements: [
      "Residual TR grade (target ≤1+)",
      "Mean TV gradient (target <3 mmHg)",
      "TV area post-clip",
      "RV function (TAPSE, S' velocity)",
    ],
    criticalFindings: [
      "Residual TR ≥3+ (insufficient reduction)",
      "Mean TV gradient >3 mmHg (iatrogenic TS)",
      "Leaflet tear with severe TR",
      "RV failure post-procedure",
    ],
  },
  // ── TMVR ─────────────────────────────────────────────────────────────────────
  {
    id: "tmvr-sizing",
    group: "TMVR",
    groupColor: "#be185d",
    name: "TMVR — Sizing and LVOTO Assessment",
    modality: "TEE",
    phase: "Pre-procedure / Sizing",
    description: "Transcatheter mitral valve replacement (TMVR) requires careful sizing of the mitral annulus and assessment of neo-LVOTO risk. The anterior mitral leaflet (AML) is displaced into the LVOT after TMVR — CT-based neo-LVOTO prediction is essential.",
    howToGet: [
      "ME 4-chamber (0°): MV annulus diameter (medial-lateral)",
      "ME 2-chamber (90°): MV annulus diameter (anterior-posterior)",
      "ME LAX (120–135°): LVOT diameter and AML length",
      "3D TEE: annulus area and perimeter for device sizing",
      "Assess subvalvular apparatus: chordal anatomy, PM position",
    ],
    structures: [
      "Mitral annulus", "Anterior mitral leaflet (AML)", "Posterior mitral leaflet (PML)",
      "LVOT", "Papillary muscles", "Chordae tendineae",
    ],
    doppler: [
      { label: "LVOT PW/CW (baseline)", detail: "Baseline LVOT gradient — compare to predicted neo-LVOTO" },
      { label: "MV Color (baseline)", detail: "Baseline MR severity and mechanism" },
      { label: "MV Mean Gradient (baseline)", detail: "Baseline mean gradient — especially important in mitral stenosis" },
    ],
    tips: [
      "Neo-LVOTO is the most feared complication of TMVR — CT prediction is mandatory",
      "AML length and LVOT diameter determine neo-LVOTO risk",
      "Alcohol septal ablation (LAMPOON procedure) may be needed to prevent neo-LVOTO",
      "Annulus calcification (MAC) is the most common indication for TMVR",
    ],
    pitfalls: [
      "2D annulus measurements underestimate true annulus size — use 3D",
      "Heavy MAC can shadow the annulus — use CT for definitive sizing",
      "Subvalvular apparatus must be assessed — complex chordal anatomy increases procedural risk",
    ],
    measurements: [
      "MV annulus diameter (medial-lateral and AP)",
      "MV annulus area and perimeter (3D)",
      "AML length",
      "LVOT diameter",
      "Predicted neo-LVOTO gradient (CT-based)",
    ],
    criticalFindings: [
      "Predicted neo-LVOTO >50 mmHg (high risk — consider LAMPOON or alternative)",
      "Severe subvalvular calcification (increased procedural complexity)",
      "Inadequate annular landing zone",
    ],
  },
];

const GROUPS = [
  { key: "TAVR",                    label: "TAVR",                    color: "#189aa1" },
  { key: "TEER / MitraClip",        label: "TEER / MitraClip",        color: "#7c3aed" },
  { key: "LAAO (Watchman / Amulet)", label: "LAAO (Watchman/Amulet)", color: "#d97706" },
  { key: "ASD / PFO Closure",       label: "ASD / PFO Closure",       color: "#0891b2" },
  { key: "Tricuspid TEER",          label: "Tricuspid TEER",          color: "#16a34a" },
  { key: "TMVR",                    label: "TMVR",                    color: "#be185d" },
];

// ─── VIEW DETAIL COMPONENT ────────────────────────────────────────────────────
function ViewDetail({ view }: { view: typeof SH_VIEWS[0] }) {
  const groupColor = GROUPS.find(g => g.key === view.group)?.color ?? BRAND;
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
        <div className="px-5 py-4" style={{ background: groupColor + "0d", borderBottom: `1px solid ${groupColor}25` }}>
          <div className="flex items-start gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: groupColor + "18", color: groupColor }}>{view.group}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: groupColor + "18", color: groupColor }}>{view.modality}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: groupColor + "18", color: groupColor }}>{view.phase}</span>
              </div>
              <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{view.name}</h2>
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

      {/* Structures */}
      <div className="rounded-xl bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Structures / Anatomy</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {view.structures.map((s, i) => (
            <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
              <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: groupColor }} />
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* How to get */}
      <div className="rounded-xl bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Acquisition Steps</p>
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
                <span className="text-xs font-semibold min-w-[140px] flex-shrink-0" style={{ color: groupColor }}>{d.label}</span>
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
export default function StructuralHeartScanCoach() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const [selectedViewId, setSelectedViewId] = useState<string>(
    SH_VIEWS.find(v => v.id === _viewParam)?.id ?? SH_VIEWS[0].id
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["TAVR"])
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const { mergeView, overrideMap } = useScanCoachOverrides("structural");
  const selectedView = useMemo(() => {
    const raw = SH_VIEWS.find(v => v.id === selectedViewId) ?? SH_VIEWS[0];
    return mergeView(raw as any);
  }, [selectedViewId, mergeView, overrideMap]);

  const groupColor = GROUPS.find(g => g.key === selectedView.group)?.color ?? BRAND;

  return (
    <Layout>
      <ScanCoachNavBar navigatorPath="/device" navigatorLabel="Device Navigator" />
{/* Main Layout */}
      <PremiumOverlay featureName="Structural Heart ScanCoach™">
      <div className="container py-6">
        <div className="flex gap-5">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 hidden md:block">
            <div className="sticky top-4 space-y-2 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">Select Procedure</p>
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
                      {SH_VIEWS.filter(v => v.group === group.key).map(view => (
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
                  {SH_VIEWS.filter(v => v.group === group.key).map(view => (
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
