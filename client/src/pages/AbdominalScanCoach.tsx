/*
  UltrasoundAssist™ — Abdominal Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdomen and/or Retroperitoneum (2021)
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
    view: "Pancreas",
    probe: "Transverse epigastric approach",
    tips: [
      { category: "Patient Positioning", text: "Primarily supine. Decubitus, erect, or prone positioning may be used to optimize visualization of specific organs like the gallbladder and kidneys." },
      { category: "Transducer Positioning", text: "Transverse epigastric approach" },
      { category: "What to Assess", text: "Head, uncinate process, body, and tail. Parenchymal echotexture, masses, calcifications, ductal dilatation. Peripancreatic region for adenopathy or collections." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Liver Visualization\', \'tip_content\': \'Use both subcostal and intercostal w" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Assessing the Gallbladder Wall\', \'tip_content\': \'Ensure the patient is appropriately " }
    ],
  },
  {
    view: "Aorta",
    probe: "Midline transverse and longitudinal approaches",
    tips: [
      { category: "Patient Positioning", text: "Primarily supine. Decubitus, erect, or prone positioning may be used to optimize visualization of specific organs like the gallbladder and kidneys." },
      { category: "Transducer Positioning", text: "Midline transverse and longitudinal approaches" },
      { category: "What to Assess", text: "Proximal, mid, and distal segments for aneurysm or other abnormalities." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Liver Visualization\', \'tip_content\': \'Use both subcostal and intercostal w" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Assessing the Gallbladder Wall\', \'tip_content\': \'Ensure the patient is appropriately " }
    ],
  },
  {
    view: "Inferior Vena Cava (IVC)",
    probe: "Subcostal and parasagittal approaches",
    tips: [
      { category: "Patient Positioning", text: "Primarily supine. Decubitus, erect, or prone positioning may be used to optimize visualization of specific organs like the gallbladder and kidneys." },
      { category: "Transducer Positioning", text: "Subcostal and parasagittal approaches" },
      { category: "What to Assess", text: "Patency, diameter, and respiratory variation. Presence of thrombus or filters." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Liver Visualization\', \'tip_content\': \'Use both subcostal and intercostal w" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Assessing the Gallbladder Wall\', \'tip_content\': \'Ensure the patient is appropriately " }
    ],
  },
  {
    view: "Liver",
    probe: "Subcostal and intercostal approaches",
    tips: [
      { category: "Patient Positioning", text: "Primarily supine. Decubitus, erect, or prone positioning may be used to optimize visualization of specific organs like the gallbladder and kidneys." },
      { category: "Transducer Positioning", text: "Subcostal and intercostal approaches" },
      { category: "What to Assess", text: "Long-axis and transverse views of all lobes (right, left, caudate). Parenchymal echogenicity (compared to right kidney), surface nodularity, focal/diffuse abnormalities. Major hepatic and perihepatic " },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Liver Visualization\', \'tip_content\': \'Use both subcostal and intercostal w" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Assessing the Gallbladder Wall\', \'tip_content\': \'Ensure the patient is appropriately " }
    ],
  },
  {
    view: "Gallbladder and Biliary Tract",
    probe: "Subcostal and intercostal approaches",
    tips: [
      { category: "Patient Positioning", text: "Primarily supine. Decubitus, erect, or prone positioning may be used to optimize visualization of specific organs like the gallbladder and kidneys." },
      { category: "Transducer Positioning", text: "Subcostal and intercostal approaches" },
      { category: "What to Assess", text: "Long-axis and transverse views of the gallbladder. Wall thickness, presence of gallstones, sludge, or polyps. Intrahepatic and extrahepatic bile ducts for dilatation or other abnormalities. Sonographi" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Liver Visualization\', \'tip_content\': \'Use both subcostal and intercostal w" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Assessing the Gallbladder Wall\', \'tip_content\': \'Ensure the patient is appropriately " }
    ],
  },
  {
    view: "Kidneys",
    probe: "Flank (coronal) and transverse approaches",
    tips: [
      { category: "Patient Positioning", text: "Primarily supine. Decubitus, erect, or prone positioning may be used to optimize visualization of specific organs like the gallbladder and kidneys." },
      { category: "Transducer Positioning", text: "Flank (coronal) and transverse approaches" },
      { category: "What to Assess", text: "Long-axis and transverse views of both kidneys. Cortical thickness, echogenicity (compared to liver/spleen), collecting system for hydronephrosis, calculi, masses. Perirenal spaces." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Liver Visualization\', \'tip_content\': \'Use both subcostal and intercostal w" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Assessing the Gallbladder Wall\', \'tip_content\': \'Ensure the patient is appropriately " }
    ],
  },
  {
    view: "Spleen",
    probe: "Left intercostal and coronal approaches",
    tips: [
      { category: "Patient Positioning", text: "Primarily supine. Decubitus, erect, or prone positioning may be used to optimize visualization of specific organs like the gallbladder and kidneys." },
      { category: "Transducer Positioning", text: "Left intercostal and coronal approaches" },
      { category: "What to Assess", text: "Long-axis and transverse views. Parenchymal echogenicity (compared to left kidney), focal lesions. Splenic hilum and vasculature. Left hemidiaphragm and adjacent pleural space." },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Liver Visualization\', \'tip_content\': \'Use both subcostal and intercostal w" },
      { category: "Scanning Tip", text: "{\'tip_title\': \'Assessing the Gallbladder Wall\', \'tip_content\': \'Ensure the patient is appropriately " }
    ],
  },
];

const generalTips = [
  { category: "Scanning Tip", text: "{\'tip_title\': \'Optimizing Liver Visualization\', \'tip_content\': \'Use both subcostal and intercostal windows to visualize all segments of the liver. Hav" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Assessing the Gallbladder Wall\', \'tip_content\': \'Ensure the patient is appropriately fasted (at least 4 hours for adults) to achieve ad" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Visualizing the Pancreas\', \'tip_content\': \'Use the splenic vein as a landmark to identify the pancreas. Having the patient drink water " },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Evaluating the Kidneys\', \'tip_content\': \'Compare the echogenicity of the right kidney to the liver and the left kidney to the spleen. T" },
  { category: "Scanning Tip", text: "{\'tip_title\': \'Detecting Ureteral Jets\', \'tip_content\': \'Use color Doppler at the trigone of the bladder to visualize ureteral jets. A lack of jets ca" }
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

export default function AbdominalScanCoach() {
  const { isPremium } = usePremium();
  const [selectedView, setSelectedView] = useState(0);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [showGeneral, setShowGeneral] = useState(false);
  const [showSWE, setShowSWE] = useState(false);

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
                <span className="text-sm text-white/80 font-medium">Abdominal · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Abdominal Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-xs mt-1 max-w-xl">
                Probe: Curvilinear 2-5 MHz, High-frequency linear for specific applications (e.g., liver surface, bowel wal
              </p>
              <div className="mt-3">
                <Link href="/abdominal-navigator">
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

        {/* SWE / UDFF Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <button
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
            onClick={() => setShowSWE(!showSWE)}
          >
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: "#189aa1" }}>
              <span className="text-white text-[9px] font-black">SWE</span>
            </div>
            <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>
              SWE / UDFF Technique Guide
            </span>
            {showSWE ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showSWE && (
            <div className="border-t border-gray-100 p-5 space-y-4">
              {/* SWE Technique */}
              <div>
                <p className="text-xs font-bold text-[#189aa1] uppercase tracking-wider mb-3">Shear Wave Elastography (pSWE / 2D-SWE)</p>
                <div className="space-y-3">
                  {[
                    { cat: "Patient Preparation", text: "Fast patient ≥2 hours. Supine with right arm extended above head. Allow 10 minutes of rest before acquisition — exercise and deep breathing increase liver stiffness.", color: "#0e4a50" },
                    { cat: "Probe & Settings", text: "Use convex 2–5 MHz probe. Activate SWE mode (vendor-specific: ARFI/pSWE or 2D-SWE). Set depth to visualize right lobe segments 5–6. Reduce gain to minimize noise.", color: "#189aa1" },
                    { cat: "ROI Placement", text: "Place ROI ≥1 cm below liver capsule and ≥2 cm from large vessels. Avoid subcapsular parenchyma (falsely elevated stiffness) and areas near hepatic veins or portal tracts.", color: "#0e1e2e" },
                    { cat: "Acquisition", text: "Acquire ≥10 measurements in quiet respiration or brief breath-hold. Discard measurements with IQR/median >30% (unreliable). Report median kPa (not mean).", color: "#4a6fa5" },
                    { cat: "Pitfall", text: "Ascites, right heart failure, cholestasis, and post-prandial state all falsely elevate liver stiffness. Document any confounders. Stiffness >17 kPa in isolation does not confirm cirrhosis without clinical context.", color: "#d97706" },
                    { cat: "Pearl", text: "IQR/M ≤30% = reliable result. IQR/M 30–50% = borderline (report with caution). IQR/M >50% = unreliable — repeat on different day or refer for MRE.", color: "#059669" },
                  ].map((tip, i) => (
                    <div key={i} className="rounded-xl p-4 border" style={{ borderColor: (tip.color) + "30", background: (tip.color) + "08" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tip.color }} />
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tip.color }}>{tip.cat}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* UDFF Technique */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-bold text-[#0e4a50] uppercase tracking-wider mb-3">Ultrasound-Derived Fat Fraction (UDFF)</p>
                <div className="space-y-3">
                  {[
                    { cat: "Patient Preparation", text: "Fast patient ≥2 hours. Supine position. UDFF is less affected by post-prandial state than SWE, but fasting is still recommended for consistency.", color: "#0e4a50" },
                    { cat: "Probe & Settings", text: "Use convex 2–5 MHz probe. Activate UDFF/attenuation imaging mode (vendor-specific). Ensure adequate depth penetration to right lobe.", color: "#189aa1" },
                    { cat: "ROI Placement", text: "Place ROI in right lobe (segments 5–8), ≥1 cm below capsule, away from large vessels and bile ducts. Avoid areas with focal lesions, cysts, or calcifications.", color: "#0e1e2e" },
                    { cat: "Acquisition", text: "Acquire UDFF measurement per vendor protocol. Record UDFF % value. Combine with SWE for comprehensive MASLD assessment (steatosis grade + fibrosis stage).", color: "#4a6fa5" },
                    { cat: "Pitfall", text: "UDFF accuracy decreases with advanced fibrosis (F3–F4) due to altered acoustic properties. Ascites and obesity can reduce signal quality. Always correlate with clinical context.", color: "#d97706" },
                    { cat: "Pearl", text: "UDFF correlates strongly with MRI-PDFF (r>0.90 in most studies). UDFF ≥5% = steatosis (S1+). Use UDFF + SWE together as the non-invasive MASLD workup before considering liver biopsy.", color: "#059669" },
                  ].map((tip, i) => (
                    <div key={i} className="rounded-xl p-4 border" style={{ borderColor: (tip.color) + "30", background: (tip.color) + "08" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tip.color }} />
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tip.color }}>{tip.cat}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{tip.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vendor Quick Reference */}
              <div className="rounded-xl p-4 border" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                <p className="text-xs font-bold text-[#189aa1] mb-2 uppercase tracking-wider">Vendor Quick Reference</p>
                <div className="grid grid-cols-1 gap-1.5 text-xs text-gray-600">
                  <div><span className="font-semibold">Siemens ARFI/pSWE:</span> Virtual Touch Quantification (VTQ) — reports m/s; ×1.05 ≈ kPa</div>
                  <div><span className="font-semibold">GE ElastPQ:</span> Reports kPa directly; use Q-Box for ROI</div>
                  <div><span className="font-semibold">Philips ElastQ:</span> Reports kPa with color map overlay</div>
                  <div><span className="font-semibold">Canon/Toshiba SWE:</span> Reports kPa; RTE mode is qualitative only</div>
                  <div><span className="font-semibold">Samsung UDFF:</span> S-Detect attenuation imaging — reports dB/cm/MHz + UDFF %</div>
                  <div><span className="font-semibold">Fujifilm SWE:</span> Available on Arietta series — reports kPa</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reference */}
        <div className="text-xs text-gray-400 px-1 mt-4">
          Based on: <a href="https://onlinelibrary.wiley.com/doi/10.1002/jum.15874" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of an Ultrasound Examination of the Abdomen and/or Retroperitoneum (2021)</a>; EASL Clinical Practice Guidelines on non-invasive tests (2021).
        </div>
      </div>
    </Layout>
  );
}
