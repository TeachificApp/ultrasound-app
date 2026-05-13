/*
  iHeartEcho™ — StressEchoAssist™
  Dedicated stress echo calculator page: 17-Segment WMSI, Target HR / Protocol Dosing, Interpretation Criteria
  Premium-gated via PremiumOverlay.
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body, JetBrains Mono data
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Activity, Zap, Save, CheckCircle2, AlertCircle, MessageSquare, Lightbulb } from "lucide-react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const stressSegments17 = [
  { id: "bas_ant",    label: "Basal Anterior",        territory: "LAD" },
  { id: "bas_antlat", label: "Basal Anterolateral",   territory: "LCx" },
  { id: "bas_inflat", label: "Basal Inferolateral",   territory: "LCx" },
  { id: "bas_inf",    label: "Basal Inferior",        territory: "RCA" },
  { id: "bas_infsep", label: "Basal Inferoseptal",    territory: "RCA" },
  { id: "bas_antsep", label: "Basal Anteroseptal",    territory: "LAD" },
  { id: "mid_ant",    label: "Mid Anterior",          territory: "LAD" },
  { id: "mid_antlat", label: "Mid Anterolateral",     territory: "LCx" },
  { id: "mid_inflat", label: "Mid Inferolateral",     territory: "LCx" },
  { id: "mid_inf",    label: "Mid Inferior",          territory: "RCA" },
  { id: "mid_infsep", label: "Mid Inferoseptal",      territory: "RCA" },
  { id: "mid_antsep", label: "Mid Anteroseptal",      territory: "LAD" },
  { id: "ap_ant",     label: "Apical Anterior",       territory: "LAD" },
  { id: "ap_lat",     label: "Apical Lateral",        territory: "LCx" },
  { id: "ap_inf",     label: "Apical Inferior",       territory: "RCA" },
  { id: "ap_sep",     label: "Apical Septal",         territory: "LAD" },
  { id: "apex",       label: "Apex",                  territory: "LAD" },
];

const wmScoreLabels: Record<number, { label: string; color: string }> = {
  1: { label: "Normal",      color: "#16a34a" },
  2: { label: "Hypokinetic", color: "#d97706" },
  3: { label: "Akinetic",    color: "#ea580c" },
  4: { label: "Dyskinetic",  color: "#dc2626" },
  5: { label: "Aneurysmal",  color: "#b45309" },
};

const stressInterpretation = [
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
    color: "#0369a1",
    criteria: [
      "Biphasic response: improved at low dose → worsens at high dose = viable + ischemic",
      "Sustained improvement at all doses = viable, no significant ischemia",
      "No change at any dose = non-viable (scar)",
      "Worsens at low dose = non-viable or severe ischemia",
    ],
  },
];

// ─── ECHOASSIST PANEL ─────────────────────────────────────────────────────────

interface EchoAssistOutput { suggests: string; note?: string; tip?: string; }

function EchoAssistPanel({ output }: { output: EchoAssistOutput | null }) {
  if (!output) return null;
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-[#189aa1]/30 shadow-sm">
      <div className="flex items-start gap-3 px-4 py-3 bg-[#f0fbfc] border-b border-[#189aa1]/20">
        <MessageSquare className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0e7490] block mb-0.5">EchoAssist™ Suggests</span>
          <p className="text-sm text-[#0e7490] font-medium leading-snug">{output.suggests}</p>
        </div>
      </div>
      {output.note && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 block mb-0.5">EchoAssist™ Note</span>
            <p className="text-sm text-amber-800 leading-snug">{output.note}</p>
          </div>
        </div>
      )}
      {output.tip && (
        <div className="flex items-start gap-3 px-4 py-3 bg-white">
          <Lightbulb className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#189aa1] block mb-0.5">EchoAssist™ Tip</span>
            <p className="text-sm text-gray-600 leading-snug">{output.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN CALCULATOR COMPONENT ────────────────────────────────────────────────

function StressEchoCalculator() {
  const { isAuthenticated } = useAuth();
  const [innerTab, setInnerTab] = useState<"wmsi" | "target_hr" | "interpretation">("wmsi");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<"rest" | "stress">("rest");
  const [age, setAge] = useState("");
  const [protocol, setProtocol] = useState("exercise");
  const [studyId, setStudyId] = useState("");
  const [studyDate, setStudyDate] = useState("");
  const [savedOk, setSavedOk] = useState(false);

  const setScore = (id: string, score: number) => {
    setScores(prev => ({ ...prev, [`${stage}_${id}`]: score }));
  };
  const getScore = (id: string) => scores[`${stage}_${id}`] || 0;
  const scoredSegments = stressSegments17.filter(s => scores[`${stage}_${s.id}`] > 0);
  const wmsi = scoredSegments.length > 0
    ? (scoredSegments.reduce((acc, s) => acc + (scores[`${stage}_${s.id}`] || 1), 0) / stressSegments17.length).toFixed(2)
    : null;
  const newAbnormal = stage === "stress" ? stressSegments17.filter(s => {
    const restScore = scores[`rest_${s.id}`] || 1;
    const stressScore = scores[`stress_${s.id}`] || 1;
    return stressScore > restScore;
  }) : [];
  const territories = ["LAD", "LCx", "RCA"];
  const territoryAbnormal = territories.map(t => ({
    territory: t,
    segments: newAbnormal.filter(s => s.territory === t),
  })).filter(t => t.segments.length > 0);
  const maxHR = age ? 220 - parseFloat(age) : 0;
  const target85 = maxHR ? Math.round(maxHR * 0.85) : 0;
  const target80 = maxHR ? Math.round(maxHR * 0.80) : 0;
  const hasNewWMA = newAbnormal.length > 0;
  const wmsiNum = wmsi ? parseFloat(wmsi) : null;

  const getInterpretation = (): EchoAssistOutput | null => {
    if (!wmsi) return null;
    if (stage === "stress" && hasNewWMA) {
      const terrs = territoryAbnormal.map(t => `${t.territory} (${t.segments.map(s => s.label).join(", ")})`).join("; ");
      return {
        suggests: `Positive Stress Echo — Inducible ischemia identified. WMSI = ${wmsi}. New wall motion abnormalities at stress in: ${terrs}.`,
        note: "EchoAssist™ Note: New or worsening regional wall motion abnormalities at peak stress in ≥2 adjacent segments are the primary criterion for a positive stress echo. Transient LV dilation and EF drop ≥5% are additional positive markers.",
        tip: "EchoAssist™ Tip: Correlate with the coronary territory distribution of the new WMAs to guide catheterization planning. LAD territory involvement carries higher risk than isolated RCA or LCx disease.",
      };
    }
    if (stage === "stress" && wmsiNum !== null && wmsiNum <= 1.0) {
      return {
        suggests: `Negative Stress Echo — No new wall motion abnormalities at stress. WMSI = ${wmsi} (normal = 1.0). All 17 segments normal or hyperkinetic at peak stress.`,
        note: "EchoAssist™ Note: A negative stress echo with adequate heart rate response (≥85% MPHR) has a high negative predictive value for significant obstructive CAD.",
        tip: "EchoAssist™ Tip: Confirm target HR was achieved. A suboptimal HR response (<80% MPHR without atropine augmentation) renders the study inconclusive regardless of wall motion findings.",
      };
    }
    if (stage === "rest") {
      return {
        suggests: `Resting WMSI = ${wmsi}. ${wmsiNum && wmsiNum > 1.0 ? "Resting wall motion abnormality present — consider prior MI, cardiomyopathy, or LBBB." : "Normal resting wall motion."}`,
        note: "EchoAssist™ Note: Switch to Stress stage and enter peak stress scores to generate a full stress echo interpretation.",
        tip: "EchoAssist™ Tip: Document resting WMSI before stress to identify baseline abnormalities that may confound stress interpretation.",
      };
    }
    return null;
  };

  const interpretation = getInterpretation();

  const saveMutation = trpc.caseMix.create.useMutation({
    onSuccess: () => { setSavedOk(true); setTimeout(() => setSavedOk(false), 3000); },
  });
  const handleSave = () => {
    if (!studyId.trim()) return;
    saveMutation.mutate({
      modality: "STRESS",
      caseType: hasNewWMA ? "Positive Stress Echo — Inducible Ischemia" : "Negative Stress Echo",
      studyIdentifier: studyId.trim(),
      studyDate: studyDate || undefined,
      notes: interpretation ? `${interpretation.suggests}` : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Inner tab bar */}
      <div className="flex flex-wrap gap-2">
        {(["wmsi", "target_hr", "interpretation"] as const).map(t => (
          <button key={t} onClick={() => setInnerTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              innerTab === t ? "text-white shadow-sm" : "bg-gray-50 text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
            }`}
            style={innerTab === t ? { background: "#189aa1" } : {}}>
            {t === "wmsi" ? "Wall Motion Scoring" : t === "target_hr" ? "Target HR / Dosing" : "Interpretation"}
          </button>
        ))}
      </div>

      {/* WMSI Tab */}
      {innerTab === "wmsi" && (
        <div className="space-y-4">
          {/* Stage toggle */}
          <div className="flex gap-2">
            {(["rest", "stress"] as const).map(s => (
              <button key={s} onClick={() => setStage(s)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  stage === s ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"
                }`}
                style={stage === s ? { background: "#189aa1" } : {}}>
                {s === "rest" ? "Rest" : "Peak Stress"}
              </button>
            ))}
          </div>
          {/* Segment grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stressSegments17.map(seg => {
              const score = getScore(seg.id);
              const scoreInfo = wmScoreLabels[score];
              return (
                <div key={seg.id} className="bg-white rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-semibold text-gray-700">{seg.label}</span>
                      <span className="ml-2 text-[10px] text-gray-400 font-medium">{seg.territory}</span>
                    </div>
                    {score > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: scoreInfo.color }}>{scoreInfo.label}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setScore(seg.id, score === s ? 0 : s)}
                        className={`flex-1 py-1.5 rounded text-xs font-bold transition-all border ${
                          score === s ? "text-white border-transparent" : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400"
                        }`}
                        style={score === s ? { background: wmScoreLabels[s].color, borderColor: wmScoreLabels[s].color } : {}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* WMSI result */}
          {wmsi && (
            <div className="rounded-xl border p-4 animate-in fade-in duration-300"
              style={{
                background: hasNewWMA ? "#fef2f2" : "#f0fdf4",
                borderColor: hasNewWMA ? "#fca5a5" : "#86efac",
              }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold" style={{ color: hasNewWMA ? "#991b1b" : "#166534" }}>
                  WMSI = {wmsi}
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full text-white"
                  style={{ background: hasNewWMA ? "#dc2626" : "#16a34a" }}>
                  {stage === "stress" ? (hasNewWMA ? "Positive" : "Negative") : "Resting"}
                </span>
              </div>
              {stage === "stress" && newAbnormal.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-red-700 mb-1">New/worsening segments at stress:</p>
                  {territoryAbnormal.map(t => (
                    <p key={t.territory} className="text-xs text-red-600">
                      <span className="font-bold">{t.territory}:</span> {t.segments.map(s => s.label).join(", ")}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <EchoAssistPanel output={interpretation} />
          {/* Save as case */}
          {isAuthenticated && wmsi && (
            <div className="mt-4 p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-3">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save as Echo Case
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Study ID / Patient Ref</label>
                  <input value={studyId} onChange={e => setStudyId(e.target.value)}
                    placeholder="e.g. SE-2025-001"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Study Date</label>
                  <input type="date" value={studyDate} onChange={e => setStudyDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] outline-none" />
                </div>
              </div>
              <button onClick={handleSave} disabled={!studyId.trim() || saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "#189aa1" }}>
                {savedOk ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Case</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Target HR / Dosing Tab */}
      {innerTab === "target_hr" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Patient Age</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)}
                placeholder="e.g. 65"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Protocol</label>
              <select value={protocol} onChange={e => setProtocol(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] outline-none">
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
                    {[["5 min","5 μg/kg/min"],["10 min","10 μg/kg/min"],["15 min","20 μg/kg/min"],["20 min","30 μg/kg/min"],["25 min","40 μg/kg/min"],["If target not reached","Atropine 0.25–1 mg IV"]].map(([time, dose]) => (
                      <div key={time} className="flex justify-between">
                        <span className="text-gray-500">{time}:</span>
                        <span className="font-mono font-bold text-[#189aa1]">{dose}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 font-semibold text-amber-600">Target: {Math.round(maxHR * 0.85)} bpm or ≥85% max HR</div>
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
      )}

      {/* Interpretation Tab */}
      {innerTab === "interpretation" && (
        <div className="space-y-3">
          {stressInterpretation.map((crit, ci) => (
            <div key={ci} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-3" style={{ borderLeft: `4px solid ${crit.color}` }}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: crit.color }} />
                <h4 className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{crit.result}</h4>
              </div>
              <div className="px-5 pb-4">
                <ul className="space-y-1.5 mt-2">
                  {crit.criteria.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="mt-0.5 flex-shrink-0 text-[#189aa1]">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PAGE EXPORT ──────────────────────────────────────────────────────────────

export default function StressEchoAssistPage() {
  return (
    <Layout>
      {/* Page header */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="relative container py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <Activity className="w-3.5 h-3.5 text-[#4ad9e0]" />
              <span className="text-xs text-white/80 font-medium">Premium Clinical Tool</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
              style={{ fontFamily: "Merriweather, serif" }}>
              StressEchoAssist™
            </h1>
            <p className="text-[#4ad9e0] font-semibold text-lg mb-3">
              17-Segment WMSI · Target HR · Protocol Dosing · Interpretation
            </p>
            <p className="text-white/70 text-sm leading-relaxed max-w-lg">
              Guideline-based stress echocardiography calculator. Score all 17 AHA segments at rest and peak stress, calculate WMSI, identify ischemic territories, and get instant EchoAssist™ interpretation.
            </p>
          </div>
        </div>
      </div>

      {/* Premium-gated calculator */}
      <div className="container py-8">
        <PremiumOverlay featureName="StressEchoAssist™">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#f0fbfc" }}>
                <Zap className="w-5 h-5" style={{ color: "#189aa1" }} />
              </div>
              <div>
                <h2 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  StressEchoAssist™ Calculator
                </h2>
                <p className="text-xs text-gray-500">ASE/ACC Stress Echo Guidelines · 17-Segment AHA Model</p>
              </div>
            </div>
            <StressEchoCalculator />
          </div>
        </PremiumOverlay>

        {/* Reference footer */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">Guideline References</p>
          <p>• ASE/ASNC/SCCT/SCMR 2020 Stress Echo Guidelines (Pellikka et al.)</p>
          <p>• AHA/ACC 2021 Valvular Heart Disease Guidelines</p>
          <p>• ASE 17-Segment Model (Cerqueira et al., JASE 2002)</p>
          <p className="pt-1">© All About Ultrasound — iHeartEcho™ | www.iheartecho.com</p>
        </div>
      </div>
    </Layout>
  );
}
