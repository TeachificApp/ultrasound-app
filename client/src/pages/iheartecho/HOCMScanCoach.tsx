/*
  HOCM ScanCoach
  Hypertrophic Obstructive Cardiomyopathy — Acquisition Guide
  Brand: Teal #189aa1, Aqua #4ad9e0 / HOCM accent: Teal #189aa1
  Fonts: Merriweather headings, Open Sans body
*/

import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { validateViewsAgainstRegistry } from "@/lib/scanCoachRegistry";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Heart,
  Info,
  Layers,
  Ruler,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import ScanCoachNavBar from "@/components/ScanCoachNavBar";
import { PremiumOverlay } from "@/components/PremiumOverlay";

const BRAND = "#189aa1";
const PURPLE = "#189aa1";

// ─── SVG WAVEFORM COMPONENTS ─────────────────────────────────────────────────

/** HOCM LVOT — dagger-shaped, late-peaking CW Doppler signal */
function HOCMDopplerWaveform() {
  // Represents ~3 cardiac cycles of a dagger-shaped LVOT signal (below baseline = away from probe in A5C)
  const w = 480;
  const h = 160;
  const baseline = 40; // top section is small LVOT forward flow, main signal is below

  // Build a dagger path: slow rise, late steep peak, rapid fall — repeated 3 times
  const cycle = (xOffset: number) => {
    const x0 = xOffset;
    const peakX = xOffset + 90;
    const endX = xOffset + 130;
    // Dagger: starts at baseline, slow early rise, then steep late acceleration to peak, rapid descent
    return `M ${x0},${baseline}
      C ${x0 + 20},${baseline} ${x0 + 30},${baseline + 5} ${x0 + 35},${baseline + 10}
      C ${x0 + 40},${baseline + 15} ${x0 + 45},${baseline + 20} ${x0 + 50},${baseline + 28}
      C ${x0 + 60},${baseline + 50} ${x0 + 70},${baseline + 75} ${x0 + 78},${baseline + 88}
      C ${x0 + 83},${baseline + 95} ${x0 + 87},${baseline + 100} ${peakX},${baseline + 108}
      C ${x0 + 95},${baseline + 100} ${x0 + 100},${baseline + 85} ${x0 + 105},${baseline + 60}
      C ${x0 + 110},${baseline + 35} ${x0 + 115},${baseline + 15} ${x0 + 120},${baseline + 5}
      L ${endX},${baseline}`;
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-800" style={{ background: "#0a0a0a" }}>
      {/* Label bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ad9e0" }} />
          <span className="text-xs font-bold" style={{ color: "#4ad9e0" }}>HOCM LVOT — CW Doppler (A5C)</span>
        </div>
        <span className="text-[10px] text-gray-500">Dagger-shaped · Late-peaking · High velocity</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full" style={{ maxHeight: 180 }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1.0].map(f => (
          <line key={f} x1={0} y1={baseline + f * 110} x2={w} y2={baseline + f * 110}
            stroke="#1f2937" strokeWidth={0.5} strokeDasharray="4,4" />
        ))}
        {/* Baseline */}
        <line x1={0} y1={baseline} x2={w} y2={baseline} stroke="#374151" strokeWidth={1} />
        {/* Velocity labels */}
        <text x={8} y={baseline + 55} fill="#6b7280" fontSize={9}>1 m/s</text>
        <text x={8} y={baseline + 110} fill="#6b7280" fontSize={9}>2 m/s</text>
        <text x={8} y={baseline + 148} fill="#189aa1" fontSize={9} fontWeight="bold">4+ m/s</text>

        {/* Dagger waveforms — 3 cycles */}
        {[20, 160, 300].map(x => (
          <path key={x} d={cycle(x)} fill="rgba(74,217,224,0.15)" stroke="#4ad9e0" strokeWidth={2} />
        ))}

        {/* Peak annotation */}
        <line x1={110} y1={baseline + 108} x2={145} y2={baseline + 108} stroke="#189aa1" strokeWidth={1} strokeDasharray="3,2" />
        <text x={148} y={baseline + 112} fill="#189aa1" fontSize={9} fontWeight="bold">Peak (late systole)</text>

        {/* Dagger label */}
        <text x={85} y={baseline + 135} fill="#4ad9e0" fontSize={9} textAnchor="middle">▲ Dagger tip</text>
      </svg>
      <div className="px-4 py-2 border-t border-gray-800">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <span className="font-bold" style={{ color: "#4ad9e0" }}>Key features:</span> Slow early rise → steep late acceleration → sharp peak in late systole → rapid fall. Peak velocity typically 3–6 m/s. Measure at the very tip of the dagger.
        </p>
      </div>
    </div>
  );
}

/** MR — holosystolic, broad, high-velocity CW Doppler signal */
function MRDopplerWaveform() {
  const w = 480;
  const h = 160;
  const baseline = 40;

  // MR: starts immediately at onset of systole, broad plateau, high velocity, ends at end-systole
  const mrCycle = (xOffset: number) => {
    const endX = xOffset + 130;
    return `M ${xOffset},${baseline}
      C ${xOffset + 5},${baseline} ${xOffset + 10},${baseline + 30} ${xOffset + 18},${baseline + 85}
      C ${xOffset + 22},${baseline + 100} ${xOffset + 28},${baseline + 108} ${xOffset + 35},${baseline + 112}
      C ${xOffset + 50},${baseline + 118} ${xOffset + 70},${baseline + 118} ${xOffset + 90},${baseline + 115}
      C ${xOffset + 100},${baseline + 112} ${xOffset + 108},${baseline + 105} ${xOffset + 115},${baseline + 90}
      C ${xOffset + 120},${baseline + 70} ${xOffset + 125},${baseline + 35} ${xOffset + 128},${baseline + 8}
      L ${endX},${baseline}`;
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-800" style={{ background: "#0a0a0a" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ad9e0" }} />
          <span className="text-xs font-bold" style={{ color: "#4ad9e0" }}>MR — CW Doppler (A4C / A2C)</span>
        </div>
        <span className="text-[10px] text-gray-500">Holosystolic · Broad · Uniform velocity</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full" style={{ maxHeight: 180 }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1.0].map(f => (
          <line key={f} x1={0} y1={baseline + f * 110} x2={w} y2={baseline + f * 110}
            stroke="#1f2937" strokeWidth={0.5} strokeDasharray="4,4" />
        ))}
        <line x1={0} y1={baseline} x2={w} y2={baseline} stroke="#374151" strokeWidth={1} />
        <text x={8} y={baseline + 55} fill="#6b7280" fontSize={9}>1 m/s</text>
        <text x={8} y={baseline + 110} fill="#6b7280" fontSize={9}>2 m/s</text>
        <text x={8} y={baseline + 148} fill="#4ad9e0" fontSize={9} fontWeight="bold">4–5 m/s</text>

        {/* MR waveforms — 3 cycles */}
        {[20, 165, 310].map(x => (
          <path key={x} d={mrCycle(x)} fill="rgba(74,217,224,0.12)" stroke="#4ad9e0" strokeWidth={2} />
        ))}

        {/* Plateau annotation */}
        <line x1={55} y1={baseline + 118} x2={105} y2={baseline + 118} stroke="#4ad9e0" strokeWidth={1.5} />
        <text x={80} y={baseline + 132} fill="#4ad9e0" fontSize={9} textAnchor="middle">Broad plateau</text>

        {/* Holosystolic label */}
        <line x1={20} y1={baseline + 145} x2={148} y2={baseline + 145} stroke="#4ad9e0" strokeWidth={1} strokeDasharray="3,2" />
        <text x={84} y={baseline + 158} fill="#4ad9e0" fontSize={9} textAnchor="middle">← Holosystolic →</text>
      </svg>
      <div className="px-4 py-2 border-t border-gray-800">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <span className="font-bold" style={{ color: "#4ad9e0" }}>Key features:</span> Starts at onset of systole (with QRS), broad uniform plateau, high velocity (4–5 m/s), ends at end-systole (with S2). Dense spectral envelope. No late-peaking dagger shape.
        </p>
      </div>
    </div>
  );
}

// ─── VIEW DATA ────────────────────────────────────────────────────────────────

