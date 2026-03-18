/*
  UltrasoundAssist™ — Peripheral Venous Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of Peripheral Venous Ultrasound Examinations (2020)
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
    view: "Common Femoral Vein (CFV)",
    probe: "Transverse, inguinal ligament",
    tips: [
      { category: "Patient Positioning", text: "The patient is typically positioned in a reverse Trendelenburg position to facilitate venous filling in the lower extremities. The examination should " },
      { category: "Transducer Positioning", text: "Transverse, inguinal ligament" },
      { category: "What to Assess", text: "Compressibility, spectral Doppler waveform for symmetry and respiratory phasicity" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Comprehensive Evaluation\', \'tip_content\': \'The evaluation should extend from the ingu" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Systematic Compression\', \'tip_content\': \'Apply venous compression every 2 cm or less " }
    ],
  },
  {
    view: "Femoral Vein (FV)",
    probe: "Transverse, from CFV down the thigh",
    tips: [
      { category: "Patient Positioning", text: "The patient is typically positioned in a reverse Trendelenburg position to facilitate venous filling in the lower extremities. The examination should " },
      { category: "Transducer Positioning", text: "Transverse, from CFV down the thigh" },
      { category: "What to Assess", text: "Compressibility every 2 cm" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Comprehensive Evaluation\', \'tip_content\': \'The evaluation should extend from the ingu" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Systematic Compression\', \'tip_content\': \'Apply venous compression every 2 cm or less " }
    ],
  },
  {
    view: "Deep Femoral Vein (DFV)",
    probe: "Transverse, at the confluence with the FV",
    tips: [
      { category: "Patient Positioning", text: "The patient is typically positioned in a reverse Trendelenburg position to facilitate venous filling in the lower extremities. The examination should " },
      { category: "Transducer Positioning", text: "Transverse, at the confluence with the FV" },
      { category: "What to Assess", text: "Compressibility" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Comprehensive Evaluation\', \'tip_content\': \'The evaluation should extend from the ingu" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Systematic Compression\', \'tip_content\': \'Apply venous compression every 2 cm or less " }
    ],
  },
  {
    view: "Great Saphenous Vein (GSV)",
    probe: "Transverse, at the saphenofemoral junction",
    tips: [
      { category: "Patient Positioning", text: "The patient is typically positioned in a reverse Trendelenburg position to facilitate venous filling in the lower extremities. The examination should " },
      { category: "Transducer Positioning", text: "Transverse, at the saphenofemoral junction" },
      { category: "What to Assess", text: "Compressibility" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Comprehensive Evaluation\', \'tip_content\': \'The evaluation should extend from the ingu" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Systematic Compression\', \'tip_content\': \'Apply venous compression every 2 cm or less " }
    ],
  },
  {
    view: "Popliteal Vein",
    probe: "Transverse, popliteal fossa",
    tips: [
      { category: "Patient Positioning", text: "The patient is typically positioned in a reverse Trendelenburg position to facilitate venous filling in the lower extremities. The examination should " },
      { category: "Transducer Positioning", text: "Transverse, popliteal fossa" },
      { category: "What to Assess", text: "Compressibility, spectral Doppler waveform" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Comprehensive Evaluation\', \'tip_content\': \'The evaluation should extend from the ingu" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Systematic Compression\', \'tip_content\': \'Apply venous compression every 2 cm or less " }
    ],
  },
  {
    view: "Posterior Tibial Veins (PTV)",
    probe: "Transverse, from popliteal fossa to ankle",
    tips: [
      { category: "Patient Positioning", text: "The patient is typically positioned in a reverse Trendelenburg position to facilitate venous filling in the lower extremities. The examination should " },
      { category: "Transducer Positioning", text: "Transverse, from popliteal fossa to ankle" },
      { category: "What to Assess", text: "Compressibility" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Comprehensive Evaluation\', \'tip_content\': \'The evaluation should extend from the ingu" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Systematic Compression\', \'tip_content\': \'Apply venous compression every 2 cm or less " }
    ],
  },
  {
    view: "Peroneal Veins",
    probe: "Transverse, from popliteal fossa to ankle",
    tips: [
      { category: "Patient Positioning", text: "The patient is typically positioned in a reverse Trendelenburg position to facilitate venous filling in the lower extremities. The examination should " },
      { category: "Transducer Positioning", text: "Transverse, from popliteal fossa to ankle" },
      { category: "What to Assess", text: "Compressibility" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Comprehensive Evaluation\', \'tip_content\': \'The evaluation should extend from the ingu" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Systematic Compression\', \'tip_content\': \'Apply venous compression every 2 cm or less " }
    ],
  },
  {
    view: "Gastrocnemius and Soleal Veins",
    probe: "Transverse, calf",
    tips: [
      { category: "Patient Positioning", text: "The patient is typically positioned in a reverse Trendelenburg position to facilitate venous filling in the lower extremities. The examination should " },
      { category: "Transducer Positioning", text: "Transverse, calf" },
      { category: "What to Assess", text: "Compressibility, especially if focal symptoms are present" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Comprehensive Evaluation\', \'tip_content\': \'The evaluation should extend from the ingu" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Systematic Compression\', \'tip_content\': \'Apply venous compression every 2 cm or less " }
    ],
  }
];

const generalTips = [
  { category: "Scanning Tip", text: "{\'tip_title\': \'Comprehensive Evaluation\', \'tip_content\': \'The evaluation should extend from the inguinal ligament to the ankle whenever feasible to av" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Systematic Compression\', \'tip_content\': \'Apply venous compression every 2 cm or less in the transverse plane to ensure no segment of th" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Focal Symptom Evaluation\', \'tip_content\': \'If the patient presents with focal symptoms, such as tenderness in the calf, a targeted eval" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Doppler Waveform Symmetry\', \'tip_content\': \'Always compare the spectral Doppler waveforms of the common femoral veins on both sides to " },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Optimal Doppler Technique\', \'tip_content\': \'Obtain all spectral Doppler waveforms from the long axis of the vessel for the most accurat" }
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

export default function VenousScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showGeneral, setShowGeneral] = useState(false);

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
                <span className="text-sm text-white/80 font-medium">Venous · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Peripheral Venous Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-xs mt-1 max-w-xl">
                Probe: High-frequency linear transducer (5-12 MHz) is standard for peripheral venous imaging, though not ex
              </p>
              <div className="mt-3">
                <Link href="/venous-navigator">
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
            onClick={() => setShowGeneral(!showGeneral)}
          >
            <Lightbulb className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
            <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
              General Scanning Tips
            </span>
            {showGeneral ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showGeneral && (
            <div className="border-t border-gray-100 p-5 space-y-3">
              {generalTips.map((tip, ti) => (
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
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Peripheral Venous Ultrasound Examinations (2020)</a>
        </div>
      </div>
    </Layout>
  );
}
