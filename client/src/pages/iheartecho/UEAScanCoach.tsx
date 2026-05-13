/*
  UEA ScanCoach — iHeartEcho™
  Ultrasound Enhancing Agents — Contrast Echo Acquisition Guide
  View-by-view probe guidance, machine optimization, injection technique,
  artifact recognition, and pitfall avoidance.
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import ScanCoachNavBar from "@/components/ScanCoachNavBar";
import {
  Droplets, ChevronDown, ChevronUp, Info, AlertTriangle,
  Target, CheckCircle, RotateCcw, ArrowRight, Stethoscope,
  Zap, Eye, Activity, Shield, BookOpen
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA  = "#4ad9e0";

// ─── VIEW DATA ────────────────────────────────────────────────────────────────

const UEA_VIEWS = [
  {
    id: "plax",
    group: "Parasternal",
    groupColor: BRAND,
    name: "Parasternal Long Axis (PLAX)",
    patientPosition: "Left lateral decubitus, left arm raised above head to open intercostal spaces",
    probePosition: "2nd–4th left intercostal space, left sternal border; indicator toward right shoulder",
    probeOrientation: "Long axis of heart; align IVS and posterior wall parallel to screen",
    description: "The PLAX view provides excellent visualisation of the anterior septum, posterior wall, and LV outflow tract. With contrast, it is particularly valuable for identifying apical thrombus extending into the mid-cavity and for delineating the subvalvular apparatus.",
    howToGet: [
      "Position patient in steep left lateral decubitus with left arm raised",
      "Place probe at 2nd–4th left intercostal space, left sternal border",
      "Indicator toward right shoulder (10–11 o'clock position)",
      "Activate contrast-specific imaging mode (low MI 0.1–0.2)",
      "Reduce gain 30–50% from standard settings",
      "Adjust depth to include full LV — contrast fills apex last",
      "Optimize to show IVS and posterior wall parallel to screen",
    ],
    structures: [
      "LV anterior septum and posterior wall",
      "Mitral valve (anterior and posterior leaflets)",
      "Aortic valve and LVOT",
      "Aortic root and proximal ascending aorta",
      "Left atrium",
      "Right ventricular outflow tract (anterior)",
    ],
    contrastTips: [
      "Contrast fills LV cavity from base to apex — wait for complete opacification before assessing",
      "Anterior septum and posterior wall are well-delineated with contrast — ideal for wall thickness measurement",
      "Subvalvular apparatus (chordae, papillary muscles) becomes visible with contrast — useful for LVNC assessment",
      "Avascular thrombus appears as a filling defect — most commonly at apex but can extend into mid-cavity",
    ],
    pitfalls: [
      "Near-field artifact from high gain — reduce gain until LV cavity appears uniformly dark before contrast arrives",
      "Blooming artifact — over-gain causes contrast to appear to extend beyond endocardial border",
      "Shadowing from calcified MV or AV — reposition probe to avoid acoustic shadow",
      "Foreshortening — ensure IVS and posterior wall are truly parallel; oblique cuts underestimate LV size",
    ],
    artifacts: [
      { name: "Attenuation artifact", description: "Contrast in near field attenuates signal to far field — appears as acoustic shadow. Reduce gain or use harmonic imaging." },
      { name: "Blooming artifact", description: "Over-gain causes contrast to appear to spill beyond endocardial border. Reduce gain." },
      { name: "Reverb artifact", description: "Reverberation from high-MI imaging — reduce MI or use pulse inversion harmonic mode." },
    ],
    clinicalPearls: [
      "PLAX is the first view to obtain after contrast injection — confirms adequate LV opacification",
      "If PLAX is suboptimal, try moving probe one intercostal space lower",
      "Posterior wall motion is best assessed in PLAX — look for inferior wall hypokinesis (RCA territory)",
    ],
  },
  {
    id: "psax_mv",
    group: "Parasternal",
    groupColor: BRAND,
    name: "PSAX — Mitral Valve Level",
    patientPosition: "Left lateral decubitus, left arm raised; same position as PLAX",
    probePosition: "Same position as PLAX; rotate probe 90° clockwise (indicator toward left shoulder)",
    probeOrientation: "Short axis of LV at mitral valve level; 'fish-mouth' appearance of MV",
    description: "The PSAX at mitral valve level provides a true short-axis view of the LV at the base. With contrast, all six basal segments are clearly delineated, and the 'fish-mouth' opening of the mitral valve confirms correct level.",
    howToGet: [
      "From PLAX, rotate probe 90° clockwise — indicator toward left shoulder (2 o'clock)",
      "Tilt probe slightly inferiorly to obtain true circular LV cross-section",
      "Confirm 'fish-mouth' MV appearance — confirms mitral level",
      "Activate contrast mode and reduce gain",
      "Ensure all 6 segments are visible: anterior, anterolateral, inferolateral, inferior, inferoseptal, anteroseptal",
    ],
    structures: [
      "LV (6 basal segments)",
      "Mitral valve (anterior and posterior leaflets — 'fish-mouth')",
      "Papillary muscles (just below this level)",
      "RV (crescent-shaped, anterior)",
    ],
    contrastTips: [
      "All 6 basal segments should opacify uniformly — asymmetric opacification suggests WMA",
      "Contrast clearly delineates the circular LV lumen — ideal for area-based EF estimation",
      "Papillary muscles appear as filling defects within the contrast-filled LV — normal finding",
      "Circumferential perfusion defects are best appreciated at this level",
    ],
    pitfalls: [
      "Oblique cuts produce an elliptical rather than circular LV — rotate probe to obtain true short axis",
      "Too high (AV level) or too low (papillary level) — confirm 'fish-mouth' MV to ensure correct level",
      "Papillary muscles can mimic filling defects — confirm by moving to papillary level where they are more prominent",
    ],
    artifacts: [
      { name: "Lateral dropout", description: "Signal dropout at lateral walls due to probe angle — tilt probe to improve contact." },
      { name: "Near-field clutter", description: "RV anterior wall creates near-field artifact — reduce gain in near field." },
    ],
    clinicalPearls: [
      "Basal PSAX is the best view for identifying basal wall motion abnormalities",
      "LCx territory: anterolateral and inferolateral segments. LAD: anterior and anteroseptal. RCA: inferior and inferoseptal",
      "Circumferential ST-elevation MI (STEMI) pattern — all segments affected — consider LAD wrap or multivessel disease",
    ],
  },
  {
    id: "psax_pap",
    group: "Parasternal",
    groupColor: BRAND,
    name: "PSAX — Mid-Papillary Level",
    patientPosition: "Left lateral decubitus, left arm raised",
    probePosition: "Same as PSAX mitral; tilt probe slightly inferiorly to reveal papillary muscles",
    probeOrientation: "Short axis at mid-ventricular level; two papillary muscles visible as filling defects",
    description: "The mid-papillary PSAX is the single most important view for myocardial perfusion imaging (MPI). The two papillary muscles serve as anatomical landmarks, and the six mid-ventricular segments correspond to all three coronary territories. Flash-replenishment technique is performed at this level.",
    howToGet: [
      "From PSAX mitral level, tilt probe slightly inferiorly (toward patient's feet)",
      "Two papillary muscles appear as filling defects within the LV cavity",
      "Confirm circular LV cross-section with both papillary muscles visible",
      "For flash replenishment: send a high-MI pulse (1–2 frames) to destroy microbubbles",
      "Immediately switch back to low MI and observe bubble replenishment over 4–8 cardiac cycles",
      "Record cine loop of replenishment for offline analysis",
    ],
    structures: [
      "LV (6 mid-ventricular segments)",
      "Anterolateral papillary muscle (LCx territory)",
      "Posteromedial papillary muscle (RCA territory — dual supply in some patients)",
      "RV (crescent-shaped)",
    ],
    contrastTips: [
      "Flash replenishment: normal = uniform rapid replenishment within 4 cardiac cycles",
      "Delayed replenishment (4–8 cycles) = ischaemia or microvascular disease",
      "Absent replenishment = infarct (scar) — no viable myocardium",
      "Patchy or heterogeneous replenishment = microvascular disease or artifact",
      "Papillary muscles replenish more slowly than myocardium — do not misinterpret as perfusion defect",
    ],
    pitfalls: [
      "Papillary muscles are avascular structures — they appear as filling defects and do NOT replenish — this is NORMAL",
      "Off-axis imaging — oblique cuts create pseudo-perfusion defects; ensure true circular cross-section",
      "Inadequate contrast dose — insufficient bubble concentration prevents accurate perfusion assessment",
      "Patient movement during flash replenishment invalidates the replenishment curve",
    ],
    artifacts: [
      { name: "Flash artifact", description: "Bright flash from high-MI pulse is normal — do not confuse with pathology. Observe subsequent replenishment." },
      { name: "Shadowing from papillary muscles", description: "Papillary muscles can shadow the far wall — reposition probe slightly." },
      { name: "Rib shadow", description: "Rib shadow creates a fixed linear artifact — reposition probe to avoid." },
    ],
    clinicalPearls: [
      "Mid-papillary PSAX is the gold standard view for myocardial perfusion imaging",
      "Posteromedial papillary muscle has dual blood supply (LAD + RCA) — less vulnerable to ischaemia",
      "Anterolateral papillary muscle is supplied by LCx only — more vulnerable to ischaemia",
      "Papillary muscle rupture post-MI: contrast shows avascular papillary muscle with severe MR",
    ],
  },
  {
    id: "a4c",
    group: "Apical",
    groupColor: "#189aa1",
    name: "Apical 4-Chamber (A4C)",
    patientPosition: "Steep left lateral decubitus (60–90°); left arm raised above head; head of bed elevated 15–30°",
    probePosition: "Cardiac apex — typically 5th–6th intercostal space, midaxillary line; indicator toward left",
    probeOrientation: "4-chamber view; LV on right, RV on left of screen; apex at top",
    description: "The apical 4-chamber view is the most important view for contrast echocardiography. It provides the best visualisation of the LV apex (the most common site for thrombus), enables biplane EF calculation, and allows assessment of all apical and mid-ventricular segments. Steep left lateral positioning is essential.",
    howToGet: [
      "Position patient in steep left lateral decubitus — 60–90° tilt is essential",
      "Raise left arm above head to open intercostal spaces",
      "Palpate cardiac apex — typically 5th–6th ICS, midaxillary line",
      "Place probe at apex with indicator toward patient's left (3 o'clock)",
      "Tilt probe slightly anteriorly to open the apex",
      "Activate contrast mode (low MI 0.1–0.2); reduce gain significantly",
      "Adjust depth to include full LV — do NOT foreshorten the apex",
      "Wait for complete LV opacification before acquiring cine loops",
    ],
    structures: [
      "LV (apical, mid, and basal segments — lateral and septal walls)",
      "RV (apical, mid, and basal segments)",
      "Mitral valve",
      "Tricuspid valve",
      "Left atrium and right atrium",
      "LV apex (critical for thrombus assessment)",
    ],
    contrastTips: [
      "LV apex is the last region to opacify — wait for complete apical filling before assessing for thrombus",
      "Apical thrombus: avascular filling defect at apex — does NOT enhance with contrast",
      "Apical HCM: spade-shaped cavity with apical obliteration — contrast dramatically improves diagnosis",
      "LVNC: deep trabecular recesses fill with contrast — NC:C ratio >2.3 (systole) supports diagnosis",
      "Takotsubo: apical ballooning with basal hyperkinesis — contrast confirms extent of apical akinesis",
      "Biplane EF: trace endocardial border at end-diastole and end-systole — contrast improves accuracy by 15–20%",
    ],
    pitfalls: [
      "Foreshortening — most common error. Ensure apex is at top of screen; move probe laterally if needed",
      "Near-field artifact — high gain causes bright artifact near probe; reduce gain to avoid pseudo-thrombus",
      "Apical dropout — signal dropout at apex can mimic thrombus; use contrast to confirm",
      "Inadequate left lateral positioning — supine position causes LV to fall away from chest wall",
    ],
    artifacts: [
      { name: "Near-field clutter", description: "Bright artifact near probe tip mimics thrombus. Reduce gain — true thrombus persists; artifact disappears." },
      { name: "Apical dropout", description: "Signal dropout at apex due to beam angle. Contrast fills the cavity and eliminates this artifact." },
      { name: "Side-lobe artifact", description: "Side lobes from strong reflectors (MV annulus) project into LV cavity. Contrast confirms true cavity filling." },
    ],
    clinicalPearls: [
      "Contrast increases sensitivity for apical thrombus detection from ~33% to >90%",
      "If apical thrombus is suspected on unenhanced echo, ALWAYS use contrast to confirm or exclude",
      "Apical HCM is frequently missed on unenhanced echo — contrast is essential for diagnosis",
      "LVNC: contrast fills deep recesses (>2.3x compacted layer in systole) — confirms diagnosis",
      "EF measured with contrast is more reproducible and accurate than unenhanced EF",
    ],
  },
  {
    id: "a2c",
    group: "Apical",
    groupColor: "#189aa1",
    name: "Apical 2-Chamber (A2C)",
    patientPosition: "Steep left lateral decubitus; same position as A4C",
    probePosition: "Same apex position as A4C; rotate probe 60° counterclockwise",
    probeOrientation: "2-chamber view; LV anterior wall on right, inferior wall on left; no RV visible",
    description: "The apical 2-chamber view is obtained by rotating 60° counterclockwise from A4C. It is the only apical view of the true anterior wall (LAD territory) and is essential for biplane EF calculation. With contrast, anterior and inferior wall motion is clearly delineated.",
    howToGet: [
      "From A4C, rotate probe 60° counterclockwise (indicator toward 12 o'clock)",
      "Confirm only LV is visible — no RV should be seen",
      "Anterior wall (LAD territory) on right side of screen",
      "Inferior wall (RCA territory) on left side of screen",
      "Optimize contrast gain to delineate anterior and inferior walls",
      "Acquire cine loop for biplane EF (A4C + A2C)",
    ],
    structures: [
      "LV anterior wall (LAD territory)",
      "LV inferior wall (RCA territory)",
      "Mitral valve (anterior and posterior leaflets)",
      "Left atrium",
      "LV apex",
    ],
    contrastTips: [
      "Anterior wall is the most important structure in A2C — LAD ischaemia causes anterior WMA",
      "Inferior wall WMA = RCA territory — compare with PSAX and subcostal views",
      "A2C is required for biplane Simpson's EF — always acquire with A4C",
      "Apical anterior wall is a common site for thrombus in anterior STEMI — contrast confirms",
    ],
    pitfalls: [
      "Oblique rotation — confirm no RV is visible; RV in view means probe is not at true 2-chamber",
      "Foreshortening — same risk as A4C; ensure apex is at top of screen",
      "Anterior wall dropout — common in obese patients; contrast resolves this",
    ],
    artifacts: [
      { name: "Anterior wall dropout", description: "Anterior wall is furthest from probe in A2C — prone to dropout. Contrast fills cavity and improves border definition." },
    ],
    clinicalPearls: [
      "A2C is the only apical view showing the true anterior wall — essential for LAD territory assessment",
      "In anterior STEMI, A2C shows anterior and apical akinesis — contrast confirms extent",
      "Biplane EF requires both A4C and A2C — always acquire both with contrast",
    ],
  },
  {
    id: "a3c",
    group: "Apical",
    groupColor: "#189aa1",
    name: "Apical 3-Chamber / Long Axis (A3C)",
    patientPosition: "Steep left lateral decubitus; same position as A4C",
    probePosition: "Same apex position; rotate probe 30–60° counterclockwise from A2C (120–150° from A4C)",
    probeOrientation: "Long axis view from apex; LVOT and aortic valve visible; anteroseptal and inferolateral walls",
    description: "The apical long axis (A3C) completes the triplane assessment and is essential for LVOT and aortic valve evaluation from the apical window. With contrast, anteroseptal and inferolateral walls are delineated, completing the 17-segment model.",
    howToGet: [
      "From A2C, rotate probe further counterclockwise 30–60° (indicator toward 11 o'clock)",
      "LVOT and aortic valve should come into view",
      "Anteroseptal wall on right, inferolateral wall on left",
      "Optimize contrast to delineate anteroseptal and inferolateral walls",
      "Acquire cine loop for triplane EF if platform supports it",
    ],
    structures: [
      "LV anteroseptal wall (LAD territory)",
      "LV inferolateral wall (LCx territory)",
      "LVOT and aortic valve",
      "Mitral valve",
      "Aortic root",
    ],
    contrastTips: [
      "Anteroseptal wall (LAD territory) and inferolateral wall (LCx territory) are best seen in A3C",
      "LVOT obstruction in HCM: contrast delineates the LVOT and SAM of MV",
      "Triplane EF: A4C + A2C + A3C provides most accurate volumetric EF with contrast",
    ],
    pitfalls: [
      "Over-rotation — if LVOT is not visible, rotate back toward A2C",
      "Confusing A3C with A2C — confirm LVOT and AV are visible in A3C",
    ],
    artifacts: [
      { name: "LVOT artifact", description: "Contrast in LVOT can create bright signal near AV — reduce gain in near field." },
    ],
    clinicalPearls: [
      "A3C is essential for HOCM assessment — SAM of MV and LVOT obstruction are best seen here",
      "Inferolateral wall WMA = LCx territory — compare with PSAX inferolateral segment",
      "Complete 17-segment assessment requires A4C + A2C + A3C",
    ],
  },
  {
    id: "subcostal",
    group: "Subcostal",
    groupColor: "#189aa1",
    name: "Subcostal 4-Chamber",
    patientPosition: "Supine; knees bent to relax abdominal muscles; head flat or slightly elevated",
    probePosition: "Subxiphoid process; indicator toward patient's left; probe angled superiorly toward heart",
    probeOrientation: "4-chamber view from below; RV anterior (near field), LV posterior (far field)",
    description: "The subcostal view is an invaluable alternative when apical windows are poor (obesity, COPD, post-surgical). With contrast, the inferior and inferoseptal walls are well-delineated, and RV thrombus or mass can be assessed.",
    howToGet: [
      "Patient supine with knees bent; ask patient to breathe out and hold",
      "Place probe below xiphoid process; indicator toward patient's left",
      "Angle probe superiorly and posteriorly toward the heart",
      "Apply firm pressure — subcostal window requires more pressure than apical",
      "Activate contrast mode; reduce gain",
      "Inferior and inferoseptal walls are in the far field — ensure adequate depth",
    ],
    structures: [
      "LV inferior and inferoseptal walls (far field)",
      "RV (near field — anterior)",
      "Interatrial and interventricular septa",
      "Mitral and tricuspid valves",
      "IVC entry into RA",
    ],
    contrastTips: [
      "Subcostal is the best alternative window for inferior wall assessment when apical window is poor",
      "Contrast fills RV first (near field) then LV — wait for LV opacification",
      "RV thrombus: avascular filling defect in RV — rare but important in PE or RV infarct",
      "Inferior wall WMA: contrast clearly delineates inferior and inferoseptal walls",
    ],
    pitfalls: [
      "Inadequate pressure — subcostal window requires firm pressure; use patient's exhale",
      "Liver interposition — reposition probe laterally if liver is in the way",
      "RV near-field artifact — high gain causes bright artifact in RV; reduce gain",
      "Contrast attenuation — RV contrast can attenuate signal to LV far field; reduce gain",
    ],
    artifacts: [
      { name: "Near-field RV artifact", description: "RV is in near field — contrast causes bright near-field signal. Reduce gain." },
      { name: "Attenuation artifact", description: "RV contrast attenuates signal to LV far field. Reduce gain and use harmonic imaging." },
    ],
    clinicalPearls: [
      "Subcostal is the best window in post-cardiac surgery patients (sternal wound prevents parasternal access)",
      "Subcostal is preferred in COPD/emphysema — hyperinflated lungs push heart inferiorly",
      "In obese patients, subcostal often provides better contrast images than apical",
      "IVC assessment is not affected by contrast — standard technique applies",
    ],
  },
];

// ─── INJECTION TECHNIQUE ──────────────────────────────────────────────────────

const injectionSteps = [
  {
    step: 1,
    title: "IV Access Preparation",
    detail: "Use 18–20G IV catheter in antecubital fossa. Flush with 5 mL normal saline to confirm patency. Avoid hand/wrist veins — higher hemolysis risk with agitated saline or UEA.",
  },
  {
    step: 2,
    title: "Agent Preparation",
    detail: "Definity: activate with Vialmix for 45 seconds, then withdraw 10 µL/kg (max 720 µL) into syringe. Lumason: attach transfer system, inject 5 mL NS into vial, shake 20 seconds until milky-white, withdraw 2.0 mL; may re-agitate if >5 min has elapsed. Optison: gently invert 10 times, withdraw 0.5 mL. See UEA Navigator for full agent-specific prep and dosing.",
  },
  {
    step: 3,
    title: "Machine Settings",
    detail: "Activate contrast-specific imaging mode. Set MI to 0.1–0.2. Reduce gain 30–50%. Set focus to mid-LV. Ensure frame rate >25 fps.",
  },
  {
    step: 4,
    title: "Bolus Injection",
    detail: "Inject UEA as slow IV bolus over 2–3 seconds. Immediately follow with 5–10 mL normal saline flush. Observe LV opacification on screen — should appear within 3–5 cardiac cycles.",
  },
  {
    step: 5,
    title: "Image Acquisition",
    detail: "Acquire cine loops at each view during peak opacification. For LVO: acquire A4C, A2C, A3C, PLAX, PSAX. For MPI: acquire PSAX mid-papillary with flash replenishment.",
  },
  {
    step: 6,
    title: "Flash Replenishment (MPI only)",
    detail: "At PSAX mid-papillary level: send 1–2 high-MI frames (flash) to destroy microbubbles. Immediately switch to low MI and record replenishment over 4–8 cardiac cycles. Normal: uniform replenishment within 4 beats.",
  },
  {
    step: 7,
    title: "Repeat Injection (if needed)",
    detail: "If LV opacification is inadequate, a second bolus may be given after 5–10 minutes. Do not exceed maximum dose per manufacturer guidelines.",
  },
  {
    step: 8,
    title: "Post-Injection Monitoring",
    detail: "Monitor patient for 30 minutes. Record vital signs at 5, 15, and 30 minutes. Watch for signs of allergic reaction: urticaria, bronchospasm, hypotension, angioedema.",
  },
];

// ─── ARTEFACT GUIDE ───────────────────────────────────────────────────────────

const artifactGuide = [
  {
    name: "Attenuation / Shadowing",
    cause: "Excessive contrast concentration in near field absorbs ultrasound energy, preventing penetration to far field",
    appearance: "Dark (hypoechoic) region in far field behind dense contrast",
    solution: "Reduce contrast dose or injection rate; reduce gain; wait for contrast to dilute",
    mimic: "Posterior wall dropout, pericardial effusion",
  },
  {
    name: "Blooming Artifact",
    cause: "Over-gain causes contrast signal to appear to extend beyond true endocardial border",
    appearance: "Endocardial border appears thicker or irregular; LV cavity appears smaller than true size",
    solution: "Reduce gain until endocardial border is sharply defined",
    mimic: "LV hypertrophy, endocardial fibrosis",
  },
  {
    name: "Near-Field Clutter",
    cause: "High-amplitude echoes from structures near probe (chest wall, RV anterior wall) create reverberation artifacts",
    appearance: "Bright horizontal bands or haze in near field of LV cavity",
    solution: "Reduce gain; use harmonic imaging; reposition probe",
    mimic: "Apical thrombus (near-field clutter can mimic filling defect)",
  },
  {
    name: "Side-Lobe Artifact",
    cause: "Off-axis ultrasound beams (side lobes) reflect from strong reflectors (MV annulus, ribs) into LV cavity",
    appearance: "Curvilinear echoes within LV cavity, often parallel to MV annulus",
    solution: "Contrast fills cavity and eliminates most side-lobe artifacts; reposition probe",
    mimic: "Intracardiac mass, thrombus, vegetation",
  },
  {
    name: "Flash Artifact (MPI)",
    cause: "High-MI pulse used for flash replenishment creates a bright flash frame",
    appearance: "1–2 bright frames immediately after flash pulse — expected finding",
    solution: "Normal finding — observe subsequent replenishment pattern",
    mimic: "Not a pathological finding; expected during flash replenishment technique",
  },
  {
    name: "Pseudo-Perfusion Defect",
    cause: "Off-axis imaging, inadequate contrast dose, or papillary muscle shadowing creates apparent perfusion defect",
    appearance: "Apparent regional hypoenhancement that does not correspond to coronary territory",
    solution: "Reposition probe to obtain true short axis; ensure adequate contrast dose; confirm in multiple views",
    mimic: "True myocardial perfusion defect (ischaemia or infarct)",
  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

// Named export for embedding as a tab inside ScanCoach.tsx (no Layout wrapper)
export function UEAScanCoachContent() {
  return <UEAScanCoachInner />;
}

function UEAScanCoachInner() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const [selectedView, setSelectedView] = useState<string | null>(
    UEA_VIEWS.find(v => v.id === _viewParam) ? _viewParam : "a4c"
  );
  const [activeTab, setActiveTab] = useState<"views" | "injection" | "bubble" | "artifacts" | "tips" | "vendors" | "peg">("views");

  const _currentViewRaw = UEA_VIEWS.find(v => v.id === selectedView);
  const { mergeView: mergeUEAView } = useScanCoachOverrides("uea");
  const currentView = useMemo(
    () => _currentViewRaw ? mergeUEAView(_currentViewRaw as any) : undefined,
    [_currentViewRaw, mergeUEAView]
  );
  const groups = Array.from(new Set(UEA_VIEWS.map(v => v.group)));
  return (
    <div>
      {/* ── Tab Bar ── */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="container">
          <div className="flex gap-1 overflow-x-auto py-2">
            {([
              { id: "views", label: "View-by-View Guide" },
              { id: "injection", label: "Injection Technique" },
              { id: "bubble", label: "Bubble Study" },
              { id: "artifacts", label: "Artifacts" },
              { id: "tips", label: "Tips & Tricks" },
              { id: "vendors", label: "UEA Agents" },
              { id: "peg", label: "PEG Allergy" },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === id ? "text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                style={activeTab === id ? { background: BRAND } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {activeTab === "views" && (
      <div className="container py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* View selector */}
            <div className="lg:col-span-1 lg:sticky lg:top-16">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Select View</h2>
                </div>
                <div className="p-2">
                  {groups.map(group => (
                    <div key={group} className="mb-2">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {group}
                      </div>
                      {UEA_VIEWS.filter(v => v.group === group).map(view => (
                        <button
                          key={view.id}
                          onClick={() => setSelectedView(view.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all mb-0.5 ${
                            selectedView === view.id
                              ? "text-white"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                          style={selectedView === view.id ? { background: view.groupColor } : {}}
                        >
                          <Stethoscope className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-xs font-semibold leading-tight">{view.name}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* View detail */}
            <div className="lg:col-span-2">
              {currentView ? (
                <div className="space-y-4">
                  {/* View header */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: currentView.groupColor + "15" }}>
                        <Droplets className="w-5 h-5" style={{ color: currentView.groupColor }} />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                          {currentView.name}
                        </h2>
                        <div className="inline-flex items-center gap-1.5 mt-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                            style={{ background: currentView.groupColor }}>
                            {currentView.group}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{currentView.description}</p>
                  </div>

                  {/* Transducer Positioning */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>
                      Transducer Positioning
                    </h3>
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: "#f0fbfc" }}>
                        <Target className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Patient Position</div>
                          <div className="text-xs text-gray-700">{currentView.patientPosition}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: "#f0fbfc" }}>
                        <RotateCcw className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Probe Position</div>
                          <div className="text-xs text-gray-700">{currentView.probePosition}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: "#f0fbfc" }}>
                        <Eye className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Probe Orientation</div>
                          <div className="text-xs text-gray-700">{currentView.probeOrientation}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reference Images — shown when admin has uploaded via ScanCoach Editor */}
                  {((currentView as any).echoImageUrl || (currentView as any).anatomyImageUrl || (currentView as any).transducerImageUrl) && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-50">
                        <p className="text-sm font-bold text-gray-800">Reference Images</p>
                      </div>
                      <div className={`bg-gray-950 grid gap-2 p-4 ${
                        [(currentView as any).echoImageUrl, (currentView as any).anatomyImageUrl, (currentView as any).transducerImageUrl].filter(Boolean).length > 1
                          ? 'grid-cols-2'
                          : 'grid-cols-1'
                      }`}>
                        {(currentView as any).echoImageUrl && (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1 font-medium">Echo Image</p>
                            <img src={(currentView as any).echoImageUrl} alt="Echo reference" className="max-h-64 object-contain rounded-lg w-full" onContextMenu={e => e.preventDefault()} />
                          </div>
                        )}
                        {(currentView as any).anatomyImageUrl && (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1 font-medium">Anatomy Diagram</p>
                            <img src={(currentView as any).anatomyImageUrl} alt="Anatomy diagram" className="max-h-64 object-contain rounded-lg w-full" onContextMenu={e => e.preventDefault()} />
                          </div>
                        )}
                        {(currentView as any).transducerImageUrl && (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1 font-medium">Probe Position</p>
                            <img src={(currentView as any).transducerImageUrl} alt="Probe position" className="max-h-64 object-contain rounded-lg w-full" onContextMenu={e => e.preventDefault()} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* How to get this view */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>
                      Step-by-Step Acquisition
                    </h3>
                    <ol className="space-y-2">
                      {(currentView as any).howToGet.map((step: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                            style={{ background: BRAND }}>
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Structures visible */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>
                      Structures Visible
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(currentView as any).structures.map((s: string, i: number) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: BRAND + "12", color: BRAND }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Contrast tips */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>
                      Contrast-Specific Tips
                    </h3>
                    <div className="space-y-2">
                      {(currentView as any).contrastTips.map((tip: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-teal-50 border border-teal-100">
                          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                          <p className="text-xs text-teal-800 leading-relaxed">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pitfalls */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-amber-700">
                      Common Pitfalls
                    </h3>
                    <div className="space-y-2">
                      {(currentView as any).pitfalls.map((pitfall: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                          <p className="text-xs text-amber-800 leading-relaxed">{pitfall}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* View-specific artifacts */}
                  {(currentView as any).artifacts.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-red-700">
                        Artifacts at This View
                      </h3>
                      <div className="space-y-2.5">
                        {(currentView as any).artifacts.map((art: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg border border-red-100 bg-red-50">
                            <div className="text-xs font-bold text-red-700 mb-1">{art.name}</div>
                            <p className="text-xs text-red-600 leading-relaxed">{art.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clinical pearls */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#16a34a" }}>
                      Clinical Pearls
                    </h3>
                    <div className="space-y-2">
                      {(currentView as any).clinicalPearls.map((pearl: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 border border-green-100">
                          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-green-600" />
                          <p className="text-xs text-green-800 leading-relaxed">{pearl}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Navigation between views */}
                  <div className="flex justify-between">
                    {(() => {
                      const idx = UEA_VIEWS.findIndex(v => v.id === selectedView);
                      const prev = idx > 0 ? UEA_VIEWS[idx - 1] : null;
                      const next = idx < UEA_VIEWS.length - 1 ? UEA_VIEWS[idx + 1] : null;
                      return (
                        <>
                          {prev ? (
                            <button
                              onClick={() => setSelectedView(prev.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                              {prev.name}
                            </button>
                          ) : <div />}
                          {next && (
                            <button
                              onClick={() => setSelectedView(next.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
                              style={{ background: BRAND }}
                            >
                              {next.name}
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <Droplets className="w-10 h-10 mx-auto mb-3" style={{ color: BRAND + "60" }} />
                  <p className="text-sm text-gray-500">Select a view from the list to see acquisition guidance</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Injection Technique Tab ───────────────────────────────────────── */}
      {activeTab === "injection" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              UEA Injection Technique
            </h2>
            <p className="text-sm text-gray-500">Step-by-step protocol for safe and effective contrast administration</p>
          </div>

          {/* ── Lumason Reconstitution Guide ─────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm mb-6 overflow-hidden"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4"
              style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1e4d8c 100%)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                <Droplets className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-black text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                  Lumason® Reconstitution — Step-by-Step
                </h3>
                <p className="text-blue-200 text-xs">Sulfur hexafluoride lipid-type A microspheres · Bracco Diagnostics</p>
              </div>
              <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full text-white"
                style={{ background: "rgba(255,255,255,0.2)" }}>Lyophilized Powder</span>
            </div>

            <div className="p-5">
              {/* What's in the kit */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 mb-4">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  <strong>Kit contents:</strong> One vial of lyophilized SF₆ powder, one pre-filled syringe of sterile water for injection (5 mL), and a vial adapter/transfer device. No refrigeration required — store at room temperature (20–25 °C / 68–77 °F). Do not use after expiry date.
                </p>
              </div>

              {/* Numbered steps */}
              <div className="space-y-3 mb-4">
                {[
                  {
                    step: 1,
                    title: "Inspect the vial",
                    detail: "Check expiry date on the vial label. The vial should contain a white to off-white lyophilized powder with a blue SF₆ gas headspace. Discard if powder is discolored, clumped, or the seal is broken.",
                    timing: null,
                    warning: null,
                  },
                  {
                    step: 2,
                    title: "Attach the vial adapter",
                    detail: "Remove the flip-off cap from the vial. Wipe the rubber stopper with an alcohol swab and allow to dry. Firmly press the vial adapter (transfer device) onto the vial stopper until it snaps into place.",
                    timing: null,
                    warning: null,
                  },
                  {
                    step: 3,
                    title: "Inject sterile water for injection",
                    detail: "Connect the pre-filled syringe of sterile water for injection (5 mL) to the vial adapter. Slowly inject all 5 mL into the vial. Do NOT use bacteriostatic water, saline, or dextrose — sterile water only.",
                    timing: null,
                    warning: "Use sterile water for injection ONLY. Saline or dextrose will cause microsphere aggregation.",
                  },
                  {
                    step: 4,
                    title: "Gently swirl — do NOT shake",
                    detail: "Gently swirl the vial in a circular motion for 10–15 seconds until the powder is completely dissolved. The suspension should appear uniformly milky-white and opaque. Do NOT shake vigorously — this destroys microspheres before use.",
                    timing: "~15 seconds",
                    warning: "Do NOT shake. Vigorous shaking destroys microspheres and reduces efficacy.",
                  },
                  {
                    step: 5,
                    title: "Inspect the reconstituted suspension",
                    detail: "Hold the vial up to light and inspect. The suspension should be uniformly milky-white with no visible clumps or undissolved particles. If clumps are visible, gently swirl again for 5 seconds. Discard if suspension is not uniform after a second attempt.",
                    timing: null,
                    warning: null,
                  },
                  {
                    step: 6,
                    title: "Withdraw the dose",
                    detail: "Gently invert the vial 10 times immediately before each withdrawal to resuspend microspheres (they settle quickly). Attach a new syringe to the adapter. Withdraw 2.0 mL for a standard LVO bolus dose. For infusion: withdraw 4.8 mL and dilute in 50 mL normal saline.",
                    timing: null,
                    warning: null,
                  },
                  {
                    step: 7,
                    title: "Administer and flush",
                    detail: "Inject 2.0 mL as a slow IV bolus over 2–3 seconds via antecubital IV. Immediately follow with a 5 mL normal saline flush. LV opacification should appear within 3–5 cardiac cycles.",
                    timing: "Bolus over 2–3 sec",
                    warning: null,
                  },
                  {
                    step: 8,
                    title: "Repeat dosing and storage",
                    detail: "Invert the vial 10 times before each subsequent withdrawal. May repeat bolus at 25–30 minute intervals if needed. The reconstituted suspension is stable for 6 hours at room temperature — do NOT refrigerate after reconstitution.",
                    timing: "Stable 6 hours post-reconstitution",
                    warning: null,
                  },
                ].map(({ step, title, detail, timing, warning }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0 mt-0.5"
                      style={{ background: "linear-gradient(135deg, #1e4d8c, #2563eb)" }}>
                      {step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{title}</span>
                        {timing && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{timing}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
                      {warning && (
                        <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] text-amber-800 leading-relaxed">{warning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick-reference dosing table */}
              <div className="rounded-lg border border-blue-100 overflow-hidden mb-4">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50">
                  Quick-Reference Dosing
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    { indication: "LVO — Bolus", dose: "2.0 mL IV bolus", flush: "5 mL NS", repeat: "q 25–30 min" },
                    { indication: "LVO — Infusion", dose: "4.8 mL in 50 mL NS", flush: "—", repeat: "Titrate 1–2 mL/min" },
                    { indication: "Liver CEUS", dose: "2.4 mL IV bolus", flush: "5 mL NS", repeat: "Once" },
                  ].map(({ indication, dose, flush, repeat }) => (
                    <div key={indication} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs">
                      <span className="font-semibold text-gray-700">{indication}</span>
                      <span className="text-blue-700 font-bold">{dose}</span>
                      <span className="text-gray-500">{flush}</span>
                      <span className="text-gray-500">{repeat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical tips */}
              <div className="rounded-lg bg-teal-50 border border-teal-100 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Clinical Tips</span>
                </div>
                <ul className="space-y-1.5">
                  {[
                    "Lumason does not require activation with a Vialmix — gentle swirling only. No mechanical activator needed.",
                    "SF₆ microspheres settle quickly — always invert 10× immediately before each withdrawal, even from the same vial.",
                    "Lumason is approved for both cardiac LVO and liver CEUS — the only FDA-approved agent for both indications.",
                    "Lumason has a favorable safety profile in patients with pulmonary hypertension — SF₆ gas is inert and rapidly exhaled.",
                    "If >5 minutes has elapsed since reconstitution, gently invert 10× to resuspend before withdrawing the next dose.",
                    "Reconstituted Lumason does NOT need to be refrigerated — store at room temperature and use within 6 hours.",
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" />
                      <span className="text-xs text-teal-800 leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ── General Injection Steps ───────────────────────────────────────── */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3" style={{ fontFamily: "Merriweather, serif" }}>General UEA Injection Protocol</h3>
          </div>
          <div className="space-y-3">
            {injectionSteps.map(step => (
              <div key={step.step} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, ${AQUA})` }}>
                  {step.step}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}      {/* ── Bubble Study Tab ─────────────────────────────────────────────────── */}
      {activeTab === "bubble" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Agitated Saline Bubble Study — Acquisition Guide
            </h2>
            <p className="text-sm text-gray-500">Step-by-step scanning guide for PFO/ASD detection, intrapulmonary shunt, and PLSVC evaluation</p>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-2 p-4 rounded-xl bg-sky-50 border border-sky-200 mb-5">
            <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-sky-800 leading-relaxed">
              <strong>Key principle:</strong> Agitated saline microbubbles (50–200 µm) are too large to cross normal pulmonary capillaries. Appearance in the left heart ≤3 cardiac cycles after RV opacification = intracardiac R-to-L shunt (PFO/ASD). Appearance after 3–5 cycles = intrapulmonary shunt. Early coronary sinus opacification on left arm injection = PLSVC.
            </div>
          </div>

          {/* Preparation */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Equipment & Preparation</h3>
            <div className="space-y-2">
              {[
                { step: 1, text: "Two 10 mL syringes + 3-way stopcock + 18G or larger peripheral IV in antecubital fossa" },
                { step: 2, text: "Fill one syringe with 9 mL normal saline + 1 mL room air (10:1 ratio)" },
                { step: 3, text: "Optional: add 0.1–0.5 mL of patient’s own blood to improve bubble stability" },
                { step: 4, text: "Agitate vigorously by rapidly transferring between syringes 10–15 times" },
                { step: 5, text: "Administer immediately after agitation (within 5 seconds) — bubbles dissolve rapidly" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5"
                    style={{ background: BRAND }}>{step}</div>
                  <p className="text-xs text-gray-700 leading-relaxed pt-0.5">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Machine settings for bubble study */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Machine Settings</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Mode", value: "2D (standard)" },
                { label: "MI", value: "Standard (0.8–1.2)" },
                { label: "Gain", value: "Standard settings" },
                { label: "View", value: "A4C or subcostal 4C" },
                { label: "Frame rate", value: ">25 fps" },
                { label: "Harmonic", value: "ON (preferred)" },
              ].map(({ label, value }) => (
                <div key={label} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</div>
                  <div className="text-xs font-semibold text-gray-800">{value}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              <strong>Note:</strong> Bubble studies use standard 2D imaging — do NOT activate low-MI contrast mode. Bubbles are large enough to visualize with standard harmonic imaging. Low MI would not destroy them, but standard MI provides better visualization of the rapid transit.
            </p>
          </div>

          {/* Injection protocol */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Injection Protocol</h3>
            <div className="space-y-3">
              {[
                {
                  label: "Baseline injection (no Valsalva)",
                  detail: "Inject 10 mL agitated saline as a rapid IV bolus. Confirm RV opacification (confirms IV placement). Observe for immediate LV opacification (large shunt).",
                  badge: "Step 1", badgeColor: "#0369a1"
                },
                {
                  label: "Valsalva injection",
                  detail: "Patient bears down hard for 5 seconds (Valsalva). Release Valsalva just before injection. Inject 10 mL agitated saline. The Valsalva RELEASE is when shunting occurs — time injection so bubbles arrive during release phase.",
                  badge: "Step 2 — Critical", badgeColor: "#dc2626"
                },
                {
                  label: "Repeat as needed",
                  detail: "Typically 2–3 injections per study. Re-agitate saline immediately before each injection. Allow 1–2 minutes between injections for bubbles to clear.",
                  badge: "Step 3", badgeColor: "#16a34a"
                },
              ].map(({ label, detail, badge, badgeColor }) => (
                <div key={label} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: badgeColor }}>{badge}</span>
                    <span className="text-xs font-bold text-gray-800">{label}</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Interpretation */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Interpretation — Timing & Grading</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">No Bubbles in LV</div>
                <div className="text-xs font-bold text-green-800 mb-1">Negative Study</div>
                <div className="text-xs text-green-700">No R-to-L shunt detected at rest or with Valsalva</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">≤3 Cardiac Cycles</div>
                <div className="text-xs font-bold text-amber-800 mb-1">Intracardiac Shunt</div>
                <div className="text-xs text-amber-700">PFO, ASD, or other intracardiac R-to-L communication</div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">3–5 Cardiac Cycles</div>
                <div className="text-xs font-bold text-blue-800 mb-1">Intrapulmonary Shunt</div>
                <div className="text-xs text-blue-700">HHT, hepatopulmonary syndrome, pulmonary AVMs, cirrhosis</div>
              </div>
            </div>
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
                  {[
                    { grade: "Grade 0", bubbles: "No bubbles", interp: "No shunt", color: "#16a34a" },
                    { grade: "Grade 1+", bubbles: "1–10 bubbles", interp: "Small shunt — PFO likely", color: "#d97706" },
                    { grade: "Grade 2+", bubbles: "11–30 bubbles", interp: "Moderate shunt — PFO or small ASD", color: "#ea580c" },
                    { grade: "Grade 3+", bubbles: ">30 bubbles or complete LV opacification", interp: "Large shunt — large ASD or significant PFO", color: "#dc2626" },
                  ].map((row, i) => (
                    <tr key={i} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                      <td className="py-2 pr-4 font-bold" style={{ color: row.color }}>{row.grade}</td>
                      <td className="py-2 pr-4 text-gray-700">{row.bubbles}</td>
                      <td className="py-2 text-gray-600">{row.interp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PLSVC section */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#fdf4ff" }}>
                <Activity className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>PLSVC Evaluation Protocol</h3>
                <p className="text-xs text-gray-500">Persistent Left Superior Vena Cava — bubble study from left arm</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 mb-3">
              <p className="text-xs text-purple-800 leading-relaxed">
                <strong>Key concept:</strong> In PLSVC, the left SVC drains into the right atrium via a dilated coronary sinus. Injecting agitated saline from the LEFT arm opacifies the coronary sinus BEFORE the RA/RV — this is pathognomonic for PLSVC.
              </p>
            </div>
            <div className="space-y-2">
              {[
                { step: 1, text: "Screen for PLSVC: measure coronary sinus diameter in PLAX (normal <10 mm; dilated ≥10 mm = suspect PLSVC)", critical: true },
                { step: 2, text: "Obtain A4C view. Optimize to show both atria and coronary sinus ostium clearly" },
                { step: 3, text: "Inject agitated saline from LEFT antecubital vein as rapid bolus", critical: true },
                { step: 4, text: "PLSVC positive: coronary sinus opacifies BEFORE RA/RV (pathognomonic)", critical: true },
                { step: 5, text: "Repeat injection from RIGHT antecubital vein — normal RA → RV sequence confirms isolated PLSVC" },
                { step: 6, text: "Also obtain PLAX view to directly visualize coronary sinus opacification" },
                { step: 7, text: "Assess for associated defects: ASD, VSD, bicuspid aortic valve" },
                { step: 8, text: "If LA opacifies before RA on left arm injection — suspect unroofed coronary sinus (rare, causes cyanosis)", critical: true },
              ].map(({ step, text, critical }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5"
                    style={{ background: critical ? "#dc2626" : BRAND }}>{step}</div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 leading-relaxed pt-0.5">{text}</p>
                    {critical && <span className="text-[10px] font-bold text-red-600">CRITICAL STEP</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Link to Navigator */}
          <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#4ad9e0] uppercase tracking-wider mb-0.5">Full Protocol Reference</p>
              <p className="text-white text-sm font-bold">UEA Navigator — Bubble Study & PLSVC</p>
              <p className="text-white/60 text-xs">Full checklist, shunt grading, PLSVC echo findings, and clinical implications</p>
            </div>
            <Link href="/uea-navigator">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: BRAND }}>
                <ArrowRight className="w-4 h-4" />
                Open Navigator
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Artifact Guide Tab ─────────────────────────────────────────────────── */}
      {activeTab === "artifacts" && (      <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Contrast Artifact Recognition Guide
            </h2>
            <p className="text-sm text-gray-500">Identify, understand, and resolve common contrast echocardiography artifacts</p>
          </div>
          <div className="space-y-4">
            {artifactGuide.map(art => (
              <div key={art.name} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-50">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 pt-1" style={{ fontFamily: "Merriweather, serif" }}>
                    {art.name}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-11">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Cause</div>
                    <p className="text-xs text-gray-700 leading-relaxed">{art.cause}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Appearance</div>
                    <p className="text-xs text-gray-700 leading-relaxed">{art.appearance}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">Solution</div>
                    <p className="text-xs text-gray-700 leading-relaxed">{art.solution}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Can Mimic</div>
                    <p className="text-xs text-gray-700 leading-relaxed">{art.mimic}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Tips Tab ────────────────────────────────────────────────── */}
      {activeTab === "tips" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Quick Reference Tips
            </h2>
            <p className="text-sm text-gray-500">Essential contrast echo reminders for the scanning room</p>
          </div>
          <div className="space-y-4">
            {[
              {
                title: "Machine Settings at a Glance",
                icon: Zap,
                color: BRAND,
                tips: [
                  "MI: 0.1–0.2 (low MI mode) — high MI destroys microbubbles",
                  "Gain: reduce 30–50% from standard — over-gain causes blooming",
                  "Mode: contrast harmonic (CPS, Power Modulation, or Pulse Inversion)",
                  "Focus: single focus at mid-LV level",
                  "Frame rate: >25 fps (ideally >50 fps)",
                  "Depth: minimum to include full LV",
                ],
              },
              {
                title: "Positioning Essentials",
                icon: Target,
                color: "#189aa1",
                tips: [
                  "Steep left lateral decubitus (60–90°) is ESSENTIAL for apical views",
                  "Left arm raised above head opens intercostal spaces",
                  "Head of bed elevated 15–30° improves apical window",
                  "Subcostal: patient supine, knees bent, breathe out and hold",
                  "Parasternal: left lateral decubitus, 30–45° tilt is sufficient",
                ],
              },
              {
                title: "When to Use Contrast",
                icon: CheckCircle,
                color: "#16a34a",
                tips: [
                  "≥2 contiguous LV segments not adequately visualised (Class I)",
                  "Suspected apical thrombus — contrast sensitivity >90% vs ~33% unenhanced",
                  "Suspected apical HCM — spade-shaped cavity only visible with contrast",
                  "Suspected LVNC — deep recesses fill with contrast",
                  "Stress echo with poor baseline image quality",
                  "Myocardial perfusion imaging (MPI) — flash replenishment technique",
                ],
              },
              {
                title: "Safety Reminders",
                icon: Shield,
                color: "#dc2626",
                tips: [
                  "FDA Black Box Warning (Definity/Optison) — serious cardiopulmonary reactions possible",
                  "Resuscitation equipment and epinephrine MUST be available",
                  "Monitor for 30 minutes post-injection — vital signs at 5, 15, 30 min",
                  "Absolute contraindication: known R-to-L intracardiac or pulmonary shunt",
                  "Relative contraindication: severe decompensated HF, severe PHT (>90 mmHg)",
                  "Lumason (Sulfur hexafluoride) has a safer profile — consider in high-risk patients",
                ],
              },
              {
                title: "Flash Replenishment (MPI) Technique",
                icon: Activity,
                color: BRAND,
                tips: [
                  "Obtain PSAX mid-papillary level with steady contrast infusion or after bolus",
                  "Send 1–2 high-MI frames (flash) to destroy all microbubbles in field",
                  "Immediately switch back to low MI and record replenishment",
                  "Normal: uniform replenishment within 4 cardiac cycles",
                  "Delayed (4–8 cycles): ischaemia or microvascular disease",
                  "Absent: infarct (scar) — no viable myocardium",
                  "Papillary muscles do NOT replenish — this is NORMAL",
                ],
              },
            ].map(({ title, icon: Icon, color, tips }) => (
              <div key={title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: color + "15" }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    {title}
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Link to Navigator ─────────────────────────────────────────────── */}
      <div className="container pb-8">
        <div className="rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-[#4ad9e0]" />
              <span className="text-xs font-semibold text-[#4ad9e0] uppercase tracking-wider">UEA Navigator</span>
            </div>
            <h3 className="text-white font-bold text-sm mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Need the full protocol checklist?
            </h3>
            <p className="text-white/60 text-xs">
              Safety screening, indications, agent dosing, view-by-view checklist, reporting guidance, and reference values.
            </p>
          </div>
          <Link href="/uea-navigator">
            <button className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "#189aa1" }}>
              <BookOpen className="w-4 h-4" />
              Open UEA Navigator
            </button>
          </Link>
        </div>
      </div>

      {/* ── Agent Reference Tab ───────────────────────────────────────────── */}
      {activeTab === "vendors" && (
        <div className="container py-6 max-w-4xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              UEA Agent Reference
            </h2>
            <p className="text-sm text-gray-500">Definity, Lumason, and Optison — dosing, administration, chemical makeup, and vendor-specific MI settings</p>
          </div>

          <div className="flex items-start gap-2 p-4 rounded-xl bg-teal-50 border border-teal-200 mb-6">
            <Shield className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-teal-800 leading-relaxed">
              <strong>FDA Black Box Warning (all agents):</strong> Serious cardiopulmonary reactions, including fatalities, have occurred during or following perflutren-containing microsphere administration. Assess all patients for conditions that preclude use. Monitor patients for at least 30 minutes following administration.
            </div>
          </div>

          {/* Agent cards */}
          <div className="grid grid-cols-1 gap-6">

            {/* ── DEFINITY ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}>
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-black text-base" style={{ fontFamily: "Merriweather, serif" }}>Definity® (Perflutren Lipid Microsphere)</h3>
                  <p className="text-teal-200 text-xs">Lantheus Medical Imaging · FDA approved 2001</p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Chemical Makeup</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Shell:</strong> Phospholipid monolayer (DPPA, DPPC, MPEG5000 DPPE)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Gas core:</strong> Octafluoropropane (C₃F₈) — perfluorocarbon</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Microsphere size:</strong> Mean diameter 1.1–3.3 μm (smaller than RBC)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Concentration:</strong> ~1.2 × 10¹⁰ microspheres/mL (after activation)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Appearance:</strong> White to off-white homogeneous suspension after activation</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Preparation</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">1</div><span>Remove vial from refrigerator — allow to reach room temperature (5 min)</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">2</div><span>Activate using VialMix® device for 45 seconds (or manual agitation 45 sec)</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">3</div><span>Inspect: uniform milky-white suspension — no large bubbles or clumping</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">4</div><span>Draw up dose immediately after activation — use within 5 minutes</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">5</div><span>Store at 2–8°C; do not freeze; protect from light</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Dosing — LVO (Bolus)</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Standard dose:</strong> 10 μL/kg IV bolus (max 10 mL per injection)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Typical adult dose:</strong> 0.2–1.0 mL IV bolus</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Flush:</strong> 10 mL normal saline immediately after bolus</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Repeat dosing:</strong> May repeat up to 2 additional doses (max 3 total)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" /><span><strong>Infusion option:</strong> 1.3 mL in 50 mL NS, infuse at 4 mL/min; titrate to effect</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Mechanical Index (MI) Settings</p>
                  <div className="space-y-2">
                    {[
                      { mode: "LVO — Real-time", mi: "0.1–0.2", note: "Low MI harmonic imaging; contrast-specific mode" },
                      { mode: "LVO — Flash replenishment", mi: "High MI flash (1.0–1.9) then 0.1–0.2", note: "Brief high-MI pulse destroys bubbles; watch replenishment" },
                      { mode: "Myocardial perfusion", mi: "0.05–0.1", note: "Ultra-low MI to avoid premature destruction" },
                      { mode: "Stress echo with contrast", mi: "0.1–0.2", note: "Maintain low MI throughout stress protocol" },
                    ].map(({ mode, mi, note }) => (
                      <div key={mode} className="p-2.5 rounded-lg bg-teal-50 border border-teal-100">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-gray-700">{mode}</span>
                          <span className="text-xs font-black" style={{ color: BRAND }}>MI {mi}</span>
                        </div>
                        <p className="text-[10px] text-gray-500">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── LUMASON ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #1e3a5f, #2563eb)" }}>
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-black text-base" style={{ fontFamily: "Merriweather, serif" }}>Lumason® (Sulfur Hexafluoride Lipid-type A Microspheres)</h3>
                  <p className="text-blue-200 text-xs">Bracco Diagnostics · FDA approved 2014 (cardiac) · Also approved for liver imaging</p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Chemical Makeup</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Shell:</strong> Phospholipid monolayer (DSPC, DPPG-Na, DSPE-PEG2000)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Gas core:</strong> Sulfur hexafluoride (SF₆) — inorganic gas, not a perfluorocarbon</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Microsphere size:</strong> Mean diameter 1.5–2.5 μm</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Concentration:</strong> ~200 × 10⁶ microspheres/mL (post-reconstitution)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Key difference:</strong> SF₆ gas (not C₃F₈) — different acoustic properties; slightly less persistent than Definity</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Preparation (Lyophilized Powder)</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">1</div><span>Vial contains lyophilized powder + SF₆ headspace — no refrigeration required (store at room temperature)</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">2</div><span>Inject 5 mL sterile water for injection into vial using provided diluent</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">3</div><span>Gently swirl (do NOT shake vigorously) until powder is fully dissolved — milky-white suspension</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">4</div><span>Use within 6 hours of reconstitution; store at room temperature</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">5</div><span>Gently invert vial 10× before each withdrawal to resuspend microspheres</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Dosing — LVO (Bolus)</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Standard dose:</strong> 2.0 mL IV bolus</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Flush:</strong> 5 mL normal saline immediately after bolus</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Repeat dosing:</strong> May repeat at 25–30 min intervals if needed</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Infusion option:</strong> 4.8 mL in 50 mL NS, infuse at 1–2 mL/min; titrate to effect</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" /><span><strong>Liver imaging dose:</strong> 2.4 mL IV bolus (different indication)</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Mechanical Index (MI) Settings</p>
                  <div className="space-y-2">
                    {[
                      { mode: "LVO — Real-time", mi: "0.1–0.2", note: "Low MI harmonic imaging; Lumason is slightly more robust at MI 0.2" },
                      { mode: "LVO — Flash replenishment", mi: "High MI flash then 0.1–0.2", note: "SF₆ bubbles may be slightly less persistent post-flash than C₃F₈" },
                      { mode: "Myocardial perfusion", mi: "0.05–0.1", note: "Ultra-low MI; Lumason performs well at very low MI" },
                      { mode: "Liver CEUS", mi: "0.05–0.08", note: "Very low MI required for liver CEUS protocol" },
                    ].map(({ mode, mi, note }) => (
                      <div key={mode} className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-gray-700">{mode}</span>
                          <span className="text-xs font-black text-blue-600">MI {mi}</span>
                        </div>
                        <p className="text-[10px] text-gray-500">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── OPTISON ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #4a1d96, #7c3aed)" }}>
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-black text-base" style={{ fontFamily: "Merriweather, serif" }}>Optison (Perflutren Protein-Type A Microspheres)</h3>
                  <p className="text-purple-200 text-xs">GE HealthCare · FDA approved 1997 · Oldest commercially available UEA</p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Chemical Makeup</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Shell:</strong> Human albumin (5%) — protein shell, NOT a phospholipid</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Gas core:</strong> Octafluoropropane (C₃F₈) — same gas as Definity</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Microsphere size:</strong> Mean diameter 3.0–4.5 μm (larger than Definity/Lumason)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Concentration:</strong> 5–8 × 10⁸ microspheres/mL</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Key difference:</strong> Albumin shell — CONTRAINDICATED in patients with known albumin or blood product hypersensitivity</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Preparation</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">1</div><span>Store at 2–8°C; do not freeze; protect from light</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">2</div><span>Allow to reach room temperature before use (5–10 min)</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">3</div><span>Gently roll vial between palms to resuspend — do NOT shake</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">4</div><span>Inspect: white to off-white suspension — discard if particulate matter or discoloration present</span></div>
                    <div className="flex items-start gap-2"><div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">5</div><span>Use within 30 minutes of opening; discard unused portion</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Dosing — LVO (Bolus)</p>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Standard dose:</strong> 0.5 mL IV bolus (range 0.5–5.0 mL)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Flush:</strong> 10 mL normal saline immediately after bolus</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Repeat dosing:</strong> May repeat up to 2 additional boluses (max 5 mL total per injection)</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Infusion option:</strong> Not typically used as continuous infusion — bolus preferred</span></div>
                    <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" /><span><strong>Note:</strong> Larger microsphere size may cause more attenuation artifact at higher doses</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Mechanical Index (MI) Settings</p>
                  <div className="space-y-2">
                    {[
                      { mode: "LVO — Real-time", mi: "0.1–0.2", note: "Larger microspheres more susceptible to destruction — use lower end of MI range" },
                      { mode: "LVO — Flash replenishment", mi: "High MI flash then 0.1", note: "Use MI 0.1 post-flash — larger bubbles destroy more readily; watch for attenuation" },
                      { mode: "Myocardial perfusion", mi: "0.05–0.08", note: "Very low MI essential — Optison microspheres are more fragile at higher MI" },
                      { mode: "General note", mi: "Keep MI ≤ 0.2", note: "Optison is more sensitive to mechanical destruction than Definity or Lumason" },
                    ].map(({ mode, mi, note }) => (
                      <div key={mode} className="p-2.5 rounded-lg bg-purple-50 border border-purple-100">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-gray-700">{mode}</span>
                          <span className="text-xs font-black text-purple-600">MI {mi}</span>
                        </div>
                        <p className="text-[10px] text-gray-500">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Albumin warning */}
              <div className="mx-5 mb-5 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-800">
                  <strong>Albumin Contraindication:</strong> Optison is contraindicated in patients with known hypersensitivity to albumin, blood, or blood products. Screen all patients before use. Definity or Lumason should be used as alternatives in these patients.
                </div>
              </div>
            </div>

            {/* ── Comparison Table ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Agent Comparison Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-3 text-left font-bold text-gray-500 bg-gray-50">Feature</th>
                      <th className="px-4 py-3 text-left font-bold text-teal-600">Definity®</th>
                      <th className="px-4 py-3 text-left font-bold text-blue-600">Lumason®</th>
                      <th className="px-4 py-3 text-left font-bold text-purple-600">Optison</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { feature: "Shell", definity: "Phospholipid", lumason: "Phospholipid", optison: "Human albumin" },
                      { feature: "Gas", definity: "C₃F₈ (octafluoropropane)", lumason: "SF₆ (sulfur hexafluoride)", optison: "C₃F₈ (octafluoropropane)" },
                      { feature: "Size (mean)", definity: "1.1–3.3 μm", lumason: "1.5–2.5 μm", optison: "3.0–4.5 μm (largest)" },
                      { feature: "Preparation", definity: "Activation (VialMix 45 sec)", lumason: "Reconstitution (add water)", optison: "Ready to use (gentle roll)" },
                      { feature: "Storage", definity: "Refrigerated (2–8°C)", lumason: "Room temperature", optison: "Refrigerated (2–8°C)" },
                      { feature: "LVO bolus dose", definity: "0.2–1.0 mL", lumason: "2.0 mL", optison: "0.5 mL" },
                      { feature: "Saline flush", definity: "10 mL NS", lumason: "5 mL NS", optison: "10 mL NS" },
                      { feature: "Recommended MI (LVO)", definity: "0.1–0.2", lumason: "0.1–0.2", optison: "0.1 (more fragile)" },
                      { feature: "Albumin contraindication", definity: "No", lumason: "No", optison: "YES — contraindicated" },
                      { feature: "Liver CEUS approved", definity: "No", lumason: "Yes (FDA approved)", optison: "No" },
                      { feature: "Infusion use", definity: "Yes (common)", lumason: "Yes", optison: "Not typical" },
                      { feature: "Persistence", definity: "High (C₃F₈)", lumason: "Moderate (SF₆)", optison: "Moderate (larger, more fragile)" },
                    ].map(({ feature, definity, lumason, optison }) => (
                      <tr key={feature}>
                        <td className="px-4 py-2.5 font-semibold text-gray-700 bg-gray-50/50">{feature}</td>
                        <td className="px-4 py-2.5 text-gray-700">{definity}</td>
                        <td className="px-4 py-2.5 text-gray-700">{lumason}</td>
                        <td className={`px-4 py-2.5 ${feature === "Albumin contraindication" ? "text-red-600 font-bold" : "text-gray-700"}`}>{optison}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── PEG Allergy Tab ──────────────────────────────────────────────── */}
      {activeTab === "peg" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              PEG Allergy &amp; Contraindication Screening
            </h2>
            <p className="text-sm text-gray-500">Polyethylene glycol (PEG) sensitivity and contrast agent safety</p>
          </div>

          {/* Why PEG matters */}
          <div className="flex items-start gap-3 p-4 rounded-xl border mb-5" style={{ background: "#fff7ed", borderColor: "#f97316" + "40" }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#f97316" }} />
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: "#f97316" }}>Why PEG Allergy Matters for UEA Administration</p>
              <p className="text-xs text-gray-700 leading-relaxed">
                Definity (perflutren lipid microspheres) and Lumason (sulfur hexafluoride lipid-type A microspheres) both contain polyethylene glycol (PEG) as a component of their lipid shell. Patients with known PEG hypersensitivity — including those with prior reactions to PEGylated medications, certain laxatives (MiraLAX), or COVID-19 mRNA vaccines — may be at increased risk for hypersensitivity reactions. Optison does not contain PEG and may be a safer alternative in PEG-sensitive patients.
              </p>
            </div>
          </div>

          {/* PEG content in each agent */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: BRAND }}>PEG Content by Agent</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                {
                  agent: "Definity (Perflutren)",
                  pegStatus: "Contains PEG",
                  detail: "Lipid shell contains DPPA, DPPC, and MPEG5000 DPPE (a PEGylated phospholipid). PEG content is integral to the microbubble shell structure.",
                  risk: "high",
                },
                {
                  agent: "Lumason (SonoVue)",
                  pegStatus: "Contains PEG",
                  detail: "Lipid shell contains DSPC and macrogol 4000 stearate (PEG 4000 stearate). PEG is present as a stabilizing component of the shell.",
                  risk: "high",
                },
                {
                  agent: "Optison (Perflutren Protein)",
                  pegStatus: "PEG-Free",
                  detail: "Shell is composed of human serum albumin — no PEG component. Preferred alternative in patients with known or suspected PEG hypersensitivity. Note: albumin contraindication applies (see below).",
                  risk: "low",
                },
              ].map(({ agent, pegStatus, detail, risk }) => (
                <div key={agent} className="flex items-start gap-4 px-5 py-4">
                  <div className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${
                    risk === "high" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                  }`}>{pegStatus}</div>
                  <div>
                    <p className="text-xs font-bold text-gray-800 mb-0.5">{agent}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Screening questions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: BRAND }}>Pre-Procedure PEG Screening Questions</h3>
            <div className="space-y-2">
              {[
                "Have you ever had an allergic reaction to a medication or vaccine? If yes, which one?",
                "Have you taken or been prescribed MiraLAX (polyethylene glycol laxative) and had a reaction?",
                "Did you receive a COVID-19 mRNA vaccine (Pfizer-BioNTech or Moderna) and experience an immediate allergic reaction?",
                "Have you ever had a reaction to a PEGylated biologic medication (e.g., pegfilgrastim/Neulasta, peginterferon, certolizumab/Cimzia)?",
                "Do you have a known allergy to polyethylene glycol or polysorbate?",
                "Have you had a prior reaction to an ultrasound contrast agent?",
              ].map((q, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{ background: BRAND }}>{i + 1}</div>
                  <p className="text-xs text-gray-700 leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk stratification */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: BRAND }}>Risk Stratification &amp; Management</h3>
            <div className="space-y-3">
              {[
                {
                  level: "Low Risk",
                  color: "green",
                  criteria: "No history of PEG hypersensitivity, no prior UEA reaction, no known drug allergies",
                  action: "Proceed with standard pre-procedure consent and monitoring. Any approved UEA may be used.",
                },
                {
                  level: "Moderate Risk",
                  color: "amber",
                  criteria: "History of mild drug allergy (non-PEG), prior mild UEA reaction, or uncertain allergy history",
                  action: "Discuss with ordering physician. Consider Optison (PEG-free) if Definity or Lumason is planned. Ensure IV access and emergency medications available. Extend post-procedure monitoring to 30 minutes.",
                },
                {
                  level: "High Risk",
                  color: "red",
                  criteria: "Known PEG hypersensitivity, prior anaphylaxis to PEGylated agent, or prior severe UEA reaction",
                  action: "Do NOT administer Definity or Lumason. Consult with ordering physician and allergy/immunology if needed. Optison (albumin-based) may be considered if no albumin contraindication. Document decision and obtain informed consent. Physician must be present during administration.",
                },
              ].map(({ level, color, criteria, action }) => (
                <div key={level} className={`rounded-lg p-4 border ${
                  color === "green" ? "bg-green-50 border-green-200" :
                  color === "amber" ? "bg-amber-50 border-amber-200" :
                  "bg-red-50 border-red-200"
                }`}>
                  <p className={`text-xs font-bold mb-1 ${
                    color === "green" ? "text-green-700" :
                    color === "amber" ? "text-amber-700" :
                    "text-red-700"
                  }`}>{level}</p>
                  <p className="text-[11px] text-gray-700 mb-2"><span className="font-semibold">Criteria:</span> {criteria}</p>
                  <p className="text-[11px] text-gray-700"><span className="font-semibold">Action:</span> {action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Optison albumin note */}
          <div className="flex items-start gap-3 p-4 rounded-xl border" style={{ background: "#f0fbfc", borderColor: "#189aa1" + "40" }}>
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: BRAND }}>Optison Albumin Contraindication</p>
              <p className="text-xs text-gray-700 leading-relaxed">
                While Optison is PEG-free and preferred in PEG-sensitive patients, it contains human serum albumin. It is contraindicated in patients with known hypersensitivity to albumin or blood products. Always screen for albumin allergy before substituting Optison in PEG-sensitive patients.
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

export default function UEAScanCoach() {
  return (
    <Layout>
      <ScanCoachNavBar navigatorPath="/uea-navigator" navigatorLabel="UEA Navigator" />
<UEAScanCoachInner />
    </Layout>
  );
}