const views = [
  {
    id: "plax",
    label: "PLAX",
    fullName: "Parasternal Long Axis",
    color: BRAND,
    badge: "Key View",
    patientPosition: "Left lateral decubitus (30–45°), left arm raised",
    probePosition: "Left parasternal border, 3rd–4th ICS, indicator toward right shoulder (2–3 o'clock)",
    depth: "14–16 cm",
    focus: "MV, IVS, LVOT",
    description: "The PLAX is the primary view for identifying SAM, measuring wall thickness, and assessing LVOT morphology. M-mode through the MV shows classic SAM pattern.",
    howToGet: [
      "Position probe at 3rd–4th left ICS, indicator toward right shoulder",
      "Tilt probe slightly inferiorly to open up the LVOT",
      "Optimize depth to include aortic root and descending aorta",
      "Use zoom mode on MV to assess SAM and leaflet morphology",
    ],
    tips: [
      { label: "SAM identification", text: "Look for anterior motion of MV leaflet toward IVS in systole. Use M-mode through MV for timing and duration of SAM-septal contact." },
      { label: "Wall thickness", text: "Measure IVS at end-diastole, perpendicular to septum, at the level of MV chordae. Measure at multiple levels if asymmetric hypertrophy." },
      { label: "LVOT diameter", text: "Measure LVOT diameter 1 cm below AV at end-systole, inner edge to inner edge. Required for stroke volume calculation." },
      { label: "AV M-mode: Systolic Notching", text: "Place the M-mode cursor through the aortic valve leaflets in PLAX. Normal pattern: leaflets open fully in early systole and remain open (smooth box shape) until end-systole. In HOCM with dynamic LVOT obstruction, the AV leaflets open normally in early systole, then show a mid-systolic notch (partial or complete closure) as the LVOT gradient peaks and the Venturi effect — combined with SAM-septal contact — reduces outflow. The leaflets partially close mid-systole, creating a characteristic notch or 'W' shape on M-mode, then may reopen slightly before final closure at end-systole. Degree of notching correlates with gradient severity: mild notch = moderate obstruction; complete mid-systolic closure = severe obstruction (gradient often >50 mmHg). Provocation (Valsalva, amyl nitrite) worsens the notching. Distinguish from AS: AS shows globally reduced leaflet separation throughout systole (no notch, no normal early opening); HOCM shows full early opening followed by mid-systolic notch." },
    ],
    pitfalls: [
      "Foreshortening of LVOT — ensure beam is truly parallel to septum",
      "Measuring IVS at incorrect level — measure at MV chordae level, not basal",
      "Missing posterior leaflet SAM — check both leaflets",
    ],
    structures: ["IVS (basal, mid)", "LVPW", "LVOT", "Anterior MV leaflet", "Aortic root", "LA"],
    measurements: ["IVS thickness (mm)", "LVPW thickness (mm)", "LVEDD / LVESD (mm)", "LVOT diameter (mm)", "Aortic root (mm)"],
    criteria: [
      {
        parameter: "IVS Thickness (at MV chordae level)",
        normal: "< 1.2 cm (men), < 1.1 cm (women)",
        borderline: "1.2–1.4 cm (no FHx) · 1.0–1.2 cm (FHx)",
        abnormal: "≥ 1.5 cm (no FHx) · ≥ 1.3 cm (FHx of HCM)",
        provocationTrigger: true,
        note: "Wall thickness ≥1.3 cm with family history of HCM, or ≥1.5 cm without, meets diagnostic threshold. Measure at end-diastole, perpendicular to septum.",
      },
      {
        parameter: "LVPW Thickness",
        normal: "< 1.1 cm",
        borderline: "1.1–1.3 cm",
        abnormal: "≥ 1.4 cm (asymmetric if IVS:LVPW ratio > 1.3)",
        provocationTrigger: false,
        note: "Asymmetric septal hypertrophy (IVS:LVPW ratio > 1.3) is the classic HOCM pattern.",
      },
      {
        parameter: "SAM (Systolic Anterior Motion)",
        normal: "Absent",
        borderline: "Mild SAM — no septal contact",
        abnormal: "SAM with septal contact (confirms obstruction)",
        provocationTrigger: true,
        note: "Any SAM with septal contact is significant. Duration of contact correlates with gradient severity.",
      },
      {
        parameter: "LVOT Diameter",
        normal: "≥ 2.0 cm",
        borderline: "1.7–1.9 cm",
        abnormal: "< 1.7 cm (narrowed LVOT — increases obstruction risk)",
        provocationTrigger: false,
        note: "Measure 1 cm below AV at end-systole, inner edge to inner edge. Required for VTI-based stroke volume.",
      },
      {
        parameter: "AV M-mode: Systolic Notching",
        normal: "Smooth box-shaped opening — leaflets fully open throughout systole",
        borderline: "Mild mid-systolic notch — partial leaflet closure, leaflets remain partially open",
        abnormal: "Prominent notch or complete mid-systolic closure ('W' pattern on M-mode)",
        provocationTrigger: true,
        note: "Place M-mode cursor through the aortic valve leaflets in PLAX. Normal: leaflets open fully in early systole and remain open (box shape) until end-systole. HOCM: as the LVOT gradient peaks in mid-systole, the Venturi effect and SAM-septal contact cause partial or complete AV leaflet re-closure — producing a notch or 'W' shape on M-mode. Severity of notching correlates with gradient: mild notch = moderate obstruction; complete mid-systolic closure = severe obstruction (gradient often >50 mmHg). Provocation (Valsalva, amyl nitrite) worsens the notching. Key distinction from AS: AS shows globally reduced leaflet separation throughout systole (no notch, no normal early opening); HOCM shows full early opening followed by mid-systolic notch.",
      },
    ],
  },
  {
    id: "psax_mv",
    label: "PSAX MV",
    fullName: "Parasternal Short Axis — Mitral Valve Level",
    color: BRAND,
    badge: "SAM Assessment",
    patientPosition: "Left lateral decubitus (30–45°)",
    probePosition: "Left parasternal border, 3rd–4th ICS, indicator toward left shoulder (10–11 o'clock)",
    depth: "12–14 cm",
    focus: "MV morphology, SAM pattern",
    description: "PSAX at MV level shows the classic fish-mouth MV opening and allows assessment of MV leaflet morphology, elongation, and coaptation. Useful for identifying anomalous papillary muscle insertion.",
    howToGet: [
      "From PLAX, rotate probe 90° clockwise (indicator toward left shoulder)",
      "Tilt to MV level — fish-mouth appearance of MV",
      "Assess leaflet length, redundancy, and coaptation",
    ],
    tips: [
      { label: "Leaflet elongation", text: "Elongated anterior leaflet (>3 cm) predisposes to SAM. Assess in PSAX and PLAX." },
      { label: "Papillary muscles", text: "Assess PM morphology — bifid, hypertrophied, or anteriorly displaced PMs contribute to obstruction." },
      { label: "Mid-ventricular obstruction", text: "PSAX at PM level: hypertrophied PMs may cause mid-ventricular obstruction. Use PW Doppler to localize." },
    ],
    pitfalls: [
      "Confusing MV coaptation gap with MR — use color Doppler to confirm",
      "Missing anomalous PM insertion — look for direct PM-to-MV leaflet attachment",
    ],
    structures: ["Anterior MV leaflet", "Posterior MV leaflet", "Papillary muscles", "LV cavity"],
    measurements: ["MV leaflet length (mm)", "PM diameter (mm)"],
    criteria: [
      {
        parameter: "Anterior MV Leaflet Length",
        normal: "< 2.5 cm",
        borderline: "2.5–3.0 cm",
        abnormal: "≥ 3.0 cm (elongated — high SAM risk)",
        provocationTrigger: true,
        note: "Elongated anterior leaflet is an independent predictor of SAM. Assess in both PSAX and PLAX.",
      },
      {
        parameter: "Papillary Muscle Morphology",
        normal: "Normal size, posterior position",
        borderline: "Mildly hypertrophied or anteriorly positioned",
        abnormal: "Bifid, hypertrophied, or direct PM-to-MV insertion",
        provocationTrigger: true,
        note: "Anomalous PM insertion (direct PM-to-leaflet) causes obstruction independent of SAM. Assess at PM level in PSAX.",
      },
    ],
  },
  {
    id: "a4c",
    label: "A4C",
    fullName: "Apical 4-Chamber",
    color: "#0e7490",
    badge: "MR Assessment",
    patientPosition: "Steep left lateral decubitus (60–90°), left arm raised and back",
    probePosition: "Cardiac apex (PMI), indicator toward left (3 o'clock). Palpate apex first.",
    depth: "16–18 cm",
    focus: "MR jet direction, LA size, RV",
    description: "A4C is essential for assessing MR jet direction (posterior = SAM-related vs. central/anterior = primary MV disease), LA volume, and RV function. Color Doppler MR assessment is performed here.",
    howToGet: [
      "Palpate the point of maximal impulse (PMI) — this is the true apex",
      "Position probe at PMI, indicator toward patient's left (3 o'clock)",
      "Tilt probe slightly toward sternum to open the LVOT for A5C",
      "Steep left lateral decubitus is critical — do not scan supine",
    ],
    tips: [
      { label: "MR jet direction", text: "SAM-related MR: posteriorly directed jet (anterior leaflet tethered toward septum). Primary MV disease: central or anteriorly directed jet. This distinction is critical for management." },
      { label: "LA volume", text: "Trace LA at end-systole in A4C and A2C for biplane LAVI. LA dilation (>34 mL/m²) reflects chronic elevated filling pressure." },
      { label: "Tissue Doppler", text: "Sample at septal and lateral mitral annulus for e' and E/e' ratio. HOCM: e' typically reduced despite hyperdynamic systolic function." },
    ],
    pitfalls: [
      "Foreshortened A4C — move probe laterally and inferiorly to true apex",
      "Missing posteriorly directed MR jet — angle color Doppler sector to include full LA",
      "Confusing LVOT flow with MR on color Doppler — use PW to localize",
    ],
    structures: ["LV (all walls)", "MV", "LA", "RV", "TV", "RA"],
    measurements: ["LAVI (mL/m²)", "Septal e' (cm/s)", "Lateral e' (cm/s)", "E/e' ratio", "RV basal diameter (mm)", "TAPSE (mm)"],
    criteria: [
      {
        parameter: "MR Jet Direction",
        normal: "Absent or trivial",
        borderline: "Mild posterior jet (SAM-related)",
        abnormal: "Moderate–severe posteriorly directed MR (SAM-related) or central/anterior jet (primary MV disease)",
        provocationTrigger: true,
        note: "SAM-related MR: posteriorly directed. Primary MV disease: central or anteriorly directed. Distinction is critical — SAM-related MR resolves with LVOT obstruction relief.",
      },
      {
        parameter: "LA Volume Index (LAVI)",
        normal: "≤ 34 mL/m²",
        borderline: "34–40 mL/m²",
        abnormal: "≥ 40 mL/m² (dilated — reflects chronic elevated filling pressure)",
        provocationTrigger: false,
        note: "LA dilation in HOCM reflects chronically elevated LV filling pressures. Correlates with AF risk and symptom burden.",
      },
      {
        parameter: "Septal e' (Tissue Doppler)",
        normal: "≥ 8 cm/s",
        borderline: "6–7 cm/s",
        abnormal: "< 6 cm/s (impaired relaxation despite hyperdynamic systole)",
        provocationTrigger: false,
        note: "HOCM characteristically shows reduced e' despite preserved or hyperdynamic EF — a hallmark of diastolic dysfunction.",
      },
      {
        parameter: "E/e' Ratio",
        normal: "< 8",
        borderline: "8–14",
        abnormal: "≥ 15 (elevated filling pressure)",
        provocationTrigger: false,
        note: "Use average of septal and lateral e'. Elevated E/e' in HOCM indicates diastolic dysfunction and elevated LV filling pressures.",
      },
    ],
  },
  {
    id: "a5c",
    label: "A5C",
    fullName: "Apical 5-Chamber (LVOT View)",
    color: PURPLE,
    badge: "CW Gradient — Primary",
    patientPosition: "Steep left lateral decubitus (60–90°), left arm raised and back",
    probePosition: "Same as A4C — tilt probe anteriorly (toward sternum) to bring LVOT into view",
    depth: "16–18 cm",
    focus: "CW Doppler LVOT gradient — primary view",
    description: "The A5C is the primary view for CW Doppler alignment with LVOT flow. Tilting anteriorly from A4C brings the LVOT and aortic valve into the imaging plane. This is the most important view for measuring resting and provoked LVOT gradients.",
    howToGet: [
      "From A4C, tilt probe anteriorly (toward sternum) until LVOT and AV appear",
      "Optimize to show LVOT, AV, and proximal ascending aorta in the same plane",
      "Switch to CW Doppler — align beam parallel to LVOT flow",
      "Look for dagger-shaped signal: slow rise, late steep peak, rapid fall",
    ],
    tips: [
      { label: "CW beam alignment", text: "Minimize angle between CW beam and LVOT flow (<20°). Rotate probe slightly to optimize alignment. Small angle errors significantly underestimate gradient." },
      { label: "Avoid the Left Atrium", text: "When aligning the CW Doppler cursor for LVOT gradient measurement, ensure the cursor does not pass through the left atrium. If the cursor traverses the LA, any coexisting mitral regurgitation will be sampled simultaneously, producing a composite signal that can be misinterpreted as an elevated LVOT gradient. Align the cursor strictly along the LVOT axis, angling away from the LA, to ensure a clean, uncontaminated HOCM signal." },
      { label: "Dagger shape", text: "HOCM LVOT: dagger-shaped (late-peaking). Measure peak velocity at the TIP of the dagger — not the early systolic shoulder. AS: rounded, mid-peaking." },
      { label: "Valsalva from A5C", text: "Keep CW beam on LVOT during Valsalva. Start recording 3–5 beats before maneuver. Continue 5–10 beats after release to capture peak provoked gradient." },
      { label: "Sweep speed", text: "Use 100 mm/s sweep speed for gradient measurement. Use 50 mm/s for Valsalva to capture multiple beats on one sweep." },
    ],
    pitfalls: [
      "Measuring early systolic shoulder instead of late dagger peak — underestimates gradient",
      "Stopping recording at end of Valsalva strain — misses peak provoked gradient on release",
      "Beam not parallel to LVOT — always check 2D alignment before switching to CW",
    ],
    structures: ["LVOT", "Aortic valve", "Proximal ascending aorta"],
    measurements: ["Resting LVOT gradient (mmHg)", "Provoked LVOT gradient — Valsalva (mmHg)", "Peak CW velocity (m/s)"],
    criteria: [
      {
        parameter: "Resting LVOT Gradient (CW Doppler)",
        normal: "< 30 mmHg",
        borderline: "20–29 mmHg (non-obstructive at rest — may be provokable)",
        abnormal: "≥ 30 mmHg (resting obstruction — Goal-Directed Valsalva indicated)",
        provocationTrigger: true,
        note: "Resting gradient ≥30 mmHg confirms obstructive HOCM. Measure peak gradient using modified Bernoulli equation (4v²). Always measure from the TIP of the dagger — not the early systolic shoulder.",
      },
      {
        parameter: "Provoked LVOT Gradient (Valsalva)",
        normal: "< 30 mmHg",
        borderline: "30–49 mmHg (labile obstruction)",
        abnormal: "≥ 50 mmHg (significant provokable obstruction — guides therapy)",
        provocationTrigger: false,
        note: "Perform Goal-Directed Valsalva if resting gradient < 30 mmHg. Measure peak gradient on the FIRST beat after Valsalva release — this is typically the highest provoked gradient.",
      },
      {
        parameter: "Peak CW Velocity",
        normal: "< 2.7 m/s (< 30 mmHg)",
        borderline: "2.7–3.5 m/s (30–49 mmHg)",
        abnormal: "≥ 3.5 m/s (≥ 50 mmHg — significant obstruction)",
        provocationTrigger: true,
        note: "Velocity ≥ 3.5 m/s = gradient ≥ 50 mmHg by modified Bernoulli (4v²). This threshold guides septal reduction therapy decisions.",
      },
    ],
  },
  {
    id: "a3c",
    label: "A3C",
    fullName: "Apical 3-Chamber (Apical Long Axis)",
    color: PURPLE,
    badge: "CW Gradient — Alternative",
    patientPosition: "Steep left lateral decubitus (60–90°)",
    probePosition: "From A4C, rotate probe ~60° counter-clockwise (indicator toward right shoulder, ~10 o'clock)",
    depth: "16–18 cm",
    focus: "Alternative CW Doppler view for LVOT gradient",
    description: "The A3C (apical long axis) provides an alternative CW Doppler window for LVOT gradient measurement when A5C alignment is suboptimal. Often provides better beam-to-flow alignment in patients with horizontal hearts.",
    howToGet: [
      "From A4C, rotate probe ~60° counter-clockwise",
      "Indicator points toward right shoulder (~10 o'clock)",
      "LVOT, AV, and descending aorta visible in same plane",
      "Align CW beam parallel to LVOT flow",
    ],
    tips: [
      { label: "When to use A3C", text: "Use A3C when A5C CW signal is suboptimal or beam alignment is poor. Some patients have better LVOT windows from A3C." },
      { label: "Comparison", text: "Always measure gradient from BOTH A5C and A3C — report the HIGHEST gradient obtained. Underestimation is more common than overestimation." },
    ],
    pitfalls: [
      "Using only one apical view — always try both A5C and A3C",
      "Confusing A3C with PLAX — confirm by checking probe position and image orientation",
    ],
    structures: ["LVOT", "Aortic valve", "Posterior wall", "Descending aorta"],
    measurements: ["LVOT gradient (mmHg) — compare with A5C", "Peak CW velocity (m/s)"],
    criteria: [
      {
        parameter: "LVOT Gradient (A3C — compare with A5C)",
        normal: "< 30 mmHg",
        borderline: "20–29 mmHg",
        abnormal: "≥ 30 mmHg — report the HIGHEST gradient from A5C or A3C",
        provocationTrigger: true,
        note: "Always measure from both A5C and A3C. Report the highest gradient obtained. Underestimation from poor beam alignment is more common than overestimation.",
      },
    ],
  },
  {
    id: "a2c",
    label: "A2C",
    fullName: "Apical 2-Chamber",
    color: "#0e7490",
    badge: "LA & LV Function",
    patientPosition: "Steep left lateral decubitus (60–90°)",
    probePosition: "From A4C, rotate probe ~60° counter-clockwise (indicator toward 12 o'clock)",
    depth: "16–18 cm",
    focus: "LA volume (biplane), inferior and anterior wall",
    description: "A2C provides the second plane for biplane LA volume measurement and LV EF (Simpson's). Also shows inferior and anterior wall thickness for apical HCM assessment.",
    howToGet: [
      "From A4C, rotate probe ~60° counter-clockwise",
      "Only LV and LA visible — no RV",
      "Optimize to show true apex without foreshortening",
    ],
    tips: [
      { label: "Biplane LA volume", text: "Trace LA at end-systole in A4C and A2C. Use biplane area-length or Simpson's method for LAVI." },
      { label: "Apical HCM", text: "Assess apical wall thickness in A2C — apical HCM may be most visible here. Use contrast if apical walls are not clearly seen." },
    ],
    pitfalls: [
      "Foreshortened apex — move probe to true apex for accurate wall thickness",
    ],
    structures: ["LV (inferior, anterior walls)", "LA", "MV"],
    measurements: ["LA volume (biplane, mL)", "LV EF — biplane Simpson's (%)"],
    criteria: [
      {
        parameter: "Apical Wall Thickness (A2C)",
        normal: "< 1.2 cm",
        borderline: "1.2–1.4 cm",
        abnormal: "≥ 1.5 cm (apical HCM — consider contrast echo for confirmation)",
        provocationTrigger: false,
        note: "Apical HCM may be missed without contrast. If apical walls are not clearly seen, use ultrasound enhancing agent (UEA) to delineate true apical thickness.",
      },
      {
        parameter: "LV Ejection Fraction (Biplane Simpson's)",
        normal: "55–75%",
        borderline: "50–54% (mildly reduced)",
        abnormal: "< 50% (end-stage HOCM — 'burnt-out' phase with LV dilation)",
        provocationTrigger: false,
        note: "HOCM typically shows hyperdynamic EF (>70%). Reduced EF in HOCM suggests end-stage disease — a significant prognostic finding.",
      },
    ],
  },
  {
    id: "subcostal",
    label: "Subcostal",
    fullName: "Subcostal",
    color: "#0f766e",
    badge: "IVS & RV",
    patientPosition: "Supine, knees bent, patient relaxed",
    probePosition: "Subxiphoid, indicator toward patient's left (3 o'clock), angled toward left shoulder",
    depth: "18–20 cm",
    focus: "IVS thickness, RV, IVC",
    description: "Subcostal view provides an alternative window for IVS thickness measurement and RV assessment. Particularly useful when parasternal windows are poor. IVC assessment for RAP estimation.",
    howToGet: [
      "Position probe subxiphoid, indicator toward left, angled toward left shoulder",
      "Ask patient to take a deep breath and hold to bring heart closer",
      "Optimize to show all four chambers",
    ],
    tips: [
      { label: "IVS measurement", text: "Subcostal view may give better perpendicular measurement of IVS than PLAX in some patients. Compare with PLAX measurement." },
      { label: "IVC", text: "Rotate probe to sagittal plane (indicator toward head) to assess IVC diameter and collapsibility for RAP estimation." },
    ],
    pitfalls: [
      "Oblique cut through IVS — ensure beam is perpendicular to septum",
    ],
    structures: ["IVS", "RV", "LV", "IVC", "Hepatic veins"],
    measurements: ["IVS thickness (subcostal, mm)", "IVC diameter (mm)", "IVC collapsibility (%)"],
    criteria: [
      {
        parameter: "IVS Thickness (Subcostal — confirm PLAX measurement)",
        normal: "< 1.2 cm",
        borderline: "1.2–1.4 cm (no FHx) · 1.0–1.2 cm (FHx)",
        abnormal: "≥ 1.5 cm (no FHx) · ≥ 1.3 cm (FHx of HCM)",
        provocationTrigger: true,
        note: "Use subcostal to confirm PLAX IVS measurement when parasternal windows are poor. Ensure beam is perpendicular to septum.",
      },
      {
        parameter: "IVC Diameter (Expiratory)",
        normal: "≤ 2.1 cm with > 50% collapse",
        borderline: "2.1–2.5 cm or 21–50% collapse",
        abnormal: "> 2.5 cm with < 21% collapse (elevated RAP ≥ 15 mmHg)",
        provocationTrigger: false,
        note: "Elevated RAP in HOCM suggests significant diastolic dysfunction or coexisting RV involvement.",
      },
    ],
  },
  // ─── Papillary Muscle Level ──────────────────────────────────────────────────
  {
    id: "psax_pap",
    label: "PSAX PAP",
    fullName: "Parasternal Short Axis — Papillary Muscle Level",
    color: BRAND,
    badge: "Mid-LV / Midventricular HOCM",
    patientPosition: "Left lateral decubitus (30–45°)",
    probePosition: "Left parasternal border, 3rd–4th ICS — tilt inferiorly from PSAX MV level",
    depth: "12–14 cm",
    focus: "Mid-LV wall thickness, papillary muscle morphology, midventricular obstruction",
    description: "PSAX at papillary muscle level assesses mid-LV wall thickness, LV cavity size, and papillary muscle morphology. Midventricular HOCM shows obstruction at this level rather than the LVOT. Both papillary muscles appear as 'eyes' in a symmetric LV cross-section.",
    howToGet: [
      "From PSAX MV level, tilt probe slightly inferiorly",
      "Both papillary muscles visible as symmetric 'eyes' in LV cross-section",
      "Measure wall thickness at end-diastole, perpendicular to septum",
      "Use PW Doppler to localize obstruction at PM level if midventricular HOCM suspected",
    ],
    tips: [
      { label: "Midventricular HOCM", text: "Obstruction at papillary muscle level — assess with PW Doppler stepwise from apex toward LVOT. Gradient increases at PM level, not LVOT." },
      { label: "PM hypertrophy", text: "Papillary muscle hypertrophy is a substrate for SAM and midventricular obstruction. Measure PM diameter." },
      { label: "Anomalous PM insertion", text: "Direct PM-to-MV leaflet attachment causes obstruction independent of SAM. Assess at PM level and correlate with PLAX." },
    ],
    pitfalls: [
      "Oblique cut overestimates wall thickness — ensure beam is perpendicular to septum",
      "Confusing PM hypertrophy with LV wall thickening — trace endocardial border carefully",
    ],
    structures: ["LV mid-cavity", "Papillary muscles (anterolateral, posteromedial)", "Interventricular septum", "Posterior wall"],
    measurements: ["IVS thickness at PM level (mm)", "Posterior wall thickness at PM level (mm)", "LV internal diameter at PM level (mm)", "PM diameter (mm)"],
    criteria: [
      {
        parameter: "Midventricular Wall Thickness",
        normal: "< 1.2 cm",
        borderline: "1.2–1.4 cm",
        abnormal: "≥ 1.5 cm — midventricular hypertrophy",
        provocationTrigger: false,
        note: "Midventricular hypertrophy with cavity obliteration at PM level = midventricular HOCM. Use PW Doppler to confirm obstruction at this level.",
      },
      {
        parameter: "LV Cavity at PM Level",
        normal: "Normal cavity size",
        borderline: "Mild cavity reduction",
        abnormal: "Cavity obliteration at end-systole → midventricular HOCM",
        provocationTrigger: true,
        note: "Midventricular cavity obliteration at end-systole is the hallmark of midventricular HOCM. Provocation may worsen obliteration.",
      },
    ],
  },
  // ─── Provocation ─────────────────────────────────────────────────────────────
  {
    id: "valsalva_pos",
    label: "Valsalva",
    fullName: "Valsalva — Patient Positioning & Technique",
    color: "#0f766e",
    badge: "Provocation",
    patientPosition: "Left lateral decubitus — same position as A5C/A3C acquisition",
    probePosition: "A5C or A3C — maintain CW beam on LVOT throughout maneuver",
    depth: "16–18 cm",
    focus: "Provoked LVOT gradient measurement",
    description: "Proper patient positioning and coaching for the Valsalva maneuver is essential for provokable HOCM gradient assessment. The strain phase reduces preload, increasing LVOT obstruction. The peak provoked gradient occurs on the FIRST beat after Valsalva release — do not stop recording at end of strain.",
    howToGet: [
      "Maintain CW beam on LVOT from A5C or A3C — do not reposition during maneuver",
      "Coach patient to strain against closed glottis for 10–15 seconds",
      "Record CW Doppler continuously through strain phase and release",
      "Measure peak gradient on FIRST beat after release — this is typically the highest",
      "Goal-Directed Valsalva: aim for 40 mmHg intrathoracic pressure if pressure gauge available",
    ],
    tips: [
      { label: "Peak gradient timing", text: "Measure peak gradient on FIRST beat after Valsalva release — not during strain. The release causes a sudden preload reduction that maximally provokes obstruction." },
      { label: "Goal-Directed Valsalva", text: "Standard Valsalva underestimates gradient in ~30% of patients. Goal-Directed Valsalva (40 mmHg intrathoracic pressure) improves sensitivity for provokable obstruction." },
      { label: "Keep CW on LVOT", text: "Do not reposition the probe during the maneuver — maintain CW beam alignment on LVOT throughout strain and release." },
    ],
    pitfalls: [
      "Stopping recording at end of strain — misses peak provoked gradient on release",
      "Inadequate strain — patient must achieve adequate intrathoracic pressure (40 mmHg goal)",
      "Repositioning probe during maneuver — loses CW alignment",
    ],
    structures: ["LVOT", "Aortic valve"],
    measurements: ["Provoked LVOT gradient (mmHg)", "Peak CW velocity post-Valsalva (m/s)"],
    criteria: [
      {
        parameter: "Provoked LVOT Gradient",
        normal: "< 30 mmHg",
        borderline: "30–49 mmHg",
        abnormal: "≥ 50 mmHg — significant provokable obstruction",
        provocationTrigger: true,
        note: "Provoked gradient ≥50 mmHg guides septal reduction therapy decisions. Measure on FIRST beat after Valsalva release.",
      },
    ],
  },
  // ─── Doppler / LVOT Outflow ───────────────────────────────────────────────────
  {
    id: "cw_lvot",
    label: "CW LVOT",
    fullName: "CW Doppler — LVOT Dagger Waveform",
    color: "#7c3aed",
    badge: "Doppler / LVOT Outflow",
    patientPosition: "Steep left lateral decubitus (60–90°)",
    probePosition: "A5C or A3C — align CW beam parallel to LVOT flow (color Doppler first)",
    depth: "16–18 cm",
    focus: "LVOT gradient measurement — dagger-shaped late-peaking signal",
    description: "CW Doppler from A5C or A3C captures the characteristic dagger-shaped LVOT waveform of HOCM. Late-peaking, high-velocity signal. Measure at the TIP of the dagger — not the early systolic shoulder. Always use both A5C and A3C and report the HIGHEST gradient.",
    howToGet: [
      "A5C: tilt probe anteriorly from A4C to bring LVOT into view",
      "Align CW beam parallel to LVOT flow — use color Doppler first to confirm direction",
      "A3C: alternative window — rotate ~60° CCW from A4C",
      "Use both A5C and A3C — report the HIGHEST gradient",
      "Set CW scale to 6–8 m/s to capture full dagger peak without aliasing",
    ],
    tips: [
      { label: "Dagger shape", text: "HOCM LVOT signal: slow early rise → steep late acceleration → sharp peak in late systole. Measure at the TIP of the dagger — not the early systolic shoulder." },
      { label: "Use both windows", text: "Always measure from both A5C and A3C. Report the highest gradient. Underestimation from poor beam alignment is more common than overestimation." },
      { label: "MR contamination", text: "MR jet may contaminate LVOT CW signal — align cursor strictly along LVOT axis, angling away from LA. MR is holosystolic with rounded envelope; LVOT is late-peaking dagger." },
    ],
    pitfalls: [
      "Measuring early systolic shoulder instead of late dagger peak — underestimates gradient",
      "MR contamination: align cursor strictly along LVOT axis, angling away from LA",
      "Using only one apical view — always try both A5C and A3C",
    ],
    structures: ["LVOT", "Aortic valve"],
    measurements: ["Resting LVOT gradient (mmHg)", "Peak CW velocity (m/s)"],
    criteria: [
      {
        parameter: "Resting LVOT Gradient",
        normal: "< 30 mmHg",
        borderline: "30–49 mmHg",
        abnormal: "≥ 50 mmHg — severe obstruction, guides therapy",
        provocationTrigger: true,
        note: "Resting gradient ≥50 mmHg = significant obstruction. Measure at dagger TIP. If resting <50 mmHg, perform Valsalva provocation.",
      },
    ],
  },
  {
    id: "pw_lvot",
    label: "PW LVOT",
    fullName: "PW Doppler — LVOT Sample Site Localization",
    color: "#7c3aed",
    badge: "Doppler / LVOT Outflow",
    patientPosition: "Steep left lateral decubitus (60–90°)",
    probePosition: "A5C — PW sample volume 0.5–1 cm below AV, stepwise advancement toward AV",
    depth: "16–18 cm",
    focus: "Localize level of obstruction — confirm subvalvular (LVOT) not valvular",
    description: "PW Doppler sample site localization in the LVOT confirms obstruction is at LVOT level (not valvular) and precisely localizes the level of maximum obstruction by stepwise sample volume advancement. Gradient increases as sample moves toward obstruction = subvalvular HOCM.",
    howToGet: [
      "A5C: place PW sample volume 0.5–1 cm below AV",
      "Stepwise advancement toward AV: gradient increases as sample moves toward obstruction",
      "Confirm obstruction is subvalvular (LVOT) not valvular",
      "PW sample volume 2–5 mm for precise localization",
    ],
    tips: [
      { label: "PW localization", text: "Gradient increases as sample moves from LVOT toward AV = subvalvular obstruction (HOCM). No gradient increase in LVOT on PW = valvular AS, not HOCM." },
      { label: "Aliasing", text: "PW aliases at high velocities — use CW for peak gradient measurement. PW is for localization only." },
    ],
    pitfalls: [
      "Aliasing at high velocities — use CW for peak gradient measurement, PW for localization only",
      "Not advancing sample volume stepwise — misses localization of obstruction level",
    ],
    structures: ["LVOT", "Aortic valve"],
    measurements: ["PW LVOT velocity (m/s)", "Level of maximum obstruction"],
  },
  {
    id: "mr_jet",
    label: "MR Jet",
    fullName: "MR Jet — CW Doppler (SAM-related vs Primary MR)",
    color: "#7c3aed",
    badge: "Doppler / LVOT Outflow",
    patientPosition: "Left lateral decubitus (30–45°)",
    probePosition: "A4C or A2C — align CW beam along MR jet direction (color Doppler first)",
    depth: "16–18 cm",
    focus: "MR severity and mechanism — SAM-related (posterior, late-systolic) vs primary MR (central, holosystolic)",
    description: "MR jet CW Doppler from A4C or A2C. SAM-related MR produces a posteriorly directed, late-systolic jet. Differentiate from primary MR (central/anterior jet, holosystolic). Critical for surgical planning — SAM-related MR often improves after septal reduction therapy.",
    howToGet: [
      "A4C: align CW beam along MR jet direction — use color Doppler first",
      "A2C: alternative window for anterior/inferior jets",
      "Distinguish from LVOT signal: MR is holosystolic, broad, rounded envelope",
      "Assess jet direction: posterior = SAM-related; central/anterior = primary MV disease",
    ],
    tips: [
      { label: "SAM-related MR", text: "Posteriorly directed, late-systolic, crescent-shaped envelope. Often improves after septal reduction therapy. Do not overestimate severity." },
      { label: "Primary MR", text: "Central or anterior jet, holosystolic plateau envelope. Coexisting primary MV disease requires separate assessment and may need MV repair." },
      { label: "MR vs LVOT", text: "MR jet velocity ~4–5 m/s (similar to LVOT). Distinguish by: MR is holosystolic with rounded envelope; LVOT is late-peaking dagger. Align cursor strictly along LVOT axis to avoid MR contamination." },
    ],
    pitfalls: [
      "MR jet may contaminate LVOT CW signal — align cursor strictly along LVOT axis",
      "Late-systolic MR may be missed if recording stops early",
      "Overestimating MR severity in SAM-related MR — reassess after gradient reduction",
    ],
    structures: ["Mitral valve", "Left atrium"],
    measurements: ["MR severity (color Doppler grade)", "MR jet direction (posterior = SAM-related)"],
    criteria: [
      {
        parameter: "MR Severity",
        normal: "None or trace",
        borderline: "Mild-to-moderate (grade 1–2+)",
        abnormal: "Moderate-to-severe or severe (grade ≥3+) → surgical planning",
        provocationTrigger: false,
        note: "SAM-related MR: posteriorly directed, late-systolic. Often improves after septal reduction therapy. Primary MR: central/anterior jet, holosystolic — may require MV repair.",
      },
    ],
  },
  // ─── SAM Assessment ───────────────────────────────────────────────────────────
  {
    id: "sam_plax",
    label: "SAM M-Mode",
    fullName: "SAM — PLAX M-Mode",
    color: "#b45309",
    badge: "SAM Assessment",
    patientPosition: "Left lateral decubitus (30–45°)",
    probePosition: "PLAX — M-mode cursor through MV anterior leaflet and aortic valve",
    depth: "12–14 cm",
    focus: "SAM timing, duration, AV midsystolic notching",
    description: "SAM M-Mode from PLAX captures systolic anterior motion of the anterior mitral leaflet and midsystolic aortic valve closure — the two classic M-mode signs of HOCM. Duration of SAM-IVS contact correlates with gradient severity.",
    howToGet: [
      "PLAX: place M-mode cursor through MV anterior leaflet",
      "Optimize to show both MV and AV on same M-mode sweep",
      "Use zoom to improve temporal resolution",
      "Record at 100 mm/s sweep speed for timing assessment",
    ],
    tips: [
      { label: "SAM pattern", text: "Anterior mitral leaflet moves toward IVS in systole — contact with IVS = severe obstruction. Duration of SAM-IVS contact correlates with gradient severity." },
      { label: "AV midsystolic notching", text: "Notching of AV M-mode in mid-systole = LVOT obstruction. Degree of notching correlates with gradient: mild notch = moderate obstruction; complete mid-systolic closure = severe obstruction (gradient often >50 mmHg)." },
      { label: "Sweep speed", text: "Use 100 mm/s sweep speed for timing assessment of SAM and AV notching." },
    ],
    pitfalls: [
      "Oblique M-mode cut may miss SAM — ensure cursor is perpendicular to MV leaflets",
      "Confusing MV coaptation with SAM — SAM is anterior motion toward IVS, not posterior",
    ],
    structures: ["Anterior mitral leaflet", "Aortic valve", "LVOT"],
    measurements: ["Duration of SAM-IVS contact (ms)", "Midsystolic AV closure (present/absent)"],
    criteria: [
      {
        parameter: "SAM-IVS Contact",
        normal: "Absent",
        borderline: "Brief contact (< 30% of systole)",
        abnormal: "Prolonged contact (≥ 30% of systole) → severe obstruction",
        provocationTrigger: true,
        note: "Duration of SAM-IVS contact correlates with gradient severity. Provocation (Valsalva) worsens SAM and prolongs contact.",
      },
      {
        parameter: "AV Midsystolic Notching",
        normal: "Smooth box-shaped opening throughout systole",
        borderline: "Mild mid-systolic notch",
        abnormal: "Prominent notch or complete mid-systolic closure ('W' pattern)",
        provocationTrigger: true,
        note: "Complete mid-systolic AV closure = severe obstruction (gradient often >50 mmHg). Provocation worsens notching.",
      },
    ],
  },
  {
    id: "sam_zoom",
    label: "SAM Zoom",
    fullName: "SAM — Zoomed PLAX",
    color: "#b45309",
    badge: "SAM Assessment",
    patientPosition: "Left lateral decubitus (30–45°)",
    probePosition: "PLAX — zoom on MV and LVOT region, narrow sector for high frame rate",
    depth: "8–10 cm (zoomed)",
    focus: "SAM mechanism, leaflet morphology, LVOT turbulence",
    description: "Zoomed PLAX for SAM assessment. High-resolution 2D view of the MV and LVOT provides detailed assessment of SAM mechanism, leaflet morphology, and degree of LVOT narrowing. Color Doppler shows LVOT turbulence and MR jet direction.",
    howToGet: [
      "PLAX: zoom on MV and LVOT region",
      "Use narrow sector for high frame rate (>60 fps)",
      "Color Doppler to show LVOT turbulence and MR jet direction",
      "Reduce depth to 8–10 cm to maximize resolution",
    ],
    tips: [
      { label: "Zoom improves resolution", text: "Zoom improves temporal resolution for SAM timing and leaflet morphology assessment. Use narrow sector for highest frame rate." },
      { label: "Color Doppler", text: "LVOT turbulence (aliasing) + posteriorly directed MR jet = SAM. Color scale 50–60 cm/s Nyquist to detect low-velocity MR." },
      { label: "Leaflet morphology", text: "Assess anterior leaflet length, accessory chordae, and coaptation point. Elongated anterior leaflet (>3 cm) predisposes to SAM." },
    ],
    pitfalls: [
      "Color Doppler scale too high — misses low-velocity MR jet",
      "Frame rate too low — misses rapid SAM motion",
    ],
    structures: ["Anterior mitral leaflet", "LVOT", "Interventricular septum"],
    measurements: ["LVOT diameter at narrowest point (mm)", "SAM severity (mild/moderate/severe)"],
    criteria: [
      {
        parameter: "LVOT Narrowing (Zoomed PLAX)",
        normal: "LVOT ≥ 2.0 cm, no turbulence",
        borderline: "LVOT 1.7–1.9 cm, mild turbulence",
        abnormal: "LVOT < 1.7 cm or severe turbulence → significant obstruction",
        provocationTrigger: true,
        note: "Zoomed PLAX provides the best view for LVOT diameter measurement and SAM mechanism assessment.",
      },
    ],
  },
];
// Dev-mode sync check: warns in console if views array is out of sync with registry
if (import.meta.env.DEV) validateViewsAgainstRegistry("hocm", views.map((v) => v.id));
// ─── DOPPLER DIFFERENTIATION DATA ─────────────────────────────────────────────

