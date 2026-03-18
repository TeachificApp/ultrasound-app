/*
  FetalEchoAssist™ — iHeartEcho™
  12 fetal echo calculators with 2023 ASE Fetal Echo Guideline-based feedback
  Reference: Donofrio MT et al. J Am Soc Echocardiogr. 2024;37(1):1-75 (2023 ASE Fetal Echo Guidelines)
  Brand: Teal #189aa1, Aqua #4ad9e0, Navy #0e1e2e
*/
import { useState, useRef, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import Layout from "@/components/Layout";
import { PremiumGate } from "@/components/PremiumGate";
import { Baby, ChevronDown, ChevronUp, Info, Lightbulb, MessageSquare, AlertCircle, Calculator, Activity, FileText, Download, Crown } from "lucide-react";
import { CopyToReportButton } from "@/components/CopyToReportButton";
import { Button } from "@/components/ui/button";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";
const NAVY = "#0e1e2e";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CalcResult {
  name: string;
  value: string;
  interpretation: string;
  normal: boolean | null;
  suggests?: string;
}

// ─── UI Primitives ────────────────────────────────────────────────────────────
function InputRow({ label, unit, value, onChange, placeholder, hint }: {
  label: string; unit?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600">{label}{unit && <span className="font-normal text-gray-400 ml-1">({unit})</span>}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
      />
      {hint && <p className="text-[10px] text-gray-400 leading-tight">{hint}</p>}
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
        <div className="flex gap-2 p-3 rounded-lg" style={{ background: AQUA + "18", borderLeft: `3px solid ${AQUA}` }}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: AQUA }} />
          <p className="text-xs leading-relaxed text-gray-700">{note}</p>
        </div>
      )}
      {tip && (
        <div className="flex gap-2 p-3 rounded-lg" style={{ background: BRAND + "0d", borderLeft: `3px solid ${BRAND}` }}>
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
          <p className="text-xs leading-relaxed text-gray-700">{tip}</p>
        </div>
      )}
    </div>
  );
}

function MetricBadge({ label, value, normal }: { label: string; value: string; normal?: boolean | null }) {
  const color = normal === null || normal === undefined ? "#6b7280"
    : normal ? "#16a34a" : "#dc2626";
  const bg = normal === null || normal === undefined ? "#f3f4f6"
    : normal ? "#dcfce7" : "#fee2e2";
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg" style={{ background: bg }}>
      <span className="text-[10px] text-gray-500 font-medium">{label}</span>
      <span className="text-base font-bold mt-0.5" style={{ color }}>{value}</span>
    </div>
  );
}

