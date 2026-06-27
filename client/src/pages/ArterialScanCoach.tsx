/*
  UltrasoundAssist™ — Vascular Arterial Ultrasound Upper and Lower Extremity ScanCoach
  Based on: AIUM Practice Parameter for the Performance of Peripheral Arterial Ultrasound Examinations
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
import { arterialBilling } from "@/lib/scanCoachBillingCodes";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { ScanCoachViewMediaPanel } from "@/components/ScanCoachViewMediaPanel";

const ARTERIAL_SCANNING_TIPS = [
  { category: "Scanning Tip", text: "Patient Preparation: Perform the examination in a warm room to minimize peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing. Cold extremities cause vasoconstriction that artificially lowers segmental pressures and waveform amplitudes." },
  { category: "Scanning Tip", text: "Exercise Testing for Claudication: For claudication assessment when resting ABI is normal or higher than anticipated, perform post-exercise ABI testing. Have the patient walk on a treadmill (3.5 km/h, 12% grade) for up to 5 minutes or until symptoms occur. A post-exercise ABI drop of ≥20% is diagnostic of significant PAD." },
];

export const views = [
  {
    id: "segmental",
    view: "Segmental Limb Pressures and Waveforms",
    probe: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, above the wrist (upper extremity); Digits (toes and fingers)",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing begins." },
      { category: "Transducer Positioning", text: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, above the wrist (upper extremity); Digits (toes and fingers). Place cuffs snugly — a loose cuff overestimates the pressure." },
      { category: "What to Assess", text: "Segmental or digital blood pressure readings, Doppler waveforms at each level, return of blood flow as cuff deflates. A pressure gradient >20 mmHg between adjacent segments indicates significant disease at that level." },
      ...ARTERIAL_SCANNING_TIPS,
    ],
  },
  {
    id: "cw_doppler",
    view: "CW Doppler Waveforms",
    probe: "Common femoral, superficial femoral, popliteal, posterior tibial, dorsalis pedis (lower extremity); Subclavian, axillary, brachial, radial, ulnar (upper extremity)",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing begins." },
      { category: "Transducer Positioning", text: "Common femoral, superficial femoral, popliteal, posterior tibial, dorsalis pedis (lower extremity); Subclavian, axillary, brachial, radial, ulnar (upper extremity). Maintain a consistent Doppler angle throughout the examination." },
      { category: "What to Assess", text: "Arterial waveforms at each level — normal is triphasic (high-resistance). Biphasic waveforms indicate mild-moderate disease; monophasic indicates severe disease or proximal occlusion. Always compare bilaterally." },
      ...ARTERIAL_SCANNING_TIPS,
    ],
  },
  {
    id: "pvr",
    view: "Pulse Volume Recordings (PVRs)",
    probe: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, above the wrist (upper extremity); Toes and digits",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing begins." },
      { category: "Transducer Positioning", text: "Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, above the wrist (upper extremity); Toes and digits. Cuffs are inflated to 65 mmHg for PVR recording." },
      { category: "What to Assess", text: "Global tissue perfusion at each level. Normal PVR shows a sharp upstroke, clear peak, and dicrotic notch. Flattened waveforms indicate reduced perfusion. PVRs are particularly useful when arteries are non-compressible due to calcification." },
      ...ARTERIAL_SCANNING_TIPS,
    ],
  },
  {
    id: "tcpo2",
    view: "Transcutaneous Oxygen Tension (tcPO2) Measurements",
    probe: "Foot, ankle, calf (lower extremities), with a reference point on the chest",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing begins." },
      { category: "Transducer Positioning", text: "Foot, ankle, calf (lower extremities), with a reference point on the chest. Allow 15–20 minutes for the electrodes to equilibrate before recording values." },
      { category: "What to Assess", text: "Delivery of oxygen to the skin in an area of questionable viability. Normal tcPO2 is >40 mmHg. Values of 20–40 mmHg indicate impaired healing potential; <20 mmHg indicates critical ischemia with poor wound healing prognosis." },
      ...ARTERIAL_SCANNING_TIPS,
    ],
  },
  {
    id: "ppg",
    view: "Photoplethysmography (PPG)",
    probe: "Digits (toes and fingers)",
    tips: [
      { category: "Patient Positioning", text: "The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing begins." },
      { category: "Transducer Positioning", text: "Digits (toes and fingers). The PPG sensor detects changes in light absorption caused by blood volume changes in the microvascular bed beneath the sensor." },
      { category: "What to Assess", text: "Blood volume changes in the microvascular bed, perfusion of the measured tissue bed, and presence of atherosclerotic disease. A flat PPG waveform at the digit indicates absent or severely reduced digital perfusion." },
      ...ARTERIAL_SCANNING_TIPS,
    ],
  },
];

const examTips = [
  { category: "Scanning Tip", text: "Patient Preparation: Perform the examination in a warm room to minimize peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing. Cold extremities cause vasoconstriction that artificially lowers segmental pressures and waveform amplitudes." },
  { category: "Scanning Tip", text: "Exercise Testing for Claudication: For claudication assessment when resting ABI is normal or higher than anticipated, perform post-exercise ABI testing. Have the patient walk on a treadmill (3.5 km/h, 12% grade) for up to 5 minutes or until symptoms occur. A post-exercise ABI drop of ≥20% is diagnostic of significant PAD." },
  { category: "Scanning Tip", text: "Non-Compressible Calcified Arteries: For non-compressible calcified arteries (ABI >1.4), perform a toe-brachial index (TBI) as distal small vessels are less affected by calcification. A TBI <0.7 is considered abnormal. PVRs and tcPO2 are also valuable in this setting." },
  { category: "Scanning Tip", text: "Doppler Waveform Optimization: Audibly and visually optimize Doppler waveforms. Maintain a consistent Doppler angle throughout the examination (45–60°). Use the highest frequency CW Doppler probe that allows adequate penetration. Always compare bilateral waveforms at the same level." },
  { category: "Scanning Tip", text: "Segmental Pressure Measurements: Use appropriately sized blood pressure cuffs — a cuff that is too small will overestimate pressure. A rapid inflation device is helpful. Use the highest Doppler signal obtained at the ankle (posterior tibial or dorsalis pedis) for ABI calculation." },
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
  const [showBilling, setShowBilling] = useState(false);

  const { mergeView } = useScanCoachOverrides("arterial");
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
                <span className="text-sm text-white/80 font-medium">Arterial · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                Vascular Arterial Ultrasound ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">View-by-View Acquisition Guidance</p>
              <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
                View-by-view acquisition guidance for lower and upper extremity arterial assessment, aligned with current AIUM and SVU guidelines. Covers duplex scanning, ABI measurement, and PVR technique with Doppler optimization tips and waveform interpretation criteria.
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

                        <ScanCoachViewMediaPanel
              viewId={currentView.id}
              view={currentView}
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
              {arterialBilling.map((section, si) => (
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
          Based on: <a href="https://www.aium.org/resources/practice-parameters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#189aa1]">AIUM Practice Parameter for the Performance of Peripheral Arterial Ultrasound Examinations</a>
        </div>
      </div>
    </Layout>
  );
}
