/*
  UltrasoundAssist™ — Vascular Arterial Ultrasound Upper and Lower Extremity ScanCoach
  Based on: AIUM Practice Parameter for the Performance of Peripheral Arterial Ultrasound Examinations (2020)
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
    view: "Segmental Limb Pressures and Waveforms",
    probe: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, abov",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally a" },
      { category: "Transducer Positioning", text: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, above the wrist (upper extremity); Digits (toes and fi" },
      { category: "What to Assess", text: "Segmental or digital blood pressure readings, Ulnar Doppler waveforms, return of blood flow as cuff deflates" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Patient Preparation\', \'tip_content\': \'Perform examination in a warm room to minimize " },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Exercise Testing for Claudication\', \'tip_content\': \'For claudication assessment when " }
    ],
  },
  {
    view: "CW Doppler Waveforms",
    probe: "Common femoral, superficial femoral, popliteal, posterior tibial, dorsalis pedis (lower extremity); ",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally a" },
      { category: "Transducer Positioning", text: "Common femoral, superficial femoral, popliteal, posterior tibial, dorsalis pedis (lower extremity); Subclavian, axillary, brachial, radial, ulnar (upp" },
      { category: "What to Assess", text: "Arterial waveforms, audible and visual optimization, Doppler angle consistency" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Patient Preparation\', \'tip_content\': \'Perform examination in a warm room to minimize " },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Exercise Testing for Claudication\', \'tip_content\': \'For claudication assessment when " }
    ],
  },
  {
    view: "Pulse Volume Recordings (PVRs)",
    probe: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, abov",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally a" },
      { category: "Transducer Positioning", text: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, above the wrist (upper extremity); Toes and digits (us" },
      { category: "What to Assess", text: "Global tissue perfusion" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Patient Preparation\', \'tip_content\': \'Perform examination in a warm room to minimize " },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Exercise Testing for Claudication\', \'tip_content\': \'For claudication assessment when " }
    ],
  },
  {
    view: "Transcutaneous Oxygen Tension (tcPO2) Measurements",
    probe: "Foot, ankle, calf (lower extremities), with a reference point on the chest",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally a" },
      { category: "Transducer Positioning", text: "Foot, ankle, calf (lower extremities), with a reference point on the chest" },
      { category: "What to Assess", text: "Delivery of oxygen to the skin in an area of questionable viability" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Patient Preparation\', \'tip_content\': \'Perform examination in a warm room to minimize " },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Exercise Testing for Claudication\', \'tip_content\': \'For claudication assessment when " }
    ],
  },
  {
    view: "Photoplethysmography (PPG)",
    probe: "Digits",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally a" },
      { category: "Transducer Positioning", text: "Digits" },
      { category: "What to Assess", text: "Blood volume changes in a microvascular bed, perfusion of measured tissue bed, presence of atherosclerotic disease" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Patient Preparation\', \'tip_content\': \'Perform examination in a warm room to minimize " },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Exercise Testing for Claudication\', \'tip_content\': \'For claudication assessment when " }
    ],
  }
];

const examTips = [
  { category: "Scanning Tip", text: "{\'tip_title\': \'Patient Preparation\', \'tip_content\': \'Perform examination in a warm room to minimize peripheral vasoconstriction. Patient should be rec" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Exercise Testing for Claudication\', \'tip_content\': \'For claudication assessment when resting ABI is normal or higher than anticipated, " },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Non-Compressible Calcified Arteries\', \'tip_content\': \'For non-compressible calcified arteries, perform a toe-brachial index as distal s" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Doppler Waveform Optimization\', \'tip_content\': \'Audibly and visually optimize Doppler waveforms. Maintain a constant Doppler angle thro" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Segmental Pressure Measurements\', \'tip_content\': \'Use appropriately sized blood pressure cuffs. A rapid inflation device is helpful. Us" }
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

export default function ArterialScanCoach() {
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
                <span className="text-sm text-white/80 font-medium">Arterial · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Vascular Arterial Ultrasound Upper and Lower Extremity ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-xs mt-1 max-w-xl">
                Probe: CW Doppler instrument operating at 5–10 MHz; Appropriately sized blood pressure cuffs; Photoelectric
              </p>
              <div className="mt-3">
                <Link href="/arterial-navigator">
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
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Peripheral Arterial Ultrasound Examinations (2020)</a>
        </div>
      </div>
    </Layout>
  );
}
