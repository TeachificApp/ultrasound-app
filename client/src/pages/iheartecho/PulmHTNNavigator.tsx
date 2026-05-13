/*
  iHeartEcho™ — Pulmonary HTN & PE Navigator
  Pulmonary Hypertension and Pulmonary Embolism Echo Assessment
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
  US spelling throughout
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Link } from "wouter";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import {
  Wind, Scan, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, Circle, Activity, Zap, TrendingUp, XCircle, CheckCircle2
} from "lucide-react";

// ─── BRAND ────────────────────────────────────────────────────────────────────
const BRAND = "#189aa1";
const BRAND_DARK = "#0e7490";
const AQUA = "#4ad9e0";

// ─── CHECKLIST COMPONENT ──────────────────────────────────────────────────────
function ChecklistSection({ title, items }: { title: string; items: { item: string; detail: string }[] }) {
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false));
  const done = checked.filter(Boolean).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide mb-0" style={{ color: BRAND }}>{title}</p>
        <span className="text-xs text-gray-400">{done}/{items.length}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => setChecked(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
            className="w-full flex items-start gap-3 text-left p-3 rounded-lg border transition-all"
            style={{
              background: checked[i] ? "#f0fdf4" : "#fafafa",
              borderColor: checked[i] ? "#86efac" : "#e5e7eb",
            }}
          >
            {checked[i]
              ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="text-sm font-semibold text-gray-800">{item.item}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
            </div>
          </button>
        ))}
        <button
          onClick={() => setChecked(items.map(() => false))}
          className="text-xs hover:underline mt-1"
          style={{ color: BRAND }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ─── COLLAPSIBLE SECTION ──────────────────────────────────────────────────────
function CollapsibleSection({ title, subtitle, icon: Icon, iconBg, children }: {
  title: string; subtitle: string; icon: React.ElementType; iconBg: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 hover:border-[#189aa1]/40 transition-all text-left"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="space-y-4">{children}</div>}
    </div>
  );
}

// ─── NORMAL VALUES TABLE ──────────────────────────────────────────────────────
function NormalValuesTable({ rows }: { rows: { label: string; normal: string; abnormal: string; note: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Parameter</th>
            <th className="text-left px-4 py-3 font-semibold text-green-600">Normal</th>
            <th className="text-left px-4 py-3 font-semibold text-red-600">Abnormal</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500">Clinical Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, normal, abnormal, note }, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-4 py-2.5 font-medium text-gray-700 border-r border-gray-100">{label}</td>
              <td className="px-4 py-2.5 text-green-700">{normal}</td>
              <td className="px-4 py-2.5 text-red-700 font-semibold">{abnormal}</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PulmHTNNavigator() {
  const [activeSection, setActiveSection] = useState<"ph" | "pe">("ph");

  return (
    <Layout>
      {/* ── Header ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-10">
          <div className="mb-3">
            <BackToEchoAssist className="text-white/70 hover:text-white" />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.1)" }}>
              <Wind className="w-6 h-6" style={{ color: AQUA }} />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: AQUA }} />
                <span className="text-xs text-white/80 font-medium">Guideline-Based Assessment</span>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAssist™ Navigator — Pulmonary HTN & PE
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Echo-based assessment of pulmonary hypertension and pulmonary embolism — diagnostic criteria, RV/PA measurements, risk stratification, and clinical decision support.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/scan-coach?tab=pulm">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <Scan className="w-3.5 h-3.5" style={{ color: AQUA }} />
                    Open in ScanCoach
                    <span className="text-xs" style={{ color: AQUA }}>→</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PremiumOverlay featureName="Pulmonary HTN & PE Navigator">
      {/* ── Section Toggle ── */}
      <div className="container pt-6">
        <div className="flex gap-2 mb-6">
          {([
            { key: "ph", label: "Pulmonary Hypertension", icon: TrendingUp },
            { key: "pe", label: "Pulmonary Embolism", icon: Zap },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: activeSection === key ? BRAND : "#f8fafc",
                color: activeSection === key ? "white" : "#374151",
                border: `1.5px solid ${activeSection === key ? BRAND : "#e5e7eb"}`,
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            PULMONARY HYPERTENSION SECTION
        ══════════════════════════════════════════════════════ */}
        {activeSection === "ph" && (
          <div className="space-y-4 pb-10">

            {/* PH Classification Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2" style={{ background: BRAND + "08" }}>
                <TrendingUp className="w-4 h-4" style={{ color: BRAND }} />
                <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Echo Probability of Pulmonary Hypertension</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">
                  Echo probability of PH is determined by the peak tricuspid regurgitation velocity (TRV) combined with additional supporting signs. This replaces the older RVSP-only approach.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      prob: "Low",
                      trv: "TRV ≤2.8 m/s",
                      signs: "No additional signs",
                      color: "#16a34a",
                      bg: "#f0fdf4",
                      border: "#86efac",
                      action: "PH unlikely. Consider alternative diagnosis.",
                    },
                    {
                      prob: "Intermediate",
                      trv: "TRV ≤2.8 m/s + signs, OR TRV 2.9–3.4 m/s ± signs",
                      signs: "≥1 additional echo sign",
                      color: "#d97706",
                      bg: "#fffbeb",
                      border: "#fcd34d",
                      action: "Consider further evaluation. Right heart catheterization may be needed.",
                    },
                    {
                      prob: "High",
                      trv: "TRV >3.4 m/s",
                      signs: "Any additional signs",
                      color: "#dc2626",
                      bg: "#fef2f2",
                      border: "#fca5a5",
                      action: "Refer for right heart catheterization to confirm PH.",
                    },
                  ].map(({ prob, trv, signs, color, bg, border, action }) => (
                    <div key={prob} className="rounded-xl border-2 p-4" style={{ background: bg, borderColor: border }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{prob}</span>
                        <span className="text-xs font-bold text-gray-700">Probability</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 mb-1">{trv}</p>
                      <p className="text-xs text-gray-500 mb-2">{signs}</p>
                      <p className="text-xs font-medium" style={{ color }}>{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Additional Echo Signs of PH */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Additional Echo Signs Supporting PH</h3>
                <p className="text-xs text-gray-500 mt-0.5">At least 2 signs from different categories strengthen the probability</p>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    category: "RV/RA Signs",
                    color: BRAND,
                    items: [
                      "RV/LV basal diameter ratio >1.0",
                      "RA area >18 cm² (end-systole)",
                      "TAPSE <17 mm",
                      "RV S' velocity <9.5 cm/s",
                      "RV fractional area change (FAC) <35%",
                    ],
                  },
                  {
                    category: "PA Signs",
                    color: BRAND_DARK,
                    items: [
                      "PA acceleration time (PAAT) <105 ms",
                      "PAAT/RVET ratio <0.33",
                      "Mid-systolic notching of RVOT Doppler",
                      "PA diameter >25 mm",
                      "Diastolic PA pressure (dPAP) >5 mmHg",
                    ],
                  },
                  {
                    category: "IVC/RA Pressure Signs",
                    color: "#0369a1",
                    items: [
                      "IVC diameter >21 mm",
                      "IVC collapse <50% with sniff",
                      "RAP estimate ≥15 mmHg",
                      "Pericardial effusion (any size)",
                      "Septal flattening (D-sign) in diastole",
                    ],
                  },
                ].map(({ category, color, items }) => (
                  <div key={category}>
                    <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color }}>{category}</h4>
                    <ul className="space-y-1.5">
                      {items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* PH Normal Values */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Key Measurements & Reference Values</h3>
              </div>
              <NormalValuesTable rows={[
                { label: "TRV (peak)", normal: "≤2.8 m/s", abnormal: ">2.8 m/s", note: ">3.4 m/s = high PH probability" },
                { label: "RVSP (estimated)", normal: "<35 mmHg", abnormal: "≥35 mmHg", note: "RVSP = 4×TRV² + RAP; not used alone for PH diagnosis" },
                { label: "RV/LV basal ratio", normal: "<1.0", abnormal: "≥1.0", note: "RV enlargement sign" },
                { label: "TAPSE", normal: "≥17 mm", abnormal: "<17 mm", note: "RV longitudinal dysfunction" },
                { label: "RV S' (TDI)", normal: "≥9.5 cm/s", abnormal: "<9.5 cm/s", note: "Lateral tricuspid annulus" },
                { label: "RV FAC", normal: "≥35%", abnormal: "<35%", note: "RV systolic dysfunction" },
                { label: "PAAT", normal: "≥105 ms", abnormal: "<105 ms", note: "<60 ms with notching = severe PH" },
                { label: "PA diameter", normal: "≤25 mm", abnormal: ">25 mm", note: "Measure at PSAX, end-diastole" },
                { label: "RA area", normal: "≤18 cm²", abnormal: ">18 cm²", note: "Measured end-systole" },
                { label: "IVC diameter", normal: "≤21 mm", abnormal: ">21 mm", note: "Measured 1–2 cm from RA junction" },
                { label: "IVC collapse (sniff)", normal: ">50%", abnormal: "≤50%", note: "≤50% + IVC >21 mm = RAP 15 mmHg" },
                { label: "RIMP (Tei index)", normal: "<0.40 (PW), <0.55 (TDI)", abnormal: "≥0.40 / ≥0.55", note: "Global RV dysfunction marker" },
              ]} />
            </div>

            {/* PH Assessment Checklist */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <ChecklistSection
                title="Pulmonary Hypertension Echo Assessment Checklist"
                items={[
                  { item: "TRV — peak velocity (CW Doppler)", detail: "Multiple windows: apical 4-ch, PSAX, RV inflow. Use highest quality signal. Avoid angle >20°." },
                  { item: "RVSP estimation", detail: "RVSP = 4×TRV² + RAP. Estimate RAP from IVC. Report as estimate, not diagnosis." },
                  { item: "RV size — basal, mid, and longitudinal diameters", detail: "Apical 4-ch, RV-focused view. Basal RV >41 mm = dilated." },
                  { item: "RV/LV basal diameter ratio", detail: "Ratio >1.0 = RV enlargement. Key supporting sign." },
                  { item: "RV systolic function — TAPSE", detail: "M-mode at lateral tricuspid annulus. <17 mm = dysfunction." },
                  { item: "RV S' velocity (TDI)", detail: "Lateral tricuspid annulus. <9.5 cm/s = dysfunction." },
                  { item: "RV FAC", detail: "Trace RV endocardium end-diastole and end-systole. FAC = (EDA−ESA)/EDA × 100." },
                  { item: "RIMP (Tei index)", detail: "PW or TDI method. Elevated in global RV dysfunction." },
                  { item: "PA acceleration time (PAAT)", detail: "PW Doppler in RVOT (PSAX). <105 ms = elevated PA pressure. Mid-systolic notch = severe PH." },
                  { item: "PA diameter", detail: "PSAX at level of aortic valve, end-diastole. >25 mm = dilated." },
                  { item: "IVC diameter and collapsibility", detail: "Subcostal view. Measure 1–2 cm from RA. Sniff test for collapsibility." },
                  { item: "RA size", detail: "Area method in apical 4-ch at end-systole. >18 cm² = enlarged." },
                  { item: "Septal morphology (D-sign)", detail: "PSAX at papillary muscle level. Flattening in diastole = pressure overload; systole = volume overload." },
                  { item: "Pericardial effusion", detail: "Any effusion in PH context = adverse prognostic marker." },
                  { item: "LV diastolic function", detail: "Assess for left heart disease as cause of PH (Group 2)." },
                  { item: "Tricuspid regurgitation severity", detail: "Grade TR severity — significant TR worsens RV volume overload." },
                ]}
              />
            </div>

            {/* PH Groups */}
            <CollapsibleSection
              title="Pulmonary Hypertension Classification (Groups 1–5)"
              subtitle="Echo clues to identify the underlying group"
              icon={Activity}
              iconBg={BRAND}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    group: "Group 1 — PAH",
                    examples: "Idiopathic, heritable, drug-induced, CTD, CHD, HIV",
                    echoClues: "No LV dysfunction, no significant left heart valve disease, RV/PA enlargement, no ILD pattern",
                    color: BRAND,
                  },
                  {
                    group: "Group 2 — Left Heart Disease",
                    examples: "HFpEF, HFrEF, mitral/aortic valve disease",
                    echoClues: "LV dysfunction, LA enlargement, elevated E/e', significant MR/AS/MS",
                    color: "#d97706",
                  },
                  {
                    group: "Group 3 — Lung Disease / Hypoxia",
                    examples: "COPD, ILD, OSA, high altitude",
                    echoClues: "Mild-moderate PH, RV enlargement, no left heart disease. Clinical correlation required.",
                    color: "#0369a1",
                  },
                  {
                    group: "Group 4 — CTEPH",
                    examples: "Chronic thromboembolic PH",
                    echoClues: "Similar to Group 1 but history of PE. Notched RVOT Doppler. CT-PA required for diagnosis.",
                    color: "#dc2626",
                  },
                  {
                    group: "Group 5 — Unclear / Multifactorial",
                    examples: "Sarcoidosis, metabolic disorders, hematologic conditions",
                    echoClues: "Variable. Requires comprehensive workup beyond echo.",
                    color: "#7c3aed",
                  },
                ].map(({ group, examples, echoClues, color }) => (
                  <div key={group} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <h4 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{group}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mb-1"><span className="font-semibold">Examples:</span> {examples}</p>
                    <p className="text-xs text-gray-600"><span className="font-semibold" style={{ color }}>Echo clues:</span> {echoClues}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* RV Strain Pattern */}
            <CollapsibleSection
              title="RV Pressure vs. Volume Overload — Echo Differentiation"
              subtitle="Septal morphology, RV shape, and Doppler patterns"
              icon={Activity}
              iconBg={BRAND_DARK}
            >
              <div className="overflow-x-auto bg-white rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Feature</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: "#dc2626" }}>Pressure Overload</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: "#0369a1" }}>Volume Overload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["D-sign timing", "Diastole (IVS flattens in diastole)", "Systole (IVS flattens in systole)"],
                      ["RV wall thickness", "Increased (hypertrophy)", "Normal or mildly increased"],
                      ["RV shape", "Crescentic, hypertrophied", "Dilated, thin-walled"],
                      ["PA pressure", "Elevated", "Normal or mildly elevated"],
                      ["TR jet", "High-velocity (>2.8 m/s)", "Low-velocity (volume-driven)"],
                      ["Causes", "PH, RVOTO, pulmonary stenosis", "ASD, TR, PE (acute), ARVC"],
                    ].map(([feature, pressure, volume], i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-2.5 font-medium text-gray-700 border-r border-gray-100">{feature}</td>
                        <td className="px-4 py-2.5 text-red-700">{pressure}</td>
                        <td className="px-4 py-2.5 text-blue-700">{volume}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>

            {/* Clinical Pearls PH */}
            <CollapsibleSection
              title="Clinical Pearls — Pulmonary Hypertension"
              subtitle="Key pitfalls, tips, and reporting guidance"
              icon={CheckCircle2}
              iconBg={BRAND}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: BRAND }} /> Pearls
                  </h4>
                  <ul className="space-y-2">
                    {[
                      "Always use the highest-quality TR signal from multiple windows — apical, parasternal, and subcostal.",
                      "RVSP is an estimate, not a diagnosis. Report as 'estimated RVSP' and note RAP assumption.",
                      "Mid-systolic notching of the RVOT Doppler envelope is a highly specific sign of severe PH.",
                      "PAAT <60 ms with notching indicates near-systemic PA pressures.",
                      "RV-focused apical 4-chamber view is essential — standard 4-ch underestimates RV size.",
                      "Pericardial effusion in PH is an adverse prognostic marker — always document.",
                    ].map((pearl, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: BRAND }} />
                        {pearl}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" /> Common Pitfalls
                  </h4>
                  <ul className="space-y-2">
                    {[
                      "Diagnosing PH from RVSP alone — echo probability requires TRV + supporting signs.",
                      "Using a poor TR signal — always optimize gain, depth, and angle before measuring.",
                      "Forgetting to estimate RAP — IVC assessment is mandatory for RVSP calculation.",
                      "Missing Group 2 PH — always assess LV function and left-sided valves.",
                      "Underestimating RV size by using standard (LV-focused) apical 4-ch view.",
                      "Reporting 'normal echo' when TR is absent — absence of TR does not exclude PH.",
                    ].map((pitfall, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#ef4444" }} />
                        {pitfall}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CollapsibleSection>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            PULMONARY EMBOLISM SECTION
        ══════════════════════════════════════════════════════ */}
        {activeSection === "pe" && (
          <div className="space-y-4 pb-10">

            {/* PE Echo Role Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2" style={{ background: "#fef2f2" }}>
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Role of Echo in Pulmonary Embolism</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">
                  Echo is <strong>not the primary diagnostic test for PE</strong> — CT-PA is gold standard. However, echo is critical for <strong>risk stratification</strong>, identifying <strong>RV strain</strong>, guiding <strong>thrombolysis decisions</strong>, and ruling out alternative diagnoses (tamponade, aortic dissection, MI) in hemodynamically unstable patients.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { role: "Hemodynamically Unstable", desc: "Echo at bedside to confirm RV strain and guide immediate thrombolysis or embolectomy when CT-PA is not feasible.", color: "#dc2626", bg: "#fef2f2" },
                    { role: "Risk Stratification", desc: "Identify RV dysfunction (TAPSE <17 mm, RV/LV >1.0) to classify intermediate-high vs. intermediate-low risk PE.", color: "#d97706", bg: "#fffbeb" },
                    { role: "Follow-up", desc: "Serial echo to assess RV recovery after treatment. Persistent RV dysfunction at 3–6 months raises concern for CTEPH.", color: BRAND, bg: "#f0fbfc" },
                  ].map(({ role, desc, color, bg }) => (
                    <div key={role} className="rounded-xl p-4" style={{ background: bg, border: `1.5px solid ${color}30` }}>
                      <h4 className="text-sm font-bold mb-1" style={{ color, fontFamily: "Merriweather, serif" }}>{role}</h4>
                      <p className="text-xs text-gray-600">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PE Echo Signs */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Echo Signs of Acute PE</h3>
                <p className="text-xs text-gray-500 mt-0.5">No single sign is diagnostic — use in clinical context</p>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    sign: "McConnell's Sign",
                    specificity: "Specificity ~94%",
                    desc: "RV free wall hypokinesis with preserved or hyperdynamic RV apex. Classic for acute PE. Distinguishes acute PE from chronic RV pressure overload (where apex is also hypokinetic).",
                    color: "#dc2626",
                    important: true,
                  },
                  {
                    sign: "RV/LV Basal Ratio >1.0",
                    specificity: "RV dilation",
                    desc: "RV enlargement relative to LV in apical 4-ch. Key marker of RV strain. Used in PESI and ESC risk stratification.",
                    color: BRAND,
                    important: false,
                  },
                  {
                    sign: "D-Sign (Septal Flattening)",
                    specificity: "Pressure overload",
                    desc: "Interventricular septal flattening in systole (PE = acute pressure overload). Indicates RV pressure exceeding LV pressure.",
                    color: BRAND_DARK,
                    important: false,
                  },
                  {
                    sign: "60/60 Sign",
                    specificity: "Specificity ~94%",
                    desc: "PAAT <60 ms AND RVSP <60 mmHg. Combination highly specific for acute PE. Distinguishes from chronic PH where RVSP is usually higher.",
                    color: "#dc2626",
                    important: true,
                  },
                  {
                    sign: "TAPSE <17 mm",
                    specificity: "RV dysfunction",
                    desc: "Reduced RV longitudinal function. Associated with worse outcomes in PE. Used in ESC intermediate-high risk classification.",
                    color: BRAND,
                    important: false,
                  },
                  {
                    sign: "Right Heart Thrombus",
                    specificity: "Direct sign",
                    desc: "Mobile thrombus in RA/RV or straddling the tricuspid valve. Rare but high-risk finding — associated with high early mortality. Urgent intervention required.",
                    color: "#dc2626",
                    important: true,
                  },
                  {
                    sign: "IVC Dilation / Non-Collapse",
                    specificity: "Elevated RAP",
                    desc: "IVC >21 mm with <50% collapse indicates elevated RA pressure. Marker of RV failure in massive PE.",
                    color: BRAND,
                    important: false,
                  },
                  {
                    sign: "Pulmonary Artery Dilation",
                    specificity: "Acute vs. chronic",
                    desc: "PA diameter >25 mm. In acute PE, PA may be normal or mildly dilated. Significant dilation suggests chronic process (CTEPH).",
                    color: BRAND_DARK,
                    important: false,
                  },
                ].map(({ sign, specificity, desc, color, important }) => (
                  <div key={sign} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: important ? color + "50" : "#e5e7eb", background: important ? color + "05" : "#fafafa" }}>
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-gray-800">{sign}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: color + "15", color }}>{specificity}</span>
                        {important && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: "#dc2626" }}>Key Sign</span>}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PE Risk Stratification */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Pulmonary Embolism Risk Stratification</h3>
                <p className="text-xs text-gray-500 mt-0.5">Echo RV dysfunction is a key determinant of intermediate-high vs. intermediate-low risk</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Risk Class</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Hemodynamics</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Echo RV Dysfunction</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Troponin</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Management</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["High", "Shock / hypotension", "Present", "Elevated", "Immediate reperfusion (thrombolysis or embolectomy)"],
                      ["Intermediate-High", "Stable", "Present", "Elevated", "Anticoagulation + close monitoring; consider thrombolysis if deterioration"],
                      ["Intermediate-Low", "Stable", "Present OR elevated troponin (not both)", "Normal or elevated", "Anticoagulation; consider early discharge"],
                      ["Low", "Stable", "Absent", "Normal", "Anticoagulation; early discharge / outpatient"],
                    ].map(([risk, hemo, echo, trop, mgmt], i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-2.5 font-bold border-r border-gray-100" style={{ color: i === 0 ? "#dc2626" : i === 1 ? "#d97706" : i === 2 ? "#ca8a04" : "#16a34a" }}>{risk}</td>
                        <td className="px-4 py-2.5 text-gray-700">{hemo}</td>
                        <td className="px-4 py-2.5 text-gray-700">{echo}</td>
                        <td className="px-4 py-2.5 text-gray-700">{trop}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{mgmt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PE Assessment Checklist */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <ChecklistSection
                title="Pulmonary Embolism Echo Assessment Checklist"
                items={[
                  { item: "RV size — RV/LV basal ratio", detail: "Apical 4-ch RV-focused view. Ratio >1.0 = RV dilation = RV strain." },
                  { item: "RV systolic function — TAPSE", detail: "M-mode at lateral tricuspid annulus. <17 mm = RV dysfunction." },
                  { item: "RV free wall motion — McConnell's sign", detail: "Assess RV free wall vs. apex. Free wall hypokinesis + preserved apex = McConnell's." },
                  { item: "Interventricular septal morphology", detail: "PSAX at papillary muscle level. Systolic flattening (D-sign) = acute RV pressure overload." },
                  { item: "TRV and estimated RVSP", detail: "CW Doppler TR jet. 60/60 sign: PAAT <60 ms AND RVSP <60 mmHg = acute PE." },
                  { item: "PA acceleration time (PAAT)", detail: "PW Doppler in RVOT. <60 ms with notching = severe acute PE." },
                  { item: "IVC diameter and collapsibility", detail: "Subcostal view. Dilated non-collapsing IVC = elevated RAP = RV failure." },
                  { item: "Right heart thrombus", detail: "Carefully assess RA, RV, and tricuspid valve for mobile thrombus. High-risk finding." },
                  { item: "LV size and function", detail: "Underfilled LV (D-shaped) in massive PE. Assess for alternative diagnoses." },
                  { item: "Pericardial effusion", detail: "Exclude tamponade as alternative cause of hemodynamic compromise." },
                  { item: "Aortic root and descending aorta", detail: "Exclude aortic dissection in undifferentiated shock." },
                  { item: "Patent foramen ovale (PFO)", detail: "Agitated saline contrast if available. PFO with PE = paradoxical embolism risk." },
                ]}
              />
            </div>

            {/* Acute PE vs Chronic PH */}
            <CollapsibleSection
              title="Acute PE vs. Chronic PH — Echo Differentiation"
              subtitle="Key features that distinguish new from established RV pressure overload"
              icon={Activity}
              iconBg={BRAND_DARK}
            >
              <div className="overflow-x-auto bg-white rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Feature</th>
                      <th className="text-left px-4 py-3 font-semibold text-red-600">Acute PE</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: BRAND }}>Chronic PH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["RV wall thickness", "Normal (no time for hypertrophy)", "Increased (≥5 mm = hypertrophy)"],
                      ["RVSP", "Rarely >60–70 mmHg (RV can't generate more acutely)", "Often >70 mmHg (adapted RV)"],
                      ["RV size", "Dilated but thin-walled", "Dilated and hypertrophied"],
                      ["McConnell's sign", "Classic — free wall hypokinesis, apex spared", "Absent — global RV hypokinesis"],
                      ["60/60 sign", "Present (PAAT <60 ms, RVSP <60 mmHg)", "Absent (RVSP usually >60 mmHg)"],
                      ["PA diameter", "Normal or mildly dilated", "Markedly dilated (>30 mm)"],
                      ["PAAT notching", "May be present", "Classic mid-systolic notch"],
                      ["LV size", "Small / underfilled", "Normal or reduced"],
                      ["Pericardial effusion", "Uncommon", "Common (adverse prognostic sign)"],
                    ].map(([feature, acute, chronic], i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-2.5 font-medium text-gray-700 border-r border-gray-100">{feature}</td>
                        <td className="px-4 py-2.5 text-red-700">{acute}</td>
                        <td className="px-4 py-2.5 text-teal-700">{chronic}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>

            {/* PE Clinical Pearls */}
            <CollapsibleSection
              title="Clinical Pearls — Pulmonary Embolism"
              subtitle="Key signs, pitfalls, and reporting tips"
              icon={CheckCircle2}
              iconBg={BRAND}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: BRAND }} /> Pearls
                  </h4>
                  <ul className="space-y-2">
                    {[
                      "McConnell's sign + 60/60 sign together have very high specificity for acute PE.",
                      "A normal echo does NOT exclude PE — small peripheral emboli may cause no RV changes.",
                      "RV hypertrophy (wall >5 mm) suggests chronic pressure overload, not acute PE.",
                      "The 60/60 sign distinguishes acute PE from chronic PH where RVSP is usually >60 mmHg.",
                      "Always assess for PFO in PE — paradoxical embolism is a serious complication.",
                      "Persistent RV dysfunction at 3–6 months post-PE warrants CTEPH workup (V/Q scan).",
                    ].map((pearl, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: BRAND }} />
                        {pearl}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" /> Red Flags — Urgent Action
                  </h4>
                  <ul className="space-y-2">
                    {[
                      "Mobile right heart thrombus — very high mortality; urgent intervention required.",
                      "McConnell's sign + hemodynamic instability — consider immediate thrombolysis.",
                      "RV/LV ratio >1.0 + shock — high-risk PE; escalate care immediately.",
                      "Paradoxical septal motion + underfilled LV — massive PE with RV failure.",
                      "New pericardial effusion in PE context — consider hemorrhagic complication.",
                      "Aortic root dilation or intimal flap — exclude dissection before thrombolysis.",
                    ].map((flag, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#ef4444" }} />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CollapsibleSection>

          </div>
        )}

        {/* Copyright */}
        <div className="text-xs text-gray-400 text-center py-4 border-t border-gray-100 mt-2">
          Clinical content © All About Ultrasound, Inc. / iHeartEcho™. Educational use only. Based on ASE 2025, ESC/ERS 2022, and ESC 2019 PE guidelines.
        </div>
      </div>
      </PremiumOverlay>
    </Layout>
  );
}
