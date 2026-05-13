/*
  ICE ScanCoach — iHeartEcho™
  Interactive view-by-view ICE (Intracardiac Echocardiography) acquisition guide
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import ScanCoachNavBar from "@/components/ScanCoachNavBar";
import {
  Scan, ChevronDown, ChevronUp,
  Stethoscope, Zap, Info, AlertTriangle,
  CheckCircle, Target, RotateCcw, ArrowRight, BookOpen,
  Microscope
} from "lucide-react";

const BRAND = "#189aa1";

// ─── VIEW DATA ────────────────────────────────────────────────────────────────
const ICE_VIEWS = [
  {
    id: "home",
    group: "Standard ICE Views",
    groupColor: "#189aa1",
    name: "Home View",
    catheterPosition: "Mid right atrium, neutral position",
    rotation: "No rotation — neutral starting position",
    patientPosition: "Supine; catheter introduced via femoral vein, advanced to mid-RA",
    description: "The starting position for all ICE-guided procedures. The catheter is in the mid-right atrium in a neutral (no rotation) position. Provides a clear view of the tricuspid valve, RV inflow, and interatrial septum — the reference landmark for all subsequent views.",
    howToGet: [
      "Advance the ICE catheter via femoral vein to the mid-right atrium",
      "Position at approximately the level of the fossa ovalis",
      "Keep the catheter in neutral position — no anterior/posterior flexion, no rotation",
      "The tricuspid valve should appear on the right side of the screen",
      "The interatrial septum should be visible as a vertical structure",
    ],
    structures: [
      "Tricuspid valve (anterior, posterior, septal leaflets)",
      "Right ventricle (inflow)",
      "Interatrial septum",
      "Coronary sinus ostium",
      "Right atrium",
    ],
    doppler: [
      { label: "TV Color Doppler", detail: "TR assessment — vena contracta, jet area. Baseline TR before procedure" },
      { label: "IAS Color Doppler", detail: "Baseline shunt assessment — L→R or R→L across IAS" },
      { label: "CS Doppler", detail: "Confirm coronary sinus ostium location before CRT or ablation" },
    ],
    tips: [
      "This is your reference view — always return here if you are lost",
      "The TV is the most reliable landmark for catheter orientation",
      "Clockwise rotation advances toward the AV view; counterclockwise toward the posterior structures",
      "Document baseline TR before any procedure to distinguish procedure-related changes",
    ],
    pitfalls: [
      "If the TV is not visible, the catheter may be too high (SVC) or too low (IVC) — adjust depth",
      "Eustachian valve near IVC can be mistaken for a mass — use color Doppler",
    ],
    measurements: ["TV annulus diameter (baseline)", "IAS thickness", "RA size (qualitative)"],
    criticalFindings: ["Unexpected mass in RA", "Severe baseline TR", "Large pericardial effusion"],
  },
  {
    id: "avview",
    group: "Standard ICE Views",
    groupColor: "#189aa1",
    name: "Aortic Valve View",
    catheterPosition: "Mid right atrium, slight clockwise rotation",
    rotation: "Clockwise (CW) rotation from home view",
    patientPosition: "Supine; no change from home view position",
    description: "Obtained by clockwise rotation from the home view. Visualises the aortic valve, LVOT, and proximal ascending aorta. Critical for TAVR guidance, confirming device position relative to LVOT, and assessing AR post-deployment.",
    howToGet: [
      "From home view, apply gentle clockwise rotation",
      "The aortic valve will come into view — typically after 30–45° of rotation",
      "The LVOT should be visible below the AV",
      "Apply slight anterior flexion to optimize AV visualisation",
      "Confirm all three cusps are visible if possible",
    ],
    structures: [
      "Aortic valve (all cusps)",
      "LVOT",
      "Proximal ascending aorta",
      "Pulmonic valve (anterior)",
      "Right coronary cusp (most anterior)",
    ],
    doppler: [
      { label: "AV Color Doppler", detail: "AR assessment post-TAVR — peridevice vs. transdevice leak" },
      { label: "LVOT PW Doppler", detail: "LVOT VTI for stroke volume. Baseline before TAVR" },
      { label: "AR CW Doppler", detail: "AR PHT and pressure half-time for severity grading" },
    ],
    tips: [
      "Post-TAVR: assess for peridevice AR — color Doppler around the device frame",
      "LVOT obstruction: accelerated color Doppler signal in LVOT",
      "The right coronary cusp is most anterior — closest to the ICE catheter",
    ],
    pitfalls: [
      "Oblique cut through AV can create pseudo-bicuspid appearance",
      "Peridevice AR can be underestimated — use multiple planes and CW Doppler",
    ],
    measurements: ["AV peak velocity (CW)", "LVOT VTI", "AR vena contracta"],
    criticalFindings: ["Significant peridevice AR post-TAVR (≥mild)", "LVOT obstruction", "Coronary occlusion post-TAVR"],
  },
  {
    id: "mvlhview",
    group: "Standard ICE Views",
    groupColor: "#189aa1",
    name: "Mitral Valve / Left Heart View",
    catheterPosition: "Mid right atrium, further clockwise rotation; or RV for improved LA visualisation",
    rotation: "Further clockwise rotation from AV view; advance to RV if needed",
    patientPosition: "Supine; may need to advance catheter to RV for improved LA/MV visualisation",
    description: "Further clockwise rotation from the AV view. Visualises the mitral valve, left atrium, and pulmonary veins. The critical view for MitraClip guidance, mitral valve anatomy assessment, and LA monitoring during ablation procedures.",
    howToGet: [
      "From AV view, continue clockwise rotation",
      "The mitral valve will come into view — A2/P2 segments typically visible",
      "For improved LA visualisation, advance catheter to the RV",
      "From RV: slight posterior flexion brings the LA and MV into view",
      "Optimize to show the full MV coaptation line",
    ],
    structures: [
      "Mitral valve (A2/P2 segments primarily)",
      "Left atrium",
      "Left atrial appendage",
      "Left pulmonary veins (LSPV, LIPV)",
      "LV (posterior wall)",
    ],
    doppler: [
      { label: "MV Color Doppler", detail: "MR assessment — vena contracta, jet direction. Critical for MitraClip guidance" },
      { label: "MV CW Doppler", detail: "Post-MitraClip: mean MV gradient. >5 mmHg = iatrogenic MS" },
      { label: "PV PW Doppler", detail: "PV flow — blunted S wave = elevated LA pressure or severe MR" },
    ],
    tips: [
      "MitraClip: this is the primary guidance view — confirm clip position at A2/P2",
      "Advance to RV for a more perpendicular view of the MV — better for clip guidance",
      "LAA is best seen from this position — rotate slightly to open the LAA",
    ],
    pitfalls: [
      "A2/P2 segments are most visible — A1/A3 and P1/P3 require rotation",
      "Post-clip gradient: always measure mean MV gradient after each clip deployment",
    ],
    measurements: ["MV vena contracta", "Mean MV gradient (post-clip)", "MV coaptation gap"],
    criticalFindings: ["Residual MR ≥2+ post-MitraClip", "Iatrogenic MS (mean gradient >5 mmHg)", "Clip detachment"],
  },
  {
    id: "transseptal",
    group: "Standard ICE Views",
    groupColor: "#189aa1",
    name: "Transseptal View",
    catheterPosition: "Right atrium, posterior tilt (posterior flexion)",
    rotation: "Neutral to slight clockwise; posterior flexion applied",
    patientPosition: "Supine; catheter at mid-RA level with posterior flexion",
    description: "Posterior tilt from the home view. Provides the definitive view of the fossa ovalis for transseptal puncture guidance. Shows the tenting point of the needle, the relationship to surrounding structures, and confirms safe puncture site selection.",
    howToGet: [
      "From home view, apply posterior flexion (posterior tilt)",
      "The fossa ovalis will appear as a thin, mobile membrane in the IAS",
      "Apply slight clockwise rotation to center the fossa ovalis",
      "Confirm the tenting point is in the posterior-superior fossa for AF ablation",
      "Confirm inferior-posterior tenting for MitraClip access",
    ],
    structures: [
      "Fossa ovalis",
      "Tenting point (needle tip)",
      "Left atrium (posterior wall)",
      "Aortic root (anterior landmark — avoid)",
      "IAS superior and inferior margins",
    ],
    doppler: [
      { label: "IAS Color Doppler", detail: "Confirm transseptal crossing — LA color signal confirms successful puncture" },
      { label: "Post-puncture shunt", detail: "Small L→R shunt through transseptal site is normal" },
    ],
    tips: [
      "Posterior-superior tenting = ideal for AF ablation (posterior LA access)",
      "Inferior-posterior tenting = ideal for MitraClip (optimal transseptal height 3.5–4.5 cm)",
      "Aortic root is anterior — if tenting is anterior, reposition to avoid aortic puncture",
      "The 'tent' should be clearly visible before advancing the needle",
    ],
    pitfalls: [
      "Aortic tenting = dangerous — the needle is too anterior; reposition immediately",
      "Lipomatous hypertrophy of IAS can make transseptal puncture difficult — plan accordingly",
      "Always confirm LA position with color Doppler or pressure after puncture",
    ],
    measurements: ["Transseptal height (for MitraClip: 3.5–4.5 cm)", "Fossa ovalis dimensions", "Tenting point location"],
    criticalFindings: ["Aortic tenting (anterior puncture risk)", "Posterior LA wall puncture", "Pericardial effusion post-puncture"],
  },
  {
    id: "laaview",
    group: "Standard ICE Views",
    groupColor: "#189aa1",
    name: "Left Atrial Appendage View",
    catheterPosition: "Right atrium, posterior tilt + slight clockwise rotation",
    rotation: "Slight clockwise from transseptal view with posterior flexion maintained",
    patientPosition: "Supine; same RA position as transseptal view",
    description: "Optimized view of the left atrial appendage for thrombus exclusion and LAA occlusion device sizing (WATCHMAN, Amulet). The most critical pre-procedural view before LAA occlusion. Requires multi-angle assessment to fully characterize LAA anatomy.",
    howToGet: [
      "From transseptal view, apply slight clockwise rotation",
      "The LAA will appear as a finger-like projection from the LA",
      "Assess the LAA at multiple equivalent planes (0°, 45°, 90°, 135° equivalent)",
      "Rotate the catheter to visualise the full LAA depth and all lobes",
      "Identify the left upper pulmonary vein (LUPV) as the posterior landmark",
    ],
    structures: [
      "LAA ostium",
      "LAA body and lobes",
      "LAA landing zone",
      "Left upper pulmonary vein (posterior landmark)",
      "Circumflex artery (posterior to LAA)",
    ],
    doppler: [
      { label: "LAA Color Doppler", detail: "Confirm absence of thrombus — color flow throughout LAA" },
      { label: "LAA PW Doppler", detail: "LAA emptying velocity. <20 cm/s = high thrombus risk. Normal >40 cm/s" },
      { label: "Peridevice leak", detail: "Post-WATCHMAN: color Doppler around device. <5 mm acceptable; ≥5 mm = recapture" },
    ],
    tips: [
      "Measure LAA ostium at multiple planes — report the largest diameter for device sizing",
      "Landing zone depth ≥10 mm required for most devices (WATCHMAN, Amulet)",
      "Pectinate muscles are normal — do not confuse with thrombus",
      "Circumflex artery runs posterior to LAA — avoid compression with device",
    ],
    pitfalls: [
      "LAA lobes can mimic thrombus — use color Doppler and multiple planes",
      "Single-plane measurement underestimates true LAA ostium — always use multiple planes",
      "LUPV can be mistaken for LAA — confirm with color Doppler (PV flow vs. LAA flow)",
    ],
    measurements: [
      "LAA ostium diameter (max, at multiple planes)",
      "LAA landing zone depth (≥10 mm required)",
      "LAA emptying velocity",
      "Peridevice leak (post-procedure)",
    ],
    criticalFindings: ["LAA thrombus (procedure contraindicated)", "LAA ostium >31 mm (outside WATCHMAN range)", "Peridevice leak ≥5 mm"],
  },
  {
    id: "esophagusview",
    group: "Standard ICE Views",
    groupColor: "#189aa1",
    name: "Esophagus View",
    catheterPosition: "Right atrium, posterior tilt with slight clockwise rotation",
    rotation: "Slight clockwise rotation from home view; posterior flexion",
    patientPosition: "Supine; standard RA position",
    description: "The esophagus view identifies the esophagus in relation to the posterior left atrium. Critical for ablation procedures to avoid esophageal injury (atrio-esophageal fistula). Used to monitor esophageal proximity during posterior LA ablation and to guide esophageal temperature monitoring catheter placement.",
    howToGet: [
      "From the home view, apply slight clockwise rotation and posterior flexion",
      "The esophagus appears as a round, hyperechoic structure posterior to the LA",
      "Use color Doppler to distinguish from vascular structures (no flow in esophagus)",
      "Note the distance between the LA posterior wall and the esophagus",
      "Mark esophageal position relative to planned ablation lines",
    ],
    structures: [
      "Esophagus (posterior to LA)",
      "LA posterior wall",
      "Descending thoracic aorta",
      "Posterior pericardium",
    ],
    doppler: [
      { label: "Color Doppler", detail: "No color signal in esophagus — confirms it is not a vascular structure" },
    ],
    tips: [
      "Esophagus is typically posterior and slightly left of midline relative to the LA",
      "Distance <5 mm from LA posterior wall = high risk for esophageal injury during ablation",
      "Esophageal temperature probe placement: confirm probe is within the esophageal lumen",
      "The esophagus moves with swallowing — observe for peristalsis to confirm identification",
    ],
    pitfalls: [
      "Do not confuse the descending aorta with the esophagus — aorta has color Doppler flow",
      "Esophageal position varies between patients and can shift during the procedure",
      "Posterior pericardial fat can mimic esophageal tissue",
    ],
    measurements: ["LA posterior wall to esophagus distance (mm)", "Esophageal diameter (mm)"],
    criticalFindings: ["Esophagus <5 mm from LA posterior wall (high injury risk)", "Esophageal temperature probe malposition"],
  },
  {
    id: "leftpvview",
    group: "Standard ICE Views",
    groupColor: "#189aa1",
    name: "Left Pulmonary Veins View",
    catheterPosition: "Right atrium, counterclockwise rotation from transseptal view",
    rotation: "Counterclockwise (CCW) rotation — LSPV appears first, then LIPV with further CCW",
    patientPosition: "Supine; same RA position as transseptal view",
    description: "Visualises the left-sided pulmonary vein ostia (LSPV and LIPV) for ablation guidance and post-procedure assessment. Used to confirm catheter/balloon position at left PV ostia during ablation and to assess for left PV stenosis post-ablation.",
    howToGet: [
      "From the transseptal view, apply counterclockwise (CCW) rotation",
      "The left superior pulmonary vein (LSPV) will appear first — it enters the LA at the upper left",
      "Continue CCW rotation to bring the left inferior pulmonary vein (LIPV) into view",
      "Use color Doppler to confirm PV flow direction (into LA)",
      "Measure LSPV and LIPV ostium diameters at baseline for post-ablation comparison",
      "Note the left PV carina (ridge between LSPV and LIPV)",
    ],
    structures: [
      "Left superior pulmonary vein (LSPV)",
      "Left inferior pulmonary vein (LIPV)",
      "Left PV carina",
      "LA posterior wall (left side)",
      "Left atrial appendage (LAA) — adjacent landmark",
    ],
    doppler: [
      { label: "Left PV Color Doppler", detail: "Confirm PV flow into LA. Post-ablation: turbulent or aliased flow suggests stenosis" },
      { label: "Left PV PW Doppler", detail: "PV velocity. Normal <1.0 m/s. >1.2 m/s post-ablation = significant stenosis" },
    ],
    tips: [
      "LSPV is the easiest left-sided PV to find — start here",
      "The LAA is a useful adjacent landmark when searching for the left PVs",
      "Post-ablation: compare left PV diameters to baseline — >50% reduction = significant stenosis",
      "Ablation catheter position: confirm tip is at left PV ostium, not inside the vein",
      "Left PV carina ablation requires careful monitoring — narrow ridge increases injury risk",
    ],
    pitfalls: [
      "LIPV can be difficult to visualise if the catheter is not advanced far enough",
      "Left PV stenosis can develop weeks to months post-ablation — not always immediate",
      "Do not confuse the LAA with the LSPV — LAA has a trabeculated appearance",
    ],
    measurements: ["LSPV ostium diameter (baseline and post-ablation)", "LIPV ostium diameter (baseline and post-ablation)", "Left PV peak velocity (post-ablation)"],
    criticalFindings: ["Left PV stenosis post-ablation (velocity >1.2 m/s)", "Ablation catheter inside left PV (not at ostium)", "Left PV occlusion"],
  },
  {
    id: "rightpvview",
    group: "Standard ICE Views",
    groupColor: "#189aa1",
    name: "Right Pulmonary Veins View",
    catheterPosition: "Right atrium, clockwise rotation from transseptal view",
    rotation: "Clockwise (CW) rotation from transseptal view — RSPV appears first, then RIPV with further CW",
    patientPosition: "Supine; same RA position as transseptal view",
    description: "Visualises the right-sided pulmonary vein ostia (RSPV and RIPV) for ablation guidance and post-procedure assessment. The right PVs are typically more challenging to visualise than the left PVs due to their posterior-lateral position. Used to confirm catheter/balloon position at right PV ostia and to assess for right PV stenosis post-ablation.",
    howToGet: [
      "From the transseptal view, apply clockwise (CW) rotation",
      "The right superior pulmonary vein (RSPV) will appear first",
      "Continue CW rotation to bring the right inferior pulmonary vein (RIPV) into view",
      "Slight probe advancement may be needed to optimise right PV visualisation",
      "Use color Doppler to confirm PV flow direction (into LA)",
      "Measure RSPV and RIPV ostium diameters at baseline for post-ablation comparison",
    ],
    structures: [
      "Right superior pulmonary vein (RSPV)",
      "Right inferior pulmonary vein (RIPV)",
      "Right PV carina",
      "LA posterior wall (right side)",
      "Right atrium (adjacent)",
      "Superior vena cava (SVC) — adjacent landmark for RSPV",
    ],
    doppler: [
      { label: "Right PV Color Doppler", detail: "Confirm PV flow into LA. Post-ablation: turbulent or aliased flow suggests stenosis" },
      { label: "Right PV PW Doppler", detail: "PV velocity. Normal <1.0 m/s. >1.2 m/s post-ablation = significant stenosis" },
    ],
    tips: [
      "RSPV is adjacent to the SVC — use the SVC as a landmark to locate RSPV",
      "The RIPV is the most posterior and can be the hardest right PV to visualise",
      "Post-ablation: compare right PV diameters to baseline — >50% reduction = significant stenosis",
      "Ablation catheter position: confirm tip is at right PV ostium, not inside the vein",
      "Slight probe advancement combined with CW rotation often improves RIPV visualisation",
    ],
    pitfalls: [
      "RSPV is hardest to visualise — may need probe advancement or additional rotation",
      "Do not confuse the SVC with the RSPV — SVC is more superior and drains into the RA",
      "Right PV stenosis can develop weeks to months post-ablation — not always immediate",
      "RIPV occlusion is the most common post-ablation PV stenosis — monitor carefully",
    ],
    measurements: ["RSPV ostium diameter (baseline and post-ablation)", "RIPV ostium diameter (baseline and post-ablation)", "Right PV peak velocity (post-ablation)"],
    criticalFindings: ["Right PV stenosis post-ablation (velocity >1.2 m/s)", "Ablation catheter inside right PV (not at ostium)", "Right PV occlusion"],
  },

  {
    id: "pericardialview",
    group: "Standard ICE Views",
    groupColor: "#189aa1",
    name: "Pericardial Monitoring View",
    catheterPosition: "Right ventricle, posterior orientation",
    rotation: "Advance catheter to RV; posterior flexion to visualise pericardial space",
    patientPosition: "Supine; catheter advanced from RA through TV into RV",
    description: "The catheter is advanced into the right ventricle and directed posteriorly to visualise the pericardial space. This is the primary view for continuous pericardial effusion monitoring during high-risk procedures. Any new echo-free space requires immediate attention.",
    howToGet: [
      "Advance ICE catheter from RA through tricuspid valve into RV",
      "Apply posterior flexion to direct the beam toward the pericardial space",
      "The LV posterior wall and pericardium should be visible",
      "Optimize gain to detect small effusions",
      "Maintain this view throughout high-risk procedural steps",
    ],
    structures: [
      "Pericardial space (posterior and lateral)",
      "LV posterior wall",
      "RV free wall",
      "Descending thoracic aorta (posterior landmark)",
      "Pleural space (distinguish from pericardial)",
    ],
    doppler: [
      { label: "Pericardial Color Doppler", detail: "Confirm echo-free space is not vascular — no color signal in true effusion" },
    ],
    tips: [
      "Monitor continuously during transseptal puncture, LAA occlusion, and ablation",
      "Any new echo-free space >5 mm = alert proceduralist immediately",
      "Descending aorta is posterior to the heart — do not confuse with pericardial effusion",
      "Pleural effusion is outside the pericardium — descending aorta is between them",
    ],
    pitfalls: [
      "Pleural vs. pericardial effusion: pericardial effusion is anterior to descending aorta; pleural is posterior",
      "Small physiologic effusion (<5 mm) is normal — document at baseline",
      "Rapid accumulation of even small effusion = tamponade risk — act quickly",
    ],
    measurements: ["Pericardial effusion depth (mm)", "Location (anterior, posterior, lateral)", "Change from baseline"],
    criticalFindings: ["New pericardial effusion >5 mm", "Rapidly expanding effusion (tamponade)", "Hemopericardium"],
  },
];

// ─── VIEW DETAIL PANEL ────────────────────────────────────────────────────────
function ViewDetail({ view }: { view: typeof ICE_VIEWS[0] }) {
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
        <div className="flex items-start gap-3">
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
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { label: "Catheter Position", value: view.catheterPosition },
            { label: "Rotation", value: view.rotation },
            { label: "Patient Position", value: view.patientPosition },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/10 rounded-lg px-3 py-2">
              <div className="text-[10px] text-white/60 font-medium">{label}</div>
              <div className="text-xs text-white font-semibold mt-0.5 leading-snug">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Reference Images — shown when admin has uploaded via ScanCoach Editor */}
      {((view as any).echoImageUrl || (view as any).anatomyImageUrl) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-800">Reference Images</p>
          </div>
          <div className={`bg-gray-950 grid gap-2 p-4 ${
            [(view as any).echoImageUrl, (view as any).anatomyImageUrl].filter(Boolean).length > 1
              ? 'grid-cols-2'
              : 'grid-cols-1'
          }`}>
            {(view as any).echoImageUrl && (
              <div>
                <p className="text-[10px] text-gray-400 mb-1 font-medium">Echo Image</p>
                <img
                  src={(view as any).echoImageUrl}
                  alt="Echo reference"
                  className="max-h-64 object-contain rounded-lg w-full"
                  onContextMenu={e => e.preventDefault()}
                />
              </div>
            )}
            {(view as any).anatomyImageUrl && (
              <div>
                <p className="text-[10px] text-gray-400 mb-1 font-medium">Anatomy Diagram</p>
                <img
                  src={(view as any).anatomyImageUrl}
                  alt="Anatomy diagram"
                  className="max-h-64 object-contain rounded-lg w-full"
                  onContextMenu={e => e.preventDefault()}
                />
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
            <ArrowRight className="w-4 h-4" style={{ color: view.groupColor }} />
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
/** Embeddable ICE ScanCoach content (no Layout wrapper) — used in ScanCoach tab */
export function ICEScanCoachContent() {
  const [selectedViewId, setSelectedViewId] = useState<string>(ICE_VIEWS[0].id);
  const _selectedViewRaw = ICE_VIEWS.find(v => v.id === selectedViewId) ?? ICE_VIEWS[0];
  const { mergeView: mergeICEView } = useScanCoachOverrides("ice");
  const selectedView = useMemo(() => mergeICEView(_selectedViewRaw as any), [_selectedViewRaw, mergeICEView]);
  return (
    <div className="container py-6">
      <div className="flex gap-5">
        {/* View Selector Sidebar */}
        <div className="w-56 flex-shrink-0 hidden md:block">
          <div className="sticky top-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">Select View</p>
            <div className="space-y-0.5">
              {ICE_VIEWS.map(view => (
                <button
                  key={view.id}
                  onClick={() => setSelectedViewId(view.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2"
                  style={{
                    background: selectedViewId === view.id ? BRAND + "15" : "transparent",
                    color: selectedViewId === view.id ? BRAND : "#374151",
                    fontWeight: selectedViewId === view.id ? 700 : 400,
                    borderLeft: selectedViewId === view.id ? `3px solid ${BRAND}` : "3px solid transparent",
                  }}
                >
                  <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  {view.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Mobile dropdown */}
        <div className="md:hidden mb-4 w-full">
          <select
            value={selectedViewId}
            onChange={e => setSelectedViewId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            {ICE_VIEWS.map(view => (
              <option key={view.id} value={view.id}>{view.name}</option>
            ))}
          </select>
        </div>
        {/* View Detail Panel */}
        <div className="flex-1 min-w-0">
          <ViewDetail view={selectedView} />
        </div>
      </div>
    </div>
  );
}

export default function ICEScanCoach() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const [selectedViewId, setSelectedViewId] = useState<string>(
    ICE_VIEWS.find(v => v.id === _viewParam)?.id ?? ICE_VIEWS[0].id
  );

  const _selectedViewRaw = ICE_VIEWS.find(v => v.id === selectedViewId) ?? ICE_VIEWS[0];
  const { mergeView: mergeICEView } = useScanCoachOverrides("ice");
  const selectedView = useMemo(() => mergeICEView(_selectedViewRaw as any), [_selectedViewRaw, mergeICEView]);

  return (
    <Layout>
      <ScanCoachNavBar navigatorPath="/ice" navigatorLabel="ICE Navigator" />
{/* Main Layout */}
      <PremiumOverlay featureName="ICE ScanCoach™">
      <div className="container py-6">
        <div className="flex gap-5">
          {/* View Selector Sidebar */}
          <div className="w-56 flex-shrink-0 hidden md:block">
            <div className="sticky top-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">Select View</p>
              <div className="space-y-0.5">
                {ICE_VIEWS.map(view => (
                  <button
                    key={view.id}
                    onClick={() => setSelectedViewId(view.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2"
                    style={{
                      background: selectedViewId === view.id ? BRAND + "15" : "transparent",
                      color: selectedViewId === view.id ? BRAND : "#374151",
                      fontWeight: selectedViewId === view.id ? 700 : 400,
                      borderLeft: selectedViewId === view.id ? `3px solid ${BRAND}` : "3px solid transparent",
                    }}
                  >
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                    {view.name}
                  </button>
                ))}
              </div>

              {/* ICE Rotation Guide */}
              <div className="mt-6 rounded-xl p-4" style={{ background: BRAND + "08", border: `1px solid ${BRAND}20` }}>
                <p className="text-xs font-bold mb-2" style={{ color: BRAND }}>ICE Rotation Guide</p>
                <div className="space-y-1.5 text-[11px] text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#189aa1]" />
                    <span><strong>CW rotation</strong> → anterior structures (AV, MV)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#189aa1]" />
                    <span><strong>CCW rotation</strong> → posterior structures (PV, CS)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#189aa1]" />
                    <span><strong>Posterior flex</strong> → IAS, fossa ovalis, LAA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#7c3aed]" />
                    <span><strong>Advance to RV</strong> → pericardial monitoring</span>
                  </div>
                </div>
              </div>
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
              {ICE_VIEWS.map(view => (
                <option key={view.id} value={view.id}>{view.name}</option>
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
