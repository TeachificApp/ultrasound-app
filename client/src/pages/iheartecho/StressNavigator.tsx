/*
  iHeartEcho™ — Stress Echo Navigator
  Covers: Exercise stress echo, Dobutamine stress echo (DSE), Vasodilator stress echo
  Wall motion scoring (WMSI), target HR, interpretation criteria, low-dose DSE for viability
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Activity, AlertCircle, CheckCircle2, Circle, ChevronDown, ChevronUp, Zap, Scan } from "lucide-react";
import { Link } from "wouter";
import { PremiumOverlay } from "@/components/PremiumOverlay";

// --- WALL MOTION SCORING ------------------------------------------------------
const segments17 = [
  // Basal (6)
  { id: "bas_ant", label: "Basal Anterior", territory: "LAD" },
  { id: "bas_antlat", label: "Basal Anterolateral", territory: "LCx" },
  { id: "bas_inflat", label: "Basal Inferolateral", territory: "LCx" },
  { id: "bas_inf", label: "Basal Inferior", territory: "RCA" },
  { id: "bas_infsep", label: "Basal Inferoseptal", territory: "RCA" },
  { id: "bas_antsep", label: "Basal Anteroseptal", territory: "LAD" },
  // Mid (6)
  { id: "mid_ant", label: "Mid Anterior", territory: "LAD" },
  { id: "mid_antlat", label: "Mid Anterolateral", territory: "LCx" },
  { id: "mid_inflat", label: "Mid Inferolateral", territory: "LCx" },
  { id: "mid_inf", label: "Mid Inferior", territory: "RCA" },
  { id: "mid_infsep", label: "Mid Inferoseptal", territory: "RCA" },
  { id: "mid_antsep", label: "Mid Anteroseptal", territory: "LAD" },
  // Apical (4) + apex
  { id: "ap_ant", label: "Apical Anterior", territory: "LAD" },
  { id: "ap_lat", label: "Apical Lateral", territory: "LCx" },
  { id: "ap_inf", label: "Apical Inferior", territory: "RCA" },
  { id: "ap_sep", label: "Apical Septal", territory: "LAD" },
  { id: "apex", label: "Apex", territory: "LAD" },
];

const wmScores: Record<number, { label: string; color: string }> = {
  1: { label: "Normal", color: "#16a34a" },
  2: { label: "Hypokinetic", color: "#d97706" },
  3: { label: "Akinetic", color: "#ea580c" },
  4: { label: "Dyskinetic", color: "#dc2626" },
  5: { label: "Aneurysmal", color: "#d97706" },
};

function WallMotionScorer() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<"rest" | "stress">("rest");

  const setScore = (id: string, score: number) => {
    setScores(prev => ({ ...prev, [`${stage}_${id}`]: score }));
  };

  const getScore = (id: string) => scores[`${stage}_${id}`] || 0;

  const scoredSegments = segments17.filter(s => scores[`${stage}_${s.id}`] > 0);
  const wmsi = scoredSegments.length > 0
    ? (scoredSegments.reduce((acc, s) => acc + (scores[`${stage}_${s.id}`] || 1), 0) / segments17.length).toFixed(2)
    : null;

  // New wall motion abnormalities (stress vs rest)
  const newAbnormal = stage === "stress" ? segments17.filter(s => {
    const restScore = scores[`rest_${s.id}`] || 1;
    const stressScore = scores[`stress_${s.id}`] || 1;
    return stressScore > restScore;
  }) : [];

  const territories = ["LAD", "LCx", "RCA"];
  const territoryAbnormal = territories.map(t => ({
    territory: t,
    segments: newAbnormal.filter(s => s.territory === t),
  })).filter(t => t.segments.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        {(["rest", "stress"] as const).map(s => (
          <button key={s} onClick={() => setStage(s)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
              stage === s ? "text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={stage === s ? { background: "#189aa1" } : {}}>
            {s} Images
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {segments17.map(seg => {
          const score = getScore(seg.id);
          const wmInfo = wmScores[score];
          return (
            <div key={seg.id} className="border border-gray-100 rounded-lg p-2 bg-white">
              <div className="text-xs font-medium text-gray-600 mb-1.5">{seg.label}</div>
              <div className="text-xs text-gray-400 mb-2">{seg.territory}</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(s => (
                  <button key={s} onClick={() => setScore(seg.id, score === s ? 0 : s)}
                    className="flex-1 py-1 rounded text-xs font-bold transition-all"
                    style={{
                      background: score === s ? wmScores[s].color : "#f3f4f6",
                      color: score === s ? "white" : "#6b7280",
                    }}>
                    {s}
                  </button>
                ))}
              </div>
              {score > 0 && (
                <div className="text-xs font-semibold mt-1" style={{ color: wmInfo.color }}>{wmInfo.label}</div>
              )}
            </div>
          );
        })}
      </div>

      {wmsi && (
        <div className="rounded-lg p-4 border border-[#189aa1]/20 bg-[#f0fbfc] animate-in fade-in duration-300">
          <div className="flex items-center gap-4 mb-2">
            <div>
              <div className="text-xs text-gray-500">Wall Motion Score Index (WMSI)</div>
              <div className="text-3xl font-black text-[#189aa1]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{wmsi}</div>
              <div className="text-xs text-gray-500">Normal = 1.0 | Abnormal &gt; 1.0</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Abnormal segments</div>
              <div className="text-2xl font-black text-[#189aa1]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{scoredSegments.filter(s => (scores[`${stage}_${s.id}`] || 1) > 1).length}/17</div>
            </div>
          </div>
          {stage === "stress" && newAbnormal.length > 0 && (
            <div className="mt-2 p-2 rounded bg-red-50 border border-red-200">
              <div className="text-xs font-bold text-red-700 mb-1">⚠ New wall motion abnormalities at stress:</div>
              {territoryAbnormal.map(t => (
                <div key={t.territory} className="text-xs text-red-600">
                  <strong>{t.territory}:</strong> {t.segments.map(s => s.label).join(", ")}
                </div>
              ))}
              <div className="text-xs text-red-600 mt-1 font-semibold">Positive stress echo — inducible ischemia</div>
            </div>
          )}
        </div>
      )}
      <div className="text-xs text-gray-400">Score: 1=Normal | 2=Hypokinetic | 3=Akinetic | 4=Dyskinetic | 5=Aneurysmal</div>
    </div>
  );
}

// --- TARGET HR CALCULATOR -----------------------------------------------------
function TargetHRCalc() {
  const [age, setAge] = useState("");
  const [protocol, setProtocol] = useState("exercise");

  const maxHR = age ? 220 - parseFloat(age) : 0;
  const target85 = maxHR ? Math.round(maxHR * 0.85) : 0;
  const target80 = maxHR ? Math.round(maxHR * 0.80) : 0;
  const dseTarget = maxHR ? Math.round(maxHR * 0.85) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Patient Age</label>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#189aa1]/30">
            <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 65"
              className="flex-1 px-3 py-2 text-sm outline-none" style={{ fontFamily: "JetBrains Mono, monospace" }} />
            <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200">yrs</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Protocol</label>
          <select value={protocol} onChange={e => setProtocol(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30">
            <option value="exercise">Exercise Stress Echo</option>
            <option value="dse">Dobutamine Stress Echo (DSE)</option>
            <option value="vasodilator">Vasodilator (Regadenoson/Adenosine)</option>
          </select>
        </div>
      </div>
      {maxHR > 0 && (
        <div className="rounded-lg p-4 border border-[#189aa1]/20 bg-[#f0fbfc] animate-in fade-in duration-300">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="text-center">
              <div className="text-xs text-gray-500">Max HR (220-age)</div>
              <div className="text-2xl font-black text-gray-700" style={{ fontFamily: "JetBrains Mono, monospace" }}>{maxHR}</div>
              <div className="text-xs text-gray-400">bpm</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Target (85%)</div>
              <div className="text-2xl font-black text-[#189aa1]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{target85}</div>
              <div className="text-xs text-gray-400">bpm</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Adequate (80%)</div>
              <div className="text-2xl font-black text-[#189aa1]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{target80}</div>
              <div className="text-xs text-gray-400">bpm</div>
            </div>
          </div>
          {protocol === "dse" && (
            <div className="p-3 rounded bg-white border border-gray-100 text-xs text-gray-600">
              <div className="font-bold text-[#189aa1] mb-1">DSE Protocol (Standard)</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["5 min", "5 μg/kg/min"],
                  ["10 min", "10 μg/kg/min"],
                  ["15 min", "20 μg/kg/min"],
                  ["20 min", "30 μg/kg/min"],
                  ["25 min", "40 μg/kg/min"],
                  ["If target not reached", "Atropine 0.25–1 mg IV"],
                ].map(([time, dose]) => (
                  <div key={time} className="flex justify-between">
                    <span className="text-gray-500">{time}:</span>
                    <span className="font-mono font-bold text-[#189aa1]">{dose}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 font-semibold text-amber-600">Target: {dseTarget} bpm or ≥85% max HR</div>
            </div>
          )}
          {protocol === "vasodilator" && (
            <div className="p-3 rounded bg-white border border-gray-100 text-xs text-gray-600">
              <div className="font-bold text-[#189aa1] mb-1">Regadenoson Protocol</div>
              <div>Single bolus: 0.4 mg IV over 10 seconds</div>
              <div>Images: 60–90 seconds post-injection</div>
              <div className="mt-1 text-amber-600 font-semibold">Contraindicated: 2nd/3rd degree AV block, severe asthma/COPD</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- PROTOCOL CHECKLISTS ------------------------------------------------------
type StressProtocol = { name: string; icon: string; stages: { name: string; items: { id: string; label: string; critical?: boolean }[] }[] };

const protocols: StressProtocol[] = [
  {
    name: "Exercise Stress Echo",
    icon: "🏃",
    stages: [
      {
        name: "Pre-Exercise",
        items: [
          { id: "ex_pre_consent", label: "Informed consent obtained", critical: true },
          { id: "ex_pre_contraindications", label: "Contraindications reviewed (ACS, severe AS, uncontrolled HTN)", critical: true },
          { id: "ex_pre_baseline_images", label: "Baseline images acquired (all 4 views)", critical: true },
          { id: "ex_pre_baseline_ef", label: "Baseline EF and WMSI documented" },
          { id: "ex_pre_bp_hr", label: "Baseline BP and HR documented" },
          { id: "ex_pre_ecg", label: "Baseline 12-lead ECG" },
          { id: "ex_pre_iv", label: "IV access established" },
        ],
      },
      {
        name: "During Exercise",
        items: [
          { id: "ex_during_hr", label: "HR and BP monitored each stage" },
          { id: "ex_during_ecg", label: "Continuous ECG monitoring for ST changes", critical: true },
          { id: "ex_during_symptoms", label: "Symptoms documented (chest pain, dyspnea, dizziness)" },
          { id: "ex_during_stop", label: "Stop criteria reviewed (ST ≥2 mm, SBP drop >10 mmHg, severe symptoms)" },
        ],
      },
      {
        name: "Peak/Immediate Post-Exercise",
        items: [
          { id: "ex_peak_images", label: "Peak images acquired within 60–90 seconds of stopping", critical: true },
          { id: "ex_peak_hr", label: "Peak HR ≥85% max HR documented", critical: true },
          { id: "ex_peak_4views", label: "All 4 standard views acquired (PLAX, PSAX, A4C, A2C)", critical: true },
          { id: "ex_peak_ef", label: "Peak EF estimated" },
          { id: "ex_peak_wm", label: "Wall motion compared to rest (new abnormalities?)", critical: true },
          { id: "ex_peak_diastology", label: "Peak E/e' ratio (diastolic stress response)" },
          { id: "ex_peak_rvsp", label: "Peak RVSP (TR Vmax at peak)" },
        ],
      },
      {
        name: "Recovery",
        items: [
          { id: "ex_rec_images", label: "Recovery images (3–5 min post-exercise)" },
          { id: "ex_rec_ecg", label: "Recovery ECG (ST resolution)" },
          { id: "ex_rec_bp", label: "Recovery BP and HR" },
          { id: "ex_rec_symptoms", label: "Symptom resolution confirmed" },
        ],
      },
    ],
  },
  {
    name: "Dobutamine Stress Echo (DSE)",
    icon: "💉",
    stages: [
      {
        name: "Pre-DSE",
        items: [
          { id: "dse_pre_consent", label: "Informed consent obtained", critical: true },
          { id: "dse_pre_contraindications", label: "Contraindications reviewed (VT, severe LVOTO, uncontrolled HTN, recent MI)", critical: true },
          { id: "dse_pre_betablocker", label: "Beta-blockers held ≥24 hours (if possible)" },
          { id: "dse_pre_baseline", label: "Baseline images (all 4 views)", critical: true },
          { id: "dse_pre_iv", label: "IV access established (18G or larger)", critical: true },
          { id: "dse_pre_atropine", label: "Atropine drawn up (0.25–1 mg)", critical: true },
          { id: "dse_pre_crash_cart", label: "Crash cart and defibrillator available", critical: true },
        ],
      },
      {
        name: "Low-Dose Phase (5–10 μg/kg/min)",
        items: [
          { id: "dse_low_images", label: "Images at each dose stage", critical: true },
          { id: "dse_low_viability", label: "Assess for contractile reserve (viability protocol — improved function at low dose = hibernating)" },
          { id: "dse_low_hr_bp", label: "HR and BP at each stage" },
          { id: "dse_low_ecg", label: "ECG monitoring" },
        ],
      },
      {
        name: "High-Dose Phase (20–40 μg/kg/min)",
        items: [
          { id: "dse_high_images", label: "Images at each dose stage", critical: true },
          { id: "dse_high_target_hr", label: "Target HR achieved (≥85% max HR)", critical: true },
          { id: "dse_high_wm", label: "Wall motion compared to rest and low-dose", critical: true },
          { id: "dse_high_atropine", label: "Atropine given if target HR not achieved" },
          { id: "dse_high_stop", label: "Stop criteria monitored (VT, ST ≥2 mm, SBP drop, severe symptoms)", critical: true },
        ],
      },
      {
        name: "Recovery",
        items: [
          { id: "dse_rec_images", label: "Recovery images (5–10 min post-DSE)" },
          { id: "dse_rec_ecg", label: "Recovery ECG" },
          { id: "dse_rec_hr", label: "HR and BP normalization confirmed" },
          { id: "dse_rec_symptoms", label: "Symptom resolution confirmed" },
        ],
      },
    ],
  },
];

// --- INTERPRETATION CRITERIA --------------------------------------------------
const interpretationCriteria = [
  {
    result: "Positive (Ischemia)",
    color: "#dc2626",
    criteria: [
      "New or worsening wall motion abnormality at peak stress",
      "New RWMA in ≥2 adjacent segments",
      "Transient LV dilation at peak stress",
      "EF decrease ≥5% at peak stress",
      "New MR at peak (papillary muscle ischemia)",
    ],
  },
  {
    result: "Negative (No Ischemia)",
    color: "#16a34a",
    criteria: [
      "No new wall motion abnormalities at peak stress",
      "Normal or improved wall motion throughout",
      "EF maintained or increased at peak",
      "Target HR achieved (≥85% max HR)",
    ],
  },
  {
    result: "Inconclusive",
    color: "#d97706",
    criteria: [
      "Suboptimal HR response (<80% max HR without atropine)",
      "Poor image quality at peak",
      "LBBB development at peak (limits wall motion interpretation)",
      "Inadequate stress achieved",
    ],
  },
  {
    result: "Viability (Low-Dose DSE)",
    color: "#d97706",
    criteria: [
      "Biphasic response: improved at low dose → worsens at high dose = viable + ischemic",
      "Sustained improvement at all doses = viable, no significant ischemia",
      "No change at any dose = non-viable (scar)",
      "Worsens at low dose = non-viable or severe ischemia",
    ],
  },
];

// --- MAIN COMPONENT -----------------------------------------------------------
type TabId = "protocol" | "target_hr" | "interpretation" | "reference";

export default function StressNavigator() {
  const [tab, setTab] = useState<TabId>("protocol");
  const [selectedProtocol, setSelectedProtocol] = useState(0);
  const [expandedStage, setExpandedStage] = useState<number | null>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const currentProtocol = protocols[selectedProtocol];
  const totalItems = currentProtocol.stages.reduce((acc, s) => acc + s.items.length, 0);
  const progress = Math.round((checked.size / totalItems) * 100);

  const tabs = [
    { id: "protocol" as TabId, label: "Protocol Checklist" },
    { id: "target_hr" as TabId, label: "Target HR / Dosing" },
    { id: "interpretation" as TabId, label: "Interpretation" },
    { id: "reference" as TabId, label: "Normal Reference Values" },
  ];

  return (
    <Layout>
      {/* Hero Banner */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="container py-8 md:py-10">
          <div className="mb-3">
            <BackToEchoAssist className="text-white/70 hover:text-white" />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Zap className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                  <span className="text-xs text-white/80 font-medium">Guideline-Based Stress Echo Protocol</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  PREMIUM
                </div>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAssist™ Navigator — Stress Echo
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Exercise and dobutamine stress echo protocols, target HR calculator, and interpretation criteria.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/stress-scan-coach">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <Scan className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    Stress ScanCoach
                    <span className="text-xs text-[#4ad9e0]">→</span>
                  </button>
                </Link>
                <Link href="/echoassist#engine-stress">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <Zap className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    WMSI in Stress EchoAssist™
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
      <PremiumOverlay featureName="Stress Echo Navigator">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
              }`}
              style={tab === t.id ? { background: "#189aa1" } : {}}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "reference" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b" style={{ background: "linear-gradient(90deg, #0e4a50, #189aa1)" }}>
              <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>Stress Echo Normal Reference Values</h3>
              <p className="text-xs text-white/70 mt-0.5">Guideline-Based Stress Echo · Strain Assessment</p>
            </div>
            <div className="p-5 space-y-5">
              {[
                { section: "Resting LV Function", rows: [
                  ["LV EF (resting)", "≥ 55%"],
                  ["LV GLS (resting)", "≤ −18% (ASE 2025)"],
                  ["WMSI (resting)", "1.0 (all segments normal)"],
                ]},
                { section: "Stress Response (Normal)", rows: [
                  ["EF increase with stress", "≥ 5% above resting"],
                  ["WMSI (peak stress)", "1.0 (no new WMA)"],
                  ["Wall motion", "All 17 segments normal/hyperkinetic at peak"],
                  ["LV cavity size", "Decreases or unchanged at peak stress"],
                ]},
                { section: "Target Heart Rate", rows: [
                  ["Exercise stress", "85% of maximum predicted HR (220 − age)"],
                  ["DSE (standard)", "85% MPHR or 40 mcg/kg/min"],
                  ["DSE (low-dose viability)", "5–20 mcg/kg/min (biphasic response)"],
                ]},
                { section: "Dobutamine Dosing", rows: [
                  ["Starting dose", "5 mcg/kg/min"],
                  ["Increments", "5–10 mcg/kg/min every 3 min"],
                  ["Maximum dose", "40 mcg/kg/min"],
                  ["Atropine augmentation", "0.25–1.0 mg IV if target HR not reached"],
                ]},
                { section: "Interpretation Thresholds", rows: [
                  ["Positive test", "New or worsening WMA at peak stress"],
                  ["Ischemic threshold", "WMA at low workload or low HR"],
                  ["Viability (biphasic)", "Improvement at low dose, deterioration at high dose"],
                  ["Hibernation", "Improvement at low dose, sustained at high dose"],
                ]},
              ].map(({ section, rows }) => (
                <div key={section}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#189aa1" }}>{section}</div>
                  <table className="w-full text-xs">
                    <tbody>
                      {rows.map(([param, val]) => (
                        <tr key={param} className="border-b border-gray-50 last:border-0">
                          <td className="py-1.5 text-gray-600 w-1/2">{param}</td>
                          <td className="py-1.5 font-semibold text-gray-800">{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-2">References: ASE 2007 Stress Echo Guidelines, ASE 2025 Strain Guideline (Thomas et al.).</p>
            </div>
          </div>
        )}
        {tab === "protocol" && (
          <div>
            {/* Protocol selector */}
            <div className="flex gap-2 mb-5">
              {protocols.map((p, i) => (
                <button key={i} onClick={() => { setSelectedProtocol(i); setChecked(new Set()); setExpandedStage(0); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    selectedProtocol === i ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-[#189aa1]"
                  }`}
                  style={selectedProtocol === i ? { background: "#189aa1" } : {}}>
                  <span>{p.icon}</span>{p.name}
                </button>
              ))}
            </div>

            {/* Progress */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-700">{currentProtocol.name} Progress</div>
                <div className="text-sm font-bold text-[#189aa1]">{checked.size}/{totalItems}</div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "#189aa1" }} />
              </div>
            </div>

            <div className="space-y-3">
              {currentProtocol.stages.map((stage, si) => {
                const stageChecked = stage.items.filter(i => checked.has(i.id)).length;
                const isExpanded = expandedStage === si;
                return (
                  <div key={si} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#f0fbfc] transition-all"
                      onClick={() => setExpandedStage(isExpanded ? null : si)}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: stageChecked === stage.items.length ? "#16a34a" : "#189aa1" }}>
                        {stageChecked === stage.items.length ? "✓" : si + 1}
                      </div>
                      <span className="font-bold text-sm text-gray-800 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
                        {stage.name}
                      </span>
                      <span className="text-xs text-gray-400 mr-2">{stageChecked}/{stage.items.length}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {stage.items.map(item => (
                          <div key={item.id}
                            className={`flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-[#f0fbfc] transition-all ${
                              checked.has(item.id) ? "bg-green-50/50" : ""
                            }`}
                            onClick={() => toggleCheck(item.id)}>
                            {checked.has(item.id)
                              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                              : <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${item.critical ? "text-amber-400" : "text-gray-300"}`} />
                            }
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${checked.has(item.id) ? "text-gray-400 line-through" : "text-gray-700"}`}>
                                {item.label}
                                {item.critical && !checked.has(item.id) && (
                                  <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Critical</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "target_hr" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="teal-header px-5 py-4">
              <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>
                Target Heart Rate & Protocol Dosing
              </h3>
            </div>
            <div className="p-5">
              <TargetHRCalc />
            </div>
          </div>
        )}

        {tab === "interpretation" && (
          <div className="space-y-3">
            {interpretationCriteria.map((crit, ci) => (
              <div key={ci} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-3" style={{ borderLeft: `4px solid ${crit.color}` }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: crit.color }} />
                  <span className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif", color: crit.color }}>
                    {crit.result}
                  </span>
                </div>
                <div className="px-5 pb-4">
                  <ul className="space-y-2">
                    {crit.criteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: crit.color }} />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <strong>Important:</strong> Stress echo interpretation requires integration of wall motion, hemodynamic response, symptoms, and ECG changes.
                A positive stress echo should prompt further evaluation (coronary CTA or invasive angiography). Always correlate with pre-test probability.
                Per ASE/ACC/AHA Stress Echo Guidelines.
              </div>
            </div>
          </div>
        )}
      </PremiumOverlay>
      </div>
    </Layout>
  );
}
