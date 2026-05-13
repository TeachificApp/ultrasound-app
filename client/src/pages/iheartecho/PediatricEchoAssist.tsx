/*
  PediatricEchoAssist™ — iHeartEcho™
  20 ASE 2016 Pediatric Echo Guideline + AHA Kawasaki 2017 based calculators
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/

import { useState, useCallback, useEffect } from "react";
import { useSearch } from "wouter";
import Layout from "@/components/Layout";
import { PremiumGate } from "@/components/PremiumGate";
import { CopyToReportButton } from "@/components/CopyToReportButton";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertCircle,
  Baby,
  Calculator,
  FileText,
  Heart,
  Loader2,
  Stethoscope,
  Users,
  Zap,
} from "lucide-react";

const BRAND = "#189aa1";
const NAVY = "#0e1e2e";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CalcResult {
  label: string;
  value: string;
  interpretation: string;
  normal: boolean | null;
  guideline?: string;
}

// ─── Shared UI helpers ─────────────────────────────────────────────────────────
function ResultBadge({ normal }: { normal: boolean | null }) {
  if (normal === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
        normal ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {normal ? "Normal" : "Abnormal"}
    </span>
  );
}

function CalcCard({
  id,
  title,
  badge,
  color,
  children,
}: {
  id: string;
  title: string;
  badge: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden scroll-mt-20">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
          <Calculator className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-sm leading-snug" style={{ fontFamily: "Merriweather, serif" }}>
            {title}
          </h3>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: color + "15", color }}>
          {badge}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InputRow({ label, unit, value, onChange, placeholder }: { label: string; unit?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <label className="text-xs font-semibold text-gray-600 w-44 flex-shrink-0">{label}{unit ? <span className="text-gray-400 font-normal"> ({unit})</span> : ""}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
      />
    </div>
  );
}

function ResultBox({ result, source }: { result: CalcResult | null; source?: string }) {
  if (!result) return null;
  return (
    <div className={`mt-4 rounded-xl p-4 border ${result.normal === false ? "bg-red-50 border-red-200" : result.normal === true ? "bg-green-50 border-green-200" : ""}`} style={result.normal === null ? { background: "#189aa108", borderColor: "#189aa130" } : undefined}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="font-bold text-sm text-gray-800">{result.label}: {result.value}</span>
        <ResultBadge normal={result.normal} />
      </div>
      <p className="text-xs text-gray-700 leading-relaxed">{result.interpretation}</p>
      {result.guideline && <p className="text-xs text-gray-400 mt-1 italic">{result.guideline}</p>}
      {source && (
        <div className="mt-3 pt-2 border-t border-gray-200/60">
          <CopyToReportButton
            source={source}
            calculator={result.label}
            label={`${result.label}: ${result.value}`}
            result={`${result.value} — ${result.interpretation}`}
            interpretation={result.interpretation}
          />
        </div>
      )}
    </div>
  );
}

// ─── 1. BSA Calculator ─────────────────────────────────────────────────────────
function BSACalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [formula, setFormula] = useState<"mosteller" | "dubois">("mosteller");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!w || !h || w <= 0 || h <= 0) return;
    let bsa: number;
    if (formula === "mosteller") {
      bsa = Math.sqrt((h * w) / 3600);
    } else {
      bsa = 0.007184 * Math.pow(h, 0.725) * Math.pow(w, 0.425);
    }
    const r: CalcResult = {
      label: `BSA (${formula === "mosteller" ? "Mosteller" : "DuBois"})`,
      value: `${bsa.toFixed(3)} m²`,
      interpretation: `Body surface area is ${bsa.toFixed(3)} m². This value is used to normalize all pediatric echo Z-scores. Accurate BSA is essential — small errors propagate to all derived Z-scores.`,
      normal: null,
      guideline: "ASE 2016 Pediatric Echo Guidelines — BSA normalization foundation",
    };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-bsa" title="BSA Calculator" badge="Growth" color={BRAND}>
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-600 block mb-1">Formula</label>
        <div className="flex gap-2">
          {(["mosteller", "dubois"] as const).map((f) => (
            <button key={f} onClick={() => setFormula(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${formula === f ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={formula === f ? { background: BRAND } : {}}>
              {f === "mosteller" ? "Mosteller" : "DuBois"}
            </button>
          ))}
        </div>
      </div>
      <InputRow label="Weight" unit="kg" value={weight} onChange={setWeight} />
      <InputRow label="Height" unit="cm" value={height} onChange={setHeight} />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate BSA</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 2. Z-Score Aortic Root ────────────────────────────────────────────────────
function ZScoreAorticRoot({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [bsa, setBsa] = useState("");
  const [diameter, setDiameter] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const b = parseFloat(bsa);
    const d = parseFloat(diameter);
    if (!b || !d || b <= 0 || d <= 0) return;
    // Predicted aortic root (Daubeney nomogram): mean = 1.02 + 0.98*BSA (cm)
    const predicted = 1.02 + 0.98 * b;
    const sd = 0.18 + 0.065 * b;
    const z = (d - predicted) / sd;
    let interp = "";
    let normal = true;
    if (z >= 2) { interp = `Z-score ${z.toFixed(2)}: Aortic root dilation. Z ≥2 warrants monitoring; Z ≥3 is significant dilation (consider Marfan syndrome, BAV aortopathy, connective tissue disorder). Echocardiographic surveillance every 6–12 months recommended.`; normal = false; }
    else if (z <= -2) { interp = `Z-score ${z.toFixed(2)}: Aortic root hypoplasia. Z ≤−2 may indicate HLHS spectrum or critical AS. Correlate with clinical findings.`; normal = false; }
    else { interp = `Z-score ${z.toFixed(2)}: Aortic root dimension within normal limits for BSA. No dilation detected.`; }
    const r: CalcResult = { label: "Aortic Root Z-Score", value: z.toFixed(2), interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines; Daubeney nomogram" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-zscore-ao" title="Z-Score — Aortic Root / Annulus" badge="Z-Score" color={BRAND}>
      <InputRow label="BSA" unit="m²" value={bsa} onChange={setBsa} placeholder="e.g. 0.85" />
      <InputRow label="Aortic Root Diameter" unit="cm" value={diameter} onChange={setDiameter} placeholder="e.g. 2.1" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Z-Score</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 3. Z-Score Pulmonary Valve Annulus ───────────────────────────────────────
function ZScorePulmonaryAnnulus({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [bsa, setBsa] = useState("");
  const [diameter, setDiameter] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const b = parseFloat(bsa);
    const d = parseFloat(diameter);
    if (!b || !d || b <= 0 || d <= 0) return;
    // Kirklin nomogram: predicted PA annulus (cm) = 1.09 + 0.82*BSA
    const predicted = 1.09 + 0.82 * b;
    const sd = 0.15 + 0.06 * b;
    const z = (d - predicted) / sd;
    let interp = "";
    let normal = true;
    if (z <= -2) { interp = `Z-score ${z.toFixed(2)}: Pulmonary annulus hypoplasia. Z ≤−2 is significant in TOF, critical PS, or pulmonary atresia. Surgical/interventional planning may require annular enlargement.`; normal = false; }
    else if (z >= 2) { interp = `Z-score ${z.toFixed(2)}: Pulmonary annulus dilation. Seen in pulmonary regurgitation, post-repair TOF, or connective tissue disorders.`; normal = false; }
    else { interp = `Z-score ${z.toFixed(2)}: Pulmonary annulus within normal limits for BSA.`; }
    const r: CalcResult = { label: "PA Annulus Z-Score", value: z.toFixed(2), interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines; Kirklin nomogram" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-zscore-pa" title="Z-Score — Pulmonary Valve Annulus" badge="Z-Score" color={BRAND}>
      <InputRow label="BSA" unit="m²" value={bsa} onChange={setBsa} placeholder="e.g. 0.85" />
      <InputRow label="PA Annulus Diameter" unit="cm" value={diameter} onChange={setDiameter} placeholder="e.g. 1.8" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Z-Score</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 4. Z-Score Mitral Valve Annulus ──────────────────────────────────────────
function ZScoreMitralAnnulus({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [bsa, setBsa] = useState("");
  const [diameter, setDiameter] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const b = parseFloat(bsa);
    const d = parseFloat(diameter);
    if (!b || !d || b <= 0 || d <= 0) return;
    const predicted = 1.48 + 0.94 * b;
    const sd = 0.18 + 0.07 * b;
    const z = (d - predicted) / sd;
    let interp = "";
    let normal = true;
    if (z <= -2) { interp = `Z-score ${z.toFixed(2)}: Mitral annulus hypoplasia. Z ≤−2 is significant — seen in HLHS spectrum, mitral stenosis, parachute MV. Impacts candidacy for biventricular repair.`; normal = false; }
    else if (z >= 2) { interp = `Z-score ${z.toFixed(2)}: Mitral annulus dilation. Associated with mitral regurgitation, dilated cardiomyopathy, or volume overload.`; normal = false; }
    else { interp = `Z-score ${z.toFixed(2)}: Mitral annulus within normal limits for BSA.`; }
    const r: CalcResult = { label: "MV Annulus Z-Score", value: z.toFixed(2), interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-zscore-mv" title="Z-Score — Mitral Valve Annulus" badge="Z-Score" color={BRAND}>
      <InputRow label="BSA" unit="m²" value={bsa} onChange={setBsa} placeholder="e.g. 0.85" />
      <InputRow label="MV Annulus Diameter" unit="cm" value={diameter} onChange={setDiameter} placeholder="e.g. 2.0" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Z-Score</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 5. Z-Score Tricuspid Valve Annulus ───────────────────────────────────────
function ZScoreTricuspidAnnulus({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [bsa, setBsa] = useState("");
  const [diameter, setDiameter] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const b = parseFloat(bsa);
    const d = parseFloat(diameter);
    if (!b || !d || b <= 0 || d <= 0) return;
    const predicted = 1.72 + 1.02 * b;
    const sd = 0.20 + 0.08 * b;
    const z = (d - predicted) / sd;
    let interp = "";
    let normal = true;
    if (z <= -2) { interp = `Z-score ${z.toFixed(2)}: Tricuspid annulus hypoplasia. Z ≤−2 is significant — seen in pulmonary atresia with intact septum, RV hypoplasia, HLHS. Critical for determining RV adequacy.`; normal = false; }
    else if (z >= 2) { interp = `Z-score ${z.toFixed(2)}: Tricuspid annulus dilation. Seen in Ebstein's anomaly, severe TR, or RV volume overload. Ebstein's typically shows Z >4.`; normal = false; }
    else { interp = `Z-score ${z.toFixed(2)}: Tricuspid annulus within normal limits for BSA.`; }
    const r: CalcResult = { label: "TV Annulus Z-Score", value: z.toFixed(2), interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-zscore-tv" title="Z-Score — Tricuspid Valve Annulus" badge="Z-Score" color={BRAND}>
      <InputRow label="BSA" unit="m²" value={bsa} onChange={setBsa} placeholder="e.g. 0.85" />
      <InputRow label="TV Annulus Diameter" unit="cm" value={diameter} onChange={setDiameter} placeholder="e.g. 2.2" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Z-Score</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 6. Z-Score LVEDD ─────────────────────────────────────────────────────────
function ZScoreLVEDD({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [bsa, setBsa] = useState("");
  const [lvedd, setLvedd] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const b = parseFloat(bsa);
    const d = parseFloat(lvedd);
    if (!b || !d || b <= 0 || d <= 0) return;
    // Kampmann nomogram: predicted LVEDD (cm) = 3.22 * BSA^0.47
    const predicted = 3.22 * Math.pow(b, 0.47);
    const sd = 0.28 * Math.pow(b, 0.47);
    const z = (d - predicted) / sd;
    let interp = "";
    let normal = true;
    if (z >= 2) { interp = `Z-score ${z.toFixed(2)}: LV dilation. Z ≥2 suggests volume overload (VSD, AR, MR) or dilated cardiomyopathy. Z ≥3 warrants cardiology referral and serial monitoring.`; normal = false; }
    else if (z <= -2) { interp = `Z-score ${z.toFixed(2)}: LV hypoplasia. Z ≤−2 may indicate HLHS spectrum or restrictive cardiomyopathy. Assess for biventricular repair candidacy.`; normal = false; }
    else { interp = `Z-score ${z.toFixed(2)}: LV end-diastolic dimension within normal limits for BSA.`; }
    const r: CalcResult = { label: "LVEDD Z-Score", value: z.toFixed(2), interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines; Kampmann nomogram" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-zscore-lvedd" title="Z-Score — LV End-Diastolic Dimension" badge="Z-Score" color={BRAND}>
      <InputRow label="BSA" unit="m²" value={bsa} onChange={setBsa} placeholder="e.g. 0.85" />
      <InputRow label="LVEDD" unit="cm" value={lvedd} onChange={setLvedd} placeholder="e.g. 3.5" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Z-Score</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 7. Coronary Artery Z-Score (Kawasaki) ────────────────────────────────────
function CoronaryZScore({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [bsa, setBsa] = useState("");
  const [vessel, setVessel] = useState<"lmca" | "lad" | "rca">("lmca");
  const [diameter, setDiameter] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  // Dallaire 2011 nomogram (mm)
  const nomogram = {
    lmca: { a: 2.01, b: 1.15, sd: 0.35 },
    lad:  { a: 1.72, b: 0.98, sd: 0.30 },
    rca:  { a: 1.68, b: 0.92, sd: 0.28 },
  };

  const calculate = () => {
    const b = parseFloat(bsa);
    const d = parseFloat(diameter);
    if (!b || !d || b <= 0 || d <= 0) return;
    const { a, b: coef, sd } = nomogram[vessel];
    const predicted = a + coef * b;
    const z = (d - predicted) / sd;
    let interp = "";
    let normal = true;
    const vesselLabel = vessel === "lmca" ? "LMCA" : vessel === "lad" ? "LAD" : "RCA";
    if (z >= 2.5 && z < 5) { interp = `Z-score ${z.toFixed(2)}: Small aneurysm (Z 2.5–5). Kawasaki disease classification: small coronary aneurysm. Risk of thrombosis is low but requires aspirin therapy and serial echo follow-up every 6–12 months.`; normal = false; }
    else if (z >= 5 && z < 10) { interp = `Z-score ${z.toFixed(2)}: Medium aneurysm (Z 5–10). Kawasaki disease: medium aneurysm. Anticoagulation with aspirin ± warfarin/LMWH. Echo every 3–6 months.`; normal = false; }
    else if (z >= 10) { interp = `Z-score ${z.toFixed(2)}: Giant aneurysm (Z ≥10). Highest risk of thrombosis and MI. Dual antiplatelet + anticoagulation. Cardiology/cardiac surgery consultation urgent.`; normal = false; }
    else if (z >= 2) { interp = `Z-score ${z.toFixed(2)}: ${vesselLabel} dilation (Z 2–2.5). Borderline — monitor closely. Kawasaki disease cannot be excluded. Repeat echo in 2 weeks.`; normal = false; }
    else { interp = `Z-score ${z.toFixed(2)}: ${vesselLabel} within normal limits. No coronary dilation detected.`; }
    const r: CalcResult = { label: `${vesselLabel} Z-Score`, value: z.toFixed(2), interpretation: interp, normal, guideline: "AHA Kawasaki Disease 2017 Scientific Statement; Dallaire 2011 nomogram" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-coronary-zscore" title="Coronary Artery Z-Score (Kawasaki)" badge="Kawasaki" color={BRAND}>
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-600 block mb-1">Vessel</label>
        <div className="flex gap-2">
          {(["lmca", "lad", "rca"] as const).map((v) => (
            <button key={v} onClick={() => setVessel(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${vessel === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={vessel === v ? { background: BRAND } : {}}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <InputRow label="BSA" unit="m²" value={bsa} onChange={setBsa} placeholder="e.g. 0.85" />
      <InputRow label="Vessel Diameter" unit="mm" value={diameter} onChange={setDiameter} placeholder="e.g. 3.2" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Z-Score</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 8. Qp:Qs Shunt Ratio ─────────────────────────────────────────────────────
function QpQsCalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [rvotVti, setRvotVti] = useState("");
  const [rvotD, setRvotD] = useState("");
  const [lvotVti, setLvotVti] = useState("");
  const [lvotD, setLvotD] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const rv = parseFloat(rvotVti);
    const rd = parseFloat(rvotD);
    const lv = parseFloat(lvotVti);
    const ld = parseFloat(lvotD);
    if (!rv || !rd || !lv || !ld) return;
    const rvotArea = Math.PI * Math.pow(rd / 2, 2);
    const lvotArea = Math.PI * Math.pow(ld / 2, 2);
    const qp = rvotArea * rv;
    const qs = lvotArea * lv;
    const ratio = qp / qs;
    let interp = "";
    let normal = true;
    if (ratio < 1.0) { interp = `Qp:Qs ${ratio.toFixed(2)}: Qp < Qs — net right-to-left shunt (cyanotic physiology). Evaluate for Eisenmenger syndrome or right-sided obstruction.`; normal = false; }
    else if (ratio >= 1.0 && ratio < 1.5) { interp = `Qp:Qs ${ratio.toFixed(2)}: Small left-to-right shunt. Hemodynamically insignificant. Clinical follow-up appropriate; intervention generally not indicated.`; }
    else if (ratio >= 1.5 && ratio < 2.0) { interp = `Qp:Qs ${ratio.toFixed(2)}: Moderate left-to-right shunt. Hemodynamically significant — monitor for RV volume overload and pulmonary hypertension. Intervention consideration warranted.`; normal = false; }
    else { interp = `Qp:Qs ${ratio.toFixed(2)}: Large left-to-right shunt. Significant pulmonary overcirculation — high risk of pulmonary hypertension. Surgical/catheter intervention strongly recommended.`; normal = false; }
    const r: CalcResult = { label: "Qp:Qs", value: ratio.toFixed(2), interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines — shunt quantification" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-qpqs" title="Qp:Qs Shunt Ratio" badge="Shunt" color={BRAND}>
      <p className="text-xs text-gray-500 mb-3">Measure RVOT (pulmonary) and LVOT (systemic) diameters and VTI by PW Doppler.</p>
      <InputRow label="RVOT VTI" unit="cm" value={rvotVti} onChange={setRvotVti} placeholder="e.g. 18" />
      <InputRow label="RVOT Diameter" unit="cm" value={rvotD} onChange={setRvotD} placeholder="e.g. 1.8" />
      <InputRow label="LVOT VTI" unit="cm" value={lvotVti} onChange={setLvotVti} placeholder="e.g. 22" />
      <InputRow label="LVOT Diameter" unit="cm" value={lvotD} onChange={setLvotD} placeholder="e.g. 1.5" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Qp:Qs</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 9. RVSP via TR Jet ───────────────────────────────────────────────────────
function RVSPCalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [trVmax, setTrVmax] = useState("");
  const [rap, setRap] = useState("5");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const v = parseFloat(trVmax);
    const r = parseFloat(rap);
    if (!v || v <= 0) return;
    const gradient = 4 * v * v;
    const rvsp = gradient + r;
    let interp = "";
    let normal = true;
    if (rvsp < 36) { interp = `RVSP ${rvsp.toFixed(0)} mmHg: Normal. No evidence of pulmonary hypertension.`; }
    else if (rvsp >= 36 && rvsp < 50) { interp = `RVSP ${rvsp.toFixed(0)} mmHg: Mildly elevated. Possible pulmonary hypertension — correlate with clinical context, PA anatomy, and right heart size/function.`; normal = false; }
    else if (rvsp >= 50 && rvsp < 70) { interp = `RVSP ${rvsp.toFixed(0)} mmHg: Moderately elevated. Significant pulmonary hypertension. Evaluate for CHD-associated PH, Eisenmenger physiology. Cardiac catheterization may be indicated.`; normal = false; }
    else { interp = `RVSP ${rvsp.toFixed(0)} mmHg: Severely elevated. Severe pulmonary hypertension. Urgent cardiology evaluation. Eisenmenger syndrome must be excluded.`; normal = false; }
    const res: CalcResult = { label: "RVSP", value: `${rvsp.toFixed(0)} mmHg`, interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines — RVSP estimation" };
    setResult(res);
    onResult(res);
  };

  return (
    <CalcCard id="engine-rvsp" title="RVSP / PASP via TR Jet" badge="Hemodynamics" color={BRAND}>
      <InputRow label="TR Vmax" unit="m/s" value={trVmax} onChange={setTrVmax} placeholder="e.g. 3.0" />
      <InputRow label="RAP Estimate" unit="mmHg" value={rap} onChange={setRap} placeholder="5" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate RVSP</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 10. Rp:Rs Resistance Ratio ───────────────────────────────────────────────
function RpRsCalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [mPAP, setMPAP] = useState("");
  const [pcwp, setPcwp] = useState("");
  const [qp, setQp] = useState("");
  const [mAoP, setMAoP] = useState("");
  const [cvp, setCvp] = useState("");
  const [qs, setQs] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const mp = parseFloat(mPAP);
    const pw = parseFloat(pcwp);
    const qpv = parseFloat(qp);
    const ma = parseFloat(mAoP);
    const cv = parseFloat(cvp);
    const qsv = parseFloat(qs);
    if (!mp || !pw || !qpv || !ma || !cv || !qsv) return;
    const rp = (mp - pw) / qpv;
    const rs = (ma - cv) / qsv;
    const ratio = rp / rs;
    let interp = "";
    let normal = true;
    if (ratio < 0.3) { interp = `Rp:Rs ${ratio.toFixed(2)}: Low pulmonary vascular resistance. Favorable for surgical repair of large shunts.`; }
    else if (ratio >= 0.3 && ratio < 0.5) { interp = `Rp:Rs ${ratio.toFixed(2)}: Borderline elevated. Repair may still be feasible with vasodilator testing. Catheterization with O₂/NO challenge recommended.`; normal = false; }
    else { interp = `Rp:Rs ${ratio.toFixed(2)}: Elevated (≥0.5). Eisenmenger threshold approached or exceeded. Surgical repair contraindicated without pulmonary vasodilator therapy response. Refer to PH specialist.`; normal = false; }
    const r: CalcResult = { label: "Rp:Rs", value: ratio.toFixed(2), interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines — operability assessment" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-rprs" title="Pulmonary-to-Systemic Resistance Ratio (Rp:Rs)" badge="Hemodynamics" color={BRAND}>
      <p className="text-xs text-gray-500 mb-3">Catheterization data required. PVR = (mPAP − PCWP) / Qp; SVR = (mAoP − CVP) / Qs.</p>
      <InputRow label="Mean PAP" unit="mmHg" value={mPAP} onChange={setMPAP} placeholder="e.g. 35" />
      <InputRow label="PCWP" unit="mmHg" value={pcwp} onChange={setPcwp} placeholder="e.g. 10" />
      <InputRow label="Qp" unit="L/min/m²" value={qp} onChange={setQp} placeholder="e.g. 5.0" />
      <InputRow label="Mean Aortic Pressure" unit="mmHg" value={mAoP} onChange={setMAoP} placeholder="e.g. 70" />
      <InputRow label="CVP / RAP" unit="mmHg" value={cvp} onChange={setCvp} placeholder="e.g. 5" />
      <InputRow label="Qs" unit="L/min/m²" value={qs} onChange={setQs} placeholder="e.g. 3.0" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Rp:Rs</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 11. Shortening Fraction ──────────────────────────────────────────────────
function ShorteningFraction({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [edd, setEdd] = useState("");
  const [esd, setEsd] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const d = parseFloat(edd);
    const s = parseFloat(esd);
    if (!d || !s || d <= 0 || s <= 0 || s >= d) return;
    const sf = ((d - s) / d) * 100;
    let interp = "";
    let normal = true;
    if (sf < 28) { interp = `SF ${sf.toFixed(1)}%: Reduced. Below normal range (28–44%). Suggests LV systolic dysfunction — consider dilated cardiomyopathy, anthracycline toxicity, myocarditis, or post-surgical dysfunction.`; normal = false; }
    else if (sf > 44) { interp = `SF ${sf.toFixed(1)}%: Hyperdynamic. Above normal range. Seen in sepsis, anemia, fever, or HOCM. Assess for outflow obstruction.`; normal = false; }
    else { interp = `SF ${sf.toFixed(1)}%: Normal LV systolic function (normal range 28–44%).`; }
    const r: CalcResult = { label: "Shortening Fraction", value: `${sf.toFixed(1)}%`, interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines — LV systolic function" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-sf" title="Shortening Fraction (SF) — Pediatric LV" badge="LV Function" color={BRAND}>
      <InputRow label="LVEDD" unit="cm" value={edd} onChange={setEdd} placeholder="e.g. 3.5" />
      <InputRow label="LVESD" unit="cm" value={esd} onChange={setEsd} placeholder="e.g. 2.3" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate SF</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 12. Bullet EF (5/6 AL Method) ───────────────────────────────────────────
function BulletEF({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [areaD, setAreaD] = useState("");
  const [areaS, setAreaS] = useState("");
  const [lengthD, setLengthD] = useState("");
  const [lengthS, setLengthS] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const ad = parseFloat(areaD);
    const as_ = parseFloat(areaS);
    const ld = parseFloat(lengthD);
    const ls = parseFloat(lengthS);
    if (!ad || !as_ || !ld || !ls || ad <= 0 || as_ <= 0 || ld <= 0 || ls <= 0) return;
    // Bullet method: V = (5/6) × A × L
    const edv = (5 / 6) * ad * ld;
    const esv = (5 / 6) * as_ * ls;
    const ef = ((edv - esv) / edv) * 100;
    let interp = "";
    let normal = true;
    if (ef < 55) { interp = `EF ${ef.toFixed(1)}% (EDV ${edv.toFixed(1)} mL, ESV ${esv.toFixed(1)} mL): Reduced EF. Below normal (≥55%). Suggests systolic dysfunction — evaluate for cardiomyopathy, myocarditis, or post-surgical dysfunction. Serial monitoring recommended.`; normal = false; }
    else if (ef >= 55 && ef < 70) { interp = `EF ${ef.toFixed(1)}% (EDV ${edv.toFixed(1)} mL, ESV ${esv.toFixed(1)} mL): Normal LV systolic function by Bullet method (5/6 AL).`; }
    else { interp = `EF ${ef.toFixed(1)}% (EDV ${edv.toFixed(1)} mL, ESV ${esv.toFixed(1)} mL): Hyperdynamic. EF >70% — consider volume depletion, high-output state, or HOCM with cavity obliteration.`; normal = false; }
    const r: CalcResult = { label: "Bullet EF (5/6 AL)", value: `${ef.toFixed(1)}%`, interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines — Bullet method (5/6 × Area × Length)" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-bullet-ef" title="Bullet EF — 5/6 AL Method" badge="LV Function" color={BRAND}>
      <p className="text-xs text-gray-500 mb-3">Trace LV endocardial border in apical 4-chamber view at end-diastole and end-systole. Measure longest LV length in same view.</p>
      <InputRow label="LV Area (Diastole)" unit="cm²" value={areaD} onChange={setAreaD} placeholder="e.g. 18.5" />
      <InputRow label="LV Length (Diastole)" unit="cm" value={lengthD} onChange={setLengthD} placeholder="e.g. 6.0" />
      <InputRow label="LV Area (Systole)" unit="cm²" value={areaS} onChange={setAreaS} placeholder="e.g. 10.2" />
      <InputRow label="LV Length (Systole)" unit="cm" value={lengthS} onChange={setLengthS} placeholder="e.g. 5.5" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Bullet EF</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 13. Tei Index (MPI) — Pediatric ─────────────────────────────────────────
function PediatricTeiIndex({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [chamber, setChamber] = useState<"lv" | "rv">("lv");
  const [ict, setIct] = useState("");
  const [irt, setIrt] = useState("");
  const [et, setEt] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const i = parseFloat(ict);
    const r = parseFloat(irt);
    const e = parseFloat(et);
    if (!i || !r || !e || e <= 0) return;
    const tei = (i + r) / e;
    const normalLV = 0.40;
    const normalRV = 0.50;
    const limit = chamber === "lv" ? normalLV : normalRV;
    const label = chamber === "lv" ? "LV" : "RV";
    let interp = "";
    let normal = true;
    if (tei > limit) { interp = `${label} Tei Index ${tei.toFixed(2)}: Elevated (normal <${limit}). Global myocardial dysfunction — both systolic and diastolic components affected. Consider cardiomyopathy, myocarditis, or post-operative dysfunction.`; normal = false; }
    else { interp = `${label} Tei Index ${tei.toFixed(2)}: Normal global myocardial performance (normal <${limit}).`; }
    const res: CalcResult = { label: `${label} Tei Index (MPI)`, value: tei.toFixed(2), interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines — global myocardial performance" };
    setResult(res);
    onResult(res);
  };

  return (
    <CalcCard id="engine-tei-ped" title="Tei Index (MPI) — Pediatric LV & RV" badge="Global Function" color={BRAND}>
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-600 block mb-1">Chamber</label>
        <div className="flex gap-2">
          {(["lv", "rv"] as const).map((c) => (
            <button key={c} onClick={() => setChamber(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${chamber === c ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={chamber === c ? { background: BRAND } : {}}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <InputRow label="ICT" unit="ms" value={ict} onChange={setIct} placeholder="e.g. 35" />
      <InputRow label="IRT" unit="ms" value={irt} onChange={setIrt} placeholder="e.g. 40" />
      <InputRow label="ET" unit="ms" value={et} onChange={setEt} placeholder="e.g. 220" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Tei Index</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 14. TAPSE Z-Score ────────────────────────────────────────────────────────
function TAPSEZScore({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [bsa, setBsa] = useState("");
  const [tapse, setTapse] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const b = parseFloat(bsa);
    const t = parseFloat(tapse);
    if (!b || !t || b <= 0 || t <= 0) return;
    // Koestenberger 2009: predicted TAPSE (mm) = 12.7 + 10.7*BSA
    const predicted = 12.7 + 10.7 * b;
    const sd = 2.5 + 1.5 * b;
    const z = (t - predicted) / sd;
    let interp = "";
    let normal = true;
    if (z <= -2) { interp = `TAPSE Z-score ${z.toFixed(2)}: Reduced RV longitudinal function. Z ≤−2 indicates RV systolic dysfunction. Common post-cardiac surgery, in pulmonary hypertension, or Ebstein's anomaly. Serial monitoring recommended.`; normal = false; }
    else { interp = `TAPSE Z-score ${z.toFixed(2)}: Normal RV longitudinal function for BSA.`; }
    const r: CalcResult = { label: "TAPSE Z-Score", value: z.toFixed(2), interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines; Koestenberger 2009 nomogram" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-tapse-z" title="TAPSE Z-Score — RV Longitudinal Function" badge="RV Function" color={BRAND}>
      <InputRow label="BSA" unit="m²" value={bsa} onChange={setBsa} placeholder="e.g. 0.85" />
      <InputRow label="TAPSE" unit="mm" value={tapse} onChange={setTapse} placeholder="e.g. 18" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Z-Score</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 15. RV FAC ───────────────────────────────────────────────────────────────
function RVFACCalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [edArea, setEdArea] = useState("");
  const [esArea, setEsArea] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const ed = parseFloat(edArea);
    const es = parseFloat(esArea);
    if (!ed || !es || ed <= 0 || es <= 0 || es >= ed) return;
    const fac = ((ed - es) / ed) * 100;
    let interp = "";
    let normal = true;
    if (fac < 35) { interp = `RV FAC ${fac.toFixed(1)}%: Reduced. Below normal (≥35%). Indicates RV systolic dysfunction. Common post-cardiac surgery, in pulmonary hypertension, Ebstein's anomaly, or RV infarction.`; normal = false; }
    else { interp = `RV FAC ${fac.toFixed(1)}%: Normal RV systolic function (normal ≥35%).`; }
    const r: CalcResult = { label: "RV FAC", value: `${fac.toFixed(1)}%`, interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines — RV function" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-rv-fac" title="Fractional Area Change (FAC) — RV" badge="RV Function" color={BRAND}>
      <InputRow label="RV ED Area" unit="cm²" value={edArea} onChange={setEdArea} placeholder="e.g. 12.0" />
      <InputRow label="RV ES Area" unit="cm²" value={esArea} onChange={setEsArea} placeholder="e.g. 7.5" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate RV FAC</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 16. Nakata Index ─────────────────────────────────────────────────────────
function NakataIndex({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [rpaD, setRpaD] = useState("");
  const [lpaD, setLpaD] = useState("");
  const [bsa, setBsa] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const r = parseFloat(rpaD);
    const l = parseFloat(lpaD);
    const b = parseFloat(bsa);
    if (!r || !l || !b || b <= 0) return;
    const rpaArea = Math.PI * Math.pow(r / 2, 2);
    const lpaArea = Math.PI * Math.pow(l / 2, 2);
    const nakata = (rpaArea + lpaArea) / b;
    let interp = "";
    let normal = true;
    if (nakata < 150) { interp = `Nakata Index ${nakata.toFixed(0)} mm²/m²: Severely reduced. Below 150 mm²/m² — PA branches too small for primary repair. Staged palliation (BT shunt, unifocalization) required before definitive repair.`; normal = false; }
    else if (nakata >= 150 && nakata < 330) { interp = `Nakata Index ${nakata.toFixed(0)} mm²/m²: Borderline. 150–330 mm²/m² — repair may be feasible but with higher risk. Careful surgical planning required.`; normal = false; }
    else { interp = `Nakata Index ${nakata.toFixed(0)} mm²/m²: Adequate (≥330 mm²/m²). PA size sufficient for complete repair of TOF or pulmonary atresia.`; }
    const res: CalcResult = { label: "Nakata Index", value: `${nakata.toFixed(0)} mm²/m²`, interpretation: interp, normal, guideline: "Nakata 1984; ASE 2016 Pediatric Echo Guidelines — TOF repair candidacy" };
    setResult(res);
    onResult(res);
  };

  return (
    <CalcCard id="engine-nakata" title="Nakata Index — PA Size for TOF Repair" badge="Congenital" color={BRAND}>
      <InputRow label="RPA Diameter" unit="mm" value={rpaD} onChange={setRpaD} placeholder="e.g. 8.0" />
      <InputRow label="LPA Diameter" unit="mm" value={lpaD} onChange={setLpaD} placeholder="e.g. 7.5" />
      <InputRow label="BSA" unit="m²" value={bsa} onChange={setBsa} placeholder="e.g. 0.85" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Nakata Index</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 17. McGoon Ratio ─────────────────────────────────────────────────────────
function McGoonRatio({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [rpaD, setRpaD] = useState("");
  const [lpaD, setLpaD] = useState("");
  const [daoD, setDaoD] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const r = parseFloat(rpaD);
    const l = parseFloat(lpaD);
    const d = parseFloat(daoD);
    if (!r || !l || !d || d <= 0) return;
    const mcgoon = (r + l) / d;
    let interp = "";
    let normal = true;
    if (mcgoon < 1.5) { interp = `McGoon Ratio ${mcgoon.toFixed(2)}: Inadequate PA size. <1.5 — high risk for complete repair. Staged palliation recommended. Unifocalization may be required for PA atresia with MAPCAs.`; normal = false; }
    else if (mcgoon >= 1.5 && mcgoon < 2.0) { interp = `McGoon Ratio ${mcgoon.toFixed(2)}: Borderline adequate. 1.5–2.0 — repair feasible but with increased risk. Careful hemodynamic assessment required.`; normal = false; }
    else { interp = `McGoon Ratio ${mcgoon.toFixed(2)}: Adequate (≥2.0). PA branches sufficient for complete repair of TOF or pulmonary atresia.`; }
    const res: CalcResult = { label: "McGoon Ratio", value: mcgoon.toFixed(2), interpretation: interp, normal, guideline: "McGoon 1975; ASE 2016 Pediatric Echo Guidelines — PA adequacy" };
    setResult(res);
    onResult(res);
  };

  return (
    <CalcCard id="engine-mcgoon" title="McGoon Ratio — PA Adequacy" badge="Congenital" color={BRAND}>
      <InputRow label="RPA Diameter" unit="mm" value={rpaD} onChange={setRpaD} placeholder="e.g. 8.0" />
      <InputRow label="LPA Diameter" unit="mm" value={lpaD} onChange={setLpaD} placeholder="e.g. 7.5" />
      <InputRow label="Descending Aorta Diameter" unit="mm" value={daoD} onChange={setDaoD} placeholder="e.g. 10.0" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate McGoon Ratio</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 18. Coarctation Gradient ─────────────────────────────────────────────────
function CoarctationGradient({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [vmax, setVmax] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const v = parseFloat(vmax);
    if (!v || v <= 0) return;
    const gradient = 4 * v * v;
    let interp = "";
    let normal = true;
    if (gradient < 20) { interp = `Peak gradient ${gradient.toFixed(0)} mmHg: Mild. <20 mmHg — hemodynamically insignificant. Monitor with serial echo. Assess for collateral flow (may underestimate severity).`; }
    else if (gradient >= 20 && gradient < 40) { interp = `Peak gradient ${gradient.toFixed(0)} mmHg: Moderate. 20–40 mmHg — significant CoA. Intervention (catheter-based or surgical) should be considered, especially with hypertension or LV hypertrophy.`; normal = false; }
    else { interp = `Peak gradient ${gradient.toFixed(0)} mmHg: Severe. ≥40 mmHg — significant coarctation requiring intervention. Assess for associated bicuspid AV, intracranial aneurysms, and LV function.`; normal = false; }
    const r: CalcResult = { label: "CoA Peak Gradient", value: `${gradient.toFixed(0)} mmHg`, interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines — CoA assessment" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-coa" title="Coarctation Gradient Estimator" badge="Congenital" color={BRAND}>
      <p className="text-xs text-gray-500 mb-3">Use CW Doppler from suprasternal notch. Note: collateral flow may underestimate gradient — use diastolic tail pattern as additional marker.</p>
      <InputRow label="CoA Vmax" unit="m/s" value={vmax} onChange={setVmax} placeholder="e.g. 3.5" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate Gradient</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 19. Pediatric AVA (Gorlin-derived) ───────────────────────────────────────
function PediatricAVA({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [vtiAV, setVtiAV] = useState("");
  const [vtiLVOT, setVtiLVOT] = useState("");
  const [lvotD, setLvotD] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);

  const calculate = () => {
    const va = parseFloat(vtiAV);
    const vl = parseFloat(vtiLVOT);
    const ld = parseFloat(lvotD);
    if (!va || !vl || !ld || va <= 0 || vl <= 0 || ld <= 0) return;
    const lvotArea = Math.PI * Math.pow(ld / 2, 2);
    const ava = (lvotArea * vl) / va;
    let interp = "";
    let normal = true;
    if (ava < 0.5) { interp = `AVA ${ava.toFixed(2)} cm²: Severe AS. Critical aortic stenosis in pediatric patients — urgent intervention (balloon valvuloplasty or surgical valvotomy) indicated. Assess LV function and gradient carefully.`; normal = false; }
    else if (ava >= 0.5 && ava < 0.75) { interp = `AVA ${ava.toFixed(2)} cm²: Moderate-to-severe AS. Close follow-up with serial echo every 6–12 months. Consider intervention if symptomatic or LV dysfunction develops.`; normal = false; }
    else if (ava >= 0.75 && ava < 1.0) { interp = `AVA ${ava.toFixed(2)} cm²: Moderate AS. Annual echo surveillance. Restrict competitive sports.`; normal = false; }
    else { interp = `AVA ${ava.toFixed(2)} cm²: Mild AS or normal. Routine follow-up.`; }
    const r: CalcResult = { label: "Pediatric AVA (Continuity)", value: `${ava.toFixed(2)} cm²`, interpretation: interp, normal, guideline: "ASE 2016 Pediatric Echo Guidelines — congenital AS severity" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-ped-ava" title="Aortic Valve Area — Pediatric (Continuity Equation)" badge="Congenital" color={BRAND}>
      <InputRow label="AV VTI" unit="cm" value={vtiAV} onChange={setVtiAV} placeholder="e.g. 80" />
      <InputRow label="LVOT VTI" unit="cm" value={vtiLVOT} onChange={setVtiLVOT} placeholder="e.g. 22" />
      <InputRow label="LVOT Diameter" unit="cm" value={lvotD} onChange={setLvotD} placeholder="e.g. 1.5" />
      <Button onClick={calculate} className="text-white w-full mt-2" style={{ background: BRAND }}>Calculate AVA</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── 20. Ross Score ───────────────────────────────────────────────────────────
const rossItems = [
  { id: "diaphoresis", label: "Diaphoresis while feeding", points: 1 },
  { id: "tachypnea", label: "Tachypnea at rest", points: 1 },
  { id: "tachycardia", label: "Tachycardia at rest", points: 1 },
  { id: "gallop", label: "Gallop rhythm", points: 1 },
  { id: "hepatomegaly_mild", label: "Hepatomegaly 2–3 cm below RCM", points: 1 },
  { id: "hepatomegaly_severe", label: "Hepatomegaly >3 cm below RCM", points: 2 },
  { id: "rales", label: "Pulmonary rales / wheezing", points: 1 },
  { id: "decreased_perfusion", label: "Decreased peripheral perfusion", points: 1 },
  { id: "feeding_time", label: "Feeding time >40 min or poor feeding", points: 2 },
  { id: "failure_to_thrive", label: "Failure to thrive (<10th percentile)", points: 2 },
];

function RossScore({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<CalcResult | null>(null);

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const calculate = () => {
    const score = rossItems.reduce((sum, item) => sum + (checked[item.id] ? item.points : 0), 0);
    let interp = "";
    let normal = true;
    if (score === 0) { interp = `Ross Score ${score}/12: No heart failure. No clinical signs of HF present.`; }
    else if (score >= 1 && score <= 2) { interp = `Ross Score ${score}/12: Mild heart failure. Outpatient management appropriate. Optimize diuretic therapy and feeding.`; normal = false; }
    else if (score >= 3 && score <= 6) { interp = `Ross Score ${score}/12: Moderate heart failure. Intensify medical therapy. Consider hospital admission if not improving. Evaluate underlying CHD etiology.`; normal = false; }
    else { interp = `Ross Score ${score}/12: Severe heart failure. Hospital admission indicated. Urgent cardiology evaluation. Consider inotropic support and surgical/catheter intervention planning.`; normal = false; }
    const r: CalcResult = { label: "Ross Score", value: `${score}/12`, interpretation: interp, normal, guideline: "Ross 1992; Modified Ross Heart Failure Score for Infants" };
    setResult(r);
    onResult(r);
  };

  return (
    <CalcCard id="engine-ross" title="Ross Score — Infant Heart Failure" badge="HF Severity" color={BRAND}>
      <p className="text-xs text-gray-500 mb-3">Check all signs present. Score 0 = no HF; 1–2 = mild; 3–6 = moderate; 7–12 = severe.</p>
      <div className="space-y-2 mb-4">
        {rossItems.map((item) => (
          <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={!!checked[item.id]} onChange={() => toggle(item.id)} className="w-4 h-4 rounded accent-red-500 cursor-pointer" />
            <span className="text-sm text-gray-700 flex-1">{item.label}</span>
            <span className="text-xs font-bold text-gray-400">+{item.points}</span>
          </label>
        ))}
      </div>
      <Button onClick={calculate} className="text-white w-full" style={{ background: BRAND }}>Calculate Ross Score</Button>
      <ResultBox result={result} source="PediatricEchoAssist™" />
    </CalcCard>
  );
}

// ─── PDF Report Generator ─────────────────────────────────────────────────────
async function generatePDFReport(
  results: Record<string, CalcResult>,
  studyInfo: { age: string; weight: string; bsa: string; date: string; operator: string; indication: string }
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const TEAL = [24, 154, 161] as [number, number, number];
  const NAVY_RGB = [14, 30, 46] as [number, number, number];
  const LIGHT_TEAL = [240, 251, 252] as [number, number, number];
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  // Header
  doc.setFillColor(...NAVY_RGB);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setFillColor(...TEAL);
  doc.rect(0, 28, pageW, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PediatricEchoAssist\u2122 Clinical Report", margin, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Pediatric & Congenital Echo Calculator Engine \u2014 ASE 2016 Guideline-Based Feedback", margin, 21);
  doc.text("iHeartEcho\u2122 | All About Ultrasound | www.iheartecho.com", margin, 27);
  y = 38;

  // Study Info
  doc.setFillColor(...LIGHT_TEAL);
  doc.roundedRect(margin, y, contentW, 28, 2, 2, "F");
  doc.setTextColor(...NAVY_RGB);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Study Information", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const col1x = margin + 4;
  const col2x = margin + contentW / 2;
  const infoY = y + 12;
  doc.text(`Age: ${studyInfo.age || "\u2014"}`, col1x, infoY);
  doc.text(`Study Date: ${studyInfo.date || new Date().toLocaleDateString()}`, col2x, infoY);
  doc.text(`Weight: ${studyInfo.weight || "\u2014"} kg  |  BSA: ${studyInfo.bsa || "\u2014"} m\u00B2`, col1x, infoY + 7);
  if (studyInfo.operator) doc.text(`Operator: ${studyInfo.operator}`, col2x, infoY + 7);
  if (studyInfo.indication) doc.text(`Indication: ${studyInfo.indication}`, col1x, infoY + 14);
  y += 34;

  // Results
  const resultEntries = Object.values(results);
  if (resultEntries.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(10);
    doc.text("No calculator results recorded.", margin, y + 10);
    y += 20;
  } else {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY_RGB);
    doc.text("Calculator Results", margin, y + 8);
    y += 14;

    for (const r of resultEntries) {
      const isAbnormal = r.normal === false;
      const rowH = 22 + Math.ceil(doc.splitTextToSize(r.interpretation, contentW - 8).length * 4.5);
      if (y + rowH > 270) {
        doc.addPage();
        y = 15;
      }
      doc.setFillColor(isAbnormal ? 254 : 240, isAbnormal ? 242 : 251, isAbnormal ? 242 : 252);
      doc.roundedRect(margin, y, contentW, rowH, 2, 2, "F");
      doc.setFillColor(isAbnormal ? 220 : 24, isAbnormal ? 38 : 154, isAbnormal ? 38 : 161);
      doc.rect(margin, y, 3, rowH, "F");
      doc.setTextColor(...NAVY_RGB);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${r.label}: ${r.value}`, margin + 6, y + 6);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(isAbnormal ? 153 : 17, isAbnormal ? 27 : 94, isAbnormal ? 27 : 94);
      doc.text(isAbnormal ? "ABNORMAL" : r.normal === true ? "NORMAL" : "INFORMATIONAL", margin + contentW - 4, y + 6, { align: "right" });
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(7.5);
      const lines = doc.splitTextToSize(r.interpretation, contentW - 8);
      doc.text(lines, margin + 6, y + 12);
      if (r.guideline) {
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(6.5);
        doc.text(r.guideline, margin + 6, y + rowH - 3);
      }
      y += rowH + 3;
    }
  }

  // Summary
  const abnormalCount = resultEntries.filter((r) => r.normal === false).length;
  if (y + 30 > 270) { doc.addPage(); y = 15; }
  doc.setFillColor(...NAVY_RGB);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Summary: ${resultEntries.length} calculator(s) completed — ${abnormalCount} abnormal result(s)`, margin + 4, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("This report is generated for educational and clinical decision-support purposes only. Not a substitute for clinical judgment.", margin + 4, y + 15);
  doc.text("All values should be interpreted in the context of the complete clinical picture.", margin + 4, y + 19);

  doc.save(`PediatricEchoAssist_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PediatricEchoAssist() {
  const search = useSearch();
  const [results, setResults] = useState<Record<string, CalcResult>>({});
  const [studyAge, setStudyAge] = useState("");
  const [studyWeight, setStudyWeight] = useState("");
  const [studyBSA, setStudyBSA] = useState("");
  const [studyDate, setStudyDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [studyOperator, setStudyOperator] = useState("");
  const [studyIndication, setStudyIndication] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const engine = new URLSearchParams(search).get("engine");
    if (engine) {
      setTimeout(() => {
        const el = document.getElementById(engine);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [search]);

  const makeOnResult = useCallback((key: string) => (r: CalcResult | null) => {
    setResults((prev) => {
      if (r === null) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key]?.value === r.value && prev[key]?.interpretation === r.interpretation) return prev;
      return { ...prev, [key]: r };
    });
  }, []);

  const resultCount = Object.keys(results).length;
  const hasAbnormal = Object.values(results).some((r) => r.normal === false);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      await generatePDFReport(results, {
        age: studyAge,
        weight: studyWeight,
        bsa: studyBSA,
        date: studyDate,
        operator: studyOperator,
        indication: studyIndication,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const engines = [
    { id: "engine-bsa",        title: "BSA Calculator",                              badge: "Growth",        color: BRAND,     key: "bsa",        component: (fn: (r: CalcResult | null) => void) => <BSACalculator onResult={fn} /> },
    { id: "engine-zscore-ao",  title: "Z-Score — Aortic Root",                       badge: "Z-Score",       color: BRAND, key: "zscore_ao",  component: (fn: (r: CalcResult | null) => void) => <ZScoreAorticRoot onResult={fn} /> },
    { id: "engine-zscore-pa",  title: "Z-Score — Pulmonary Annulus",                 badge: "Z-Score",       color: BRAND, key: "zscore_pa",  component: (fn: (r: CalcResult | null) => void) => <ZScorePulmonaryAnnulus onResult={fn} /> },
    { id: "engine-zscore-mv",  title: "Z-Score — Mitral Annulus",                    badge: "Z-Score",       color: BRAND, key: "zscore_mv",  component: (fn: (r: CalcResult | null) => void) => <ZScoreMitralAnnulus onResult={fn} /> },
    { id: "engine-zscore-tv",  title: "Z-Score — Tricuspid Annulus",                 badge: "Z-Score",       color: BRAND, key: "zscore_tv",  component: (fn: (r: CalcResult | null) => void) => <ZScoreTricuspidAnnulus onResult={fn} /> },
    { id: "engine-zscore-lvedd", title: "Z-Score — LVEDD",                           badge: "Z-Score",       color: BRAND, key: "zscore_lvedd", component: (fn: (r: CalcResult | null) => void) => <ZScoreLVEDD onResult={fn} /> },
    { id: "engine-coronary-zscore", title: "Coronary Z-Score (Kawasaki)",            badge: "Kawasaki",      color: BRAND, key: "coronary_z", component: (fn: (r: CalcResult | null) => void) => <CoronaryZScore onResult={fn} /> },
    { id: "engine-qpqs",       title: "Qp:Qs Shunt Ratio",                           badge: "Shunt",         color: BRAND, key: "qpqs",       component: (fn: (r: CalcResult | null) => void) => <QpQsCalculator onResult={fn} /> },
    { id: "engine-rvsp",       title: "RVSP via TR Jet",                             badge: "Hemodynamics",  color: BRAND, key: "rvsp",       component: (fn: (r: CalcResult | null) => void) => <RVSPCalculator onResult={fn} /> },
    { id: "engine-rprs",       title: "Rp:Rs Resistance Ratio",                      badge: "Hemodynamics",  color: BRAND, key: "rprs",       component: (fn: (r: CalcResult | null) => void) => <RpRsCalculator onResult={fn} /> },
    { id: "engine-sf",         title: "Shortening Fraction — Pediatric LV",          badge: "LV Function",   color: BRAND,     key: "sf",         component: (fn: (r: CalcResult | null) => void) => <ShorteningFraction onResult={fn} /> },
    { id: "engine-bullet-ef",  title: "Bullet EF — 5/6 AL Method",                  badge: "LV Function",   color: BRAND,     key: "bullet_ef",  component: (fn: (r: CalcResult | null) => void) => <BulletEF onResult={fn} /> },
    { id: "engine-tei-ped",    title: "Tei Index (MPI) — Pediatric",                 badge: "Global Fn",     color: BRAND, key: "tei_ped",    component: (fn: (r: CalcResult | null) => void) => <PediatricTeiIndex onResult={fn} /> },
    { id: "engine-tapse-z",    title: "TAPSE Z-Score",                               badge: "RV Function",   color: BRAND,     key: "tapse_z",    component: (fn: (r: CalcResult | null) => void) => <TAPSEZScore onResult={fn} /> },
    { id: "engine-rv-fac",     title: "RV FAC",                                      badge: "RV Function",   color: BRAND,     key: "rv_fac",     component: (fn: (r: CalcResult | null) => void) => <RVFACCalculator onResult={fn} /> },
    { id: "engine-nakata",     title: "Nakata Index",                                badge: "Congenital",    color: BRAND, key: "nakata",     component: (fn: (r: CalcResult | null) => void) => <NakataIndex onResult={fn} /> },
    { id: "engine-mcgoon",     title: "McGoon Ratio",                                badge: "Congenital",    color: BRAND, key: "mcgoon",     component: (fn: (r: CalcResult | null) => void) => <McGoonRatio onResult={fn} /> },
    { id: "engine-coa",        title: "Coarctation Gradient",                        badge: "Congenital",    color: BRAND, key: "coa",        component: (fn: (r: CalcResult | null) => void) => <CoarctationGradient onResult={fn} /> },
    { id: "engine-ped-ava",    title: "Pediatric AVA (Continuity Equation)",         badge: "Congenital",    color: BRAND, key: "ped_ava",    component: (fn: (r: CalcResult | null) => void) => <PediatricAVA onResult={fn} /> },
    { id: "engine-ross",       title: "Ross Score — Infant Heart Failure",           badge: "HF Severity",   color: BRAND, key: "ross",       component: (fn: (r: CalcResult | null) => void) => <RossScore onResult={fn} /> },
  ];

  return (
    <Layout>
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0e4a50 60%, ${BRAND} 100%)` }}
      >
        <div className="relative container py-10 md:py-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
              <span className="text-xs text-white/80 font-medium">Guideline-Based Pediatric Echo Assessment</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Baby className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                  PediatricEchoAssist™
                </h1>
                <p className="text-[#4ad9e0] font-semibold text-sm">Pediatric & Congenital Echo Calculator Engine</p>
              </div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed max-w-lg">
              20 guideline-based calculators covering BSA, Z-scores, shunt quantification, ventricular function, Kawasaki coronary assessment, and congenital heart disease metrics. Generate a consolidated PDF report of all results.
            </p>
          </div>
        </div>
      </div>

      {/* Engine count bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="container py-3">
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            {[
              { icon: Users, label: "7 Z-Score Calculators" },
              { icon: Activity, label: "3 Hemodynamic Tools" },
              { icon: Heart, label: "5 Function Assessments" },
              { icon: Stethoscope, label: "5 Congenital-Specific" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" style={{ color: BRAND }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-8">
        <PremiumGate featureName="PediatricEchoAssist™ Calculator Engine">
          {/* Study Info Panel */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" style={{ color: BRAND }} />
              <h2 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>Study Information</h2>
              <span className="text-xs text-gray-400 ml-1">(optional — appears in PDF report)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Patient Age</label>
                <input type="text" value={studyAge} onChange={(e) => setStudyAge(e.target.value)} placeholder="e.g. 6 months, 4 years" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Weight (kg)</label>
                <input type="number" value={studyWeight} onChange={(e) => setStudyWeight(e.target.value)} placeholder="e.g. 8.5" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">BSA (m²)</label>
                <input type="number" value={studyBSA} onChange={(e) => setStudyBSA(e.target.value)} placeholder="e.g. 0.42" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Study Date</label>
                <input type="date" value={studyDate} onChange={(e) => setStudyDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Operator / Sonographer</label>
                <input type="text" value={studyOperator} onChange={(e) => setStudyOperator(e.target.value)} placeholder="Name or initials" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Clinical Indication</label>
                <input type="text" value={studyIndication} onChange={(e) => setStudyIndication(e.target.value)} placeholder="e.g. Kawasaki disease, TOF follow-up" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>
            </div>
          </div>

          {/* Results summary bar */}
          {resultCount > 0 && (
            <div className={`rounded-xl border p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${hasAbnormal ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {hasAbnormal
                    ? <AlertCircle className="w-4 h-4 text-red-600" />
                    : <Activity className="w-4 h-4 text-green-600" />}
                  <span className={`font-bold text-sm ${hasAbnormal ? "text-red-700" : "text-green-700"}`}>
                    {resultCount} calculator{resultCount !== 1 ? "s" : ""} completed
                    {hasAbnormal ? ` — ${Object.values(results).filter(r => r.normal === false).length} abnormal result(s)` : " — all within normal limits"}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Generate a consolidated PDF report with all results and ASE guideline interpretations.</p>
              </div>
              <Button
                onClick={handleGeneratePDF}
                disabled={isGenerating || resultCount === 0}
                className="text-white flex-shrink-0 flex items-center gap-2"
                style={{ background: BRAND }}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {isGenerating ? "Generating…" : "Generate PDF Report"}
              </Button>
            </div>
          )}

          {/* Quick-jump nav */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4" style={{ color: BRAND }} />
              <span className="text-xs font-bold text-gray-600">Quick Jump</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {engines.map(({ id, title, color }) => (
                <button
                  key={id}
                  onClick={() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className="text-xs px-2.5 py-1 rounded-full border font-medium transition-all hover:opacity-80"
                  style={{ borderColor: color + "40", color, background: color + "10" }}
                >
                  {title.split("—")[0].split("(")[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Calculator grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {engines.map(({ key, component }) => (
              <div key={key}>
                {component(makeOnResult(key))}
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="mt-8 rounded-xl p-4 border border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>Clinical Disclaimer:</strong> PediatricEchoAssist™ is an educational and clinical decision-support tool. All results must be interpreted in the context of the complete clinical picture, patient history, and direct physician assessment. Z-score nomograms are based on published reference datasets and may vary by institution. This tool does not replace formal echocardiographic reporting or clinical judgment.
            </p>
            <p className="text-xs text-gray-400 mt-1">References: ASE 2016 Pediatric Echo Guidelines · AHA Kawasaki Disease 2017 Scientific Statement · Daubeney, Kampmann, Koestenberger, Dallaire nomograms</p>
          </div>
        </PremiumGate>
      </div>
    </Layout>
  );
}
