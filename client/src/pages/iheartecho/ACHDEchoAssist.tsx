/*
  ACHDEchoAssist™ — iHeartEcho™
  Adult Congenital Heart Disease Echo Calculator Engine
  Guidelines: ASE 2010 ACHD Echo (Silversides et al.), ESC 2020 ACHD, ACC/AHA 2018 ACHD,
              ASE 2019 Multimodality Imaging in ACHD, ACC/AHA 2014 ASD/VSD Guidelines
  Brand: Teal #189aa1, Aqua #4ad9e0, Navy #0e1e2e
*/

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import Layout from "@/components/Layout";
import { PremiumGate } from "@/components/PremiumGate";
import { CopyToReportButton } from "@/components/CopyToReportButton";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertCircle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Crown,
  Download,
  FileText,
  Heart,
  Info,
  Lightbulb,
  MessageSquare,
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";
const NAVY = "#0e1e2e";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface CalcResult {
  name: string;
  value: string;
  interpretation: string;
  normal: boolean | null;
  suggests?: string;
}

// ─── UI Primitives ─────────────────────────────────────────────────────────────
function InputRow({
  label, unit, value, onChange, placeholder, hint,
}: {
  label: string; unit?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600">
        {label}{unit && <span className="font-normal text-gray-400 ml-1">({unit})</span>}
      </label>
      <input
        type="number" step="any" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
      />
      {hint && <p className="text-[10px] text-gray-400 leading-tight">{hint}</p>}
    </div>
  );
}

