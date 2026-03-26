/*
  UltrasoundAssist™ — Vascular Abdominal Aorta/EndoLeak (Abdominal Aorta 2025) ScanCoach
  Based on: AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdominal Aorta (2025)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, ExternalLink } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { usePremium } from "@/hooks/usePremium";

const views = [
  {
    view: "Proximal Aorta - Long",
    probe: "Subxiphoid, sagittal plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve " },
      { category: "Transducer Positioning", text: "Subxiphoid, sagittal plane" },
      { category: "What to Assess", text: "Visualize the aorta as it passes through the diaphragm. Assess for plaque, thrombus, or dissection." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Aortic Visualization\', \'tip_content\': \'Use graded compression with the tra" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Accurate Aortic Measurements\', \'tip_content\': \'Ensure measurements are taken perpendi" }
    ],
  },
  {
    view: "Proximal Aorta - Trans",
    probe: "Subxiphoid, transverse plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve " },
      { category: "Transducer Positioning", text: "Subxiphoid, transverse plane" },
      { category: "What to Assess", text: "Visualize the celiac and superior mesenteric arteries. Assess for plaque, thrombus, or dissection." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Aortic Visualization\', \'tip_content\': \'Use graded compression with the tra" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Accurate Aortic Measurements\', \'tip_content\': \'Ensure measurements are taken perpendi" }
    ],
  },
  {
    view: "Mid Aorta - Long",
    probe: "Mid-abdomen, sagittal plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve " },
      { category: "Transducer Positioning", text: "Mid-abdomen, sagittal plane" },
      { category: "What to Assess", text: "Visualize the aorta at the level of the renal arteries. Assess for plaque, thrombus, or dissection." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Aortic Visualization\', \'tip_content\': \'Use graded compression with the tra" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Accurate Aortic Measurements\', \'tip_content\': \'Ensure measurements are taken perpendi" }
    ],
  },
  {
    view: "Mid Aorta - Trans",
    probe: "Mid-abdomen, transverse plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve " },
      { category: "Transducer Positioning", text: "Mid-abdomen, transverse plane" },
      { category: "What to Assess", text: "Visualize the renal arteries branching off the aorta. Assess for plaque, thrombus, or dissection." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Aortic Visualization\', \'tip_content\': \'Use graded compression with the tra" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Accurate Aortic Measurements\', \'tip_content\': \'Ensure measurements are taken perpendi" }
    ],
  },
  {
    view: "Distal Aorta - Long",
    probe: "Lower abdomen, sagittal plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve " },
      { category: "Transducer Positioning", text: "Lower abdomen, sagittal plane" },
      { category: "What to Assess", text: "Visualize the aorta to the bifurcation. Assess for plaque, thrombus, or dissection." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Aortic Visualization\', \'tip_content\': \'Use graded compression with the tra" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Accurate Aortic Measurements\', \'tip_content\': \'Ensure measurements are taken perpendi" }
    ],
  },
  {
    view: "Distal Aorta - Trans",
    probe: "Lower abdomen, transverse plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve " },
      { category: "Transducer Positioning", text: "Lower abdomen, transverse plane" },
      { category: "What to Assess", text: "Visualize the aortic bifurcation into the common iliac arteries. Assess for plaque, thrombus, or dissection." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Aortic Visualization\', \'tip_content\': \'Use graded compression with the tra" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Accurate Aortic Measurements\', \'tip_content\': \'Ensure measurements are taken perpendi" }
    ],
  },
  {
    view: "Common Iliac Arteries - Long",
    probe: "Just inferior to the aortic bifurcation, sagittal oblique plane for each iliac artery",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve " },
      { category: "Transducer Positioning", text: "Just inferior to the aortic bifurcation, sagittal oblique plane for each iliac artery" },
      { category: "What to Assess", text: "Visualize the proximal common iliac arteries. Assess for aneurysmal dilation." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Aortic Visualization\', \'tip_content\': \'Use graded compression with the tra" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Accurate Aortic Measurements\', \'tip_content\': \'Ensure measurements are taken perpendi" }
    ],
  },
  {
    view: "Common Iliac Arteries - Trans",
    probe: "Just inferior to the aortic bifurcation, transverse plane",
    tips: [
      { category: "Patient Positioning", text: "The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve " },
      { category: "Transducer Positioning", text: "Just inferior to the aortic bifurcation, transverse plane" },
      { category: "What to Assess", text: "Visualize the proximal common iliac arteries. Assess for aneurysmal dilation." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Aortic Visualization\', \'tip_content\': \'Use graded compression with the tra" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Accurate Aortic Measurements\', \'tip_content\': \'Ensure measurements are taken perpendi" }
    ],
  }
];

const examTips = [
  { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Aortic Visualization\', \'tip_content\': \'Use graded compression with the transducer to displace overlying bowel gas. Having th" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Accurate Aortic Measurements\', \'tip_content\': \'Ensure measurements are taken perpendicular to the long axis of the aorta and from outer" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Identifying the Renal Arteries\', \'tip_content\': \'The left renal vein can be seen crossing anterior to the aorta in the transverse view," },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Endoleak Detection\', \'tip_content\': \'Use a low-flow color Doppler scale and power Doppler to increase sensitivity for detecting endolea" }
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

  const currentView = views[selectedView];

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
                Vascular Abdominal Aorta/EndoLeak (Abdominal Aorta 2025) ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-xs mt-1 max-w-xl">
                Probe: Curvilinear 2-5 MHz
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

            {/* Image placeholder */}
            <div
              className="mx-5 mt-4 rounded-xl flex items-center justify-center"
              style={{ height: 180, background: "linear-gradient(135deg, #0e1e2e20, #189aa120)", border: "2px dashed #189aa140" }}
            >
              <div className="text-center">
                <Scan className="w-8 h-8 text-[#189aa1] mx-auto mb-2 opacity-50" />
                <p className="text-xs text-gray-400">Reference image placeholder</p>
                <p className="text-xs text-gray-300">Add via Admin → ScanCoach Editor</p>
              </div>
            </div>

            {/* Tips */}
            <div className="p-5 space-y-3">
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

        {/* Reference */}
        <div className="text-xs text-gray-400 px-1 mt-4">
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdominal Aorta (2025)</a>
        </div>
      </div>
    </Layout>
  );
}
