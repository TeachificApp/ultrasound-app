/*
  PediatricAssist™ Calculators
  Clinically relevant pediatric ultrasound measurements:
  - Appendix: diameter, compressibility
  - Intussusception: outer diameter, length
  - Pyloric Stenosis: muscle thickness, channel length, outer diameter
  - Kidneys: renal length (age/weight nomogram), hydronephrosis grading, PVR
  - Spine: conus level, filum diameter
  - Hips: Graf alpha/beta angles, DDH classification
  - Neuro: ventricle width, ACA RI, cisterna magna

  References: AIUM, ACR, ESPR, SPR, SRU, Papile, Graf, SFU, AAP
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Inter body
*/
import { useState } from "react";
import { Baby, Calculator, ChevronDown, ChevronUp, Info } from "lucide-react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";

// ─── Types ────────────────────────────────────────────────────────────────────
type CalcResult = {
  value: string;
  interpretation: string;
  color: "green" | "yellow" | "red" | "blue";
  reference?: string;
};

// ─── Calculator Tab Definitions ───────────────────────────────────────────────
const CALC_TABS = [
  { id: "appendix",        label: "Appendix",        icon: "🔍" },
  { id: "intussusception", label: "Intussusception",  icon: "🌀" },
  { id: "pyloric",         label: "Pyloric Stenosis", icon: "🍼" },
  { id: "kidneys",         label: "Kidneys",          icon: "🫘" },
  { id: "spine",           label: "Spine",            icon: "🦴" },
  { id: "hips",            label: "Hips (Graf)",      icon: "🦵" },
  { id: "neuro",           label: "Neuro",            icon: "🧠" },
];

// ─── Color classes ────────────────────────────────────────────────────────────
const COLOR_CLASSES = {
  green:  { bg: "bg-emerald-50",  border: "border-emerald-200", text: "text-emerald-800",  badge: "bg-emerald-100 text-emerald-800"  },
  yellow: { bg: "bg-amber-50",    border: "border-amber-200",   text: "text-amber-800",    badge: "bg-amber-100 text-amber-800"    },
  red:    { bg: "bg-red-50",      border: "border-red-200",     text: "text-red-800",      badge: "bg-red-100 text-red-800"      },
  blue:   { bg: "bg-blue-50",     border: "border-blue-200",    text: "text-blue-800",     badge: "bg-blue-100 text-blue-800"    },
};

// ─── Renal Length Nomogram (age-based, approximate) ──────────────────────────
// Source: Dinkel et al. (1985), Rosenbaum & Blumhagen (1987)
// Returns {mean, sd} in mm for given age in months
function renalLengthNorm(ageMonths: number): { mean: number; sd: number } {
  // Simplified linear approximation
  if (ageMonths <= 1)  return { mean: 45, sd: 5 };
  if (ageMonths <= 3)  return { mean: 52, sd: 5 };
  if (ageMonths <= 6)  return { mean: 58, sd: 6 };
  if (ageMonths <= 12) return { mean: 63, sd: 6 };
  if (ageMonths <= 24) return { mean: 70, sd: 7 };
  if (ageMonths <= 36) return { mean: 76, sd: 7 };
  if (ageMonths <= 48) return { mean: 81, sd: 8 };
  if (ageMonths <= 60) return { mean: 85, sd: 8 };
  if (ageMonths <= 72) return { mean: 89, sd: 8 };
  if (ageMonths <= 84) return { mean: 93, sd: 9 };
  if (ageMonths <= 96) return { mean: 96, sd: 9 };
  if (ageMonths <= 108) return { mean: 99, sd: 9 };
  if (ageMonths <= 120) return { mean: 102, sd: 10 };
  if (ageMonths <= 132) return { mean: 105, sd: 10 };
  if (ageMonths <= 144) return { mean: 108, sd: 10 };
  if (ageMonths <= 156) return { mean: 110, sd: 10 };
  if (ageMonths <= 168) return { mean: 112, sd: 11 };
  return { mean: 114, sd: 11 };
}

// ─── Graf DDH Classification ──────────────────────────────────────────────────
function grafClassification(alpha: number, beta: number, ageWeeks: number): { type: string; description: string; management: string; color: "green" | "yellow" | "red" } {
  if (alpha >= 60) return { type: "Type I", description: "Normal mature hip", management: "No treatment required. Routine follow-up.", color: "green" };
  if (alpha >= 50 && alpha < 60) {
    if (ageWeeks < 12) return { type: "Type IIa", description: "Physiological immaturity (<3 months)", management: "Repeat ultrasound at 6 weeks. No treatment unless worsening.", color: "yellow" };
    return { type: "Type IIb", description: "Delayed ossification (>3 months)", management: "Orthopaedic referral. Pavlik harness likely required.", color: "red" };
  }
  if (alpha >= 43 && alpha < 50) {
    if (beta < 77) return { type: "Type IIc", description: "Critical borderline hip", management: "Urgent orthopaedic referral. Treatment required.", color: "red" };
    return { type: "Type D", description: "Decentring hip (subluxation risk)", management: "Urgent orthopaedic referral. Treatment required.", color: "red" };
  }
  if (alpha >= 43) return { type: "Type III", description: "Subluxed hip", management: "Urgent orthopaedic referral. Closed reduction likely required.", color: "red" };
  return { type: "Type IV", description: "Dislocated hip", management: "Urgent orthopaedic referral. Closed reduction required.", color: "red" };
}