function MetricBadge({ label, value, normal }: { label: string; value: string; normal?: boolean | null }) {
  const color = normal === null || normal === undefined ? "#6b7280" : normal ? "#16a34a" : "#dc2626";
  const bg = normal === null || normal === undefined ? "#f3f4f6" : normal ? "#dcfce7" : "#fee2e2";
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg" style={{ background: bg }}>
      <span className="text-[10px] text-gray-500 font-medium">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function ResultPanel({ suggests, note, tip }: { suggests?: string; note?: string; tip?: string }) {
  if (!suggests && !note && !tip) return null;
  return (
    <div className="mt-4 space-y-2">
      {suggests && (
        <div className="flex gap-2 p-3 rounded-lg" style={{ background: BRAND + "12", borderLeft: `3px solid ${BRAND}` }}>
          <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
          <p className="text-xs leading-relaxed text-gray-700">{suggests}</p>
        </div>
      )}
      {note && (
        <div className="flex gap-2 p-3 rounded-lg" style={{ background: BRAND + "12", borderLeft: `3px solid ${BRAND}` }}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#189aa1]" />
          <p className="text-xs leading-relaxed text-gray-700">{note}</p>
        </div>
      )}
      {tip && (
        <div className="flex gap-2 p-3 rounded-lg bg-amber-50" style={{ borderLeft: "3px solid #d97706" }}>
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
          <p className="text-xs leading-relaxed text-gray-700">{tip}</p>
        </div>
      )}
    </div>
  );
}

// ─── Engine Wrapper ────────────────────────────────────────────────────────────
function EngineSection({
  id, title, badge, badgeColor, children, result, source,
}: {
  id: string; title: string; badge: string; badgeColor: string;
  children: React.ReactNode; result?: CalcResult | null; source?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const search = useSearch();

  useEffect(() => {
    const detail = new URLSearchParams(search).get("engine") ?? "";
    if (detail === id) {
      setOpen(true);
      setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  }, [search, id]);

  return (
    <div id={id} ref={ref} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: badgeColor + "20" }}>
          <Calculator className="w-4 h-4" style={{ color: badgeColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{title}</span>
          <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badgeColor + "18", color: badgeColor }}>{badge}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {result && source && (
            <CopyToReportButton
              source={source}
              calculator={result.name}
              label={`${result.name}: ${result.value}`}
              result={`${result.value} — ${result.interpretation}`}
              interpretation={result.suggests ?? result.interpretation}
            />
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-50">{children}</div>}
    </div>
  );
}

// ─── 1. Qp:Qs Shunt Ratio (ACHD) ──────────────────────────────────────────────
function QpQsACHD({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [rvot, setRvot] = useState("");
  const [lvot, setLvot] = useState("");
  const [rvotVti, setRvotVti] = useState("");
  const [lvotVti, setLvotVti] = useState("");

  const d1 = parseFloat(rvot), d2 = parseFloat(lvot);
  const v1 = parseFloat(rvotVti), v2 = parseFloat(lvotVti);
  const valid = d1 > 0 && d2 > 0 && v1 > 0 && v2 > 0;

  const qpqs = valid ? ((Math.PI / 4) * d1 * d1 * v1) / ((Math.PI / 4) * d2 * d2 * v2) : null;
  const normal = qpqs !== null ? qpqs < 1.5 : null;

  const severity = qpqs === null ? null
    : qpqs < 1.5 ? "Not hemodynamically significant (Qp:Qs < 1.5)"
    : qpqs < 2.0 ? "Mild-moderate shunt (Qp:Qs 1.5–2.0)"
    : "Large shunt — intervention threshold (Qp:Qs ≥ 2.0)";

  const suggests = qpqs !== null
    ? `ACHDEchoAssist™ Suggests: Qp:Qs = ${qpqs.toFixed(2)}. ${severity}. ${
        qpqs < 1.5 ? "Shunt is not hemodynamically significant by Doppler criteria. Clinical correlation with symptoms and RV size required."
        : qpqs < 2.0 ? "Mild-moderate shunt. Evaluate RV size and function. Consider closure if symptomatic or RV volume overload present (ACC/AHA 2014)."
        : "Large left-to-right shunt. RV volume overload likely. Closure is indicated if Rp:Rs < 0.3 and no severe pulmonary hypertension (ACC/AHA 2014 Class I)."
      }`
    : undefined;

  const note = qpqs !== null
    ? "ACHDEchoAssist™ Note: Qp:Qs ≥ 1.5 with RV volume overload supports ASD/VSD closure. Qp:Qs ≥ 2.0 is a Class I indication. Ensure absence of severe pulmonary hypertension before closure (Rp:Rs < 0.3)."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Measure RVOT and LVOT diameters in systole from the parasternal long-axis view. Obtain VTI from pulsed-wave Doppler at the annular level. Avoid measuring in the presence of significant valve regurgitation.";

  useEffect(() => {
    if (qpqs !== null) {
      onResult({ name: "Qp:Qs Shunt Ratio", value: qpqs.toFixed(2), interpretation: severity!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [qpqs, severity, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="RVOT Diameter" unit="cm" value={rvot} onChange={setRvot} placeholder="e.g. 2.4" hint="Pulmonary annulus" />
        <InputRow label="LVOT Diameter" unit="cm" value={lvot} onChange={setLvot} placeholder="e.g. 2.1" hint="Aortic annulus" />
        <InputRow label="RVOT VTI" unit="cm" value={rvotVti} onChange={setRvotVti} placeholder="e.g. 18.5" hint="PW Doppler at PA annulus" />
        <InputRow label="LVOT VTI" unit="cm" value={lvotVti} onChange={setLvotVti} placeholder="e.g. 22.0" hint="PW Doppler at AV annulus" />
      </div>
      {qpqs !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="Qp:Qs" value={qpqs.toFixed(2)} normal={normal} />
          <MetricBadge label="Significance" value={qpqs < 1.5 ? "Not significant" : qpqs < 2.0 ? "Mild-Moderate" : "Large shunt"} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ACC/AHA 2014 ASD/VSD Guidelines. Qp:Qs ≥ 1.5 = hemodynamically significant; ≥ 2.0 = Class I closure indication.</p>
    </div>
  );
}

// ─── 2. RVSP / PASP via TR Jet ────────────────────────────────────────────────
function RVSPCalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [trVmax, setTrVmax] = useState("");
  const [rap, setRap] = useState("5");

  const v = parseFloat(trVmax);
  const r = parseFloat(rap);
  const valid = v > 0 && r >= 0;

  const rvsp = valid ? 4 * v * v + r : null;
  const normal = rvsp !== null ? rvsp <= 35 : null;

  const severity = rvsp === null ? null
    : rvsp <= 35 ? "Normal RVSP (≤ 35 mmHg)"
    : rvsp <= 50 ? "Mildly elevated RVSP (36–50 mmHg)"
    : rvsp <= 70 ? "Moderately elevated RVSP (51–70 mmHg)"
    : "Severely elevated RVSP (> 70 mmHg)";

  const suggests = rvsp !== null
    ? `ACHDEchoAssist™ Suggests: RVSP = ${rvsp.toFixed(0)} mmHg. ${severity}. ${
        rvsp <= 35 ? "Normal pulmonary artery pressure. No evidence of pulmonary hypertension by Doppler criteria."
        : rvsp <= 50 ? "Mildly elevated RVSP. Evaluate for underlying cause (shunt, valvular disease, parenchymal lung disease). Repeat echo in 6–12 months."
        : rvsp <= 70 ? "Moderate pulmonary hypertension. Right heart catheterization recommended for definitive hemodynamic assessment. Evaluate for operability if shunt present."
        : "Severe pulmonary hypertension. Eisenmenger physiology must be excluded. Closure contraindicated if Rp:Rs > 0.5 or Rp > 8 WU (ESC 2020 ACHD)."
      }`
    : undefined;

  const note = rvsp !== null
    ? "ACHDEchoAssist™ Note: RVSP ≥ 50 mmHg in ACHD warrants right heart catheterization before considering shunt closure. Eisenmenger syndrome (Rp:Rs > 0.5) is a contraindication to closure (ESC 2020 Class III)."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Use the continuous-wave Doppler peak TR velocity from the apical 4-chamber or parasternal views. Estimate RAP from IVC size and collapsibility (5 mmHg if IVC < 2.1 cm with >50% collapse; 10 mmHg if IVC ≥ 2.1 cm or <50% collapse; 15 mmHg if dilated IVC with no collapse).";

  useEffect(() => {
    if (rvsp !== null) {
      onResult({ name: "RVSP (TR Jet)", value: `${rvsp.toFixed(0)} mmHg`, interpretation: severity!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [rvsp, severity, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="TR Peak Velocity" unit="m/s" value={trVmax} onChange={setTrVmax} placeholder="e.g. 3.2" hint="CW Doppler peak TR Vmax" />
        <InputRow label="RAP Estimate" unit="mmHg" value={rap} onChange={setRap} placeholder="5, 10, or 15" hint="IVC-based RAP estimate" />
      </div>
      {rvsp !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="RVSP" value={`${rvsp.toFixed(0)} mmHg`} normal={normal} />
          <MetricBadge label="Severity" value={rvsp <= 35 ? "Normal" : rvsp <= 50 ? "Mild" : rvsp <= 70 ? "Moderate" : "Severe"} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ESC 2020 ACHD Guidelines. RVSP = 4V² + RAP. Normal ≤ 35 mmHg.</p>
    </div>
  );
}

// ─── 3. Rp:Rs Resistance Ratio ────────────────────────────────────────────────
function RpRsCalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [pvr, setPvr] = useState("");
  const [svr, setSvr] = useState("");

  const p = parseFloat(pvr);
  const s = parseFloat(svr);
  const valid = p > 0 && s > 0;

  const rprs = valid ? p / s : null;
  const normal = rprs !== null ? rprs < 0.3 : null;

  const classification = rprs === null ? null
    : rprs < 0.3 ? "Operable — closure indicated (Rp:Rs < 0.3)"
    : rprs < 0.5 ? "Borderline — multidisciplinary evaluation required (Rp:Rs 0.3–0.5)"
    : "Inoperable — closure contraindicated (Rp:Rs ≥ 0.5)";

  const suggests = rprs !== null
    ? `ACHDEchoAssist™ Suggests: Rp:Rs = ${rprs.toFixed(2)}. ${classification}. ${
        rprs < 0.3 ? "Pulmonary vascular resistance is low. Shunt closure is hemodynamically appropriate. Proceed with standard pre-operative evaluation."
        : rprs < 0.5 ? "Borderline pulmonary vascular disease. Vasoreactivity testing may be considered. Multidisciplinary ACHD team evaluation required before closure decision."
        : "Severe pulmonary vascular disease. Eisenmenger physiology likely. Closure is contraindicated. Refer to pulmonary hypertension specialist. Targeted PAH therapy may be appropriate."
      }`
    : undefined;

  const note = rprs !== null
    ? "ACHDEchoAssist™ Note: Rp:Rs is calculated from right heart catheterization data. Rp:Rs < 0.3 (or PVR < 5 WU) = operable. Rp:Rs 0.3–0.5 = borderline. Rp:Rs ≥ 0.5 = Eisenmenger, closure contraindicated (ESC 2020 Class III). Echo-derived values are estimates only."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Rp:Rs requires formal right heart catheterization for definitive assessment. Echo-based estimates of PVR (e.g., TR Vmax/RVOT VTI ratio × 10 + 0.16) provide a screening tool but should not replace invasive measurement in borderline cases.";

  useEffect(() => {
    if (rprs !== null) {
      onResult({ name: "Rp:Rs Resistance Ratio", value: rprs.toFixed(2), interpretation: classification!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [rprs, classification, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="PVR (Pulmonary)" unit="WU" value={pvr} onChange={setPvr} placeholder="e.g. 2.5" hint="Wood units from cath" />
        <InputRow label="SVR (Systemic)" unit="WU" value={svr} onChange={setSvr} placeholder="e.g. 18.0" hint="Wood units from cath" />
      </div>
      {rprs !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="Rp:Rs" value={rprs.toFixed(2)} normal={normal} />
          <MetricBadge label="Operability" value={rprs < 0.3 ? "Operable" : rprs < 0.5 ? "Borderline" : "Inoperable"} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ESC 2020 ACHD Guidelines. Rp:Rs &lt; 0.3 = operable; ≥ 0.5 = Eisenmenger (closure contraindicated).</p>
    </div>
  );
}

// ─── 4. ASD Hemodynamic Significance ─────────────────────────────────────────
function ASDHemodynamics({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [rvedd, setRvedd] = useState("");
  const [qpqs, setQpqs] = useState("");
  const [rvsp, setRvsp] = useState("");

  const r = parseFloat(rvedd);
  const q = parseFloat(qpqs);
  const p = parseFloat(rvsp);
  const valid = r > 0 || q > 0 || p > 0;

  const rvDilated = r > 0 ? r > 42 : null;
  const shuntSig = q > 0 ? q >= 1.5 : null;
  const phPresent = p > 0 ? p > 35 : null;

  const closureIndicated = (rvDilated === true || shuntSig === true) && phPresent !== true;
  const normal = valid ? !rvDilated && !shuntSig && !phPresent : null;

  const suggests = valid
    ? `ACHDEchoAssist™ Suggests: ASD Hemodynamic Assessment — RV dilation: ${rvDilated === null ? "not assessed" : rvDilated ? "Present (RVEDD > 42 mm)" : "Absent"}. Qp:Qs: ${q > 0 ? q.toFixed(2) : "not assessed"}. RVSP: ${p > 0 ? p.toFixed(0) + " mmHg" : "not assessed"}. ${
        closureIndicated ? "Closure is indicated: RV volume overload and/or Qp:Qs ≥ 1.5 without severe pulmonary hypertension (ACC/AHA 2014 Class I/IIa)."
        : phPresent ? "Elevated RVSP. Evaluate for pulmonary hypertension. Closure may be contraindicated if Rp:Rs ≥ 0.5."
        : "No clear indication for closure based on current values. Monitor clinically."
      }`
    : undefined;

  const note = valid
    ? "ACHDEchoAssist™ Note: ASD closure is indicated (Class I) when Qp:Qs ≥ 1.5 with RV volume overload and absence of severe pulmonary hypertension (Rp:Rs < 0.5). Transcatheter closure preferred for secundum ASD ≤ 38 mm with adequate rims (ACC/AHA 2014)."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Measure RVEDD from the apical 4-chamber view at end-diastole. Normal adult RVEDD ≤ 42 mm (ASE 2015). Assess ASD size, rims, and morphology with 2D/3D TEE or ICE for device sizing.";

  useEffect(() => {
    if (valid) {
      onResult({
        name: "ASD Hemodynamic Assessment",
        value: closureIndicated ? "Closure Indicated" : phPresent ? "PH — Evaluate" : "Monitor",
        interpretation: suggests ?? "",
        normal,
        suggests,
      });
    } else {
      onResult(null);
    }
  }, [rvDilated, shuntSig, phPresent, closureIndicated, valid]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="RVEDD" unit="mm" value={rvedd} onChange={setRvedd} placeholder="e.g. 48" hint="RV end-diastolic diameter (apical 4C)" />
        <InputRow label="Qp:Qs" unit="ratio" value={qpqs} onChange={setQpqs} placeholder="e.g. 1.8" hint="From Doppler flow calculation" />
        <InputRow label="RVSP" unit="mmHg" value={rvsp} onChange={setRvsp} placeholder="e.g. 42" hint="From TR jet (4V² + RAP)" />
      </div>
      {valid && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="RV Dilation" value={rvDilated === null ? "N/A" : rvDilated ? "Yes" : "No"} normal={rvDilated === null ? null : !rvDilated} />
          <MetricBadge label="Shunt Sig." value={shuntSig === null ? "N/A" : shuntSig ? "Yes" : "No"} normal={shuntSig === null ? null : !shuntSig} />
          <MetricBadge label="PH" value={phPresent === null ? "N/A" : phPresent ? "Present" : "Absent"} normal={phPresent === null ? null : !phPresent} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ACC/AHA 2014 ASD/VSD Guidelines. RVEDD normal ≤ 42 mm (ASE 2015).</p>
    </div>
  );
}

// ─── 5. VSD Hemodynamic Significance ─────────────────────────────────────────
function VSDHemodynamics({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [vsdVmax, setVsdVmax] = useState("");
  const [sbp, setSbp] = useState("");
  const [qpqs, setQpqs] = useState("");

  const v = parseFloat(vsdVmax);
  const s = parseFloat(sbp);
  const q = parseFloat(qpqs);
  const valid = v > 0 && s > 0;

  const rvp = valid ? s - 4 * v * v : null;
  const rvpFraction = rvp !== null && s > 0 ? rvp / s : null;
  const restrictive = rvpFraction !== null ? rvpFraction < 0.5 : null;
  const normal = restrictive;

  const severity = rvp === null ? null
    : rvpFraction! < 0.3 ? "Restrictive VSD — RVP < 30% SBP (low risk)"
    : rvpFraction! < 0.5 ? "Moderately restrictive — RVP 30–50% SBP"
    : "Non-restrictive VSD — RVP ≥ 50% SBP (high risk)";

  const suggests = rvp !== null
    ? `ACHDEchoAssist™ Suggests: Estimated RVP = ${rvp.toFixed(0)} mmHg (${(rvpFraction! * 100).toFixed(0)}% of SBP). ${severity}. ${
        restrictive ? "Restrictive VSD with low RV pressure. Monitor for AR (especially supracristal VSD) and endocarditis. Closure may be deferred if Qp:Qs < 1.5 and no LV volume overload."
        : rvpFraction! < 0.5 ? "Moderately restrictive. Assess LV volume overload (LVEDd Z-score or LVEDd > 58 mm in adults). Closure indicated if Qp:Qs ≥ 1.5 with LV overload."
        : "Non-restrictive VSD with near-systemic RV pressure. High risk for Eisenmenger syndrome. Urgent hemodynamic evaluation required. Closure contraindicated if Rp:Rs ≥ 0.5."
      }`
    : undefined;

  const note = rvp !== null
    ? "ACHDEchoAssist™ Note: VSD gradient = 4V². RVP = SBP − VSD gradient. Restrictive VSD: RVP < 30% SBP. Non-restrictive: RVP ≥ 50% SBP. Closure indicated (Class I) for Qp:Qs ≥ 2.0 with LV volume overload and no severe PH (ACC/AHA 2014)."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Measure peak VSD velocity with CW Doppler from the apical or parasternal views. Use cuff SBP for systemic pressure. For supracristal VSDs, specifically assess for aortic cusp prolapse and AR.";

  useEffect(() => {
    if (rvp !== null) {
      onResult({ name: "VSD Hemodynamic Assessment", value: `RVP ${rvp.toFixed(0)} mmHg (${(rvpFraction! * 100).toFixed(0)}% SBP)`, interpretation: severity!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [rvp, severity, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="VSD Peak Velocity" unit="m/s" value={vsdVmax} onChange={setVsdVmax} placeholder="e.g. 4.5" hint="CW Doppler peak VSD jet" />
        <InputRow label="Systolic BP" unit="mmHg" value={sbp} onChange={setSbp} placeholder="e.g. 120" hint="Cuff blood pressure" />
        <InputRow label="Qp:Qs (optional)" unit="ratio" value={qpqs} onChange={setQpqs} placeholder="e.g. 1.8" hint="From Doppler flow calculation" />
      </div>
      {rvp !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="Est. RVP" value={`${rvp.toFixed(0)} mmHg`} normal={normal} />
          <MetricBadge label="RVP/SBP" value={`${(rvpFraction! * 100).toFixed(0)}%`} normal={normal} />
          <MetricBadge label="Type" value={restrictive ? "Restrictive" : rvpFraction! < 0.5 ? "Mod. Restrictive" : "Non-Restrictive"} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ACC/AHA 2014 ASD/VSD Guidelines. RVP = SBP − 4V²(VSD). Restrictive: RVP &lt; 30% SBP.</p>
    </div>
  );
}

// ─── 6. Fontan Pressure Estimation ────────────────────────────────────────────
function FontanPressure({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [fontanGrad, setFontanGrad] = useState("");
  const [hepaticVeinPhasic, setHepaticVeinPhasic] = useState<"yes" | "no" | "">("");
  const [avvRegurg, setAvvRegurg] = useState<"none" | "mild" | "moderate" | "severe" | "">("");

  const g = parseFloat(fontanGrad);
  const valid = g > 0 || hepaticVeinPhasic !== "" || avvRegurg !== "";

  const obstruction = g > 0 ? g > 2 : null;
  const venousphasic = hepaticVeinPhasic !== "" ? hepaticVeinPhasic === "yes" : null;
  const avvSig = avvRegurg !== "" ? (avvRegurg === "moderate" || avvRegurg === "severe") : null;

  const fontanFailureRisk = (obstruction === true || venousphasic === false || avvSig === true);
  const normal = valid ? !fontanFailureRisk : null;

  const suggests = valid
    ? `ACHDEchoAssist™ Suggests: Fontan Hemodynamic Assessment — Pathway gradient: ${g > 0 ? g.toFixed(1) + " mmHg" : "not assessed"}${obstruction === true ? " (ELEVATED — obstruction suspected)" : ""}. Hepatic vein flow: ${hepaticVeinPhasic === "yes" ? "Phasic (normal)" : hepaticVeinPhasic === "no" ? "Non-phasic (elevated Fontan pressure)" : "not assessed"}. AVV regurgitation: ${avvRegurg || "not assessed"}. ${
        fontanFailureRisk ? "Findings suggest Fontan circuit dysfunction. Evaluate for pathway obstruction, thrombus, protein-losing enteropathy, and Fontan-associated liver disease (FALD). Refer to ACHD center."
        : "No hemodynamic evidence of Fontan failure on current assessment. Annual surveillance recommended."
      }`
    : undefined;

  const note = valid
    ? "ACHDEchoAssist™ Note: Fontan pressure is typically 10–15 mmHg. Pathway gradient > 2 mmHg suggests obstruction. Loss of hepatic vein phasicity indicates elevated Fontan pressure. Moderate-severe AVV regurgitation is associated with Fontan failure. Annual echo surveillance is recommended (ESC 2020 ACHD)."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Assess the Fontan circuit from subcostal and suprasternal views. Use PW Doppler in the hepatic veins — phasic flow (S, D, a waves) is normal; loss of phasicity or reversal of a-wave indicates elevated systemic venous pressure. Assess for thrombus in the Fontan circuit and atria.";

  useEffect(() => {
    if (valid) {
      onResult({
        name: "Fontan Hemodynamic Assessment",
        value: fontanFailureRisk ? "Dysfunction Suspected" : "No Failure Signs",
        interpretation: suggests ?? "",
        normal,
        suggests,
      });
    } else {
      onResult(null);
    }
  }, [fontanFailureRisk, valid, suggests]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="Fontan Pathway Gradient" unit="mmHg" value={fontanGrad} onChange={setFontanGrad} placeholder="e.g. 1.5" hint="Mean gradient across Fontan circuit" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Hepatic Vein Flow Phasic?</label>
          <div className="flex gap-2">
            {(["yes", "no"] as const).map((v) => (
              <button key={v} onClick={() => setHepaticVeinPhasic(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${hepaticVeinPhasic === v ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
                style={hepaticVeinPhasic === v ? { background: BRAND } : {}}
              >
                {v === "yes" ? "Yes (Normal)" : "No (Abnormal)"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">AVV Regurgitation</label>
          <div className="flex flex-wrap gap-2">
            {(["none", "mild", "moderate", "severe"] as const).map((v) => (
              <button key={v} onClick={() => setAvvRegurg(v)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all capitalize ${avvRegurg === v ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
                style={avvRegurg === v ? { background: v === "none" || v === "mild" ? BRAND : "#dc2626" } : {}}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
      {valid && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="Fontan Status" value={fontanFailureRisk ? "Dysfunction" : "Stable"} normal={normal} />
          {g > 0 && <MetricBadge label="Pathway Gradient" value={`${g.toFixed(1)} mmHg`} normal={!obstruction} />}
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ESC 2020 ACHD Guidelines. Fontan pressure typically 10–15 mmHg; pathway gradient &gt; 2 mmHg = obstruction.</p>
    </div>
  );
}

// ─── 7. Ebstein's Severity Index ──────────────────────────────────────────────
function EbsteinSeverity({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [atrialized, setAtrialized] = useState("");
  const [functional, setFunctional] = useState("");
  const [la, setLa] = useState("");

  const a = parseFloat(atrialized);
  const f = parseFloat(functional);
  const l = parseFloat(la);
  const valid = a > 0 && f > 0 && l > 0;

  // Celermajer Echocardiographic Severity Index (ESI) = (RA + aRV) / (FRV + LV + LA)
  const esi = valid ? (a + l) / (f + l) : null;
  const normal = esi !== null ? esi < 0.5 : null;

  const grade = esi === null ? null
    : esi < 0.5 ? "Grade 1 — Mild (ESI < 0.5)"
    : esi < 0.75 ? "Grade 2 — Moderate (ESI 0.5–0.75)"
    : esi < 1.0 ? "Grade 3 — Severe (ESI 0.75–1.0)"
    : "Grade 4 — Critical (ESI ≥ 1.0)";

  const suggests = esi !== null
    ? `ACHDEchoAssist™ Suggests: Ebstein's Severity Index (ESI) = ${esi.toFixed(2)}. ${grade}. ${
        esi < 0.5 ? "Mild Ebstein's anomaly. Monitor with annual echo. Surgical intervention generally not required unless symptomatic or progressive TR."
        : esi < 0.75 ? "Moderate Ebstein's anomaly. Evaluate for symptoms, arrhythmia, and cyanosis. Surgical repair (cone procedure) considered for symptomatic patients."
        : esi < 1.0 ? "Severe Ebstein's anomaly. High risk for heart failure and arrhythmia. Surgical evaluation recommended at ACHD center. Assess for WPW and accessory pathways."
        : "Critical Ebstein's anomaly. Neonatal or severely symptomatic presentation. Urgent surgical evaluation required. High perioperative risk."
      }`
    : undefined;

  const note = esi !== null
    ? "ACHDEchoAssist™ Note: The Celermajer ESI uses 4-chamber area ratios. ESI ≥ 0.5 correlates with symptoms and adverse outcomes. Cone reconstruction (da Silva) is the preferred surgical technique. Assess for ASD/PFO, WPW, and RVOT obstruction in all Ebstein's patients."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Measure areas from the apical 4-chamber view at end-diastole. Atrialized RV = area between tricuspid annulus and displaced TV leaflets. Functional RV = area of the true RV cavity. Include LA area as measured from the same view.";

  useEffect(() => {
    if (esi !== null) {
      onResult({ name: "Ebstein's Severity Index (ESI)", value: esi.toFixed(2), interpretation: grade!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [esi, grade, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <InputRow label="Atrialized RV Area" unit="cm²" value={atrialized} onChange={setAtrialized} placeholder="e.g. 18.5" hint="Displaced TV to annulus" />
        <InputRow label="Functional RV Area" unit="cm²" value={functional} onChange={setFunctional} placeholder="e.g. 12.0" hint="True RV cavity area" />
        <InputRow label="LA Area" unit="cm²" value={la} onChange={setLa} placeholder="e.g. 22.0" hint="Left atrial area" />
      </div>
      {esi !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="ESI" value={esi.toFixed(2)} normal={normal} />
          <MetricBadge label="Grade" value={esi < 0.5 ? "Mild" : esi < 0.75 ? "Moderate" : esi < 1.0 ? "Severe" : "Critical"} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Celermajer DS et al. J Am Coll Cardiol. 1992;19:720-728. ESI = (aRV + LA) / (FRV + LA).</p>
    </div>
  );
}

// ─── 8. CoA Re-coarctation Index ──────────────────────────────────────────────
function CoARecoarctation({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [coaGrad, setCoaGrad] = useState("");
  const [coaDiam, setCoaDiam] = useState("");
  const [aoDiam, setAoDiam] = useState("");

  const g = parseFloat(coaGrad);
  const c = parseFloat(coaDiam);
  const a = parseFloat(aoDiam);
  const valid = g > 0 || (c > 0 && a > 0);

  const ratio = c > 0 && a > 0 ? c / a : null;
  const gradSig = g > 0 ? g > 20 : null;
  const ratioSig = ratio !== null ? ratio < 0.5 : null;
  const significant = gradSig === true || ratioSig === true;
  const normal = valid ? !significant : null;

  const suggests = valid
    ? `ACHDEchoAssist™ Suggests: CoA Assessment — Peak gradient: ${g > 0 ? g.toFixed(0) + " mmHg" : "not assessed"}${gradSig === true ? " (Significant — > 20 mmHg)" : gradSig === false ? " (Not significant)" : ""}. CoA/Ao diameter ratio: ${ratio !== null ? ratio.toFixed(2) : "not assessed"}${ratioSig === true ? " (Significant — < 0.5)" : ratioSig === false ? " (Acceptable)" : ""}. ${
        significant ? "Significant re-coarctation or residual CoA. Intervention (balloon dilation or stenting) is indicated for peak gradient > 20 mmHg or CoA/Ao ratio < 0.5 with hypertension (ACC/AHA 2018 ACHD Class I)."
        : "No hemodynamically significant re-coarctation on current assessment. Continue surveillance with annual echo and blood pressure monitoring."
      }`
    : undefined;

  const note = valid
    ? "ACHDEchoAssist™ Note: Significant CoA defined as peak gradient > 20 mmHg by CW Doppler or CoA/Ao ratio < 0.5 with upper extremity hypertension. Doppler gradients may underestimate severity in the presence of extensive collaterals. MRI/CT angiography recommended for definitive anatomical assessment."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Obtain suprasternal notch CW Doppler for peak CoA gradient. Assess for diastolic tail (prolonged deceleration slope) suggesting significant obstruction. Measure CoA diameter at the narrowest point and compare to descending aorta diameter at the diaphragm.";

  useEffect(() => {
    if (valid) {
      onResult({
        name: "CoA Re-coarctation Assessment",
        value: g > 0 ? `${g.toFixed(0)} mmHg gradient` : ratio !== null ? `CoA/Ao ratio ${ratio.toFixed(2)}` : "Assessed",
        interpretation: suggests ?? "",
        normal,
        suggests,
      });
    } else {
      onResult(null);
    }
  }, [significant, valid, suggests]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <InputRow label="Peak CoA Gradient" unit="mmHg" value={coaGrad} onChange={setCoaGrad} placeholder="e.g. 25" hint="CW Doppler suprasternal" />
        <InputRow label="CoA Diameter" unit="mm" value={coaDiam} onChange={setCoaDiam} placeholder="e.g. 8" hint="Narrowest point" />
        <InputRow label="Descending Ao Diameter" unit="mm" value={aoDiam} onChange={setAoDiam} placeholder="e.g. 20" hint="At diaphragm level" />
      </div>
      {valid && (
        <div className="flex gap-3 flex-wrap">
          {g > 0 && <MetricBadge label="Peak Gradient" value={`${g.toFixed(0)} mmHg`} normal={!gradSig} />}
          {ratio !== null && <MetricBadge label="CoA/Ao Ratio" value={ratio.toFixed(2)} normal={!ratioSig} />}
          <MetricBadge label="Significance" value={significant ? "Significant" : "Not Significant"} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ACC/AHA 2018 ACHD Guidelines. Significant CoA: gradient &gt; 20 mmHg or CoA/Ao ratio &lt; 0.5.</p>
    </div>
  );
}

// ─── 9. TOF Post-Repair RV Assessment ────────────────────────────────────────
function TOFRVAssessment({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [rvedv, setRvedv] = useState("");
  const [rvef, setRvef] = useState("");
  const [tapse, setTapse] = useState("");
  const [prFraction, setPrFraction] = useState("");

  const v = parseFloat(rvedv);
  const e = parseFloat(rvef);
  const t = parseFloat(tapse);
  const p = parseFloat(prFraction);
  const valid = v > 0 || e > 0 || t > 0 || p > 0;

  const rvDilated = v > 0 ? v > 160 : null; // mL/m²
  const rvDysfunction = e > 0 ? e < 45 : null;
  const tapseAbnormal = t > 0 ? t < 17 : null;
  const prSig = p > 0 ? p > 25 : null;

  const pvReplacementIndicated = (rvDilated === true || rvDysfunction === true) && prSig === true;
  const normal = valid ? !(rvDilated || rvDysfunction || tapseAbnormal || prSig) : null;

  const suggests = valid
    ? `ACHDEchoAssist™ Suggests: TOF Post-Repair RV Assessment — RVEDV index: ${v > 0 ? v.toFixed(0) + " mL/m²" : "not assessed"}${rvDilated === true ? " (Dilated — > 160 mL/m²)" : ""}. RVEF: ${e > 0 ? e.toFixed(0) + "%" : "not assessed"}${rvDysfunction === true ? " (Reduced — < 45%)" : ""}. TAPSE: ${t > 0 ? t.toFixed(0) + " mm" : "not assessed"}${tapseAbnormal === true ? " (Reduced — < 17 mm)" : ""}. PR fraction: ${p > 0 ? p.toFixed(0) + "%" : "not assessed"}${prSig === true ? " (Significant — > 25%)" : ""}. ${
        pvReplacementIndicated ? "Pulmonary valve replacement (PVR) is indicated: significant PR with RV dilation and/or dysfunction (ACC/AHA 2018 Class I/IIa). Refer to ACHD surgeon."
        : rvDilated || rvDysfunction ? "RV dilation or dysfunction without confirmed significant PR. Obtain cardiac MRI for volumetric assessment. Consider PVR if RVEDV > 160 mL/m² on MRI."
        : "No current indication for PVR based on available echo data. Annual surveillance recommended."
      }`
    : undefined;

  const note = valid
    ? "ACHDEchoAssist™ Note: PVR is indicated (Class I) in symptomatic TOF patients with severe PR and RVEDV > 160 mL/m² or RVEF < 45% on cardiac MRI (ACC/AHA 2018). Echo-derived RVEDV is less accurate than MRI — cardiac MRI is the gold standard for RV volumetric assessment in TOF."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Assess PR fraction from the RVOT PW Doppler (reverse VTI / forward VTI). TAPSE from M-mode at the tricuspid annulus in the apical 4-chamber view. Cardiac MRI is required for definitive RVEDV and RVEF assessment before PVR decision.";

  useEffect(() => {
    if (valid) {
      onResult({
        name: "TOF Post-Repair RV Assessment",
        value: pvReplacementIndicated ? "PVR Indicated" : rvDilated || rvDysfunction ? "MRI Recommended" : "Surveillance",
        interpretation: suggests ?? "",
        normal,
        suggests,
      });
    } else {
      onResult(null);
    }
  }, [pvReplacementIndicated, rvDilated, rvDysfunction, valid, suggests]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="RVEDV Index" unit="mL/m²" value={rvedv} onChange={setRvedv} placeholder="e.g. 145" hint="From cardiac MRI or echo" />
        <InputRow label="RVEF" unit="%" value={rvef} onChange={setRvef} placeholder="e.g. 48" hint="RV ejection fraction" />
        <InputRow label="TAPSE" unit="mm" value={tapse} onChange={setTapse} placeholder="e.g. 18" hint="Tricuspid annular excursion" />
        <InputRow label="PR Fraction" unit="%" value={prFraction} onChange={setPrFraction} placeholder="e.g. 30" hint="PW Doppler reverse/forward VTI" />
      </div>
      {valid && (
        <div className="flex gap-3 flex-wrap">
          {v > 0 && <MetricBadge label="RVEDV Index" value={`${v.toFixed(0)} mL/m²`} normal={!rvDilated} />}
          {e > 0 && <MetricBadge label="RVEF" value={`${e.toFixed(0)}%`} normal={!rvDysfunction} />}
          {t > 0 && <MetricBadge label="TAPSE" value={`${t.toFixed(0)} mm`} normal={!tapseAbnormal} />}
          {p > 0 && <MetricBadge label="PR Fraction" value={`${p.toFixed(0)}%`} normal={!prSig} />}
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ACC/AHA 2018 ACHD Guidelines. PVR indicated: RVEDV &gt; 160 mL/m² or RVEF &lt; 45% with severe PR.</p>
    </div>
  );
}

// ─── 10. TGA (d-TGA post-Mustard/Senning) Systemic RV Assessment ──────────────
function SystemicRVAssessment({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [srvef, setSrvef] = useState("");
  const [tapse, setTapse] = useState("");
  const [tvRegurg, setTvRegurg] = useState<"none" | "mild" | "moderate" | "severe" | "">("");

  const e = parseFloat(srvef);
  const t = parseFloat(tapse);
  const valid = e > 0 || t > 0 || tvRegurg !== "";

  const efReduced = e > 0 ? e < 45 : null;
  const tapseAbnormal = t > 0 ? t < 17 : null;
  const tvSig = tvRegurg !== "" ? (tvRegurg === "moderate" || tvRegurg === "severe") : null;

  const dysfunction = efReduced === true || tapseAbnormal === true;
  const normal = valid ? !(dysfunction || tvSig) : null;

  const suggests = valid
    ? `ACHDEchoAssist™ Suggests: Systemic RV Assessment (d-TGA post-atrial switch) — sRVEF: ${e > 0 ? e.toFixed(0) + "%" : "not assessed"}${efReduced === true ? " (Reduced — < 45%)" : ""}. TAPSE: ${t > 0 ? t.toFixed(0) + " mm" : "not assessed"}${tapseAbnormal === true ? " (Reduced — < 17 mm)" : ""}. TV regurgitation: ${tvRegurg || "not assessed"}${tvSig === true ? " (Significant)" : ""}. ${
        dysfunction && tvSig ? "Systemic RV dysfunction with significant TV regurgitation. High risk for heart failure. Refer to ACHD center. Consider cardiac resynchronization therapy (CRT) if LBBB or QRS > 150 ms. TV repair/replacement may be considered."
        : dysfunction ? "Systemic RV dysfunction. Optimize medical therapy (ACE inhibitor, beta-blocker). Refer to ACHD center. Annual cardiac MRI recommended."
        : tvSig ? "Significant TV regurgitation without systemic RV dysfunction. Monitor closely. TV repair may be considered if progressive."
        : "No current evidence of systemic RV dysfunction. Annual echo surveillance recommended."
      }`
    : undefined;

  const note = valid
    ? "ACHDEchoAssist™ Note: In d-TGA post-Mustard/Senning, the morphologic RV supports the systemic circulation. sRVEF < 45% and TAPSE < 17 mm indicate systemic RV dysfunction. Cardiac MRI is the gold standard. TV regurgitation is a marker of systemic RV failure and adverse prognosis (ESC 2020 ACHD)."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Assess systemic RV function from the apical 4-chamber view. Use TAPSE, FAC, and 3D RVEF if available. Evaluate the systemic AV valve (morphologic TV) for regurgitation. Assess baffle obstruction from subcostal views with Doppler.";

  useEffect(() => {
    if (valid) {
      onResult({
        name: "Systemic RV Assessment (d-TGA)",
        value: dysfunction ? "Dysfunction Present" : tvSig ? "TV Regurgitation" : "Stable",
        interpretation: suggests ?? "",
        normal,
        suggests,
      });
    } else {
      onResult(null);
    }
  }, [dysfunction, tvSig, valid, suggests]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="Systemic RVEF" unit="%" value={srvef} onChange={setSrvef} placeholder="e.g. 42" hint="Systemic RV ejection fraction" />
        <InputRow label="TAPSE" unit="mm" value={tapse} onChange={setTapse} placeholder="e.g. 15" hint="Tricuspid annular excursion" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">Systemic TV Regurgitation</label>
        <div className="flex flex-wrap gap-2">
          {(["none", "mild", "moderate", "severe"] as const).map((v) => (
            <button key={v} onClick={() => setTvRegurg(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize ${tvRegurg === v ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
              style={tvRegurg === v ? { background: v === "none" || v === "mild" ? BRAND : "#dc2626" } : {}}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {valid && (
        <div className="flex gap-3 flex-wrap">
          {e > 0 && <MetricBadge label="sRVEF" value={`${e.toFixed(0)}%`} normal={!efReduced} />}
          {t > 0 && <MetricBadge label="TAPSE" value={`${t.toFixed(0)} mm`} normal={!tapseAbnormal} />}
          <MetricBadge label="Status" value={dysfunction ? "Dysfunction" : "Stable"} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ESC 2020 ACHD Guidelines. Systemic RVEF &lt; 45% = dysfunction. Annual echo + MRI surveillance recommended.</p>
    </div>
  );
}

// ─── 11. ACHD Complexity Classification ──────────────────────────────────────
function ACHDComplexity({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [lesion, setLesion] = useState<string>("");

  const lesions: { label: string; complexity: "Simple" | "Moderate" | "Complex"; description: string }[] = [
    { label: "Isolated small ASD (secundum, closed)", complexity: "Simple", description: "Repaired ASD with no residual shunt" },
    { label: "Isolated small VSD (closed)", complexity: "Simple", description: "Repaired VSD with no residual defect" },
    { label: "Mild isolated PS (gradient < 30 mmHg)", complexity: "Simple", description: "Mild pulmonary stenosis, no intervention" },
    { label: "Repaired PDA (no residual)", complexity: "Simple", description: "Ligated or device-closed PDA" },
    { label: "Unrepaired ASD (secundum)", complexity: "Moderate", description: "Hemodynamically significant ASD" },
    { label: "Unrepaired VSD", complexity: "Moderate", description: "Moderate-large VSD with shunt" },
    { label: "Moderate PS (gradient 30–60 mmHg)", complexity: "Moderate", description: "Moderate pulmonary stenosis" },
    { label: "Coarctation of the aorta", complexity: "Moderate", description: "Repaired or unrepaired CoA" },
    { label: "Repaired TOF", complexity: "Moderate", description: "Post-repair TOF with residual PR/RV dilation" },
    { label: "Ebstein's anomaly", complexity: "Moderate", description: "Mild-moderate Ebstein's" },
    { label: "Fontan circulation", complexity: "Complex", description: "Single ventricle post-Fontan (TCPC or AP)" },
    { label: "d-TGA post-Mustard/Senning", complexity: "Complex", description: "Atrial switch operation" },
    { label: "d-TGA post-arterial switch", complexity: "Moderate", description: "Arterial switch operation (Jatene)" },
    { label: "Congenitally corrected TGA (ccTGA)", complexity: "Complex", description: "Systemic RV with morphologic TV" },
    { label: "Pulmonary atresia with VSD", complexity: "Complex", description: "Including MAPCAs" },
    { label: "Heterotaxy / Isomerism", complexity: "Complex", description: "Right or left isomerism" },
    { label: "Unrepaired cyanotic CHD", complexity: "Complex", description: "Any unrepaired cyanotic lesion" },
    { label: "Eisenmenger syndrome", complexity: "Complex", description: "Irreversible pulmonary hypertension" },
  ];

  const selected = lesions.find((l) => l.label === lesion);
  const normal = selected ? selected.complexity === "Simple" : null;

  const suggests = selected
    ? `ACHDEchoAssist™ Suggests: ${selected.label} — Classified as ${selected.complexity} ACHD (ACC/AHA 2018). ${
        selected.complexity === "Simple" ? "Simple ACHD lesions can be managed in general cardiology or ACHD clinic. Annual follow-up recommended. Echo surveillance every 3–5 years if stable."
        : selected.complexity === "Moderate" ? "Moderate ACHD lesions require management at an ACHD center with expertise in congenital heart disease. Annual echo surveillance recommended."
        : "Complex ACHD lesions require lifelong management at a specialized ACHD center of excellence. Annual echo and cardiac MRI surveillance. Multidisciplinary team approach essential."
      }`
    : undefined;

  const note = selected
    ? `ACHDEchoAssist™ Note: ${selected.description}. ACC/AHA 2018 ACHD Complexity Classification: Simple = low-risk, managed in general cardiology; Moderate = requires ACHD expertise; Complex = requires ACHD center of excellence.`
    : undefined;

  useEffect(() => {
    if (selected) {
      onResult({
        name: "ACHD Complexity Classification",
        value: `${selected.complexity} (${selected.label})`,
        interpretation: suggests ?? "",
        normal,
        suggests,
      });
    } else {
      onResult(null);
    }
  }, [selected, suggests]);

  return (
    <div className="pt-4 space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-2">Select ACHD Lesion</label>
        <select
          value={lesion}
          onChange={(e) => setLesion(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
        >
          <option value="">— Select lesion —</option>
          {["Simple", "Moderate", "Complex"].map((group) => (
            <optgroup key={group} label={`${group} ACHD`}>
              {lesions.filter((l) => l.complexity === group).map((l) => (
                <option key={l.label} value={l.label}>{l.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {selected && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge
            label="Complexity"
            value={selected.complexity}
            normal={selected.complexity === "Simple" ? true : selected.complexity === "Moderate" ? null : false}
          />
          <MetricBadge label="Management" value={selected.complexity === "Simple" ? "General Cardiology" : selected.complexity === "Moderate" ? "ACHD Clinic" : "ACHD Center"} normal={normal} />
        </div>
      )}
      {selected && <ResultPanel suggests={suggests} note={note} />}
      <p className="text-[10px] text-gray-400">Reference: ACC/AHA 2018 ACHD Guidelines (Stout KK et al. JACC 2019;73:e81-e192).</p>
    </div>
  );
}

// ─── 12. Echo-Derived PVR Estimate ────────────────────────────────────────────
function EchoPVREstimate({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [trVmax, setTrVmax] = useState("");
  const [rvotVti, setRvotVti] = useState("");

  const v = parseFloat(trVmax);
  const r = parseFloat(rvotVti);
  const valid = v > 0 && r > 0;

  // Abbas formula: PVR (WU) = (TR Vmax / RVOT VTI) × 10 + 0.16
  const pvr = valid ? (v / r) * 10 + 0.16 : null;
  const normal = pvr !== null ? pvr < 3 : null;

  const classification = pvr === null ? null
    : pvr < 3 ? "Normal PVR (< 3 WU)"
    : pvr < 5 ? "Mildly elevated PVR (3–5 WU)"
    : pvr < 8 ? "Moderately elevated PVR (5–8 WU)"
    : "Severely elevated PVR (≥ 8 WU)";

  const suggests = pvr !== null
    ? `ACHDEchoAssist™ Suggests: Echo-estimated PVR = ${pvr.toFixed(1)} WU (Abbas formula). ${classification}. ${
        pvr < 3 ? "Normal pulmonary vascular resistance. No evidence of pulmonary vascular disease by echo criteria."
        : pvr < 5 ? "Mildly elevated PVR. Evaluate for underlying cause. Right heart catheterization recommended for definitive assessment before shunt closure."
        : pvr < 8 ? "Moderately elevated PVR. Right heart catheterization with vasoreactivity testing required. Shunt closure may be contraindicated."
        : "Severely elevated PVR. Eisenmenger physiology must be excluded. Shunt closure contraindicated if Rp:Rs ≥ 0.5. Refer to pulmonary hypertension specialist."
      }`
    : undefined;

  const note = pvr !== null
    ? "ACHDEchoAssist™ Note: The Abbas formula (PVR = TR Vmax/RVOT VTI × 10 + 0.16) provides a non-invasive PVR estimate. Sensitivity 77%, specificity 81% for PVR > 3 WU. This is a screening tool only — right heart catheterization is required for definitive PVR measurement before clinical decisions."
    : undefined;

  const tip = "ACHDEchoAssist™ Tip: Measure TR Vmax with CW Doppler (peak velocity in m/s). Measure RVOT VTI with PW Doppler at the RVOT/pulmonary annulus (in cm). Ensure the TR signal is well-defined and the RVOT VTI is measured at the same level as the RVOT diameter.";

  useEffect(() => {
    if (pvr !== null) {
      onResult({ name: "Echo-Derived PVR Estimate", value: `${pvr.toFixed(1)} WU`, interpretation: classification!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [pvr, classification, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="TR Peak Velocity" unit="m/s" value={trVmax} onChange={setTrVmax} placeholder="e.g. 3.2" hint="CW Doppler peak TR Vmax" />
        <InputRow label="RVOT VTI" unit="cm" value={rvotVti} onChange={setRvotVti} placeholder="e.g. 18.5" hint="PW Doppler at PA annulus" />
      </div>
      {pvr !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="Est. PVR" value={`${pvr.toFixed(1)} WU`} normal={normal} />
          <MetricBadge label="Classification" value={pvr < 3 ? "Normal" : pvr < 5 ? "Mild" : pvr < 8 ? "Moderate" : "Severe"} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Abbas AE et al. J Am Soc Echocardiogr. 2003;16:1101-1105. PVR = (TR Vmax / RVOT VTI) × 10 + 0.16.</p>
    </div>
  );
}

// ─── PDF Report Generator ─────────────────────────────────────────────────────
async function generatePDFReport(
  results: Record<string, CalcResult>,
  info: { age: string; date: string; operator: string; indication: string; diagnosis: string }
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const TEAL: [number, number, number] = [24, 154, 161];
  const NAVY_C: [number, number, number] = [14, 30, 46];
  const LIGHT_TEAL: [number, number, number] = [240, 251, 252];
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  // Header
  doc.setFillColor(...NAVY_C);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setFillColor(...TEAL);
  doc.rect(0, 28, pageW, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ACHDEchoAssist\u2122 Clinical Report", margin, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Adult Congenital Heart Disease Echo Calculator Engine \u2014 ASE/ESC/ACC-AHA Guideline-Based", margin, 21);
  doc.text("iHeartEcho\u2122 | All About Ultrasound | www.iheartecho.com", margin, 27);
  y = 38;

  // Study Info
  doc.setFillColor(...LIGHT_TEAL);
  doc.roundedRect(margin, y, contentW, 34, 2, 2, "F");
  doc.setTextColor(...NAVY_C);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Study Information", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const col1x = margin + 4;
  const col2x = margin + contentW / 2 + 4;
  doc.text(`Date: ${info.date || "Not specified"}`, col1x, y + 13);
  doc.text(`Operator: ${info.operator || "Not specified"}`, col2x, y + 13);
  doc.text(`Age: ${info.age || "Not specified"}`, col1x, y + 20);
  doc.text(`Diagnosis: ${info.diagnosis || "Not specified"}`, col2x, y + 20);
  const indLines = doc.splitTextToSize(`Indication: ${info.indication || "Not specified"}`, contentW - 8);
  indLines.forEach((line: string, i: number) => doc.text(line, col1x, y + 27 + i * 4));
  y += 40;

  // Results
  const entries = Object.values(results);
  if (entries.length === 0) {
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(10);
    doc.text("No calculator results recorded.", margin, y + 10);
    y += 20;
  } else {
    doc.setFillColor(...TEAL);
    doc.roundedRect(margin, y, contentW, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Calculator Results (${entries.length} completed)`, margin + 4, y + 5.5);
    y += 12;

    entries.forEach((r) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const isNormal = r.normal === true;
      const isAbnormal = r.normal === false;
      const bgColor: [number, number, number] = isNormal ? [220, 252, 231] : isAbnormal ? [254, 226, 226] : [239, 246, 255];
      const textColor: [number, number, number] = isNormal ? [22, 101, 52] : isAbnormal ? [153, 27, 27] : [30, 64, 175];
      doc.setFillColor(...bgColor);
      doc.roundedRect(margin, y, contentW, 7, 1, 1, "F");
      doc.setTextColor(...textColor);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(`${r.name}: ${r.value}`, margin + 3, y + 4.8);
      y += 9;

      if (r.suggests) {
        doc.setTextColor(55, 65, 81);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(r.suggests.replace("ACHDEchoAssist\u2122 Suggests: ", ""), contentW - 6);
        lines.forEach((line: string) => {
          if (y > 275) { doc.addPage(); y = 20; }
          doc.text(line, margin + 3, y);
          y += 4.5;
        });
        y += 3;
      }
    });
  }

  // Disclaimer
  if (y > 255) { doc.addPage(); y = 20; }
  y += 4;
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Clinical Disclaimer", margin + 3, y + 5);
  doc.setFont("helvetica", "normal");
  const disclaimer = "This report is generated by ACHDEchoAssist\u2122 for educational and clinical decision support purposes only. All values must be interpreted in the context of the complete echocardiographic examination, clinical history, and prior surgical/interventional history. This tool does not replace the judgment of a qualified ACHD cardiologist. References: ASE 2010 ACHD Echo (Silversides et al.) | ESC 2020 ACHD Guidelines | ACC/AHA 2018 ACHD Guidelines (Stout KK et al. JACC 2019;73:e81-e192).";
  const dLines = doc.splitTextToSize(disclaimer, contentW - 6);
  dLines.forEach((line: string, i: number) => doc.text(line, margin + 3, y + 10 + i * 4));
  y += 28;

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY_C);
    doc.rect(0, 287, pageW, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("ACHDEchoAssist\u2122 \u2014 iHeartEcho\u2122 | All About Ultrasound | www.iheartecho.com", margin, 293);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin - 15, 293);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`ACHDEchoAssist-Report-${dateStr}.pdf`);
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ACHDEchoAssist({ embedded = false }: { embedded?: boolean }) {
  const search = useSearch();
  const [results, setResults] = useState<Record<string, CalcResult>>({});
  const [studyAge, setStudyAge] = useState("");
  const [studyDate, setStudyDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [studyOperator, setStudyOperator] = useState("");
  const [studyIndication, setStudyIndication] = useState("");
  const [studyDiagnosis, setStudyDiagnosis] = useState("");
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
        date: studyDate,
        operator: studyOperator,
        indication: studyIndication,
        diagnosis: studyDiagnosis,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const engines = [
    { id: "engine-qpqs", title: "Qp:Qs Shunt Ratio", badge: "Shunt", color: "#189aa1", key: "qpqs", component: (fn: (r: CalcResult | null) => void) => <QpQsACHD onResult={fn} /> },
    { id: "engine-rvsp", title: "RVSP / PASP via TR Jet", badge: "Hemodynamics", color: "#189aa1", key: "rvsp", component: (fn: (r: CalcResult | null) => void) => <RVSPCalculator onResult={fn} /> },
    { id: "engine-rprs", title: "Rp:Rs Resistance Ratio", badge: "Operability", color: "#dc2626", key: "rprs", component: (fn: (r: CalcResult | null) => void) => <RpRsCalculator onResult={fn} /> },
    { id: "engine-asd", title: "ASD Hemodynamic Significance", badge: "ASD", color: BRAND, key: "asd", component: (fn: (r: CalcResult | null) => void) => <ASDHemodynamics onResult={fn} /> },
    { id: "engine-vsd", title: "VSD Hemodynamic Significance", badge: "VSD", color: BRAND, key: "vsd", component: (fn: (r: CalcResult | null) => void) => <VSDHemodynamics onResult={fn} /> },
    { id: "engine-fontan", title: "Fontan Hemodynamic Assessment", badge: "Fontan", color: "#189aa1", key: "fontan", component: (fn: (r: CalcResult | null) => void) => <FontanPressure onResult={fn} /> },
    { id: "engine-ebstein", title: "Ebstein's Severity Index (ESI)", badge: "Ebstein's", color: "#d97706", key: "ebstein", component: (fn: (r: CalcResult | null) => void) => <EbsteinSeverity onResult={fn} /> },
    { id: "engine-coa", title: "CoA Re-coarctation Assessment", badge: "CoA", color: "#189aa1", key: "coa", component: (fn: (r: CalcResult | null) => void) => <CoARecoarctation onResult={fn} /> },
    { id: "engine-tof", title: "TOF Post-Repair RV Assessment", badge: "TOF / PVR", color: "#dc2626", key: "tof", component: (fn: (r: CalcResult | null) => void) => <TOFRVAssessment onResult={fn} /> },
    { id: "engine-systemic-rv", title: "Systemic RV Assessment (d-TGA)", badge: "d-TGA", color: "#189aa1", key: "systemic_rv", component: (fn: (r: CalcResult | null) => void) => <SystemicRVAssessment onResult={fn} /> },
    { id: "engine-achd-class", title: "ACHD Complexity Classification", badge: "Classification", color: BRAND, key: "achd_class", component: (fn: (r: CalcResult | null) => void) => <ACHDComplexity onResult={fn} /> },
    { id: "engine-pvr-echo", title: "Echo-Derived PVR Estimate (Abbas)", badge: "PVR", color: "#189aa1", key: "pvr_echo", component: (fn: (r: CalcResult | null) => void) => <EchoPVREstimate onResult={fn} /> },
  ];

  const content = (
    <>
      {!embedded && (
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0e4a50 60%, ${BRAND} 100%)` }}>
        <div className="container py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: AQUA + "30" }}>
              <Heart className="w-5 h-5" style={{ color: AQUA }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                  ACHDEchoAssist™
                </h1>
                <span className="inline-flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Crown className="w-3 h-3" /> Premium
                </span>
              </div>
              <p className="text-sm" style={{ color: AQUA }}>
                Adult Congenital Heart Disease Echo Calculator Engine
              </p>
            </div>
          </div>
          <p className="text-white/60 text-xs max-w-2xl mt-2">
            12 ACHD-specific calculators covering shunt quantification, pulmonary hemodynamics, Fontan assessment, Ebstein's severity, TOF post-repair RV evaluation, and ACC/AHA 2018 complexity classification.
          </p>
        </div>
      </div>
      )}

      {/* Premium Gate */}
      <PremiumGate featureName="ACHDEchoAssist™ Calculator Engine">
        <div className="container py-8">
          {/* Study Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" style={{ color: BRAND }} />
              <h2 className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Study Information (for PDF Report)</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Patient Age</label>
                <input type="text" value={studyAge} onChange={(e) => setStudyAge(e.target.value)} placeholder="e.g. 34 years" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
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
                <label className="text-xs font-semibold text-gray-600 block mb-1">ACHD Diagnosis</label>
                <input type="text" value={studyDiagnosis} onChange={(e) => setStudyDiagnosis(e.target.value)} placeholder="e.g. Repaired TOF, Fontan (TCPC)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 block mb-1">Clinical Indication</label>
                <input type="text" value={studyIndication} onChange={(e) => setStudyIndication(e.target.value)} placeholder="e.g. Annual ACHD surveillance, pre-operative evaluation" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
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
                <p className="text-xs text-gray-500">Generate a consolidated PDF report with all results and ASE/ESC/ACC-AHA guideline interpretations.</p>
              </div>
              <Button
                onClick={handleGeneratePDF}
                disabled={isGenerating || resultCount === 0}
                className="flex items-center gap-2 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: NAVY }}
              >
                <Download className="w-4 h-4" />
                {isGenerating ? "Generating..." : "Generate PDF Report"}
              </Button>
            </div>
          )}

          {/* Quick-nav pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {engines.map(({ id, badge, color }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 bg-white hover:shadow-sm transition-all"
                style={{ color }}
              >
                <Activity className="w-3 h-3" />
                {badge}
              </a>
            ))}
          </div>

          {/* Engine cards */}
          <div className="space-y-3">
            {engines.map(({ id, title, badge, color, key, component }) => (
              <EngineSection key={id} id={id} title={title} badge={badge} badgeColor={color} result={results[key]} source="ACHDEchoAssist™">
                {component(makeOnResult(key))}
              </EngineSection>
            ))}
          </div>

          {/* Generate PDF button at bottom */}
          {resultCount > 0 && (
            <div className="mt-8 flex justify-center">
              <Button
                onClick={handleGeneratePDF}
                disabled={isGenerating}
                className="flex items-center gap-2 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-all hover:opacity-90"
                style={{ background: NAVY }}
              >
                <Download className="w-4 h-4" />
                {isGenerating ? "Generating PDF..." : `Generate PDF Report (${resultCount} result${resultCount !== 1 ? "s" : ""})`}
              </Button>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 space-y-1">
            <p className="font-semibold text-gray-500">Guideline References</p>
            <p>• Stout KK et al. 2018 AHA/ACC Guideline for the Management of Adults With Congenital Heart Disease. <em>JACC.</em> 2019;73(12):e81-e192</p>
            <p>• Silversides CK et al. Canadian Cardiovascular Society and Canadian Pediatric Cardiology Association Position Statement on the Spectrum of Complexity of Congenital Heart Disease in the Adult. <em>Can J Cardiol.</em> 2010;26(10):e214-e224</p>
            <p>• Baumgartner H et al. 2020 ESC Guidelines for the Management of Adult Congenital Heart Disease. <em>Eur Heart J.</em> 2021;42(6):563-645</p>
            <p>• Abbas AE et al. Doppler-derived pulmonary vascular resistance. <em>J Am Soc Echocardiogr.</em> 2003;16(11):1101-1105</p>
            <p>• Celermajer DS et al. Ebstein's anomaly: presentation and outcome from fetus to adult. <em>J Am Coll Cardiol.</em> 1994;23(1):170-176</p>
            <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
          </div>
        </div>
      </PremiumGate>
    </>
  );
  if (embedded) return content;
  return <Layout>{content}</Layout>;
}
