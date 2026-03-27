/*
  UltrasoundAssist™ — Abdominal Vascular Ultrasound Navigator
  Tabs: Liver Duplex | Mesenteric Duplex | Renal Artery Duplex
  Based on: SVU Clinical Practice Guidelines; AIUM Practice Parameters (2021)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Scan } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import ProtocolProgressBar from "../components/ProtocolProgressBar";
import { useNavigatorSections } from "@/hooks/useNavigatorSections";

// ── LIVER DUPLEX ─────────────────────────────────────────────────────────────

const liverNormalValues = [
  {
    category: "Portal Vein",
    values: [
      { param: "Main portal vein diameter", normal: "<13 mm", borderline: "13–15 mm", abnormal: ">15 mm (portal hypertension)" },
      { param: "Portal vein velocity (mean)", normal: "15–40 cm/s", borderline: "12–15 cm/s", abnormal: "<12 cm/s (portal hypertension)" },
      { param: "Portal vein flow direction", normal: "Hepatopetal", borderline: "—", abnormal: "Hepatofugal (portal hypertension)" },
    ],
  },
  {
    category: "Hepatic Veins",
    values: [
      { param: "Hepatic vein waveform", normal: "Triphasic (S, D, A waves)", borderline: "Biphasic", abnormal: "Monophasic (congestion/cirrhosis)" },
    ],
  },
  {
    category: "Hepatic Artery",
    values: [
      { param: "Hepatic artery RI", normal: "0.55–0.70", borderline: "0.70–0.80", abnormal: ">0.80 (stenosis/rejection) or <0.50 (AV fistula)" },
      { param: "Hepatic artery PSV", normal: "60–100 cm/s", borderline: "100–200 cm/s", abnormal: ">200 cm/s (stenosis)" },
    ],
  },
];

const liverExamTips = [
  { category: "Preparation", text: "Patient should fast 4–6 hours prior to exam to reduce bowel gas and improve portal vein visualization. Fasting also allows the gallbladder to distend, which aids in identifying the portal triad." },
  { category: "Positioning", text: "Begin supine; use left lateral decubitus (LLD) position to shift bowel gas and improve intercostal access to the right lobe and hepatic veins. Asking the patient to hold a deep breath in inspiration moves the liver inferiorly for better subcostal windows." },
  { category: "Doppler Optimization", text: "Set PRF (scale) to 20–40 cm/s for portal vein; increase to 60–100 cm/s for hepatic artery. Use a wall filter of 50–100 Hz. Keep Doppler angle ≤60° for accurate velocity measurements." },
  { category: "Pearl", text: "Hepatofugal portal flow (away from liver) is pathognomonic of portal hypertension. Always confirm flow direction with color Doppler before obtaining spectral waveforms — color box orientation can be misleading." },
  { category: "Pitfall", text: "Respiratory variation can cause the portal vein waveform to appear pulsatile in normal patients — this should not be confused with pathologic pulsatility from right heart failure or tricuspid regurgitation, which produces a true pulsatile portal waveform." },
];

// ── MESENTERIC DUPLEX ─────────────────────────────────────────────────────────

const mesentericNormalValues = [
  {
    category: "Superior Mesenteric Artery (SMA)",
    values: [
      { param: "SMA PSV (fasting)", normal: "<275 cm/s", borderline: "275–300 cm/s", abnormal: ">275 cm/s (≥70% stenosis)" },
      { param: "SMA EDV (fasting)", normal: "<45 cm/s", borderline: "45–55 cm/s", abnormal: ">45 cm/s (≥70% stenosis)" },
      { param: "SMA waveform (fasting)", normal: "High-resistance triphasic", borderline: "Biphasic", abnormal: "Monophasic or absent diastolic flow" },
    ],
  },
  {
    category: "Celiac Axis (CA)",
    values: [
      { param: "Celiac axis PSV", normal: "<200 cm/s", borderline: "200–240 cm/s", abnormal: ">200 cm/s (≥70% stenosis)" },
      { param: "Celiac axis waveform", normal: "Low-resistance (continuous forward diastole)", borderline: "—", abnormal: "High-resistance or absent diastolic flow" },
    ],
  },
  {
    category: "Mesenteric Ischemia Criteria (SVU Guidelines)",
    values: [
      { param: "SMA stenosis ≥70%", normal: "PSV <275 cm/s, EDV <45 cm/s", borderline: "—", abnormal: "PSV >275 cm/s OR EDV >45 cm/s" },
      { param: "CA stenosis ≥70%", normal: "PSV <200 cm/s", borderline: "—", abnormal: "PSV >200 cm/s" },
      { param: "SMA occlusion", normal: "—", borderline: "—", abnormal: "No detectable flow on color/spectral Doppler" },
    ],
  },
];

const mesentericExamTips = [
  { category: "Preparation", text: "Patient must fast for a minimum of 6–8 hours before the exam. Bowel gas is the primary limitation for mesenteric duplex; fasting reduces intraluminal gas significantly. Avoid carbonated beverages and chewing gum on the day of the exam." },
  { category: "Positioning", text: "Begin supine. Use a right lateral decubitus position if bowel gas obscures the SMA origin. Gentle transducer pressure and asking the patient to hold a deep breath in inspiration can displace bowel gas." },
  { category: "Doppler Optimization", text: "Set PRF to 100–150 cm/s for mesenteric arteries. Use a Doppler angle of 45–60° at the vessel origin. Increase depth and reduce focal zones to improve penetration for the celiac axis." },
  { category: "Pearl", text: "The 'seagull sign' in transverse view identifies the celiac trifurcation — the celiac axis body and its two main branches (splenic and common hepatic) form the shape of a seagull in flight. This is the most reliable landmark for the celiac axis." },
  { category: "Pitfall", text: "Median arcuate ligament syndrome (MALS) can cause a false-positive celiac stenosis on expiration. Always obtain celiac axis velocities in both inspiration and expiration; a PSV that normalizes on inspiration suggests MALS rather than atherosclerotic stenosis." },
  { category: "Post-Prandial Protocol", text: "For post-prandial assessment, have the patient eat a standardized meal (e.g., 400–600 kcal liquid meal) and rescan the SMA at 30–45 minutes. Normal response: PSV increases and waveform becomes low-resistance (diastolic flow increases significantly)." },
];

// ── TIPS (TRANSJUGULAR INTRAHEPATIC PORTOSYSTEMIC SHUNT) ─────────────────────

const tipsNormalValues = [
  {
    category: "TIPS Velocity (SVU / AIUM Guidelines)",
    values: [
      { param: "Main TIPS velocity (PSV)", normal: "90–190 cm/s", borderline: "50–90 cm/s or 190–220 cm/s", abnormal: "<50 cm/s or >220 cm/s (dysfunction)" },
      { param: "Hepatic vein at TIPS outflow", normal: "Continuous forward flow", borderline: "Reduced phasicity", abnormal: "Absent or reversed flow (obstruction)" },
      { param: "Portal vein flow direction", normal: "Hepatopetal or hepatofugal (post-TIPS)", borderline: "—", abnormal: "Absent flow (thrombosis)" },
      { param: "Main portal vein PSV", normal: "≥30 cm/s (post-TIPS)", borderline: "20–30 cm/s", abnormal: "<20 cm/s (shunt dysfunction)" },
    ],
  },
  {
    category: "TIPS Dysfunction Criteria",
    values: [
      { param: "TIPS PSV decrease from baseline", normal: "<50 cm/s change", borderline: "50–75 cm/s decrease", abnormal: ">50 cm/s decrease from prior exam" },
      { param: "TIPS PSV increase from baseline", normal: "<50 cm/s change", borderline: "—", abnormal: ">50 cm/s increase (focal stenosis)" },
      { param: "Velocity gradient within TIPS", normal: "Uniform", borderline: "Mild variation", abnormal: "Focal velocity step-up >2× (stenosis site)" },
    ],
  },
  {
    category: "Portal Hypertension Response",
    values: [
      { param: "Portosystemic pressure gradient (PPG)", normal: "<12 mmHg (post-TIPS target)", borderline: "12–15 mmHg", abnormal: ">15 mmHg (inadequate decompression)" },
      { param: "Ascites response", normal: "Resolved within 4–6 weeks", borderline: "Partial resolution", abnormal: "No change (shunt dysfunction)" },
    ],
  },
];

const tipsExamTips = [
  { category: "Preparation", text: "No specific fasting required for TIPS surveillance. Obtain the patient's post-procedure baseline study (typically performed within 24–48 hours of TIPS placement) for comparison. Always compare to the most recent prior study, as velocity trends are more clinically meaningful than single absolute values." },
  { category: "Positioning", text: "Begin supine. A right intercostal approach provides the best window to the TIPS stent, which courses from the right hepatic vein to the right portal vein. Deep inspiration moves the liver inferiorly and improves intercostal access." },
  { category: "Doppler Optimization", text: "Set PRF to 100–200 cm/s for the TIPS stent. Use color Doppler to identify the stent and confirm flow direction. Sample the stent at the hepatic vein end, mid-stent, and portal vein end. Maintain Doppler angle ≤60°." },
  { category: "Pearl", text: "TIPS dysfunction is best detected by velocity trends rather than single absolute values. A decrease of >50 cm/s from the patient's own baseline, or a focal velocity step-up of >2× within the stent, is more reliable than comparing to population reference ranges." },
  { category: "Pitfall", text: "Hepatic encephalopathy can worsen after TIPS placement due to increased portosystemic shunting. If the TIPS appears patent and velocities are normal but the patient has worsening encephalopathy, this is a clinical (not sonographic) complication and does not indicate shunt dysfunction." },
  { category: "Pitfall", text: "TIPS stents are echogenic and may cause acoustic shadowing that obscures the lumen. Always use color Doppler to confirm intrastent flow, and obtain spectral waveforms from both ends and the mid-stent to identify focal stenosis." },
];

// ── RENAL ARTERY DUPLEX ───────────────────────────────────────────────────────

const renalNormalValues = [
  {
    category: "Renal Artery Stenosis (SVU Guidelines)",
    values: [
      { param: "Renal artery PSV", normal: "<180 cm/s", borderline: "180–200 cm/s", abnormal: ">200 cm/s (≥60% stenosis)" },
      { param: "Renal-aortic ratio (RAR)", normal: "<3.5", borderline: "3.5–3.9", abnormal: "≥3.5 (≥60% stenosis)" },
      { param: "Intrarenal RI", normal: "0.60–0.70", borderline: "0.70–0.80", abnormal: ">0.80 (intrinsic renal disease)" },
      { param: "Acceleration time (AT)", normal: "<70 ms", borderline: "70–80 ms", abnormal: ">80 ms (proximal stenosis — parvus et tardus)" },
    ],
  },
  {
    category: "Kidney Size",
    values: [
      { param: "Renal length (adult)", normal: "9–12 cm", borderline: "8–9 cm", abnormal: "<8 cm (atrophy) or >13 cm" },
      { param: "Cortical thickness", normal: "≥1.0 cm", borderline: "0.7–1.0 cm", abnormal: "<0.7 cm (cortical thinning)" },
      { param: "Side-to-side length difference", normal: "<1.5 cm", borderline: "1.5–2.0 cm", abnormal: ">2.0 cm (significant asymmetry)" },
    ],
  },
];

const renalExamTips = [
  { category: "Preparation", text: "Patient should fast 6–8 hours to reduce bowel gas, which is the primary technical challenge for renal artery duplex. Hydration is important — dehydration reduces renal artery flow velocity." },
  { category: "Positioning", text: "Begin supine for the aorta and left renal artery. Use right posterior oblique (RPO) for the right renal artery (probe in the right flank, angled medially). Use left posterior oblique (LPO) for the left renal artery. A prone approach can be used as an alternative for both sides." },
  { category: "Doppler Optimization", text: "Set PRF to 100–150 cm/s for renal arteries. Use a low wall filter (50–100 Hz). Maintain Doppler angle ≤60°. For intrarenal arteries, reduce PRF to 20–40 cm/s and use a small sample volume (2–3 mm)." },
  { category: "Pearl", text: "When the main renal artery cannot be directly visualized, the intrarenal 'parvus et tardus' waveform (AT >80 ms, slow-rising rounded systolic peak) is a reliable indirect sign of significant proximal stenosis. Always obtain intrarenal waveforms from all three poles." },
  { category: "Pitfall", text: "Accessory renal arteries are present in up to 30% of patients and are a common cause of missed renal artery stenosis. Scan the entire aorta from the celiac axis to the iliac bifurcation with color Doppler to identify all renal artery origins." },
  { category: "Pitfall", text: "A high aortic PSV (>100 cm/s) due to aortic stenosis or high cardiac output will falsely lower the RAR. Always document the aortic PSV used for RAR calculation." },
];

// ── COMPONENT ─────────────────────────────────────────────────────────────────
type ExamTab = "liver" | "tips" | "mesenteric" | "renal";

export default function AbdominalVascularNavigator() {
  const [examTab, setExamTab] = useState<ExamTab>("liver");
  const [infoTab, setInfoTab] = useState<"protocol" | "reference" | "tips">("protocol");
  const [expandedView, setExpandedView] = useState<number | null>(0);
  const [checked, setChecked] = useState<Record<ExamTab, Set<string>>>({
    liver: new Set(), tips: new Set(), mesenteric: new Set(), renal: new Set(),
  });
  const [expandedRef, setExpandedRef] = useState<number | null>(0);

  const { sections: allAbVascSections } = useNavigatorSections("abdominal_vascular");
  const views = allAbVascSections.filter(s => s.sectionName.startsWith(examTab + ":")).map(s => ({
    ...s,
    view: s.sectionName.replace(examTab + ":", ""),
    sectionName: s.sectionName.replace(examTab + ":", ""),
  }));
  const normalValues = examTab === "liver" ? liverNormalValues : examTab === "tips" ? tipsNormalValues : examTab === "mesenteric" ? mesentericNormalValues : renalNormalValues;
  const examTips = examTab === "liver" ? liverExamTips : examTab === "tips" ? tipsExamTips : examTab === "mesenteric" ? mesentericExamTips : renalExamTips;
  const currentChecked = checked[examTab];

  const totalItems = views.reduce((sum, v) => sum + v.items.length, 0);
  const criticalItems = views.reduce((sum, v) => sum + v.items.filter(i => i.critical).length, 0);
  const checkedCritical = views.reduce((sum, v) => sum + v.items.filter(i => i.critical && currentChecked.has(i.id)).length, 0);

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev[examTab]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [examTab]: next };
    });
  };

  const resetChecklist = () => setChecked(prev => ({ ...prev, [examTab]: new Set() }));

  const EXAM_TABS: { key: ExamTab; label: string; short: string }[] = [
    { key: "liver", label: "Liver Duplex", short: "Liver" },
    { key: "tips", label: "TIPS Surveillance", short: "TIPS" },
    { key: "mesenteric", label: "Mesenteric Duplex", short: "Mesenteric" },
    { key: "renal", label: "Renal Artery Duplex", short: "Renal" },
  ];

  const scanCoachPath = examTab === "liver" ? "/abdominal-vascular-scan-coach?tab=liver"
    : examTab === "tips" ? "/abdominal-vascular-scan-coach?tab=tips"
    : examTab === "mesenteric" ? "/abdominal-vascular-scan-coach?tab=mesenteric"
    : "/abdominal-vascular-scan-coach?tab=renal";

  return (
    <Layout>
      {/* Header */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="container py-8 md:py-10">
          <div className="mb-3"><BackToEchoAssist /></div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Scan className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">Abdominal Vascular · Protocol Navigator</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Abdominal Vascular Ultrasound Navigator
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Liver Duplex · TIPS Surveillance · Mesenteric Duplex · Renal Artery Duplex</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                Comprehensive vascular protocol checklist covering the mesenteric, renal, and portal systems. Aligned with current AIUM and SVU guidelines to support systematic Doppler interrogation and accurate stenosis grading.
              </p>
              <div className="mt-3">
                <Link href={scanCoachPath}>
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90" style={{ background: "#189aa1" }}>
                    <Scan className="w-3.5 h-3.5" />
                    Open ScanCoach™
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exam Type Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="container">
          <div className="flex gap-0">
            {EXAM_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setExamTab(t.key); setExpandedView(0); setInfoTab("protocol"); }}
                className="px-5 py-3.5 text-sm font-semibold border-b-2 transition-all"
                style={{
                  borderBottomColor: examTab === t.key ? "#189aa1" : "transparent",
                  color: examTab === t.key ? "#189aa1" : "#6b7280",
                }}
              >
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ProtocolProgressBar
        checked={currentChecked.size}
        total={totalItems}
        onReset={resetChecklist}
        checkedCritical={checkedCritical}
        totalCritical={criticalItems}
      />

      <div className="container py-6">
        {/* Info Tabs */}
        <div className="flex gap-2 mb-5">
          {(["protocol", "reference", "tips"] as const).map(t => (
            <button
              key={t}
              onClick={() => setInfoTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: infoTab === t ? "#189aa1" : "white",
                color: infoTab === t ? "white" : "#189aa1",
                border: `1px solid ${infoTab === t ? "#189aa1" : "#189aa140"}`,
              }}
            >
              {t === "protocol" ? "Protocol Checklist" : t === "reference" ? "Reference Values" : "Exam Tips"}
            </button>
          ))}
        </div>

        {/* Protocol Checklist */}
        {infoTab === "protocol" && (
          <div className="space-y-3">
            {views.map((section, si) => {
              const isExpanded = expandedView === si;
              const sectionChecked = section.items.filter(i => currentChecked.has(i.id)).length;
              return (
                <div key={si} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0fbfc] transition-all"
                    onClick={() => setExpandedView(isExpanded ? null : si)}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ background: sectionChecked === section.items.length ? "#22c55e" : "#189aa1" }}>
                      {sectionChecked === section.items.length ? <CheckCircle2 className="w-4 h-4" /> : si + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{section.view}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{section.probe}</div>
                    </div>
                    <div className="text-xs text-gray-400 mr-2">{sectionChecked}/{section.items.length}</div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {section.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-[#f0fbfc] transition-all ${currentChecked.has(item.id) ? "bg-green-50/50" : ""}`}
                          onClick={() => toggleCheck(item.id)}
                        >
                          {currentChecked.has(item.id)
                            ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            : <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${item.critical ? "text-amber-400" : "text-gray-300"}`} />
                          }
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${currentChecked.has(item.id) ? "text-gray-400 line-through" : "text-gray-700"}`}>
                              {item.label}
                              {item.critical && !currentChecked.has(item.id) && (
                                <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Critical</span>
                              )}
                            </div>
                            {item.detail && <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.detail}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reference Values */}
        {infoTab === "reference" && (
          <div className="space-y-3">
            {normalValues.map((cat, ci) => (
              <div key={ci} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
                  onClick={() => setExpandedRef(expandedRef === ci ? null : ci)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ background: "#189aa1" }}>
                    {ci + 1}
                  </div>
                  <div className="flex-1 text-left font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{cat.category}</div>
                  {expandedRef === ci ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedRef === ci && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left font-semibold text-gray-600">Parameter</th>
                          <th className="px-4 py-2 text-left font-semibold text-green-700">Normal</th>
                          <th className="px-4 py-2 text-left font-semibold text-amber-700">Borderline</th>
                          <th className="px-4 py-2 text-left font-semibold text-red-700">Abnormal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.values.map((v, vi) => (
                          <tr key={vi} className="border-t border-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-700">{v.param}</td>
                            <td className="px-4 py-2.5 text-green-700">{v.normal}</td>
                            <td className="px-4 py-2.5 text-amber-700">{v.borderline}</td>
                            <td className="px-4 py-2.5 text-red-700">{v.abnormal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Exam Tips */}
        {infoTab === "tips" && (
          <div className="space-y-3">
            {examTips.map((tip, ti) => {
              const color = tip.category === "Pitfall" ? "#d97706" : tip.category === "Pearl" ? "#059669" : "#189aa1";
              return (
                <div key={ti} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color }}>{tip.category}</div>
                      <div className="text-sm text-gray-700 leading-relaxed">{tip.text}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
