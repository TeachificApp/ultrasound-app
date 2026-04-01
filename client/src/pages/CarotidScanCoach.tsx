/*
  UltrasoundAssist™ — Vascular Extracranial Carotid Artery ScanCoach
  Based on: AIUM Practice Parameter for the Performance of an Ultrasound Examination
            of the Extracranial Cerebrovascular System (2021) & SVU Guidelines
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Calculator, Receipt} from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { usePremium } from "@/hooks/usePremium";
import { carotidBilling } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";

// ─── Views Data ────────────────────────────────────────────────────────────────
export const views = [
  {
    id: "cca",
    view: "Common Carotid Artery (CCA)",
    probe: "High-frequency linear (7–15 MHz) · Longitudinal & transverse from clavicle to bifurcation",
    tips: [
      {
        category: "Patient Positioning",
        text: "Supine with a pillow or roll under the shoulders to extend the neck. Turn the head 30–45° away from the side being examined. Ensure the patient is comfortable — muscle tension elevates the CCA and makes insonation difficult.",
      },
      {
        category: "Transducer Positioning",
        text: "Begin in the longitudinal plane at the base of the neck just above the clavicle. Slide superiorly to the bifurcation, then rotate 90° for transverse sweeps. Keep the transducer footprint parallel to the vessel long axis to minimize refraction artifact.",
      },
      {
        category: "What to Assess",
        text: "Vessel diameter, intima-media thickness (IMT) at the far wall 1 cm below the bifurcation, plaque presence (location, echogenicity, surface texture, calcification), flow direction, spectral waveform (normal triphasic or biphasic pattern), and PSV. Document bilateral CCA PSV for comparison.",
      },
      {
        category: "Doppler",
        text: "Angle of insonation must be ≤60°. Sample volume 1.5–2 mm, placed mid-lumen. Normal CCA PSV: 50–100 cm/s. EDV typically 15–30 cm/s. A CCA PSV >100 cm/s warrants careful evaluation of the proximal ICA. Document waveform pulsatility — dampened waveform distal to a stenosis is a key indirect sign.",
      },
      {
        category: "Scanning Tip",
        text: "Use colour Doppler to identify the vessel before switching to spectral. Heel-toe the transducer to achieve the correct angle rather than steering the beam alone — this reduces aliasing and improves waveform quality. Compound imaging reduces speckle but may reduce plaque echogenicity; toggle off when characterising plaque.",
      },
      {
        category: "Pearl",
        text: "IMT measurement is most reproducible at the far wall of the distal CCA in the longitudinal plane. Use the leading-edge method (intima–lumen interface to media–adventitia interface). Normal IMT <0.9 mm; ≥1.5 mm = plaque by consensus definition.",
      },
      {
        category: "Pitfall",
        text: "A very proximal CCA origin stenosis (aortic arch or innominate) can produce a dampened, tardus-parvus waveform throughout the CCA — do not mistake this for normal low-flow. Always compare bilateral CCA waveforms; asymmetry >30% PSV difference is a red flag.",
      },
    ],
  },
  {
    id: "bifurcation",
    view: "Carotid Bifurcation",
    probe: "High-frequency linear (7–15 MHz) · Longitudinal & transverse at the bifurcation",
    tips: [
      {
        category: "Patient Positioning",
        text: "Supine with neck extended and head turned away from the side being examined. The bifurcation is typically at the level of the thyroid cartilage (C3–C4). Slight lateral rotation of the transducer may be needed to open the bifurcation angle.",
      },
      {
        category: "Transducer Positioning",
        text: "Identify the bifurcation in longitudinal plane first — look for the 'Y' or 'V' configuration. Rotate to transverse to assess the carotid bulb in cross-section. The ICA is typically posterolateral and larger; the ECA is anteromedial and smaller.",
      },
      {
        category: "What to Assess",
        text: "Plaque at the posterior wall of the carotid bulb (most common site), flow separation in the bulb (normal physiological low-flow zone), ICA and ECA origins, flow division, and any turbulence or colour aliasing indicating stenosis.",
      },
      {
        category: "Doppler",
        text: "Normal carotid bulb shows a zone of flow reversal (boundary layer separation) along the posterior wall — this is physiological and should not be mistaken for pathology. Document PSV at the ICA origin and proximal ICA. Colour Doppler mosaic pattern at the bulb = turbulence, not necessarily stenosis.",
      },
      {
        category: "Scanning Tip",
        text: "Use a wide colour box at the bifurcation to capture both ICA and ECA origins simultaneously. Reduce colour PRF (scale) to detect slow flow in the boundary layer. If the bifurcation is high (above the mandible), try a posterior approach with the patient's head turned more aggressively or use a smaller footprint transducer.",
      },
      {
        category: "Pearl",
        text: "The carotid bulb is the most common site for atherosclerotic plaque. Soft (echolucent) plaque at the posterior bulb wall is the highest-risk morphology for embolic stroke — document carefully and note surface irregularity.",
      },
      {
        category: "Pitfall",
        text: "Colour bleed from the adjacent jugular vein can obscure the carotid bifurcation. Reduce colour gain until venous signal disappears, then increase slowly. Alternatively, apply light probe pressure to partially compress the vein.",
      },
    ],
  },
  {
    id: "ica",
    view: "Internal Carotid Artery (ICA)",
    probe: "High-frequency linear (7–15 MHz) · Longitudinal & transverse from origin as far distally as possible",
    tips: [
      {
        category: "Patient Positioning",
        text: "Supine with neck extended and head turned away. For a high ICA, ask the patient to open their mouth slightly — this displaces the mandible and allows access to the distal ICA. A posterior approach (transducer behind the sternocleidomastoid) is useful for posterolaterally positioned vessels.",
      },
      {
        category: "Transducer Positioning",
        text: "Follow the ICA from its origin at the bifurcation superiorly. The ICA has no branches in the neck — use this to confirm identity. Evaluate in both longitudinal and transverse planes. Measure PSV at the point of maximal stenosis and 1–2 cm distal to the stenosis (post-stenotic zone).",
      },
      {
        category: "What to Assess",
        text: "Plaque morphology and distribution, degree of stenosis (NASCET criteria: PSV, EDV, ICA/CCA ratio), flow direction, waveform character (low-resistance pattern normal), and distal waveform for post-stenotic turbulence. Document the length of any stenotic segment.",
      },
      {
        category: "Doppler",
        text: "Normal ICA PSV: 50–100 cm/s. Low-resistance waveform with continuous forward diastolic flow. PSV >125 cm/s = ≥50% stenosis (NASCET). PSV >230 cm/s = ≥70% stenosis. EDV >100 cm/s = ≥80% stenosis. ICA/CCA PSV ratio >4.0 = ≥70% stenosis. Use the ICA/CCA calculator below.",
      },
      {
        category: "Scanning Tip",
        text: "Always measure PSV at the point of highest velocity (narrowest lumen). Angle correction must be ≤60° and parallel to the vessel wall — not the colour flow jet. A string sign (near-total occlusion) requires power Doppler or contrast-enhanced ultrasound; do not call total occlusion without these.",
      },
      {
        category: "Pearl",
        text: "Post-stenotic spectral broadening and turbulence extend 3–5 vessel diameters beyond the stenosis. If you see a normal PSV but turbulent waveform, look proximally for a missed stenosis. Tardus-parvus waveform in the ICA with a normal CCA = high-grade proximal ICA stenosis.",
      },
      {
        category: "Pitfall",
        text: "Heavily calcified plaque causes acoustic shadowing that can obscure the lumen. Use multiple imaging planes and colour Doppler to identify residual flow. If the vessel cannot be adequately visualised, document this clearly — CT angiography or MR angiography is indicated.",
      },
    ],
  },
  {
    id: "eca",
    view: "External Carotid Artery (ECA)",
    probe: "High-frequency linear (7–15 MHz) · Longitudinal plane, identify at least one branch",
    tips: [
      {
        category: "Patient Positioning",
        text: "Supine with neck extended and head turned away. The ECA is anteromedial to the ICA at the bifurcation. It is typically smaller in calibre and has a higher-resistance waveform.",
      },
      {
        category: "Transducer Positioning",
        text: "Follow the ECA from its origin at the bifurcation superiorly. Identify a branch (superior thyroid artery is the most accessible) to confirm ECA identity. Evaluate in longitudinal plane with spectral Doppler.",
      },
      {
        category: "What to Assess",
        text: "Flow direction, waveform character (high-resistance with sharp systolic peak and minimal diastolic flow), plaque at the origin, and any stenosis. The ECA is less commonly stenosed than the ICA but can be a source of collateral flow in ICA occlusion.",
      },
      {
        category: "Doppler",
        text: "Normal ECA waveform: triphasic or biphasic high-resistance pattern. PSV typically 50–100 cm/s. Temporal tap manoeuvre: tapping the pre-auricular temporal artery produces oscillations in the ECA spectral waveform — this confirms ECA identity and is pathognomonic.",
      },
      {
        category: "Scanning Tip",
        text: "Perform the temporal tap test on every exam to confirm ECA vs ICA identity. Tap the temporal artery just anterior to the ear at 2–3 Hz while watching the spectral waveform — the ECA will show characteristic notches synchronous with each tap. The ICA will not respond.",
      },
      {
        category: "Pearl",
        text: "In ICA occlusion, the ECA may reconstitute the ophthalmic artery via collateral flow, causing the ECA waveform to become low-resistance (mimicking the ICA). Always perform the temporal tap test and look for reversal of ophthalmic artery flow if ICA occlusion is suspected.",
      },
      {
        category: "Pitfall",
        text: "The ECA and ICA can be confused, especially when the ICA is occluded and the ECA has a low-resistance waveform. Anatomical position (ECA anteromedial), smaller calibre, presence of branches, and the temporal tap test are the key differentiators.",
      },
    ],
  },
  {
    id: "vertebral",
    view: "Vertebral Artery",
    probe: "High-frequency linear (7–15 MHz) · Longitudinal plane between transverse processes or at origin",
    tips: [
      {
        category: "Patient Positioning",
        text: "Supine with neck extended and head turned slightly away. The vertebral artery is best imaged in the mid-neck between the transverse processes of C4–C6, where it appears as a pulsatile vessel with characteristic acoustic shadowing from the transverse foramina on either side.",
      },
      {
        category: "Transducer Positioning",
        text: "Place the transducer in the longitudinal plane lateral to the CCA. Slide laterally until you see the vertebral artery between the acoustic shadows of the transverse processes. Alternatively, image at the origin from the subclavian artery just proximal to the transverse foramen of C6.",
      },
      {
        category: "What to Assess",
        text: "Flow direction (should be antegrade — toward the head), waveform character (low-resistance, similar to ICA), PSV, and any reversal of flow (subclavian steal). Document bilateral vertebral arteries — asymmetry in size is common (dominant left vertebral in ~60% of cases).",
      },
      {
        category: "Doppler",
        text: "Normal vertebral PSV: 30–60 cm/s. Low-resistance waveform with continuous forward diastolic flow. Retrograde (reversed) flow = complete subclavian steal. Alternating or to-and-fro flow = partial subclavian steal. Perform reactive hyperaemia test (blood pressure cuff on ipsilateral arm) to provoke latent steal.",
      },
      {
        category: "Scanning Tip",
        text: "If the vertebral artery is difficult to find, locate the CCA first, then slide the transducer laterally 1–2 cm. The vertebral artery will appear between the acoustic shadows of the transverse processes. Colour Doppler helps distinguish it from the vertebral vein (venous flow is non-pulsatile and augments with respiration).",
      },
      {
        category: "Pearl",
        text: "Hypoplastic vertebral artery (diameter <2 mm) is a normal variant in ~10% of patients. It should not be mistaken for pathology. A PSV <20 cm/s or absent diastolic flow in a small vertebral artery is consistent with hypoplasia, not stenosis.",
      },
      {
        category: "Pitfall",
        text: "The vertebral vein runs alongside the artery and can be confused with it. The vein is non-pulsatile, augments with Valsalva, and shows low-velocity venous flow on spectral Doppler. Always confirm arterial identity with spectral Doppler before documenting vertebral artery findings.",
      },
    ],
  },
  {
    id: "vertebral",
    view: "Subclavian Artery",
    probe: "High-frequency linear (7–15 MHz) or curved array (5–2 MHz) for deep vessels · Supraclavicular approach",
    tips: [
      {
        category: "Patient Positioning",
        text: "Supine with the head turned away from the side being examined and the ipsilateral shoulder depressed. A rolled towel under the ipsilateral shoulder can help. For the left subclavian, a slight right lateral tilt of the patient may improve access. Measure bilateral brachial blood pressures before scanning — a >15 mmHg inter-arm difference is the clinical threshold for subclavian stenosis.",
      },
      {
        category: "Transducer Positioning",
        text: "Place the transducer in the supraclavicular fossa in the transverse plane. Angle the transducer inferiorly (toward the chest) to image the subclavian artery as it passes over the first rib. Rotate to longitudinal for spectral Doppler. The right subclavian arises from the innominate artery; the left subclavian arises directly from the aortic arch and may be difficult to image proximally.",
      },
      {
        category: "What to Assess",
        text: "Vessel patency, plaque, stenosis, PSV, waveform character (triphasic high-resistance normal), and flow direction in the ipsilateral vertebral artery. A proximal subclavian stenosis or occlusion causes retrograde vertebral artery flow (subclavian steal syndrome). Document bilateral subclavian PSV and bilateral brachial blood pressures.",
      },
      {
        category: "Doppler",
        text: "Normal subclavian PSV: 60–120 cm/s. Triphasic high-resistance waveform. PSV >240 cm/s or a PSV ratio >2.0 across a stenosis = haemodynamically significant stenosis. A monophasic dampened waveform distal to a stenosis (tardus-parvus) indicates significant proximal obstruction. Always correlate with ipsilateral vertebral artery flow direction.",
      },
      {
        category: "Scanning Tip",
        text: "Use a low PRF (scale) and increase colour gain to detect slow or reversed flow in the vertebral artery when subclavian steal is suspected. The reactive hyperaemia test (inflate a blood pressure cuff on the ipsilateral arm to >200 mmHg for 3 minutes, then release) can provoke latent subclavian steal — watch for reversal of vertebral artery flow on release.",
      },
      {
        category: "Pearl",
        text: "Subclavian steal can be complete (permanent retrograde vertebral flow) or partial (alternating or to-and-fro vertebral flow at rest, converting to full reversal with reactive hyperaemia). Always image the ipsilateral vertebral artery when subclavian stenosis is suspected — the vertebral artery waveform is the most sensitive indicator of haemodynamic significance.",
      },
      {
        category: "Pitfall",
        text: "The left subclavian artery origin is deep and may not be visualised in all patients. If the proximal vessel is not seen, document the mid-subclavian waveform and note whether it is triphasic (normal) or dampened (proximal obstruction suspected). CT angiography is indicated when the proximal left subclavian cannot be adequately assessed.",
      },
    ],
  },
];

// ─── Exam Tips ─────────────────────────────────────────────────────────────────
const examTips = [
  {
    category: "Preparation",
    text: "No special patient preparation is required. However, document bilateral brachial blood pressures before the exam — a >15 mmHg inter-arm difference is the clinical threshold for subclavian stenosis and should prompt careful subclavian and vertebral artery evaluation.",
  },
  {
    category: "Scanning Tip",
    text: "Differentiating ICA from ECA: The ICA is typically posterolateral, larger, and has a low-resistance waveform with continuous diastolic flow. The ECA is anteromedial, smaller, has a high-resistance triphasic waveform, and shows characteristic oscillations with the temporal tap test. Always perform the temporal tap test.",
  },
  {
    category: "Scanning Tip",
    text: "Angle correction: Maintain a consistent angle of insonation ≤60° for all spectral Doppler measurements. The angle correction cursor must be placed parallel to the vessel wall (not the colour flow jet). Errors in angle correction are the most common source of PSV measurement error.",
  },
  {
    category: "Scanning Tip",
    text: "Stenosis measurement: PSV is measured at the point of maximum velocity within the stenosis. The ICA/CCA PSV ratio corrects for systemic haemodynamic variation (cardiac output, heart rate) and is more reproducible than PSV alone. Use the ICA/CCA calculator on this page.",
  },
  {
    category: "Pitfall",
    text: "Near-occlusion vs. total occlusion: Use power Doppler and a low-flow scale (low PRF, high colour gain) to look for a 'string sign' in cases of suspected near-total ICA occlusion. Do not call total occlusion without power Doppler or contrast-enhanced ultrasound — the consequences of missing a patent but severely stenosed ICA are significant.",
  },
  {
    category: "Pearl",
    text: "Indirect signs of proximal disease: A tardus-parvus (slow rise, rounded peak) waveform in the CCA or ICA suggests significant proximal stenosis (aortic arch, innominate, or proximal CCA). Always compare bilateral waveforms — asymmetry is the key finding. If indirect signs are present, extend the exam to include the subclavian artery and vertebral artery.",
  },
];

// ─── ICA/CCA Stenosis Grading Table (SVU/SRU Consensus 2003) ──────────────────
const stenosisGrades = [
  { grade: "Normal", icaPsv: "<125", icaEdv: "<40", ratio: "<2.0", notes: "No plaque or intimal thickening" },
  { grade: "<50%", icaPsv: "<125", icaEdv: "<40", ratio: "<2.0", notes: "Plaque or intimal thickening present" },
  { grade: "50–69%", icaPsv: "125–230", icaEdv: "40–100", ratio: "2.0–4.0", notes: "Moderate stenosis" },
  { grade: "≥70% to near-occlusion", icaPsv: ">230", icaEdv: ">100", ratio: ">4.0", notes: "Severe stenosis; high stroke risk" },
  { grade: "Near-occlusion", icaPsv: "Variable (may be low)", icaEdv: "Variable", ratio: "Variable", notes: "String sign; use power Doppler" },
  { grade: "Total occlusion", icaPsv: "No flow", icaEdv: "No flow", ratio: "N/A", notes: "Confirm with power Doppler / CEUS" },
];

// ─── Tip Colours ───────────────────────────────────────────────────────────────
const TIP_COLORS: Record<string, string> = {
  "Patient Positioning": "#0e4a50",
  "Transducer Positioning": "#189aa1",
  "What to Assess": "#0e1e2e",
  "Doppler": "#4a6fa5",
  "Scanning Tip": "#189aa1",
  "Optimization": "#0e4a50",
  "Pitfall": "#d97706",
  "Pearl": "#059669",
  "Preparation": "#6366f1",
};

// ─── ICA/CCA Calculator Component ─────────────────────────────────────────────
function IcaCcaCalculator() {
  const [icaPsv, setIcaPsv] = useState("");
  const [ccaPsv, setCcaPsv] = useState("");
  const [icaEdv, setIcaEdv] = useState("");
  const [showTable, setShowTable] = useState(false);

  const ratio = icaPsv && ccaPsv && parseFloat(ccaPsv) > 0
    ? (parseFloat(icaPsv) / parseFloat(ccaPsv)).toFixed(2)
    : null;

  const getStenosisGrade = () => {
    const psv = parseFloat(icaPsv);
    const edv = parseFloat(icaEdv);
    const r = parseFloat(ratio || "0");
    if (!psv) return null;
    if (psv < 125 && r < 2.0) return { grade: "<50% or Normal", color: "#059669", bg: "#f0fdf4" };
    if (psv >= 125 && psv < 230 && r >= 2.0 && r < 4.0) return { grade: "50–69% Stenosis", color: "#d97706", bg: "#fffbeb" };
    if (psv >= 230 && (edv >= 100 || r >= 4.0)) return { grade: "≥70% Stenosis (Severe)", color: "#dc2626", bg: "#fef2f2" };
    if (psv >= 230) return { grade: "≥70% Stenosis (Severe)", color: "#dc2626", bg: "#fef2f2" };
    return { grade: "Indeterminate — review criteria", color: "#6b7280", bg: "#f9fafb" };
  };

  const grade = getStenosisGrade();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
      <button
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
        onClick={() => setShowTable(!showTable)}
      >
        <Calculator className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
        <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
          ICA/CCA PSV Ratio Calculator &amp; Stenosis Grading
        </span>
        {showTable ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {showTable && (
        <div className="border-t border-gray-100 p-5 space-y-5">
          {/* Calculator inputs */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Enter Doppler Values (cm/s)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ICA PSV (cm/s)</label>
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={icaPsv}
                  onChange={e => setIcaPsv(e.target.value)}
                  placeholder="e.g. 180"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CCA PSV (cm/s)</label>
                <input
                  type="number"
                  min="0"
                  max="400"
                  value={ccaPsv}
                  onChange={e => setCcaPsv(e.target.value)}
                  placeholder="e.g. 70"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ICA EDV (cm/s) <span className="font-normal text-gray-400">(optional)</span></label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={icaEdv}
                  onChange={e => setIcaEdv(e.target.value)}
                  placeholder="e.g. 55"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Result */}
          {ratio && (
            <div
              className="rounded-xl p-4 border"
              style={{ borderColor: (grade?.color || "#189aa1") + "40", background: grade?.bg || "#f0fbfc" }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-0.5">ICA/CCA PSV Ratio</p>
                  <p className="text-3xl font-black" style={{ color: grade?.color || "#189aa1", fontFamily: "Merriweather, serif" }}>
                    {ratio}
                  </p>
                </div>
                {grade && (
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-0.5">Stenosis Grade</p>
                    <p className="text-lg font-black" style={{ color: grade.color, fontFamily: "Merriweather, serif" }}>
                      {grade.grade}
                    </p>
                  </div>
                )}
              </div>
              {icaEdv && parseFloat(icaEdv) > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  ICA EDV {icaEdv} cm/s — {parseFloat(icaEdv) >= 100 ? "≥100 cm/s supports ≥80% stenosis" : parseFloat(icaEdv) >= 40 ? "40–100 cm/s consistent with 50–69% stenosis" : "<40 cm/s consistent with <50% stenosis"}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1.5">Based on SVU/SRU Consensus Criteria (Grant et al., 2003). Clinical correlation required.</p>
            </div>
          )}

          {/* Stenosis grading reference table */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">SVU/SRU Stenosis Grading Reference</p>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
                    <th className="px-3 py-2 text-left text-white font-bold">Grade</th>
                    <th className="px-3 py-2 text-left text-[#4ad9e0] font-bold">ICA PSV</th>
                    <th className="px-3 py-2 text-left text-[#4ad9e0] font-bold">ICA EDV</th>
                    <th className="px-3 py-2 text-left text-[#4ad9e0] font-bold">ICA/CCA Ratio</th>
                    <th className="px-3 py-2 text-left text-white/70 font-bold hidden sm:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {stenosisGrades.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 font-semibold text-gray-800">{row.grade}</td>
                      <td className="px-3 py-2 text-gray-600">{row.icaPsv}</td>
                      <td className="px-3 py-2 text-gray-600">{row.icaEdv}</td>
                      <td className="px-3 py-2 text-gray-600">{row.ratio}</td>
                      <td className="px-3 py-2 text-gray-400 hidden sm:table-cell">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Reference: Grant EG et al. Carotid Artery Stenosis: Gray-Scale and Doppler US Diagnosis — Society of Radiologists in Ultrasound Consensus Conference. <em>Radiology</em>. 2003;229(2):340–346.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Blood Pressure Panel ──────────────────────────────────────────────────────
function BilateralBPPanel() {
  const [rightSBP, setRightSBP] = useState("");
  const [rightDBP, setRightDBP] = useState("");
  const [leftSBP, setLeftSBP] = useState("");
  const [leftDBP, setLeftDBP] = useState("");
  const [show, setShow] = useState(false);

  const diff = rightSBP && leftSBP
    ? Math.abs(parseInt(rightSBP) - parseInt(leftSBP))
    : null;

  const isSignificant = diff !== null && diff > 15;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
      <button
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
        onClick={() => setShow(!show)}
      >
        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: "#189aa1" }} />
        <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
          Bilateral Brachial Blood Pressure Documentation
        </span>
        {show ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {show && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          <p className="text-xs text-gray-500">
            Measure bilateral brachial blood pressures before the exam. An inter-arm systolic difference &gt;15 mmHg is the clinical threshold for subclavian stenosis and should prompt careful evaluation of the subclavian artery and ipsilateral vertebral artery flow direction.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#189aa1] uppercase tracking-wider">Right Arm</p>
              <div className="flex gap-2 items-center">
                <input
                  type="number" min="60" max="250" value={rightSBP}
                  onChange={e => setRightSBP(e.target.value)}
                  placeholder="SBP"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]"
                />
                <span className="text-gray-400 text-sm">/</span>
                <input
                  type="number" min="40" max="150" value={rightDBP}
                  onChange={e => setRightDBP(e.target.value)}
                  placeholder="DBP"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]"
                />
              </div>
              {rightSBP && rightDBP && (
                <p className="text-sm font-bold text-gray-700">{rightSBP}/{rightDBP} mmHg</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#189aa1] uppercase tracking-wider">Left Arm</p>
              <div className="flex gap-2 items-center">
                <input
                  type="number" min="60" max="250" value={leftSBP}
                  onChange={e => setLeftSBP(e.target.value)}
                  placeholder="SBP"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]"
                />
                <span className="text-gray-400 text-sm">/</span>
                <input
                  type="number" min="40" max="150" value={leftDBP}
                  onChange={e => setLeftDBP(e.target.value)}
                  placeholder="DBP"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]"
                />
              </div>
              {leftSBP && leftDBP && (
                <p className="text-sm font-bold text-gray-700">{leftSBP}/{leftDBP} mmHg</p>
              )}
            </div>
          </div>

          {diff !== null && (
            <div
              className="rounded-xl p-4 border"
              style={{
                borderColor: isSignificant ? "#dc262640" : "#05966940",
                background: isSignificant ? "#fef2f2" : "#f0fdf4",
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: isSignificant ? "#dc2626" : "#059669" }}>
                Inter-Arm Systolic Difference
              </p>
              <p className="text-2xl font-black" style={{ color: isSignificant ? "#dc2626" : "#059669", fontFamily: "Merriweather, serif" }}>
                {diff} mmHg
              </p>
              <p className="text-xs mt-1" style={{ color: isSignificant ? "#dc2626" : "#059669" }}>
                {isSignificant
                  ? "⚠ >15 mmHg — clinically significant. Evaluate subclavian artery and ipsilateral vertebral artery flow direction."
                  : "✓ ≤15 mmHg — within normal limits."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CarotidScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [showExamTips, setShowExamTips] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const { mergeView } = useScanCoachOverrides("carotid");
  const currentView = useMemo(() => {
    const v = views[selectedView];
    if (!v) return v;
    const merged = mergeView({ ...v, id: v.id });
    const rawTips = merged.tips as unknown;
    if (Array.isArray(rawTips) && rawTips.length > 0 && typeof rawTips[0] === "string") {
      return { ...merged, tips: (rawTips as string[]).map(t => ({ category: "Scanning Tip", text: t })) };
    }
    return merged;
  }, [selectedView, mergeView]);

  return (
    <Layout>
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-8 md:py-10">
          <div className="mb-3">
            <BackToEchoAssist />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Scan className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">Carotid · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Vascular Extracranial Carotid Artery ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for extracranial carotid and vertebral artery ultrasound, aligned with current AIUM and SVU guidelines. Covers B-mode, color Doppler, and spectral Doppler technique with image optimization tips and stenosis grading criteria.
              </p>
              <div className="mt-3">
                <Link href="/carotid-navigator">
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border border-white/30 text-white/90 hover:bg-white/10 transition-all">
                    <Info className="w-3.5 h-3.5" />
                    Open Navigator
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Bilateral BP Panel */}
        <BilateralBPPanel />

        {/* View selector */}
        <div className="flex gap-2 flex-wrap mb-5">
          {views.map((v, i) => (
            <button
              key={i}
              onClick={() => setSelectedView(i)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: selectedView === i ? "#189aa1" : "white",
                color: selectedView === i ? "white" : "#189aa1",
                border: `1px solid ${selectedView === i ? "#189aa1" : "#189aa140"}`,
              }}
            >
              {v.view}
            </button>
          ))}
        </div>

        {/* Current view card */}
        {currentView && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
                <div
                  className="px-5 py-4 border-b border-gray-100"
                  style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 100%)" }}
                >
                  <h2 className="text-lg font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                    {currentView.view}
                  </h2>
                  <p className="text-[#4ad9e0] text-xs mt-0.5">{currentView.probe}</p>
                </div>

                {/* Image placeholder */}
                <div
                  className="mx-5 mt-4 rounded-xl flex items-center justify-center"
                  style={{ height: 180, background: "linear-gradient(135deg, #0e1e2e20, #189aa120)", border: "2px dashed #189aa140" }}
                >
                  <div className="text-center">
                    <Scan className="w-8 h-8 text-[#189aa1] mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-gray-400">Reference image placeholder</p>
                    <p className="text-xs text-gray-300">Add via Admin → ScanCoach Editor</p>
                  </div>
                </div>

                {/* Tips */}
                <div className="p-5 space-y-3">
                  {currentView.tips.map((tip, ti) => (
                    <div
                      key={ti}
                      className="rounded-xl p-4 border"
                      style={{
                        borderColor: (TIP_COLORS[tip.category] || "#189aa1") + "30",
                        background: (TIP_COLORS[tip.category] || "#189aa1") + "08",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TIP_COLORS[tip.category] || "#189aa1" }} />
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TIP_COLORS[tip.category] || "#189aa1" }}>
                          {tip.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                    </div>
                  ))}
                </div>
              </div>
        )}

        {/* ICA/CCA Calculator */}
        <IcaCcaCalculator />

        {/* Exam Tips */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <button
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
            onClick={() => setShowExamTips(!showExamTips)}
          >
            <Lightbulb className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
            <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
              Exam Tips
            </span>
            {showExamTips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showExamTips && (
            <div className="border-t border-gray-100 p-5 space-y-3">
              {examTips.map((tip, ti) => (
                <div
                  key={ti}
                  className="rounded-xl p-4 border"
                  style={{
                    borderColor: (TIP_COLORS[tip.category] || "#189aa1") + "30",
                    background: (TIP_COLORS[tip.category] || "#189aa1") + "08",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TIP_COLORS[tip.category] || "#189aa1" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TIP_COLORS[tip.category] || "#189aa1" }}>
                      {tip.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Billing Codes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <button
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
            onClick={() => setShowBilling(!showBilling)}
          >
            <Receipt className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
            <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>Billing Codes (CPT)</span>
            {showBilling ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showBilling && (
            <div className="border-t border-gray-100 p-5 space-y-5">
              <p className="text-xs text-gray-400 italic">For reference only — verify with current payer policies and local coverage determinations.</p>
              {carotidBilling.map((section, si) => (
                <div key={si}>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#189aa1] mb-2">{section.heading}</div>
                  <div className="space-y-2">
                    {section.codes.map((c, ci) => (
                      <div key={ci} className="rounded-lg border p-3" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-bold text-sm text-[#189aa1] flex-shrink-0">{c.code}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{c.description}</div>
                            {c.note && <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.note}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Reference */}
        <div className="text-xs text-gray-400 px-1 mt-4">
          Based on:{" "}
          <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">
            AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Extracranial Cerebrovascular System (2021)
          </a>{" "}
          &amp;{" "}
          <a href="https://www.svunet.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">
            SVU Guidelines
          </a>
        </div>
      </div>
    </Layout>
  );
}