const dopplerComparison = [
  { feature: "Signal shape", hocm: "Dagger-shaped (concave upstroke)", mr: "Broad, rounded, uniform envelope" },
  { feature: "Timing of peak", hocm: "Late systole (late-peaking)", mr: "Mid-systole (holosystolic plateau)" },
  { feature: "Onset", hocm: "Delayed — starts after isovolumic contraction", mr: "Immediate — starts with QRS (isovolumic contraction)" },
  { feature: "Duration", hocm: "Systole only (ends before S2)", mr: "Holosystolic — extends to S2 or beyond" },
  { feature: "Peak velocity", hocm: "3–6 m/s (gradient 36–144 mmHg)", mr: "4–5 m/s (gradient 64–100 mmHg)" },
  { feature: "Direction (A5C)", hocm: "Away from probe (below baseline)", mr: "Away from probe (below baseline) — SAME direction, different shape" },
  { feature: "Effect of Valsalva", hocm: "Gradient INCREASES (↓ preload → ↑ obstruction)", mr: "Gradient UNCHANGED or slightly decreases" },
  { feature: "Effect of amyl nitrite", hocm: "Gradient INCREASES", mr: "Gradient INCREASES (↓ afterload → ↑ MR)" },
  { feature: "Effect of squatting", hocm: "Gradient DECREASES (↑ preload → ↓ obstruction)", mr: "Gradient UNCHANGED" },
  { feature: "Best view", hocm: "A5C or A3C (LVOT alignment)", mr: "A4C or A2C (MR jet alignment)" },
  { feature: "Color Doppler", hocm: "LVOT turbulence; posteriorly directed MR jet from SAM", mr: "MR jet in LA — direction varies by etiology" },
  { feature: "PW localization", hocm: "Gradient increases as sample moves from LVOT toward AV", mr: "No gradient increase in LVOT on PW" },
];

