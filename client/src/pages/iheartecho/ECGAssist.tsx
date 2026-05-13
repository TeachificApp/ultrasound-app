/*
  ECGAssist™ — ECG Calculators
  Premium-gated. 12 calculators with guideline-based feedback.
  Brand: iHeartEcho Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useCallback } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { PremiumGate } from "@/components/PremiumGate";
import { CopyToReportButton } from "@/components/CopyToReportButton";
import { Button } from "@/components/ui/button";
import {
  Activity, BookOpen, Zap, FileText, AlertTriangle,
  CheckCircle2, Info, ChevronDown, ChevronUp, Download
} from "lucide-react";
import jsPDF from "jspdf";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalcResult {
  value: string;
  interpretation: string;
  severity?: "normal" | "mild" | "moderate" | "severe" | "critical" | "info";
  notes?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function numInput(
  label: string,
  value: string,
  onChange: (v: string) => void,
  unit?: string,
  placeholder?: string
) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}{unit ? <span className="font-normal text-gray-400 ml-1">({unit})</span> : null}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? ""}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
        style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
      />
    </div>
  );
}

function ResultBox({ result, source }: { result: CalcResult; source: string }) {
  const colorMap: Record<string, string> = {
    normal: "bg-green-50 border-green-200 text-green-800",
    mild: "bg-yellow-50 border-yellow-200 text-yellow-800",
    moderate: "bg-orange-50 border-orange-200 text-orange-800",
    severe: "bg-red-50 border-red-200 text-red-800",
    critical: "bg-red-100 border-red-300 text-red-900",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };
  const cls = colorMap[result.severity ?? "info"];
  return (
    <div className={`rounded-lg border px-4 py-3 mt-3 ${cls}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-bold text-sm">{result.value}</p>
          <p className="text-xs mt-0.5 leading-relaxed">{result.interpretation}</p>
          {result.notes && result.notes.map((n, i) => (
            <p key={i} className="text-xs mt-1 opacity-80 leading-relaxed">• {n}</p>
          ))}
        </div>
        <CopyToReportButton
          source="ECGAssist"
          calculator={source}
          label={result.value}
          result={result.value}
          interpretation={result.interpretation}
        />
      </div>
    </div>
  );
}

function CalcCard({ id, title, badge, badgeColor, children }: {
  id: string; title: string; badge?: string; badgeColor?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div id={id} className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: (badgeColor ?? BRAND) + "20" }}>
            <Activity className="w-4 h-4" style={{ color: badgeColor ?? BRAND }} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>{title}</h3>
            {badge && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: (badgeColor ?? BRAND) + "15", color: badgeColor ?? BRAND }}>{badge}</span>}
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 py-4 bg-white space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Calculator 1: QTc ────────────────────────────────────────────────────────
function QTcCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [qt, setQt] = useState("");
  const [rr, setRr] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calc = () => {
    const qtMs = parseFloat(qt);
    const rrMs = parseFloat(rr);
    if (isNaN(qtMs) || isNaN(rrMs) || rrMs <= 0) return;
    const rrSec = rrMs / 1000;
    const bazett = qtMs / Math.sqrt(rrSec);
    const fridericia = qtMs / Math.cbrt(rrSec);
    const framingham = qtMs + 154 * (1 - rrSec);
    const hodges = qtMs + 1.75 * ((60000 / rrMs) - 60);

    let sev: CalcResult["severity"] = "normal";
    let interp = "";
    // Use Bazett as primary
    if (bazett > 500) { sev = "critical"; interp = "Markedly prolonged QTc (Bazett >500 ms) — high risk of Torsades de Pointes. Immediate review of QT-prolonging drugs, electrolytes (K⁺, Mg²⁺, Ca²⁺). Consider cardiology consult."; }
    else if (bazett > 460) { sev = "severe"; interp = "Prolonged QTc (Bazett >460 ms). Assess for QT-prolonging medications, electrolyte abnormalities (hypokalemia, hypomagnesemia), congenital LQTS, hypothyroidism, and intracranial pathology."; }
    else if (bazett > 440) { sev = "moderate"; interp = "Borderline prolonged QTc (Bazett 440–460 ms). Monitor for drug interactions and electrolyte changes. Repeat ECG if clinical concern."; }
    else { sev = "normal"; interp = "Normal QTc (Bazett ≤440 ms). No evidence of QT prolongation."; }

    const r: CalcResult = {
      value: `Bazett: ${bazett.toFixed(0)} ms | Fridericia: ${fridericia.toFixed(0)} ms | Framingham: ${framingham.toFixed(0)} ms | Hodges: ${hodges.toFixed(0)} ms`,
      interpretation: interp,
      severity: sev,
      notes: [
        "Bazett formula (QT/√RR): most widely used but over-corrects at extremes of HR",
        "Fridericia formula (QT/∛RR): preferred at HR <60 or >100 bpm",
        "Normal QTc: ≤440 ms (men), ≤460 ms (women) — AHA/ACC 2013",
        "Prolonged QTc ≥500 ms: high risk of Torsades de Pointes",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {numInput("QT Interval", qt, setQt, "ms", "e.g. 420")}
        {numInput("RR Interval", rr, setRr, "ms", "e.g. 800")}
      </div>
      <div className="bg-blue-50 rounded-lg px-3 py-2">
        <p className="text-xs text-blue-700"><strong>Tip:</strong> RR interval = 60,000 / Heart Rate (bpm). Measure QT from start of QRS to end of T wave in lead II or V5.</p>
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Calculate QTc</Button>
      {result && <ResultBox result={result} source="QTc Calculator" />}
    </div>
  );
}

// ─── Calculator 2: Heart Rate from RR ────────────────────────────────────────
function HRCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [rr, setRr] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calc = () => {
    const rrMs = parseFloat(rr);
    if (isNaN(rrMs) || rrMs <= 0) return;
    const hr = Math.round(60000 / rrMs);
    let sev: CalcResult["severity"] = "normal";
    let interp = "";
    if (hr < 40) { sev = "critical"; interp = `HR ${hr} bpm — Severe bradycardia (<40 bpm). Assess for complete heart block, sick sinus syndrome, drug toxicity. Urgent evaluation required.`; }
    else if (hr < 60) { sev = "mild"; interp = `HR ${hr} bpm — Bradycardia (40–59 bpm). Common in athletes, vagal tone, beta-blocker use, hypothyroidism, or inferior MI with AV block.`; }
    else if (hr <= 100) { sev = "normal"; interp = `HR ${hr} bpm — Normal sinus rate (60–100 bpm).`; }
    else if (hr <= 150) { sev = "moderate"; interp = `HR ${hr} bpm — Tachycardia (101–150 bpm). Assess for sinus tachycardia (pain, fever, hypovolemia, PE, anxiety) vs SVT.`; }
    else { sev = "severe"; interp = `HR ${hr} bpm — Rapid tachycardia (>150 bpm). Consider SVT, atrial flutter (2:1 block), AF with rapid ventricular response, or VT.`; }

    const r: CalcResult = {
      value: `Heart Rate: ${hr} bpm`,
      interpretation: interp,
      severity: sev,
      notes: ["Formula: HR = 60,000 / RR interval (ms)", "For irregular rhythms: average 3–5 consecutive RR intervals"],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      {numInput("RR Interval", rr, setRr, "ms", "e.g. 800")}
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Calculate Heart Rate</Button>
      {result && <ResultBox result={result} source="Heart Rate Calculator" />}
    </div>
  );
}

// ─── Calculator 3: Electrical Axis ───────────────────────────────────────────
function AxisCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [leadI, setLeadI] = useState("");
  const [aVF, setAVF] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calc = () => {
    const i = parseFloat(leadI);
    const f = parseFloat(aVF);
    if (isNaN(i) || isNaN(f)) return;

    let axis = "";
    let sev: CalcResult["severity"] = "normal";
    let interp = "";

    if (i > 0 && f > 0) { axis = "Normal axis (0° to +90°)"; sev = "normal"; interp = "Normal electrical axis. Lead I positive, aVF positive."; }
    else if (i > 0 && f < 0) { axis = "Left axis deviation (0° to −90°)"; sev = "mild"; interp = "Left axis deviation (LAD). Causes: LAFB, LVH, inferior MI, LBBB, WPW (right-sided pathway), primum ASD, hyperkalemia."; }
    else if (i < 0 && f > 0) { axis = "Right axis deviation (+90° to +180°)"; sev = "mild"; interp = "Right axis deviation (RAD). Causes: RVH, LPFB, lateral MI, RBBB, WPW (left-sided pathway), dextrocardia, normal variant in children."; }
    else if (i < 0 && f < 0) { axis = "Extreme axis deviation (−90° to ±180°)"; sev = "severe"; interp = "Extreme (northwest) axis deviation. Causes: ventricular tachycardia, hyperkalemia, lead reversal, artificial pacing. Requires urgent evaluation."; }
    else { axis = "Indeterminate"; sev = "info"; interp = "Indeterminate axis — one or both leads near isoelectric. Measure in multiple leads for accuracy."; }

    const r: CalcResult = {
      value: axis,
      interpretation: interp,
      severity: sev,
      notes: [
        "Lead I positive + aVF positive = Normal axis (0° to +90°)",
        "Lead I positive + aVF negative = LAD (0° to −90°)",
        "Lead I negative + aVF positive = RAD (+90° to +180°)",
        "Lead I negative + aVF negative = Extreme axis (−90° to ±180°)",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {numInput("Lead I net deflection", leadI, setLeadI, "mm", "positive or negative")}
        {numInput("aVF net deflection", aVF, setAVF, "mm", "positive or negative")}
      </div>
      <div className="bg-blue-50 rounded-lg px-3 py-2">
        <p className="text-xs text-blue-700"><strong>Method:</strong> Measure the net QRS deflection (R wave height minus S wave depth in mm) in Lead I and aVF. Enter positive values for upright deflections, negative for inverted.</p>
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Calculate Axis</Button>
      {result && <ResultBox result={result} source="Electrical Axis Calculator" />}
    </div>
  );
}

// ─── Calculator 4: LVH Voltage ────────────────────────────────────────────────
function LVHCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [sv1, setSv1] = useState("");
  const [rv5, setRv5] = useState("");
  const [rv6, setRv6] = useState("");
  const [sv3, setSv3] = useState("");
  const [ravl, setRavl] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calc = () => {
    const s1 = parseFloat(sv1) || 0;
    const r5 = parseFloat(rv5) || 0;
    const r6 = parseFloat(rv6) || 0;
    const s3 = parseFloat(sv3) || 0;
    const rl = parseFloat(ravl) || 0;

    const sokolow = s1 + Math.max(r5, r6);
    const cornell = s3 + rl;
    const findings: string[] = [];

    if (sokolow >= 35) findings.push(`Sokolow-Lyon: ${sokolow.toFixed(1)} mm ≥35 mm → LVH`);
    else findings.push(`Sokolow-Lyon: ${sokolow.toFixed(1)} mm (normal <35 mm)`);

    if (cornell >= 28) findings.push(`Cornell: ${cornell.toFixed(1)} mm ≥28 mm (men) → LVH`);
    else findings.push(`Cornell: ${cornell.toFixed(1)} mm (normal <28 mm men, <20 mm women)`);

    const lvh = sokolow >= 35 || cornell >= 28;
    const r: CalcResult = {
      value: lvh ? "LVH Criteria Met" : "No LVH by Voltage Criteria",
      interpretation: lvh
        ? `${findings.join("; ")}. ECG voltage criteria for LVH have low sensitivity (~50%) but high specificity (~90%). Confirm with echocardiography. LVH on ECG associated with increased cardiovascular risk.`
        : `${findings.join("; ")}. Voltage criteria not met. Note: ECG has low sensitivity for LVH — echocardiography is the gold standard.`,
      severity: lvh ? "moderate" : "normal",
      notes: [
        "Sokolow-Lyon: SV1 + RV5 or RV6 ≥35 mm",
        "Cornell: SV3 + RaVL ≥28 mm (men), ≥20 mm (women)",
        "ECG LVH sensitivity: ~50%; specificity: ~90%",
        "Romhilt-Estes point score (not calculated here) adds ST-T changes, LAE, axis deviation",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {numInput("S wave in V1", sv1, setSv1, "mm")}
        {numInput("R wave in V5", rv5, setRv5, "mm")}
        {numInput("R wave in V6", rv6, setRv6, "mm")}
        {numInput("S wave in V3", sv3, setSv3, "mm")}
        {numInput("R wave in aVL", ravl, setRavl, "mm")}
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Calculate LVH</Button>
      {result && <ResultBox result={result} source="LVH Voltage Criteria" />}
    </div>
  );
}

// ─── Calculator 5: RVH Criteria ───────────────────────────────────────────────
function RVHCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [rv1, setRv1] = useState("");
  const [sv1, setSv1] = useState("");
  const [sv5, setSv5] = useState("");
  const [axis, setAxis] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calc = () => {
    const r1 = parseFloat(rv1) || 0;
    const s1 = parseFloat(sv1) || 0;
    const s5 = parseFloat(sv5) || 0;
    const ax = parseFloat(axis) || 0;

    const criteria: string[] = [];
    let score = 0;

    const rsRatio = s1 > 0 ? r1 / s1 : r1;
    if (rsRatio > 1) { criteria.push(`R/S ratio in V1 >1 (${rsRatio.toFixed(2)})`); score++; }
    if (r1 >= 7) { criteria.push(`R in V1 ≥7 mm (${r1} mm)`); score++; }
    if (s5 >= 7) { criteria.push(`S in V5 ≥7 mm (${s5} mm)`); score++; }
    if (ax > 100) { criteria.push(`Right axis deviation (${ax}°)`); score++; }

    const rvh = score >= 2;
    const r: CalcResult = {
      value: rvh ? `RVH Likely (${score}/4 criteria met)` : `RVH Unlikely (${score}/4 criteria)`,
      interpretation: rvh
        ? `${criteria.join("; ")}. Findings consistent with RVH. Causes: pulmonary hypertension, pulmonary stenosis, cor pulmonale, COPD, ASD, Eisenmenger syndrome. Confirm with echocardiography.`
        : `${criteria.length > 0 ? criteria.join("; ") + ". " : ""}Insufficient criteria for RVH. Note: ECG has low sensitivity for RVH (~50%).`,
      severity: rvh ? "moderate" : "normal",
      notes: [
        "R/S ratio >1 in V1 (dominant R wave)",
        "R wave ≥7 mm in V1",
        "S wave ≥7 mm in V5 or V6",
        "Right axis deviation >+100°",
        "Supporting: P pulmonale (peaked P >2.5 mm in II), ST depression/T inversion V1–V3",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {numInput("R wave in V1", rv1, setRv1, "mm")}
        {numInput("S wave in V1", sv1, setSv1, "mm")}
        {numInput("S wave in V5", sv5, setSv5, "mm")}
        {numInput("QRS axis", axis, setAxis, "degrees")}
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Calculate RVH</Button>
      {result && <ResultBox result={result} source="RVH Criteria" />}
    </div>
  );
}

// ─── Calculator 6: Sgarbossa Criteria ────────────────────────────────────────
function SgarbossaCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [concordantST, setConcordantST] = useState("");
  const [discordantST, setDiscordantST] = useState("");
  const [concordantSTDep, setConcordantSTDep] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calc = () => {
    const c = parseFloat(concordantST) || 0;
    const d = parseFloat(discordantST) || 0;
    const dep = parseFloat(concordantSTDep) || 0;

    let score = 0;
    const criteria: string[] = [];

    if (c >= 1) { score += 5; criteria.push(`Concordant ST elevation ≥1 mm (5 pts): ${c} mm`); }
    if (dep >= 1) { score += 3; criteria.push(`Concordant ST depression ≥1 mm in V1–V3 (3 pts): ${dep} mm`); }
    if (d >= 5) { score += 2; criteria.push(`Discordant ST elevation ≥5 mm (2 pts): ${d} mm`); }

    // Modified Smith criteria
    const smithPos = d > 0 && (d / 25 > 0.25); // simplified — ST/S ratio >0.25

    let sev: CalcResult["severity"] = "normal";
    let interp = "";
    if (score >= 3) {
      sev = "severe";
      interp = `Sgarbossa score ${score}/10 — Highly specific for STEMI in LBBB (score ≥3: specificity ~90%). ${criteria.join("; ")}. Activate cath lab — do not delay for LBBB.`;
    } else if (score > 0) {
      sev = "moderate";
      interp = `Sgarbossa score ${score}/10 — Indeterminate. ${criteria.join("; ")}. Consider modified Smith-Sgarbossa criteria (ST/S ratio >0.25 in any lead). Clinical correlation required.`;
    } else {
      sev = "info";
      interp = "No Sgarbossa criteria met. Cannot exclude STEMI in LBBB based on ECG alone — clinical presentation and troponin are essential.";
    }

    const r: CalcResult = {
      value: `Sgarbossa Score: ${score}/10`,
      interpretation: interp,
      severity: sev,
      notes: [
        "Criterion 1 (5 pts): Concordant ST elevation ≥1 mm in any lead (most specific)",
        "Criterion 2 (3 pts): Concordant ST depression ≥1 mm in V1, V2, or V3",
        "Criterion 3 (2 pts): Discordant ST elevation ≥5 mm (less specific)",
        "Score ≥3: sensitivity 36%, specificity 90% for STEMI in LBBB",
        "Modified Smith-Sgarbossa: ST/S ratio >0.25 in any lead (improves sensitivity)",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3">
        {numInput("Max concordant ST elevation (any lead)", concordantST, setConcordantST, "mm")}
        {numInput("Max discordant ST elevation (any lead)", discordantST, setDiscordantST, "mm")}
        {numInput("Max concordant ST depression (V1–V3)", concordantSTDep, setConcordantSTDep, "mm")}
      </div>
      <div className="bg-amber-50 rounded-lg px-3 py-2">
        <p className="text-xs text-amber-800"><strong>Note:</strong> Concordant = ST deviation in same direction as QRS. Discordant = ST deviation opposite to QRS (expected in LBBB).</p>
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Calculate Sgarbossa Score</Button>
      {result && <ResultBox result={result} source="Sgarbossa Criteria" />}
    </div>
  );
}

// ─── Calculator 7: TIMI Risk Score ───────────────────────────────────────────
function TIMICalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const criteria = [
    { id: "age65", label: "Age ≥65 years" },
    { id: "risk3", label: "≥3 CAD risk factors (family history, HTN, hypercholesterolemia, DM, active smoker)" },
    { id: "stenosis", label: "Known CAD (stenosis ≥50%)" },
    { id: "aspirin", label: "Aspirin use in past 7 days" },
    { id: "events2", label: "≥2 anginal events in past 24 hours" },
    { id: "stchange", label: "ST deviation ≥0.5 mm on presenting ECG" },
    { id: "marker", label: "Elevated serum cardiac markers (troponin or CK-MB)" },
  ];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<CalcResult | null>(null);

  const toggle = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const score = Object.values(checked).filter(Boolean).length;

  const calc = () => {
    let risk = "";
    let sev: CalcResult["severity"] = "normal";
    if (score <= 2) { risk = "Low risk (4.7–8.3% 14-day event rate)"; sev = "normal"; }
    else if (score <= 4) { risk = "Intermediate risk (13.2–19.9% 14-day event rate)"; sev = "moderate"; }
    else { risk = "High risk (26.2–40.9% 14-day event rate)"; sev = "severe"; }

    const r: CalcResult = {
      value: `TIMI Score: ${score}/7 — ${risk}`,
      interpretation: score >= 3
        ? `Intermediate-to-high risk NSTEMI/UA. Early invasive strategy (coronary angiography within 24–48 hours) recommended per ACC/AHA guidelines. Dual antiplatelet therapy, anticoagulation, and risk factor management.`
        : `Low risk NSTEMI/UA. Conservative (ischemia-guided) strategy may be appropriate. Stress testing before discharge. Optimize medical therapy.`,
      severity: sev,
      notes: [
        "TIMI score 0–2: low risk; 3–4: intermediate; 5–7: high risk",
        "14-day composite endpoint: death, MI, or urgent revascularization",
        "Validated in TIMI 11B and ESSENCE trials",
        "Score ≥3: consider early invasive strategy per ACC/AHA NSTEMI guidelines",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {criteria.map(c => (
          <label key={c.id} className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggle(c.id)}
              className="mt-0.5 rounded" />
            <span className="text-sm text-gray-700">{c.label}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: BRAND + "10" }}>
        <span className="text-sm font-semibold" style={{ color: BRAND }}>Current Score:</span>
        <span className="text-lg font-bold" style={{ color: BRAND }}>{score}/7</span>
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Interpret TIMI Score</Button>
      {result && <ResultBox result={result} source="TIMI Risk Score" />}
    </div>
  );
}

// ─── Calculator 8: GRACE Score (simplified) ──────────────────────────────────
function GRACECalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [age, setAge] = useState("");
  const [hr, setHr] = useState("");
  const [sbp, setSbp] = useState("");
  const [creatinine, setCreatinine] = useState("");
  const [killip, setKillip] = useState("1");
  const [stChange, setStChange] = useState(false);
  const [cardiacArrest, setCardiacArrest] = useState(false);
  const [elevatedMarkers, setElevatedMarkers] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);

  const calc = () => {
    const a = parseFloat(age) || 0;
    const h = parseFloat(hr) || 0;
    const s = parseFloat(sbp) || 0;
    const cr = parseFloat(creatinine) || 0;
    const k = parseInt(killip) || 1;

    // Simplified GRACE score approximation
    let score = 0;
    // Age
    if (a < 30) score += 0; else if (a < 40) score += 8; else if (a < 50) score += 25;
    else if (a < 60) score += 41; else if (a < 70) score += 58; else if (a < 80) score += 75; else score += 91;
    // HR
    if (h < 50) score += 0; else if (h < 70) score += 3; else if (h < 90) score += 9;
    else if (h < 110) score += 15; else if (h < 150) score += 24; else if (h < 200) score += 38; else score += 46;
    // SBP
    if (s < 80) score += 58; else if (s < 100) score += 53; else if (s < 120) score += 43;
    else if (s < 140) score += 34; else if (s < 160) score += 24; else if (s < 200) score += 10; else score += 0;
    // Creatinine (mg/dL)
    if (cr < 0.4) score += 1; else if (cr < 0.8) score += 4; else if (cr < 1.2) score += 7;
    else if (cr < 1.6) score += 10; else if (cr < 2.0) score += 13; else if (cr < 4.0) score += 21; else score += 28;
    // Killip class
    score += [0, 20, 39, 59][k - 1] ?? 0;
    // Binary
    if (stChange) score += 28;
    if (cardiacArrest) score += 39;
    if (elevatedMarkers) score += 14;

    let risk = "";
    let sev: CalcResult["severity"] = "normal";
    if (score < 109) { risk = "Low risk (<1% in-hospital mortality)"; sev = "normal"; }
    else if (score < 140) { risk = "Intermediate risk (1–3% in-hospital mortality)"; sev = "moderate"; }
    else { risk = "High risk (>3% in-hospital mortality)"; sev = "severe"; }

    const r: CalcResult = {
      value: `GRACE Score: ${score} — ${risk}`,
      interpretation: score >= 140
        ? `High-risk ACS. Early invasive strategy within 24 hours recommended (ACC/AHA Class I). Intensive antiplatelet/anticoagulation therapy. ICU-level monitoring.`
        : score >= 109
          ? `Intermediate-risk ACS. Early invasive strategy within 24–72 hours (ACC/AHA Class I). Dual antiplatelet therapy and anticoagulation.`
          : `Low-risk ACS. Conservative strategy with stress testing before discharge may be appropriate. Optimize medical therapy.`,
      severity: sev,
      notes: [
        "GRACE score validated for in-hospital and 6-month mortality prediction in ACS",
        "Score <109: low risk; 109–140: intermediate; >140: high risk",
        "ACC/AHA 2014 NSTEMI guidelines: GRACE score guides timing of invasive strategy",
        "Online GRACE 2.0 calculator provides more precise estimates",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {numInput("Age", age, setAge, "years")}
        {numInput("Heart Rate", hr, setHr, "bpm")}
        {numInput("Systolic BP", sbp, setSbp, "mmHg")}
        {numInput("Creatinine", creatinine, setCreatinine, "mg/dL")}
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Killip Class</label>
        <select value={killip} onChange={e => setKillip(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="1">I — No heart failure</option>
          <option value="2">II — Rales, S3, or elevated JVP</option>
          <option value="3">III — Pulmonary edema</option>
          <option value="4">IV — Cardiogenic shock</option>
        </select>
      </div>
      <div className="space-y-2">
        {[
          { label: "ST-segment deviation on ECG", val: stChange, set: setStChange },
          { label: "Cardiac arrest on admission", val: cardiacArrest, set: setCardiacArrest },
          { label: "Elevated cardiac markers", val: elevatedMarkers, set: setElevatedMarkers },
        ].map(({ label, val, set }) => (
          <label key={label} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={val} onChange={() => set(!val)} className="rounded" />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Calculate GRACE Score</Button>
      {result && <ResultBox result={result} source="GRACE Score" />}
    </div>
  );
}

// ─── Calculator 9: HEART Score ────────────────────────────────────────────────
function HEARTCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [history, setHistory] = useState("0");
  const [ecg, setEcg] = useState("0");
  const [age, setAge] = useState("0");
  const [risk, setRisk] = useState("0");
  const [troponin, setTroponin] = useState("0");
  const [result, setResult] = useState<CalcResult | null>(null);

  const score = parseInt(history) + parseInt(ecg) + parseInt(age) + parseInt(risk) + parseInt(troponin);

  const calc = () => {
    let sev: CalcResult["severity"] = "normal";
    let interp = "";
    if (score <= 3) { sev = "normal"; interp = "Low risk (MACE rate 0.9–1.7% at 6 weeks). Safe for early discharge with outpatient follow-up. No need for urgent intervention."; }
    else if (score <= 6) { sev = "moderate"; interp = "Intermediate risk (MACE rate 12–16.6% at 6 weeks). Admission for observation, serial troponins, and stress testing or coronary imaging."; }
    else { sev = "severe"; interp = "High risk (MACE rate 50–65% at 6 weeks). Early invasive strategy — coronary angiography. Cardiology consultation."; }

    const r: CalcResult = {
      value: `HEART Score: ${score}/10 — ${score <= 3 ? "Low" : score <= 6 ? "Intermediate" : "High"} Risk`,
      interpretation: interp,
      severity: sev,
      notes: [
        "H: History (0=slightly suspicious, 1=moderately suspicious, 2=highly suspicious)",
        "E: ECG (0=normal, 1=non-specific repolarization, 2=significant ST deviation)",
        "A: Age (0=<45, 1=45–64, 2=≥65)",
        "R: Risk factors (0=none/unknown, 1=1–2 factors, 2=≥3 factors or known CAD)",
        "T: Troponin (0=≤normal limit, 1=1–3× normal, 2=>3× normal)",
        "Validated in HEART Pathway trial — reduces unnecessary admissions by 20%",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  const selectField = (label: string, val: string, set: (v: string) => void, options: { value: string; label: string }[]) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <select value={val} onChange={e => set(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
        {options.map(o => <option key={o.value} value={o.value}>{o.value} — {o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-3">
      {selectField("History", history, setHistory, [
        { value: "0", label: "Slightly suspicious" },
        { value: "1", label: "Moderately suspicious" },
        { value: "2", label: "Highly suspicious" },
      ])}
      {selectField("ECG", ecg, setEcg, [
        { value: "0", label: "Normal" },
        { value: "1", label: "Non-specific repolarization disturbance" },
        { value: "2", label: "Significant ST deviation" },
      ])}
      {selectField("Age", age, setAge, [
        { value: "0", label: "<45 years" },
        { value: "1", label: "45–64 years" },
        { value: "2", label: "≥65 years" },
      ])}
      {selectField("Risk Factors", risk, setRisk, [
        { value: "0", label: "No known risk factors" },
        { value: "1", label: "1–2 risk factors" },
        { value: "2", label: "≥3 risk factors or history of atherosclerosis" },
      ])}
      {selectField("Troponin", troponin, setTroponin, [
        { value: "0", label: "≤Normal limit" },
        { value: "1", label: "1–3× normal limit" },
        { value: "2", label: ">3× normal limit" },
      ])}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: BRAND + "10" }}>
        <span className="text-sm font-semibold" style={{ color: BRAND }}>Current Score:</span>
        <span className="text-lg font-bold" style={{ color: BRAND }}>{score}/10</span>
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Interpret HEART Score</Button>
      {result && <ResultBox result={result} source="HEART Score" />}
    </div>
  );
}

// ─── Calculator 10: Brugada (VT vs SVT) ──────────────────────────────────────
function BrugadaVTCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const criteria = [
    { id: "noRS", label: "No RS complex in any precordial lead (V1–V6)" },
    { id: "rSInterval", label: "RS interval >100 ms in any precordial lead" },
    { id: "avDissoc", label: "AV dissociation present" },
    { id: "morphology", label: "Morphology criteria for VT in V1 and V6 (LBBB or RBBB pattern)" },
  ];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<CalcResult | null>(null);

  const toggle = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const calc = () => {
    const met = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);
    const firstMet = criteria.find(c => checked[c.id]);

    let sev: CalcResult["severity"] = "info";
    let interp = "";
    let value = "";

    if (checked["noRS"]) {
      value = "VT — Criterion 1 Met (No RS in precordial leads)";
      sev = "severe";
      interp = "No RS complex in any precordial lead — diagnose VT. Sensitivity 21%, specificity 100% (Brugada 1991). Treat as VT.";
    } else if (checked["rSInterval"]) {
      value = "VT — Criterion 2 Met (RS interval >100 ms)";
      sev = "severe";
      interp = "RS interval >100 ms in any precordial lead — diagnose VT. Sensitivity 66%, specificity 98%.";
    } else if (checked["avDissoc"]) {
      value = "VT — Criterion 3 Met (AV dissociation)";
      sev = "severe";
      interp = "AV dissociation present — diagnose VT. AV dissociation is pathognomonic for VT. Look for fusion beats and capture beats.";
    } else if (checked["morphology"]) {
      value = "VT — Criterion 4 Met (Morphology criteria)";
      sev = "severe";
      interp = "Morphology criteria for VT met in V1 and V6. LBBB pattern: broad R in V1, notched S in V6. RBBB pattern: monophasic R or Rr' in V1, rS in V6.";
    } else {
      value = "SVT with Aberrancy — No VT Criteria Met";
      sev = "normal";
      interp = "No Brugada criteria for VT met. Diagnosis of SVT with aberrancy by exclusion. However: when in doubt, treat as VT — hemodynamic instability always favors VT regardless of ECG.";
    }

    const r: CalcResult = {
      value,
      interpretation: interp,
      severity: sev,
      notes: [
        "Brugada algorithm: stepwise — first criterion met = VT",
        "Criterion 1: No RS in V1–V6 → VT (100% specific)",
        "Criterion 2: RS interval >100 ms → VT",
        "Criterion 3: AV dissociation → VT (pathognomonic)",
        "Criterion 4: Morphology criteria in V1 + V6 → VT",
        "None met → SVT with aberrancy (by exclusion)",
        "Clinical rule: ALWAYS treat hemodynamically unstable WCT as VT",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="bg-red-50 rounded-lg px-3 py-2">
        <p className="text-xs text-red-800"><strong>Important:</strong> Apply criteria in order — stop at the first criterion met. Hemodynamically unstable wide complex tachycardia should always be treated as VT regardless of ECG findings.</p>
      </div>
      <div className="space-y-2">
        {criteria.map((c, i) => (
          <label key={c.id} className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggle(c.id)} className="mt-0.5 rounded" />
            <span className="text-sm text-gray-700"><strong>Criterion {i + 1}:</strong> {c.label}</span>
          </label>
        ))}
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Apply Brugada Algorithm</Button>
      {result && <ResultBox result={result} source="Brugada VT vs SVT Algorithm" />}
    </div>
  );
}

// ─── Calculator 11: Pediatric QTc Z-score ────────────────────────────────────
function PedQTcCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [qt, setQt] = useState("");
  const [rr, setRr] = useState("");
  const [ageMonths, setAgeMonths] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calc = () => {
    const qtMs = parseFloat(qt);
    const rrMs = parseFloat(rr);
    const age = parseFloat(ageMonths);
    if (isNaN(qtMs) || isNaN(rrMs) || rrMs <= 0) return;

    const bazett = qtMs / Math.sqrt(rrMs / 1000);

    // Age-specific upper limits of normal (Davignon 1980 / Rijnbeek 2001)
    let upperLimit = 440;
    let ageGroup = "adult";
    if (!isNaN(age)) {
      if (age < 1) { upperLimit = 490; ageGroup = "neonate (<1 month)"; }
      else if (age < 6) { upperLimit = 460; ageGroup = "infant (1–6 months)"; }
      else if (age < 12) { upperLimit = 450; ageGroup = "infant (6–12 months)"; }
      else if (age < 36) { upperLimit = 440; ageGroup = "toddler (1–3 years)"; }
      else if (age < 120) { upperLimit = 440; ageGroup = "child (3–10 years)"; }
      else { upperLimit = 440; ageGroup = "adolescent (>10 years)"; }
    }

    let sev: CalcResult["severity"] = "normal";
    let interp = "";
    if (bazett > 500) { sev = "critical"; interp = `QTc ${bazett.toFixed(0)} ms — Markedly prolonged for ${ageGroup} (>500 ms). High risk of Torsades de Pointes. Urgent cardiology evaluation. Assess for LQTS, drug effects, electrolyte abnormalities.`; }
    else if (bazett > upperLimit) { sev = "severe"; interp = `QTc ${bazett.toFixed(0)} ms — Prolonged for ${ageGroup} (upper limit ${upperLimit} ms). Evaluate for congenital LQTS, maternal medications, electrolyte abnormalities, hypothyroidism.`; }
    else { sev = "normal"; interp = `QTc ${bazett.toFixed(0)} ms — Normal for ${ageGroup} (upper limit ${upperLimit} ms).`; }

    const r: CalcResult = {
      value: `QTc (Bazett): ${bazett.toFixed(0)} ms | Age group: ${ageGroup} | Upper limit: ${upperLimit} ms`,
      interpretation: interp,
      severity: sev,
      notes: [
        "Neonates (<1 month): QTc ≤490 ms normal; screen at 3–4 weeks of age",
        "Infants (1–6 months): QTc ≤460 ms normal",
        "Children/adolescents: QTc ≤440 ms normal",
        "Neonatal prolonged QTc associated with SIDS risk",
        "Maternal SSRIs, macrolides, and antifungals can prolong neonatal QTc",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {numInput("QT Interval", qt, setQt, "ms")}
        {numInput("RR Interval", rr, setRr, "ms")}
        {numInput("Age", ageMonths, setAgeMonths, "months", "optional")}
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Calculate Pediatric QTc</Button>
      {result && <ResultBox result={result} source="Pediatric QTc" />}
    </div>
  );
}

// ─── Calculator 12: PR Interval Classifier ───────────────────────────────────
function PRCalc({ onResult }: { onResult?: (r: CalcResult) => void }) {
  const [pr, setPr] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calc = () => {
    const prMs = parseFloat(pr);
    const age = parseFloat(ageYears) || 999;
    if (isNaN(prMs)) return;

    // Age-adjusted upper limits
    let upperLimit = 200;
    let lowerLimit = 120;
    let ageGroup = "adult";
    if (age < 1) { upperLimit = 150; lowerLimit = 80; ageGroup = "neonate"; }
    else if (age < 5) { upperLimit = 165; lowerLimit = 100; ageGroup = "young child"; }
    else if (age < 12) { upperLimit = 180; lowerLimit = 110; ageGroup = "child"; }
    else if (age < 18) { upperLimit = 190; lowerLimit = 120; ageGroup = "adolescent"; }

    let sev: CalcResult["severity"] = "normal";
    let value = "";
    let interp = "";

    if (prMs < lowerLimit) {
      sev = "moderate";
      value = `Short PR (${prMs} ms) — <${lowerLimit} ms for ${ageGroup}`;
      interp = `Short PR interval. Causes: WPW syndrome (delta wave present), LGL syndrome (no delta wave), AV nodal re-entry, enhanced AV nodal conduction, Pompe disease (glycogen storage). Evaluate for pre-excitation syndrome.`;
    } else if (prMs <= upperLimit) {
      sev = "normal";
      value = `Normal PR (${prMs} ms) — ${lowerLimit}–${upperLimit} ms for ${ageGroup}`;
      interp = `Normal PR interval for ${ageGroup}.`;
    } else if (prMs <= 300) {
      sev = "mild";
      value = `1° AV Block (${prMs} ms) — >${upperLimit} ms for ${ageGroup}`;
      interp = `First-degree AV block. All P waves conduct with prolonged PR. Causes: vagal tone, inferior MI, myocarditis, Lyme disease, digoxin, beta-blockers, calcium channel blockers, hyperkalemia, aging. Usually benign but monitor for progression.`;
    } else {
      sev = "severe";
      value = `Markedly prolonged PR (${prMs} ms) — evaluate for high-degree AV block`;
      interp = `Markedly prolonged PR (>300 ms). Risk of progression to higher-degree AV block. Evaluate for 2° AV block (Wenckebach or Mobitz II). Cardiology referral if symptomatic.`;
    }

    const r: CalcResult = {
      value,
      interpretation: interp,
      severity: sev,
      notes: [
        "Normal adult PR: 120–200 ms",
        "Short PR (<120 ms): WPW, LGL, enhanced AV nodal conduction",
        "1° AV Block: PR >200 ms, all P waves conduct",
        "2° AV Block Mobitz I (Wenckebach): progressive PR lengthening → dropped beat",
        "2° AV Block Mobitz II: constant PR → sudden dropped beat (higher risk)",
        "3° AV Block (complete): P waves and QRS completely dissociated",
      ],
    };
    setResult(r);
    onResult?.(r);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {numInput("PR Interval", pr, setPr, "ms")}
        {numInput("Age", ageYears, setAgeYears, "years", "optional")}
      </div>
      <Button onClick={calc} size="sm" className="w-full" style={{ background: BRAND }}>Classify PR Interval</Button>
      {result && <ResultBox result={result} source="PR Interval Classifier" />}
    </div>
  );
}

// ─── PDF Report ───────────────────────────────────────────────────────────────
interface StudyInfo {
  date: string;
  operator: string;
  indication: string;
}

function generatePDF(studyInfo: StudyInfo, results: Record<string, CalcResult>) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 18;
  let y = 20;

  // Header
  doc.setFillColor(24, 154, 161);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ECGAssist™ — ECG Calculator Report", margin, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("iHeartEcho™ | Guideline-Based ECG Interpretation", margin, 19);
  doc.text("For clinical decision support only — not a substitute for physician interpretation", margin, 24);
  y = 36;

  // Study info
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Study Information", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const infoRows = [
    ["Date", studyInfo.date || "Not specified"],
    ["Operator", studyInfo.operator || "Not specified"],
    ["Clinical Indication", studyInfo.indication || "Not specified"],
  ];
  infoRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, margin + 38, y);
    y += 5;
  });
  y += 4;

  // Results
  const entries = Object.entries(results);
  if (entries.length === 0) {
    doc.setFontSize(9);
    doc.text("No calculator results recorded.", margin, y);
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Calculator Results", margin, y);
    y += 6;

    const sevColors: Record<string, [number, number, number]> = {
      normal: [220, 252, 231],
      mild: [254, 249, 195],
      moderate: [255, 237, 213],
      severe: [254, 226, 226],
      critical: [254, 202, 202],
      info: [219, 234, 254],
    };

    entries.forEach(([source, result]) => {
      if (y > 265) { doc.addPage(); y = 20; }
      const bg = sevColors[result.severity ?? "info"] ?? [240, 240, 240];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.roundedRect(margin, y, W - margin * 2, 4, 1, 1, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(source, margin + 2, y + 3);
      y += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Result:", margin + 2, y);
      doc.setFont("helvetica", "normal");
      const valueLines = doc.splitTextToSize(result.value, W - margin * 2 - 20);
      doc.text(valueLines, margin + 16, y);
      y += valueLines.length * 4 + 2;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      const interpLines = doc.splitTextToSize(result.interpretation, W - margin * 2 - 4);
      doc.text(interpLines, margin + 2, y);
      y += interpLines.length * 3.5 + 4;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`ECGAssist™ Report — iHeartEcho™ | Page ${i} of ${pageCount}`, margin, 292);
    doc.text("For clinical decision support only. Not a substitute for physician interpretation.", W - margin, 292, { align: "right" });
  }

  doc.save(`ECGAssist-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ECGAssist() {
  const [studyInfo, setStudyInfo] = useState<StudyInfo>({ date: "", operator: "", indication: "" });
  const [results, setResults] = useState<Record<string, CalcResult>>({});
  const [showStudyInfo, setShowStudyInfo] = useState(false);

  const makeOnResult = useCallback((source: string) => (r: CalcResult) => {
    setResults(prev => ({ ...prev, [source]: r }));
  }, []);

  const resultCount = Object.keys(results).length;

  return (
    <Layout>
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, #0e1e2e 0%, ${BRAND_DARK} 60%, ${BRAND} 100%)` }}
      >
        <div className="relative container py-10 md:py-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ad9e0" }} />
              <span className="text-xs text-white/80 font-medium">Premium — ECG Calculators</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
              style={{ fontFamily: "Merriweather, serif" }}>
              ECGAssist™
            </h1>
            <p className="text-white/70 text-sm leading-relaxed mb-5 max-w-lg">
              12 guideline-based ECG calculators — QTc, TIMI, GRACE, HEART Score, Sgarbossa, LVH/RVH voltage criteria, axis, Brugada algorithm, and more. Generate a consolidated PDF report of all results.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/ecg-navigator">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                  <BookOpen className="w-4 h-4" />
                  ECG Navigator
                </button>
              </Link>
              <Link href="/ecg-coach">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                  <Activity className="w-4 h-4" />
                  ECG Coach
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8">
        <PremiumGate featureName="ECGAssist™ Calculators">
          <div className="space-y-4">
            {/* Study Info + PDF */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setShowStudyInfo(!showStudyInfo)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: BRAND }} />
                  <span className="text-sm font-bold text-gray-800">Study Information & PDF Report</span>
                  {resultCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: BRAND }}>
                      {resultCount} result{resultCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {showStudyInfo ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showStudyInfo && (
                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                      <input type="date" value={studyInfo.date} onChange={e => setStudyInfo(p => ({ ...p, date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Operator / Interpreter</label>
                      <input type="text" value={studyInfo.operator} onChange={e => setStudyInfo(p => ({ ...p, operator: e.target.value }))}
                        placeholder="Name or initials" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Clinical Indication</label>
                      <input type="text" value={studyInfo.indication} onChange={e => setStudyInfo(p => ({ ...p, indication: e.target.value }))}
                        placeholder="e.g. Chest pain, syncope" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-800"><strong>Privacy:</strong> No patient identifiers (name, DOB, MRN) are collected or stored. This tool is for clinical decision support only.</p>
                  </div>
                  <Button
                    onClick={() => generatePDF(studyInfo, results)}
                    disabled={resultCount === 0}
                    className="flex items-center gap-2"
                    style={{ background: resultCount > 0 ? BRAND : undefined }}
                  >
                    <Download className="w-4 h-4" />
                    Generate PDF Report ({resultCount} result{resultCount !== 1 ? "s" : ""})
                  </Button>
                </div>
              )}
            </div>

            {/* Calculators */}
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                ECG Calculators
              </h2>
              <span className="text-xs text-gray-400">Tap any calculator to expand</span>
            </div>

            <CalcCard id="qtc" title="QTc — Four Formula Comparison" badge="Long QT / Drug Monitoring" badgeColor={BRAND}>
              <QTcCalc onResult={makeOnResult("QTc Calculator")} />
            </CalcCard>

            <CalcCard id="hr" title="Heart Rate from RR Interval" badge="Rate Analysis" badgeColor="#189aa1">
              <HRCalc onResult={makeOnResult("Heart Rate Calculator")} />
            </CalcCard>

            <CalcCard id="axis" title="Electrical Axis Calculator" badge="Frontal Plane Axis" badgeColor="#189aa1">
              <AxisCalc onResult={makeOnResult("Electrical Axis Calculator")} />
            </CalcCard>

            <CalcCard id="lvh" title="LVH Voltage Criteria" badge="Sokolow-Lyon + Cornell" badgeColor="#189aa1">
              <LVHCalc onResult={makeOnResult("LVH Voltage Criteria")} />
            </CalcCard>

            <CalcCard id="rvh" title="RVH Criteria Scorer" badge="Right Ventricular Hypertrophy" badgeColor="#dc2626">
              <RVHCalc onResult={makeOnResult("RVH Criteria")} />
            </CalcCard>

            <CalcCard id="sgarbossa" title="Sgarbossa Criteria" badge="STEMI in LBBB" badgeColor="#dc2626">
              <SgarbossaCalc onResult={makeOnResult("Sgarbossa Criteria")} />
            </CalcCard>

            <CalcCard id="timi" title="TIMI Risk Score (NSTEMI/UA)" badge="ACS Risk Stratification" badgeColor="#189aa1">
              <TIMICalc onResult={makeOnResult("TIMI Risk Score")} />
            </CalcCard>

            <CalcCard id="grace" title="GRACE Score (ACS)" badge="In-Hospital Mortality" badgeColor="#189aa1">
              <GRACECalc onResult={makeOnResult("GRACE Score")} />
            </CalcCard>

            <CalcCard id="heart" title="HEART Score" badge="Chest Pain — ED Risk" badgeColor="#189aa1">
              <HEARTCalc onResult={makeOnResult("HEART Score")} />
            </CalcCard>

            <CalcCard id="brugada-vt" title="Brugada Algorithm (VT vs SVT)" badge="Wide Complex Tachycardia" badgeColor="#dc2626">
              <BrugadaVTCalc onResult={makeOnResult("Brugada VT vs SVT Algorithm")} />
            </CalcCard>

            <CalcCard id="ped-qtc" title="Pediatric / Neonatal QTc" badge="Age-Corrected QTc" badgeColor="#189aa1">
              <PedQTcCalc onResult={makeOnResult("Pediatric QTc")} />
            </CalcCard>

            <CalcCard id="pr" title="PR Interval Classifier" badge="AV Conduction" badgeColor={BRAND}>
              <PRCalc onResult={makeOnResult("PR Interval Classifier")} />
            </CalcCard>

            {/* Cross-promo */}
            <div className="mt-4 rounded-xl p-5 border" style={{ borderColor: BRAND + "40", background: "#f0fbfc" }}>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4" style={{ color: BRAND }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND }}>Related</span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1" style={{ fontFamily: "Merriweather, serif" }}>ECG Navigator</h3>
              <p className="text-xs text-gray-500 mb-3">Systematic ECG interpretation guide — rate/rhythm, ST changes, Brugada pattern, Wellens, de Winter, pacemaker ECGs, and more.</p>
              <Link href="/ecg-navigator">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white transition-all hover:opacity-90"
                  style={{ background: BRAND }}>
                  Open ECG Navigator <Zap className="w-3 h-3" />
                </button>
              </Link>
            </div>
          </div>
        </PremiumGate>
      </div>
    </Layout>
  );
}
