/*
  UltrasoundAssist™ — Peripheral Venous Ultrasound ScanCoach
  Based on: AIUM Practice Parameter for the Performance of Peripheral Venous Ultrasound Examinations
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { Scan, ChevronDown, ChevronUp, Lightbulb, Info, Receipt} from "lucide-react";
import { usePremium } from "@/hooks/usePremium";
import { venousBilling } from "@/lib/scanCoachBillingCodes";

const PATIENT_POSITIONING = "The patient is typically positioned in a reverse Trendelenburg position (head elevated 15–30°) to facilitate venous filling in the lower extremities. For popliteal and calf vein assessment, the patient may be seated with the legs dependent or placed prone with the knee slightly flexed.";

const VENOUS_SCANNING_TIPS = [
  { category: "Scanning Tip", text: "Comprehensive Evaluation: The evaluation should extend from the inguinal ligament to the ankle whenever feasible to avoid missing isolated calf DVT. Current AIUM and SVU guidelines recommend a complete bilateral study when clinically indicated, including assessment of the deep femoral vein and saphenofemoral junction." },
  { category: "Scanning Tip", text: "Systematic Compression: Apply venous compression every 2 cm or less in the transverse plane throughout the entire examination. A normal vein collapses completely with gentle transducer pressure. Incomplete compressibility is the primary diagnostic criterion for DVT. Never rely on colour Doppler alone to exclude DVT." },
];

const views = [
  {
    view: "Common Femoral Vein (CFV)",
    probe: "Transverse, inguinal ligament",
    tips: [
      { category: "Patient Positioning", text: PATIENT_POSITIONING },
      { category: "Transducer Positioning", text: "Transverse plane at the inguinal ligament. The CFV lies medial to the common femoral artery. Identify the saphenofemoral junction where the great saphenous vein joins the CFV from the anteromedial aspect." },
      { category: "What to Assess", text: "Complete compressibility of the CFV in transverse plane. Obtain spectral Doppler waveform — normal shows spontaneous, phasic flow with respiration and augmentation with distal compression. Absent phasicity suggests proximal (iliac/IVC) obstruction." },
      ...VENOUS_SCANNING_TIPS,
    ],
  },
  {
    view: "Femoral Vein (FV)",
    probe: "Transverse, from CFV down the thigh",
    tips: [
      { category: "Patient Positioning", text: PATIENT_POSITIONING },
      { category: "Transducer Positioning", text: "Transverse plane, tracing the femoral vein from the CFV distally through the thigh. The FV (previously called superficial femoral vein) runs with the superficial femoral artery in the adductor (Hunter's) canal. Apply compression every 2 cm throughout its length." },
      { category: "What to Assess", text: "Complete compressibility every 2 cm along the entire length of the FV. The FV is the most common site for DVT. Assess for echogenic thrombus, partial compressibility, or absent colour Doppler flow." },
      ...VENOUS_SCANNING_TIPS,
    ],
  },
  {
    view: "Deep Femoral Vein (DFV)",
    probe: "Transverse, at the confluence with the FV",
    tips: [
      { category: "Patient Positioning", text: PATIENT_POSITIONING },
      { category: "Transducer Positioning", text: "Transverse plane at the proximal thigh, where the DFV (profunda femoris vein) joins the FV. The DFV is typically only assessed at its proximal portion near the confluence. It is not routinely traced distally." },
      { category: "What to Assess", text: "Compressibility at the DFV origin. Isolated DFV DVT is uncommon but clinically significant. Assess for echogenic thrombus extending from the FV into the DFV at the confluence." },
      ...VENOUS_SCANNING_TIPS,
    ],
  },
  {
    view: "Great Saphenous Vein (GSV)",
    probe: "Transverse, at the saphenofemoral junction",
    tips: [
      { category: "Patient Positioning", text: PATIENT_POSITIONING },
      { category: "Transducer Positioning", text: "Transverse plane at the saphenofemoral junction (SFJ) in the groin. The GSV joins the CFV anteromedially. Assess the proximal 10 cm of the GSV for superficial vein thrombosis (SVT) that may extend to or through the SFJ." },
      { category: "What to Assess", text: "Compressibility at the SFJ and proximal GSV. SVT within 3 cm of the SFJ carries significant risk of DVT extension and may require anticoagulation per current AIUM and SVU guidelines. Document the distance of any thrombus from the SFJ." },
      ...VENOUS_SCANNING_TIPS,
    ],
  },
  {
    view: "Popliteal Vein",
    probe: "Transverse, popliteal fossa",
    tips: [
      { category: "Patient Positioning", text: "The patient may be positioned prone with the knee slightly flexed, or seated with the legs dependent. The prone or lateral decubitus position provides optimal access to the popliteal fossa." },
      { category: "Transducer Positioning", text: "Transverse plane in the popliteal fossa. The popliteal vein lies superficial (posterior) to the popliteal artery in this position. The small saphenous vein (SSV) joins the popliteal vein at the saphenopopliteal junction — assess this junction for SVT extension." },
      { category: "What to Assess", text: "Complete compressibility of the popliteal vein. Obtain spectral Doppler waveform — augment with calf squeeze. Assess the saphenopopliteal junction for SVT. The popliteal vein is the second most common site for DVT." },
      ...VENOUS_SCANNING_TIPS,
    ],
  },
  {
    view: "Posterior Tibial Veins (PTV)",
    probe: "Transverse, medial calf",
    tips: [
      { category: "Patient Positioning", text: "The patient is seated with the legs dependent or in the reverse Trendelenburg position. Dependent positioning maximises venous filling in the calf veins and improves visualisation." },
      { category: "Transducer Positioning", text: "Transverse plane along the medial calf, posterior to the tibia. The posterior tibial veins (paired) run with the posterior tibial artery. Trace from the ankle to the popliteal fossa. Use a high-frequency linear transducer." },
      { category: "What to Assess", text: "Compressibility of the paired posterior tibial veins throughout their course. Calf DVT (isolated distal DVT) carries a 15–25% risk of proximal propagation if untreated. Current AIUM and SVU guidelines recommend documenting calf vein assessment." },
      ...VENOUS_SCANNING_TIPS,
    ],
  },
  {
    view: "Peroneal Veins",
    probe: "Transverse, lateral/posterior calf",
    tips: [
      { category: "Patient Positioning", text: "The patient is seated with the legs dependent or in the reverse Trendelenburg position. Dependent positioning maximises venous filling in the calf veins and improves visualisation." },
      { category: "Transducer Positioning", text: "Transverse plane along the posterior/lateral calf, adjacent to the fibula. The peroneal veins (paired) run with the peroneal artery. They are the deepest of the calf veins and can be challenging to visualise in obese patients." },
      { category: "What to Assess", text: "Compressibility of the paired peroneal veins. The peroneal veins are a common site for isolated calf DVT. Use colour Doppler and augmentation to confirm patency when direct compression is difficult due to patient habitus." },
      ...VENOUS_SCANNING_TIPS,
    ],
  },
  {
    view: "Gastrocnemius and Soleal Veins",
    probe: "Transverse, posterior calf",
    tips: [
      { category: "Patient Positioning", text: "The patient is seated with the legs dependent or in the reverse Trendelenburg position. Dependent positioning maximises venous filling in the calf veins and improves visualisation." },
      { category: "Transducer Positioning", text: "Transverse plane in the posterior calf. The gastrocnemius veins drain into the popliteal vein. The soleal sinusoids are large venous lakes within the soleus muscle. These are assessed when focal calf symptoms are present." },
      { category: "What to Assess", text: "Compressibility of the gastrocnemius and soleal veins, especially when focal calf tenderness or swelling is present. Soleal and gastrocnemius vein DVT are common after immobility or surgery. Document any non-compressible segments and their distance from the popliteal vein." },
      ...VENOUS_SCANNING_TIPS,
    ],
  },
];

const examTips = [
  { category: "Scanning Tip", text: "Comprehensive Evaluation: The evaluation should extend from the inguinal ligament to the ankle whenever feasible to avoid missing isolated calf DVT. Current AIUM and SVU guidelines recommend a complete bilateral study when clinically indicated, including assessment of the deep femoral vein and saphenofemoral junction." },
  { category: "Scanning Tip", text: "Systematic Compression: Apply venous compression every 2 cm or less in the transverse plane throughout the entire examination. A normal vein collapses completely with gentle transducer pressure. Incomplete compressibility is the primary diagnostic criterion for DVT. Never rely on colour Doppler alone to exclude DVT." },
  { category: "Scanning Tip", text: "Focal Symptom Evaluation: If the patient presents with focal symptoms such as tenderness in the calf, perform a targeted evaluation of that specific region in addition to the complete proximal study. Isolated calf DVT may be missed if only a limited two-point compression study is performed." },
  { category: "Scanning Tip", text: "Doppler Waveform Symmetry: Always compare the spectral Doppler waveforms of the common femoral veins on both sides. Asymmetric phasicity or absent respiratory variation on one side suggests proximal (iliac or IVC) obstruction that may not be directly visualised with standard lower extremity ultrasound." },
  { category: "Scanning Tip", text: "Optimal Doppler Technique: Obtain all spectral Doppler waveforms from the long axis of the vessel for the most accurate assessment of flow direction and phasicity. Use a low wall filter and low PRF setting to detect low-velocity venous flow. Augment with distal limb compression to confirm patency when spontaneous flow is absent." },
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
  const [showExamTips, setShowGeneral] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

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
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for lower extremity venous duplex ultrasound, aligned with current AIUM and SVU guidelines. Guides compression and Doppler technique from iliac to calf with DVT diagnostic criteria and optimisation tips.
              </p>
              <div className="mt-3">
                <Link href="/venous-navigator">
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border border-white/30 text-white/90 hover:bg-white/10 transition-all">
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
              {venousBilling.map((section, si) => (
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
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Peripheral Venous Ultrasound Examinations</a>
        </div>
      </div>
    </Layout>
  );
}
