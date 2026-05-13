/*
  iHeartEcho™ — Diastolic Function Navigator
  Protocol + Scan Coach for LV Diastolic Function Assessment
  Brand: Teal #189aa1, Aqua #4ad9e0
  Guideline: ASE 2025 LV Diastolic Function Guidelines (Nagueh et al., JASE Vol 38 No 7, July 2025)
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import {
  ChevronDown, ChevronRight, Activity, AlertTriangle,
  CheckCircle, Info, BarChart3, Stethoscope, BookOpen,
  TrendingUp, TrendingDown, Zap, Heart, ArrowRight, Calculator, Lock
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";

// ── Named export for embedding in ScanCoach.tsx ────────────────────────────
export function DiastolicScanCoachContent() {
  return (
    <div>
      <div className="max-w-4xl">

        <SectionCard title="Tissue Doppler Imaging (TDI) — e' Velocity" icon={Activity} defaultOpen>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              e' is the <strong>starting point</strong> for diastolic assessment per ASE 2025. Measure at both the septal and lateral mitral annulus. A reduced e' (Step 1 positive) confirms impaired LV relaxation before applying Step 2 markers.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "View", value: "Apical 4-chamber (A4C)" },
                { label: "Doppler Mode", value: "Pulsed TDI (tissue velocity mode)" },
                { label: "Septal Site", value: "Medial mitral annulus (septal corner)" },
                { label: "Lateral Site", value: "Lateral mitral annulus" },
                { label: "Sample Volume", value: "5–10 mm over annulus" },
                { label: "Filter", value: "Low (to capture annular velocities)" },
                { label: "Scale", value: "20–30 cm/s" },
                { label: "Sweep Speed", value: "50–100 mm/s" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-gray-500 w-32 flex-shrink-0">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xs font-semibold text-blue-800 mb-1">Age-Specific e' Cutoffs — Step 1 Positive Threshold</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { age: "20–39 y", septal: "≤ 7", lateral: "≤ 10", avg: "≤ 9" },
                  { age: "40–65 y", septal: "≤ 6", lateral: "≤ 8", avg: "≤ 7" },
                  { age: "> 65 y", septal: "≤ 8", lateral: "≤ 7", avg: "≤ 6.5" },
                ].map(r => (
                  <div key={r.age} className="bg-white/70 rounded p-2">
                    <div className="font-semibold text-blue-900 mb-1">{r.age}</div>
                    <div className="text-blue-700">Septal: <span className="font-medium text-red-600">{r.septal}</span></div>
                    <div className="text-blue-700">Lateral: <span className="font-medium text-red-600">{r.lateral}</span></div>
                    <div className="text-blue-700">Average: <span className="font-medium text-red-600">{r.avg}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 p-3 rounded-lg bg-teal-50 border border-teal-100">
              <p className="text-sm text-teal-800 leading-relaxed">
                <strong>Tip:</strong> Measure both septal and lateral e' and average them for E/e' calculation. Lateral e' is more variable — if the lateral wall has a motion abnormality, rely on septal e' alone.
              </p>
            </div>
            <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>Pitfall:</strong> Do not confuse the a' (late diastolic annular velocity) with the pre-systolic wave or other waves (L-waves) when present. The a' wave follows atrial contraction and occurs just before the QRS complex on ECG. L-waves are low-velocity mid-diastolic waves seen in some patients and should not be measured as the a' wave.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Mitral Inflow — E/e' Ratio" icon={Stethoscope} defaultOpen>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              After obtaining e', measure mitral inflow to calculate E/e'. Average E/e' &gt; 14 is a Step 2 marker of elevated LA pressure. Also measure E/A ratio and DT to determine diastolic grade.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "View", value: "Apical 4-chamber (A4C)" },
                { label: "Doppler Mode", value: "Pulsed Wave (PW)" },
                { label: "Sample Volume", value: "1–3 mm at mitral leaflet tips" },
                { label: "Sweep Speed", value: "100 mm/s" },
                { label: "Timing", value: "End-expiration, held breath" },
                { label: "Angle Correction", value: "Align beam parallel to mitral inflow (< 20°)" },
                { label: "Measure", value: "E wave, A wave, E/A ratio, DT, IVRT" },
                { label: "E/e' Threshold", value: "Average E/e' > 14 = elevated LAP (Step 2)" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-gray-500 w-36 flex-shrink-0">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-lg bg-teal-50 border border-teal-100">
              <p className="text-sm text-teal-800 leading-relaxed">
                <strong>Tip:</strong> Position the sample volume precisely at the leaflet tips — moving it toward the annulus or into the LV will alter E and A velocities. Use the average of septal and lateral e' from TDI for the E/e' ratio.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="TR Jet — Peak Velocity & PASP" icon={Zap}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "View", value: "Apical 4-chamber or parasternal RV inflow" },
                { label: "Doppler Mode", value: "Continuous Wave (CW)" },
                { label: "Angle", value: "Align parallel to TR jet (use color Doppler to guide)" },
                { label: "Measure", value: "Peak TR velocity (m/s)" },
                { label: "RVSP", value: "4 × TR² + estimated RAP (5, 10, or 15 mmHg)" },
                { label: "Threshold", value: "> 2.8 m/s = abnormal (Step 2 criterion)" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-gray-500 w-32 flex-shrink-0">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-lg bg-teal-50 border border-teal-100">
              <p className="text-sm text-teal-800 leading-relaxed">
                <strong>Tip:</strong> Use multiple windows to find the highest TR velocity. Try subcostal or parasternal RV inflow views if the jet is eccentric. Use agitated saline contrast if TR is not well visualized.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="LA Reservoir Strain (LARS) — Advanced Technique" icon={Heart}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              LARS is a primary criterion in the ASE 2025 algorithm (threshold: &lt; 18%). It is directly correlated with diastolic dysfunction severity and inversely related to LV filling pressures (lower LARS = higher LVFP). Obtain from dedicated apical 4C and 2C views.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Views", value: "Dedicated apical 4C and 2C (LA-focused)" },
                { label: "Frame Rate", value: "50–70 frames/s (higher end preferred)" },
                { label: "Gain", value: "Decrease gain and compression to optimize blood/tissue border" },
                { label: "ECG Gating", value: "R-R gating method for reservoir, conduit, and contractile values" },
                { label: "Cycles", value: "3–5 cardiac cycles per view, similar heart rates" },
                { label: "Software", value: "Dedicated LA strain software; track LA wall in both apical views" },
                { label: "Exclude", value: "Pulmonary veins and LAA from tracking" },
                { label: "Contour", value: "Confirm tracking on underside of annular points; extrapolate fossa ovalis, LAA, PVs to LA roof" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-gray-500 w-32 flex-shrink-0">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xs font-semibold text-blue-800 mb-2">LARS Measurements & Thresholds</p>
              <div className="space-y-1.5 text-xs text-blue-800">
                <div className="flex gap-2"><span className="w-28 flex-shrink-0 font-medium">LARS (S_R):</span><span>Peak positive strain during ventricular systole. <strong>Normal lower limit: ~25–30% (age-dependent)</strong></span></div>
                <div className="flex gap-2"><span className="w-28 flex-shrink-0 font-medium">LASct (S_CT):</span><span>0 minus strain at onset of AC (pre-A wave on ECG). Inversely related to LVEDP.</span></div>
                <div className="flex gap-2"><span className="w-28 flex-shrink-0 font-medium">LAScd (S_CD):</span><span>0 minus strain value at AC (negative value). Conduit strain.</span></div>
                <div className="flex gap-2 mt-1 pt-1 border-t border-blue-200"><span className="w-28 flex-shrink-0 font-semibold text-red-700">Algorithm threshold:</span><span className="text-red-700 font-semibold">LARS &lt; 18% = elevated LVFPs (high specificity)</span></div>
              </div>
            </div>
            <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>Do NOT use LARS to assess LVFP in:</strong> Atrial fibrillation · Significant MR · Heart transplant recipients · Normal EF with GLS &lt; 18% · Suspected LA stunning
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Pulmonary Venous Flow" icon={TrendingUp}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "View", value: "Apical 4-chamber (A4C)" },
                { label: "Vein", value: "Right upper pulmonary vein (most accessible)" },
                { label: "Doppler Mode", value: "Pulsed Wave (PW)" },
                { label: "Sample Volume", value: "2–3 mm, 1–2 cm into vein orifice" },
                { label: "Measure", value: "S wave, D wave, Ar velocity, Ar duration" },
                { label: "Key Threshold", value: "Ar – A duration > 30 ms = elevated LVEDP" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-gray-500 w-32 flex-shrink-0">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-lg bg-teal-50 border border-teal-100">
              <p className="text-sm text-teal-800 leading-relaxed">
                <strong>Tip:</strong> Color Doppler helps locate the pulmonary vein orifice. The Ar wave (atrial reversal) is a small retrograde signal at end-diastole. Ar – A duration &gt; 30 ms is a reliable marker of elevated LVEDP. Pulmonary vein S/D &lt; 1 (D-dominant) suggests elevated LA pressure.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Left Atrial Volume Index (LAVI)" icon={BarChart3}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Method", value: "Biplane area-length or Simpson's biplane" },
                { label: "Views", value: "A4C and A2C at end-systole (before MV opens)" },
                { label: "Timing", value: "Frame just before mitral valve opening (maximum LA size)" },
                { label: "Index", value: "Divide LA volume by BSA (mL/m²)" },
                { label: "Normal", value: "≤ 34 mL/m²" },
                { label: "Mildly enlarged", value: "35–41 mL/m²" },
                { label: "Moderately enlarged", value: "42–48 mL/m²" },
                { label: "Severely enlarged", value: "> 48 mL/m²" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-gray-500 w-36 flex-shrink-0">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>Pitfall:</strong> Foreshortening of the LA in the apical views will underestimate LAVI. Ensure the LA is maximally visualized. Atrial fibrillation, mitral stenosis, and significant MR cause LA enlargement independent of diastolic dysfunction — do not use LAVI as a diastolic marker in these conditions.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Deceleration Time (DT) & IVRT" icon={TrendingDown}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              Deceleration time (DT) is measured from the peak of the E wave to baseline. IVRT is the time from aortic valve closure to mitral valve opening. Both reflect LV relaxation and filling pressures.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "DT Normal", value: "160–240 ms" },
                { label: "DT Short (< 160 ms)", value: "Elevated LAP, restrictive physiology (Grade III)" },
                { label: "DT Prolonged (> 240 ms)", value: "Impaired relaxation (Grade I)" },
                { label: "IVRT Normal", value: "70–90 ms" },
                { label: "IVRT Short (< 60 ms)", value: "Elevated LAP, restrictive filling" },
                { label: "IVRT Prolonged (> 100 ms)", value: "Impaired relaxation" },
                { label: "DT Method", value: "Slope from E peak to baseline on mitral inflow PW trace" },
                { label: "IVRT Method", value: "PW between LVOT and mitral inflow, or TDI-derived" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-gray-500 w-44 flex-shrink-0">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-lg bg-teal-50 border border-teal-100">
              <p className="text-sm text-teal-800 leading-relaxed">
                <strong>Tip:</strong> DT is most reliable at sweep speed 100 mm/s. A short DT with high E/A ratio and elevated E/e' strongly supports Grade III (restrictive) diastolic dysfunction.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Valsalva Maneuver — Unmasking Pseudonormal" icon={TrendingDown}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              Used when E/A is 0.8–2.0 (pseudonormal range) to determine true diastolic grade. A decrease in E/A ≥ 0.5 during Valsalva suggests pseudonormal pattern (Grade II). Standardize by continuously recording mitral inflow using PW Doppler for 10 seconds during the strain phase.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Instruction", value: "Ask patient to bear down (strain) for 10–15 seconds" },
                { label: "Record", value: "Mitral inflow PW Doppler during sustained Valsalva" },
                { label: "Positive result", value: "E/A decreases ≥ 0.5 → pseudonormal (Grade II)" },
                { label: "Negative result", value: "E/A unchanged → may be truly normal or Grade III" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-gray-500 w-32 flex-shrink-0">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ASE 2025 Two-Step Algorithm Quick Reference */}
        <div className="mt-6 rounded-xl p-5" style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-[#4ad9e0]" />
            <span className="text-sm font-semibold text-[#4ad9e0] uppercase tracking-wider">Diastolic Two-Step Algorithm</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs font-bold text-[#4ad9e0] mb-2">STEP 1 — Impaired LV Relaxation</div>
              <div className="space-y-1 text-xs text-white/80">
                <div>Septal e' ≤ 6 cm/s (age-adjusted)</div>
                <div>Lateral e' ≤ 7 cm/s (age-adjusted)</div>
                <div>Average e' ≤ 6.5 cm/s (age-adjusted)</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs font-bold text-[#4ad9e0] mb-2">STEP 2 — Elevated LAP Markers</div>
              <div className="space-y-1 text-xs text-white/80">
                <div>Average E/e' &gt; 14</div>
                <div className="text-yellow-300 font-semibold">LARS &lt; 18% ← NEW 2025</div>
                <div>E/A<sub>oB-A</sub> ≥ 32 (Valsalva)</div>
                <div>LAVi &gt; 34 mL/m²</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { grade: "Normal", criteria: "< 2 Step 2 criteria", color: "#22c55e" },
              { grade: "Grade I", criteria: "Step 1 + ≤1 Step 2", color: "#facc15" },
              { grade: "Grade II", criteria: "Step 1 + ≥2 Step 2, E/A < 2", color: "#f97316" },
              { grade: "Grade III", criteria: "Step 1 + ≥2 Step 2, E/A ≥ 2", color: "#ef4444" },
            ].map(({ grade, criteria, color }) => (
              <div key={grade} className="rounded-lg p-3 bg-white/10">
                <div className="font-bold text-sm mb-1" style={{ color }}>{grade}</div>
                <div className="text-xs text-white/70">{criteria}</div>
              </div>
            ))}
          </div>
          <p className="text-white/40 text-xs mt-3">
            Exclusions: Atrial fibrillation · Non-cardiac PH · LVAD · Pericardial constriction
          </p>
        </div>

      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
            <Icon className="w-4 h-4" style={{ color: BRAND }} />
          </div>
          <span className="font-bold text-gray-800 text-base" style={{ fontFamily: "Merriweather, serif" }}>{title}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function RefTable({ rows, headers }: { rows: string[][]; headers: string[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100 mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: BRAND + "12" }}>
            {headers.map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function DiastolicNavigator() {
  const _params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const _initialTab = (_params.get("tab") === "scancoach" ? "scancoach" : "protocol") as "protocol" | "scancoach";
  const [activeTab, setActiveTab] = useState<"protocol" | "scancoach">(_initialTab);

  return (
    <Layout>
      {/* Page header */}
      <div className="border-b border-[#189aa1]/15 bg-white">
        <div className="container py-4">
          <div className="mb-1">
            <BackToEchoAssist />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#189aa1" + "18" }}>
                <Activity className="w-4 h-4" style={{ color: "#189aa1" }} />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>EchoAssist™ Diastolic Function Navigator</h1>
                <p className="text-gray-500 text-xs">LV Diastolic Assessment · LARS Included · ASE 2025</p>
              </div>
            </div>
            {/* Tab bar */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("protocol")}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={activeTab === "protocol" ? { background: "#189aa1", color: "white" } : { background: "white", color: "#189aa1", border: "1px solid #e2e8f0" }}
              >
                Protocol
              </button>
              <button
                onClick={() => setActiveTab("scancoach")}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={activeTab === "scancoach" ? { background: "#189aa1", color: "white" } : { background: "white", color: "#189aa1", border: "1px solid #e2e8f0" }}
              >
                Scan Coach
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8">

        {/* ── PROTOCOL TAB ── */}
        {activeTab === "protocol" && (
          <div className="max-w-4xl">

            {/* Step-by-step checklist */}
            <SectionCard title="Step-by-Step Assessment Protocol" icon={CheckCircle} defaultOpen>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Follow this systematic sequence for every diastolic function assessment. Obtain all parameters before applying the ASE 2025 two-step grading algorithm.
              </p>
              <ol className="space-y-3">
                {[
                  { step: "1", label: "Assess LV Systolic Function", detail: "Confirm LVEF. Diastolic grading applies to preserved (EF ≥ 50%) and mildly reduced (EF 40–49%) function. Separate algorithm applies for EF < 40%." },
                  { step: "2", label: "Tissue Doppler Imaging (TDI) — e' Velocity", detail: "Pulsed TDI at septal and lateral mitral annulus. e' is the starting point for diastolic assessment (ASE 2025 Step 1). Measure septal and lateral e'. Use age-specific cutoffs (Table 6). Average for E/e' ratio." },
                  { step: "3", label: "Mitral Inflow — E/e' Ratio", detail: "PW Doppler at mitral leaflet tips. Measure E wave, A wave, E/A ratio, and DT. Calculate average E/e' using TDI from Step 2. E/e' > 14 = elevated LAP (Step 2 criterion). Sweep speed 100 mm/s." },
                  { step: "4", label: "TR Velocity & PASP", detail: "CW Doppler across tricuspid valve. Peak TR velocity > 2.8 m/s = elevated RVSP (Step 2 criterion). RVSP = 4(TRV²) + estimated RAP. Use multiple windows to find highest velocity." },
                  { step: "5", label: "Pulmonary Venous Flow", detail: "PW Doppler in right upper pulmonary vein. Measure S, D, Ar velocity, and Ar duration. Ar – A duration > 30 ms = elevated LVEDP. S/D < 1 suggests elevated LA pressure." },
                  { step: "6", label: "LA Reservoir Strain (LARS)", detail: "Dedicated apical 4C and 2C views at 50–70 fps. R-R gating. LARS < 18% = elevated LVFPs (Step 2 criterion). Do not use in AF, significant MR, or heart transplant." },
                  { step: "7", label: "Left Atrial Volume Index (LAVI)", detail: "Biplane Simpson's method. Index to BSA. LAVI > 34 mL/m² = LA enlargement (Step 2 criterion). Exclude PVs and LAA from tracing." },
                  { step: "8", label: "IVRT (Isovolumic Relaxation Time)", detail: "PW Doppler between LVOT and mitral inflow, or tissue Doppler method. Normal IVRT: 70–90 ms. Shortened IVRT (< 60 ms) suggests elevated LAP. Prolonged IVRT (> 100 ms) suggests impaired relaxation." },
                  { step: "9", label: "Apply ASE 2025 Two-Step Algorithm", detail: "Step 1: Is e' reduced (impaired relaxation)? Step 2: Count elevated LAP markers (E/e' > 14, TR > 2.8 m/s, LARS < 18%, LAVi > 34). See Grading Algorithm section." },
                ].map(({ step, label, detail }) => (
                  <li key={step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5" style={{ background: BRAND }}>
                      {step}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">{label}</div>
                      <div className="text-sm text-gray-500 mt-0.5 leading-relaxed">{detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </SectionCard>

            {/* ASE 2025 Two-Step Grading Algorithm */}
            <SectionCard title="Two-Step Diastolic Grading Algorithm" icon={BarChart3} defaultOpen>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                The ASE 2025 algorithm uses a two-step approach. Step 1 assesses LV relaxation via e' velocity. Step 2 counts markers of elevated LA pressure. Diastolic dysfunction is present when Step 1 is positive and ≥1 Step 2 marker is present, or when Step 1 is negative but ≥2 Step 2 markers are present.
              </p>

              <div className="p-3 rounded-lg bg-red-50 border border-red-100 mb-4 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 leading-relaxed">
                  <strong>Exclusions:</strong> Do not apply this algorithm to patients with atrial fibrillation, non-cardiac pulmonary hypertension, LVAD, or pericardial constriction.
                </p>
              </div>

              {/* Step 1 */}
              <div className="mb-4">
                <div className="text-sm font-bold text-gray-800 mb-2" style={{ color: BRAND }}>Step 1 — Impaired LV Relaxation (e' Velocity)</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { age: "Age 20–39", septal: "≤ 7 cm/s", lateral: "≤ 10 cm/s", avg: "≤ 9 cm/s" },
                    { age: "Age 40–65", septal: "≤ 6 cm/s", lateral: "≤ 8 cm/s", avg: "≤ 7 cm/s" },
                    { age: "Age > 65", septal: "≤ 8 cm/s", lateral: "≤ 7 cm/s", avg: "≤ 6.5 cm/s" },
                  ].map(r => (
                    <div key={r.age} className="rounded-lg border border-gray-100 p-3 bg-gray-50/50">
                      <div className="font-semibold text-gray-800 text-xs mb-1">{r.age}</div>
                      <div className="text-xs text-gray-600">Septal: <span className="font-medium text-red-600">{r.septal}</span></div>
                      <div className="text-xs text-gray-600">Lateral: <span className="font-medium text-red-600">{r.lateral}</span></div>
                      <div className="text-xs text-gray-600">Average: <span className="font-medium text-red-600">{r.avg}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 2 */}
              <div className="mb-4">
                <div className="text-sm font-bold text-gray-800 mb-2" style={{ color: BRAND }}>Step 2 — Markers of Elevated LA Pressure</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Average E/e'", threshold: "> 14", note: "Surrogate for LV filling pressure" },
                    { label: "LARS (LA Reservoir Strain)", threshold: "< 18%", note: "NEW in ASE 2025 — high specificity for elevated LVFPs", highlight: true },
                    { label: "Valsalva E/A (E/AoB-A)", threshold: "≥ 32", note: "Decrease in E/A ≥ 50% with Valsalva" },
                    { label: "LAVi", threshold: "> 34 mL/m²", note: "Marker of chronic LA pressure load" },
                  ].map(({ label, threshold, note, highlight }) => (
                    <div key={label} className={`rounded-lg border p-3 ${highlight ? "border-yellow-200 bg-yellow-50/50" : "border-gray-100 bg-gray-50/50"}`}>
                      <div className={`font-semibold text-sm mb-1 ${highlight ? "text-yellow-800" : "text-gray-800"}`}>{label}</div>
                      <div className="text-xs mb-0.5">
                        <span className="text-gray-500">Abnormal: </span>
                        <span className="font-bold text-red-600">{threshold}</span>
                      </div>
                      <div className="text-xs text-gray-400 italic">{note}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grade table */}
              <RefTable
                headers={["Grade", "Step 1", "Step 2 Criteria Met", "E/A Pattern", "LAP"]}
                rows={[
                  ["Normal", "Normal e'", "< 2 of 4 abnormal", "E/A 0.8–2.0, DT 160–240 ms", "Normal"],
                  ["Grade I", "Reduced e'", "≤ 1 of 4 abnormal", "E/A ≤ 0.8, DT > 200 ms", "Normal"],
                  ["Grade II", "Reduced e'", "≥ 2 of 4 abnormal", "E/A 0.8–2.0, DT 160–200 ms", "Elevated"],
                  ["Grade III", "Reduced e'", "≥ 2 of 4 abnormal", "E/A > 2.0, DT < 160 ms", "Markedly elevated"],
                  ["Indeterminate", "Variable", "Exactly 2 of 4, mixed pattern", "Variable", "Cannot classify"],
                ]}
              />

              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>EF &lt; 40%:</strong> When LVEF is reduced, diastolic dysfunction is assumed to be present. The grading algorithm is used to estimate filling pressure severity rather than confirm dysfunction.
                </p>
              </div>
            </SectionCard>

            {/* LA Reservoir Strain */}
            <SectionCard title="LA Reservoir Strain (LARS) — Primary Criterion" icon={Heart}>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                LARS is now a primary criterion in the ASE 2025 grading algorithm (threshold: &lt; 18%). LARS worsens as diastolic dysfunction progresses and is inversely related to LVFP — the lower the LARS, the higher the filling pressure. It is obtained by STE imaging and is available on most ultrasound systems.
              </p>
              <RefTable
                headers={["Measurement", "Definition", "Clinical Significance"]}
                rows={[
                  ["LARS (S_R)", "Peak positive strain during ventricular systole", "Primary marker of LA reservoir function; < 18% = elevated LVFPs (high specificity)"],
                  ["LASct (S_CT)", "0 minus strain at onset of atrial contraction (pre-A wave)", "Inversely related to LVEDP; less negative = higher LVEDP"],
                  ["LAScd (S_CD)", "0 minus strain value at atrial contraction (AC)", "Conduit strain; reflects passive LA emptying"],
                ]}
              />
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs font-semibold text-blue-800 mb-2">Normal LARS by Age (Table 5, 5th–95th percentile)</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { age: "20–39 y", range: "29.5% – 63.2%" },
                    { age: "40–60 y", range: "26.8% – 57.7%" },
                    { age: "60–80 y", range: "24.1% – 52.3%" },
                  ].map(r => (
                    <div key={r.age} className="bg-white/70 rounded p-2">
                      <div className="font-semibold text-blue-900">{r.age}</div>
                      <div className="text-blue-700">{r.range}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-sm text-amber-800 leading-relaxed">
                  <strong>Do NOT use LARS to assess LVFP in:</strong> Atrial fibrillation · Significant MR · Heart transplant recipients · Normal EF with GLS &lt; 18% · Suspected LA stunning. LARS has low sensitivity in patients with normal LVEF for detecting elevated LAP at the 18% threshold.
                </p>
              </div>
            </SectionCard>

            {/* Normal Reference Values */}
            <SectionCard title="Normal Reference Values" icon={Info}>
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                Values are 5th–95th percentile limits from regression equations in persons free of cardiovascular disease or risk factors.
              </p>
              <RefTable
                headers={["Parameter", "Age 20–39", "Age 40–60", "Age 60–80", "Units"]}
                rows={[
                  ["E wave", "0.54–1.11", "0.47–1.02", "0.39–0.92", "m/s"],
                  ["A wave", "0.24–0.68", "0.33–0.82", "0.43–0.97", "m/s"],
                  ["E/A ratio", "0.88–2.73", "0.69–2.07", "0.50–1.40", ""],
                  ["e' lateral", "9.9–22.1", "7.5–17.5", "5.2–13.0", "cm/s"],
                  ["e' septal", "7.2–16.4", "5.7–13.5", "4.1–11.0", "cm/s"],
                  ["e' average", "8.7–19.1", "6.7–15.4", "4.7–11.7", "cm/s"],
                  ["E/e' average", "4.0–9.1", "4.8–11.5", "5.2–14.0", ""],
                  ["LAVi (Simpson)", "12.5–41.9", "13.3–41.0", "14.2–40.0", "mL/m²"],
                  ["TR velocity", "1.3–2.7", "1.3–2.7", "1.7–2.8", "m/s"],
                  ["LARS", "29.5–63.2%", "26.8–57.7%", "24.1–52.3%", "%"],
                ]}
              />
              <div className="mt-3 p-3 rounded-lg bg-teal-50 border border-teal-100">
                <p className="text-xs text-teal-800">
                  <strong>Key thresholds for diastolic grading:</strong> e' septal &lt; 6 (age 40–65) · e' lateral &lt; 8 (age 40–65) · Average E/e' &gt; 14 · LARS &lt; 18% · TR velocity &gt; 2.8 m/s · LAVi &gt; 34 mL/m²
                </p>
              </div>
            </SectionCard>

            {/* Pitfalls */}
            <SectionCard title="Common Pitfalls & Clinical Pearls" icon={AlertTriangle}>
              <div className="space-y-3">
                {[
                  { type: "pitfall", text: "Mitral inflow is load-dependent — hypovolemia can normalize a pseudonormal pattern. Always correlate with clinical context." },
                  { type: "pitfall", text: "Atrial fibrillation eliminates the A wave. Do not apply standard E/A grading in AF — use E/e' and LAVI as primary markers." },
                  { type: "pitfall", text: "LARS should NOT be used to assess LVFP in AF, significant MR, heart transplant recipients, normal EF with GLS < 18%, or suspected LA stunning." },
                  { type: "pitfall", text: "Mitral stenosis and mitral regurgitation significantly alter inflow patterns. Interpret diastolic parameters with caution in significant mitral valve disease." },
                  { type: "pitfall", text: "Lateral e' may be unreliable in patients with lateral wall motion abnormalities or lateral annular calcification. Use septal e' preferentially in these cases." },
                  { type: "pearl", text: "LARS < 18% has high specificity but low sensitivity for elevated LAP in patients with normal LVEF. Relying on LARS cutoff values of 19–24% increases sensitivity but reduces specificity." },
                  { type: "pearl", text: "Valsalva maneuver can unmask elevated filling pressures: a decrease in E/A ratio ≥ 0.5 during Valsalva suggests pseudonormal pattern (Grade II)." },
                  { type: "pearl", text: "In young healthy adults, E/A > 2.0 with short DT may represent physiologic supernormal filling, not Grade III dysfunction — clinical context is essential." },
                  { type: "pearl", text: "LAVI is the most robust single structural marker of chronically elevated filling pressures. Prioritize it when other parameters are discordant." },
                ].map((item, i) => (
                  <div key={i} className={`flex gap-2 p-3 rounded-lg ${item.type === "pitfall" ? "bg-red-50 border border-red-100" : "bg-teal-50 border border-teal-100"}`}>
                    {item.type === "pitfall"
                      ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />}
                    <p className={`text-sm leading-relaxed ${item.type === "pitfall" ? "text-red-800" : "text-teal-800"}`}>{item.text}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Special Populations */}
            <SectionCard title="Special Populations" icon={BookOpen}>
              <div className="space-y-4">
                {[
                  {
                    title: "Aging",
                    content: "Diastolic function declines with age. E/A ratio normally decreases and DT increases. Age-specific e' cutoffs from Table 6 should be applied. LARS also decreases with age — use age-appropriate normal ranges. Isolated Grade I dysfunction in patients > 65 years without symptoms or structural disease may represent normal aging."
                  },
                  {
                    title: "Atrial Fibrillation",
                    content: "A wave is absent. Do not apply standard E/A grading. Use E/e' > 11 (average), LAVI > 34 mL/m², and TR velocity > 2.8 m/s as primary markers. Average multiple beats (≥ 5) for E wave measurement. LARS should NOT be used to assess LVFP in AF."
                  },
                  {
                    title: "Hypertrophic Cardiomyopathy (HCM)",
                    content: "Diastolic dysfunction is nearly universal in HCM. Impaired relaxation (Grade I) is most common. Restrictive filling (Grade III) is a poor prognostic marker. E/e' and LAVI are most reliable parameters. LARS is particularly useful in HCM for detecting subclinical diastolic dysfunction."
                  },
                  {
                    title: "Constrictive Pericarditis vs. Restrictive Cardiomyopathy",
                    content: "Both present with elevated filling pressures. Key differentiator: in constriction, septal e' is paradoxically preserved or elevated (annulus paradoxus) and medial e' > lateral e' (annulus reversus). Respiratory variation in mitral and tricuspid inflow is prominent in constriction."
                  },
                  {
                    title: "Reduced LVEF (EF < 40%)",
                    content: "Diastolic dysfunction is assumed present. Use E/e', LAVI, and TR velocity to estimate filling pressure severity. Grade I (E/A ≤ 0.8) = low filling pressures; Grade II (E/A 0.8–2.0) = indeterminate; Grade III (E/A > 2.0) = elevated filling pressures. LARS accuracy for LAP estimation is highest in patients with depressed LVEF."
                  },
                  {
                    title: "HFpEF",
                    content: "Diastolic dysfunction with preserved EF. LARS provides prognostic value and helps distinguish between degrees of diastolic dysfunction. The LARS/E/e' ratio (LA stiffness index) has the highest accuracy for identifying HFpEF patients and those most likely to be hospitalized for HF management."
                  },
                ].map(({ title, content }) => (
                  <div key={title}>
                    <div className="font-semibold text-sm mb-1" style={{ color: BRAND }}>{title}</div>
                    <p className="text-sm text-gray-600 leading-relaxed">{content}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Calculator deep-links */}
            <div className="flex items-center justify-between bg-[#f0fbfc] border border-[#b2e8ec] rounded-xl px-5 py-3 mt-2">
              <div className="flex items-center gap-3">
                <Calculator className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
                <p className="text-xs text-[#0e7490]">
                  <strong>Echo Severity Calculators</strong> — run guideline-based grading and LAP estimation directly.
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <Link href="/echoassist#engine-diastolic"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "#189aa1" }}>
                  <Calculator className="w-3 h-3" />
                  Diastology
                </Link>
                <Link href="/echoassist#engine-lap"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:bg-[#189aa1]/5"
                  style={{ borderColor: "#189aa1", color: "#189aa1" }}>
                  <Lock className="w-3 h-3 text-amber-500" />
                  LAP Estimation
                </Link>
              </div>
            </div>

          </div>
        )}

        {/* ── SCAN COACH TAB ── */}
        {activeTab === "scancoach" && (
          <div className="max-w-4xl">
            <DiastolicScanCoachContent />
          </div>
        )}
      </div>
    </Layout>
  );
}
