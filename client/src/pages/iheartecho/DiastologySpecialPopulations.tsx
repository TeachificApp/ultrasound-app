/*
  DiastologySpecialPopulations.tsx — iHeartEcho™
  Five guideline-specific diastolic function calculators for special populations.
  Each engine implements the exact ASE 2025 algorithm from the guideline figures.

  Engines:
  1. MAC — E/A ratio → IVRT branch
  2. Heart Transplant — Average E/e' → E/SR_IVR or TR velocity
  3. Pulmonary HTN — E/A + E velocity → LARS → lateral E/e'
  4. Atrial Fibrillation — 4-criteria count → LARS/PV S/D/BMI secondary
  5. Constrictive vs Restrictive — E/A + IVC → respirophasic VSM → medial e' → annulus reversus → hepatic vein

  Reference: ASE 2025 LV Diastolic Function Guidelines (Nagueh et al.)
  https://www.asecho.org/wp-content/uploads/2025/07/Left-Ventricular-Diastolic-Function.pdf
*/

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Info, Lightbulb, Lock, Crown } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { PremiumOverlay } from "@/components/PremiumOverlay";

// ─── UI PRIMITIVES ─────────────────────────────────────────────────────────────

function NumInput({
  label, value, onChange, unit, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal text-xs">{hint}</span>}
      </label>
      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#189aa1]/30 focus-within:border-[#189aa1]">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "—"}
          className="flex-1 px-3 py-2 text-sm outline-none bg-white"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        />
        {unit && (
          <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 font-medium whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function CheckInput({
  label, checked, onChange, hint,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#189aa1] focus:ring-[#189aa1]"
      />
      <span className="text-xs text-gray-700 group-hover:text-gray-900">
        {label}
        {hint && <span className="ml-1 text-gray-400">{hint}</span>}
      </span>
    </label>
  );
}

type LAPResult = "normal" | "elevated" | "indeterminate" | "low";

const lapConfig: Record<LAPResult, { bg: string; border: string; text: string; badge: string; label: string }> = {
  normal:        { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#16a34a", label: "Normal LAP" },
  elevated:      { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#dc2626", label: "Elevated LAP" },
  indeterminate: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569", badge: "#189aa1", label: "Indeterminate" },
  low:           { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#16a34a", label: "LAP < 15 mmHg" },
};

function LAPResultCard({
  result, title, criteria, note, tip,
}: {
  result: LAPResult; title: string; criteria: string[]; note?: string; tip?: string;
}) {
  const c = lapConfig[result];
  return (
    <div className="rounded-xl border p-4 mt-3 animate-in fade-in duration-300" style={{ background: c.bg, borderColor: c.border }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.text }}>{title}</span>
          <div className="text-xl font-bold mt-0.5" style={{ color: c.text, fontFamily: "Merriweather, serif" }}>{c.label}</div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold text-white flex-shrink-0 mt-1" style={{ background: c.badge }}>
          {c.label}
        </span>
      </div>
      {criteria.length > 0 && (
        <ul className="mt-2 space-y-1">
          {criteria.map((cr, i) => (
            <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: c.text }}>
              <span className="mt-0.5 flex-shrink-0">•</span>
              <span>{cr}</span>
            </li>
          ))}
        </ul>
      )}
      {note && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{note}</p>
        </div>
      )}
      {tip && (
        <div className="mt-2 flex items-start gap-2 bg-[#f0fbfc] border border-[#b2e8ec] rounded-lg px-3 py-2">
          <Lightbulb className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#0e7490]">{tip}</p>
        </div>
      )}
    </div>
  );
}

function EngineSection({
  title, subtitle, children, id, defaultOpen = false,
}: {
  title: string; subtitle?: string; children: React.ReactNode; id?: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full teal-header px-5 py-3 flex items-center justify-between"
      >
        <div className="text-left">
          <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{title}</h3>
          {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

const n = (v: string) => parseFloat(v);
const has = (...vals: string[]) => vals.every(v => v !== "" && !isNaN(parseFloat(v)));

// ─── 1. MAC ENGINE ─────────────────────────────────────────────────────────────
// Algorithm for estimation of mean LAP in patients with moderate or severe MAC
// E/A ratio → IVRT branch
function MACEngine() {
  const [ea, setEa] = useState("");
  const [ivrt, setIvrt] = useState("");

  type MACResult = { result: LAPResult; criteria: string[]; note?: string; tip?: string } | null;

  const calc = (): MACResult => {
    if (!has(ea)) return null;
    const eaVal = n(ea);

    if (eaVal < 0.8) {
      return {
        result: "normal",
        criteria: ["E/A < 0.8 → Normal LA pressure"],
        tip: "E/A < 0.8 in MAC reliably predicts normal LAP without requiring further assessment.",
      };
    }

    if (eaVal > 1.8) {
      return {
        result: "elevated",
        criteria: ["E/A > 1.8 → Elevated LA pressure"],
        tip: "E/A > 1.8 in MAC reliably predicts elevated LAP.",
      };
    }

    // E/A 0.8–1.8: use IVRT
    if (!has(ivrt)) {
      return {
        result: "indeterminate",
        criteria: ["E/A 0.8–1.8 → IVRT required to determine LAP"],
        note: "Enter IVRT to complete the algorithm.",
      };
    }

    const ivrtVal = n(ivrt);
    if (ivrtVal >= 80) {
      return {
        result: "normal",
        criteria: [`E/A ${eaVal} (0.8–1.8)`, `IVRT ${ivrtVal} ms ≥ 80 ms → Normal LA pressure`],
        tip: "IVRT ≥ 80 ms in the intermediate E/A range predicts normal LAP in MAC patients.",
      };
    } else {
      return {
        result: "elevated",
        criteria: [`E/A ${eaVal} (0.8–1.8)`, `IVRT ${ivrtVal} ms < 80 ms → Elevated LA pressure`],
        tip: "IVRT < 80 ms in the intermediate E/A range predicts elevated LAP in MAC patients.",
      };
    }
  };

  const result = calc();

  return (
    <EngineSection
      id="engine-mac"
      title="MAC — LAP Estimation"
      subtitle="Algorithm for moderate or severe mitral annular calcification"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <NumInput label="Mitral E/A Ratio" value={ea} onChange={setEa} placeholder="e.g. 1.2" hint="(dimensionless)" />
        <NumInput label="IVRT" value={ivrt} onChange={setIvrt} unit="ms" placeholder="e.g. 75" hint="(required if E/A 0.8–1.8)" />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>Algorithm (ASE 2025):</strong> E/A &lt; 0.8 → Normal LAP. E/A &gt; 1.8 → Elevated LAP. E/A 0.8–1.8 → use IVRT: ≥ 80 ms = Normal, &lt; 80 ms = Elevated.
        </p>
      </div>

      {result && (
        <LAPResultCard
          result={result.result}
          title="MAC LAP Estimation"
          criteria={result.criteria}
          note={result.note}
          tip={result.tip}
        />
      )}
      <p className="text-xs text-gray-400 mt-3">Reference: ASE 2025 LV Diastolic Function Guidelines (Nagueh et al.)</p>
    </EngineSection>
  );
}

// ─── 2. HEART TRANSPLANT ENGINE ────────────────────────────────────────────────
// Algorithm for estimation of mean LAP in heart transplant recipients in sinus rhythm
// Average E/e' → E/SR_IVR or TR velocity branch
function HeartTransplantEngine() {
  const [avgEe, setAvgEe] = useState("");
  const [esrIvr, setEsrIvr] = useState(""); // E/SR_IVR in cm
  const [trVel, setTrVel] = useState("");   // TR velocity m/s

  type HTResult = { result: LAPResult; label: string; criteria: string[]; note?: string; tip?: string } | null;

  const calc = (): HTResult => {
    if (!has(avgEe)) return null;
    const eeVal = n(avgEe);

    if (eeVal < 7) {
      return {
        result: "low",
        label: "LAP < 15 mmHg",
        criteria: ["Average E/e' < 7 → LAP < 15 mmHg"],
        tip: "Average E/e' < 7 reliably predicts normal LAP (< 15 mmHg) in heart transplant recipients.",
      };
    }

    if (eeVal > 14) {
      return {
        result: "elevated",
        label: "LAP ≥ 15 mmHg",
        criteria: ["Average E/e' > 14 → LAP ≥ 15 mmHg"],
        tip: "Average E/e' > 14 reliably predicts elevated LAP (≥ 15 mmHg) in heart transplant recipients.",
      };
    }

    // E/e' 7–14: use E/SR_IVR or TR velocity
    if (!has(esrIvr) && !has(trVel)) {
      return {
        result: "indeterminate",
        label: "Indeterminate",
        criteria: ["Average E/e' 7–14 → E/SR_IVR or TR velocity required"],
        note: "Enter E/SR_IVR (feasible) or TR velocity (if E/SR_IVR not available) to complete the algorithm.",
      };
    }

    if (has(esrIvr)) {
      const esrVal = n(esrIvr);
      if (esrVal <= 200) {
        return {
          result: "low",
          label: "LAP < 15 mmHg",
          criteria: [`Average E/e' ${eeVal} (7–14)`, `E/SR_IVR ${esrVal} cm ≤ 200 cm → LAP < 15 mmHg`],
          tip: "E/SR_IVR ≤ 200 cm predicts normal LAP in the intermediate E/e' range.",
        };
      } else {
        return {
          result: "elevated",
          label: "LAP ≥ 15 mmHg",
          criteria: [`Average E/e' ${eeVal} (7–14)`, `E/SR_IVR ${esrVal} cm > 200 cm → LAP ≥ 15 mmHg`],
          tip: "E/SR_IVR > 200 cm predicts elevated LAP in the intermediate E/e' range.",
        };
      }
    }

    // TR velocity fallback
    if (has(trVel)) {
      const trVal = n(trVel);
      if (trVal <= 2.8) {
        return {
          result: "low",
          label: "LAP < 15 mmHg",
          criteria: [`Average E/e' ${eeVal} (7–14)`, `E/SR_IVR not available`, `TR velocity ${trVal} m/s ≤ 2.8 m/s → LAP < 15 mmHg`],
          tip: "TR velocity ≤ 2.8 m/s predicts normal LAP when E/SR_IVR is unavailable.",
        };
      } else {
        return {
          result: "elevated",
          label: "LAP ≥ 15 mmHg",
          criteria: [`Average E/e' ${eeVal} (7–14)`, `E/SR_IVR not available`, `TR velocity ${trVal} m/s > 2.8 m/s → LAP ≥ 15 mmHg`],
          tip: "TR velocity > 2.8 m/s predicts elevated LAP when E/SR_IVR is unavailable.",
        };
      }
    }

    return { result: "indeterminate", label: "Indeterminate", criteria: ["Insufficient data"], note: "TR absent or incomplete — LAP indeterminate." };
  };

  const result = calc();

  return (
    <EngineSection
      id="engine-htx"
      title="Heart Transplant — LAP Estimation"
      subtitle="Sinus rhythm recipients — Average E/e' → E/SR_IVR or TR velocity"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <NumInput label="Average E/e'" value={avgEe} onChange={setAvgEe} placeholder="e.g. 10" hint="(septal + lateral / 2)" />
        <NumInput label="E/SR_IVR" value={esrIvr} onChange={setEsrIvr} unit="cm" placeholder="e.g. 180" hint="(if feasible)" />
        <NumInput label="TR Velocity" value={trVel} onChange={setTrVel} unit="m/s" placeholder="e.g. 2.5" hint="(if E/SR_IVR unavailable)" />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>Algorithm (ASE 2025):</strong> E/e' &lt; 7 → LAP &lt; 15 mmHg. E/e' &gt; 14 → LAP ≥ 15 mmHg. E/e' 7–14 → E/SR_IVR: ≤ 200 cm = normal, &gt; 200 cm = elevated. If E/SR_IVR unavailable: TR ≤ 2.8 m/s = normal, TR absent/incomplete = indeterminate, TR &gt; 2.8 m/s = elevated.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>E/SR_IVR</strong> = E velocity (cm/s) ÷ Septal e' strain rate during IVR (s⁻¹). This is a tissue Doppler-derived index specific to heart transplant physiology. Use lateral E/e' as an alternative if E/SR_IVR is not measurable.
        </p>
      </div>

      {result && (
        <LAPResultCard
          result={result.result}
          title="Heart Transplant LAP Estimation"
          criteria={result.criteria}
          note={result.note}
          tip={result.tip}
        />
      )}
      <p className="text-xs text-gray-400 mt-3">Reference: ASE 2025 LV Diastolic Function Guidelines (Nagueh et al.)</p>
    </EngineSection>
  );
}

// ─── 3. PULMONARY HYPERTENSION ENGINE ───────────────────────────────────────
// Algorithm for estimation of mean LAP in patients with PH
// E/A + E velocity → LARS → lateral E/e' branch
function PulmonaryHTNDiastolicEngine() {
  const [ea, setEa] = useState("");
  const [eVel, setEVel] = useState(""); // E velocity cm/s
  const [lars, setLars] = useState(""); // LARS %
  const [latEe, setLatEe] = useState(""); // lateral E/e'
  const [ePrime, setEPrime] = useState(""); // e' for reduced check

  type PHResult = { result: LAPResult; criteria: string[]; note?: string; tip?: string } | null;

  const calc = (): PHResult => {
    if (!has(ea)) return null;
    const eaVal = n(ea);
    const eVelVal = has(eVel) ? n(eVel) : null;
    const ePrimeVal = has(ePrime) ? n(ePrime) : null;

    // Branch 1: E/A ≤ 0.8 AND E ≤ 50 cm/s → Normal LAP
    if (eaVal <= 0.8 && eVelVal !== null && eVelVal <= 50) {
      return {
        result: "normal",
        criteria: [`E/A ${eaVal} ≤ 0.8`, `E velocity ${eVelVal} cm/s ≤ 50 cm/s → Normal LAP`],
        tip: "Low E velocity with low E/A ratio reliably predicts normal LAP in PH patients.",
      };
    }

    // Branch 3: E/A ≥ 2 AND e' is reduced → Elevated LAP
    if (eaVal >= 2) {
      if (ePrimeVal !== null && ePrimeVal <= 7) {
        return {
          result: "elevated",
          criteria: [`E/A ${eaVal} ≥ 2`, `e' ${ePrimeVal} cm/s (reduced ≤ 7 cm/s) → Elevated LAP`],
          tip: "E/A ≥ 2 with reduced e' reliably predicts elevated LAP in PH patients.",
        };
      }
      return {
        result: "indeterminate",
        criteria: [`E/A ${eaVal} ≥ 2`, "Enter lateral e' to confirm if e' is reduced"],
        note: "Enter lateral e' velocity to complete the elevated LAP branch.",
      };
    }

    // Branch 2: E/A ≤ 0.8 AND E > 50 cm/s, OR E/A 0.8–2 → LARS branch
    const inMiddleBranch =
      (eaVal <= 0.8 && eVelVal !== null && eVelVal > 50) ||
      (eaVal > 0.8 && eaVal < 2);

    if (!inMiddleBranch) {
      return null;
    }

    // Need LARS
    if (!has(lars)) {
      return {
        result: "indeterminate",
        criteria: ["E/A in intermediate range → LARS required"],
        note: "Enter LARS to proceed. If LARS unavailable, enter lateral E/e'.",
      };
    }

    const larsVal = n(lars);

    if (larsVal > 18) {
      return {
        result: "normal",
        criteria: [
          eaVal <= 0.8 ? `E/A ${eaVal} ≤ 0.8, E velocity ${eVelVal} cm/s > 50 cm/s` : `E/A ${eaVal} (0.8–2)`,
          `LARS ${larsVal}% > 18% → Normal LAP`,
        ],
        tip: "LARS > 18% in the intermediate E/A range predicts normal LAP in PH patients.",
      };
    }

    if (larsVal <= 18) {
      return {
        result: "elevated",
        criteria: [
          eaVal <= 0.8 ? `E/A ${eaVal} ≤ 0.8, E velocity ${eVelVal} cm/s > 50 cm/s` : `E/A ${eaVal} (0.8–2)`,
          `LARS ${larsVal}% ≤ 18% → Elevated LAP`,
        ],
        tip: "LARS ≤ 18% in the intermediate E/A range predicts elevated LAP in PH patients.",
      };
    }

    // LARS not available — use lateral E/e'
    if (!has(latEe)) {
      return {
        result: "indeterminate",
        criteria: ["LARS not available → Lateral E/e' required"],
        note: "Enter lateral E/e' as fallback when LARS is unavailable.",
      };
    }

    const latEeVal = n(latEe);
    if (latEeVal < 8) {
      return {
        result: "normal",
        criteria: [`LARS not available`, `Lateral E/e' ${latEeVal} < 8 → Normal LAP`],
        tip: "Lateral E/e' < 8 predicts normal LAP when LARS is unavailable.",
      };
    } else if (latEeVal > 13) {
      return {
        result: "elevated",
        criteria: [`LARS not available`, `Lateral E/e' ${latEeVal} > 13 → Elevated LAP`],
        tip: "Lateral E/e' > 13 predicts elevated LAP when LARS is unavailable.",
      };
    } else {
      return {
        result: "indeterminate",
        criteria: [`LARS not available`, `Lateral E/e' ${latEeVal} (8–13) → LAP indeterminate`],
        note: "Lateral E/e' ratio 8–13 is indeterminate for LAP estimation in PH patients.",
      };
    }
  };

  const result = calc();

  return (
    <EngineSection
      id="engine-ph-diastolic"
      title="Pulmonary Hypertension — LAP Estimation"
      subtitle="E/A + E velocity → LARS → Lateral E/e' algorithm"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <NumInput label="Mitral E/A Ratio" value={ea} onChange={setEa} placeholder="e.g. 1.2" />
        <NumInput label="Mitral E Velocity" value={eVel} onChange={setEVel} unit="cm/s" placeholder="e.g. 65" hint="(required if E/A ≤ 0.8)" />
        <NumInput label="Lateral e' Velocity" value={ePrime} onChange={setEPrime} unit="cm/s" placeholder="e.g. 6" hint="(required if E/A ≥ 2)" />
        <NumInput label="LARS" value={lars} onChange={setLars} unit="%" placeholder="e.g. 22" hint="(primary secondary criterion)" />
        <NumInput label="Lateral E/e' Ratio" value={latEe} onChange={setLatEe} placeholder="e.g. 10" hint="(if LARS unavailable)" />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>Algorithm (ASE 2025):</strong> E/A ≤ 0.8 + E ≤ 50 cm/s → Normal. E/A ≥ 2 + reduced e' → Elevated. Intermediate: LARS &gt; 18% = Normal, LARS ≤ 18% = Elevated. If LARS unavailable: lateral E/e' &lt; 8 = Normal, &gt; 13 = Elevated, 8–13 = Indeterminate.
        </p>
      </div>

      {result && (
        <LAPResultCard
          result={result.result}
          title="PH LAP Estimation"
          criteria={result.criteria}
          note={result.note}
          tip={result.tip}
        />
      )}
      <p className="text-xs text-gray-400 mt-3">Reference: ASE 2025 LV Diastolic Function Guidelines (Nagueh et al.)</p>
    </EngineSection>
  );
}

// ─── 4. ATRIAL FIBRILLATION ENGINE ────────────────────────────────────────────
// Algorithm for estimation of mean LAP with atrial fibrillation
// 4-criteria count → LARS/PV S/D/BMI secondary branch
function AFibDiastolicEngine() {
  const [eVel, setEVel] = useState("");       // Mitral E velocity cm/s
  const [septalEe, setSeptalEe] = useState(""); // Septal E/e'
  const [trVel, setTrVel] = useState("");     // TR velocity m/s
  const [pasp, setPasp] = useState("");       // PASP mmHg
  const [dt, setDt] = useState("");           // DT ms
  const [lars, setLars] = useState("");       // LARS %
  const [pvSD, setPvSD] = useState("");       // PV S/D ratio
  const [bmi, setBmi] = useState("");         // BMI kg/m²

  type AFResult = { result: LAPResult; criteria: string[]; note?: string; tip?: string } | null;

  const calc = (): AFResult => {
    const eVelVal = has(eVel) ? n(eVel) : null;
    const sepEeVal = has(septalEe) ? n(septalEe) : null;
    const trVelVal = has(trVel) ? n(trVel) : null;
    const paspVal = has(pasp) ? n(pasp) : null;
    const dtVal = has(dt) ? n(dt) : null;

    // Count primary criteria
    let count = 0;
    const met: string[] = [];
    const notMet: string[] = [];

    if (eVelVal !== null) {
      if (eVelVal >= 100) { count++; met.push(`E velocity ${eVelVal} cm/s ≥ 100 cm/s ✓`); }
      else notMet.push(`E velocity ${eVelVal} cm/s < 100 cm/s`);
    }
    if (sepEeVal !== null) {
      if (sepEeVal > 11) { count++; met.push(`Septal E/e' ${sepEeVal} > 11 ✓`); }
      else notMet.push(`Septal E/e' ${sepEeVal} ≤ 11`);
    }
    if (trVelVal !== null || paspVal !== null) {
      const trAbn = (trVelVal !== null && trVelVal > 2.8) || (paspVal !== null && paspVal > 35);
      if (trAbn) { count++; met.push(`TR velocity > 2.8 m/s or PASP > 35 mmHg ✓`); }
      else notMet.push(`TR velocity ≤ 2.8 m/s and PASP ≤ 35 mmHg`);
    }
    if (dtVal !== null) {
      if (dtVal <= 160) { count++; met.push(`DT ${dtVal} ms ≤ 160 ms ✓`); }
      else notMet.push(`DT ${dtVal} ms > 160 ms`);
    }

    const totalEntered = (eVelVal !== null ? 1 : 0) + (sepEeVal !== null ? 1 : 0) +
      ((trVelVal !== null || paspVal !== null) ? 1 : 0) + (dtVal !== null ? 1 : 0);

    if (totalEntered === 0) return null;

    if (count === 0 || count === 1) {
      return {
        result: "normal",
        criteria: [...met, ...notMet, `${count} of 4 criteria met → Normal LAP`],
        tip: "None or 1 of 4 AF criteria met → Normal LAP. No further assessment needed.",
      };
    }

    if (count >= 3) {
      return {
        result: "elevated",
        criteria: [...met, `${count} of 4 criteria met → Elevated LAP`],
        tip: "3 or more of 4 AF criteria met → Elevated LAP confirmed.",
      };
    }

    // count === 2: use secondary criteria (LARS, PV S/D, BMI)
    const larsVal = has(lars) ? n(lars) : null;
    const pvSDVal = has(pvSD) ? n(pvSD) : null;
    const bmiVal = has(bmi) ? n(bmi) : null;

    const secondaryMet: string[] = [];
    let secondaryCount = 0;
    let secondaryEntered = 0;

    if (larsVal !== null) {
      secondaryEntered++;
      if (larsVal < 18) { secondaryCount++; secondaryMet.push(`LARS ${larsVal}% < 18% ✓`); }
      else secondaryMet.push(`LARS ${larsVal}% ≥ 18%`);
    }
    if (pvSDVal !== null) {
      secondaryEntered++;
      if (pvSDVal < 1) { secondaryCount++; secondaryMet.push(`PV S/D ${pvSDVal} < 1 ✓`); }
      else secondaryMet.push(`PV S/D ${pvSDVal} ≥ 1`);
    }
    if (bmiVal !== null) {
      secondaryEntered++;
      if (bmiVal > 30) { secondaryCount++; secondaryMet.push(`BMI ${bmiVal} kg/m² > 30 ✓`); }
      else secondaryMet.push(`BMI ${bmiVal} kg/m² ≤ 30`);
    }

    if (secondaryEntered === 0) {
      return {
        result: "indeterminate",
        criteria: [...met, ...notMet, "2 of 4 criteria met → Enter LARS, PV S/D, and/or BMI for secondary assessment"],
        note: "2 primary criteria met. Enter secondary criteria (LARS, PV S/D ratio, BMI) to determine LAP.",
      };
    }

    if (secondaryCount === 0) {
      return {
        result: "normal",
        criteria: [...met, ...notMet, "2 of 4 primary criteria met", ...secondaryMet, "None of secondary criteria met → Normal LAP"],
        tip: "No secondary criteria met → Normal LAP despite 2 primary criteria.",
      };
    }

    if (secondaryCount === 1 || (secondaryEntered < 3 && secondaryCount < secondaryEntered)) {
      return {
        result: "indeterminate",
        criteria: [...met, ...notMet, "2 of 4 primary criteria met", ...secondaryMet, "1 secondary criterion met or not all available → Indeterminate"],
        note: "1 secondary criterion met, or not all secondary criteria available → Indeterminate. Consider additional imaging.",
      };
    }

    // 2/3 or 3/3 secondary
    return {
      result: "elevated",
      criteria: [...met, ...notMet, "2 of 4 primary criteria met", ...secondaryMet, `${secondaryCount}/${secondaryEntered} secondary criteria met → Elevated LAP`],
      tip: "2 or more secondary criteria met → Elevated LAP.",
    };
  };

  const result = calc();

  return (
    <EngineSection
      id="engine-afib"
      title="Atrial Fibrillation — LAP Estimation"
      subtitle="4-criteria count → LARS / PV S/D / BMI secondary assessment"
    >
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-600 mb-2">Primary Criteria (count how many are met):</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumInput label="1. Mitral E Velocity" value={eVel} onChange={setEVel} unit="cm/s" placeholder="e.g. 95" hint="(abnormal ≥ 100)" />
          <NumInput label="2. Septal E/e' Ratio" value={septalEe} onChange={setSeptalEe} placeholder="e.g. 12" hint="(abnormal > 11)" />
          <NumInput label="3. TR Velocity" value={trVel} onChange={setTrVel} unit="m/s" placeholder="e.g. 2.9" hint="(abnormal > 2.8)" />
          <NumInput label="3. PASP (alternative)" value={pasp} onChange={setPasp} unit="mmHg" placeholder="e.g. 36" hint="(abnormal > 35)" />
          <NumInput label="4. Deceleration Time (DT)" value={dt} onChange={setDt} unit="ms" placeholder="e.g. 155" hint="(abnormal ≤ 160)" />
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-600 mb-2">Secondary Criteria (used only if exactly 2 primary criteria met):</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumInput label="LARS" value={lars} onChange={setLars} unit="%" placeholder="e.g. 16" hint="(abnormal < 18%)" />
          <NumInput label="PV S/D Ratio" value={pvSD} onChange={setPvSD} placeholder="e.g. 0.8" hint="(abnormal < 1)" />
          <NumInput label="BMI" value={bmi} onChange={setBmi} unit="kg/m²" placeholder="e.g. 32" hint="(abnormal > 30)" />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>Algorithm (ASE 2025):</strong> 0–1 criteria → Normal LAP. 3–4 criteria → Elevated LAP. 2 criteria → secondary assessment: 0 secondary = Normal, 1 or unavailable = Indeterminate, 2–3 secondary = Elevated.
        </p>
      </div>

      {result && (
        <LAPResultCard
          result={result.result}
          title="AF LAP Estimation"
          criteria={result.criteria}
          note={result.note}
          tip={result.tip}
        />
      )}
      <p className="text-xs text-gray-400 mt-3">Reference: ASE 2025 LV Diastolic Function Guidelines (Nagueh et al.)</p>
    </EngineSection>
  );
}

// ─── 5. CONSTRICTIVE vs RESTRICTIVE ENGINE ────────────────────────────────────
// Algorithm for differentiation of pericardial constriction from restrictive cardiomyopathy
function ConstrictiveRestrictiveEngine() {
  const [ea, setEa] = useState("");
  const [dilatedIVC, setDilatedIVC] = useState(false);
  const [respirophasicVSM, setRespirophasicVSM] = useState<"yes" | "no" | "">("");
  const [medialEPrime, setMedialEPrime] = useState(""); // medial e' cm/s
  const [annulusReversus, setAnnulusReversus] = useState<"yes" | "no" | "">("");
  const [hepaticVeinReversal, setHepaticVeinReversal] = useState<"yes" | "no" | "">("");
  const [svcAugmentation, setSvcAugmentation] = useState<"yes" | "no" | "">("");

  type CRResult = {
    result: "constriction" | "restriction" | "mixed" | "unlikely" | "indeterminate";
    label: string;
    criteria: string[];
    note?: string;
    tip?: string;
    sensitivity?: string;
    specificity?: string;
  } | null;

  const calc = (): CRResult => {
    if (!has(ea) || !dilatedIVC) return null;

    const eaVal = n(ea);

    // Entry criteria: E/A > 0.8 AND dilated IVC
    if (eaVal <= 0.8 || !dilatedIVC) {
      return {
        result: "unlikely",
        label: "Constriction/Restriction Unlikely",
        criteria: [
          eaVal <= 0.8 ? `E/A ${eaVal} ≤ 0.8` : `E/A ${eaVal} > 0.8`,
          dilatedIVC ? "Dilated IVC present" : "No dilated IVC",
          "Both E/A > 0.8 AND dilated IVC required to proceed",
        ],
        note: "Constriction/restriction unlikely. Consider further imaging or cardiac catheterization if still suspected.",
        tip: "The algorithm requires both E/A > 0.8 AND dilated inferior vena cava as entry criteria.",
      };
    }

    // Step 1: Respirophasic ventricular septal motion
    if (respirophasicVSM === "") {
      return {
        result: "indeterminate",
        label: "Indeterminate",
        criteria: [`E/A ${eaVal} > 0.8`, "Dilated IVC present", "Select respirophasic ventricular septal motion status"],
        note: "Assess for respirophasic interventricular septal motion (septal bounce/shift with respiration).",
      };
    }

    if (respirophasicVSM === "no") {
      return {
        result: "unlikely",
        label: "Constriction/Restriction Unlikely",
        criteria: [`E/A ${eaVal} > 0.8`, "Dilated IVC present", "No respirophasic ventricular septal motion"],
        note: "Without respirophasic septal motion, constriction/restriction is unlikely. Consider further imaging or cardiac catheterization if still suspected.",
        tip: "Respirophasic septal motion (sensitivity 94%, specificity 73%) is the most sensitive criterion for constriction.",
      };
    }

    // Respirophasic VSM = YES → Step 2: Medial e'
    if (!has(medialEPrime)) {
      return {
        result: "indeterminate",
        label: "Indeterminate",
        criteria: [`E/A ${eaVal} > 0.8`, "Dilated IVC present", "Respirophasic VSM: Yes", "Enter medial mitral annular e' velocity"],
        note: "Measure medial mitral annular e' velocity by tissue Doppler.",
      };
    }

    const eVal = n(medialEPrime);
    let diagnosis = "";
    let diagResult: "constriction" | "restriction" | "mixed" = "mixed";

    if (eVal > 8) {
      diagnosis = "Constrictive pericarditis";
      diagResult = "constriction";
    } else if (eVal >= 6 && eVal <= 8) {
      diagnosis = "Mixed constriction and restriction";
      diagResult = "mixed";
    } else {
      diagnosis = "Restrictive cardiomyopathy";
      diagResult = "restriction";
    }

    const baseCriteria = [
      `E/A ${eaVal} > 0.8`, "Dilated IVC present", "Respirophasic VSM: Yes",
      `Medial e' ${eVal} cm/s → ${diagnosis}`,
    ];

    // Step 3: Annulus reversus (medial e' > lateral e')
    if (annulusReversus === "") {
      return {
        result: diagResult,
        label: diagnosis,
        criteria: baseCriteria,
        note: "Assess annulus reversus (medial e' > lateral e') to refine diagnosis.",
        tip: `Sensitivity 81%, specificity 91% for criterion 2 (medial e'). Proceed to annulus reversus assessment.`,
      };
    }

    if (annulusReversus === "yes") {
      return {
        result: "constriction",
        label: "Most Likely Constriction",
        criteria: [...baseCriteria, "Annulus reversus present (medial e' > lateral e') → Most likely constriction"],
        tip: "Annulus reversus (sensitivity 71%, specificity 79%, PPV 93%) strongly supports constrictive pericarditis.",
        sensitivity: "71%",
        specificity: "79%",
      };
    }

    // Annulus reversus = No → Step 4: Hepatic vein expiratory reversal
    if (hepaticVeinReversal === "") {
      return {
        result: diagResult,
        label: diagnosis,
        criteria: [...baseCriteria, "Annulus reversus: No"],
        note: "Assess diastolic hepatic vein expiratory reversal/forward flow velocity ≥ 0.8.",
      };
    }

    if (hepaticVeinReversal === "yes") {
      return {
        result: "constriction",
        label: "Definite Constriction",
        criteria: [...baseCriteria, "Annulus reversus: No", "Hepatic vein diastolic expiratory reversal ≥ 0.8 → Definite constriction"],
        tip: "Hepatic vein expiratory reversal ≥ 0.8 (sensitivity 73%, specificity 66%, PPV 86%) confirms definite constriction.",
        sensitivity: "73%",
        specificity: "66%",
      };
    }

    // Hepatic vein = No → Step 5: SVC inspiratory systolic augmentation
    if (svcAugmentation === "") {
      return {
        result: diagResult,
        label: diagnosis,
        criteria: [...baseCriteria, "Annulus reversus: No", "Hepatic vein reversal: No"],
        note: "Assess inspiratory systolic forward flow augmentation on superior vena caval Doppler.",
      };
    }

    if (svcAugmentation === "yes") {
      return {
        result: "unlikely",
        label: "Exaggerated Intrathoracic Pressure Changes",
        criteria: [...baseCriteria, "Annulus reversus: No", "Hepatic vein reversal: No", "SVC inspiratory systolic augmentation: Yes → Exaggerated intrathoracic pressure changes (lung disease or obesity)"],
        note: "Exaggerated intrathoracic pressure changes due to lung disease or obesity — not constrictive pericarditis.",
        tip: "Consider COPD, obesity, or other causes of exaggerated respiratory variation.",
      };
    }

    return {
      result: diagResult,
      label: diagnosis,
      criteria: [...baseCriteria, "Annulus reversus: No", "Hepatic vein reversal: No", "SVC augmentation: No"],
      note: "All criteria assessed. Diagnosis based on medial e' velocity.",
    };
  };

  const result = calc();

  const resultColorMap: Record<string, LAPResult> = {
    constriction: "elevated",
    restriction: "indeterminate",
    mixed: "indeterminate",
    unlikely: "normal",
    indeterminate: "indeterminate",
  };

  return (
    <EngineSection
      id="engine-constrictive"
      title="Constrictive vs Restrictive Cardiomyopathy"
      subtitle="Differentiation algorithm — E/A + IVC → Respirophasic VSM → Medial e' → Annulus reversus → Hepatic vein"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <NumInput label="Mitral E/A Ratio" value={ea} onChange={setEa} placeholder="e.g. 1.5" hint="(entry: > 0.8)" />
        <NumInput label="Medial Mitral Annular e'" value={medialEPrime} onChange={setMedialEPrime} unit="cm/s" placeholder="e.g. 7" hint="(> 8 = CP, 6–8 = mixed, < 6 = RCM)" />
      </div>

      <div className="space-y-3 mb-4">
        <CheckInput
          label="Dilated inferior vena cava (IVC)"
          checked={dilatedIVC}
          onChange={setDilatedIVC}
          hint="(required entry criterion)"
        />

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Respirophasic ventricular septal motion (septal bounce/shift):</p>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map(v => (
              <button
                key={v}
                onClick={() => setRespirophasicVSM(v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${respirophasicVSM === v
                  ? "text-white border-[#189aa1]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"
                  }`}
                style={respirophasicVSM === v ? { background: "#189aa1" } : {}}
              >
                {v === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Annulus reversus (medial e' &gt; lateral e'):</p>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map(v => (
              <button
                key={v}
                onClick={() => setAnnulusReversus(v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${annulusReversus === v
                  ? "text-white border-[#189aa1]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"
                  }`}
                style={annulusReversus === v ? { background: "#189aa1" } : {}}
              >
                {v === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Diastolic hepatic vein expiratory reversal/forward flow velocity ≥ 0.8:</p>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map(v => (
              <button
                key={v}
                onClick={() => setHepaticVeinReversal(v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${hepaticVeinReversal === v
                  ? "text-white border-[#189aa1]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"
                  }`}
                style={hepaticVeinReversal === v ? { background: "#189aa1" } : {}}
              >
                {v === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Inspiratory systolic forward flow augmentation on SVC Doppler:</p>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map(v => (
              <button
                key={v}
                onClick={() => setSvcAugmentation(v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${svcAugmentation === v
                  ? "text-white border-[#189aa1]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"
                  }`}
                style={svcAugmentation === v ? { background: "#189aa1" } : {}}
              >
                {v === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>Algorithm (ASE 2025, Klein et al.):</strong> Entry: E/A &gt; 0.8 + dilated IVC. Step 1: Respirophasic VSM (Sn 94%, Sp 73%). Step 2: Medial e' (&gt;8 = CP, 6–8 = mixed, &lt;6 = RCM). Step 3: Annulus reversus (Sn 71%, Sp 91%). Step 4: Hepatic vein expiratory reversal ≥ 0.8 (Sn 73%, Sp 66%). Step 5: SVC augmentation → lung disease/obesity.
        </p>
      </div>

      {result && (
        <LAPResultCard
          result={resultColorMap[result.result] ?? "indeterminate"}
          title={result.result === "constriction" ? "Constrictive Pericarditis" : result.result === "restriction" ? "Restrictive Cardiomyopathy" : result.result === "mixed" ? "Mixed Constriction & Restriction" : "Assessment"}
          criteria={result.criteria}
          note={result.note}
          tip={result.tip}
        />
      )}

      {/* Sensitivity/Specificity table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-600">Criterion</th>
              <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-600">Sensitivity</th>
              <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-600">Specificity</th>
              <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-600">PPV</th>
              <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-600">NPV</th>
            </tr>
          </thead>
          <tbody>
            {[
              { n: "① Respirophasic VSM", sn: "94%", sp: "73%", ppv: "93%", npv: "77%" },
              { n: "② Medial e' velocity", sn: "81%", sp: "91%", ppv: "97%", npv: "58%" },
              { n: "③ Annulus reversus", sn: "71%", sp: "79%", ppv: "93%", npv: "45%" },
              { n: "④ Hepatic vein reversal", sn: "73%", sp: "66%", ppv: "86%", npv: "42%" },
              { n: "① and ②", sn: "80%", sp: "96%", ppv: "99%", npv: "58%" },
              { n: "① with both ② and ④", sn: "67%", sp: "99%", ppv: "100%", npv: "50%" },
            ].map(row => (
              <tr key={row.n} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 border border-gray-200 text-gray-700">{row.n}</td>
                <td className="px-3 py-1.5 border border-gray-200 text-center text-gray-600">{row.sn}</td>
                <td className="px-3 py-1.5 border border-gray-200 text-center text-gray-600">{row.sp}</td>
                <td className="px-3 py-1.5 border border-gray-200 text-center text-gray-600">{row.ppv}</td>
                <td className="px-3 py-1.5 border border-gray-200 text-center text-gray-600">{row.npv}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">Reference: ASE 2025 LV Diastolic Function Guidelines (Klein et al., Nagueh et al.)</p>
    </EngineSection>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function DiastologySpecialPopulations() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Section header — collapsible, matches other EngineSection headers */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full teal-header px-5 py-3 flex items-center justify-between"
      >
        <div className="text-left flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>
              Diastology in Special Populations
            </h3>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/40 text-yellow-300">
              <Crown className="w-2.5 h-2.5" /> Premium
            </span>
          </div>
          <p className="text-xs text-white/70 mt-0.5">
            ASE 2025 — MAC · Heart Transplant · Pulmonary HTN · Atrial Fibrillation · Constrictive vs Restrictive
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-4">
          <PremiumOverlay featureName="Diastology in Special Populations">
            <div className="space-y-4">
              <MACEngine />
              <HeartTransplantEngine />
              <PulmonaryHTNDiastolicEngine />
              <AFibDiastolicEngine />
              <ConstrictiveRestrictiveEngine />
            </div>
          </PremiumOverlay>
        </div>
      )}
    </div>
  );
}