// ─── Engine Wrapper ───────────────────────────────────────────────────────────
function EngineSection({ id, title, badge, badgeColor, children, result, source }: {
  id: string; title: string; badge: string; badgeColor: string; children: React.ReactNode;
  result?: CalcResult | null; source?: string;
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

// ─── 1. Celermajer Index ──────────────────────────────────────────────────────
function CelermajerIndex({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [cardiacArea, setCardiacArea] = useState("");
  const [thoracicArea, setThoracicArea] = useState("");

  const ca = parseFloat(cardiacArea);
  const ta = parseFloat(thoracicArea);
  const valid = ca > 0 && ta > 0 && ta > ca;
  const index = valid ? ca / ta : null;

  const normal = index !== null ? index <= 0.35 : null;
  const severity = index === null ? null
    : index <= 0.35 ? "Normal"
    : index <= 0.40 ? "Mildly Enlarged"
    : index <= 0.50 ? "Moderately Enlarged"
    : "Severely Enlarged (Cardiomegaly)";

  const suggests = index !== null
    ? `FetalEchoAssist™ Suggests: Celermajer Index = ${index.toFixed(3)}. ${severity}. ${
        normal ? "Cardiac area is within normal limits (≤0.35). No evidence of cardiomegaly."
        : index <= 0.40 ? "Mildly elevated cardiac-to-thoracic area ratio. Correlate with ventricular function, AV valve regurgitation, and arrhythmia."
        : index <= 0.50 ? "Moderately elevated ratio. Evaluate for structural CHD, AV valve regurgitation, high-output states (fetal anemia, AVM), and cardiac dysfunction."
        : "Severely elevated ratio consistent with cardiomegaly. Urgent evaluation for structural CHD, severe AV valve regurgitation, hydrops fetalis, cardiac tumor, or severe fetal anemia is warranted."
      }`
    : undefined;

  const note = index !== null
    ? `FetalEchoAssist™ Note: The Celermajer Index (cardiac area / thoracic area) is measured on a 4-chamber view at end-diastole. Normal reference: ≤0.35 (ASE 2023 Fetal Echo Guidelines). Values >0.50 are associated with poor perinatal outcomes and warrant fetal MRI and multidisciplinary consultation.`
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Trace the cardiac silhouette at end-diastole on the 4-chamber view. Include pericardial effusion in the cardiac area if present. Ensure the thoracic measurement is at the same level. Repeat in serial scans to track progression.";

  useEffect(() => {
    if (index !== null) {
      onResult({ name: "Celermajer Index", value: index.toFixed(3), interpretation: severity!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [index, severity, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="Cardiac Area" unit="cm²" value={cardiacArea} onChange={setCardiacArea} placeholder="e.g. 2.1" hint="Traced on 4-chamber view at end-diastole" />
        <InputRow label="Thoracic Area" unit="cm²" value={thoracicArea} onChange={setThoracicArea} placeholder="e.g. 7.8" hint="Same cross-section as cardiac area" />
      </div>
      {index !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="Celermajer Index" value={index.toFixed(3)} normal={normal} />
          <MetricBadge label="Interpretation" value={severity!} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Celermajer DS et al. Cardiothoracic ratio in fetal life. Br Heart J. 1992. | ASE 2023 Fetal Echo Guidelines (Donofrio et al. JASE 2024;37:1-75)</p>
    </div>
  );
}

// ─── 1b. SAS Score (Simpson-Andrews-Sharland) — Fetal Ebstein Anomaly ─────────
function SASScore({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [ctr, setCtr] = useState("");
  const [celIdx, setCelIdx] = useState("");
  const [rvlv, setRvlv] = useState("");
  const [pulm, setPulm] = useState<"0"|"1"|"2">("0");
  const [ductal, setDuctal] = useState<"0"|"1"|"2">("0");

  const ctrVal = parseFloat(ctr);
  const celVal = parseFloat(celIdx);
  const rvlvVal = parseFloat(rvlv);

  const ctrScore = isNaN(ctrVal) ? null : ctrVal < 0.65 ? 0 : ctrVal <= 0.75 ? 1 : 2;
  const celScore = isNaN(celVal) ? null : celVal < 1.0 ? 0 : celVal <= 1.5 ? 1 : 2;
  const rvlvScore = isNaN(rvlvVal) ? null : rvlvVal < 1.5 ? 0 : rvlvVal <= 2.0 ? 1 : 2;
  const pulmScore = parseInt(pulm);
  const ductalScore = parseInt(ductal);

  const allValid = ctrScore !== null && celScore !== null && rvlvScore !== null;
  const total = allValid ? ctrScore + celScore + rvlvScore + pulmScore + ductalScore : null;

  const interpretation = total === null ? null
    : total <= 2 ? "Low Risk — Favourable Prognosis"
    : total <= 5 ? "Moderate Risk — Guarded Prognosis"
    : total <= 7 ? "High Risk — Poor Prognosis"
    : "Very High Risk — Critical / Near-Certain Perinatal Mortality";

  const normal = total !== null ? total <= 2 : null;

  const suggests = total !== null
    ? `FetalEchoAssist™ Suggests: SAS Score = ${total}/10. ${interpretation}. ${
        total <= 2
          ? "Score ≤2 is associated with high likelihood of survival. Continue serial fetal surveillance."
          : total <= 5
          ? "Score 3–5 indicates moderate severity. Multidisciplinary fetal cardiac team review recommended. Serial monitoring every 2–4 weeks."
          : total <= 7
          ? "Score 6–7 indicates high severity. Perinatal mortality risk is substantially elevated. Fetal medicine, neonatology, and paediatric cardiology consultation required. Delivery planning at a tertiary centre."
          : "Score ≥8 is associated with very high perinatal mortality. Counsel family regarding guarded prognosis. Consider palliative care discussion alongside active management options."
      }`
    : undefined;

  const note = total !== null
    ? `FetalEchoAssist™ Note: The SAS score (Simpson-Andrews-Sharland, 2008) is a validated fetal prognostic tool for Ebstein anomaly and tricuspid valve dysplasia. It combines five echocardiographic parameters (CTR, Celermajer index, RV/LV ratio, pulmonary flow, ductal flow) scored 0–2 each (total 0–10). Higher scores predict greater perinatal mortality risk. The score should be interpreted alongside gestational age, hydrops status, and functional pulmonary atresia.`
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Measure CTR and Celermajer index on the 4-chamber view at end-diastole. Assess pulmonary flow with colour and spectral Doppler at the pulmonary valve. Evaluate ductal flow direction with colour Doppler from the ductal arch view. Retrograde ductal flow ('circle of death' physiology) is the single most ominous finding.";

  useEffect(() => {
    if (total !== null) {
      onResult({ name: "SAS Score", value: `${total}/10`, interpretation: interpretation!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [total, interpretation, normal]);

  const scoreRow = (label: string, val: number | null) =>
    val !== null ? (
      <div className="flex items-center justify-between text-xs py-0.5">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold" style={{ color: val === 0 ? "#16a34a" : val === 1 ? "#d97706" : "#dc2626" }}>{val}/2</span>
      </div>
    ) : null;

  return (
    <div className="pt-4 space-y-4">
      <InputRow label="Cardiothoracic Ratio (CTR)" unit="" value={ctr} onChange={setCtr} placeholder="e.g. 0.68" hint="Heart area / thoracic area on 4-chamber view at end-diastole" />
      <InputRow label="Celermajer Index (RA+aRV / fRV+LA+LV)" unit="" value={celIdx} onChange={setCelIdx} placeholder="e.g. 1.2" hint="Ratio of right-sided to left-sided cardiac areas" />
      <InputRow label="RV/LV Ratio" unit="" value={rvlv} onChange={setRvlv} placeholder="e.g. 1.8" hint="RV/LV dimension just below MV annulus at end-diastole (4-chamber view)" />
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Pulmonary Blood Flow</label>
        <div className="flex gap-2">
          {(["Normal", "Reduced", "Absent"] as const).map((opt, i) => (
            <button key={opt} onClick={() => setPulm(String(i) as "0"|"1"|"2")}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={{ background: pulm === String(i) ? BRAND : "transparent", color: pulm === String(i) ? "#fff" : BRAND, borderColor: BRAND }}>{opt}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Ductal Flow Direction</label>
        <div className="flex gap-2">
          {(["Anterograde", "Both", "Retrograde"] as const).map((opt, i) => (
            <button key={opt} onClick={() => setDuctal(String(i) as "0"|"1"|"2")}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={{ background: ductal === String(i) ? BRAND : "transparent", color: ductal === String(i) ? "#fff" : BRAND, borderColor: BRAND }}>{opt}</button>
          ))}
        </div>
      </div>
      {allValid && (
        <div className="rounded-lg p-3 space-y-0.5" style={{ background: BRAND + "0d", border: `1px solid ${BRAND}30` }}>
          <p className="text-xs font-bold mb-1" style={{ color: BRAND }}>Score Breakdown</p>
          {scoreRow("CTR", ctrScore)}
          {scoreRow("Celermajer Index", celScore)}
          {scoreRow("RV/LV Ratio", rvlvScore)}
          {scoreRow("Pulmonary Flow", pulmScore)}
          {scoreRow("Ductal Flow", ductalScore)}
          <div className="border-t pt-1 mt-1 flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: BRAND }}>Total SAS Score</span>
            <span className="text-base font-black" style={{ color: total! >= 6 ? "#dc2626" : total! >= 3 ? "#d97706" : "#16a34a" }}>{total}/10</span>
          </div>
        </div>
      )}
      {total !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="SAS Score" value={`${total}/10`} normal={normal} />
          <MetricBadge label="Risk" value={interpretation!} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Andrews RE, Tibby SM, Sharland GK, Simpson JM. Prediction of outcome of tricuspid valve malformations diagnosed during fetal life. <em>Am J Cardiol.</em> 2008;101(7):1046-50. PMID: 18359329.</p>
    </div>
  );
}
// ─── 2. Fetal Cardiovascular Profile Score (CVPS) ────────────────────────────
function CVPSCalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [hydrops, setHydrops] = useState("2");
  const [venousDoppler, setVenousDoppler] = useState("2");
  const [heartSize, setHeartSize] = useState("2");
  const [cardiacFunction, setCardiacFunction] = useState("2");
  const [arterialDoppler, setArterialDoppler] = useState("2");

  const total = parseInt(hydrops) + parseInt(venousDoppler) + parseInt(heartSize) + parseInt(cardiacFunction) + parseInt(arterialDoppler);

  const severity = total === 10 ? "Normal"
    : total >= 8 ? "Mildly Abnormal"
    : total >= 6 ? "Moderately Abnormal"
    : "Severely Abnormal — High Risk";

  const color = total === 10 ? "#16a34a" : total >= 8 ? "#d97706" : total >= 6 ? "#ea580c" : "#dc2626";

  const suggests = `FetalEchoAssist™ Suggests: CVPS = ${total}/10 — ${severity}. ${
    total === 10 ? "All cardiovascular parameters are within normal limits. Continue routine surveillance."
    : total >= 8 ? "Mild cardiovascular compromise. Increase surveillance frequency. Identify and address underlying etiology (anemia, infection, structural CHD)."
    : total >= 6 ? "Moderate cardiovascular compromise. Multidisciplinary fetal medicine consultation recommended. Consider delivery planning and neonatal cardiac team involvement."
    : "Severe cardiovascular compromise. Immediate multidisciplinary evaluation required. High risk of fetal demise. Delivery timing and neonatal resuscitation planning are critical."
  }`;

  const note = `FetalEchoAssist™ Note: The Fetal Cardiovascular Profile Score (CVPS) is a 10-point scoring system (2 points per domain). Each domain scored 0, 1, or 2. Scores ≤6 are associated with significantly increased perinatal mortality (ASE 2023). Domains: Hydrops, Venous Doppler, Heart Size, Cardiac Function, Arterial Doppler.`;

  const tip = "FetalEchoAssist™ Tip: The CVPS should be integrated with biophysical profile (BPP) scoring. A CVPS ≤6 with BPP ≤6 is a strong indicator for delivery if gestational age permits.";

  useEffect(() => {
    onResult({ name: "CVPS", value: `${total}/10`, interpretation: severity, normal: total >= 8, suggests });
  }, [total, severity]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Hydrops", value: hydrops, set: setHydrops, options: [["2","Absent (Normal)"],["1","Isolated effusion"],["0","Generalized hydrops"]] },
          { label: "Venous Doppler (DV/UV)", value: venousDoppler, set: setVenousDoppler, options: [["2","Normal DV a-wave"],["1","Absent DV a-wave"],["0","Reversed DV a-wave / UV pulsations"]] },
          { label: "Heart Size (CTR)", value: heartSize, set: setHeartSize, options: [["2","Normal (≤0.35)"],["1","Mildly enlarged (0.35–0.50)"],["0","Severely enlarged (>0.50)"]] },
          { label: "Cardiac Function", value: cardiacFunction, set: setCardiacFunction, options: [["2","Normal biventricular function"],["1","Moderate dysfunction / mild TR or MR"],["0","Severe dysfunction / severe AV regurgitation"]] },
          { label: "Arterial Doppler (UA)", value: arterialDoppler, set: setArterialDoppler, options: [["2","Normal UA S/D ratio"],["1","Elevated UA PI (absent EDF)"],["0","Reversed UA end-diastolic flow"]] },
        ].map(({ label, value, set, options }) => (
          <div key={label}>
            <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
            <select
              value={value}
              onChange={(e) => set(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
            >
              {options.map(([v, l]) => <option key={v} value={v}>{l} ({v} pts)</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        <MetricBadge label="CVPS Total" value={`${total}/10`} normal={total >= 8} />
        <MetricBadge label="Interpretation" value={severity} normal={total === 10} />
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${total * 10}%`, background: color }} />
      </div>
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Huhta JC. Fetal Cardiovascular Profile Score. Ultrasound Obstet Gynecol. 2005. | ASE 2023 Fetal Echo Guidelines</p>
    </div>
  );
}

// ─── 3. Cardiothoracic Ratio (CTR) ───────────────────────────────────────────
function CardiothoracicRatio({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [mode, setMode] = useState<"diameter"|"circumference">("diameter");
  const [cardiac, setCardiac] = useState("");
  const [thoracic, setThoracic] = useState("");

  const c = parseFloat(cardiac);
  const t = parseFloat(thoracic);
  const valid = c > 0 && t > 0 && t > c;
  const ctr = valid ? c / t : null;
  const normal = ctr !== null ? ctr <= 0.50 : null;

  const severity = ctr === null ? null
    : ctr <= 0.50 ? "Normal"
    : ctr <= 0.55 ? "Mildly Enlarged"
    : ctr <= 0.65 ? "Moderately Enlarged"
    : "Severely Enlarged";

  const suggests = ctr !== null
    ? `FetalEchoAssist™ Suggests: CTR = ${ctr.toFixed(2)} (${mode} method). ${severity}. ${
        normal ? "Cardiac size is within normal limits (CTR ≤0.50). No cardiomegaly detected."
        : `Elevated CTR of ${ctr.toFixed(2)} suggests cardiomegaly. Evaluate for structural CHD, AV valve regurgitation, arrhythmia, fetal anemia, or high-output cardiac state.`
      }`
    : undefined;

  const note = ctr !== null
    ? `FetalEchoAssist™ Note: Normal CTR (cardiac/thoracic ${mode}) is ≤0.50 throughout gestation (ASE 2023). The CTR is measured on the 4-chamber view at end-diastole. A CTR >0.50 is the standard threshold for cardiomegaly in fetal echo.`
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Measure at the widest transverse diameter of the cardiac silhouette (including pericardium). Ensure the image is at the level of the 4-chamber view with the spine posterior. Avoid oblique cuts which falsely elevate the CTR.";

  useEffect(() => {
    if (ctr !== null) {
      onResult({ name: `CTR (${mode})`, value: ctr.toFixed(2), interpretation: severity!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [ctr, mode, severity, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="flex gap-2 mb-2">
        {(["diameter","circumference"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${mode === m ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
            style={mode === m ? { background: BRAND } : {}}
          >
            {m === "diameter" ? "Diameter Method" : "Circumference Method"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InputRow label={`Cardiac ${mode === "diameter" ? "Diameter" : "Circumference"}`} unit="cm" value={cardiac} onChange={setCardiac} placeholder="e.g. 3.2" />
        <InputRow label={`Thoracic ${mode === "diameter" ? "Diameter" : "Circumference"}`} unit="cm" value={thoracic} onChange={setThoracic} placeholder="e.g. 6.8" />
      </div>
      {ctr !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="CTR" value={ctr.toFixed(2)} normal={normal} />
          <MetricBadge label="Interpretation" value={severity!} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ASE 2023 Fetal Echo Guidelines (Donofrio et al. JASE 2024;37:1-75). Normal CTR ≤0.50.</p>
    </div>
  );
}

// ─── 4. Tei Index (MPI) — Fetal ──────────────────────────────────────────────
function FetalTeiIndex({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [chamber, setChamber] = useState<"LV"|"RV">("RV");
  const [ict, setIct] = useState("");
  const [irt, setIrt] = useState("");
  const [et, setEt] = useState("");

  const i = parseFloat(ict);
  const r = parseFloat(irt);
  const e = parseFloat(et);
  const valid = i > 0 && r > 0 && e > 0;
  const mpi = valid ? (i + r) / e : null;

  const normalThreshold = chamber === "RV" ? 0.55 : 0.53;
  const normal = mpi !== null ? mpi <= normalThreshold : null;

  const severity = mpi === null ? null
    : mpi <= normalThreshold ? "Normal"
    : mpi <= normalThreshold + 0.10 ? "Mildly Elevated"
    : mpi <= normalThreshold + 0.20 ? "Moderately Elevated"
    : "Severely Elevated";

  const suggests = mpi !== null
    ? `FetalEchoAssist™ Suggests: ${chamber} Tei Index (MPI) = ${mpi.toFixed(2)}. ${severity}. Normal reference: ${chamber} MPI ≤${normalThreshold} (ASE 2023). ${
        normal ? `${chamber} global myocardial performance is within normal limits.`
        : `Elevated ${chamber} MPI indicates global myocardial dysfunction. Evaluate for structural CHD, cardiomyopathy, fetal infection, or metabolic disorder.`
      }`
    : undefined;

  const note = mpi !== null
    ? `FetalEchoAssist™ Note: The Tei Index (MPI) = (ICT + IRT) / ET. It is load-independent and reflects global ventricular function. Fetal reference values: RV MPI <0.55, LV MPI <0.53.`
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Measure ICT and IRT from AV valve closure to opening intervals. ET is measured from outflow valve opening to closure. Ensure the Doppler sample volume captures both inflow and outflow signals on the same cardiac cycle.";

  useEffect(() => {
    if (mpi !== null) {
      onResult({ name: `${chamber} Tei Index (MPI)`, value: mpi.toFixed(2), interpretation: severity!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [mpi, chamber, severity, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="flex gap-2 mb-2">
        {(["RV","LV"] as const).map((c) => (
          <button key={c} onClick={() => setChamber(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${chamber === c ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
            style={chamber === c ? { background: BRAND } : {}}
          >
            {c} Tei Index
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <InputRow label="ICT" unit="ms" value={ict} onChange={setIct} placeholder="e.g. 42" hint="Isovolumetric contraction time" />
        <InputRow label="IRT" unit="ms" value={irt} onChange={setIrt} placeholder="e.g. 38" hint="Isovolumetric relaxation time" />
        <InputRow label="ET" unit="ms" value={et} onChange={setEt} placeholder="e.g. 145" hint="Ejection time" />
      </div>
      {mpi !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label={`${chamber} MPI`} value={mpi.toFixed(2)} normal={normal} />
          <MetricBadge label={`Normal ≤${normalThreshold}`} value={severity!} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Tsutsumi T et al. Ultrasound Obstet Gynecol. 1999. | ASE 2023 Fetal Echo Guidelines</p>
    </div>
  );
}

// ─── 5. E/A Ratio (AV Inflow) ────────────────────────────────────────────────
function EARatioCalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [valve, setValve] = useState<"Mitral"|"Tricuspid">("Tricuspid");
  const [eWave, setEWave] = useState("");
  const [aWave, setAWave] = useState("");
  const [ga, setGa] = useState("");

  const e = parseFloat(eWave);
  const a = parseFloat(aWave);
  const valid = e > 0 && a > 0;
  const ratio = valid ? e / a : null;
  const aWaveDominant = ratio !== null ? ratio < 1.0 : null;

  const suggests = ratio !== null
    ? `FetalEchoAssist™ Suggests: ${valve} E/A ratio = ${ratio.toFixed(2)}. ${
        aWaveDominant ? "A-wave dominant pattern (E/A <1.0) — normal fetal diastolic filling pattern."
        : "E/A ratio ≥1.0 — E-wave dominant or equalization. Suggests elevated atrial filling pressures, diastolic dysfunction, or myocardial disease."
      }`
    : undefined;

  const note = ratio !== null
    ? "FetalEchoAssist™ Note: Normal fetal E/A ratio is <1.0 throughout gestation (A-wave dominant). The E/A ratio increases with advancing gestational age, approaching but not exceeding 1.0 at term in normal fetuses. E/A >1.0 is abnormal at any gestational age (ASE 2023)."
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Ensure the Doppler beam is parallel to inflow direction. Measure E and A peak velocities at the AV valve tips. Avoid measuring during fetal movement or irregular rhythm.";

  useEffect(() => {
    if (ratio !== null) {
      onResult({ name: `${valve} E/A Ratio`, value: ratio.toFixed(2), interpretation: aWaveDominant ? "A-dominant (Normal)" : "E-dominant (Abnormal)", normal: aWaveDominant, suggests });
    } else {
      onResult(null);
    }
  }, [ratio, valve, aWaveDominant]);

  return (
    <div className="pt-4 space-y-4">
      <div className="flex gap-2 mb-2">
        {(["Tricuspid","Mitral"] as const).map((v) => (
          <button key={v} onClick={() => setValve(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${valve === v ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
            style={valve === v ? { background: BRAND } : {}}
          >
            {v} Valve
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <InputRow label="E Wave" unit="cm/s" value={eWave} onChange={setEWave} placeholder="e.g. 38" hint="Early passive filling" />
        <InputRow label="A Wave" unit="cm/s" value={aWave} onChange={setAWave} placeholder="e.g. 52" hint="Atrial contraction" />
        <InputRow label="Gestational Age" unit="weeks" value={ga} onChange={setGa} placeholder="e.g. 28" hint="Optional context" />
      </div>
      {ratio !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="E/A Ratio" value={ratio.toFixed(2)} normal={aWaveDominant} />
          <MetricBadge label="Pattern" value={aWaveDominant ? "A-dominant (Normal)" : "E-dominant / Equal (Abnormal)"} normal={aWaveDominant} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Respondek M et al. Ultrasound Obstet Gynecol. 1994. | ASE 2023 Fetal Echo Guidelines</p>
    </div>
  );
}

// ─── 6. Ductus Venosus PIV ───────────────────────────────────────────────────
function DuctusVenosusPIV({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [sWave, setSWave] = useState("");
  const [aWave, setAWave] = useState("");
  const [meanVel, setMeanVel] = useState("");

  const s = parseFloat(sWave);
  const a = parseFloat(aWave);
  const vm = parseFloat(meanVel);

  const validPIV = s > 0 && a !== 0 && vm > 0;
  const piv = validPIV ? (s - a) / vm : null;
  const normalPIV = piv !== null ? piv < 0.7 : null;
  const reversedAWave = parseFloat(aWave) < 0;

  const suggests = piv !== null
    ? `FetalEchoAssist™ Suggests: DV PIV = ${piv.toFixed(2)}. ${
        reversedAWave ? "REVERSED DV a-wave detected — critical finding indicating severe fetal cardiovascular compromise. CVPS = 0 for this domain. Immediate multidisciplinary evaluation required."
        : piv < 0.7 ? "Normal ductus venosus PIV. No evidence of venous congestion or right heart compromise."
        : piv < 1.0 ? "Mildly elevated DV PIV. Suggests early venous congestion. Increase surveillance and correlate with UA Doppler and biophysical profile."
        : "Significantly elevated DV PIV. Indicates venous congestion and fetal cardiovascular compromise. Multidisciplinary fetal medicine consultation required."
      }`
    : undefined;

  const note = piv !== null
    ? "FetalEchoAssist™ Note: DV PIV = (S − a) / mean velocity. Normal DV PIV <0.7 (ASE 2023). The DV a-wave reflects right atrial pressure — absent or reversed a-wave indicates severely elevated RA pressure."
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Obtain DV Doppler with the sample volume in the ductus venosus isthmus. Use color Doppler to identify the characteristic aliasing at the DV inlet. Angle correction <30°.";

  useEffect(() => {
    if (piv !== null) {
      onResult({ name: "Ductus Venosus PIV", value: piv.toFixed(2), interpretation: reversedAWave ? "Reversed a-wave (Critical)" : piv < 0.7 ? "Normal" : piv < 1.0 ? "Mildly Elevated" : "Significantly Elevated", normal: normalPIV, suggests });
    } else {
      onResult(null);
    }
  }, [piv, normalPIV, reversedAWave]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <InputRow label="S-wave" unit="cm/s" value={sWave} onChange={setSWave} placeholder="e.g. 65" hint="Systolic peak" />
        <InputRow label="a-wave" unit="cm/s" value={aWave} onChange={setAWave} placeholder="e.g. 22" hint="Atrial contraction (negative if reversed)" />
        <InputRow label="Mean Velocity" unit="cm/s" value={meanVel} onChange={setMeanVel} placeholder="e.g. 40" hint="Time-averaged mean" />
      </div>
      {piv !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="DV PIV" value={piv.toFixed(2)} normal={normalPIV} />
          {reversedAWave && <MetricBadge label="a-wave" value="REVERSED ⚠️" normal={false} />}
          <MetricBadge label="Status" value={piv < 0.7 ? "Normal" : piv < 1.0 ? "Mildly Elevated" : "Significantly Elevated"} normal={normalPIV} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Hecher K et al. Ultrasound Obstet Gynecol. 1995. | ASE 2023 Fetal Echo Guidelines. Normal DV PIV &lt;0.7.</p>
    </div>
  );
}

// ─── 7. Umbilical Artery S/D Ratio & PI ──────────────────────────────────────
function UmbilicalArteryDoppler({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [sVel, setSVel] = useState("");
  const [dVel, setDVel] = useState("");
  const [meanVel, setMeanVel] = useState("");
  const [ga, setGa] = useState("");

  const s = parseFloat(sVel);
  const d = parseFloat(dVel);
  const vm = parseFloat(meanVel);
  const g = parseFloat(ga);

  const validSD = s > 0 && d > 0;
  const validPI = s > 0 && vm > 0;
  const sdRatio = validSD ? s / d : null;
  const pi = validPI ? (s - d) / vm : null;

  const normalSD = sdRatio !== null && g > 0
    ? g >= 36 ? sdRatio <= 2.3 : g >= 28 ? sdRatio <= 3.0 : sdRatio <= 4.0
    : sdRatio !== null ? sdRatio <= 3.0 : null;

  const absentEDF = parseFloat(dVel) <= 0 && dVel !== "";
  const reversedEDF = parseFloat(dVel) < 0;

  const severity = sdRatio === null ? null
    : reversedEDF ? "Reversed EDF — Critical"
    : absentEDF ? "Absent EDF — Critical"
    : normalSD ? "Normal"
    : "Elevated";

  const suggests = sdRatio !== null
    ? `FetalEchoAssist™ Suggests: UA S/D = ${sdRatio.toFixed(2)}${pi !== null ? `, UA PI = ${pi.toFixed(2)}` : ""}. ${severity}. ${
        reversedEDF ? "REVERSED end-diastolic flow is a critical finding indicating severe placental resistance and fetal compromise. Immediate delivery planning required."
        : absentEDF ? "ABSENT end-diastolic flow indicates critically elevated placental resistance. Urgent delivery planning required."
        : normalSD ? "Umbilical artery Doppler is within normal limits for gestational age."
        : "Elevated UA S/D ratio indicates increased placental resistance. Increase surveillance and correlate with biophysical profile and CVPS."
      }`
    : undefined;

  const note = sdRatio !== null
    ? `FetalEchoAssist™ Note: Normal UA S/D decreases with advancing GA (≈4.0 at 20 wks, ≈3.0 at 28 wks, ≈2.3 at 36 wks). Absent or reversed EDF indicates critical placental insufficiency (ASE 2023).`
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Measure UA Doppler in a free loop of cord (not near placental or fetal insertion). Angle correction <30°. Average 3 consecutive waveforms. Absent EDF should be confirmed on 2 separate occasions.";

  useEffect(() => {
    if (sdRatio !== null) {
      onResult({ name: "Umbilical Artery S/D", value: `${sdRatio.toFixed(2)}${pi !== null ? ` (PI: ${pi.toFixed(2)})` : ""}`, interpretation: severity!, normal: normalSD, suggests });
    } else {
      onResult(null);
    }
  }, [sdRatio, pi, severity, normalSD]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InputRow label="S velocity" unit="cm/s" value={sVel} onChange={setSVel} placeholder="e.g. 60" hint="Peak systolic" />
        <InputRow label="D velocity" unit="cm/s" value={dVel} onChange={setDVel} placeholder="e.g. 20" hint="End-diastolic (0 if absent, negative if reversed)" />
        <InputRow label="Mean Velocity" unit="cm/s" value={meanVel} onChange={setMeanVel} placeholder="e.g. 32" hint="Optional — for PI" />
        <InputRow label="Gestational Age" unit="weeks" value={ga} onChange={setGa} placeholder="e.g. 30" hint="For GA-adjusted norms" />
      </div>
      {sdRatio !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="UA S/D Ratio" value={sdRatio.toFixed(2)} normal={normalSD} />
          {pi !== null && <MetricBadge label="UA PI" value={pi.toFixed(2)} normal={null} />}
          <MetricBadge label="Status" value={severity!} normal={normalSD} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Arduini D et al. Ultrasound Obstet Gynecol. 1990. | ASE 2023 Fetal Echo Guidelines.</p>
    </div>
  );
}

// ─── 8. MCA PSV (MoM) ────────────────────────────────────────────────────────
function MCAPSVCalculator({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [mcaPSV, setMcaPSV] = useState("");
  const [ga, setGa] = useState("");

  const psv = parseFloat(mcaPSV);
  const g = parseFloat(ga);

  const getMedian = (wks: number) => {
    const table: Record<number, number> = {
      18: 23.2, 19: 24.8, 20: 25.5, 21: 26.9, 22: 28.0, 23: 29.3, 24: 30.7, 25: 32.8,
      26: 34.0, 27: 35.7, 28: 37.0, 29: 38.7, 30: 40.5, 31: 42.4, 32: 44.1, 33: 46.7,
      34: 48.2, 35: 50.1, 36: 52.0, 37: 54.0, 38: 55.4, 39: 57.0, 40: 58.7,
    };
    const wk = Math.round(wks);
    return table[wk] ?? null;
  };

  const valid = psv > 0 && g >= 18 && g <= 40;
  const median = valid ? getMedian(g) : null;
  const mom = median && psv > 0 ? psv / median : null;
  const anemic = mom !== null ? mom >= 1.5 : null;

  const severity = mom === null ? null
    : mom < 1.0 ? "Below Median — Unlikely Anemia"
    : mom < 1.29 ? "Normal (1.0–1.29 MoM)"
    : mom < 1.5 ? "Borderline (1.29–1.50 MoM)"
    : mom < 1.8 ? "Moderate Anemia (1.50–1.80 MoM)"
    : "Severe Anemia (>1.80 MoM)";

  const suggests = mom !== null
    ? `FetalEchoAssist™ Suggests: MCA PSV = ${psv} cm/s at ${g} weeks. MoM = ${mom.toFixed(2)}. ${severity}. ${
        !anemic ? "MCA PSV is below the 1.5 MoM threshold. Fetal anemia is unlikely."
        : mom < 1.8 ? "MCA PSV ≥1.5 MoM — significant fetal anemia threshold reached. Fetal blood sampling or intrauterine transfusion should be discussed."
        : "MCA PSV >1.8 MoM indicates severe fetal anemia. Urgent fetal medicine consultation required."
      }`
    : undefined;

  const note = mom !== null
    ? "FetalEchoAssist™ Note: MCA PSV ≥1.5 MoM has 100% sensitivity for moderate-to-severe fetal anemia (Hgb <7 g/dL) with <12% false-positive rate (Mari et al. NEJM 2000)."
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Measure MCA PSV at the proximal third of the MCA (near the Circle of Willis origin) using a 0° angle of insonation. Do NOT angle-correct. Use the highest reproducible PSV from 3 measurements.";

  useEffect(() => {
    if (mom !== null) {
      onResult({ name: "MCA PSV (MoM)", value: `${psv} cm/s (MoM: ${mom.toFixed(2)})`, interpretation: severity!, normal: !anemic, suggests });
    } else {
      onResult(null);
    }
  }, [mom, psv, severity, anemic]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="MCA PSV" unit="cm/s" value={mcaPSV} onChange={setMcaPSV} placeholder="e.g. 58" hint="Peak systolic velocity, proximal MCA" />
        <InputRow label="Gestational Age" unit="weeks" value={ga} onChange={setGa} placeholder="e.g. 28" hint="18–40 weeks" />
      </div>
      {mom !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="MCA PSV" value={`${psv} cm/s`} normal={!anemic} />
          <MetricBadge label="Median at GA" value={`${median?.toFixed(1)} cm/s`} normal={null} />
          <MetricBadge label="MoM" value={mom.toFixed(2)} normal={!anemic} />
          <MetricBadge label="Interpretation" value={severity!} normal={!anemic} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Mari G et al. N Engl J Med. 2000;342:9-14. | ASE 2023 Fetal Echo Guidelines. Threshold: ≥1.5 MoM.</p>
    </div>
  );
}

// ─── 9. Fetal Heart Rate Classification ──────────────────────────────────────
function FetalHRZScore({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [fhr, setFhr] = useState("");
  const [ga, setGa] = useState("");

  const hr = parseFloat(fhr);
  const g = parseFloat(ga);
  const valid = hr > 0 && g >= 10;

  const lowerNormal = g <= 14 ? 110 : 120;
  const upperNormal = g <= 14 ? 170 : 160;

  const normal = valid ? hr >= lowerNormal && hr <= upperNormal : null;

  const classification = !valid ? null
    : hr < 100 ? "Severe Bradycardia (<100 bpm)"
    : hr < lowerNormal ? "Bradycardia"
    : hr > 200 ? "Severe Tachycardia (>200 bpm — SVT/VT)"
    : hr > 180 ? "Tachycardia (>180 bpm)"
    : hr > upperNormal ? "Mild Tachycardia"
    : "Normal";

  const suggests = valid
    ? `FetalEchoAssist™ Suggests: FHR = ${hr} bpm at ${g} weeks. ${classification}. Normal range: ${lowerNormal}–${upperNormal} bpm. ${
        normal ? "Fetal heart rate is within normal limits."
        : hr < lowerNormal ? `Fetal bradycardia detected. ${hr < 100 ? "Severe bradycardia — urgent evaluation for complete heart block, severe fetal compromise, or cord compression." : "Evaluate for sinus bradycardia, blocked PACs, or 2:1 AV block."}`
        : `Fetal tachycardia detected. ${hr > 200 ? "Rate >200 bpm consistent with SVT or atrial flutter. Urgent fetal cardiology consultation required." : "Evaluate for sinus tachycardia vs. SVT."}`
      }`
    : undefined;

  const note = valid
    ? `FetalEchoAssist™ Note: Normal FHR is 120–160 bpm after 14 weeks (ASE 2023). Sustained tachycardia >200 bpm requires urgent evaluation — SVT and atrial flutter can cause hydrops fetalis within 24–48 hours.`
    : undefined;

  const tip = "FetalEchoAssist™ Tip: For rhythm characterization, use M-mode through both an atrial wall and ventricular wall simultaneously, or use simultaneous PW Doppler of mitral inflow and aortic outflow.";

  useEffect(() => {
    if (valid) {
      onResult({ name: "Fetal Heart Rate", value: `${hr} bpm`, interpretation: classification!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [hr, g, valid, classification, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="Fetal Heart Rate" unit="bpm" value={fhr} onChange={setFhr} placeholder="e.g. 145" hint="Measured over ≥10 seconds" />
        <InputRow label="Gestational Age" unit="weeks" value={ga} onChange={setGa} placeholder="e.g. 24" hint="10–40 weeks" />
      </div>
      {valid && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="FHR" value={`${hr} bpm`} normal={normal} />
          <MetricBadge label={`Normal: ${lowerNormal}–${upperNormal} bpm`} value={classification!} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ASE 2023 Fetal Echo Guidelines. Normal FHR 120–160 bpm (&gt;14 wks).</p>
    </div>
  );
}

// ─── 10. PA/Ao Ratio ─────────────────────────────────────────────────────────
function PAAoRatio({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [pa, setPa] = useState("");
  const [ao, setAo] = useState("");

  const p = parseFloat(pa);
  const a = parseFloat(ao);
  const valid = p > 0 && a > 0;
  const ratio = valid ? p / a : null;
  const normal = ratio !== null ? ratio >= 0.7 && ratio <= 1.5 : null;

  const severity = ratio === null ? null
    : ratio < 0.5 ? "Severely Reduced — Possible PS/PA or HLHS"
    : ratio < 0.7 ? "Reduced — Possible Pulmonary Stenosis"
    : ratio <= 1.5 ? "Normal (0.7–1.5)"
    : ratio <= 2.0 ? "Elevated — Possible AS or CoA"
    : "Severely Elevated — Possible Severe AS/HLHS";

  const suggests = ratio !== null
    ? `FetalEchoAssist™ Suggests: PA/Ao ratio = ${ratio.toFixed(2)}. ${severity}. ${
        normal ? "PA/Ao ratio is within normal limits. No significant outflow tract disproportion detected."
        : ratio < 0.7 ? "Reduced PA/Ao ratio suggests relative pulmonary outflow hypoplasia. Evaluate for pulmonary stenosis, pulmonary atresia, or tetralogy of Fallot."
        : "Elevated PA/Ao ratio suggests relative aortic outflow hypoplasia. Evaluate for aortic stenosis, HLHS, or coarctation of the aorta."
      }`
    : undefined;

  const note = ratio !== null
    ? "FetalEchoAssist™ Note: Normal fetal PA/Ao ratio is approximately 1.0–1.2 (PA slightly larger than Ao due to right-dominant fetal circulation). Significant disproportion (ratio <0.7 or >1.5) warrants detailed evaluation (ASE 2023)."
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Measure PA and Ao at the semilunar valve annulus level (inner edge to inner edge) at end-diastole. Use the 3-vessel view for PA and the LVOT view for Ao.";

  useEffect(() => {
    if (ratio !== null) {
      onResult({ name: "PA/Ao Ratio", value: ratio.toFixed(2), interpretation: severity!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [ratio, severity, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputRow label="Pulmonary Artery (PA)" unit="mm" value={pa} onChange={setPa} placeholder="e.g. 5.2" hint="At semilunar valve annulus" />
        <InputRow label="Aorta (Ao)" unit="mm" value={ao} onChange={setAo} placeholder="e.g. 4.8" hint="At semilunar valve annulus" />
      </div>
      {ratio !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label="PA/Ao Ratio" value={ratio.toFixed(2)} normal={normal} />
          <MetricBadge label="Interpretation" value={severity!} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ASE 2023 Fetal Echo Guidelines. Normal PA/Ao ratio 0.7–1.5.</p>
    </div>
  );
}

// ─── 11. Ventricular Wall Thickness Z-score ───────────────────────────────────
function VentricularWallThickness({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [chamber, setChamber] = useState<"IVS"|"LVPW"|"RVW">("IVS");
  const [thickness, setThickness] = useState("");
  const [ga, setGa] = useState("");

  const t = parseFloat(thickness);
  const g = parseFloat(ga);
  const valid = t > 0 && g >= 18 && g <= 40;

  const getMean = () => chamber === "RVW" ? 0.12 * g - 0.6 : 0.14 * g - 0.8;
  const getSD = () => chamber === "RVW" ? 0.4 : 0.5;

  const mean = valid ? getMean() : null;
  const sd = valid ? getSD() : null;
  const zscore = mean !== null && sd !== null ? (t - mean) / sd : null;
  const normal = zscore !== null ? zscore >= -2 && zscore <= 2 : null;

  const severity = zscore === null ? null
    : zscore > 4 ? "Severely Hypertrophied (Z >+4)"
    : zscore > 2 ? "Hypertrophied (Z >+2)"
    : zscore >= -2 ? "Normal (Z −2 to +2)"
    : zscore >= -4 ? "Thin (Z <−2)"
    : "Severely Thin (Z <−4)";

  const suggests = zscore !== null
    ? `FetalEchoAssist™ Suggests: ${chamber} thickness = ${t} mm at ${g} weeks. Z-score = ${zscore.toFixed(1)}. ${severity}. ${
        normal ? `${chamber} thickness is within the normal range for gestational age.`
        : zscore > 2 ? `Increased ${chamber} thickness (Z = ${zscore.toFixed(1)}). Evaluate for fetal hypertrophic cardiomyopathy — causes include maternal diabetes (most common), Noonan syndrome, Pompe disease, Barth syndrome.`
        : `Reduced ${chamber} thickness (Z = ${zscore.toFixed(1)}). Evaluate for dilated cardiomyopathy, myocarditis, or ventricular hypoplasia.`
      }`
    : undefined;

  const note = zscore !== null
    ? `FetalEchoAssist™ Note: Ventricular wall thickness increases linearly with gestational age. Z-scores >+2 suggest hypertrophy; the most common cause is maternal diabetes mellitus. Z-scores <−2 suggest hypoplasia or cardiomyopathy (ASE 2023).`
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Measure IVS and LVPW at end-diastole on the parasternal short-axis or 4-chamber view. Avoid including trabeculations in the measurement. Use M-mode for reproducibility.";

  useEffect(() => {
    if (zscore !== null) {
      onResult({ name: `${chamber} Wall Thickness Z-score`, value: `${t} mm (Z: ${zscore.toFixed(1)})`, interpretation: severity!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [zscore, chamber, t, severity, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="flex gap-2 mb-2">
        {(["IVS","LVPW","RVW"] as const).map((c) => (
          <button key={c} onClick={() => setChamber(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${chamber === c ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
            style={chamber === c ? { background: BRAND } : {}}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InputRow label={`${chamber} Thickness`} unit="mm" value={thickness} onChange={setThickness} placeholder="e.g. 3.2" hint="At end-diastole" />
        <InputRow label="Gestational Age" unit="weeks" value={ga} onChange={setGa} placeholder="e.g. 28" hint="18–40 weeks" />
      </div>
      {zscore !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label={`${chamber} (mm)`} value={`${t} mm`} normal={normal} />
          <MetricBadge label="Z-score" value={zscore.toFixed(1)} normal={normal} />
          <MetricBadge label="Interpretation" value={severity!} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: Schneider C et al. Ultrasound Obstet Gynecol. 2005. | ASE 2023 Fetal Echo Guidelines.</p>
    </div>
  );
}

// ─── 12. Shortening Fraction (SF) — Fetal ────────────────────────────────────
function FetalSF({ onResult }: { onResult: (r: CalcResult | null) => void }) {
  const [chamber, setChamber] = useState<"LV"|"RV">("LV");
  const [edd, setEdd] = useState("");
  const [esd, setEsd] = useState("");

  const d = parseFloat(edd);
  const s = parseFloat(esd);
  const valid = d > 0 && s > 0 && d > s;
  const sf = valid ? ((d - s) / d) * 100 : null;
  const normal = sf !== null ? sf >= 28 && sf <= 40 : null;

  const severity = sf === null ? null
    : sf < 18 ? "Severely Reduced (<18%)"
    : sf < 28 ? "Reduced (18–28%)"
    : sf <= 40 ? "Normal (28–40%)"
    : sf <= 50 ? "Hyperdynamic (40–50%)"
    : "Severely Hyperdynamic (>50%)";

  const suggests = sf !== null
    ? `FetalEchoAssist™ Suggests: ${chamber} Shortening Fraction = ${sf.toFixed(1)}%. ${severity}. ${
        normal ? `${chamber} systolic function is within normal limits. Normal fetal SF is 28–40%.`
        : sf < 28 ? `Reduced ${chamber} SF indicates systolic dysfunction. Evaluate for cardiomyopathy, myocarditis, structural CHD with pressure/volume overload, or fetal compromise.`
        : `Hyperdynamic ${chamber} SF. Evaluate for high-output states (fetal anemia, AVM, thyrotoxicosis) or early compensatory response to volume overload.`
      }`
    : undefined;

  const note = sf !== null
    ? "FetalEchoAssist™ Note: Normal fetal SF is 28–40% (ASE 2023). SF is measured from M-mode or 2D at the level of the mitral/tricuspid valve chordae. SF <28% indicates systolic dysfunction; SF >40% may indicate a hyperdynamic state."
    : undefined;

  const tip = "FetalEchoAssist™ Tip: Measure EDD and ESD at the level of the chordae tendineae on the 4-chamber view. Use M-mode for reproducibility. Ensure measurements are perpendicular to the ventricular walls. Avoid foreshortened views.";

  useEffect(() => {
    if (sf !== null) {
      onResult({ name: `${chamber} Shortening Fraction`, value: `${sf.toFixed(1)}%`, interpretation: severity!, normal, suggests });
    } else {
      onResult(null);
    }
  }, [sf, chamber, severity, normal]);

  return (
    <div className="pt-4 space-y-4">
      <div className="flex gap-2 mb-2">
        {(["LV","RV"] as const).map((c) => (
          <button key={c} onClick={() => setChamber(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${chamber === c ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
            style={chamber === c ? { background: BRAND } : {}}
          >
            {c} SF
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InputRow label={`${chamber} EDD`} unit="mm" value={edd} onChange={setEdd} placeholder="e.g. 18.4" hint="End-diastolic dimension" />
        <InputRow label={`${chamber} ESD`} unit="mm" value={esd} onChange={setEsd} placeholder="e.g. 11.2" hint="End-systolic dimension" />
      </div>
      {sf !== null && (
        <div className="flex gap-3 flex-wrap">
          <MetricBadge label={`${chamber} SF`} value={`${sf.toFixed(1)}%`} normal={normal} />
          <MetricBadge label="Normal: 28–40%" value={severity!} normal={normal} />
        </div>
      )}
      <ResultPanel suggests={suggests} note={note} tip={tip} />
      <p className="text-[10px] text-gray-400">Reference: ASE 2023 Fetal Echo Guidelines (Donofrio et al. JASE 2024;37:1-75). Normal fetal SF 28–40%.</p>
    </div>
  );
}

// ─── PDF Report Generator ─────────────────────────────────────────────────────
async function generatePDFReport(
  results: Record<string, CalcResult>,
  patientInfo: { ga: string; date: string; operator: string; indication: string }
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const TEAL = [24, 154, 161] as [number, number, number];
  const NAVY = [14, 30, 46] as [number, number, number];
  const LIGHT_TEAL = [240, 251, 252] as [number, number, number];
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Header ──
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setFillColor(...TEAL);
  doc.rect(0, 28, pageW, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FetalEchoAssist\u2122 Clinical Report", margin, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Fetal Echo Calculator Engine \u2014 Guideline-Based Interpretation", margin, 21);
  doc.text("iHeartEcho\u2122 | All About Ultrasound | www.iheartecho.com", margin, 27);
  y = 38;

  // ── Patient Info ──
  doc.setFillColor(...LIGHT_TEAL);
  doc.roundedRect(margin, y, contentW, 28, 2, 2, "F");
  doc.setTextColor(...NAVY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Study Information", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const col1x = margin + 4;
  const col2x = margin + contentW / 2;
  const infoY = y + 12;
  doc.text(`Gestational Age: ${patientInfo.ga || "—"} weeks`, col1x, infoY);
  doc.text(`Study Date: ${patientInfo.date || new Date().toLocaleDateString()}`, col2x, infoY);
  doc.text(`Operator: ${patientInfo.operator || "—"}`, col1x, infoY + 7);
  if (patientInfo.indication) {
    doc.text(`Indication: ${patientInfo.indication}`, col2x, infoY + 7);
  }
  y += 28;

  // ── Results Table ──
  const resultEntries = Object.values(results);
  if (resultEntries.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(10);
    doc.text("No calculator results to display.", margin, y + 10);
    y += 20;
  } else {
    // Section header
    doc.setFillColor(...TEAL);
    doc.rect(margin, y, contentW, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Calculator Results Summary", margin + 3, y + 5.5);
    y += 10;

    // Column headers
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, contentW, 7, "F");
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.text("Calculator", margin + 3, y + 5);
    doc.text("Result", margin + 65, y + 5);
    doc.text("Interpretation", margin + 100, y + 5);
    doc.text("Status", margin + 155, y + 5);
    y += 9;

    // Rows
    resultEntries.forEach((r, idx) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const rowBg: [number, number, number] = idx % 2 === 0 ? [255, 255, 255] : [248, 252, 252];
      doc.setFillColor(...rowBg);
      doc.rect(margin, y, contentW, 8, "F");

      // Status indicator
      const statusColor: [number, number, number] = r.normal === null ? [107, 114, 128] : r.normal ? [22, 163, 74] : [220, 38, 38];
      doc.setFillColor(...statusColor);
      doc.circle(margin + 158, y + 4, 2, "F");

      doc.setTextColor(...NAVY);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      const nameLines = doc.splitTextToSize(r.name, 58);
      doc.text(nameLines[0], margin + 3, y + 5);
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(r.value, 32)[0], margin + 65, y + 5);
      doc.text(doc.splitTextToSize(r.interpretation, 50)[0], margin + 100, y + 5);
      doc.setTextColor(...statusColor);
      doc.setFontSize(7);
      doc.text(r.normal === null ? "N/A" : r.normal ? "Normal" : "Abnormal", margin + 163, y + 5);
      y += 9;
    });
    y += 4;
  }

  // ── Detailed Interpretations ──
  if (resultEntries.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFillColor(...TEAL);
    doc.rect(margin, y, contentW, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("FetalEchoAssist\u2122 Guideline-Based Interpretations", margin + 3, y + 5.5);
    y += 12;

    resultEntries.forEach((r) => {
      if (!r.suggests) return;
      if (y > 255) { doc.addPage(); y = 20; }

      // Calc name header
      doc.setFillColor(...LIGHT_TEAL);
      doc.roundedRect(margin, y, contentW, 6, 1, 1, "F");
      doc.setTextColor(...TEAL);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`${r.name}: ${r.value}`, margin + 3, y + 4.2);
      y += 8;

      // Suggests text
      doc.setTextColor(55, 65, 81);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(r.suggests.replace("FetalEchoAssist\u2122 Suggests: ", ""), contentW - 6);
      lines.forEach((line: string) => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(line, margin + 3, y);
        y += 4.5;
      });
      y += 3;
    });
  }

  // ── Disclaimer ──
  if (y > 255) { doc.addPage(); y = 20; }
  y += 4;
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin, y, contentW, 20, 2, 2, "F");
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Clinical Disclaimer", margin + 3, y + 5);
  doc.setFont("helvetica", "normal");
  const disclaimer = "This report is generated by FetalEchoAssist\u2122 for educational and clinical decision support purposes only. All values must be interpreted in the context of the complete fetal echocardiographic examination, clinical history, and gestational age. This tool does not replace the judgment of a qualified fetal cardiologist or maternal-fetal medicine specialist. Reference: Donofrio MT et al. J Am Soc Echocardiogr. 2024;37(1):1-75 (2023 ASE Fetal Echo Guidelines).";
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentW - 6);
  disclaimerLines.forEach((line: string, i: number) => {
    doc.text(line, margin + 3, y + 10 + i * 4);
  });
  y += 26;

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, 287, pageW, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("FetalEchoAssist\u2122 \u2014 iHeartEcho\u2122 | All About Ultrasound | www.iheartecho.com", margin, 293);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin - 15, 293);
    doc.text("Reference: Donofrio MT et al. J Am Soc Echocardiogr. 2024;37(1):1-75", margin, 297);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`FetalEchoAssist-Report-${dateStr}.pdf`);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FetalEchoAssist() {
  const search = useSearch();
  const [results, setResults] = useState<Record<string, CalcResult>>({});
  const [patientGA, setPatientGA] = useState("");
  const [patientDate, setPatientDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [patientOperator, setPatientOperator] = useState("");

  const [patientIndication, setPatientIndication] = useState("");
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
        ga: patientGA,
        date: patientDate,
        operator: patientOperator,
        indication: patientIndication,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const engines = [
    { id: "engine-celermajer", title: "Celermajer Index", badge: "Cardiomegaly", color: BRAND, key: "celermajer", component: (onResult: (r: CalcResult | null) => void) => <CelermajerIndex onResult={onResult} /> },
    { id: "engine-sas", title: "SAS Score — Fetal Ebstein Anomaly", badge: "Ebstein / TVD", color: BRAND, key: "sas", component: (onResult: (r: CalcResult | null) => void) => <SASScore onResult={onResult} /> },
    { id: "engine-cvps", title: "Fetal Cardiovascular Profile Score (CVPS)", badge: "Global Assessment", color: BRAND, key: "cvps", component: (onResult: (r: CalcResult | null) => void) => <CVPSCalculator onResult={onResult} /> },
    { id: "engine-ctr", title: "Cardiothoracic Ratio (CTR)", badge: "Cardiomegaly", color: BRAND, key: "ctr", component: (onResult: (r: CalcResult | null) => void) => <CardiothoracicRatio onResult={onResult} /> },
    { id: "engine-tei", title: "Tei Index (MPI) — Fetal", badge: "Global Function", color: BRAND, key: "tei", component: (onResult: (r: CalcResult | null) => void) => <FetalTeiIndex onResult={onResult} /> },
    { id: "engine-ea", title: "E/A Ratio (AV Inflow)", badge: "Diastolic Function", color: BRAND, key: "ea", component: (onResult: (r: CalcResult | null) => void) => <EARatioCalculator onResult={onResult} /> },
    { id: "engine-dv", title: "Ductus Venosus PIV", badge: "Venous Doppler", color: BRAND, key: "dv", component: (onResult: (r: CalcResult | null) => void) => <DuctusVenosusPIV onResult={onResult} /> },
    { id: "engine-ua", title: "Umbilical Artery S/D Ratio & PI", badge: "Placental Resistance", color: BRAND, key: "ua", component: (onResult: (r: CalcResult | null) => void) => <UmbilicalArteryDoppler onResult={onResult} /> },
    { id: "engine-mca", title: "MCA PSV (MoM) — Fetal Anemia Screen", badge: "Fetal Anemia", color: BRAND, key: "mca", component: (onResult: (r: CalcResult | null) => void) => <MCAPSVCalculator onResult={onResult} /> },
    { id: "engine-fhr", title: "Fetal Heart Rate Classification", badge: "Rhythm", color: BRAND, key: "fhr", component: (onResult: (r: CalcResult | null) => void) => <FetalHRZScore onResult={onResult} /> },
    { id: "engine-paao", title: "PA/Ao Ratio", badge: "Outflow Tracts", color: BRAND, key: "paao", component: (onResult: (r: CalcResult | null) => void) => <PAAoRatio onResult={onResult} /> },
    { id: "engine-wallthick", title: "Ventricular Wall Thickness Z-score", badge: "Hypertrophy", color: BRAND, key: "wallthick", component: (onResult: (r: CalcResult | null) => void) => <VentricularWallThickness onResult={onResult} /> },
    { id: "engine-sf", title: "Shortening Fraction (SF) — Fetal", badge: "Systolic Function", color: BRAND, key: "sf", component: (onResult: (r: CalcResult | null) => void) => <FetalSF onResult={onResult} /> },
  ];

  return (
    <Layout>
      {/* Header — always visible */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0e4a50 60%, ${BRAND} 100%)` }}>
        <div className="container py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: AQUA + "30" }}>
              <Baby className="w-5 h-5" style={{ color: AQUA }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                  FetalEchoAssist™
                </h1>
                <span className="inline-flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Crown className="w-3 h-3" /> Premium
                </span>
              </div>
              <p className="text-sm" style={{ color: AQUA }}>
                Fetal Echo Calculator Engine — Guideline-Based Interpretation
              </p>
            </div>
          </div>
          <p className="text-white/60 text-xs max-w-2xl mt-2">
            Enter raw fetal echo measurements for instant guideline-based interpretation. References and normal ranges are cited within each calculator.
          </p>
        </div>
      </div>

      {/* Premium Gate wraps all calculator content */}
      <PremiumGate featureName="FetalEchoAssist™ Calculator Engine">
        <div className="container py-8">

          {/* Patient / Study Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" style={{ color: BRAND }} />
              <h2 className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Study Information (for PDF Report)</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Gestational Age (weeks)</label>
                <input type="text" value={patientGA} onChange={(e) => setPatientGA(e.target.value)} placeholder="e.g. 28+3" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Study Date</label>
                <input type="date" value={patientDate} onChange={(e) => setPatientDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Operator / Sonographer</label>
                <input type="text" value={patientOperator} onChange={(e) => setPatientOperator(e.target.value)} placeholder="Name or initials" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 block mb-1">Clinical Indication</label>
                <input type="text" value={patientIndication} onChange={(e) => setPatientIndication(e.target.value)} placeholder="e.g. Suspected CHD, fetal hydrops, maternal diabetes" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white" />
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
                <p className="text-xs text-gray-500">Generate a consolidated PDF report with all results and guideline-based interpretations.</p>
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
              <EngineSection key={id} id={id} title={title} badge={badge} badgeColor={color} result={results[key]} source="FetalEchoAssist™">
                {component(makeOnResult(key))}
              </EngineSection>
            ))}
          </div>

          {/* Generate PDF button at bottom too */}
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
            <p>• Donofrio MT et al. Diagnosis and Treatment of Fetal Cardiac Disease: A Scientific Statement from the American Heart Association. <em>J Am Soc Echocardiogr.</em> 2024;37(1):1-75 (2023 ASE Fetal Echo Guidelines)</p>
            <p>• Mari G et al. Noninvasive diagnosis by Doppler ultrasonography of fetal anemia due to maternal red-cell alloimmunization. <em>N Engl J Med.</em> 2000;342:9-14</p>
            <p>• Huhta JC. Fetal Cardiovascular Profile Score. <em>Ultrasound Obstet Gynecol.</em> 2005;25:550-555</p>
            <p>• Celermajer DS et al. Cardiothoracic ratio in fetal life. <em>Br Heart J.</em> 1992;68:534-538</p>
            <p>• Tsutsumi T et al. Evaluation of ductus venosus blood flow velocity waveforms. <em>Ultrasound Obstet Gynecol.</em> 1999;13:26-29</p>
            <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
          </div>
        </div>
      </PremiumGate>
    </Layout>
  );
}