// ─── MACHINE SETTINGS ────────────────────────────────────────────────────────

const machineSettings = [
  { setting: "Probe", value: "Phased array (1–5 MHz)", note: "Standard cardiac probe" },
  { setting: "2D Gain", value: "Optimize for endocardial definition", note: "Reduce gain if IVS appears bright/overexposed" },
  { setting: "Harmonic Imaging", value: "ON", note: "Improves endocardial definition, reduces artifact" },
  { setting: "CW Doppler Scale", value: "6–8 m/s", note: "Set scale to capture full dagger peak without aliasing" },
  { setting: "CW Sweep Speed", value: "100 mm/s (resting); 50 mm/s (Valsalva)", note: "50 mm/s captures multiple beats during provocation" },
  { setting: "PW Sample Volume", value: "2–5 mm", note: "Smaller sample volume for precise localization" },
  { setting: "Color Doppler Scale", value: "50–60 cm/s (Nyquist)", note: "Lower scale to detect low-velocity MR jets" },
  { setting: "Color Sector Width", value: "Narrow — focus on LVOT and MV", note: "Narrow sector improves frame rate" },
  { setting: "Zoom / Focus", value: "Use zoom on MV in PLAX for SAM assessment", note: "Zoom improves temporal resolution for SAM timing" },
  { setting: "M-mode", value: "Through MV (PLAX) and AV (PLAX)", note: "Classic SAM pattern and midsystolic AV closure" },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

// Named export for embedding as a tab inside ScanCoach.tsx (no Layout wrapper)
export function HOCMScanCoachContent() {
  return <HOCMScanCoach _noLayout />;
}

export default function HOCMScanCoach({ _noLayout }: { _noLayout?: boolean } = {}) {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const [selectedView, setSelectedView] = useState(() => views.find(v => v.id === _viewParam) ?? views[0]);
  const [expandedSection, setExpandedSection] = useState<string | null>("criteria");
  const [activeTab, setActiveTab] = useState<"views" | "doppler" | "valsalva" | "myosin" | "settings">("views");
  const [valsalvaPath, setValsalvaPath] = useState<"instructed" | "goal-directed" | null>(null);
  const { mergeView: mergeHOCMView } = useScanCoachOverrides("hocm");
  const currentView = useMemo(
    () => mergeHOCMView(selectedView as any),
    [selectedView, mergeHOCMView]
  );
  const inner = (<div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="container">
          <div className="flex gap-1 overflow-x-auto py-2">
            {([
              { id: "views", label: "View-by-View Guide", icon: Layers },
              { id: "doppler", label: "Doppler Differentiation", icon: Activity },
              { id: "valsalva", label: "Valsalva Acquisition", icon: TrendingUp },
              { id: "myosin", label: "Myosin Inhibitors", icon: Zap },
              { id: "settings", label: "Machine Settings", icon: Ruler },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === id ? "text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                style={activeTab === id ? { background: BRAND } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── View-by-View Tab ─────────────────────────────────────────────── */}
      {activeTab === "views" && (
        <div className="container py-6">
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            {/* View selector */}
            <div className="lg:w-52 flex-shrink-0 lg:sticky lg:top-16">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-3 py-2.5 border-b border-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Select View</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {views.map(v => (
                    <button
                      key={v.id}
                      onClick={() => { setSelectedView(v); setExpandedSection("howToGet"); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                        selectedView.id === v.id ? "bg-gray-50" : "hover:bg-gray-50/50"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                        style={{ background: selectedView.id === v.id ? v.color : "#e5e7eb", color: selectedView.id === v.id ? "white" : "#6b7280" }}>
                        {v.label.substring(0, 4)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-gray-800 truncate">{v.label}</div>
                        <div className="text-[10px] text-gray-400 truncate">{v.badge}</div>
                      </div>
                      {selectedView.id === v.id && <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: v.color }} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* View detail */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-black text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                        {selectedView.fullName}
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: selectedView.color }}>{selectedView.badge}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{selectedView.description}</p>
                  </div>
                </div>
                {/* Quick reference grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Patient Position", value: selectedView.patientPosition },
                    { label: "Probe Position", value: selectedView.probePosition },
                    { label: "Depth", value: selectedView.depth },
                    { label: "Focus", value: selectedView.focus },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-2.5 rounded-lg bg-gray-50">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</div>
                      <div className="text-xs text-gray-700 leading-snug">{value}</div>
                    </div>
                  ))}
                </div>
                {/* Override images from ScanCoach Editor */}
                {(currentView?.echoImageUrl || currentView?.transducerImageUrl || currentView?.anatomyImageUrl) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    {currentView.echoImageUrl && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Echo Image</p>
                        <img src={currentView.echoImageUrl} alt="Echo reference" className="max-h-64 object-contain rounded-lg w-full" />
                      </div>
                    )}
                    {currentView.transducerImageUrl && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Probe Position</p>
                        <img src={currentView.transducerImageUrl} alt="Transducer position" className="max-h-64 object-contain rounded-lg w-full" />
                      </div>
                    )}
                    {currentView.anatomyImageUrl && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Anatomy Reference</p>
                        <img src={currentView.anatomyImageUrl} alt="Anatomy diagram" className="max-h-64 object-contain rounded-lg w-full" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Expandable sections */}
              {[
                {
                  id: "criteria",
                  title: "Diagnostic Criteria & Provocation Triggers",
                  icon: Activity,
                  content: (
                    <div className="space-y-3">
                      {/* Provocation trigger legend */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">● Normal</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">● Borderline</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">● Abnormal</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: "#189aa1" }}>⚡ Provocation Trigger</div>
                      </div>
                      {(selectedView as any).criteria?.map((c: any) => (
                        <div key={c.parameter} className="rounded-xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#f0fbfc" }}>
                            <span className="text-xs font-bold text-gray-800">{c.parameter}</span>
                            {c.provocationTrigger && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#189aa1" }}>
                                <Zap className="w-2.5 h-2.5" /> Goal-Directed Valsalva
                              </span>
                            )}
                          </div>
                          {/* Threshold rows */}
                          <div className="divide-y divide-gray-50">
                            <div className="flex items-start gap-3 px-4 py-2 bg-green-50">
                              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1" />
                              <div>
                                <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Normal </span>
                                <span className="text-xs text-green-800">{c.normal}</span>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 px-4 py-2 bg-amber-50">
                              <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1" />
                              <div>
                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Borderline </span>
                                <span className="text-xs text-amber-800">{c.borderline}</span>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 px-4 py-2 bg-red-50">
                              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1" />
                              <div>
                                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Abnormal </span>
                                <span className="text-xs text-red-800">{c.abnormal}</span>
                              </div>
                            </div>
                          </div>
                          {/* Clinical note */}
                          {c.note && (
                            <div className="flex items-start gap-2 px-4 py-2.5 border-t border-gray-100 bg-white">
                              <Info className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#189aa1" }} />
                              <p className="text-[11px] text-gray-600 leading-relaxed">{c.note}</p>
                            </div>
                          )}
                        </div>
                      ))}
                      {!(selectedView as any).criteria?.length && (
                        <p className="text-xs text-gray-400 italic">No specific diagnostic criteria for this view.</p>
                      )}
                    </div>
                  ),
                },
                {
                  id: "howToGet",
                  title: "How to Get the View",
                  icon: Target,
                  content: (
                    <ol className="space-y-2">
                      {selectedView.howToGet.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                            style={{ background: selectedView.color }}>{i + 1}</div>
                          <p className="text-xs text-gray-700 leading-relaxed pt-0.5">{step}</p>
                        </li>
                      ))}
                    </ol>
                  ),
                },
                {
                  id: "tips",
                  title: "Clinical Tips",
                  icon: Zap,
                  content: (
                    <div className="space-y-2">
                      {selectedView.tips.map(tip => (
                        <div key={tip.label} className="flex items-start gap-2 p-3 rounded-lg bg-gray-50">
                          <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: selectedView.color }} />
                          <div>
                            <span className="text-xs font-bold text-gray-800">{tip.label}: </span>
                            <span className="text-xs text-gray-600">{tip.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  id: "pitfalls",
                  title: "Pitfalls",
                  icon: AlertTriangle,
                  content: (
                    <div className="space-y-2">
                      {selectedView.pitfalls.map(p => (
                        <div key={p} className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-800">{p}</p>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  id: "structures",
                  title: "Structures & Measurements",
                  icon: Ruler,
                  content: (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Structures to Assess</p>
                        <div className="space-y-1">
                          {selectedView.structures.map(s => (
                            <div key={s} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: selectedView.color }} />
                              <span className="text-xs text-gray-700">{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Measurements</p>
                        <div className="space-y-1">
                          {selectedView.measurements.map(m => (
                            <div key={m} className="flex items-center gap-2">
                              <Ruler className="w-3 h-3 flex-shrink-0 text-gray-400" />
                              <span className="text-xs text-gray-700">{m}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ),
                },
              ].map(({ id, title, icon: Icon, content }) => (
                <div key={id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-3"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <button
                    onClick={() => setExpandedSection(expandedSection === id ? null : id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: selectedView.color }} />
                    <span className="text-sm font-bold text-gray-800 flex-1">{title}</span>
                    {expandedSection === id
                      ? <ChevronDown className="w-4 h-4 text-gray-400" />
                      : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </button>
                  {expandedSection === id && (
                    <div className="border-t border-gray-50 px-5 py-4">{content}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Doppler Differentiation Tab ──────────────────────────────────── */}
      {activeTab === "doppler" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Doppler Differentiation
            </h2>
            <p className="text-sm text-gray-500">How to distinguish HOCM LVOT obstruction from mitral regurgitation on CW Doppler</p>
          </div>

          {/* Key concept */}
          <div className="flex items-start gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-4">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <strong>Why this matters:</strong> Both HOCM LVOT obstruction and MR produce high-velocity, away-from-probe signals in the apical views. Confusing them leads to incorrect gradient measurement and misclassification of obstruction severity. The key differentiator is <strong>signal shape and timing</strong> — not velocity alone.
            </div>
          </div>

          {/* CW Cursor LA Avoidance Tip */}
          <div className="flex items-start gap-3 p-4 rounded-xl border mb-6" style={{ background: "#f0fbfc", borderColor: "#189aa1" + "40" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#189aa1" }}>
              <Target className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: "#189aa1" }}>CW Doppler Cursor Positioning — Avoid the Left Atrium</p>
              <p className="text-xs text-gray-700 leading-relaxed">
                When aligning the CW Doppler cursor for LVOT gradient measurement, ensure the cursor does not pass through the left atrium. If the cursor traverses the LA, any coexisting mitral regurgitation will be sampled simultaneously, producing a composite signal that can be misinterpreted as an elevated LVOT gradient. Align the cursor strictly along the LVOT axis, angling away from the LA, to ensure a clean, uncontaminated HOCM signal.
              </p>
            </div>
          </div>

          {/* Waveform illustrations */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <HOCMDopplerWaveform />
            <MRDopplerWaveform />
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100">
              <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Feature</div>
              <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-amber-600">HOCM LVOT</div>
              <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-red-600">MR</div>
            </div>
            <div className="divide-y divide-gray-50">
              {dopplerComparison.map(({ feature, hocm, mr }) => (
                <div key={feature} className="grid grid-cols-3">
                  <div className="px-4 py-3 text-xs font-semibold text-gray-700 bg-gray-50/50">{feature}</div>
                  <div className="px-4 py-3 text-xs text-amber-800 bg-amber-50/30">{hocm}</div>
                  <div className="px-4 py-3 text-xs text-red-800 bg-red-50/30">{mr}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-step differentiation protocol */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: BRAND }}>Step-by-Step Differentiation Protocol</h3>
            <div className="space-y-3">
              {[
                {
                  step: 1,
                  title: "Look at the shape",
                  detail: "HOCM LVOT: dagger-shaped (concave upstroke, late peak). MR: broad, rounded, uniform plateau. This is the single most reliable differentiator.",
                  critical: true,
                },
                {
                  step: 2,
                  title: "Check the timing of onset",
                  detail: "MR starts with the QRS (isovolumic contraction — before aortic valve opens). HOCM LVOT starts after isovolumic contraction (when AV opens). Use ECG gating.",
                  critical: true,
                },
                {
                  step: 3,
                  title: "Use PW Doppler to localize",
                  detail: "Sample at LVOT level (1 cm below AV) — if gradient is present here, it is LVOT obstruction. If no gradient at LVOT but high velocity in LA, it is MR.",
                  critical: false,
                },
                {
                  step: 4,
                  title: "Perform Valsalva",
                  detail: "HOCM LVOT gradient INCREASES with Valsalva (↓ preload → ↑ obstruction). MR signal is unchanged or slightly decreases. This is a definitive differentiator.",
                  critical: true,
                },
                {
                  step: 5,
                  title: "Use color Doppler",
                  detail: "HOCM: turbulence in LVOT + posteriorly directed MR jet from SAM. Primary MR: central or anteriorly directed jet. Absence of LVOT turbulence suggests MR rather than LVOT obstruction.",
                  critical: false,
                },
                {
                  step: 6,
                  title: "Check the 2D image",
                  detail: "Confirm SAM on 2D (PLAX). If no SAM is visible, reconsider LVOT obstruction diagnosis. SAM-related MR always coexists with SAM.",
                  critical: false,
                },
              ].map(({ step, title, detail, critical }) => (
                <div key={step} className={`flex items-start gap-3 p-3 rounded-lg ${critical ? "bg-[#f0fbfc] border border-[#189aa1]/20" : "bg-gray-50"}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: critical ? PURPLE : BRAND }}>{step}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-800">{title}</span>
                      {critical && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: PURPLE }}>KEY</span>}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pitfalls */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-red-600">Common Confounders</h3>
            <div className="space-y-2">
              {[
                {
                  pitfall: "Both signals present simultaneously",
                  fix: "In HOCM with SAM-related MR, BOTH signals are present. The LVOT dagger and MR holosystolic signal overlap. Use PW to separate them by sampling at different levels.",
                },
                {
                  pitfall: "Measuring MR velocity instead of LVOT velocity",
                  fix: "If the CW signal is broad and holosystolic, you are measuring MR — not LVOT gradient. Reposition beam more anteriorly toward LVOT.",
                },
                {
                  pitfall: "Underestimating LVOT gradient due to poor beam alignment",
                  fix: "Always try both A5C and A3C. Report the highest gradient obtained. Small alignment errors cause significant underestimation.",
                },
                {
                  pitfall: "Confusing dynamic LVOT obstruction with fixed AS",
                  fix: "AS: rounded, mid-peaking signal. HOCM: dagger-shaped, late-peaking. Use PW to confirm LVOT location of obstruction. Check AV morphology on 2D.",
                },
              ].map(({ pitfall, fix }) => (
                <div key={pitfall} className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-red-700">{pitfall}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{fix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Valsalva Acquisition Tab ─────────────────────────────────────── */}
      {activeTab === "valsalva" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Valsalva Acquisition
            </h2>
            <p className="text-sm text-gray-500">Choose your Valsalva technique to see the step-by-step protocol</p>
          </div>

          {/* ── Valsalva Physiology — SV/CO effects ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2" style={{ background: "#f0fbfc" }}>
              <Activity className="w-4 h-4" style={{ color: BRAND }} />
              <span className="text-sm font-bold" style={{ color: BRAND }}>How Valsalva Affects Stroke Volume and Cardiac Output</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-700 leading-relaxed">
                The Valsalva maneuver is a <strong>hemodynamic stress test</strong> that transiently alters preload, afterload, and venous return across four distinct phases. In HOCM, the critical window is the <strong>release phase</strong> — when venous return suddenly surges, the LV cavity is momentarily smallest, and the LVOT gradient peaks. Understanding each phase helps you anticipate the echo findings and time your measurements correctly.
              </p>
              <div className="space-y-2">
                {[
                  {
                    phase: "Phase I — Onset of Strain",
                    duration: "First 1-2 seconds",
                    color: "#0369a1",
                    physiology: "Sudden rise in intrathoracic pressure transiently compresses the aorta, briefly increasing aortic pressure and LV afterload.",
                    sv: "Stroke volume briefly increases (aortic compression augments forward flow).",
                    hocm: "LVOT gradient may transiently decrease at onset due to increased afterload reducing the pressure gradient across the LVOT.",
                  },
                  {
                    phase: "Phase II — Sustained Strain",
                    duration: "Seconds 2-15 (the main strain phase)",
                    color: "#dc2626",
                    physiology: "Sustained high intrathoracic pressure impedes venous return to the right heart. Right-sided filling falls, leading to reduced LV preload over 5-10 seconds. LV cavity progressively empties and becomes smaller.",
                    sv: "Stroke volume falls progressively. Cardiac output drops. HR rises reflexively (baroreceptor response) to compensate.",
                    hocm: "This is the key phase for HOCM. As LV cavity shrinks, the LVOT narrows further, SAM worsens, and the LVOT gradient rises. The dagger-shaped CW signal becomes more prominent and velocity increases.",
                  },
                  {
                    phase: "Phase III — Immediate Release",
                    duration: "First 1-2 seconds after release",
                    color: "#d97706",
                    physiology: "Intrathoracic pressure drops abruptly. The pulmonary venous reservoir empties into the left heart. Venous return surges to the right heart.",
                    sv: "Stroke volume is still low immediately after release as the right-sided surge has not yet reached the left heart.",
                    hocm: "Gradient may briefly remain elevated or drop slightly. Do NOT stop recording here — the peak gradient is still coming.",
                  },
                  {
                    phase: "Phase IV — Post-Release Overshoot",
                    duration: "2-8 seconds after release",
                    color: BRAND,
                    physiology: "The surge of venous return reaches the left heart. LV filling increases rapidly, but the LV cavity is still small from the strain phase. This creates a transient state of high preload with a small LV cavity.",
                    sv: "Stroke volume surges. Cardiac output overshoots above baseline (baroreceptor-mediated reflex bradycardia may occur).",
                    hocm: "CRITICAL: This is when the LVOT gradient peaks in HOCM. The small LV cavity + high filling velocity = maximum SAM + maximum LVOT obstruction. Measure the peak CW Doppler velocity at the dagger tip during THIS phase.",
                  },
                ].map(({ phase, duration, color, physiology, sv, hocm }) => (
                  <div key={phase} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ background: color + "15" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-xs font-bold" style={{ color }}>{phase}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">{duration}</span>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Physiology</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{physiology}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Stroke Volume / Cardiac Output</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{sv}</p>
                      </div>
                      <div className="p-2 rounded-lg" style={{ background: color + "10", border: `1px solid ${color}30` }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color }}>HOCM Significance</p>
                        <p className="text-xs leading-relaxed" style={{ color: color === BRAND ? "#0e4a50" : color === "#dc2626" ? "#7f1d1d" : color === "#d97706" ? "#78350f" : "#1e3a5f" }}>{hocm}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Goal-Directed Valsalva advantage:</strong> By standardizing the strain effort to 40 mmHg or more &times; 10 seconds, you ensure Phase II is sustained long enough to adequately reduce LV preload and unmask the maximum provoked gradient in Phase IV. Instructed Valsalva often fails to sustain Phase II adequately, leading to false-negative results.
                </p>
              </div>
            </div>
          </div>

          {/* ── Pathway selector ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Instructed Valsalva card */}
            <button
              onClick={() => setValsalvaPath(valsalvaPath === "instructed" ? null : "instructed")}
              className={`text-left rounded-2xl border-2 p-5 transition-all hover:shadow-md ${
                valsalvaPath === "instructed"
                  ? "border-amber-400 bg-amber-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-100">
                    <Activity className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Traditional</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-amber-500 transition-transform ${valsalvaPath === "instructed" ? "rotate-180" : ""}`} />
              </div>
              <h3 className="text-sm font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>Instructed Valsalva</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Verbal coaching only — patient bears down on command. No equipment required.</p>
              <div className="mt-3 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[10px] text-amber-700 font-semibold">No equipment needed · Higher false-negative risk</span>
              </div>
            </button>

            {/* Goal-Directed Valsalva card */}
            <button
              onClick={() => setValsalvaPath(valsalvaPath === "goal-directed" ? null : "goal-directed")}
              className={`text-left rounded-2xl border-2 p-5 transition-all hover:shadow-md ${
                valsalvaPath === "goal-directed"
                  ? "shadow-md"
                  : "border-gray-200 bg-white"
              }`}
              style={valsalvaPath === "goal-directed" ? { borderColor: BRAND, background: "#f0fbfc" } : {}}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#d0f5f6" }}>
                    <Target className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>Preferred</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: "#0369a1" }}>PMID 39886312</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform`} style={{ color: BRAND, transform: valsalvaPath === "goal-directed" ? "rotate(180deg)" : "" }} />
              </div>
              <h3 className="text-sm font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>Goal-Directed Valsalva</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Manometer circuit — patient blows to ≥40 mmHg and holds 10 seconds. Objective, reproducible.</p>
              <div className="mt-3 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: BRAND }} />
                <span className="text-[10px] font-semibold" style={{ color: BRAND }}>Sphygmomanometer + syringe + O₂ tubing · Fewer false-negatives</span>
              </div>
            </button>
          </div>

          {/* ── No path selected: show comparison ── */}
          {!valsalvaPath && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: BRAND }}>Why Goal-Directed is Preferred</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: "#0369a1" }}>PMID 39886312</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Kim et al., 2025 — select a pathway above to see the full protocol</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-bold text-gray-800">Instructed Valsalva</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Traditional</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: "Coaching", text: "\"Bear down hard for 10–15 seconds\"" },
                      { label: "Endpoint", text: "Fixed duration; patient effort only" },
                      { label: "Equipment", text: "None" },
                      { label: "False-negative risk", text: "Higher — up to 30–40% subtherapeutic" },
                    ].map(({ label, text }) => (
                      <div key={label}>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}: </span>
                        <span className="text-xs text-gray-700">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border-2 p-4" style={{ borderColor: BRAND, background: "#f0fbfc" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
                    <span className="text-xs font-bold text-gray-800">Goal-Directed Valsalva</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white" style={{ background: BRAND }}>Preferred</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: "Coaching", text: "\"Blow to 40 mmHg on the gauge — hold 10 seconds\"" },
                      { label: "Endpoint", text: "Sphygmomanometer ≥40 mmHg × 10 seconds" },
                      { label: "Equipment", text: "Sphygmomanometer + O₂ tubing + 20 mL syringe" },
                      { label: "False-negative risk", text: "Lower — pressure confirmed on gauge" },
                    ].map(({ label, text }) => (
                      <div key={label}>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}: </span>
                        <span className="text-xs text-gray-700">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── INSTRUCTED VALSALVA PROTOCOL ── */}
          {valsalvaPath === "instructed" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 leading-relaxed">
                  <strong>Goal:</strong> Capture the peak provoked LVOT gradient during the <strong>release phase</strong>. The most common error is stopping the recording at the end of strain — the peak gradient occurs AFTER release.
                </div>
              </div>
              {[
                {
                  phase: "Setup",
                  color: BRAND,
                  steps: [
                    "Obtain and document resting LVOT gradient from A5C or A3C (100 mm/s sweep speed)",
                    "Confirm dagger-shaped CW signal and optimal beam alignment",
                    "Switch sweep speed to 50 mm/s to capture multiple beats on one sweep",
                    "Position patient in steep left lateral decubitus (60–90°)",
                    "Explain the maneuver — demonstrate if needed",
                  ],
                },
                {
                  phase: "Coaching the Patient",
                  color: "#d97706",
                  steps: [
                    "Instruct: 'Take a normal breath, then bear down hard as if straining for a bowel movement'",
                    "Instruct: 'Hold for 10–15 seconds — do NOT let any air out'",
                    "Instruct: 'When I say release, let go completely and breathe normally'",
                    "Practice once without imaging to confirm patient understands",
                    "Confirm HR increases during strain (≥10 bpm) — indicates adequate effort",
                  ],
                },
                {
                  phase: "Recording",
                  color: "#dc2626",
                  steps: [
                    "Start CW Doppler recording 3–5 beats BEFORE the maneuver",
                    "Cue patient: 'OK, bear down now'",
                    "Observe: LV cavity should visibly decrease during strain",
                    "Maintain CW beam position — do NOT move probe during maneuver",
                    "At 10–15 seconds: cue patient 'Release now'",
                    "CRITICAL: Continue recording for 5–10 beats AFTER release — peak gradient occurs here",
                    "Allow 2–3 minutes recovery before repeating if needed",
                  ],
                },
                {
                  phase: "Measurement",
                  color: "#0e7490",
                  steps: [
                    "Identify the beat with the highest peak velocity during the release phase",
                    "Measure peak velocity at the TIP of the dagger (late systole)",
                    "Calculate gradient: ΔP = 4V²",
                    "Report as: 'Provoked LVOT gradient (Valsalva): __ mmHg'",
                    "Document adequacy: LV cavity decrease >=40%, HR increase >=10 bpm",
                    "If inadequate, note in report and repeat or use alternative provocation",
                  ],
                },
              ].map(({ phase, color, steps }) => (
                <div key={phase} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2"
                    style={{ background: color + "10" }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs font-bold" style={{ color }}>{phase}</span>
                  </div>
                  <div className="px-5 py-4">
                    <ol className="space-y-2">
                      {steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5"
                            style={{ background: color }}>{i + 1}</div>
                          <p className="text-xs text-gray-700 leading-relaxed">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
              {/* Adequacy checklist */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-amber-600">Adequacy Checklist</h3>
                <div className="space-y-2">
                  {[
                    { check: "LV cavity decreases ≥40% during strain phase", critical: true },
                    { check: "Heart rate increases ≥10 bpm during strain", critical: true },
                    { check: "Patient maintained effort for ≥10 seconds", critical: false },
                    { check: "Recording continued ≥5 beats after release", critical: true },
                    { check: "CW beam maintained on LVOT throughout", critical: false },
                    { check: "Peak gradient measured at dagger tip (late systole)", critical: false },
                  ].map(({ check, critical }) => (
                    <div key={check} className={`flex items-center gap-2 p-2.5 rounded-lg ${critical ? "bg-amber-50 border border-amber-200" : "bg-gray-50"}`}>
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${critical ? "text-amber-600" : "text-gray-400"}`} />
                      <span className="text-xs text-gray-700">{check}</span>
                      {critical && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white flex-shrink-0">REQUIRED</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── GOAL-DIRECTED VALSALVA PROTOCOL ── */}
          {valsalvaPath === "goal-directed" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-4 rounded-xl bg-[#f0fbfc] border border-[#189aa1]/20 mb-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                <div className="text-xs text-[#0e4a50] leading-relaxed">
                  <strong>Goal:</strong> The patient blows into the manometer circuit until the gauge reads <strong>≥40 mmHg</strong>, then holds for <strong>10 seconds</strong>. This standardizes intrathoracic pressure and produces significantly higher, more reproducible provoked gradients than instructed Valsalva (Kim et al., PMID 39886312).
                </div>
              </div>

              {/* Circuit assembly */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background: BRAND + "10" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
                  <span className="text-xs font-bold" style={{ color: BRAND }}>Circuit Assembly</span>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {[
                    "Gather: aneroid sphygmomanometer, ~30 cm oxygen tubing, 20 mL syringe, and (optional) disposable respiratory filter",
                    "Connect one end of the O₂ tubing to the sphygmomanometer inflation port (where the hand bulb normally attaches)",
                    "Attach the 20 mL syringe to the other end of the tubing — this is the patient's mouthpiece. Insert the respiratory filter between syringe and tubing if using one",
                    "Pre-inflate the cuff to ~40 mmHg and close the valve — this pre-loads the system so the patient's blow immediately registers on the gauge",
                    "Practice once before imaging: patient blows into the syringe until the gauge reaches 40 mmHg and holds. Confirm they can sustain it for 10 seconds",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{ background: BRAND }}>{i + 1}</div>
                      <p className="text-xs text-gray-700 leading-relaxed pt-0.5">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coaching */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background: "#0e7490" + "10" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: "#0e7490" }} />
                  <span className="text-xs font-bold" style={{ color: "#0e7490" }}>Coaching the Patient</span>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {[
                    "Instruct: 'Blow into the tube until the gauge reads 40 — then hold it there'",
                    "Instruct: 'Keep blowing steadily — don't let the needle drop below 40'",
                    "Instruct: 'When I say release, stop blowing and breathe normally'",
                    "Practice once without imaging to confirm patient can reach and hold ≥40 mmHg",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{ background: "#0e7490" }}>{i + 1}</div>
                      <p className="text-xs text-gray-700 leading-relaxed pt-0.5">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recording */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background: "#dc2626" + "10" }}>
                  <div className="w-2 h-2 rounded-full bg-red-600" />
                  <span className="text-xs font-bold text-red-600">Recording</span>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {[
                    "Start CW Doppler recording 3–5 beats BEFORE cueing the patient",
                    "Cue patient to blow into the circuit. Watch the manometer — confirm gauge reaches ≥40 mmHg",
                    "Patient holds ≥40 mmHg for 10 seconds. Keep CW beam on LVOT — do NOT move the probe",
                    "Cue patient to release. CRITICAL: Continue recording 5–10 beats AFTER release — peak gradient occurs during the rebound phase",
                    "Allow 2–3 minutes recovery before repeating if needed",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 bg-red-600">{i + 1}</div>
                      <p className={`text-xs leading-relaxed pt-0.5 ${i === 3 ? "text-red-700 font-semibold" : "text-gray-700"}`}>{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Measurement */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background: "#0e4a50" + "15" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: "#0e4a50" }} />
                  <span className="text-xs font-bold" style={{ color: "#0e4a50" }}>Measurement</span>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {[
                    "Identify the beat with the highest peak velocity during the release phase",
                    "Measure peak velocity at the TIP of the dagger (late systole)",
                    "Calculate gradient: ΔP = 4V²",
                    "Report as: 'Provoked LVOT gradient (goal-directed Valsalva): __ mmHg'",
                    "If patient cannot reach ≥40 mmHg after two attempts, document as inadequate and consider exercise stress echo",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{ background: "#0e4a50" }}>{i + 1}</div>
                      <p className="text-xs text-gray-700 leading-relaxed pt-0.5">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment checklist */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Equipment Checklist</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { item: "Aneroid sphygmomanometer", required: true },
                    { item: "Oxygen tubing (~30 cm)", required: true },
                    { item: "20 mL syringe (mouthpiece)", required: true },
                    { item: "Disposable respiratory filter (infection control)", required: false },
                    { item: "Cuff pre-inflated to ~40 mmHg before patient blows", required: true },
                    { item: "No equipment? Use instructed Valsalva + HR ≥10 bpm as adequacy surrogate", required: false },
                  ].map(({ item, required }) => (
                    <div key={item} className="flex items-start gap-1.5">
                      <Info className={`w-3 h-3 flex-shrink-0 mt-0.5 ${required ? "text-amber-600" : "text-amber-400"}`} />
                      <span className={`text-xs ${required ? "text-amber-800 font-medium" : "text-amber-700"}`}>
                        {required ? "[Required] " : "[Optional] "}{item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Adequacy checklist */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Adequacy Checklist</h3>
                <div className="space-y-2">
                  {[
                    { check: "Manometer gauge reached ≥40 mmHg", critical: true },
                    { check: "Patient held ≥40 mmHg for 10 seconds", critical: true },
                    { check: "Recording continued ≥5 beats after release", critical: true },
                    { check: "CW beam maintained on LVOT throughout", critical: false },
                    { check: "Peak gradient measured at dagger tip (late systole)", critical: false },
                    { check: "LV cavity decrease visible during strain phase", critical: false },
                  ].map(({ check, critical }) => (
                    <div key={check} className={`flex items-center gap-2 p-2.5 rounded-lg ${critical ? "bg-[#f0fbfc] border border-[#189aa1]/20" : "bg-gray-50"}`}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: critical ? BRAND : "#9ca3af" }} />
                      <span className="text-xs text-gray-700">{check}</span>
                      {critical && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ background: BRAND }}>REQUIRED</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Myosin Inhibitor Tab ─────────────────────────────────────────── */}
      {activeTab === "myosin" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Myosin Inhibitors in HOCM
            </h2>
            <p className="text-sm text-gray-500">Mechanism, echo monitoring protocol, and titration guidance for mavacamten and aficamten</p>
          </div>

          {/* Mechanism card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2" style={{ background: "#f0fbfc" }}>
              <Zap className="w-4 h-4" style={{ color: BRAND }} />
              <span className="text-sm font-bold" style={{ color: BRAND }}>Mechanism of Action</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-700 leading-relaxed">
                Myosin inhibitors are a class of cardiac-specific drugs that <strong>directly reduce myosin-actin cross-bridge formation</strong>, decreasing the number of force-generating interactions per cardiac cycle. In HOCM, the hypercontractile sarcomere is the primary driver of dynamic LVOT obstruction — myosin inhibitors target this at the molecular level.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    drug: "Mavacamten (Camzyos)",
                    badge: "FDA Approved 2022",
                    badgeColor: "#0369a1",
                    mechanism: "Allosteric inhibitor of cardiac myosin ATPase. Shifts myosin heads from the disordered-relaxed (DRX) state to the super-relaxed (SRX) state, reducing the number of myosin heads available for actin binding.",
                    effect: "Reduces LV contractility, decreases LVOT gradient, reduces SAM, and improves diastolic function. Lowers LVEF by 3-5% on average.",
                    dose: "Starting: 2.5 mg/day orally. Titrate every 12 weeks based on LVEF and LVOT gradient.",
                    safetyStop: "HOLD if LVEF < 50% on any echo during treatment.",
                  },
                  {
                    drug: "Aficamten (Nuvation)",
                    badge: "FDA Approved 2025",
                    badgeColor: "#059669",
                    mechanism: "Second-generation cardiac myosin inhibitor. Binds to the same myosin ATPase pocket as mavacamten but with faster on/off kinetics, allowing more predictable dose-response and shorter washout period.",
                    effect: "Similar gradient reduction and SAM abolition. Shorter half-life (~3 days vs ~9 days for mavacamten) allows faster titration and recovery if LVEF drops.",
                    dose: "Starting: 5 mg/day orally. Titrate every 4 weeks based on LVEF and LVOT gradient.",
                    safetyStop: "HOLD if LVEF < 50% on any echo during treatment.",
                  },
                ].map(({ drug, badge, badgeColor, mechanism, effect, dose, safetyStop }) => (
                  <div key={drug} className="rounded-xl border border-gray-100 p-4 space-y-2.5" style={{ background: "#fafafa" }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-gray-800 leading-snug">{drug}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: badgeColor }}>{badge}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Mechanism</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{mechanism}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Echo Effect</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{effect}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Dosing</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{dose}</p>
                    </div>
                    <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-50 border border-red-100">
                      <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 font-semibold">{safetyStop}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Effect on heart and stroke volume */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2" style={{ background: "#f0fbfc" }}>
              <Activity className="w-4 h-4" style={{ color: BRAND }} />
              <span className="text-sm font-bold" style={{ color: BRAND }}>Effect on the Heart and Stroke Volume</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-700 leading-relaxed">
                By reducing myosin cross-bridge cycling, myosin inhibitors produce a <strong>controlled reduction in LV contractility</strong>. In obstructive HOCM, this is therapeutically beneficial — the hypercontractile state is the root cause of obstruction. The hemodynamic consequences are predictable and measurable on echo:
              </p>
              <div className="space-y-2">
                {[
                  { label: "LVOT Gradient", before: "Elevated (>=30 mmHg at rest or >=50 mmHg provoked)", after: "Reduced or abolished — goal: resting <30 mmHg, provoked <50 mmHg", icon: TrendingUp, positive: true },
                  { label: "SAM", before: "Present (septal contact in severe cases)", after: "Reduced or abolished — SAM abolition correlates with gradient reduction", icon: Activity, positive: true },
                  { label: "LV Ejection Fraction", before: "Typically hyperdynamic (>70%)", after: "Decreases 3-5% on average. HOLD drug if LVEF <50%", icon: Heart, positive: false },
                  { label: "Stroke Volume (SV)", before: "May be reduced due to obstruction limiting forward flow", after: "Improves as obstruction resolves and forward flow increases. Measure LVOT VTI x LVOT area", icon: Layers, positive: true },
                  { label: "Cardiac Output (CO)", before: "Reduced in severe obstruction despite high EF", after: "Improves with gradient reduction. CO = SV x HR. Monitor LVOT VTI trend across visits", icon: TrendingUp, positive: true },
                  { label: "Diastolic Function", before: "Impaired relaxation (reduced e', elevated E/e')", after: "Improves over weeks-months. e' increases, E/e' decreases, LAVI may reduce", icon: Ruler, positive: true },
                  { label: "MR (SAM-related)", before: "Posteriorly directed MR from SAM-leaflet contact", after: "Reduces or resolves as SAM abolishes — reassess MR severity at each visit", icon: Activity, positive: true },
                ].map(({ label, before, after, icon: Icon, positive }) => (
                  <div key={label} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2" style={{ background: "#f0fbfc" }}>
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BRAND }} />
                      <span className="text-xs font-bold text-gray-800">{label}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                      <div className="px-4 py-2.5 bg-red-50">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-0.5">Before Treatment</p>
                        <p className="text-xs text-red-800 leading-relaxed">{before}</p>
                      </div>
                      <div className={`px-4 py-2.5 ${positive ? "bg-green-50" : "bg-amber-50"}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${positive ? "text-green-600" : "text-amber-600"}`}>After Treatment</p>
                        <p className={`text-xs leading-relaxed ${positive ? "text-green-800" : "text-amber-800"}`}>{after}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Echo monitoring protocol */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2" style={{ background: "#f0fbfc" }}>
              <Target className="w-4 h-4" style={{ color: BRAND }} />
              <span className="text-sm font-bold" style={{ color: BRAND }}>Echo Monitoring Protocol — Titration Visits</span>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Goal-Directed Valsalva is required at every titration visit.</strong> Resting gradient alone is insufficient — provoked gradient determines whether the dose is therapeutic, sub-therapeutic, or causing excessive EF reduction.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  {
                    visit: "Baseline (Pre-treatment)",
                    color: "#6b7280",
                    measurements: [
                      "LVEF (biplane Simpson's) — document baseline",
                      "Resting LVOT gradient (A5C + A3C CW Doppler)",
                      "Provoked LVOT gradient (Goal-Directed Valsalva)",
                      "LVOT VTI — calculate stroke volume (SV = VTI x LVOT area)",
                      "SAM assessment (PLAX M-mode + 2D)",
                      "MR severity and jet direction (A4C color Doppler)",
                      "Diastolic function: septal e', lateral e', E/e', LAVI",
                      "LV wall thickness (IVS, LVPW — PLAX M-mode)",
                    ],
                  },
                  {
                    visit: "Titration Visit (Mavacamten: 4-12 wks | Aficamten: 4 wks)",
                    color: BRAND,
                    measurements: [
                      "LVEF (biplane Simpson's) — HOLD if <50%",
                      "Resting LVOT gradient — target <30 mmHg",
                      "Provoked LVOT gradient (Goal-Directed Valsalva) — target <50 mmHg",
                      "LVOT VTI — compare to baseline (SV trend)",
                      "SAM — document reduction or abolition",
                      "MR severity — reassess if SAM has changed",
                      "Diastolic function parameters — document improvement trend",
                    ],
                  },
                  {
                    visit: "Safety Hold Criteria — STOP Drug Immediately",
                    color: "#dc2626",
                    measurements: [
                      "LVEF <50% on any echo during treatment",
                      "Symptomatic hypotension or pre-syncope",
                      "New LVEF reduction >10% from baseline (even if still >50%)",
                      "Significant worsening of diastolic function",
                    ],
                  },
                ].map(({ visit, color, measurements }) => (
                  <div key={visit} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: color + "15" }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs font-bold" style={{ color }}>{visit}</span>
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                      {measurements.map((m, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
                          <span className="text-xs text-gray-700 leading-relaxed">{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stroke Volume Assessment */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2" style={{ background: "#f0fbfc" }}>
              <Ruler className="w-4 h-4" style={{ color: BRAND }} />
              <span className="text-sm font-bold" style={{ color: BRAND }}>Stroke Volume Assessment — How to Measure</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-700 leading-relaxed">
                Stroke volume is the most sensitive marker of hemodynamic improvement with myosin inhibitors. As LVOT obstruction resolves, forward flow increases and LVOT VTI rises — even before the LVEF visibly changes.
              </p>
              <div className="rounded-xl p-4 space-y-3" style={{ background: "#f0fbfc", border: "1px solid #189aa1" + "30" }}>
                <p className="text-xs font-bold" style={{ color: BRAND }}>Step-by-Step SV Calculation</p>
                <div className="space-y-2">
                  {[
                    { step: "1", label: "LVOT Diameter", detail: "Measure in PLAX at 1 cm below aortic valve, inner edge to inner edge, at end-systole. Typical range: 1.8-2.4 cm." },
                    { step: "2", label: "LVOT Area", detail: "Area = pi x (diameter/2)^2. Example: 2.0 cm diameter = 3.14 cm^2" },
                    { step: "3", label: "LVOT VTI", detail: "PW Doppler sample volume 0.5 cm below aortic valve in A5C or A3C. Trace the outer edge of the velocity envelope. Normal: 18-22 cm." },
                    { step: "4", label: "Stroke Volume", detail: "SV = LVOT Area x LVOT VTI. Example: 3.14 x 20 cm = 62.8 mL. Normal: 60-100 mL." },
                    { step: "5", label: "Cardiac Output", detail: "CO = SV x HR. Example: 63 mL x 70 bpm = 4.4 L/min. Normal: 4-8 L/min." },
                    { step: "6", label: "Cardiac Index", detail: "CI = CO / BSA. Normal: 2.2-4.0 L/min/m^2. Use for serial comparison across visits." },
                  ].map(({ step, label, detail }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{ background: BRAND }}>{step}</div>
                      <div>
                        <span className="text-xs font-bold text-gray-800">{label}: </span>
                        <span className="text-xs text-gray-600 leading-relaxed">{detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Pitfall:</strong> In HOCM, the LVOT VTI may be contaminated by the high-velocity LVOT obstruction signal if the PW sample volume is placed too close to the obstruction site. Always place the PW sample volume <strong>0.5 cm below the AV</strong> and confirm the signal is laminar (narrow spectral envelope) before tracing.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Machine Settings Tab ─────────────────────────────────────────── */}
      {activeTab === "settings" && (
        <div className="container py-6 max-w-3xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Machine Settings — HOCM
            </h2>
            <p className="text-sm text-gray-500">Recommended ultrasound machine settings for HOCM assessment</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100">
              <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Setting</div>
              <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Recommended Value</div>
              <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Note</div>
            </div>
            <div className="divide-y divide-gray-50">
              {machineSettings.map(({ setting, value, note }) => (
                <div key={setting} className="grid grid-cols-3">
                  <div className="px-4 py-3 text-xs font-semibold text-gray-700">{setting}</div>
                  <div className="px-4 py-3 text-xs font-bold" style={{ color: BRAND }}>{value}</div>
                  <div className="px-4 py-3 text-xs text-gray-500">{note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigator CTA */}
          <div className="mt-5 p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#4ad9e0] uppercase tracking-wider mb-0.5">Protocol Reference</p>
              <p className="text-white text-sm font-bold">HOCM-Assist™ Navigator</p>
              <p className="text-white/60 text-xs">SAM grading, gradient thresholds, Valsalva protocol, and reporting guide</p>
            </div>
            <Link href="/hocm-navigator">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: PURPLE }}>
                Open Navigator
              </button>
            </Link>
          </div>
      </div>
      )}
    </div>
  );
  if (_noLayout) return inner;
  return (
    <Layout>
      <ScanCoachNavBar navigatorPath="/hocm-navigator" navigatorLabel="HOCM-Assist™ Navigator" />
      <PremiumOverlay featureName="HOCM-Assist™ ScanCoach">
        {inner}
      </PremiumOverlay>
    </Layout>
  );
}