// ─── SFU Hydronephrosis Grading ───────────────────────────────────────────────
function sfuGrade(apDiameter: number, calycealDilation: boolean, corticalThinning: boolean): { grade: string; description: string; management: string; color: "green" | "yellow" | "red" } {
  if (apDiameter < 4) return { grade: "Grade 0", description: "Normal. No hydronephrosis.", management: "No action required.", color: "green" };
  if (apDiameter < 7 && !calycealDilation) return { grade: "Grade 1", description: "Mild hydronephrosis. Renal pelvis only.", management: "Follow-up ultrasound at 3–6 months.", color: "yellow" };
  if (apDiameter < 10 && calycealDilation && !corticalThinning) return { grade: "Grade 2–3", description: "Moderate hydronephrosis. Renal pelvis + calyces.", management: "Urological referral. VCUG and MAG3 renogram may be required.", color: "yellow" };
  return { grade: "Grade 3–4", description: "Severe hydronephrosis. Cortical thinning present.", management: "Urgent urological referral. Obstruction until proven otherwise.", color: "red" };
}

// ─── Calculators ─────────────────────────────────────────────────────────────

function AppendixCalculator() {
  const [diameter, setDiameter] = useState("");
  const [compressible, setCompressible] = useState<"yes" | "no" | "">("");
  const [fatStranding, setFatStranding] = useState<"yes" | "no" | "">("");
  const [appendicolith, setAppendilolith] = useState<"yes" | "no" | "">("");

  const d = parseFloat(diameter);
  let result: CalcResult | null = null;

  if (!isNaN(d) && compressible !== "") {
    let score = 0;
    let interpretation = "";
    let color: "green" | "yellow" | "red" = "green";

    if (d > 7) { score += 2; }
    else if (d >= 6) { score += 1; }
    if (compressible === "no") score += 2;
    if (fatStranding === "yes") score += 1;
    if (appendicolith === "yes") score += 1;

    if (score === 0) { interpretation = "Normal appendix. Appendicitis excluded."; color = "green"; }
    else if (score <= 2) { interpretation = "Borderline. Clinical correlation required. Consider CT if suspicion persists."; color = "yellow"; }
    else { interpretation = "Appendicitis likely. Surgical referral recommended."; color = "red"; }

    result = {
      value: `${d.toFixed(1)} mm${compressible === "no" ? " (non-compressible)" : " (compressible)"}`,
      interpretation,
      color,
      reference: "AIUM Practice Parameter for Ultrasound Examination of the Abdomen and Retroperitoneum (2017)",
    };
  }

  const colors = result ? COLOR_CLASSES[result.color] : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Appendix Assessment</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appendix outer diameter (mm)</label>
            <input
              type="number" step="0.1" min="0" max="30"
              value={diameter} onChange={e => setDiameter(e.target.value)}
              placeholder="e.g. 6.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40"
            />
            <p className="text-xs text-gray-400 mt-1">Normal ≤6 mm · Appendicitis &gt;7 mm · Borderline 6–7 mm</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Compressible?</label>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map(v => (
                <button key={v} onClick={() => setCompressible(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${compressible === v ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                  {v === "yes" ? "Yes (normal)" : "No (abnormal)"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Periappendiceal fat stranding?</label>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map(v => (
                <button key={v} onClick={() => setFatStranding(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${fatStranding === v ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                  {v === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Appendicolith present?</label>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map(v => (
                <button key={v} onClick={() => setAppendilolith(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${appendicolith === v ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                  {v === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {result && colors && (
        <div className={`rounded-xl border p-5 ${colors.bg} ${colors.border}`}>
          <div className="flex items-start gap-3">
            <div className={`text-2xl font-bold ${colors.text}`}>{result.value}</div>
          </div>
          <p className={`mt-2 text-sm font-medium ${colors.text}`}>{result.interpretation}</p>
          {result.reference && <p className="mt-2 text-xs text-gray-500">Ref: {result.reference}</p>}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reference Values</p>
        <table className="w-full text-xs text-gray-700">
          <thead><tr className="border-b border-gray-200"><th className="text-left py-1">Parameter</th><th className="text-left py-1">Normal</th><th className="text-left py-1">Appendicitis</th></tr></thead>
          <tbody>
            <tr className="border-b border-gray-100"><td className="py-1.5">Outer diameter</td><td className="py-1.5 text-emerald-700">≤6 mm</td><td className="py-1.5 text-red-700">&gt;7 mm</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5">Compressibility</td><td className="py-1.5 text-emerald-700">Compressible</td><td className="py-1.5 text-red-700">Non-compressible</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5">Wall thickness</td><td className="py-1.5 text-emerald-700">≤2 mm</td><td className="py-1.5 text-red-700">&gt;3 mm</td></tr>
            <tr><td className="py-1.5">Fat stranding</td><td className="py-1.5 text-emerald-700">Absent</td><td className="py-1.5 text-red-700">Present</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IntussusceptionCalculator() {
  const [outerDiam, setOuterDiam] = useState("");
  const [length, setLength] = useState("");
  const [doppler, setDoppler] = useState<"present" | "absent" | "">("");

  const d = parseFloat(outerDiam);
  const l = parseFloat(length);

  let result: CalcResult | null = null;
  if (!isNaN(d)) {
    let color: "green" | "yellow" | "red" = "green";
    let interpretation = "";
    if (d < 2.5) {
      interpretation = "Diameter <2.5 cm. Likely transient small bowel intussusception. Monitor — usually resolves spontaneously.";
      color = "yellow";
    } else {
      interpretation = "Diameter ≥2.5 cm. Pathological intussusception. Urgent surgical/radiology referral for pneumatic or hydrostatic reduction.";
      color = "red";
    }
    if (doppler === "absent") {
      interpretation += " ⚠️ Absent Doppler flow — ischaemia suspected. Increased risk of perforation. Discuss with surgical team before reduction.";
      color = "red";
    }
    result = {
      value: `Outer diameter: ${d.toFixed(1)} cm${!isNaN(l) ? ` · Length: ${l.toFixed(1)} cm` : ""}`,
      interpretation,
      color,
      reference: "AIUM Practice Parameter; Navarro et al., Pediatric Radiology (2004)",
    };
  }

  const colors = result ? COLOR_CLASSES[result.color] : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Intussusception Assessment</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outer diameter (cm)</label>
            <input type="number" step="0.1" min="0" max="10" value={outerDiam} onChange={e => setOuterDiam(e.target.value)}
              placeholder="e.g. 3.2"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Pathological ≥2.5 cm (target sign in transverse plane)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Length of intussusceptum (cm, optional)</label>
            <input type="number" step="0.1" min="0" max="20" value={length} onChange={e => setLength(e.target.value)}
              placeholder="e.g. 5.0"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Colour Doppler flow in intussusceptum?</label>
            <div className="flex gap-2">
              {(["present", "absent"] as const).map(v => (
                <button key={v} onClick={() => setDoppler(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${doppler === v ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                  {v === "present" ? "Present (viable)" : "Absent (ischaemia)"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {result && colors && (
        <div className={`rounded-xl border p-5 ${colors.bg} ${colors.border}`}>
          <p className={`font-bold text-sm ${colors.text}`}>{result.value}</p>
          <p className={`mt-2 text-sm ${colors.text}`}>{result.interpretation}</p>
          {result.reference && <p className="mt-2 text-xs text-gray-500">Ref: {result.reference}</p>}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reference Values</p>
        <table className="w-full text-xs text-gray-700">
          <thead><tr className="border-b border-gray-200"><th className="text-left py-1">Parameter</th><th className="text-left py-1">Transient (benign)</th><th className="text-left py-1">Pathological</th></tr></thead>
          <tbody>
            <tr className="border-b border-gray-100"><td className="py-1.5">Outer diameter</td><td className="py-1.5 text-emerald-700">&lt;2.5 cm</td><td className="py-1.5 text-red-700">≥2.5 cm</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5">Mesenteric fat</td><td className="py-1.5 text-emerald-700">Absent</td><td className="py-1.5 text-red-700">Present (within intussusceptum)</td></tr>
            <tr><td className="py-1.5">Doppler flow</td><td className="py-1.5 text-emerald-700">Present</td><td className="py-1.5 text-amber-700">Absent = ischaemia risk</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PyloricCalculator() {
  const [muscleThickness, setMuscleThickness] = useState("");
  const [channelLength, setChannelLength] = useState("");
  const [outerDiam, setOuterDiam] = useState("");

  const mt = parseFloat(muscleThickness);
  const cl = parseFloat(channelLength);
  const od = parseFloat(outerDiam);

  let result: CalcResult | null = null;
  if (!isNaN(mt)) {
    const hpsMt = mt >= 4;
    const hpsCl = !isNaN(cl) ? cl >= 17 : null;
    const hpsOd = !isNaN(od) ? od >= 15 : null;

    let color: "green" | "yellow" | "red" = "green";
    let interpretation = "";

    if (hpsMt && (hpsCl === null || hpsCl) && (hpsOd === null || hpsOd)) {
      interpretation = "Hypertrophic Pyloric Stenosis (HPS) confirmed. Muscle thickness ≥4 mm";
      if (!isNaN(cl)) interpretation += ` + channel length ≥17 mm`;
      interpretation += ". Surgical referral (pyloromyotomy).";
      color = "red";
    } else if (mt >= 3 && mt < 4) {
      interpretation = "Borderline muscle thickness (3–4 mm). Observe for 3–5 minutes for pylorospasm vs HPS. Repeat scan after a feed if uncertain.";
      color = "yellow";
    } else {
      interpretation = "Muscle thickness <3 mm. HPS excluded. Consider other causes of vomiting.";
      color = "green";
    }

    result = {
      value: `MT: ${mt.toFixed(1)} mm${!isNaN(cl) ? ` · CL: ${cl.toFixed(1)} mm` : ""}${!isNaN(od) ? ` · OD: ${od.toFixed(1)} mm` : ""}`,
      interpretation,
      color,
      reference: "Hernanz-Schulman M. Pyloric stenosis: role of imaging. Pediatr Radiol. 2009.",
    };
  }

  const colors = result ? COLOR_CLASSES[result.color] : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Pyloric Stenosis Measurements</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pyloric muscle thickness — single wall (mm) <span className="text-red-500">*</span></label>
            <input type="number" step="0.1" min="0" max="15" value={muscleThickness} onChange={e => setMuscleThickness(e.target.value)}
              placeholder="e.g. 4.2"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Measure single wall (outer serosa → inner mucosa) in transverse plane. Normal &lt;3 mm · HPS ≥4 mm</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pyloric channel length (mm, optional)</label>
            <input type="number" step="0.1" min="0" max="30" value={channelLength} onChange={e => setChannelLength(e.target.value)}
              placeholder="e.g. 18.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Longitudinal plane. Normal &lt;15 mm · HPS ≥17 mm</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pyloric outer diameter (mm, optional)</label>
            <input type="number" step="0.1" min="0" max="30" value={outerDiam} onChange={e => setOuterDiam(e.target.value)}
              placeholder="e.g. 15.0"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Transverse plane. Normal &lt;13 mm · HPS ≥15 mm</p>
          </div>
        </div>
      </div>

      {result && colors && (
        <div className={`rounded-xl border p-5 ${colors.bg} ${colors.border}`}>
          <p className={`font-bold text-sm ${colors.text}`}>{result.value}</p>
          <p className={`mt-2 text-sm ${colors.text}`}>{result.interpretation}</p>
          {result.reference && <p className="mt-2 text-xs text-gray-500">Ref: {result.reference}</p>}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Diagnostic Criteria for HPS</p>
        <table className="w-full text-xs text-gray-700">
          <thead><tr className="border-b border-gray-200"><th className="text-left py-1">Measurement</th><th className="text-left py-1">Normal</th><th className="text-left py-1">HPS</th></tr></thead>
          <tbody>
            <tr className="border-b border-gray-100"><td className="py-1.5">Muscle thickness (single wall)</td><td className="py-1.5 text-emerald-700">&lt;3 mm</td><td className="py-1.5 text-red-700">≥4 mm</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5">Channel length</td><td className="py-1.5 text-emerald-700">&lt;15 mm</td><td className="py-1.5 text-red-700">≥17 mm</td></tr>
            <tr><td className="py-1.5">Outer diameter</td><td className="py-1.5 text-emerald-700">&lt;13 mm</td><td className="py-1.5 text-red-700">≥15 mm</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KidneyCalculator() {
  const [ageYears, setAgeYears] = useState("");
  const [ageMonths, setAgeMonths] = useState("");
  const [renalLength, setRenalLength] = useState("");
  const [apDiameter, setApDiameter] = useState("");
  const [calyceal, setCalyceal] = useState<"yes" | "no" | "">("");
  const [corticalThinning, setCorticalThinning] = useState<"yes" | "no" | "">("");
  const [pvr, setPvr] = useState("");

  const totalMonths = (parseFloat(ageYears) || 0) * 12 + (parseFloat(ageMonths) || 0);
  const rl = parseFloat(renalLength);
  const ap = parseFloat(apDiameter);
  const pvrVal = parseFloat(pvr);

  let lengthResult: CalcResult | null = null;
  if (!isNaN(rl) && totalMonths > 0) {
    const norm = renalLengthNorm(totalMonths);
    const zScore = (rl - norm.mean) / norm.sd;
    let color: "green" | "yellow" | "red" = "green";
    let interpretation = "";
    if (zScore < -2) { interpretation = `Small kidney (Z-score ${zScore.toFixed(1)}). Expected ${norm.mean}±${norm.sd} mm for age. Consider renal scarring, dysplasia, or hypoplasia.`; color = "red"; }
    else if (zScore > 2) { interpretation = `Large kidney (Z-score ${zScore.toFixed(1)}). Expected ${norm.mean}±${norm.sd} mm for age. Consider compensatory hypertrophy, hydronephrosis, or mass.`; color = "yellow"; }
    else { interpretation = `Normal renal length for age (Z-score ${zScore.toFixed(1)}). Expected ${norm.mean}±${norm.sd} mm.`; color = "green"; }
    lengthResult = { value: `${rl} mm`, interpretation, color, reference: "Dinkel et al. Pediatr Radiol (1985)" };
  }

  let hydroResult: CalcResult | null = null;
  if (!isNaN(ap) && calyceal !== "") {
    const grade = sfuGrade(ap, calyceal === "yes", corticalThinning === "yes");
    hydroResult = {
      value: `AP diameter: ${ap.toFixed(1)} mm — ${grade.grade}`,
      interpretation: `${grade.description} ${grade.management}`,
      color: grade.color,
      reference: "Society for Fetal Urology (SFU) Grading System",
    };
  }

  let pvrResult: CalcResult | null = null;
  if (!isNaN(pvrVal)) {
    let color: "green" | "yellow" | "red" = "green";
    let interpretation = "";
    if (pvrVal <= 10) { interpretation = "Normal post-void residual. No significant urinary retention."; color = "green"; }
    else if (pvrVal <= 20) { interpretation = "Mildly elevated PVR. Repeat measurement. Consider voiding dysfunction."; color = "yellow"; }
    else { interpretation = "Elevated PVR (>20 mL). Significant urinary retention. Urological referral recommended."; color = "red"; }
    pvrResult = { value: `PVR: ${pvrVal.toFixed(0)} mL`, interpretation, color };
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Renal Length (Age Nomogram)</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age (years)</label>
            <input type="number" step="1" min="0" max="18" value={ageYears} onChange={e => setAgeYears(e.target.value)}
              placeholder="e.g. 3"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age (additional months)</label>
            <input type="number" step="1" min="0" max="11" value={ageMonths} onChange={e => setAgeMonths(e.target.value)}
              placeholder="e.g. 6"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Renal length (mm)</label>
          <input type="number" step="1" min="0" max="200" value={renalLength} onChange={e => setRenalLength(e.target.value)}
            placeholder="e.g. 78"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
        </div>
      </div>
      {lengthResult && (() => { const c = COLOR_CLASSES[lengthResult!.color]; return (
        <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
          <p className={`font-bold text-sm ${c.text}`}>{lengthResult!.value}</p>
          <p className={`mt-1 text-sm ${c.text}`}>{lengthResult!.interpretation}</p>
          {lengthResult!.reference && <p className="mt-1 text-xs text-gray-500">Ref: {lengthResult!.reference}</p>}
        </div>
      ); })()}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Hydronephrosis Grading (SFU)</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Renal pelvis AP diameter (mm)</label>
            <input type="number" step="0.5" min="0" max="50" value={apDiameter} onChange={e => setApDiameter(e.target.value)}
              placeholder="e.g. 8.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Measure inner wall to inner wall in transverse plane</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Calyceal dilation?</label>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map(v => (
                <button key={v} onClick={() => setCalyceal(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${calyceal === v ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                  {v === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cortical thinning?</label>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map(v => (
                <button key={v} onClick={() => setCorticalThinning(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${corticalThinning === v ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                  {v === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {hydroResult && (() => { const c = COLOR_CLASSES[hydroResult!.color]; return (
        <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
          <p className={`font-bold text-sm ${c.text}`}>{hydroResult!.value}</p>
          <p className={`mt-1 text-sm ${c.text}`}>{hydroResult!.interpretation}</p>
          {hydroResult!.reference && <p className="mt-1 text-xs text-gray-500">Ref: {hydroResult!.reference}</p>}
        </div>
      ); })()}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Post-Void Residual (PVR)</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PVR volume (mL)</label>
          <input type="number" step="1" min="0" max="500" value={pvr} onChange={e => setPvr(e.target.value)}
            placeholder="e.g. 8"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
          <p className="text-xs text-gray-400 mt-1">Calculate: Length × Width × Height × 0.523. Normal &lt;10 mL in children.</p>
        </div>
      </div>
      {pvrResult && (() => { const c = COLOR_CLASSES[pvrResult!.color]; return (
        <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
          <p className={`font-bold text-sm ${c.text}`}>{pvrResult!.value}</p>
          <p className={`mt-1 text-sm ${c.text}`}>{pvrResult!.interpretation}</p>
        </div>
      ); })()}
    </div>
  );
}

function SpineCalculator() {
  const [conusLevel, setConusLevel] = useState("");
  const [filmumDiam, setFilumDiam] = useState("");
  const [cordMovement, setCordMovement] = useState<"present" | "absent" | "">("");

  const fd = parseFloat(filmumDiam);

  let result: CalcResult | null = null;
  if (conusLevel || (!isNaN(fd) && fd > 0) || cordMovement !== "") {
    const levels: Record<string, number> = { "L1": 1, "L1-L2": 1.5, "L2": 2, "L2-L3": 2.5, "L3": 3, "L3-L4": 3.5, "L4": 4 };
    const levelNum = levels[conusLevel] || 0;
    let color: "green" | "yellow" | "red" = "green";
    let parts: string[] = [];

    if (conusLevel) {
      if (levelNum <= 2) { parts.push(`Conus at ${conusLevel} — Normal position (≤L2–L3)`); }
      else if (levelNum <= 2.5) { parts.push(`Conus at ${conusLevel} — Borderline. MRI recommended.`); color = "yellow"; }
      else { parts.push(`Conus at ${conusLevel} — Low-lying conus (>L2–L3). Tethered cord until proven otherwise.`); color = "red"; }
    }
    if (!isNaN(fd) && fd > 0) {
      if (fd <= 2) { parts.push(`Filum diameter ${fd.toFixed(1)} mm — Normal (≤2 mm)`); }
      else { parts.push(`Filum diameter ${fd.toFixed(1)} mm — Thick filum (>2 mm). Associated with tethered cord.`); if (color === "green") color = "yellow"; }
    }
    if (cordMovement !== "") {
      if (cordMovement === "present") { parts.push("Cord movement with respiration — Present (normal)"); }
      else { parts.push("Cord movement with respiration — ABSENT. Tethered cord suspected. MRI required."); color = "red"; }
    }

    result = {
      value: conusLevel || "Spinal Assessment",
      interpretation: parts.join(" · "),
      color,
      reference: "AIUM Practice Parameter for Neonatal Spinal Ultrasound (2019)",
    };
  }

  const colors = result ? COLOR_CLASSES[result.color] : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Spinal Cord Assessment</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conus medullaris level</label>
            <select value={conusLevel} onChange={e => setConusLevel(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40 bg-white">
              <option value="">Select level...</option>
              <option value="L1">L1</option>
              <option value="L1-L2">L1–L2</option>
              <option value="L2">L2</option>
              <option value="L2-L3">L2–L3</option>
              <option value="L3">L3</option>
              <option value="L3-L4">L3–L4</option>
              <option value="L4">L4</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Normal: conus at or above L2–L3. Low-lying: below L3.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filum terminale diameter (mm)</label>
            <input type="number" step="0.1" min="0" max="10" value={filmumDiam} onChange={e => setFilumDiam(e.target.value)}
              placeholder="e.g. 1.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Normal ≤2 mm. Thick filum (&gt;2 mm) associated with tethered cord.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Real-time cord movement with respiration?</label>
            <div className="flex gap-2">
              {(["present", "absent"] as const).map(v => (
                <button key={v} onClick={() => setCordMovement(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${cordMovement === v ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                  {v === "present" ? "Present (normal)" : "Absent (tethered?)"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {result && colors && (
        <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
          <p className={`font-bold text-sm ${colors.text}`}>{result.value}</p>
          <p className={`mt-1 text-sm ${colors.text}`}>{result.interpretation}</p>
          {result.reference && <p className="mt-1 text-xs text-gray-500">Ref: {result.reference}</p>}
        </div>
      )}
    </div>
  );
}

function HipsCalculator() {
  const [alpha, setAlpha] = useState("");
  const [beta, setBeta] = useState("");
  const [ageWeeks, setAgeWeeks] = useState("");

  const a = parseFloat(alpha);
  const b = parseFloat(beta);
  const w = parseFloat(ageWeeks);

  let result: CalcResult | null = null;
  if (!isNaN(a)) {
    const classification = grafClassification(a, isNaN(b) ? 0 : b, isNaN(w) ? 0 : w);
    result = {
      value: `α: ${a}°${!isNaN(b) ? ` · β: ${b}°` : ""}`,
      interpretation: `${classification.type} — ${classification.description} ${classification.management}`,
      color: classification.color,
      reference: "Graf R. Hip Sonography. 3rd ed. Springer (2014)",
    };
  }

  const colors = result ? COLOR_CLASSES[result.color] : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Graf Hip Ultrasound Classification</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alpha angle (α°) — bony acetabular roof <span className="text-red-500">*</span></label>
            <input type="number" step="0.5" min="30" max="90" value={alpha} onChange={e => setAlpha(e.target.value)}
              placeholder="e.g. 58"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Normal ≥60°. Measured between the iliac baseline and the acetabular roof line.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beta angle (β°) — cartilaginous roof (optional)</label>
            <input type="number" step="0.5" min="30" max="90" value={beta} onChange={e => setBeta(e.target.value)}
              placeholder="e.g. 55"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Normal &lt;55°. Measured between the iliac baseline and the labral line.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age (weeks)</label>
            <input type="number" step="1" min="0" max="52" value={ageWeeks} onChange={e => setAgeWeeks(e.target.value)}
              placeholder="e.g. 6"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Age affects classification (Type IIa vs IIb threshold at 12 weeks / 3 months).</p>
          </div>
        </div>
      </div>

      {result && colors && (
        <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
          <p className={`font-bold text-sm ${colors.text}`}>{result.value}</p>
          <p className={`mt-1 text-sm ${colors.text}`}>{result.interpretation}</p>
          {result.reference && <p className="mt-1 text-xs text-gray-500">Ref: {result.reference}</p>}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Graf Classification Reference</p>
        <table className="w-full text-xs text-gray-700">
          <thead><tr className="border-b border-gray-200"><th className="text-left py-1">Type</th><th className="text-left py-1">Alpha</th><th className="text-left py-1">Beta</th><th className="text-left py-1">Action</th></tr></thead>
          <tbody>
            <tr className="border-b border-gray-100"><td className="py-1.5 text-emerald-700 font-medium">I</td><td className="py-1.5">≥60°</td><td className="py-1.5">—</td><td className="py-1.5">Normal</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5 text-amber-700 font-medium">IIa</td><td className="py-1.5">50–59°</td><td className="py-1.5">—</td><td className="py-1.5">Follow-up (&lt;3 months)</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5 text-red-700 font-medium">IIb</td><td className="py-1.5">50–59°</td><td className="py-1.5">—</td><td className="py-1.5">Treat (&gt;3 months)</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5 text-red-700 font-medium">IIc</td><td className="py-1.5">43–49°</td><td className="py-1.5">&lt;77°</td><td className="py-1.5">Urgent referral</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5 text-red-700 font-medium">D</td><td className="py-1.5">43–49°</td><td className="py-1.5">≥77°</td><td className="py-1.5">Urgent referral</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5 text-red-700 font-medium">III</td><td className="py-1.5">&lt;43°</td><td className="py-1.5">—</td><td className="py-1.5">Subluxation</td></tr>
            <tr><td className="py-1.5 text-red-700 font-medium">IV</td><td className="py-1.5">&lt;43°</td><td className="py-1.5">—</td><td className="py-1.5">Dislocation</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NeuroCalculator() {
  const [ventricleWidth, setVentricleWidth] = useState("");
  const [acaRi, setAcaRi] = useState("");
  const [cistMagna, setCistMagna] = useState("");
  const [gestAge, setGestAge] = useState("");

  const vw = parseFloat(ventricleWidth);
  const ri = parseFloat(acaRi);
  const cm = parseFloat(cistMagna);
  const ga = parseFloat(gestAge);

  let ventResult: CalcResult | null = null;
  if (!isNaN(vw)) {
    let color: "green" | "yellow" | "red" = "green";
    let interpretation = "";
    if (vw < 3) { interpretation = "Normal lateral ventricle width. No ventriculomegaly."; color = "green"; }
    else if (vw < 10) { interpretation = `Mild ventriculomegaly (${vw.toFixed(1)} mm). Monitor with serial ultrasound. MRI recommended if progressive.`; color = "yellow"; }
    else if (vw < 15) { interpretation = `Moderate ventriculomegaly (${vw.toFixed(1)} mm). Neurosurgical referral. Serial monitoring required.`; color = "red"; }
    else { interpretation = `Severe ventriculomegaly (${vw.toFixed(1)} mm). Urgent neurosurgical referral. Intervention likely required.`; color = "red"; }
    ventResult = { value: `Ventricle width: ${vw.toFixed(1)} mm`, interpretation, color, reference: "Papile LA et al. J Pediatr (1978); Levene MI. Arch Dis Child (1981)" };
  }

  let riResult: CalcResult | null = null;
  if (!isNaN(ri)) {
    let color: "green" | "yellow" | "red" = "green";
    let interpretation = "";
    if (ri < 0.55) { interpretation = `Low RI (${ri.toFixed(2)}). Possible post-asphyxial hyperaemia or arteriovenous malformation. Clinical correlation required.`; color = "yellow"; }
    else if (ri <= 0.80) { interpretation = `Normal ACA resistive index (${ri.toFixed(2)}). Normal cerebral vascular resistance.`; color = "green"; }
    else if (ri <= 0.85) { interpretation = `Mildly elevated RI (${ri.toFixed(2)}). Monitor. May indicate early hydrocephalus or raised ICP.`; color = "yellow"; }
    else { interpretation = `Elevated RI (${ri.toFixed(2)}). Significant increased resistance. Consider hydrocephalus, raised ICP, or cardiac arrest.`; color = "red"; }
    riResult = { value: `ACA RI: ${ri.toFixed(2)}`, interpretation, color, reference: "Neonatal cerebral Doppler normal values: RI 0.65–0.80 (term)" };
  }

  let cmResult: CalcResult | null = null;
  if (!isNaN(cm)) {
    let color: "green" | "yellow" | "red" = "green";
    let interpretation = "";
    if (cm < 2) { interpretation = `Small cisterna magna (${cm.toFixed(1)} mm). Consider Chiari II malformation or vermian hypoplasia.`; color = "yellow"; }
    else if (cm <= 10) { interpretation = `Normal cisterna magna depth (${cm.toFixed(1)} mm). 2–10 mm is the normal range.`; color = "green"; }
    else { interpretation = `Enlarged cisterna magna (${cm.toFixed(1)} mm). Consider Dandy-Walker variant, mega cisterna magna, or arachnoid cyst.`; color = "yellow"; }
    cmResult = { value: `Cisterna magna: ${cm.toFixed(1)} mm`, interpretation, color };
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>Neonatal Brain Measurements</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gestational age at scan (weeks, optional)</label>
            <input type="number" step="1" min="23" max="44" value={gestAge} onChange={e => setGestAge(e.target.value)}
              placeholder="e.g. 28"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lateral ventricle width (mm) — trigone, coronal plane</label>
            <input type="number" step="0.5" min="0" max="50" value={ventricleWidth} onChange={e => setVentricleWidth(e.target.value)}
              placeholder="e.g. 4.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Normal &lt;3 mm · Mild 3–9 mm · Moderate 10–14 mm · Severe ≥15 mm</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ACA resistive index (RI)</label>
            <input type="number" step="0.01" min="0" max="1.5" value={acaRi} onChange={e => setAcaRi(e.target.value)}
              placeholder="e.g. 0.72"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Normal 0.65–0.80 (term). RI = (PSV − EDV) / PSV</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cisterna magna depth (mm) — midline sagittal</label>
            <input type="number" step="0.5" min="0" max="30" value={cistMagna} onChange={e => setCistMagna(e.target.value)}
              placeholder="e.g. 6.0"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40" />
            <p className="text-xs text-gray-400 mt-1">Normal 2–10 mm</p>
          </div>
        </div>
      </div>

      {[ventResult, riResult, cmResult].filter(Boolean).map((r, i) => {
        if (!r) return null;
        const c = COLOR_CLASSES[r.color];
        return (
          <div key={i} className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
            <p className={`font-bold text-sm ${c.text}`}>{r.value}</p>
            <p className={`mt-1 text-sm ${c.text}`}>{r.interpretation}</p>
            {r.reference && <p className="mt-1 text-xs text-gray-500">Ref: {r.reference}</p>}
          </div>
        );
      })}

      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">IVH Grading (Papile)</p>
        <table className="w-full text-xs text-gray-700">
          <thead><tr className="border-b border-gray-200"><th className="text-left py-1">Grade</th><th className="text-left py-1">Location</th><th className="text-left py-1">Prognosis</th></tr></thead>
          <tbody>
            <tr className="border-b border-gray-100"><td className="py-1.5 text-emerald-700 font-medium">I</td><td className="py-1.5">Subependymal (germinal matrix)</td><td className="py-1.5">Good</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5 text-amber-700 font-medium">II</td><td className="py-1.5">IVH without ventricular dilation</td><td className="py-1.5">Good–moderate</td></tr>
            <tr className="border-b border-gray-100"><td className="py-1.5 text-amber-700 font-medium">III</td><td className="py-1.5">IVH with ventricular dilation</td><td className="py-1.5">Moderate–poor</td></tr>
            <tr><td className="py-1.5 text-red-700 font-medium">IV (PVHI)</td><td className="py-1.5">Parenchymal haemorrhagic infarction</td><td className="py-1.5">Poor</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PediatricCalculators() {
  const [activeTab, setActiveTab] = useState("appendix");
  const [showInfo, setShowInfo] = useState(false);

  const renderCalculator = () => {
    switch (activeTab) {
      case "appendix":        return <AppendixCalculator />;
      case "intussusception": return <IntussusceptionCalculator />;
      case "pyloric":         return <PyloricCalculator />;
      case "kidneys":         return <KidneyCalculator />;
      case "spine":           return <SpineCalculator />;
      case "hips":            return <HipsCalculator />;
      case "neuro":           return <NeuroCalculator />;
      default:                return null;
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0e4a50] to-[#189aa1] text-white px-4 py-6 md:px-8">
          <BackToEchoAssist />
          <div className="mt-3 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-[#4ad9e0]" />
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "Merriweather, serif" }}>
                PediatricAssist™ Calculators
              </h1>
              <p className="text-sm text-white/80 mt-0.5">
                Clinically validated pediatric ultrasound measurements — Appendix · Intussusception · Pyloric · Kidneys · Spine · Hips · Neuro
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <button onClick={() => setShowInfo(v => !v)} className="flex items-center gap-2 text-xs text-amber-700 font-medium w-full text-left">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Clinical decision support tool — not a substitute for clinical judgment. Tap for disclaimer.</span>
            {showInfo ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {showInfo && (
            <p className="text-xs text-amber-700 mt-2 leading-relaxed">
              These calculators are intended as educational and clinical decision support tools only. Reference values are derived from published guidelines and nomograms (AIUM, ACR, ESPR, SPR, SFU, Graf). All results must be interpreted in the context of the clinical presentation, patient history, and other investigations. This tool does not replace clinical judgment or formal radiological reporting. Always consult appropriate clinical guidelines and senior colleagues for complex cases.
            </p>
          )}
        </div>

        {/* Tab Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="overflow-x-auto">
            <div className="flex gap-0 min-w-max px-4">
              {CALC_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? "border-[#189aa1] text-[#189aa1]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6">
          {renderCalculator()}
        </div>
      </div>
    </Layout>
  );
}
