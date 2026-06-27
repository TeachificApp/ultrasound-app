/*
  UltrasoundAssist™ — Vascular Abdominal Aorta/EndoLeak (Abdominal Aorta 2025) ScanCoach
  Based on: AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdominal Aorta (2025)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Receipt} from "lucide-react";
import { PremiumPearlGate } from "@/components/PremiumPearlGate";
import { usePremium } from "@/hooks/usePremium";
import { aortaBilling } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { ScanCoachViewMediaPanel } from "@/components/ScanCoachViewMediaPanel";

const AORTA_SCANNING_TIPS = [
  { category: "Scanning Tip", text: "Optimizing Aortic Visualization: Use graded compression with the transducer to displace overlying bowel gas. Having the patient fast for 4–6 hours before the exam significantly reduces bowel gas. A left lateral decubitus position can help shift gas away from the midline." },
  { category: "Scanning Tip", text: "Accurate Aortic Measurements: Ensure measurements are taken perpendicular to the long axis of the aorta and from outer wall to outer wall in both longitudinal and transverse planes. Oblique measurements overestimate diameter. Always document the largest diameter obtained." },
];

export const views = [
  {
    id: "prox_long",
    view: "Proximal Aorta - Long",
    probe: "Subxiphoid, sagittal plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization by displacing overlying bowel gas away from the midline." },
      { category: "Transducer Positioning", text: "Subxiphoid, sagittal plane — angle superiorly to visualize the aorta as it passes through the diaphragmatic hiatus. The proximal aorta is identified just below the xiphoid process." },
      { category: "What to Assess", text: "Visualize the aorta as it passes through the diaphragm. Assess for plaque, thrombus, or dissection. Note the relationship to the celiac axis origin." },
      ...AORTA_SCANNING_TIPS,
    ],
  },
  {
    id: "prox_trans",
    view: "Proximal Aorta - Trans",
    probe: "Subxiphoid, transverse plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization." },
      { category: "Transducer Positioning", text: "Subxiphoid, transverse plane — sweep inferiorly from the diaphragm to identify the celiac axis and superior mesenteric artery origins. The aorta appears as a round pulsatile structure anterior to the spine." },
      { category: "What to Assess", text: "Visualize the celiac and superior mesenteric arteries. Assess for plaque, thrombus, or dissection. Measure the anteroposterior and transverse diameters." },
      ...AORTA_SCANNING_TIPS,
    ],
  },
  {
    id: "mid_long",
    view: "Mid Aorta - Long",
    probe: "Mid-abdomen, sagittal plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization." },
      { category: "Transducer Positioning", text: "Mid-abdomen, sagittal plane — at the level of the umbilicus. The renal arteries arise from the lateral walls of the aorta at approximately L1–L2." },
      { category: "What to Assess", text: "Visualize the aorta at the level of the renal arteries. Assess for plaque, thrombus, or dissection. This is the most common level for AAA formation." },
      ...AORTA_SCANNING_TIPS,
    ],
  },
  {
    id: "mid_trans",
    view: "Mid Aorta - Trans",
    probe: "Mid-abdomen, transverse plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization." },
      { category: "Transducer Positioning", text: "Mid-abdomen, transverse plane — rotate 90° from the sagittal view. The left renal vein is a useful landmark, crossing anterior to the aorta at the level of the renal arteries." },
      { category: "What to Assess", text: "Visualize the renal arteries branching off the aorta. Assess for plaque, thrombus, or dissection. Measure the maximum transverse diameter." },
      ...AORTA_SCANNING_TIPS,
    ],
  },
  {
    id: "dist_long",
    view: "Distal Aorta - Long",
    probe: "Lower abdomen, sagittal plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization." },
      { category: "Transducer Positioning", text: "Lower abdomen, sagittal plane — trace the aorta inferiorly from the mid-abdomen to the bifurcation. The bifurcation typically occurs at the L4 level, just below the umbilicus." },
      { category: "What to Assess", text: "Visualize the aorta to the bifurcation. Assess for plaque, thrombus, or dissection. The distal aorta is a common site for AAA extension." },
      ...AORTA_SCANNING_TIPS,
    ],
  },
  {
    id: "dist_trans",
    view: "Distal Aorta - Trans",
    probe: "Lower abdomen, transverse plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization." },
      { category: "Transducer Positioning", text: "Lower abdomen, transverse plane — follow the aorta to where it divides into the two common iliac arteries. The bifurcation appears as a 'Y' shape in the transverse view." },
      { category: "What to Assess", text: "Visualize the aortic bifurcation into the common iliac arteries. Assess for plaque, thrombus, or dissection. Note any extension of AAA into the iliac arteries." },
      ...AORTA_SCANNING_TIPS,
    ],
  },
  {
    id: "iliac_long",
    view: "Common Iliac Arteries - Long",
    probe: "Just inferior to the aortic bifurcation, sagittal oblique plane for each iliac artery",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization." },
      { category: "Transducer Positioning", text: "Just inferior to the aortic bifurcation, sagittal oblique plane — angle obliquely to follow each common iliac artery laterally. Normal common iliac artery diameter is <1.5 cm." },
      { category: "What to Assess", text: "Visualize the proximal common iliac arteries. Assess for aneurysmal dilation (>1.5 cm is considered aneurysmal). Color Doppler confirms patency." },
      ...AORTA_SCANNING_TIPS,
    ],
  },
  {
    id: "iliac_trans",
    view: "Common Iliac Arteries - Trans",
    probe: "Just inferior to the aortic bifurcation, transverse plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization." },
      { category: "Transducer Positioning", text: "Just inferior to the aortic bifurcation, transverse plane — both common iliac arteries are visible simultaneously in transverse, flanking the common iliac veins." },
      { category: "What to Assess", text: "Visualize the proximal common iliac arteries. Assess for aneurysmal dilation. Measure the maximum diameter of each artery in the transverse plane." },
      ...AORTA_SCANNING_TIPS,
    ],
  },
];

const examTips = [
  { category: "Scanning Tip", text: "Optimizing Aortic Visualization: Use graded compression with the transducer to displace overlying bowel gas. Having the patient fast for 4–6 hours before the exam significantly reduces bowel gas. A left lateral decubitus position can help shift gas away from the midline." },
  { category: "Scanning Tip", text: "Accurate Aortic Measurements: Ensure measurements are taken perpendicular to the long axis of the aorta and from outer wall to outer wall in both longitudinal and transverse planes. Oblique measurements overestimate diameter. Always document the largest diameter obtained." },
  { category: "Scanning Tip", text: "Identifying the Renal Arteries: The left renal vein can be seen crossing anterior to the aorta in the transverse view, providing a reliable landmark for the renal artery origins. The renal arteries arise from the lateral walls of the aorta at approximately the same level." },
  { category: "Scanning Tip", text: "Endoleak Detection: Use a low-flow color Doppler scale and power Doppler to increase sensitivity for detecting endoleaks after EVAR. A persistent color signal within the aneurysm sac outside the stent graft indicates an endoleak requiring further evaluation." },
];

const TIP_COLORS: Record<string, string> = {
  "Patient Positioning": "#0e4a50",
  "Transducer Positioning": "#189aa1",
  "What to Assess": "#0e1e2e",
  "Doppler": "#4a6fa5",
  "Scanning Tip": "#189aa1",
  "Optimization": "#0e4a50",
  "Pitfall": "#d97706",
  "Pearl": "#059669",
};

export default function AortaScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showExamTips, setShowGeneral] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const { mergeView } = useScanCoachOverrides("aorta");
  const currentView = useMemo(() => {
    const v = views[selectedView];
    if (!v) return v;
    const merged = mergeView({ ...v, id: v.id });
    const rawTips = merged.tips as unknown;
    if (Array.isArray(rawTips) && rawTips.length > 0 && typeof rawTips[0] === "string") {
      return { ...merged, tips: (rawTips as string[]).map(t => ({ category: "Scanning Tip", text: t })) };
    }
    return merged;
  }, [selectedView, mergeView]);

  return (
    <Layout>
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-8 md:py-10">
          <div className="mb-3">
            <BackToEchoAssist />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Scan className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">Aorta/EndoLeak · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Vascular Abdominal Aorta/EndoLeak ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for aortic ultrasound, aligned with current AIUM guidelines. Guides complete aortic survey with image optimization tips, measurement technique, and normal appearance criteria for AAA screening and surveillance.
              </p>
              <div className="mt-3">
                <Link href="/aorta-navigator">
                  <button
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border border-white/30 text-white/90 hover:bg-white/10 transition-all"
                  >
                    <Info className="w-3.5 h-3.5" />
                    Open Navigator
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* View selector */}
        <div className="flex gap-2 flex-wrap mb-5">
          {views.map((v, i) => (
            <button
              key={i}
              onClick={() => setSelectedView(i)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: selectedView === i ? "#189aa1" : "white",
                color: selectedView === i ? "white" : "#189aa1",
                border: `1px solid ${selectedView === i ? "#189aa1" : "#189aa1" + "40"}`,
              }}
            >
              {v.view}
            </button>
          ))}
        </div>

        {/* Current view card */}
        {currentView && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
            <div
              className="px-5 py-4 border-b border-gray-100"
              style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 100%)" }}
            >
              <h2 className="text-lg font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                {currentView.view}
              </h2>
              <p className="text-[#4ad9e0] text-xs mt-0.5">{currentView.probe}</p>
            </div>

                        <ScanCoachViewMediaPanel
              viewId={currentView.id}
              view={currentView}
              showPlaceholder
            />

            {/* Tips */}
            <div className="p-5 space-y-3">
              <PremiumPearlGate featureName="Scan Coach Tips">
                {currentView.tips.map((tip, ti) => (
                  <div
                    key={ti}
                    className="rounded-xl p-4 border"
                    style={{
                      borderColor: (TIP_COLORS[tip.category] || "#189aa1") + "30",
                      background: (TIP_COLORS[tip.category] || "#189aa1") + "08",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TIP_COLORS[tip.category] || "#189aa1" }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TIP_COLORS[tip.category] || "#189aa1" }}>
                        {tip.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </PremiumPearlGate>
            </div>
          </div>
        )}

        {/* General tips section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <button
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
            onClick={() => setShowGeneral(!showExamTips)}
          >
            <Lightbulb className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
            <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
              Exam Tips
            </span>
            {showExamTips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showExamTips && (
            <div className="border-t border-gray-100 p-5 space-y-3">
              {examTips.map((tip, ti) => (
                <div key={ti} className="rounded-xl p-4 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#189aa1]">{tip.category}</span>
                  </div>
                  <p className="text-sm text-gray-700">{tip.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Billing Codes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <button
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
            onClick={() => setShowBilling(!showBilling)}
          >
            <Receipt className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
            <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>Billing Codes (CPT)</span>
            {showBilling ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showBilling && (
            <div className="border-t border-gray-100 p-5 space-y-5">
              <p className="text-xs text-gray-400 italic">For reference only — verify with current payer policies and local coverage determinations.</p>
              {aortaBilling.map((section, si) => (
                <div key={si}>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#189aa1] mb-2">{section.heading}</div>
                  <div className="space-y-2">
                    {section.codes.map((c, ci) => (
                      <div key={ci} className="rounded-lg border p-3" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-bold text-sm text-[#189aa1] flex-shrink-0">{c.code}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{c.description}</div>
                            {c.note && <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.note}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Reference */}
        <div className="text-xs text-gray-400 px-1 mt-4">
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdominal Aorta</a>
        </div>
      </div>
    </Layout>
  );
}
